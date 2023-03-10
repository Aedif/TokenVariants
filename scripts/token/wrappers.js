import { libWrapper } from '../libWrapper/shim.js';
import { TVA_CONFIG } from '../settings.js';
import { drawMorphOverlay } from '../utils.js';
import { getAllEffectMappings } from './effects.js';
import { checkAndDisplayUserSpecificImage } from './userToImage.js';

const registeredWrappers = {};

export function registerTokenWrappers() {
  _register_onDragLeftStart();
  _registerDraw();
  _registerDrawEffects();
}

function _unregister(methodName) {
  if (methodName in registeredWrappers) {
    libWrapper.unregister('token-variants', registeredWrappers[methodName]);
    delete registeredWrappers[methodName];
  }
}

// Controls image change morph and UserToImage mappings
function _registerDraw() {
  libWrapper.register(
    'token-variants',
    'Token.prototype.draw',
    async function (wrapped, ...args) {
      let startMorph;
      if (this.tvaMorph && !this.tva_morphing) {
        startMorph = await drawMorphOverlay(this, this.tvaMorph);
      } else if (this.tva_morphing) {
        this.tvaMorph = null;
      }

      let result = await wrapped(...args);

      if (startMorph) {
        startMorph(this.document.alpha);
      }

      checkAndDisplayUserSpecificImage(this);
      return result;
    },
    'WRAPPER'
  );
}

// A fix to make sure that the "ghost" image of the token during drag reflects UserToImage mapping
function _register_onDragLeftStart() {
  libWrapper.register(
    'token-variants',
    'PlaceableObject.prototype._onDragLeftStart',
    function (wrapped, ...args) {
      // Change all the controlled tokens' source data if needed before they are cloned and drawn
      const targets = this.layer.options.controllableObjects ? this.layer.controlled : [this];
      const toUndo = [];
      for (const token of targets) {
        const mappings = token.document?.getFlag('token-variants', 'userMappings') || {};
        const img = mappings[game.userId];
        if (img) {
          toUndo.push([token, token.document._source.img]);
          token.document._source.img = img;
          token.document.texture.src = img;
        }
      }

      // Call _onDragLeftStart function to draw the new image
      let result = wrapped(...args);

      // Now that the image is drawn, reset the source data back to the original
      for (const [token, img] of toUndo) {
        token.document._source.img = img;
        token.document.texture.src = img;
      }

      return result;
    },
    'WRAPPER'
  );
}

function _registerDrawEffects() {
  _unregister('drawEffects');
  if (TVA_CONFIG.disableEffectIcons) {
    _registerDrawEffectsOverride();
  } else if (
    TVA_CONFIG.displayEffectIconsOnHover ||
    (TVA_CONFIG.filterEffectIcons && !['pf1e', 'pf2e'].includes(game.system.id))
  ) {
    _registerDrawEffectsWrapper();
  }
}

// Removes all effects drawn on the Token
function _registerDrawEffectsOverride() {
  let id = libWrapper.register(
    'token-variants',
    'Token.prototype.drawEffects',
    async function (...args) {
      this.effects.removeChildren().forEach((c) => c.destroy());
      this.effects.bg = this.effects.addChild(new PIXI.Graphics());
      this.effects.overlay = null;
    },
    'OVERRIDE'
  );
  registeredWrappers['drawEffects'] = id;
}

function _registerDrawEffectsWrapper() {
  let id = libWrapper.register(
    'token-variants',
    'Token.prototype.drawEffects',
    async function (wrapped, ...args) {
      if (TVA_CONFIG.displayEffectIconsOnHover && this.effects) {
        this.effects.visible = false;
      }

      if (!TVA_CONFIG.filterEffectIcons || ['pf1e', 'pf2e'].includes(game.system.id)) return await wrapped(...args);

      // Temporarily removing token and actor effects based on module settings
      // after the effect icons have been drawn, they will be reset to originals
      const tokenEffects = this.document.effects;
      const actorEffects = this.actor?.effects;

      let restrictedEffects = TVA_CONFIG.filterIconList;
      if (TVA_CONFIG.filterCustomEffectIcons) {
        const mappings = getAllEffectMappings({
          actor: this.actor ? this.actor : this.document,
        });
        if (mappings) restrictedEffects = restrictedEffects.concat(Object.keys(mappings));
      }

      let removed = [];
      if (restrictedEffects.length) {
        if (tokenEffects.length) {
          this.document.effects = tokenEffects.filter(
            // check if it's a string here
            // for tokens without representing actors effects are just stored as paths to icons
            (ef) => typeof ef === 'string' || !restrictedEffects.includes(ef.label)
          );
        }
        if (this.actor && actorEffects.size) {
          removed = actorEffects.filter((ef) => restrictedEffects.includes(ef.label));
          for (const r of removed) {
            actorEffects.delete(r.id);
          }
        }
      }

      const result = await wrapped(...args);

      if (restrictedEffects.length) {
        if (tokenEffects.length) {
          this.document.effects = tokenEffects;
        }
        if (removed.length) {
          for (const r of removed) {
            actorEffects.set(r.id, r);
          }
        }
      }
      return result;
    },
    'WRAPPER'
  );
  registeredWrappers['drawEffects'] = id;
}
