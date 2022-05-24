import { TVA_CONFIG } from './settings.js';

const simplifyRegex = new RegExp(/[^A-Za-z0-9/\\]/g);

// Types of searches
export const SEARCH_TYPE = {
  PORTRAIT: 'portrait',
  TOKEN: 'token',
  BOTH: 'both',
};

export const PRESSED_KEYS = {
  popupOverride: false,
  config: false,
};

const BATCH_UPDATES = {
  TOKEN: [],
  TOKEN_CALLBACK: null,
  ACTOR: [],
  ACTOR_CONTEXT: null,
};

export function startBatchUpdater() {
  canvas.app.ticker.add(() => {
    if (BATCH_UPDATES.TOKEN.length !== 0) {
      canvas.scene.updateEmbeddedDocuments('Token', BATCH_UPDATES.TOKEN).then(() => {
        if (BATCH_UPDATES.TOKEN_CALLBACK) {
          BATCH_UPDATES.TOKEN_CALLBACK();
          BATCH_UPDATES.TOKEN_CALLBACK = null;
        }
      });
      BATCH_UPDATES.TOKEN = [];
    }
    if (BATCH_UPDATES.ACTOR.length !== 0) {
      if (BATCH_UPDATES.ACTOR_CONTEXT)
        Actor.updateDocuments(BATCH_UPDATES.ACTOR, BATCH_UPDATES.ACTOR_CONTEXT);
      else Actor.updateDocuments(BATCH_UPDATES.ACTOR);
      BATCH_UPDATES.ACTOR = [];
      BATCH_UPDATES.ACTOR_CONTEXT = null;
    }
  });
}

export function queueTokenUpdate(id, update, callback = null) {
  update._id = id;
  BATCH_UPDATES.TOKEN.push(update);
  if (callback) BATCH_UPDATES.TOKEN_CALLBACK = callback;
}

export function queueActorUpdate(id, update, context = null) {
  update._id = id;
  BATCH_UPDATES.ACTOR.push(update);
  BATCH_UPDATES.ACTOR_CONTEXT = context;
}

/**
 * Updates Token and/or Proto Token  with the new image and custom configuration if one exists.
 * @param {string} imgSrc Image source path/url
 * @param {object} [options={}] Update options
 * @param {Token[]} [options.token] Token to be updated with the new image
 * @param {Actor} [options.actor] Actor with Proto Token to be updated with the new image
 * @param {string} [options.imgName] Image name if it differs from the file name. Relevant for rolltable sourced images.
 * @param {object} [options.tokenUpdate] Token update to be merged and performed at the same time as image update
 * @param {object} [options.actorUpdate] Actor update to be merged and performed at the same time as image update
 * @param {string} [options.pack] Compendium pack of the Actor being updated
 * @param {func} [options.callback] Callback to be executed when a batch update has been performed
 */
export async function updateTokenImage(
  imgSrc,
  {
    token = null,
    actor = null,
    imgName = null,
    tokenUpdate = {},
    actorUpdate = {},
    pack = '',
    callback = null,
  } = {}
) {
  if (!(token || actor)) {
    console.warn(
      game.i18n.localize('token-variants.notifications.warn.update-image-no-token-actor')
    );
    return;
  }

  if (!imgName) imgName = getFileName(imgSrc);
  if (!actor && token.actor) {
    actor = game.actors.get(token.actor.id);
  }

  const getDefaultConfig = (token, actor) => {
    let configEntries = [];
    if (token)
      configEntries =
        (token.document ? token.document : token).getFlag('token-variants', 'defaultConfig') || [];
    else if (actor) {
      const tokenData = actor.data.token;
      if ('token-variants' in tokenData.flags && 'defaultConfig' in tokenData['token-variants'])
        configEntries = tokenData['token-variants']['defaultConfig'];
    }
    return expandObject(Object.fromEntries(configEntries));
  };

  const constructDefaultConfig = (origData, customConfig) => {
    return Object.entries(flattenObject(filterObject(origData, customConfig)));
  };

  let tokenUpdateObj = tokenUpdate;
  tokenUpdateObj.img = imgSrc;
  tokenUpdateObj['flags.token-variants.name'] = imgName;

  const tokenCustomConfig = getTokenConfigForUpdate(imgSrc, imgName);
  const usingCustomConfig =
    token &&
    (token.document ? token.document : token).getFlag('token-variants', 'usingCustomConfig');
  const defaultConfig = getDefaultConfig(token);

  if (tokenCustomConfig || usingCustomConfig) {
    tokenUpdateObj = mergeObject(tokenUpdateObj, defaultConfig);
  }

  if (tokenCustomConfig) {
    if (token) {
      tokenUpdateObj['flags.token-variants.usingCustomConfig'] = true;
      const tokenData = token.data instanceof Object ? token.data : token.data.toObject();
      const defConf = constructDefaultConfig(
        mergeObject(tokenData, defaultConfig),
        tokenCustomConfig
      );
      tokenUpdateObj['flags.token-variants.defaultConfig'] = defConf;
    } else if (actor && !token) {
      tokenUpdateObj['flags.token-variants.usingCustomConfig'] = true;
      const tokenData =
        actor.data.token instanceof Object ? actor.data.token : actor.data.token.toObject();
      const defConf = constructDefaultConfig(tokenData, tokenCustomConfig);
      tokenUpdateObj['flags.token-variants.defaultConfig'] = defConf;
    }

    tokenUpdateObj = mergeObject(tokenUpdateObj, tokenCustomConfig);
  } else if (usingCustomConfig) {
    if (token) {
      tokenUpdateObj['flags.token-variants.usingCustomConfig'] = true;
      delete tokenUpdateObj['flags.token-variants.defaultConfig'];
      tokenUpdateObj['flags.token-variants.-=defaultConfig'] = null;
    } else if (actor && !token) {
      tokenUpdateObj['flags.token-variants.usingCustomConfig'] = false;
      delete tokenUpdateObj['flags.token-variants.defaultConfig'];
      tokenUpdateObj['flags.token-variants.-=defaultConfig'] = null;
    }
  }

  if (actor && !token) {
    actorUpdate.token = tokenUpdateObj;
    if (pack) {
      queueActorUpdate(actor.id, actorUpdate, { pack: pack });
    } else {
      await (actor.document ?? actor).update(actorUpdate);
    }
  }

  if (token) {
    queueTokenUpdate(token.id, tokenUpdateObj, callback);
  }
}

/**
 * Assign new artwork to the actor
 */
export async function updateActorImage(actor, imgSrc, directUpdate = true, pack = '') {
  if (!actor) return;
  if (directUpdate) {
    await (actor.document ?? actor).update({
      img: imgSrc,
    });
  } else {
    queueActorUpdate(
      actor.id,
      {
        img: imgSrc,
      },
      pack ? { pack: pack } : null
    );
  }
}

/**
 * Checks if a key is pressed taking into account current game version.
 * @param {string} key v/Ctrl/Shift/Alt
 * @returns
 */
export function keyPressed(key) {
  if (isNewerVersion(game.version ?? game.data.version, '0.8.9')) {
    if (key === 'v') return game.keyboard.downKeys.has('KeyV');
    return PRESSED_KEYS[key];
  }

  if (key === 'popupOverride') key = TVA_CONFIG.actorDirectoryKey;
  else if (key === 'v') key = 'v';
  else if (key === 'config') key = 'Shift';
  return keyboard.isDown(key);
}

export function registerKeybinds() {
  if (!game.keybindings) return;
  game.keybindings.register('token-variants', 'popupOverride', {
    name: 'Popup Override',
    hint: 'When held will trigger popups even when they are disabled.',
    editable: [
      {
        key: 'ShiftLeft',
      },
    ],
    onDown: () => {
      PRESSED_KEYS.popupOverride = true;
    },
    onUp: () => {
      PRESSED_KEYS.popupOverride = false;
    },
    restricted: true,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
  });
  game.keybindings.register('token-variants', 'config', {
    name: 'Config',
    hint: 'When held during a mouse Left-Click of an Image or an Active Affect will display a configuration window.',
    editable: [
      {
        key: 'ShiftLeft',
      },
    ],
    onDown: () => {
      PRESSED_KEYS.config = true;
    },
    onUp: () => {
      PRESSED_KEYS.config = false;
    },
    restricted: true,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
  });
}

/**
 * Retrieves a custom token configuration if one exists for the given image
 */
export function getTokenConfig(imgSrc, imgName) {
  const tokenConfigs = (TVA_CONFIG.tokenConfigs || []).flat();
  return tokenConfigs.find((config) => config.tvImgSrc == imgSrc && config.tvImgName == imgName);
}

/**
 * Retrieves a custom token configuration if one exists for the given image and removes control keys
 * returning a clean config that can be used in token update.
 */
export function getTokenConfigForUpdate(imgSrc, imgName) {
  const tokenConfig = getTokenConfig(imgSrc, imgName);
  if (tokenConfig) {
    delete tokenConfig.tvImgSrc;
    delete tokenConfig.tvImgName;
    for (var key in tokenConfig) {
      if (key.startsWith('tvTab_')) {
        delete tokenConfig[key];
      }
    }
  }
  return tokenConfig;
}

/**
 * Adds or removes a custom token configuration
 */
export function setTokenConfig(imgSrc, imgName, tokenConfig) {
  const tokenConfigs = (TVA_CONFIG.tokenConfigs || []).flat();
  const tcIndex = tokenConfigs.findIndex(
    (config) => config.tvImgSrc == imgSrc && config.tvImgName == imgName
  );

  let deleteConfig = !tokenConfig || Object.keys(tokenConfig).length === 0;
  if (!deleteConfig) {
    tokenConfig['tvImgSrc'] = imgSrc;
    tokenConfig['tvImgName'] = imgName;
  }

  if (tcIndex != -1 && !deleteConfig) {
    tokenConfigs[tcIndex] = tokenConfig;
  } else if (tcIndex != -1 && deleteConfig) {
    tokenConfigs.splice(tcIndex, 1);
  } else if (!deleteConfig) {
    tokenConfigs.push(tokenConfig);
  }
  game.settings.set('token-variants', 'tokenConfigs', tokenConfigs);
  return !deleteConfig;
}

/**
 * Extracts the file name from the given path.
 */
export function getFileName(path) {
  return decodeURI(path).split('\\').pop().split('/').pop().split('.')[0];
}

/**
 * Extracts the file name including the extension from the given path.
 */
export function getFileNameWithExt(path) {
  return decodeURI(path).split('\\').pop().split('/').pop();
}

/**
 * Simplifies token and monster names.
 */
export function simplifyTokenName(tokenName) {
  return tokenName.replace(simplifyRegex, '').toLowerCase();
}

export function simplifyPath(path) {
  return decodeURIComponent(path).replace(simplifyRegex, '').toLowerCase();
}

async function _parseForgeAssetPaths() {
  const forgePaths = TVA_CONFIG.forgeSearchPaths || {};
  const userId = typeof ForgeAPI !== 'undefined' ? await ForgeAPI.getUserId() : '';
  const searchPaths = [];

  for (let uid in forgePaths) {
    if (uid === userId) {
      forgePaths[uid].paths.forEach((path) => {
        searchPaths.push(path);
      });
    } else if (forgePaths[uid].apiKey) {
      forgePaths[uid].paths.forEach((path) => {
        if (path.share) {
          path.apiKey = forgePaths[uid].apiKey;
          searchPaths.push(path);
        }
      });
    }
  }

  return searchPaths;
}

/**
 * Parses the searchPaths setting into a Map, distinguishing s3 buckets from local paths
 */
export async function parseSearchPaths() {
  if (TVA_CONFIG.debug) console.log('STARTING: Search Path Parse');

  const regexpBucket = /s3:(.*):(.*)/;
  const regexpForge = /(.*assets\.forge\-vtt\.com\/)(\w+)\/(.*)/;
  const FORGE_ASSETS_LIBRARY_URL_PREFIX = 'https://assets.forge-vtt.com/';

  const searchPathList = (TVA_CONFIG.searchPaths || []).flat();

  // To maintain compatibility with previous versions
  if (searchPathList.length > 0 && !(searchPathList[0] instanceof Object)) {
    searchPathList.forEach((path, i) => {
      searchPathList[i] = { text: path, cache: true };
    });
  }
  // end of compatibility code

  let searchPaths = new Map();
  searchPaths.set('data', []);
  searchPaths.set('s3', new Map());
  searchPaths.set('rolltable', []);
  searchPaths.set('imgur', []);

  let allForgePaths = [];

  for (const path of searchPathList) {
    if (path.text.startsWith('s3:')) {
      const match = path.text.match(regexpBucket);
      if (match[1]) {
        let bucket = match[1];
        let bPath = match[2];
        let buckets = searchPaths.get('s3');

        if (buckets.has(bucket)) {
          buckets.get(bucket).push({ text: bPath, cache: path.cache });
        } else {
          buckets.set(bucket, [{ text: bPath, cache: path.cache }]);
        }
      }
    } else if (path.text.startsWith('rolltable:')) {
      searchPaths.get('rolltable').push({ text: path.text.split(':')[1], cache: path.cache });
    } else if (path.text.startsWith('imgur:')) {
      searchPaths.get('imgur').push({ text: path.text.split(':')[1], cache: path.cache });
    } else if (
      path.text.startsWith('forgevtt:') ||
      path.text.startsWith(FORGE_ASSETS_LIBRARY_URL_PREFIX)
    ) {
      let url = '';
      if (path.text.startsWith(FORGE_ASSETS_LIBRARY_URL_PREFIX)) {
        url = path.text;
      } else if (typeof ForgeAPI !== 'undefined') {
        const status = ForgeAPI.lastStatus || (await ForgeAPI.status().catch(console.error)) || {};
        if (status.isAdmin) {
          url =
            FORGE_ASSETS_LIBRARY_URL_PREFIX +
            (await ForgeAPI.getUserId()) +
            '/' +
            path.text.split(':')[1];
        }
      }

      const match = url.match(regexpForge);
      if (match) {
        const userId = match[2];
        const fPath = match[3];
        if (typeof ForgeAPI !== 'undefined') {
          if (userId == (await ForgeAPI.getUserId())) {
            try {
              let files = await FilePicker.browse(
                'forgevtt',
                `${FORGE_ASSETS_LIBRARY_URL_PREFIX}${userId}/${fPath}`,
                { recursive: true }
              );
              files.dirs.push(fPath);
              allForgePaths = allForgePaths.concat(
                files.dirs.map((p) => {
                  if (!p.endsWith('/')) p += '/';
                  return {
                    text: `${FORGE_ASSETS_LIBRARY_URL_PREFIX}${userId}/${p}*`,
                    cache: path.cache,
                  };
                })
              );
            } catch (err) {
              console.log(err);
            }
          } else {
            if (!url.endsWith('/')) url += '/';
            allForgePaths.push({ text: url + '*', cache: path.cache });
          }
        }
      }
    } else {
      searchPaths.get('data').push({ text: path.text, cache: path.cache });
    }
  }

  let forgePathsSetting = (TVA_CONFIG.forgevttPaths || []).flat();

  // To maintain compatibility with previous versions
  if (forgePathsSetting.length > 0 && !(forgePathsSetting[0] instanceof Object)) {
    forgePathsSetting.forEach((path, i) => {
      forgePathsSetting[i] = { text: path, cache: true };
    });
  }
  // end of compatibility code

  let uniqueForgePaths = new Set();
  forgePathsSetting.forEach((path) => {
    uniqueForgePaths.add(path.text);
  });
  allForgePaths.forEach((path) => {
    if (!uniqueForgePaths.has(path.text)) {
      forgePathsSetting.push(path);
    }
  });

  searchPaths.set('forge', forgePathsSetting);
  if (game.user.can('SETTINGS_MODIFY'))
    game.settings.set('token-variants', 'forgevttPaths', forgePathsSetting);

  searchPaths.set('forgevtt', await _parseForgeAssetPaths());

  if (TVA_CONFIG.debug) console.log('ENDING: Search Path Parse', searchPaths);

  return searchPaths;
}

/**
 * Parses the 'excludedKeyword' setting (a comma separated string) into a Set
 */
export function parseKeywords(keywords) {
  return keywords
    .split(/\W/)
    .map((word) => simplifyTokenName(word))
    .filter((word) => word != '');
}

/**
 * Returns true of provided path points to an image
 */
export function isImage(path) {
  var extension = path.split('.');
  extension = extension[extension.length - 1];
  return ['jpg', 'jpeg', 'png', 'svg', 'webp', 'gif'].includes(extension);
}

/**
 * Returns true of provided path points to a video
 */
export function isVideo(path) {
  var extension = path.split('.');
  extension = extension[extension.length - 1];
  return ['webm', 'mp4', 'm4v'].includes(extension);
}

/**
 * Send a recursive HTTP asset browse request to ForgeVTT
 * @param {string} path Asset Library path
 * @param {string} apiKey Key with read access to the Asset Library
 * @returns
 */
export async function callForgeVTT(path, apiKey) {
  return new Promise(async (resolve, reject) => {
    if (typeof ForgeVTT === 'undefined' || !ForgeVTT.usingTheForge) return resolve({});

    const url = `${ForgeVTT.FORGE_URL}/api/assets/browse`;
    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;
    xhr.open('POST', url);
    xhr.setRequestHeader('Access-Key', apiKey);
    xhr.setRequestHeader('X-XSRF-TOKEN', await ForgeAPI.getXSRFToken());
    xhr.responseType = 'json';

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      resolve(xhr.response);
    };
    xhr.onerror = (err) => {
      resolve({ code: 500, error: err.message });
    };
    let formData = {
      path: path,
      options: {
        recursive: true,
      },
    };
    formData = JSON.stringify(formData);
    xhr.setRequestHeader('Content-type', 'application/json; charset=utf-8');
    xhr.send(formData);
  });
}

/**
 * Retrieves filters based on the type of search.
 * @param {SEARCH_TYPE} searchType
 */
export function getFilters(searchType) {
  // Select filters based on type of search
  let filters = TVA_CONFIG.searchFilters;
  switch (searchType) {
    case SEARCH_TYPE.BOTH:
      filters = {
        include: filters.generalFilterInclude,
        exclude: filters.generalFilterExclude,
        regex: filters.generalFilterRegex,
      };
      break;
    case SEARCH_TYPE.PORTRAIT:
      filters = {
        include: filters.portraitFilterInclude,
        exclude: filters.portraitFilterExclude,
        regex: filters.portraitFilterRegex,
      };
      break;
    case SEARCH_TYPE.TOKEN:
      filters = {
        include: filters.tokenFilterInclude,
        exclude: filters.tokenFilterExclude,
        regex: filters.tokenFilterRegex,
      };
      break;
    default:
      filters = {
        include: '',
        exclude: '',
        regex: '',
      };
  }
  if (filters.regex) filters.regex = new RegExp(filters.regex);
  return filters;
}

export function userRequiresImageCache(perm) {
  const permissions = perm ? perm : TVA_CONFIG.permissions;
  const role = game.user.role;
  return (
    permissions.popups[role] ||
    permissions.portrait_right_click[role] ||
    permissions.image_path_button[role] ||
    permissions.hudFullAccess[role]
  );
}

/**
 * Overwrite Token image on the client side if 'userMappings' flag has been set.
 * @param {*} token Token to overwrite the image for
 * @param {*} checks Number of checks/recursive calls to wait for the previous draw() operation to end
 * @returns
 */
export async function checkAndDisplayUserSpecificImage(token, forceDraw = false, checks = 40) {
  if (!token.document) {
    token = canvas.tokens.get(token.id);
  }

  const mappings = token.document.getFlag('token-variants', 'userMappings') || {};
  const img = mappings[game.userId];
  if (img && img !== token.data.img) {
    // This function may be called while the Token is in the middle of loading it's textures.
    // Attempting to perform a draw() call then would result in multiple overlapped images.
    // We should wait for the texture to be loaded and change the image after. As a failsafe
    // give up after a certain number of checks.
    if (!token.icon.texture) {
      checks--;
      if (checks > 1)
        new Promise((resolve) => setTimeout(resolve, 1)).then(() =>
          checkAndDisplayUserSpecificImage(token, forceDraw, checks)
        );
      return;
    }

    // Change the image on the client side, without actually updating the token
    token.data.img = img;
    token.document.data.img = img;

    const visible = token.visible;
    const hadActiveHud = token.hasActiveHUD;

    await token.draw();
    token.visible = visible;
    if (hadActiveHud) canvas.tokens.hud.bind(token);
  } else if (forceDraw && token.icon.texture) {
    const visible = token.visible;
    const hadActiveHud = token.hasActiveHUD;

    await token.draw();
    token.visible = visible;
    if (hadActiveHud) canvas.tokens.hud.bind(token);
  }
}

export function flattenSearchResults(results) {
  let flattened = [];
  if (!results) return flattened;
  results.forEach((images) => {
    flattened = flattened.concat(images);
  });
  return flattened;
}
