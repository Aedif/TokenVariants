import { registerSettings, TVA_CONFIG, exportSettingsToJSON } from './scripts/settings.js';
import { ArtSelect, addToArtSelectQueue } from './applications/artSelect.js';
import {
  getFileName,
  getFileNameWithExt,
  getFilters,
  simplifyTokenName,
  simplifyPath,
  getTokenConfigForUpdate,
  SEARCH_TYPE,
  callForgeVTT,
  keyPressed,
  registerKeybinds,
  updateActorImage,
  updateTokenImage,
  stringSimilarity,
  startBatchUpdater,
  queueTokenUpdate,
} from './scripts/utils.js';
import { renderHud } from './applications/tokenHUD.js';
import { Fuse } from './scripts/fuse/fuse.js';

// Tracks if module has been initialized
let initialized = false;

// True if in the middle of caching image paths
let caching = false;

// A cached map of all the found tokens
let cachedImages = [];

// Tokens found with caching disabled
let foundImages = [];

// showArtSelect(...) can take a while to fully execute and it is possible for it to be called
// multiple times in very quick succession especially if copy pasting tokens or importing actors.
// This variable set early in the function execution is used to queue additional requests rather
// than continue execution
const showArtSelectExecuting = { inProgress: false };

// Controls for when performing multiple searches for one result set aka keywords search
let multiSearch = false;
let usedImages = new Set();

/**
 * Initialize the Token Variants module on Foundry VTT init
 */
async function initialize() {
  // Initialization should only be performed once
  if (initialized) {
    return;
  }

  await registerSettings();

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

  const updateWithEffectMapping = async function (token, effects, toggleStatus) {
    const tokenImgSrc = token.data.img;
    const tokenImgName =
      (token.document ?? token).getFlag('token-variants', 'name') || getFileName(tokenImgSrc);
    let tokenDefaultImg = (token.document ?? token).getFlag('token-variants', 'defaultImg');
    const tokenUpdateObj = {};
    // Legacy support, to be removed after reasonable amount of time has been given for defaultImg to have been cleared
    // from most users' Actors. (19/04/2022)
    if (!tokenDefaultImg) {
      tokenDefaultImg = (token.actor.document ?? token.actor).getFlag(
        'token-variants',
        'defaultImg'
      );
      if (tokenDefaultImg) {
        tokenUpdateObj['flags.token-variants.defaultImg'] = tokenDefaultImg;
        await (token.actor.document ?? token.actor).unsetFlag('token-variants', 'defaultImg');
      }
    }
    // end of legacy code
    const hadActiveHUD = (token._object || token).hasActiveHUD;
    const mappings =
      (token.actor.document ?? token.actor).getFlag('token-variants', 'effectMappings') || {};

    // Filter effects that do not have a mapping and sort based on priority
    effects = effects
      .filter((ef) => ef in mappings)
      .map((ef) => mappings[ef])
      .sort((ef1, ef2) => ef1.priority - ef2.priority);

    if (effects.length > 0) {
      const effect = effects[effects.length - 1];
      if (tokenImgSrc !== effect.imgSrc || tokenImgName !== effect.imgName) {
        if (!tokenDefaultImg) {
          tokenUpdateObj['flags.token-variants.defaultImg'] = {
            imgSrc: tokenImgSrc,
            imgName: tokenImgName,
          };
        }
        await updateTokenImage(effect.imgSrc, {
          token: token,
          imgName: effect.imgName,
          tokenUpdate: tokenUpdateObj,
          callback: hadActiveHUD
            ? () => {
                canvas.tokens.hud.bind(token._object || token);
                if (toggleStatus) canvas.tokens.hud._toggleStatusEffects(true);
              }
            : null,
        });
      }
    }

    // If no mapping has been found and the default image (image prior to effect triggered update) is different from current one
    // reset the token image back to default
    if (effects.length === 0 && tokenDefaultImg) {
      delete tokenUpdateObj['flags.token-variants.defaultImg'];
      tokenUpdateObj['flags.token-variants.-=defaultImg'] = null;

      if (tokenDefaultImg.imgSrc !== tokenImgSrc || tokenDefaultImg.imgName !== tokenImgName) {
        await updateTokenImage(tokenDefaultImg.imgSrc, {
          token: token,
          imgName: tokenDefaultImg.imgName,
          tokenUpdate: tokenUpdateObj,
          callback: hadActiveHUD
            ? () => {
                canvas.tokens.hud.bind(token._object || token);
                if (toggleStatus) canvas.tokens.hud._toggleStatusEffects(true);
              }
            : null,
        });
      } else {
        queueTokenUpdate(token.id, tokenUpdateObj);
      }
    }
  };

  Hooks.on('createCombatant', (combatant, options, userId) => {
    if (!TVA_CONFIG.enableStatusConfig || game.userId !== userId) return;
    const token = combatant._token || canvas.tokens.get(combatant.data.tokenId);

    const mappings = token.actor.getFlag('token-variants', 'effectMappings') || {};
    if (!('token-variants-combat' in mappings)) return;

    const effects = getEffects(token);
    if (token.data.hidden) effects.push('token-variants-visibility');
    effects.push('token-variants-combat');
    updateWithEffectMapping(token, effects, canvas.tokens.hud._statusEffects);
  });

  const deleteCombatant = async function (combatant) {
    const token = combatant._token || canvas.tokens.get(combatant.data.tokenId);

    const mappings = token.actor.getFlag('token-variants', 'effectMappings') || {};
    if (!('token-variants-combat' in mappings)) return;

    const effects = getEffects(token);
    if (token.data.hidden) effects.push('token-variants-visibility');
    await updateWithEffectMapping(token, effects, canvas.tokens.hud._statusEffects);
  };

  Hooks.on('deleteCombatant', (combatant, options, userId) => {
    if (!TVA_CONFIG.enableStatusConfig || game.userId !== userId) return;
    deleteCombatant(combatant);
  });

  Hooks.on('deleteCombat', (combat, options, userId) => {
    if (!TVA_CONFIG.enableStatusConfig || game.userId !== userId) return;
    combat.combatants.forEach((combatant) => {
      deleteCombatant(combatant);
    });
  });

  //
  // Handle image updates for Active Effects applied to Tokens WITH Linked Actors
  //

  let updateImageOnEffectChange = async function (activeEffect) {
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
          await updateWithEffectMapping(token, tokenEffects, canvas.tokens.hud._statusEffects);
        }
      }
    }
  };

  Hooks.on('createActiveEffect', (activeEffect, options, userId) => {
    if (
      !TVA_CONFIG.enableStatusConfig ||
      !activeEffect.parent ||
      activeEffect.data.disabled ||
      game.userId !== userId
    )
      return;
    updateImageOnEffectChange(activeEffect);
  });

  Hooks.on('deleteActiveEffect', (activeEffect, options, userId) => {
    if (
      !TVA_CONFIG.enableStatusConfig ||
      !activeEffect.parent ||
      activeEffect.data.disabled ||
      game.userId !== userId
    )
      return;
    updateImageOnEffectChange(activeEffect);
  });

  Hooks.on('updateActiveEffect', (activeEffect, change, options, userId) => {
    if (
      !TVA_CONFIG.enableStatusConfig ||
      !activeEffect.parent ||
      !('disabled' in change) ||
      game.userId !== userId
    )
      return;
    updateImageOnEffectChange(activeEffect);
  });

  //
  // Hooks required for PF2e linked actor token updates
  //
  Hooks.on('deleteItem', (condition, options, userId) => {
    if (
      game.system.id !== 'pf2e' ||
      condition.type !== 'condition' ||
      !TVA_CONFIG.enableStatusConfig ||
      !condition.parent ||
      condition.data.disabled ||
      game.userId !== userId
    )
      return;
    updateImageOnEffectChange(condition);
  });

  Hooks.on('createItem', (condition, options, userId) => {
    if (
      game.system.id !== 'pf2e' ||
      condition.type !== 'condition' ||
      !TVA_CONFIG.enableStatusConfig ||
      !condition.parent ||
      condition.data.disabled ||
      game.userId !== userId
    )
      return;
    updateImageOnEffectChange(condition);
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
    if (!TVA_CONFIG.enableStatusConfig || !token.actor) return;

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

    const effectAdded = oldEffects.length < newEffects.length;
    const effectRemoved = oldEffects.length > newEffects.length;

    let performUpdate = false;
    if (effectAdded) {
      performUpdate = newEffects[newEffects.length - 1] in mappings;
    }
    if (effectRemoved) {
      performUpdate = oldEffects[oldEffects.length - 1] in mappings;
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
      };
    }
  });

  Hooks.on('updateToken', async function (token, change, options, userId) {
    if (game.userId !== userId) return;
    if (!TVA_CONFIG.enableStatusConfig) return;
    if (options['token-variants'] && token.actor) {
      updateWithEffectMapping(
        token,
        options['token-variants'].effects,
        options['token-variants'].toggleStatus
      );
    }
  });

  Hooks.on('renderArtSelect', () => {
    showArtSelectExecuting.inProgress = false;
  });

  if (game.user && game.user.can('FILES_BROWSE') && game.user.can('TOKEN_CONFIGURE')) {
    const disableRandomSearchForType = (randSettings, actor) => {
      if (!actor) return false;
      return randSettings[`${actor.type}Disable`] ?? false;
    };

    const disablePopupForType = (actor) => {
      if (!actor) return false;
      return TVA_CONFIG.popup[`${actor.type}Disable`] ?? false;
    };

    // Workaround for forgeSearchPaths setting to be updated by non-GM clients
    game.socket?.on(`module.token-variants`, (message) => {
      if (message.handlerName === 'forgeSearchPaths' && message.type === 'UPDATE') {
        if (!game.user.isGM) return;
        const isResponsibleGM = !game.users
          .filter((user) => user.isGM && (user.active || user.isActive))
          .some((other) => other.data._id < game.user.data._id);
        if (!isResponsibleGM) return;
        game.settings.set('token-variants', 'forgeSearchPaths', message.args);
      }
    });

    // Handle actor/token art replacement
    Hooks.on('createActor', async (actor, options, userId) => {
      if (userId && game.user.id != userId) return;

      // Check if random search is enabled and if so perform it
      const randSettings = TVA_CONFIG.randomizer;
      if (randSettings.actorCreate) {
        let performRandomSearch = true;
        if (randSettings.linkedActorDisable && actor.data.token.actorLink)
          performRandomSearch = false;
        if (disableRandomSearchForType(randSettings, actor)) performRandomSearch = false;

        if (performRandomSearch) {
          const img = await doRandomSearch(actor.data.name, {
            searchType: SEARCH_TYPE.PORTRAIT,
            actor: actor,
          });
          if (img) {
            await updateActorImage(actor, img[0], { imgName: img[1] });
          }

          if (!img) return;

          if (randSettings.diffImages) {
            console.log('Am i here?', randSettings);
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
      if (!game.user.isGM && TVA_CONFIG.popup.gmOnly) {
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
          await updateActorImage(actor, imgSrc, {
            imgName: name,
            token: token,
          });
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
        preventClose: TVA_CONFIG.popup.twoPopups,
      });
    });

    Hooks.on('createToken', async (token, options, userId) => {
      if (userId && game.user.id != userId) return;

      // Check if random search is enabled and if so perform it

      const randSettings = TVA_CONFIG.randomizer;
      let vDown = keyPressed('v');

      if ((vDown && randSettings.tokenCopyPaste) || (!vDown && randSettings.tokenCreate)) {
        let performRandomSearch = true;
        if (randSettings.representedActorDisable && token.actor) performRandomSearch = false;
        if (randSettings.linkedActorDisable && token.data.actorLink) performRandomSearch = false;
        if (disableRandomSearchForType(randSettings, token.actor)) performRandomSearch = false;

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
        if (!randSettings.popupOnDisable) {
          return;
        }
      } else if (randSettings.tokenCreate || randSettings.tokenCopyPaste) {
        return;
      }

      // Check if pop-up is enabled and if so open it
      if (!game.user.isGM && TVA_CONFIG.popup.gmOnly) {
        return;
      }

      let dirKeyDown = keyPressed('popupOverride');

      if (vDown && TVA_CONFIG.popup.disableAutoPopupOnTokenCopyPaste) {
        return;
      }

      if (!dirKeyDown || (dirKeyDown && vDown)) {
        if (TVA_CONFIG.popup.disableAutoPopupOnTokenCreate && !vDown) {
          return;
        } else if (disablePopupForType(token.actor)) {
          return;
        }
      }

      showArtSelect(token.data.name, {
        callback: async function (imgSrc, imgName) {
          if (TVA_CONFIG.popup.twoPopups) {
            await updateActorImage(token.actor, imgSrc, {
              imgName: imgName,
              token: token,
            });
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
        preventClose: TVA_CONFIG.popup.twoPopups,
      });
    });
    Hooks.on('renderTokenConfig', modTokenConfig);
    Hooks.on('renderActorSheet', modActorSheet);
    cacheTokens();
  } else if ((TVA_CONFIG.worldHud ?? {}).enableButtonForAll) {
    cacheTokens();
  }
  Hooks.on('renderTokenHUD', renderHud);

  initialized = true;
}

/**
 * Adds a button to 'Token Configuration' window's 'Image' tab which opens
 * ArtSelect using the token's name.
 */
function modTokenConfig(tokenConfig, html, _) {
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

/**
 * Adds right-click listener to Actor Sheet profile image to open up
 * the 'Art Select' screen.
 */
function modActorSheet(actorSheet, html, options) {
  if (!options.editable || TVA_CONFIG.popup.disableActorPortraitArtSelect) return;

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
        callback: (imgSrc, name) =>
          updateActorImage(actorSheet.object, imgSrc, {
            imgName: name,
          }),
        searchType: SEARCH_TYPE.PORTRAIT,
        object: actorSheet.object,
      });
    },
    false
  );
}

/**
 * Search for and cache all the found token art
 */
export async function cacheTokens() {
  if (caching) return;
  caching = true;
  if (!TVA_CONFIG.disableNotifs)
    ui.notifications.info(game.i18n.format('token-variants.notifications.info.caching-started'));

  if (TVA_CONFIG.debug) console.log('STARTING: Token Caching');
  cachedImages = [];

  await findTokensExact('', '');
  cachedImages = foundImages;

  foundImages = [];
  if (TVA_CONFIG.debug) console.log('ENDING: Token Caching');

  caching = false;
  if (!TVA_CONFIG.disableNotifs)
    ui.notifications.info(
      game.i18n.format('token-variants.notifications.info.caching-finished', {
        imageCount: cachedImages.length,
      })
    );
}

/**
 * Checks if image path and name match the provided search text and filters
 * @param imagePath image path
 * @param imageName image name
 * @param filters filters to be applied
 * @returns true|false
 */
function exactSearchMatchesImage(simplifiedSearch, imagePath, imageName, filters) {
  // Is the search text contained in the name/path
  const simplified = TVA_CONFIG.runSearchOnPath
    ? simplifyPath(imagePath)
    : simplifyTokenName(imageName);
  if (!simplified.includes(simplifiedSearch)) {
    return false;
  }

  if (!filters) return true;
  return imagePassesFilter(imageName, imagePath, filters);
}

function imagePassesFilter(imageName, imagePath, filters) {
  // Filters are applied to path depending on the 'runSearchOnPath' setting, and actual or custom rolltable name
  let text;
  if (TVA_CONFIG.runSearchOnPath) {
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

async function findTokens(name, searchType = '', algorithmOptions = {}) {
  const algOptions = mergeObject(algorithmOptions, TVA_CONFIG.algorithm, { overwrite: false });
  if (algOptions.exact) {
    return findTokensExact(name, searchType);
  } else {
    return findTokensFuzzy(name, searchType, algOptions);
  }
}

async function findTokensFuzzy(name, searchType, algorithmOptions) {
  if (TVA_CONFIG.debug)
    console.log('STARTING: Fuzzy Token Search', name, searchType, caching, algorithmOptions);

  // Select filters based on type of search
  let filters = getFilters(searchType);

  let allPaths;
  if (multiSearch) {
    allPaths = cachedImages.filter(
      (imgObj) => !usedImages.has(imgObj) && imagePassesFilter(imgObj.name, imgObj.path, filters)
    );
  } else {
    allPaths = cachedImages.filter((imgObj) =>
      imagePassesFilter(imgObj.name, imgObj.path, filters)
    );
  }

  foundImages = [];
  await walkAllPaths();

  foundImages.forEach((imgObj) => {
    if (imagePassesFilter(imgObj.name, imgObj.path, filters)) {
      allPaths.push(imgObj);
    }
  });

  const fuse = new Fuse(allPaths, {
    keys: [TVA_CONFIG.runSearchOnPath ? 'path' : 'name'],
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 1,
    ignoreLocation: true,
    threshold: algorithmOptions.fuzzyThreshold,
  });

  const results = fuse.search(name).slice(0, algorithmOptions.fuzzyLimit);

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
async function findTokensExact(name, searchType) {
  if (TVA_CONFIG.debug) console.log('STARTING: Exact Token Search', name, searchType, caching);

  foundImages = [];

  await walkAllPaths();

  const simpleName = simplifyTokenName(name);
  let filters = getFilters(searchType);
  foundImages = foundImages.filter((pathObj) =>
    exactSearchMatchesImage(simpleName, pathObj.path, pathObj.name, filters)
  );

  cachedImages.forEach((pathObj) => {
    if (exactSearchMatchesImage(simpleName, pathObj.path, pathObj.name, filters))
      foundImages.push(pathObj);
  });

  if (TVA_CONFIG.debug) console.log('ENDING: Exact Token Search', foundImages);
  return foundImages;
}

async function walkAllPaths() {
  for (let path of TVA_CONFIG.parsedSearchPaths.get('data')) {
    if ((path.cache && caching) || (!path.cache && !caching)) await walkFindTokens(path.text, {});
  }
  for (let [bucket, paths] of TVA_CONFIG.parsedSearchPaths.get('s3')) {
    for (let path of paths) {
      if ((path.cache && caching) || (!path.cache && !caching))
        await walkFindTokens(path.text, {
          bucket: bucket,
        });
    }
  }
  for (let path of TVA_CONFIG.parsedSearchPaths.get('forge')) {
    if ((path.cache && caching) || (!path.cache && !caching))
      await walkFindTokens(path.text, {
        forge: true,
      });
  }
  for (let path of TVA_CONFIG.parsedSearchPaths.get('rolltable')) {
    if ((path.cache && caching) || (!path.cache && !caching))
      await walkFindTokens(path.text, {
        rollTableName: path.text,
      });
  }
  for (let path of TVA_CONFIG.parsedSearchPaths.get('forgevtt')) {
    if ((path.cache && caching) || (!path.cache && !caching))
      await walkFindTokens(path.text, {
        forgevtt: true,
        apiKey: path.apiKey,
      });
  }
  for (let path of TVA_CONFIG.parsedSearchPaths.get('imgur')) {
    if ((path.cache && caching) || (!path.cache && !caching))
      await walkFindTokens(path.text, {
        imgur: true,
      });
  }
}

async function walkFindTokens(
  path,
  {
    bucket = '',
    forge = false,
    rollTableName = '',
    forgevtt = false,
    apiKey = '',
    imgur = false,
  } = {}
) {
  const dirs = [path];
  let files = {};
  while (dirs.length > 0) {
    let dir = dirs.pop();
    try {
      if (bucket) {
        files = await FilePicker.browse('s3', dir, {
          bucket: bucket,
        });
      } else if (forge) {
        files = await FilePicker.browse('', dir, {
          wildcard: true,
        });
      } else if (forgevtt) {
        if (apiKey) {
          const response = await callForgeVTT(dir, apiKey);
          files.files = response.files.map((f) => f.url);
        } else {
          files = await FilePicker.browse('forgevtt', dir, {
            recursive: true,
          });
        }
      } else if (imgur && location.hostname !== 'localhost') {
        await fetch('https://api.imgur.com/3/gallery/album/' + dir, {
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
      } else if (rollTableName) {
        const table = game.tables.contents.find((t) => t.name === rollTableName);
        if (!table) {
          ui.notifications.warn(
            game.i18n.format('token-variants.notifications.warn.invalid-table', {
              rollTableName,
            })
          );
        } else {
          for (let baseTableData of table.data.results) {
            const path = baseTableData.data.img;
            const rtName = baseTableData.data.text;
            foundImages.push({ path: path, name: rtName });
          }
        }
        return;
      } else {
        files = await FilePicker.browse('data', dir);
      }
    } catch (err) {
      console.log(
        `${game.i18n.localize('token-variants.notifications.warn.path-not-found')} ${path}`
      );
      return;
    }

    if (files.target == '.') continue;

    for (let tokenSrc of files.files) {
      foundImages.push({ path: tokenSrc, name: getFileName(tokenSrc) });
    }

    if (forgevtt) continue;

    for (let f_dir of files.dirs) {
      dirs.push(f_dir);
    }
  }
}

/**
 * Performs searches and displays the Art Select pop-up with the results
 * @param {string} search The text to be used as the search criteria
 * @param {object} [options={}] Options which customize the search
 * @param {Function[]} [options.callback] Function to be called with the user selected image path
 * @param {SEARCH_TYPE|string} [options.searchType] (token|portrait|both) Controls filters applied to the search results
 * @param {Token|Actor} [options.object] Token/Actor used when displaying Custom Token Config prompt
 * @param {boolean} [options.force] If true will always override the current Art Select window if one exists instead of adding it to the queue
 * @param {boolean} [options.ignoreKeywords] Override for the 'Search by Keyword' setting
 * @param {object} [options.algorithmOptions] Override for the 'Search Algorithm Settings' setting
 * @param {boolean} [options.algorithmOptions.exact] Force use exact search
 * @param {boolean} [options.algorithmOptions.fuzzy] Force use fuzzy search
 * @param {number} [options.algorithmOptions.fuzzyLimit] Force fuzzy search image return limit
 * @param {number} [options.algorithmOptions.fuzzyThreshold] Force fuzzy search threshold (0.0-1.0)
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
    ignoreKeywords = false,
    algorithmOptions = {},
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
      algorithmOptions: algorithmOptions,
    });
    return;
  }

  showArtSelectExecuting.inProgress = true;

  const allImages = await doImageSearch(search, {
    searchType: searchType,
    ignoreKeywords: ignoreKeywords,
    algorithmOptions: algorithmOptions,
  });

  new ArtSelect(search, {
    allImages: allImages,
    searchType: searchType,
    callback: callback,
    object: object,
    preventClose: preventClose,
    image1: image1,
    image2: image2,
    algorithmOptions: algorithmOptions,
  }).render(true);
}

async function _randSearchUtil(search, { searchType = SEARCH_TYPE.BOTH, actor = null } = {}) {
  const randSettings = TVA_CONFIG.randomizer;
  if (!(randSettings.tokenName || randSettings.keywords || randSettings.shared)) return null;

  // Gather all images
  let results =
    randSettings.tokenName || randSettings.keywords
      ? await doImageSearch(search, {
          searchType: searchType,
          ignoreKeywords: !randSettings.keywords,
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
  const results = await _randSearchUtil(search, { searchType: searchType, actor: actor });
  if (!results) return results;

  // Find image with the name most similar to target
  let mostSimilar = { imgSrc: '', imgName: '', similarity: 0.0 };

  results.forEach((images) => {
    images.forEach((imageObj) => {
      const similarity = stringSimilarity(imageObj.name, target);
      if (mostSimilar.similarity < similarity) {
        mostSimilar = { imgSrc: imageObj.path, imgName: imageObj.name, similarity: similarity };
      }
    });
  });

  if (mostSimilar.imgName) {
    return [mostSimilar.imgSrc, mostSimilar.imgName];
  }

  return null;
}

/**
 * @param {*} search Text to be used as the search criteria
 * @param {object} [options={}] Options which customize the search
 * @param {SEARCH_TYPE|string} [options.searchType] Controls filters applied to the search results
 * @param {Actor} [options.actor] Used to retrieve 'shared' images from if enabled in the Randomizer Settings
 * @param {Function[]} [options.callback] Function to be called with the random image
 * @returns Array<string>|null} Image path and name
 */
async function doRandomSearch(
  search,
  { searchType = SEARCH_TYPE.BOTH, actor = null, callback = null } = {}
) {
  if (caching) return null;

  const results = await _randSearchUtil(search, { searchType: searchType, actor: actor });
  if (!results) return results;

  // Pick random image
  let total = 0;
  results.forEach((v) => (total += v.length));
  let randImageNum = Math.floor(Math.random() * total);
  for (const [_, images] of results.entries()) {
    if (randImageNum < images.length) {
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
 * @param {Boolean} [options.ignoreKeywords] Ignores keywords search setting
 * @param {Boolean} [options.simpleResults] Results will be returned as an array of all image paths found
 * @param {Function[]} [options.callback] Function to be called with the found images
 * @param {object} [options.algorithmOptions] See showArtSelect(...)
 * @returns {Promise<Map<string, Array<object>|Array<string>>} All images found split by original criteria and keywords
 */
export async function doImageSearch(
  search,
  {
    searchType = SEARCH_TYPE.BOTH,
    ignoreKeywords = false,
    simpleResults = false,
    callback = null,
    algorithmOptions = {},
  } = {}
) {
  if (caching) return;

  search = search.trim();

  if (TVA_CONFIG.debug) console.log('STARTING: Art Search', search, searchType);

  let searches = [search];
  let allImages = new Map();

  if (TVA_CONFIG.keywordSearch && !ignoreKeywords) {
    searches = searches.concat(
      search
        .split(/\W/)
        .filter(
          (word) =>
            word.length > 2 && !TVA_CONFIG.parsedExcludedKeywords.includes(word.toLowerCase())
        )
        .reverse()
    );
  }

  multiSearch = true; // TODO: transfer this logic to findTokens()
  usedImages = new Set();
  for (const search of searches) {
    if (allImages.get(search) !== undefined) continue;

    let results = await findTokens(search, searchType, algorithmOptions);
    results = results.filter((pathObj) => !usedImages.has(pathObj));

    allImages.set(search, results);
    results.forEach(usedImages.add, usedImages);

    multiSearch = true; // TODO: transfer this logic to findTokens()
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
  if (TVA_CONFIG.popup.twoPopups && TVA_CONFIG.popup.noTwoPopupsPrompt) {
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

  game.modules.get('token-variants').api = {
    cacheTokens,
    doImageSearch,
    doRandomSearch,
    showArtSelect,
    updateTokenImage,
    exportSettingsToJSON,
  };
});
