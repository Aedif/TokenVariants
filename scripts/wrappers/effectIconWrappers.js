import { getAllEffectMappings } from '../hooks/effectMappingHooks.js';
import { TVA_CONFIG } from '../settings.js';
import { registerWrapper, unregisterWrapper } from './wrappers.js';

const feature_id = 'effectIcons';

export function registerEffectIconWrappers() {
  if (TVA_CONFIG.disableEffectIcons) {
    registerWrapper(feature_id + '-fullOverride', 'Token.prototype.drawEffects', _drawEffects_fullReplace, 'OVERRIDE');
  } else {
    unregisterWrapper(feature_id + '-fullOverride', 'Token.prototype.drawEffects');
  }

  if (
    !TVA_CONFIG.disableEffectIcons &&
    (TVA_CONFIG.displayEffectIconsOnHover ||
      (TVA_CONFIG.filterEffectIcons && !['pf1e', 'pf2e'].includes(game.system.id)))
  ) {
    registerWrapper(feature_id, 'Token.prototype.drawEffects', _drawEffects, 'OVERRIDE');
  } else {
    unregisterWrapper(feature_id, 'Token.prototype.drawEffects');
  }
}

async function _drawEffects_fullReplace(...args) {
  this.effects.removeChildren().forEach((c) => c.destroy());
  this.effects.bg = this.effects.addChild(new PIXI.Graphics());
  this.effects.overlay = null;
}

async function _drawEffects(...args) {
  this.effects.renderable = false;
  this.effects.removeChildren().forEach((c) => c.destroy());
  this.effects.bg = this.effects.addChild(new PIXI.Graphics());
  this.effects.overlay = null;

  // Categorize new effects
  let tokenEffects = this.document.effects;
  let actorEffects = this.actor?.temporaryEffects || [];
  let overlay = {
    src: this.document.overlayEffect,
    tint: null,
  };

  // Modified from the original token.drawEffects
  if (tokenEffects.length || actorEffects.length) {
    let restrictedEffects = TVA_CONFIG.filterIconList;
    if (TVA_CONFIG.filterCustomEffectIcons) {
      const mappings = getAllEffectMappings({
        actor: this.actor ? this.actor : this.document,
      });
      if (mappings) restrictedEffects = restrictedEffects.concat(Object.keys(mappings));
    }
    actorEffects = actorEffects.filter((ef) => !restrictedEffects.includes(ef.label));
    tokenEffects = tokenEffects.filter(
      // check if it's a string here
      // for tokens without representing actors effects are just stored as paths to icons
      (ef) => typeof ef === 'string' || !restrictedEffects.includes(ef.label)
    );
  }
  // End of modifications

  // Draw status effects
  if (tokenEffects.length || actorEffects.length) {
    const promises = [];

    // Draw actor effects first
    for (let f of actorEffects) {
      if (!f.icon) continue;
      const tint = Color.from(f.tint ?? null);
      if (f.getFlag('core', 'overlay')) {
        overlay = { src: f.icon, tint };
        continue;
      }
      promises.push(this._drawEffect(f.icon, tint));
    }

    // Next draw token effects
    for (let f of tokenEffects) promises.push(this._drawEffect(f, null));
    await Promise.all(promises);
  }

  // Draw overlay effect
  this.effects.overlay = await this._drawOverlay(overlay.src, overlay.tint);
  this._refreshEffects();
  this.effects.renderable = true;
}
