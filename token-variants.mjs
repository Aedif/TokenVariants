import {
  registerSettings,
  TVA_CONFIG,
  exportSettingsToJSON,
  updateSettings,
  getSearchOptions,
} from './scripts/settings.js';
import { ArtSelect, addToArtSelectQueue } from './applications/artSelect.js';
import {
  getFileName,
  getFileNameWithExt,
  getFilters,
  simplifyName,
  simplifyPath,
  getTokenConfigForUpdate,
  SEARCH_TYPE,
  callForgeVTT,
  keyPressed,
  registerKeybinds,
  updateActorImage,
  updateTokenImage,
  startBatchUpdater,
  userRequiresImageCache,
  checkAndDisplayUserSpecificImage,
  flattenSearchResults,
  parseKeywords,
  tv_executeScript,
} from './scripts/utils.js';
import { renderHud } from './applications/tokenHUD.js';
import { renderTileHUD } from './applications/tileHUD.js';
import { Fuse } from './scripts/fuse/fuse.js';

// Tracks if module has been initialized
let initialized = false;

// True if in the middle of caching image paths
let caching = false;

// A cached map of all the found tokens/portraits
let cachedTokenImages = [];
let cachedTileImages = [];

// To track images found during image search
let foundImages = [];

// showArtSelect(...) can take a while to fully execute and it is possible for it to be called
// multiple times in very quick succession especially if copy pasting tokens or importing actors.
// This variable set early in the function execution is used to queue additional requests rather
// than continue execution
const showArtSelectExecuting = { inProgress: false };

// Controls for when performing multiple searches for one result set aka keywords search
let multiSearch = false;
let usedImages = new Set();

function disableRandomSearchForType(randSettings, actor) {
  if (!actor) return false;
  return randSettings[`${actor.type}Disable`] ?? false;
}

function disablePopupForType(actor) {
  if (!actor) return false;
  return TVA_CONFIG.popup[`${actor.type}Disable`] ?? false;
}

/**
 * Initialize the Token Variants module on Foundry VTT init
 */
async function initialize() {
  // Initialization should only be performed once
  if (initialized) {
    return;
  }

  await registerSettings();

  if (userRequiresImageCache()) {
    cacheImages();
  }

  // Startup ticker that will periodically call 'updateEmbeddedDocuments' with all the accrued updates since the last tick
  startBatchUpdater();

  const getEffectsFromActor = (actor) => {
    let effects = [];

    if (game.system.id === 'pf2e') {
      (actor.data.items || []).forEach((item, id) => {
        if (item.type === 'condition' && item.isActive) effects.push(item.name);
      });
    } else {
      (actor.data.effects || []).forEach((activeEffect, id) => {
        if (!activeEffect.data.disabled) effects.push(activeEffect.data.label);
      });
    }

    return effects;
  };

  const updateWithEffectMapping = async function (
    token,
    effects,
    toggleStatus,
    { added = [], removed = [] } = {}
  ) {
    const tokenImgSrc = token.data.img;
    const tokenImgName =
      (token.document ?? token).getFlag('token-variants', 'name') || getFileName(tokenImgSrc);
    const tokenDefaultImg = (token.document ?? token).getFlag('token-variants', 'defaultImg');
    const tokenUpdateObj = {};
    const hadActiveHUD = (token._object || token).hasActiveHUD;
    const mappings =
      (token.actor.document ?? token.actor).getFlag('token-variants', 'effectMappings') || {};

    // Accumulate all scripts that will need to be run after the update
    const executeOnCallback = [];
    for (const ef of added) {
      const onApply = mappings[ef]?.config?.tv_script?.onApply;
      if (onApply)
        executeOnCallback.push(() =>
          tv_executeScript(onApply, { token: token._object ? token._object : token })
        );
    }

    for (const ef of removed) {
      const onRemove = mappings[ef]?.config?.tv_script?.onRemove;
      if (onRemove)
        executeOnCallback.push(() =>
          tv_executeScript(onRemove, { token: token._object ? token._object : token })
        );
    }

    // Next we're going to determine what configs need to be applied and in what order
    // Filter effects that do not have a mapping and sort based on priority
    effects = effects
      .filter((ef) => ef in mappings)
      .map((ef) => mappings[ef])
      .sort((ef1, ef2) => ef1.priority - ef2.priority);

    if (effects.length > 0) {
      // Some effect mappings may not have images, find a mapping with one if it exists
      const newImg = { imgSrc: '', imgName: '' };
      for (let i = effects.length - 1; i >= 0; i--) {
        if (effects[i].imgSrc) {
          newImg.imgSrc = effects[i].imgSrc;
          newImg.imgName = effects[i].imgName;
          break;
        }
      }

      // Collect custom configs to be applied to the token
      let config;
      if (TVA_CONFIG.stackStatusConfig) {
        config = {};
        for (const ef of effects) {
          if (ef.config) mergeObject(config, ef.config);
        }
      } else {
        for (let i = effects.length - 1; i >= 0; i--) {
          if (effects[i].config && Object.keys(effects[i].config).length !== 0) {
            config = effects[i].config;
            break;
          }
        }
      }

      // Use or update the default (original) token image
      if (!newImg.imgSrc && tokenDefaultImg) {
        delete tokenUpdateObj['flags.token-variants.defaultImg'];
        tokenUpdateObj['flags.token-variants.-=defaultImg'] = null;
        newImg.imgSrc = tokenDefaultImg.imgSrc;
        newImg.imgName = tokenDefaultImg.imgName;
      } else if (!tokenDefaultImg) {
        tokenUpdateObj['flags.token-variants.defaultImg'] = {
          imgSrc: tokenImgSrc,
          imgName: tokenImgName,
        };
      }

      await updateTokenImage(newImg.imgSrc ? newImg.imgSrc : tokenImgSrc, {
        token: token,
        imgName: newImg.imgName ? newImg.imgName : tokenImgName,
        tokenUpdate: tokenUpdateObj,
        callback: () => {
          if (hadActiveHUD) {
            canvas.tokens.hud.bind(token._object || token);
            if (toggleStatus) canvas.tokens.hud._toggleStatusEffects(true);
          }
          executeOnCallback.forEach((fn) => fn());
        },
        config: config,
      });
    }

    // If no mapping has been found and the default image (image prior to effect triggered update) is different from current one
    // reset the token image back to default
    if (effects.length === 0 && tokenDefaultImg) {
      delete tokenUpdateObj['flags.token-variants.defaultImg'];
      tokenUpdateObj['flags.token-variants.-=defaultImg'] = null;

      await updateTokenImage(tokenDefaultImg.imgSrc, {
        token: token,
        imgName: tokenDefaultImg.imgName,
        tokenUpdate: tokenUpdateObj,
        callback: () => {
          if (hadActiveHUD) {
            canvas.tokens.hud.bind(token._object || token);
            if (toggleStatus) canvas.tokens.hud._toggleStatusEffects(true);
          }
          executeOnCallback.forEach((fn) => fn());
        },
      });
      // If no default image exists but a custom effect is applied, we still want to perform an update to
      // clear it
    } else if (
      effects.length === 0 &&
      (token.document ?? token).getFlag('token-variants', 'usingCustomConfig')
    ) {
      await updateTokenImage(tokenImgSrc, {
        token: token,
        imgName: tokenImgName,
        tokenUpdate: tokenUpdateObj,
        callback: () => {
          if (hadActiveHUD) {
            canvas.tokens.hud.bind(token._object || token);
            if (toggleStatus) canvas.tokens.hud._toggleStatusEffects(true);
          }
          executeOnCallback.forEach((fn) => fn());
        },
      });
    }
  };

  Hooks.on('createCombatant', (combatant, options, userId) => {
    if (game.userId !== userId) return;
    const token = combatant._token || canvas.tokens.get(combatant.data.tokenId);
    if (!token || !token.actor) return;

    const mappings = token.actor.getFlag('token-variants', 'effectMappings') || {};
    if (!('token-variants-combat' in mappings)) return;

    const effects = getEffects(token);
    if (token.data.hidden) effects.push('token-variants-visibility');
    effects.push('token-variants-combat');
    updateWithEffectMapping(token, effects, canvas.tokens.hud._statusEffects, {
      added: ['token-variants-combat'],
    });
  });

  const deleteCombatant = async function (combatant) {
    const token = combatant._token || canvas.tokens.get(combatant.data.tokenId);
    if (!token || !token.actor) return;

    const mappings = token.actor.getFlag('token-variants', 'effectMappings') || {};
    if (!('token-variants-combat' in mappings)) return;

    const effects = getEffects(token);
    if (token.data.hidden) effects.push('token-variants-visibility');
    await updateWithEffectMapping(token, effects, canvas.tokens.hud._statusEffects, {
      removed: ['token-variants-combat'],
    });
  };

  Hooks.on('deleteCombatant', (combatant, options, userId) => {
    if (game.userId !== userId) return;
    deleteCombatant(combatant);
  });

  Hooks.on('deleteCombat', (combat, options, userId) => {
    if (game.userId !== userId) return;
    combat.combatants.forEach((combatant) => {
      deleteCombatant(combatant);
    });
  });

  //
  // Handle image updates for Active Effects applied to Tokens WITH Linked Actors
  //

  let updateImageOnEffectChange = async function (activeEffect, added = true) {
    const label = game.system.id === 'pf2e' ? activeEffect.data.name : activeEffect.data.label;
    const actor = activeEffect.parent;
    const tokens = actor.getActiveTokens();
    if (tokens.length === 0) return;

    const mappings = actor.getFlag('token-variants', 'effectMappings') || {};
    if (label in mappings) {
      let effects = getEffectsFromActor(actor);
      for (const token of tokens) {
        if (token.data.actorLink) {
          let tokenEffects = [...effects];
          if (token.inCombat) tokenEffects.unshift('token-variants-combat');
          if (token.data.hidden) tokenEffects.unshift('token-variants-visibility');
          await updateWithEffectMapping(token, tokenEffects, canvas.tokens.hud._statusEffects, {
            added: added ? [label] : [],
            removed: !added ? [label] : [],
          });
        }
      }
    }
  };

  Hooks.on('createActiveEffect', (activeEffect, options, userId) => {
    if (!activeEffect.parent || activeEffect.data.disabled || game.userId !== userId) return;
    updateImageOnEffectChange(activeEffect, true);
  });

  Hooks.on('deleteActiveEffect', (activeEffect, options, userId) => {
    if (!activeEffect.parent || activeEffect.data.disabled || game.userId !== userId) return;
    updateImageOnEffectChange(activeEffect, false);
  });

  Hooks.on('updateActiveEffect', (activeEffect, change, options, userId) => {
    if (!activeEffect.parent || game.userId !== userId) return;
    if (!('disabled' in change) && !('label' in change)) return;
    updateImageOnEffectChange(activeEffect, !change.disabled);
  });

  //
  // Hooks required for PF2e linked actor token updates
  //
  Hooks.on('deleteItem', (condition, options, userId) => {
    if (
      game.system.id !== 'pf2e' ||
      condition.type !== 'condition' ||
      !condition.parent ||
      condition.data.disabled ||
      game.userId !== userId
    )
      return;
    updateImageOnEffectChange(condition, false);
  });

  Hooks.on('createItem', (condition, options, userId) => {
    if (
      game.system.id !== 'pf2e' ||
      condition.type !== 'condition' ||
      !condition.parent ||
      condition.data.disabled ||
      game.userId !== userId
    )
      return;
    updateImageOnEffectChange(condition, true);
  });

  //
  // Handle image updates for Active Effects applied to Tokens WITHOUT Linked Actors
  // PF2e treats Active Effects differently. Both linked and unlinked tokens must be managed via update token hooks

  const getEffects = (token) => {
    if (game.system.id === 'pf2e') {
      if (token.data.actorLink) {
        return getEffectsFromActor(token.actor);
      } else {
        return (token.data.actorData?.items || []).map((ef) => ef.name);
      }
    } else {
      if (token.data.actorLink && token.actor) {
        return getEffectsFromActor(token.actor);
      } else {
        return (token.data.actorData?.effects || []).map((ef) => ef.label);
      }
    }
  };

  Hooks.on('preUpdateToken', (token, change, options, userId) => {
    if (game.userId !== userId) return;
    if (token.data.actorLink && game.system.id !== 'pf2e') return;
    if (!token.actor) return;

    const mappings =
      (token.actor.document ?? token.actor).getFlag('token-variants', 'effectMappings') || {};

    let oldEffects = [];
    let newEffects = [];

    if (game.system.id === 'pf2e') {
      newEffects = change.actorData?.items
        ? change.actorData.items.map((ef) => ef.name)
        : getEffects(token);
      oldEffects = getEffects(token);
    } else {
      newEffects = change.actorData?.effects
        ? change.actorData.effects.map((ef) => ef.label)
        : getEffects(token);
      oldEffects = getEffects(token);
    }

    const effectsAdded = [];
    for (const effect of newEffects) {
      if (!oldEffects.includes(effect)) effectsAdded.push(effect);
    }
    const effectsRemoved = [];
    for (const effect of oldEffects) {
      if (!newEffects.includes(effect)) effectsRemoved.push(effect);
    }

    let performUpdate = false;
    if (effectsAdded.length) {
      performUpdate = newEffects[newEffects.length - 1] in mappings;
    }
    if (effectsRemoved.length) {
      // The removed effect could have been anywhere in the array
      for (const oldEf of oldEffects) {
        if (!newEffects.includes(oldEf)) {
          performUpdate = oldEf in mappings;
          if (performUpdate) break;
        }
      }
    }

    if (token.inCombat) newEffects.unshift('token-variants-combat');
    if (change.hidden) newEffects.push('token-variants-visibility');
    else if (change.hidden == null && token.data.hidden)
      newEffects.unshift('token-variants-visibility');

    if (
      change.hidden != null &&
      change.hidden !== token.data.hidden &&
      'token-variants-visibility' in mappings
    ) {
      performUpdate = true;
    }

    if (performUpdate) {
      options['token-variants'] = {
        effects: newEffects,
        toggleStatus: canvas.tokens.hud._statusEffects,
        added: effectsAdded,
        removed: effectsRemoved,
      };
    }
  });

  // A fix to make sure that the "ghost" image of the token during drag reflects assigned user mappings
  if (typeof libWrapper === 'function') {
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
            toUndo.push([token, token.data._source.img]);
            token.data._source.img = img;
            token.document.data.img = img;
          }
        }

        // Call _onDragLeftStart function to draw the new image
        let result = wrapped(...args);

        // Now that the image is drawn, reset the source data back to the original
        for (const [token, img] of toUndo) {
          token.data._source.img = img;
          token.document.data.img = img;
        }

        return result;
      },
      'WRAPPER'
    );
  }

  Hooks.on('updateToken', async function (token, change, options, userId) {
    if (change.img) {
      checkAndDisplayUserSpecificImage(token);
    }

    if (game.userId !== userId) return;
    if (options['token-variants'] && token.actor) {
      updateWithEffectMapping(
        token,
        options['token-variants'].effects,
        options['token-variants'].toggleStatus,
        { added: options['token-variants'].added, removed: options['token-variants'].removed }
      );
    }
  });

  Hooks.on('renderArtSelect', () => {
    showArtSelectExecuting.inProgress = false;
  });

  game.socket?.on(`module.token-variants`, (message) => {
    // Workaround for forgeSearchPaths setting to be updated by non-GM clients
    if (message.handlerName === 'forgeSearchPaths' && message.type === 'UPDATE') {
      if (!game.user.isGM) return;
      const isResponsibleGM = !game.users
        .filter((user) => user.isGM && (user.active || user.isActive))
        .some((other) => other.data._id < game.user.data._id);
      if (!isResponsibleGM) return;
      updateSettings({ forgeSearchPaths: message.args });
    }

    // User specific token image update
    if (message.handlerName === 'userMappingChange' && message.type === 'UPDATE') {
      if (message.args.users.includes(game.userId)) {
        const tkn = canvas.tokens.get(message.args.tokenId);
        if (tkn) checkAndDisplayUserSpecificImage(tkn, true);
      }
    }
  });

  // Handle actor/token art replacement
  Hooks.on('createActor', createActor);
  Hooks.on('createToken', createToken);

  Hooks.on('renderTokenConfig', modTokenConfig);
  Hooks.on('renderTileConfig', modTileConfig);
  Hooks.on('renderActorSheet', modActorSheet);

  Hooks.on('renderTokenHUD', renderHud);
  Hooks.on('renderTileHUD', renderTileHUD);

  initialized = true;
}

async function createToken(token, options, userId) {
  if (userId && game.user.id != userId) return;

  // Check if random search is enabled and if so perform it

  const randSettings = TVA_CONFIG.randomizer;
  let vDown = keyPressed('v');
  const flagTarget = token.actor ? game.actors.get(token.actor.id) : token.document ?? token;
  const randFlag = flagTarget.getFlag('token-variants', 'randomize');
  const popupFlag = flagTarget.getFlag('token-variants', 'popups');

  if (randFlag == null || randFlag) {
    if ((vDown && randSettings.tokenCopyPaste) || (!vDown && randSettings.tokenCreate)) {
      let performRandomSearch = true;
      if (randFlag == null) {
        if (randSettings.representedActorDisable && token.actor) performRandomSearch = false;
        if (randSettings.linkedActorDisable && token.data.actorLink) performRandomSearch = false;
        if (disableRandomSearchForType(randSettings, token.actor)) performRandomSearch = false;
      } else {
        performRandomSearch = randFlag;
      }

      if (performRandomSearch) {
        const img = await doRandomSearch(token.data.name, {
          searchType: SEARCH_TYPE.TOKEN,
          actor: token.actor,
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
            imgPortrait = await doSyncSearch(token.data.name, img[1], {
              actor: token.actor,
              searchType: SEARCH_TYPE.PORTRAIT,
            });
          } else {
            imgPortrait = await doRandomSearch(token.data.name, {
              searchType: SEARCH_TYPE.PORTRAIT,
              actor: token.actor,
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
    } else if (popupFlag == null && disablePopupForType(token.actor)) {
      return;
    } else if (popupFlag != null && !popupFlag) {
      return;
    }
  }

  showArtSelect(token.data.name, {
    callback: async function (imgSrc, imgName) {
      if (TVA_CONFIG.popup.twoPopups) {
        await updateActorImage(token.actor, imgSrc);
        twoPopupPrompt(token.actor, imgSrc, imgName, token);
      } else {
        updateTokenImage(imgSrc, {
          actor: token.actor,
          imgName: imgName,
          token: token,
        });
      }
    },
    searchType: TVA_CONFIG.popup.twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.BOTH,
    object: token,
    preventClose: TVA_CONFIG.popup.twoPopups && TVA_CONFIG.popup.twoPopupsNoDialog,
  });
}

async function createActor(actor, options, userId) {
  if (userId && game.user.id != userId) return;

  // Check if random search is enabled and if so perform it
  const randSettings = TVA_CONFIG.randomizer;
  if (randSettings.actorCreate) {
    let performRandomSearch = true;
    if (randSettings.linkedActorDisable && actor.data.token.actorLink) performRandomSearch = false;
    if (disableRandomSearchForType(randSettings, actor)) performRandomSearch = false;

    if (performRandomSearch) {
      const img = await doRandomSearch(actor.data.name, {
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
          imgToken = await doSyncSearch(actor.data.name, img[1], { actor: actor });
        } else {
          imgToken = await doRandomSearch(actor.data.name, {
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
  } else if (disablePopupForType(actor)) {
    return;
  }

  showArtSelect(actor.data.name, {
    callback: async function (imgSrc, name) {
      const actTokens = actor.getActiveTokens();
      const token = actTokens.length === 1 ? actTokens[0] : null;
      await updateActorImage(actor, imgSrc);
      if (TVA_CONFIG.popup.twoPopups) twoPopupPrompt(actor, imgSrc, name, token);
      else {
        updateTokenImage(imgSrc, {
          actor: actor,
          imgName: name,
          token: token,
        });
      }
    },
    searchType: TVA_CONFIG.popup.twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.BOTH,
    object: actor,
    preventClose: TVA_CONFIG.popup.twoPopups && TVA_CONFIG.popup.twoPopupsNoDialog,
  });
}

/**
 * Adds a button to 'Token Configuration' window's 'Image' tab which opens
 * ArtSelect using the token's name.
 */
function modTokenConfig(tokenConfig, html, _) {
  if (TVA_CONFIG.permissions.image_path_button[game.user.role]) {
    let fields = html[0].getElementsByClassName('image');
    for (let field of fields) {
      if (field.getAttribute('name') == 'img') {
        let el = document.createElement('button');
        el.type = 'button';
        el.title = game.i18n.localize('token-variants.windows.art-select.select-variant');
        el.className = 'token-variants-image-select-button';
        el.innerHTML = '<i class="fas fa-images"></i>';
        el.tabIndex = -1;
        el.setAttribute('data-type', 'imagevideo');
        el.setAttribute('data-target', 'img');
        el.onclick = async () => {
          showArtSelect(tokenConfig.object.data.name, {
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

/**
 * Adds a button to 'Tile Configuration' window's 'Tile Image or Video' form-group
 * to open an ArtSelect using the tile's name.
 */
function modTileConfig(tileConfig, html, _) {
  if (TVA_CONFIG.permissions.image_path_button[game.user.role]) {
    let fields = html[0].getElementsByClassName('image');
    for (let field of fields) {
      if (field.getAttribute('name') == 'img') {
        let el = document.createElement('button');
        el.type = 'button';
        el.title = game.i18n.localize('token-variants.windows.art-select.select-variant');
        el.className = 'token-variants-image-select-button';
        el.innerHTML = '<i class="fas fa-images"></i>';
        el.tabIndex = -1;
        el.setAttribute('data-type', 'imagevideo');
        el.setAttribute('data-target', 'img');
        el.onclick = async () => {
          const tileName =
            tileConfig.object.getFlag('token-variants', 'tileName') ||
            tileConfig.object.id ||
            'new tile';
          showArtSelect(tileName, {
            callback: (imgSrc, name) => {
              field.value = imgSrc;
            },
            searchType: SEARCH_TYPE.TILE,
          });
        };
        field.parentNode.append(el);
        return;
      }
    }
  }
}

/**
 * Adds right-click listener to Actor Sheet profile image to open up
 * the 'Art Select' screen.
 */
function modActorSheet(actorSheet, html, options) {
  if (options.editable && TVA_CONFIG.permissions.portrait_right_click[game.user.role]) {
    let profile = null;
    let profileQueries = {
      all: ['.profile', '.profile-img', '.profile-image'],
      pf2e: ['.player-image', '.actor-icon', '.sheet-header img', '.actor-image'],
    };

    for (let query of profileQueries.all) {
      profile = html[0].querySelector(query);
      if (profile) break;
    }

    if (!profile && game.system.id in profileQueries) {
      for (let query of profileQueries[game.system.id]) {
        profile = html[0].querySelector(query);
        if (profile) break;
      }
    }

    if (!profile) {
      console.log(game.i18n.localize('token-variants.notifications.warn.profile-image-not-found'));
      return;
    }

    profile.addEventListener(
      'contextmenu',
      function (ev) {
        showArtSelect(actorSheet.object.name, {
          callback: (imgSrc, name) => updateActorImage(actorSheet.object, imgSrc),
          searchType: SEARCH_TYPE.PORTRAIT,
          object: actorSheet.object,
        });
      },
      false
    );
  }
}

export async function saveCache() {
  const data = { tokenImages: [], tileImages: [] };

  for (const img of cachedTokenImages) {
    data.tokenImages.push([img.path, img.name]);
  }

  for (const img of cachedTileImages) {
    data.tileImages.push([img.path, img.name]);
  }

  let file = new File([JSON.stringify(data)], 'cache.json', {
    type: 'text/plain',
  });
  FilePicker.upload('data', 'modules/token-variants/', file);
}

async function _readCacheFromFile(fileName) {
  cachedTokenImages = [];
  cachedTileImages = [];

  try {
    await jQuery.getJSON('modules/token-variants/cache.json', (json) => {
      // Old Cache implementation
      if (Array.isArray(json)) {
        if (json[0][0] === 'path' && json[0][1] == 'name') {
          for (let i = 1; i < json.length; i++) {
            cachedTokenImages.push({ path: json[i][0], name: json[i][1] });
          }
        }
      } else {
        for (const img of json.tokenImages) {
          cachedTokenImages.push({ path: img[0], name: img[1] });
        }
        for (const img of json.tileImages) {
          cachedTileImages.push({ path: img[0], name: img[1] });
        }
      }
      if (!TVA_CONFIG.disableNotifs)
        ui.notifications.info(
          `Token Variant Art: Using Static Cache (${
            cachedTokenImages.length + cachedTileImages.length
          } images)`
        );
    });
  } catch (error) {
    ui.notifications.warn(`Token Variant Art: Static Cache not found`);
    cachedTokenImages = [];
    cachedTileImages = [];
  }
  caching = false;
}

/**
 * Search for and cache all the found token art
 */
export async function cacheImages() {
  if (caching) return;
  caching = true;

  if (!initialized && TVA_CONFIG.staticCache) {
    await _readCacheFromFile();
    return;
  }

  if (!TVA_CONFIG.disableNotifs)
    ui.notifications.info(game.i18n.format('token-variants.notifications.info.caching-started'));

  if (TVA_CONFIG.debug) console.log('STARTING: Token Caching');
  cachedTokenImages = [];

  const sOptions = getSearchOptions();
  await findTokensExact('', '', sOptions);
  cachedTokenImages = foundImages;

  foundImages = [];
  if (TVA_CONFIG.debug) console.log('ENDING: Token Caching');

  if (TVA_CONFIG.tilesEnabled) {
    if (TVA_CONFIG.debug) console.log('STARTING: Tile Caching');
    cachedTileImages = [];

    await findTilesExact('', sOptions);
    cachedTileImages = foundImages;

    foundImages = [];
    if (TVA_CONFIG.debug) console.log('ENDING: Tile Caching');
  }

  caching = false;
  if (!TVA_CONFIG.disableNotifs)
    ui.notifications.info(
      game.i18n.format('token-variants.notifications.info.caching-finished', {
        imageCount: cachedTileImages.length + cachedTokenImages.length,
      })
    );

  if (initialized && TVA_CONFIG.staticCache && game.user.isGM) {
    saveCache();
  }
}

/**
 * Checks if image path and name match the provided search text and filters
 * @param imagePath image path
 * @param imageName image name
 * @param filters filters to be applied
 * @returns true|false
 */
function exactSearchMatchesImage(simplifiedSearch, imagePath, imageName, filters, runSearchOnPath) {
  // Is the search text contained in the name/path
  const simplified = runSearchOnPath ? simplifyPath(imagePath) : simplifyName(imageName);
  if (!simplified.includes(simplifiedSearch)) {
    return false;
  }

  if (!filters) return true;
  return imagePassesFilter(imageName, imagePath, filters, runSearchOnPath);
}

function imagePassesFilter(imageName, imagePath, filters, runSearchOnPath) {
  // Filters are applied to path depending on the 'runSearchOnPath' setting, and actual or custom rolltable name
  let text;
  if (runSearchOnPath) {
    text = decodeURIComponent(imagePath);
  } else if (getFileName(imagePath) === imageName) {
    text = getFileNameWithExt(imagePath);
  } else {
    text = imageName;
  }

  if (filters.regex) {
    return filters.regex.test(text);
  }
  if (filters.include) {
    if (!text.includes(filters.include)) return false;
  }
  if (filters.exclude) {
    if (text.includes(filters.exclude)) return false;
  }
  return true;
}

async function findImages(name, searchType = '', searchOptions = {}) {
  const sOptions = mergeObject(searchOptions, getSearchOptions(), { overwrite: false });
  if (searchType === SEARCH_TYPE.TILE) {
    if (sOptions.algorithm.exact) {
      return findTilesExact(name, sOptions);
    } else {
      return findTilesFuzzy(name, sOptions);
    }
  } else {
    if (sOptions.algorithm.exact) {
      return findTokensExact(name, searchType, sOptions);
    } else {
      return findTokensFuzzy(name, searchType, sOptions);
    }
  }
}

async function findTilesExact(name, searchOptions) {
  if (TVA_CONFIG.debug) console.log('STARTING: Exact Tile Search', name, caching);

  foundImages = [];

  await walkAllPaths(false);

  const simpleName = simplifyName(name);
  foundImages = foundImages.filter((pathObj) =>
    exactSearchMatchesImage(
      simpleName,
      pathObj.path,
      pathObj.name,
      null,
      searchOptions.runSearchOnPath
    )
  );

  cachedTileImages.forEach((pathObj) => {
    if (
      exactSearchMatchesImage(
        simpleName,
        pathObj.path,
        pathObj.name,
        null,
        searchOptions.runSearchOnPath
      )
    )
      foundImages.push(pathObj);
  });

  if (TVA_CONFIG.debug) console.log('ENDING: Exact Tile Search', foundImages);
  return foundImages;
}

async function findTilesFuzzy(name, searchOptions) {
  if (TVA_CONFIG.debug) console.log('STARTING: Fuzzy Tile Search', name, caching, searchOptions);

  let allPaths;
  if (multiSearch) {
    allPaths = cachedTileImages.filter((imgObj) => !usedImages.has(imgObj));
  } else {
    allPaths = [...cachedTileImages];
  }

  foundImages = [];
  await walkAllPaths(false);

  allPaths = allPaths.concat(foundImages);

  const fuse = new Fuse(allPaths, {
    keys: [searchOptions.runSearchOnPath ? 'path' : 'name'],
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 1,
    ignoreLocation: true,
    threshold: searchOptions.algorithm.fuzzyThreshold,
  });

  const results = fuse.search(name).slice(0, searchOptions.algorithm.fuzzyLimit);

  foundImages = results.map((r) => {
    r.item.indices = r.matches[0].indices;
    r.item.score = r.score;
    return r.item;
  });

  if (TVA_CONFIG.debug) console.log('ENDING: Fuzzy Tile Search', foundImages);

  return foundImages;
}

export async function findTokensFuzzy(name, searchType, searchOptions, forceSearchName = false) {
  if (TVA_CONFIG.debug)
    console.log('STARTING: Fuzzy Token Search', name, searchType, caching, searchOptions);

  // Select filters based on type of search
  let filters = getFilters(searchType, searchOptions.searchFilters);

  let allPaths;
  if (multiSearch) {
    allPaths = cachedTokenImages.filter(
      (imgObj) =>
        !usedImages.has(imgObj) &&
        imagePassesFilter(imgObj.name, imgObj.path, filters, searchOptions.runSearchOnPath)
    );
  } else {
    allPaths = cachedTokenImages.filter((imgObj) =>
      imagePassesFilter(imgObj.name, imgObj.path, filters, searchOptions.runSearchOnPath)
    );
  }

  foundImages = [];
  await walkAllPaths();

  foundImages.forEach((imgObj) => {
    if (imagePassesFilter(imgObj.name, imgObj.path, filters, searchOptions.runSearchOnPath)) {
      allPaths.push(imgObj);
    }
  });

  const fuse = new Fuse(allPaths, {
    keys: [!forceSearchName && searchOptions.runSearchOnPath ? 'path' : 'name'],
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 1,
    ignoreLocation: true,
    threshold: searchOptions.algorithm.fuzzyThreshold,
  });

  const results = fuse.search(name).slice(0, searchOptions.algorithm.fuzzyLimit);

  foundImages = results.map((r) => {
    r.item.indices = r.matches[0].indices;
    r.item.score = r.score;
    return r.item;
  });

  if (TVA_CONFIG.debug) console.log('ENDING: Fuzzy Token Search', foundImages);

  return foundImages;
}

/**
 * Search for tokens matching the supplied name
 */
async function findTokensExact(name, searchType, searchOptions = {}) {
  if (TVA_CONFIG.debug) console.log('STARTING: Exact Token Search', name, searchType, caching);

  foundImages = [];

  await walkAllPaths();

  const simpleName = simplifyName(name);
  const filters = getFilters(searchType, searchOptions.searchFilters);
  foundImages = foundImages.filter((pathObj) =>
    exactSearchMatchesImage(
      simpleName,
      pathObj.path,
      pathObj.name,
      filters,
      searchOptions.runSearchOnPath
    )
  );

  cachedTokenImages.forEach((pathObj) => {
    if (
      exactSearchMatchesImage(
        simpleName,
        pathObj.path,
        pathObj.name,
        filters,
        searchOptions.runSearchOnPath
      )
    )
      foundImages.push(pathObj);
  });

  if (TVA_CONFIG.debug) console.log('ENDING: Exact Token Search', foundImages);
  return foundImages;
}

async function walkAllPaths(tokens = true) {
  for (const path of TVA_CONFIG.searchPaths) {
    if ((tokens && !path.tiles) || (!tokens && path.tiles)) {
      if ((path.cache && caching) || (!path.cache && !caching)) await walkFindImages(path);
    }
  }

  // ForgeVTT specific path handling
  const userId = typeof ForgeAPI !== 'undefined' ? await ForgeAPI.getUserId() : '';
  for (const uid in TVA_CONFIG.forgeSearchPaths) {
    let apiKey = TVA_CONFIG.forgeSearchPaths[uid].apiKey;
    if (uid === userId) {
      for (const path of TVA_CONFIG.forgeSearchPaths[uid].paths) {
        if ((tokens && !path.tiles) || (!tokens && path.tiles)) {
          if ((path.cache && caching) || (!path.cache && !caching)) await walkFindImages(path);
        }
      }
    } else if (apiKey) {
      for (const path of TVA_CONFIG.forgeSearchPaths[uid].paths) {
        if ((tokens && !path.tiles) || (!tokens && path.tiles)) {
          if ((path.cache && caching) || (!path.cache && !caching)) {
            if (path.share) await walkFindImages(path, { apiKey: apiKey });
          }
        }
      }
    }
  }
}

async function walkFindImages(path, { apiKey = '' } = {}) {
  let files = {};
  try {
    if (path.source.startsWith('s3:')) {
      files = await FilePicker.browse('s3', path.text, {
        bucket: path.source.replace('s3:', ''),
      });
    } else if (path.source.startsWith('forgevtt')) {
      if (apiKey) {
        const response = await callForgeVTT(path.text, apiKey);
        files.files = response.files.map((f) => f.url);
      } else {
        files = await FilePicker.browse('forgevtt', path.text, { recursive: true });
      }
    } else if (path.source.startsWith('forge-bazaar')) {
      files = await FilePicker.browse('forge-bazaar', path.text, { recursive: true });
    } else if (path.source.startsWith('imgur')) {
      await fetch('https://api.imgur.com/3/gallery/album/' + path.text, {
        headers: {
          Authorization:
            'Client-ID ' +
            (TVA_CONFIG.imgurClientId ? TVA_CONFIG.imgurClientId : 'df9d991443bb222'),
          Accept: 'application/json',
        },
      })
        .then((response) => response.json())
        .then(async function (result) {
          if (!result.success) {
            return;
          }
          result.data.images.forEach((img) => {
            const path = img.link;
            const rtName = img.title ?? img.description ?? getFileName(img.link);
            foundImages.push({ path: path, name: rtName });
          });
        })
        .catch((error) => console.log('Token Variant Art: ', error));
      return;
    } else if (path.source.startsWith('rolltable')) {
      const table = game.tables.contents.find((t) => t.name === path.text);
      if (!table) {
        ui.notifications.warn(
          game.i18n.format('token-variants.notifications.warn.invalid-table', {
            rollTableName,
          })
        );
      } else {
        for (let baseTableData of table.data.results) {
          const path = baseTableData.data.img;
          const rtName = baseTableData.data.text || getFileName(path);
          foundImages.push({ path: path, name: rtName });
        }
      }
      return;
    } else {
      files = await FilePicker.browse(path.source, path.text);
    }
  } catch (err) {
    console.log(
      `Token Variant Art | ${game.i18n.localize(
        'token-variants.notifications.warn.path-not-found'
      )} ${path.source}:${path.text}`
    );
    return;
  }

  if (files.target == '.') return;

  if (files.files) {
    files.files.forEach((tokenSrc) => {
      foundImages.push({ path: tokenSrc, name: getFileName(tokenSrc) });
    });
  }

  if (path.source.startsWith('forgevtt') || path.source.startsWith('forge-bazaar')) return;

  for (let f_dir of files.dirs) {
    await walkFindImages({ text: f_dir, source: path.source }, { apiKey: apiKey });
  }
}

/**
 * Performs searches and displays the Art Select pop-up with the results
 * @param {string} search The text to be used as the search criteria
 * @param {object} [options={}] Options which customize the search
 * @param {Function[]} [options.callback] Function to be called with the user selected image path
 * @param {SEARCH_TYPE|string} [options.searchType] (token|portrait|both|tile) Controls filters applied to the search results
 * @param {Token|Actor} [options.object] Token/Actor used when displaying Custom Token Config prompt
 * @param {boolean} [options.force] If true will always override the current Art Select window if one exists instead of adding it to the queue
 * @param {object} [options.searchOptions] Override search and filter settings
 */
export async function showArtSelect(
  search,
  {
    callback = null,
    searchType = SEARCH_TYPE.BOTH,
    object = null,
    force = false,
    preventClose = false,
    image1 = '',
    image2 = '',
    searchOptions = {},
  } = {}
) {
  if (caching) return;

  const artSelects = Object.values(ui.windows).filter((app) => app instanceof ArtSelect);
  if (showArtSelectExecuting.inProgress || (!force && artSelects.length !== 0)) {
    addToArtSelectQueue(search, {
      callback: callback,
      searchType: searchType,
      object: object,
      preventClose: preventClose,
      searchOptions: searchOptions,
    });
    return;
  }

  showArtSelectExecuting.inProgress = true;

  const allImages = await doImageSearch(search, {
    searchType: searchType,
    searchOptions: searchOptions,
  });

  new ArtSelect(search, {
    allImages: allImages,
    searchType: searchType,
    callback: callback,
    object: object,
    preventClose: preventClose,
    image1: image1,
    image2: image2,
    searchOptions: searchOptions,
  }).render(true);
}

async function _randSearchUtil(
  search,
  { searchType = SEARCH_TYPE.BOTH, actor = null, randomizerOptions = {}, searchOptions = {} } = {}
) {
  const randSettings = mergeObject(randomizerOptions, TVA_CONFIG.randomizer, { overwrite: false });
  if (!(randSettings.tokenName || randSettings.keywords || randSettings.shared)) return null;

  // Randomizer settings take precedence
  searchOptions.keywordSearch = randSettings.keywords;

  // Gather all images
  let results =
    randSettings.tokenName || randSettings.keywords
      ? await doImageSearch(search, {
          searchType: searchType,
          searchOptions: searchOptions,
        })
      : new Map();

  if (!randSettings.tokenName) {
    results.delete(search);
  }
  if (randSettings.shared && actor) {
    let sharedVariants = actor.getFlag('token-variants', 'variants') || [];
    if (sharedVariants.length != 0) {
      const sv = [];
      sharedVariants.forEach((variant) => {
        variant.names.forEach((name) => {
          sv.push({ path: variant.imgSrc, name: name });
        });
      });
      results.set('variants95436723', sv);
    }
  }

  return results;
}

async function doSyncSearch(search, target, { searchType = SEARCH_TYPE.TOKEN, actor = null } = {}) {
  if (caching) return null;

  const results = flattenSearchResults(
    await _randSearchUtil(search, { searchType: searchType, actor: actor })
  );

  // Find the image with the most similar name
  const fuse = new Fuse(results, {
    keys: ['name'],
    minMatchCharLength: 1,
    ignoreLocation: true,
    threshold: 0.4,
  });

  const fResults = fuse.search(target);

  if (fResults && fResults.length !== 0) {
    return [fResults[0].item.path, fResults[0].item.name];
  } else {
    return null;
  }
}

/**
 * @param {*} search Text to be used as the search criteria
 * @param {object} [options={}] Options which customize the search
 * @param {SEARCH_TYPE|string} [options.searchType] (token|portrait|both|tile) Controls filters applied to the search results
 * @param {Actor} [options.actor] Used to retrieve 'shared' images from if enabled in the Randomizer Settings
 * @param {Function[]} [options.callback] Function to be called with the random image
 * @param {object} [options.searchOptions] Override search settings
 * @param {object} [options.randomizerOptions] Override randomizer settings. These take precedence over searchOptions
 * @returns Array<string>|null} Image path and name
 */
async function doRandomSearch(
  search,
  {
    searchType = SEARCH_TYPE.BOTH,
    actor = null,
    callback = null,
    randomizerOptions = {},
    searchOptions = {},
  } = {}
) {
  if (caching) return null;

  const results = await _randSearchUtil(search, {
    searchType: searchType,
    actor: actor,
    randomizerOptions: randomizerOptions,
    searchOptions: searchOptions,
  });
  if (!results) return results;

  // Pick random image
  let total = 0;
  results.forEach((v) => (total += v.length));
  let randImageNum = Math.floor(Math.random() * total);
  for (const [_, images] of results.entries()) {
    if (randImageNum < images.length) {
      if (callback) callback([images[randImageNum].path, images[randImageNum].name]);
      return [images[randImageNum].path, images[randImageNum].name];
    } else {
      randImageNum -= images.length;
    }
  }
  return null;
}

/**
 * @param {string} search Text to be used as the search criteria
 * @param {object} [options={}] Options which customize the search
 * @param {SEARCH_TYPE|string} [options.searchType] Controls filters applied to the search results
 * @param {Boolean} [options.simpleResults] Results will be returned as an array of all image paths found
 * @param {Function[]} [options.callback] Function to be called with the found images
 * @param {object} [options.searchOptions] Override search settings
 * @returns {Promise<Map<string, Array<object>|Array<string>>} All images found split by original criteria and keywords
 */
export async function doImageSearch(
  search,
  { searchType = SEARCH_TYPE.BOTH, simpleResults = false, callback = null, searchOptions = {} } = {}
) {
  if (caching) return;

  searchOptions = mergeObject(searchOptions, getSearchOptions(), { overwrite: false });

  search = search.trim();

  if (TVA_CONFIG.debug) console.log('STARTING: Art Search', search, searchType, searchOptions);

  let searches = [search];
  let allImages = new Map();
  const keywords = parseKeywords(searchOptions.excludedKeywords);

  if (searchOptions.keywordSearch) {
    searches = searches.concat(
      search
        .split(/\W/)
        .filter((word) => word.length > 2 && !keywords.includes(word.toLowerCase()))
        .reverse()
    );
  }

  multiSearch = true; // TODO: transfer this logic to findImages()
  usedImages = new Set();
  for (const search of searches) {
    if (allImages.get(search) !== undefined) continue;

    let results = await findImages(search, searchType, searchOptions);
    results = results.filter((pathObj) => !usedImages.has(pathObj));

    allImages.set(search, results);
    results.forEach(usedImages.add, usedImages);

    multiSearch = true; // TODO: transfer this logic to findImages()
  }
  multiSearch = false;

  if (TVA_CONFIG.debug) console.log('ENDING: Art Search');

  if (simpleResults) {
    allImages = Array.from(usedImages).map((obj) => obj.path);
  }

  if (callback) callback(allImages);
  return allImages;
}

function twoPopupPrompt(actor, imgSrc, imgName, token) {
  if (TVA_CONFIG.popup.twoPopups && TVA_CONFIG.popup.twoPopupsNoDialog) {
    showArtSelect((token ?? actor.data.token).name, {
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
            showArtSelect((token ?? actor.data.token).name, {
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

// Initialize module
Hooks.once('ready', initialize);

// Register API and Keybinds
Hooks.on('init', function () {
  registerKeybinds();

  // Kepping the old caching function name for the API
  const cacheTokens = () => cacheImages();

  game.modules.get('token-variants').api = {
    cacheImages,
    cacheTokens,
    doImageSearch,
    doRandomSearch,
    showArtSelect,
    updateTokenImage,
    exportSettingsToJSON,
    TVA_CONFIG,
  };
});

Hooks.on('canvasReady', async function () {
  canvas.tokens.placeables.forEach((tkn) => checkAndDisplayUserSpecificImage(tkn));
});
