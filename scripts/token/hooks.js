import { TVA_CONFIG } from '../settings.js';
import { TVASprite } from '../sprite/TVASprite.js';
import { determineAddedRemovedEffects, drawMorphOverlay } from '../utils.js';
import {
  evaluateComparatorEffects,
  evaluateStateEffects,
  getAllEffectMappings,
  registerEffectHooks,
  updateWithEffectMapping,
} from './effects.js';
import { drawOverlays } from './overlay.js';
import { checkAndDisplayUserSpecificImage } from './userToImage.js';

export function registerTokenHooks() {
  // Insert default random image field
  Hooks.on('renderTokenConfig', async (config, html) => {
    const checkboxRandomize = html.find('input[name="randomImg"]');
    if (checkboxRandomize.length && !html.find('.token-variants-randomImgDefault').length) {
      const defaultImg =
        config.actor?.prototypeToken?.flags['token-variants']?.['randomImgDefault'] ||
        config.actor?.prototypeToken?.flags['token-hud-wildcard']?.['default'] ||
        '';

      const field = await renderTemplate('/modules/token-variants/templates/randomImgDefault.html', {
        defaultImg,
        active: checkboxRandomize.is(':checked'),
      });
      checkboxRandomize.closest('.form-group').after(field);

      const tvaRngField = html.find('.token-variants-randomImgDefault');

      tvaRngField.find('button').click((event) => {
        event.preventDefault();
        const input = tvaRngField.find('input');
        new FilePicker({ current: input.val(), field: input[0] }).browse(defaultImg);
      });

      checkboxRandomize.click((event) => {
        if (event.target.checked) {
          tvaRngField.addClass('active');
        } else {
          tvaRngField.removeClass('active');
        }
      });
    }
  });

  // Set Default Wildcard images if needed
  Hooks.on('preCreateToken', (tokenDocument, data, options, userId) => {
    if (game.user.id === userId && tokenDocument.actor?.prototypeToken?.randomImg) {
      const defaultImg =
        tokenDocument.actor?.prototypeToken?.flags['token-variants']?.['randomImgDefault'] ||
        tokenDocument.actor?.prototypeToken?.flags['token-hud-wildcard']?.['default'] ||
        '';
      if (defaultImg) tokenDocument.updateSource({ 'texture.src': defaultImg });
    }
  });

  Hooks.on('createCombatant', (combatant, options, userId) => {
    if (game.userId !== userId) return;
    const token = combatant._token || canvas.tokens.get(combatant.tokenId);
    if (!token || !token.actor) return;

    updateWithEffectMapping(token, {
      added: ['token-variants-combat'],
    });
  });

  Hooks.on('deleteCombatant', (combatant, options, userId) => {
    if (game.userId !== userId) return;
    _deleteCombatant(combatant);
  });

  Hooks.on('deleteCombat', (combat, options, userId) => {
    if (game.userId !== userId) return;
    combat.combatants.forEach((combatant) => {
      _deleteCombatant(combatant);
    });
  });

  registerEffectHooks();

  // A fix to make sure that the "ghost" image of the token during drag reflects assigned user mappings
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

  // ========================
  // Overlay related wrappers
  // ========================
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

      // drawOverlays(this);
      checkAndDisplayUserSpecificImage(this);
      return result;
    },
    'WRAPPER'
  );

  Hooks.on('refreshToken', (token) => {
    if (token.tva_morphing) {
      token.mesh.alpha = 0;
    }
    if (token.tva_sprites)
      for (const child of token.tva_sprites) {
        if (child instanceof TVASprite) {
          child.refresh(null, false, false);
        }
      }
  });

  Hooks.on('destroyToken', (token) => {
    if (token.tva_sprites)
      for (const child of token.tva_sprites) {
        canvas.primary.removeChild(child)?.destroy();
      }
  });

  if (TVA_CONFIG.disableEffectIcons) {
    libWrapper.register(
      'token-variants',
      'Token.prototype.drawEffects',
      async function (...args) {
        this.effects.removeChildren().forEach((c) => c.destroy());
        this.effects.bg = this.effects.addChild(new PIXI.Graphics());
        this.effects.overlay = null;
      },
      'OVERRIDE'
    );
  } else if (TVA_CONFIG.filterEffectIcons && !['pf1e', 'pf2e'].includes(game.system.id)) {
    libWrapper.register(
      'token-variants',
      'Token.prototype.drawEffects',
      async function (wrapped, ...args) {
        if (this.effects && TVA_CONFIG.displayEffectIconsOnHover) {
          this.effects.visible = false;
        }
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
  } else if (TVA_CONFIG.displayEffectIconsOnHover) {
    libWrapper.register(
      'token-variants',
      'Token.prototype.drawEffects',
      async function (wrapped, ...args) {
        if (this.effects && TVA_CONFIG.displayEffectIconsOnHover) {
          this.effects.visible = false;
        }
        return wrapped(...args);
      },
      'WRAPPER'
    );
  }

  // OnHover settings specific hooks
  Hooks.on('hoverToken', (token, hoverIn) => {
    if (TVA_CONFIG.displayEffectIconsOnHover) {
      if (token.effects) {
        token.effects.visible = hoverIn;
      }
    }
  });

  Hooks.on('highlightObjects', () => {
    if (TVA_CONFIG.displayEffectIconsOnHover && canvas.tokens.active) {
      for (const tkn of canvas.tokens.placeables) {
        if (tkn.effects) {
          tkn.effects.visible = tkn.hover;
        }
      }
    }
  });
  // end of OnHover specific hooks

  Hooks.on('preUpdateActor', function (actor, change, options, userId) {
    if (game.user.id !== userId) return;

    // If this is an HP update we need to determine what the current HP effects would be
    // so that they can be compared against in 'updateActor' hook
    let containsHPUpdate = false;
    if (game.system.id === 'cyberpunk-red-core') {
      containsHPUpdate = change.system?.derivedStats?.hp;
    } else if (game.system.id === 'lfg') {
      containsHPUpdate = change.system?.health;
    } else {
      containsHPUpdate = change.system?.attributes?.hp;
    }

    if (containsHPUpdate) {
      const tokens = actor.getActiveTokens();
      for (const tkn of tokens) {
        if (!tkn.document.actorLink) continue;
        const preUpdateEffects = evaluateComparatorEffects(tkn);
        if (preUpdateEffects.length) {
          if (!options['token-variants']) options['token-variants'] = {};
          options['token-variants'][tkn.id] = { preUpdateEffects };
        }
      }
    }
  });

  Hooks.on('updateActor', async function (actor, change, options, userId) {
    if (game.user.id !== userId) return;

    if ('flags' in change && 'token-variants' in change.flags) {
      const tokenVariantFlags = change.flags['token-variants'];
      if ('effectMappings' in tokenVariantFlags || '-=effectMappings' in tokenVariantFlags) {
        const tokens = actor.token ? [actor.token] : actor.getActiveTokens();
        for (const tkn of tokens) {
          if (TVA_CONFIG.filterEffectIcons) {
            await tkn.drawEffects();
          }
          if (game.user.id === userId) updateWithEffectMapping(tkn);
          else drawOverlays(tkn);
        }
      }
    }

    let containsHPUpdate = false;
    if (game.system.id === 'cyberpunk-red-core') {
      containsHPUpdate = change.system?.derivedStats?.hp;
    } else if (game.system.id === 'lfg') {
      containsHPUpdate = change.system?.health;
    } else {
      containsHPUpdate = change.system?.attributes?.hp;
    }

    if (containsHPUpdate) {
      const tokens = actor.getActiveTokens();
      for (const tkn of tokens) {
        if (!tkn.document.actorLink) continue;
        // Check if HP effects changed by comparing them against the ones calculated in preUpdateActor
        const added = [];
        const removed = [];
        const postUpdateEffects = evaluateComparatorEffects(tkn);
        const preUpdateEffects = options['token-variants']?.[tkn.id]?.preUpdateEffects || [];

        determineAddedRemovedEffects(added, removed, postUpdateEffects, preUpdateEffects);
        if (added.length || removed.length) updateWithEffectMapping(tkn, { added, removed });
      }
    }
  });

  Hooks.on('preUpdateToken', function (token, change, options, userId) {
    // Handle a morph request
    if (options.tvaMorph && change.texture?.src) {
      let morph = Array.isArray(options.tvaMorph) ? options.tvaMorph[0] : options.tvaMorph;
      morph.filterId = 'tvaMorph';
      morph.imagePath = change.texture.src;

      const message = {
        handlerName: 'drawMorphOverlay',
        args: {
          tokenId: token.id,
          morph: [morph],
        },
        type: 'UPDATE',
      };
      game.socket?.emit('module.token-variants', message);
      token.object.tvaMorph = [morph];

      options.animate = false;
    }

    if (game.user.id !== userId) return;

    const preUpdateEffects = evaluateComparatorEffects(token);
    if (preUpdateEffects.length) {
      if (!options['token-variants']) options['token-variants'] = {};
      options['token-variants'].preUpdateEffects = preUpdateEffects;
    }

    // System specific effects
    const stateEffects = [];
    evaluateStateEffects(token, stateEffects);
    if (stateEffects.length) {
      if (!options['token-variants']) options['token-variants'] = {};
      options['token-variants']['system'] = stateEffects;
    }

    if (game.system.id === 'dnd5e' && token.actor?.isPolymorphed) {
      options['token-variants'] = {
        wasPolymorphed: true,
      };
    }
  });

  Hooks.on('updateToken', async function (token, change, options, userId) {
    // Update User Specific Image
    if (change.flags?.['token-variants']) {
      if ('userMappings' in change.flags['token-variants'] || '-=userMappings' in change.flags['token-variants']) {
        checkAndDisplayUserSpecificImage(token);
      }
    }

    if (game.user.id !== userId) return;

    const addedEffects = [];
    const removedEffects = [];
    const postUpdateEffects = evaluateComparatorEffects(token);
    const preUpdateEffects = options['token-variants']?.preUpdateEffects || [];
    determineAddedRemovedEffects(addedEffects, removedEffects, postUpdateEffects, preUpdateEffects);

    const newStateEffects = [];
    evaluateStateEffects(token, newStateEffects);
    const oldStateEffects = options['token-variants']?.['system'] || [];
    determineAddedRemovedEffects(addedEffects, removedEffects, newStateEffects, oldStateEffects);

    if (addedEffects.length || removedEffects.length)
      updateWithEffectMapping(token, { added: addedEffects, removed: removedEffects });

    // HP Effects
    let containsHPUpdate = false;
    if (game.system.id === 'cyberpunk-red-core') {
      containsHPUpdate = change.actorData?.system?.derivedStats?.hp;
    } else if (game.system.id === 'lfg') {
      containsHPUpdate = change.actorData?.system?.health;
    } else {
      containsHPUpdate = change.actorData?.system?.attributes?.hp;
    }

    if ('actorLink' in change || containsHPUpdate) {
      updateWithEffectMapping(token);
    } else if (options['token-variants']?.wasPolymorphed && !token.actor?.isPolymorphed) {
      updateWithEffectMapping(token);
    }

    if (game.userId === userId && 'hidden' in change) {
      updateWithEffectMapping(token, {
        added: change.hidden ? ['token-variants-visibility'] : [],
        removed: !change.hidden ? ['token-variants-visibility'] : [],
      });
    }
  });
}

async function _deleteCombatant(combatant) {
  const token = combatant._token || canvas.tokens.get(combatant.tokenId);
  if (!token || !token.actor) return;
  await updateWithEffectMapping(token, {
    removed: ['token-variants-combat'],
  });
}
