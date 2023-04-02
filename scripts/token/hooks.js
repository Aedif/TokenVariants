import { renderHud } from '../../applications/tokenHUD.js';
import { showArtSelect } from '../../token-variants.mjs';
import { doRandomSearch, doSyncSearch } from '../search.js';
import { TVA_CONFIG } from '../settings.js';
import { TVASprite } from '../sprite/TVASprite.js';
import {
  determineAddedRemovedEffects,
  getTokenConfigForUpdate,
  keyPressed,
  nameForgeRandomize,
  SEARCH_TYPE,
  updateActorImage,
  updateTokenImage,
} from '../utils.js';
import {
  evaluateComparatorEffects,
  evaluateStateEffects,
  registerEffectHooks,
  updateWithEffectMapping,
} from './effects.js';
import { drawOverlays } from './overlay.js';

export function registerTokenHooks() {
  Hooks.on('createActor', _createActor);
  Hooks.on('createToken', _createToken);
  Hooks.on('renderTokenConfig', _modTokenConfig);
  Hooks.on('renderTokenHUD', renderHud);

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

  Hooks.on('preUpdateCombat', (combat, round, options, userId) => {
    if (game.userId !== userId) return;
    options['token-variants'] = {
      combatantId: combat?.combatant?.token?.id,
      nextCombatantId: combat?.nextCombatant?.token?.id,
    };
  });

  Hooks.on('updateCombat', (combat, round, options, userId) => {
    if (game.userId !== userId) return;

    const previousCombatantId = options['token-variants']?.combatantId;
    const previousNextCombatantId = options['token-variants']?.nextCombatantId;

    const currentCombatantId = combat?.combatant?.token?.id;
    const currentNextCombatantId = combat?.nextCombatant?.token?.id;

    const updateCombatant = function (id, added = [], removed = []) {
      if (game.user.isGM) {
        const token = canvas.tokens.get(id);
        if (token) updateWithEffectMapping(token, { added, removed });
      } else {
        const message = {
          handlerName: 'effectMappings',
          args: { tokenId: id, sceneId: canvas.scene.id, added, removed },
          type: 'UPDATE',
        };
        game.socket?.emit('module.token-variants', message);
      }
    };

    if (previousCombatantId !== currentCombatantId) {
      if (previousCombatantId) updateCombatant(previousCombatantId, [], ['combat-turn']);
      if (currentCombatantId) updateCombatant(previousCombatantId, ['combat-turn'], []);
    }
    if (previousNextCombatantId !== currentNextCombatantId) {
      if (previousNextCombatantId) updateCombatant(previousNextCombatantId, [], ['combat-turn-next']);
      if (currentNextCombatantId) updateCombatant(currentNextCombatantId, ['combat-turn-next'], []);
    }
  });

  Hooks.on('deleteCombat', (combat, options, userId) => {
    if (game.userId !== userId) return;
    combat.combatants.forEach((combatant) => {
      _deleteCombatant(combatant);
    });
  });

  registerEffectHooks();

  // ========================
  // Overlay related wrappers
  // ========================

  Hooks.on('refreshToken', (token) => {
    if (token.tva_sprites)
      for (const child of token.tva_sprites) {
        if (child instanceof TVASprite) {
          child.refresh(null, { preview: false, fullRefresh: false });
        }
      }
  });

  Hooks.on('destroyToken', (token) => {
    if (token.tva_sprites)
      for (const child of token.tva_sprites) {
        canvas.primary.removeChild(child)?.destroy();
      }
  });

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
    } else if (game.system.id === 'lfg' || game.system.id === 'worldbuilding') {
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
    } else if (game.system.id === 'lfg' || game.system.id === 'worldbuilding') {
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
        let p = canvas.tokens.get(token.id);
        if (p) {
          await p.draw();
          p.visible = p.isVisible;
        }
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
    } else if (game.system.id === 'lfg' || game.system.id === 'worldbuilding') {
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

async function _createToken(token, options, userId) {
  drawOverlays(token._object);
  if (userId && game.user.id != userId) return;
  updateWithEffectMapping(token);

  // Check if random search is enabled and if so perform it
  const actorRandSettings = game.actors.get(token.actorId)?.getFlag('token-variants', 'randomizerSettings');
  const randSettings = mergeObject(TVA_CONFIG.randomizer, actorRandSettings ?? {}, {
    inplace: false,
    recursive: false,
  });

  let vDown = keyPressed('v');
  const flagTarget = token.actor ? game.actors.get(token.actor.id) : token.document ?? token;
  const popupFlag = flagTarget.getFlag('token-variants', 'popups');

  if ((vDown && randSettings.tokenCopyPaste) || (!vDown && randSettings.tokenCreate)) {
    let performRandomSearch = true;
    if (!actorRandSettings) {
      if (randSettings.representedActorDisable && token.actor) performRandomSearch = false;
      if (randSettings.linkedActorDisable && token.actorLink) performRandomSearch = false;
      if (_disableRandomSearchForType(randSettings, token.actor)) performRandomSearch = false;
    } else {
      performRandomSearch = Boolean(actorRandSettings);
    }

    if (performRandomSearch) {
      // Randomize Token Name if need be
      const randomName = await nameForgeRandomize(randSettings);
      if (randomName) {
        token.update({ name: randomName });
      }

      const img = await doRandomSearch(token.name, {
        searchType: SEARCH_TYPE.TOKEN,
        actor: token.actor,
        randomizerOptions: randSettings,
      });
      if (img) {
        await updateTokenImage(img[0], {
          token: token,
          actor: token.actor,
          imgName: img[1],
        });
      }

      if (!img) return;

      if (randSettings.diffImages) {
        let imgPortrait;
        if (randSettings.syncImages) {
          imgPortrait = await doSyncSearch(token.name, img[1], {
            actor: token.actor,
            searchType: SEARCH_TYPE.PORTRAIT,
            randomizerOptions: randSettings,
          });
        } else {
          imgPortrait = await doRandomSearch(token.name, {
            searchType: SEARCH_TYPE.PORTRAIT,
            actor: token.actor,
            randomizerOptions: randSettings,
          });
        }

        if (imgPortrait) {
          await updateActorImage(token.actor, imgPortrait[0]);
        }
      } else if (randSettings.tokenToPortrait) {
        await updateActorImage(token.actor, img[0]);
      }
      return;
    }
    if (popupFlag == null && !randSettings.popupOnDisable) {
      return;
    }
  } else if (randSettings.tokenCreate || randSettings.tokenCopyPaste) {
    return;
  }

  // Check if pop-up is enabled and if so open it
  if (!TVA_CONFIG.permissions.popups[game.user.role]) {
    return;
  }

  let dirKeyDown = keyPressed('popupOverride');

  if (vDown && TVA_CONFIG.popup.disableAutoPopupOnTokenCopyPaste) {
    return;
  }

  if (!dirKeyDown || (dirKeyDown && vDown)) {
    if (TVA_CONFIG.popup.disableAutoPopupOnTokenCreate && !vDown) {
      return;
    } else if (popupFlag == null && _disablePopupForType(token.actor)) {
      return;
    } else if (popupFlag != null && !popupFlag) {
      return;
    }
  }

  showArtSelect(token.name, {
    callback: async function (imgSrc, imgName) {
      if (TVA_CONFIG.popup.twoPopups) {
        await updateActorImage(token.actor, imgSrc);
        _twoPopupPrompt(token.actor, imgSrc, imgName, token);
      } else {
        updateTokenImage(imgSrc, {
          actor: token.actor,
          imgName: imgName,
          token: token,
        });
      }
    },
    searchType: TVA_CONFIG.popup.twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.TOKEN,
    object: token,
    preventClose: TVA_CONFIG.popup.twoPopups && TVA_CONFIG.popup.twoPopupsNoDialog,
  });
}

async function _createActor(actor, options, userId) {
  if (userId && game.user.id != userId) return;

  // Check if random search is enabled and if so perform it
  const randSettings = TVA_CONFIG.randomizer;
  if (randSettings.actorCreate) {
    let performRandomSearch = true;
    if (randSettings.linkedActorDisable && actor.prototypeToken.actorLink) performRandomSearch = false;
    if (_disableRandomSearchForType(randSettings, actor)) performRandomSearch = false;

    if (performRandomSearch) {
      const img = await doRandomSearch(actor.name, {
        searchType: SEARCH_TYPE.PORTRAIT,
        actor: actor,
      });
      if (img) {
        await updateActorImage(actor, img[0]);
      }

      if (!img) return;

      if (randSettings.diffImages) {
        let imgToken;
        if (randSettings.syncImages) {
          imgToken = await doSyncSearch(actor.name, img[1], { actor: actor });
        } else {
          imgToken = await doRandomSearch(actor.name, {
            searchType: SEARCH_TYPE.TOKEN,
            actor: actor,
          });
        }

        if (imgToken) {
          await updateTokenImage(imgToken[0], { actor: actor, imgName: imgToken[1] });
        }
      }
      return;
    }
    if (!randSettings.popupOnDisable) {
      return;
    }
  }

  // Check if pop-up is enabled and if so open it
  if (!TVA_CONFIG.permissions.popups[game.user.role]) {
    return;
  }

  if (TVA_CONFIG.popup.disableAutoPopupOnActorCreate && !keyPressed('popupOverride')) {
    return;
  } else if (_disablePopupForType(actor)) {
    return;
  }

  showArtSelect(actor.name, {
    callback: async function (imgSrc, name) {
      const actTokens = actor.getActiveTokens();
      const token = actTokens.length === 1 ? actTokens[0] : null;
      await updateActorImage(actor, imgSrc);
      if (TVA_CONFIG.popup.twoPopups) _twoPopupPrompt(actor, imgSrc, name, token);
      else {
        updateTokenImage(imgSrc, {
          actor: actor,
          imgName: name,
          token: token,
        });
      }
    },
    searchType: TVA_CONFIG.popup.twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.PORTRAIT_AND_TOKEN,
    object: actor,
    preventClose: TVA_CONFIG.popup.twoPopups && TVA_CONFIG.popup.twoPopupsNoDialog,
  });
}

/**
 * Adds a button to 'Token Configuration' window's 'Image' tab which opens
 * ArtSelect using the token's name.
 */
function _modTokenConfig(tokenConfig, html, _) {
  if (TVA_CONFIG.permissions.image_path_button[game.user.role]) {
    let fields = html[0].getElementsByClassName('image');
    for (let field of fields) {
      if (field.getAttribute('name') == 'texture.src') {
        let el = document.createElement('button');
        el.type = 'button';
        el.title = game.i18n.localize('token-variants.windows.art-select.select-variant');
        el.className = 'token-variants-image-select-button';
        el.innerHTML = '<i class="fas fa-images"></i>';
        el.tabIndex = -1;
        el.setAttribute('data-type', 'imagevideo');
        el.setAttribute('data-target', 'texture.src');
        el.onclick = async () => {
          showArtSelect(tokenConfig.object.name, {
            callback: (imgSrc, name) => {
              field.value = imgSrc;
              const tokenConfig = getTokenConfigForUpdate(imgSrc, name);
              if (tokenConfig) {
                for (var key in tokenConfig) {
                  $(html).find(`[name="${key}"]`).val(tokenConfig[key]);
                }
              }
            },
            searchType: SEARCH_TYPE.TOKEN,
            object: tokenConfig.object,
          });
        };
        field.parentNode.append(el);
        return;
      }
    }
  }
}

function _disableRandomSearchForType(randSettings, actor) {
  if (!actor) return false;
  return randSettings[`${actor.type}Disable`] ?? false;
}

function _disablePopupForType(actor) {
  if (!actor) return false;
  return TVA_CONFIG.popup[`${actor.type}Disable`] ?? false;
}

function _twoPopupPrompt(actor, imgSrc, imgName, token) {
  if (TVA_CONFIG.popup.twoPopups && TVA_CONFIG.popup.twoPopupsNoDialog) {
    showArtSelect((token ?? actor.prototypeToken).name, {
      callback: (imgSrc, name) =>
        updateTokenImage(imgSrc, {
          actor: actor,
          imgName: name,
          token: token,
        }),
      searchType: SEARCH_TYPE.TOKEN,
      object: token ? token : actor,
      force: true,
    });
  } else if (TVA_CONFIG.popup.twoPopups) {
    let d = new Dialog({
      title: 'Portrait -> Token',
      content: `<p>${game.i18n.localize('token-variants.windows.art-select.apply-same-art')}</p>`,
      buttons: {
        one: {
          icon: '<i class="fas fa-check"></i>',
          callback: () => {
            updateTokenImage(imgSrc, {
              actor: actor,
              imgName: imgName,
              token: token,
            });
            const artSelects = Object.values(ui.windows).filter((app) => app instanceof ArtSelect);
            for (const app of artSelects) {
              app.close();
            }
          },
        },
        two: {
          icon: '<i class="fas fa-times"></i>',
          callback: () => {
            showArtSelect((token ?? actor.prototypeToken).name, {
              callback: (imgSrc, name) =>
                updateTokenImage(imgSrc, {
                  actor: actor,
                  imgName: name,
                  token: token,
                }),
              searchType: SEARCH_TYPE.TOKEN,
              object: token ? token : actor,
              force: true,
            });
          },
        },
      },
      default: 'one',
    });
    d.render(true);
  }
}
