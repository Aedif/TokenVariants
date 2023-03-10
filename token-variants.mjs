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
  flattenSearchResults,
  parseKeywords,
  getFilePath,
  waitForTokenTexture,
  isVideo,
  isImage,
  nameForgeRandomize,
} from './scripts/utils.js';
import { renderHud } from './applications/tokenHUD.js';
import { renderTileHUD } from './applications/tileHUD.js';
import { Fuse } from './scripts/fuse/fuse.js';
import { checkAndDisplayUserSpecificImage } from './scripts/token/userToImage.js';
import { drawOverlays } from './scripts/token/overlay.js';
import { updateWithEffectMapping } from './scripts/token/effects.js';
import { registerTokenHooks } from './scripts/token/hooks.js';

// Tracks if module has been initialized
let initialized = false;
let onInit = [];

// True if in the middle of caching image paths
let caching = false;

// Cached images
let CACHED_IMAGES = {};

// showArtSelect(...) can take a while to fully execute and it is possible for it to be called
// multiple times in very quick succession especially if copy pasting tokens or importing actors.
// This variable set early in the function execution is used to queue additional requests rather
// than continue execution
const showArtSelectExecuting = { inProgress: false };

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

  // Want this to be executed once the module has initialized
  onInit.push(() => {
    // Need to wait for icons do be drawn first however I could not find a way
    // to wait until that has occurred. Instead we'll just wait for some static
    // amount of time.
    new Promise((resolve) => setTimeout(resolve, 500)).then(() => {
      for (const tkn of canvas.tokens.placeables) {
        drawOverlays(tkn); // Draw Overlays

        // Disable effect icons
        if (TVA_CONFIG.disableEffectIcons) {
          waitForTokenTexture(tkn, (token) => {
            token.effects.removeChildren().forEach((c) => c.destroy());
            token.effects.bg = token.effects.addChild(new PIXI.Graphics());
            token.effects.overlay = null;
          });
        } else if (TVA_CONFIG.filterEffectIcons) {
          waitForTokenTexture(tkn, (token) => {
            token.drawEffects();
          });
        }
      }
    });
  });

  await registerSettings();

  if (userRequiresImageCache()) {
    cacheImages();
  }

  // Startup ticker that will periodically call 'updateEmbeddedDocuments' with all the accrued updates since the last tick
  startBatchUpdater();

  registerTokenHooks();

  Hooks.on('renderArtSelect', () => {
    showArtSelectExecuting.inProgress = false;
  });

  game.socket?.on(`module.token-variants`, (message) => {
    if (message.handlerName === 'drawMorphOverlay') {
      const token = canvas.tokens.get(message.args.tokenId);
      if (token) token.tvaMorph = message.args.morph;
    }

    // Workaround for forgeSearchPaths setting to be updated by non-GM clients
    if (message.handlerName === 'forgeSearchPaths' && message.type === 'UPDATE') {
      if (!game.user.isGM) return;
      const isResponsibleGM = !game.users
        .filter((user) => user.isGM && (user.active || user.isActive))
        .some((other) => other.id < game.user.id);
      if (!isResponsibleGM) return;
      updateSettings({ forgeSearchPaths: message.args });
    }

    if (message.handlerName === 'drawOverlays' && message.type === 'UPDATE') {
      if (message.args.all) {
        if (canvas.scene.id !== message.args.sceneId) {
          for (const tkn of canvas.tokens.placeables) {
            drawOverlays(tkn);
          }
        }
      } else if (message.args.tokenId) {
        const tkn = canvas.tokens.get(message.args.tokenId);
        if (tkn) drawOverlays(tkn);
      }
    }
  });

  // Handle actor/token art replacement
  Hooks.on('createActor', createActor);
  Hooks.on('createToken', createToken);

  Hooks.on('renderTokenConfig', modTokenConfig);
  Hooks.on('renderTileConfig', modTileConfig);
  Hooks.on('renderMeasuredTemplateConfig', modTemplateConfig);

  if (TVA_CONFIG.permissions.portrait_right_click[game.user.role]) {
    Hooks.on('renderActorSheet', modActorSheet);
    Hooks.on('renderItemSheet', modItemSheet);
    Hooks.on('renderItemActionSheet', modItemSheet);
    Hooks.on('renderJournalSheet', modJournalSheet);
  }

  Hooks.on('renderTokenHUD', renderHud);
  Hooks.on('renderTileHUD', renderTileHUD);

  initialized = true;
  for (const cb of onInit) {
    cb();
  }
  onInit = [];
}

async function createToken(token, options, userId) {
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
      if (disableRandomSearchForType(randSettings, token.actor)) performRandomSearch = false;
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
    } else if (popupFlag == null && disablePopupForType(token.actor)) {
      return;
    } else if (popupFlag != null && !popupFlag) {
      return;
    }
  }

  showArtSelect(token.name, {
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
    searchType: TVA_CONFIG.popup.twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.TOKEN,
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
    if (randSettings.linkedActorDisable && actor.prototypeToken.actorLink) performRandomSearch = false;
    if (disableRandomSearchForType(randSettings, actor)) performRandomSearch = false;

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
  } else if (disablePopupForType(actor)) {
    return;
  }

  showArtSelect(actor.name, {
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
    searchType: TVA_CONFIG.popup.twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.PORTRAIT_AND_TOKEN,
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

/**
 * Adds a button to 'Tile Configuration' window's 'Tile Image or Video' form-group
 * to open an ArtSelect using the tile's name.
 */
function modTileConfig(tileConfig, html, _) {
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
        el.setAttribute('data-target', 'img');
        el.onclick = async () => {
          const tileName =
            tileConfig.object.getFlag('token-variants', 'tileName') || tileConfig.object.id || 'new tile';
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
 * Adds a button to 'Measured Template Configuration' window
 */
function modTemplateConfig(templateConfig, html, _) {
  if (TVA_CONFIG.permissions.image_path_button[game.user.role]) {
    let fields = html[0].getElementsByClassName('image');
    for (let field of fields) {
      if (field.getAttribute('name') == 'texture') {
        let el = document.createElement('button');
        el.type = 'button';
        el.title = game.i18n.localize('token-variants.windows.art-select.select-variant');
        el.className = 'token-variants-image-select-button';
        el.innerHTML = '<i class="fas fa-images"></i>';
        el.tabIndex = -1;
        el.setAttribute('data-type', 'imagevideo');
        el.setAttribute('data-target', 'img');
        el.onclick = async () => {
          showArtSelect('template', {
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

function modItemSheet(itemSheet, html, options) {
  $(html)
    .find('img.profile, .profile-img, [data-edit="img"]')
    .on('contextmenu', () => {
      const item = itemSheet.object;
      if (!item) return;
      showArtSelect(item.name, {
        searchType: SEARCH_TYPE.ITEM,
        callback: (imgSrc) => item.update({ img: imgSrc }),
      });
    });
}

function modJournalSheet(journalSheet, html, options) {
  $(html)
    .find('.header-button.entry-image')
    .on('contextmenu', () => {
      const journal = journalSheet.object;
      if (!journal) return;
      showArtSelect(journal.name, {
        searchType: SEARCH_TYPE.JOURNAL,
        callback: (imgSrc) => journal.update({ img: imgSrc }),
      });
    });
}

export async function saveCache(cacheFile) {
  const data = {};

  const caches = Object.keys(CACHED_IMAGES);
  for (const c of caches) {
    if (!(c in data)) data[c] = [];
    for (const img of CACHED_IMAGES[c]) {
      if (img.tags) {
        data[c].push([img.path, img.name, img.tags]);
      } else if (getFileName(img.path) === img.name) {
        data[c].push(img.path);
      } else {
        data[c].push([img.path, img.name]);
      }
    }
  }

  let file = new File([JSON.stringify(data)], getFileNameWithExt(cacheFile), {
    type: 'text/plain',
  });
  FilePicker.upload('data', getFilePath(cacheFile), file);
}

async function _readCacheFromFile(fileName) {
  CACHED_IMAGES = {};
  try {
    await jQuery.getJSON(fileName, (json) => {
      for (let category in json) {
        CACHED_IMAGES[category] = [];

        for (const img of json[category]) {
          if (Array.isArray(img)) {
            if (img.length === 3) {
              CACHED_IMAGES[category].push({ path: img[0], name: img[1], tags: img[2] });
            } else {
              CACHED_IMAGES[category].push({ path: img[0], name: img[1] });
            }
          } else {
            CACHED_IMAGES[category].push({ path: img, name: getFileName(img) });
          }
        }
      }
      if (!TVA_CONFIG.disableNotifs)
        ui.notifications.info(
          `Token Variant Art: Using Static Cache (${Object.keys(CACHED_IMAGES).reduce(
            (count, c) => count + CACHED_IMAGES[c].length,
            0
          )} images)`
        );
    });
  } catch (error) {
    ui.notifications.warn(`Token Variant Art: Static Cache not found`);
    CACHED_IMAGES = {};
    return false;
  }
  return true;
}

/**
 * Search for and cache all the found token art
 */
export async function cacheImages({
  staticCache = TVA_CONFIG.staticCache,
  staticCacheFile = TVA_CONFIG.staticCacheFile,
} = {}) {
  if (caching) return;
  caching = true;

  if (!initialized && staticCache) {
    if (await _readCacheFromFile(staticCacheFile)) {
      caching = false;
      return;
    }
  }

  if (!TVA_CONFIG.disableNotifs)
    ui.notifications.info(game.i18n.format('token-variants.notifications.info.caching-started'));

  if (TVA_CONFIG.debug) console.log('STARTING: Token Caching');
  const found_images = await walkAllPaths();
  CACHED_IMAGES = found_images;

  if (TVA_CONFIG.debug) console.log('ENDING: Token Caching');

  caching = false;
  if (!TVA_CONFIG.disableNotifs)
    ui.notifications.info(
      game.i18n.format('token-variants.notifications.info.caching-finished', {
        imageCount: Object.keys(CACHED_IMAGES).reduce((count, types) => count + CACHED_IMAGES[types].length, 0),
      })
    );

  if (staticCache && game.user.isGM) {
    saveCache(staticCacheFile);
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
  if (sOptions.algorithm.exact) {
    return await findImagesExact(name, searchType, sOptions);
  } else {
    return await findImagesFuzzy(name, searchType, sOptions);
  }
}

async function findImagesExact(name, searchType, searchOptions) {
  if (TVA_CONFIG.debug) console.log('STARTING: Exact Image Search', name, searchType, searchOptions);

  const found_images = await walkAllPaths(searchType);

  const simpleName = simplifyName(name);
  const filters = getFilters(searchType, searchOptions.searchFilters);

  const matchedImages = [];

  for (const container of [CACHED_IMAGES, found_images]) {
    for (const typeKey in container) {
      const types = typeKey.split(',');
      if (types.includes(searchType)) {
        for (const imgOBj of container[typeKey]) {
          if (exactSearchMatchesImage(simpleName, imgOBj.path, imgOBj.name, filters, searchOptions.runSearchOnPath)) {
            matchedImages.push(imgOBj);
          }
        }
      }
    }
  }

  if (TVA_CONFIG.debug) console.log('ENDING: Exact Image Search', matchedImages);
  return matchedImages;
}

export async function findImagesFuzzy(name, searchType, searchOptions, forceSearchName = false) {
  if (TVA_CONFIG.debug) console.log('STARTING: Fuzzy Image Search', name, searchType, searchOptions, forceSearchName);

  const filters = getFilters(searchType, searchOptions.searchFilters);

  const fuse = new Fuse([], {
    keys: [!forceSearchName && searchOptions.runSearchOnPath ? 'path' : 'name', 'tags'],
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 1,
    ignoreLocation: true,
    threshold: searchOptions.algorithm.fuzzyThreshold,
  });

  const found_images = await walkAllPaths(searchType);

  for (const container of [CACHED_IMAGES, found_images]) {
    for (const typeKey in container) {
      const types = typeKey.split(',');
      if (types.includes(searchType)) {
        for (const imgObj of container[typeKey]) {
          if (imagePassesFilter(imgObj.name, imgObj.path, filters, searchOptions.runSearchOnPath)) {
            fuse.add(imgObj);
          }
        }
      }
    }
  }

  let results;
  if (name === '') {
    results = fuse.getIndex().docs.slice(0, searchOptions.algorithm.fuzzyLimit);
  } else {
    results = fuse.search(name).slice(0, searchOptions.algorithm.fuzzyLimit);
    results = results.map((r) => {
      r.item.indices = r.matches[0].indices;
      r.item.score = r.score;
      return r.item;
    });
  }

  if (TVA_CONFIG.debug) console.log('ENDING: Fuzzy Image Search', results);

  return results;
}

function filterPathsByType(paths, searchType) {
  if (!searchType) return paths;
  return paths.filter((p) => p.types.includes(searchType));
}

async function walkAllPaths(searchType) {
  const found_images = {};
  const paths = filterPathsByType(TVA_CONFIG.searchPaths, searchType);

  for (const path of paths) {
    if ((path.cache && caching) || (!path.cache && !caching)) await walkFindImages(path, {}, found_images);
  }

  // ForgeVTT specific path handling
  const userId = typeof ForgeAPI !== 'undefined' ? await ForgeAPI.getUserId() : '';
  for (const uid in TVA_CONFIG.forgeSearchPaths) {
    const apiKey = TVA_CONFIG.forgeSearchPaths[uid].apiKey;
    const paths = filterPathsByType(TVA_CONFIG.forgeSearchPaths[uid].paths, searchType);
    if (uid === userId) {
      for (const path of paths) {
        if ((path.cache && caching) || (!path.cache && !caching)) await walkFindImages(path, {}, found_images);
      }
    } else if (apiKey) {
      for (const path of paths) {
        if ((path.cache && caching) || (!path.cache && !caching)) {
          if (path.share) await walkFindImages(path, { apiKey: apiKey }, found_images);
        }
      }
    }
  }

  return found_images;
}

function addToFound(img, typeKey, found_images) {
  if (isImage(img.path) || isVideo(img.path)) {
    if (found_images[typeKey] == null) {
      found_images[typeKey] = [img];
    } else {
      found_images[typeKey].push(img);
    }
  }
}

async function walkFindImages(path, { apiKey = '' } = {}, found_images) {
  let files = {};
  if (!path.source) {
    path.source = 'data';
  }
  const typeKey = path.types.sort().join(',');
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
          Authorization: 'Client-ID ' + (TVA_CONFIG.imgurClientId ? TVA_CONFIG.imgurClientId : 'df9d991443bb222'),
          Accept: 'application/json',
        },
      })
        .then((response) => response.json())
        .then(async function (result) {
          if (!result.success) {
            return;
          }
          result.data.images.forEach((img) => {
            const rtName = img.title ?? img.description ?? getFileName(img.link);
            addToFound({ path: img.link, name: rtName }, typeKey, found_images);
          });
        })
        .catch((error) => console.log('Token Variant Art: ', error));
      return;
    } else if (path.source.startsWith('rolltable')) {
      const table = game.tables.contents.find((t) => t.name === path.text);
      if (!table) {
        const rollTableName = path.text;
        ui.notifications.warn(
          game.i18n.format('token-variants.notifications.warn.invalid-table', {
            rollTableName,
          })
        );
      } else {
        for (let baseTableData of table.results) {
          const rtPath = baseTableData.img;
          const rtName = baseTableData.text || getFileName(rtPath);
          addToFound({ path: rtPath, name: rtName }, typeKey, found_images);
        }
      }
      return;
    } else if (path.source.startsWith('json')) {
      await fetch(path.text, {
        headers: {
          Accept: 'application/json',
        },
      })
        .then((response) => response.json())
        .then(async function (result) {
          if (!result.length > 0) {
            return;
          }
          result.forEach((img) => {
            const rtName = img.name ?? getFileName(img.path);
            addToFound({ path: img.path, name: rtName, tags: img.tags }, typeKey, found_images);
          });
        })
        .catch((error) => console.log('Token Variant Art: ', error));
      return;
    } else {
      files = await FilePicker.browse(path.source, path.text);
    }
  } catch (err) {
    console.log(
      `Token Variant Art | ${game.i18n.localize('token-variants.notifications.warn.path-not-found')} ${path.source}:${
        path.text
      }`
    );
    return;
  }

  if (files.target == '.') return;

  if (files.files) {
    files.files.forEach((tokenSrc) => {
      addToFound({ path: tokenSrc, name: getFileName(tokenSrc) }, typeKey, found_images);
    });
  }

  if (path.source.startsWith('forgevtt') || path.source.startsWith('forge-bazaar')) return;

  for (let f_dir of files.dirs) {
    await walkFindImages({ text: f_dir, source: path.source, types: path.types }, { apiKey: apiKey }, found_images);
  }
}

/**
 * Performs searches and displays the Art Select pop-up with the results
 * @param {string} search The text to be used as the search criteria
 * @param {object} [options={}] Options which customize the search
 * @param {Function[]} [options.callback] Function to be called with the user selected image path
 * @param {SEARCH_TYPE|string} [options.searchType] Controls filters applied to the search results
 * @param {Token|Actor} [options.object] Token/Actor used when displaying Custom Token Config prompt
 * @param {boolean} [options.force] If true will always override the current Art Select window if one exists instead of adding it to the queue
 * @param {object} [options.searchOptions] Override search and filter settings
 */
export async function showArtSelect(
  search,
  {
    callback = null,
    searchType = SEARCH_TYPE.PORTRAIT_AND_TOKEN,
    object = null,
    force = false,
    preventClose = false,
    image1 = '',
    image2 = '',
    displayMode = ArtSelect.IMAGE_DISPLAY.NONE,
    multipleSelection = false,
    searchOptions = {},
    allImages = null,
  } = {}
) {
  if (caching) return;

  const artSelects = Object.values(ui.windows).filter((app) => app instanceof ArtSelect);
  if (showArtSelectExecuting.inProgress || (!force && artSelects.length !== 0)) {
    addToArtSelectQueue(search, {
      callback,
      searchType,
      object,
      preventClose,
      searchOptions,
      allImages,
    });
    return;
  }

  showArtSelectExecuting.inProgress = true;

  if (!allImages)
    allImages = await doImageSearch(search, {
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
    displayMode: displayMode,
    multipleSelection: multipleSelection,
    searchOptions: searchOptions,
  }).render(true);
}

async function _randSearchUtil(
  search,
  { searchType = SEARCH_TYPE.PORTRAIT_AND_TOKEN, actor = null, randomizerOptions = {}, searchOptions = {} } = {}
) {
  const randSettings = mergeObject(randomizerOptions, TVA_CONFIG.randomizer, { overwrite: false });
  if (
    !(
      randSettings.tokenName ||
      randSettings.actorName ||
      randSettings.keywords ||
      randSettings.shared ||
      randSettings.wildcard
    )
  )
    return null;

  // Randomizer settings take precedence
  searchOptions.keywordSearch = randSettings.keywords;

  // Swap search to the actor name if need be
  if (randSettings.actorName && actor) {
    search = actor.name;
  }

  // Gather all images
  let results =
    randSettings.actorName || randSettings.tokenName || randSettings.keywords
      ? await doImageSearch(search, {
          searchType: searchType,
          searchOptions: searchOptions,
        })
      : new Map();

  if (!randSettings.tokenName && !randSettings.actorName) {
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
  if (randSettings.wildcard && actor) {
    let protoImg = actor.prototypeToken.texture.src;
    if (protoImg.includes('*') || (protoImg.includes('{') && protoImg.includes('}'))) {
      // Modified version of Actor.getTokenImages()
      const getTokenImages = async (actor) => {
        if (actor._tokenImages) return actor._tokenImages;
        let source = 'data';
        const browseOptions = { wildcard: true };

        // Support non-user sources
        if (/\.s3\./.test(protoImg)) {
          source = 's3';
          const { bucket, keyPrefix } = FilePicker.parseS3URL(protoImg);
          if (bucket) {
            browseOptions.bucket = bucket;
            protoImg = keyPrefix;
          }
        } else if (protoImg.startsWith('icons/')) source = 'public';

        // Retrieve wildcard content
        try {
          const content = await FilePicker.browse(source, protoImg, browseOptions);
          return content.files;
        } catch (err) {
          return [];
        }
      };

      const wildcardImages = (await getTokenImages(actor))
        .filter((img) => !img.includes('*') && (isImage(img) || isVideo(img)))
        .map((variant) => {
          return { path: variant, name: getFileName(variant) };
        });
      results.set('variants95436623', wildcardImages);
    }
  }

  return results;
}

async function doSyncSearch(
  search,
  target,
  { searchType = SEARCH_TYPE.TOKEN, actor = null, randomizerOptions = {} } = {}
) {
  if (caching) return null;

  const results = flattenSearchResults(await _randSearchUtil(search, { searchType, actor, randomizerOptions }));

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
 * @param {SEARCH_TYPE|string} [options.searchType] Controls filters applied to the search results
 * @param {Actor} [options.actor] Used to retrieve 'shared' images from if enabled in the Randomizer Settings
 * @param {Function[]} [options.callback] Function to be called with the random image
 * @param {object} [options.searchOptions] Override search settings
 * @param {object} [options.randomizerOptions] Override randomizer settings. These take precedence over searchOptions
 * @returns Array<string>|null} Image path and name
 */
async function doRandomSearch(
  search,
  {
    searchType = SEARCH_TYPE.PORTRAIT_AND_TOKEN,
    actor = null,
    callback = null,
    randomizerOptions = {},
    searchOptions = {},
  } = {}
) {
  if (caching) return null;

  const results = flattenSearchResults(
    await _randSearchUtil(search, {
      searchType: searchType,
      actor: actor,
      randomizerOptions: randomizerOptions,
      searchOptions: searchOptions,
    })
  );
  if (results.length === 0) return null;

  // Pick random image
  let randImageNum = Math.floor(Math.random() * results.length);
  if (callback) callback([results[randImageNum].path, results[randImageNum].name]);
  return [results[randImageNum].path, results[randImageNum].name];
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
  { searchType = SEARCH_TYPE.PORTRAIT_AND_TOKEN, simpleResults = false, callback = null, searchOptions = {} } = {}
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
        .split(/[_\- :,\|\(\)\[\]]/)
        .filter((word) => word.length > 2 && !keywords.includes(word.toLowerCase()))
        .reverse()
    );
  }

  let usedImages = new Set();
  for (const search of searches) {
    if (allImages.get(search) !== undefined) continue;

    let results = await findImages(search, searchType, searchOptions);
    results = results.filter((pathObj) => !usedImages.has(pathObj));

    allImages.set(search, results);
    results.forEach(usedImages.add, usedImages);
  }

  if (TVA_CONFIG.debug) console.log('ENDING: Art Search');

  if (simpleResults) {
    allImages = Array.from(usedImages).map((obj) => obj.path);
  }

  if (callback) callback(allImages);
  return allImages;
}

function twoPopupPrompt(actor, imgSrc, imgName, token) {
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

// Initialize module
Hooks.once('ready', initialize);

// Register API and Keybinds
Hooks.on('init', function () {
  registerKeybinds();

  game.modules.get('token-variants').api = {
    cacheImages,
    doImageSearch,
    doRandomSearch,
    showArtSelect,
    updateTokenImage,
    exportSettingsToJSON,
    TVA_CONFIG,
  };
});

Hooks.on('canvasReady', async function () {
  for (const tkn of canvas.tokens.placeables) {
    // Once canvas is ready we need to overwrite token images if specific maps exist for the user
    checkAndDisplayUserSpecificImage(tkn);
    if (initialized) {
      updateWithEffectMapping(tkn);
      drawOverlays(tkn);
    }
  }
});
