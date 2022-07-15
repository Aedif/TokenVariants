import { TVA_CONFIG, updateSettings, _arrayAwareDiffObject } from './settings.js';
import { showArtSelect } from '../token-variants.mjs';
import ActiveEffectConfigList from '../applications/activeEffectConfigList.js';

const simplifyRegex = new RegExp(/[^A-Za-z0-9/\\]/g);

// Types of searches
export const SEARCH_TYPE = {
  PORTRAIT: 'Portrait',
  TOKEN: 'Token',
  PORTRAIT_AND_TOKEN: 'PortraitAndToken',
  TILE: 'Tile',
  ITEM: 'Item',
  JOURNAL: 'JournalEntry',
};

export const BASE_IMAGE_CATEGORIES = [
  'Portrait',
  'Token',
  'PortraitAndToken',
  'Tile',
  'Item',
  'JournalEntry',
  'Macro',
  'RollTable',
];

export const PRESSED_KEYS = {
  popupOverride: false,
  config: false,
};

const BATCH_UPDATES = {
  TOKEN: [],
  TOKEN_CALLBACKS: [],
  ACTOR: [],
  ACTOR_CONTEXT: null,
};

export function startBatchUpdater() {
  canvas.app.ticker.add(() => {
    if (BATCH_UPDATES.TOKEN.length) {
      canvas.scene.updateEmbeddedDocuments('Token', BATCH_UPDATES.TOKEN).then(() => {
        for (const cb of BATCH_UPDATES.TOKEN_CALLBACKS) {
          cb();
        }
        BATCH_UPDATES.TOKEN_CALLBACKS = [];
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
  if (callback) BATCH_UPDATES.TOKEN_CALLBACKS.push(callback);
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
 * @param {object} [options.config] Token Configuration settings to be applied to the token
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
    config = undefined,
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
    const flatOrigData = flattenObject(origData);
    const flatCustomConfig = flattenObject(customConfig);
    let filtered = filterObject(flatOrigData, flatCustomConfig);

    // Flags need special treatment as once set they are not removed via absence of them in the update
    for (let [k, v] of Object.entries(flatCustomConfig)) {
      if (k.startsWith('flags.')) {
        if (!(k in flatOrigData)) {
          let splitK = k.split('.');
          splitK[splitK.length - 1] = '-=' + splitK[splitK.length - 1];
          filtered[splitK.join('.')] = null;
        }
      }
    }

    return Object.entries(filtered);
  };

  let tokenUpdateObj = tokenUpdate;
  if (imgSrc) {
    tokenUpdateObj.img = imgSrc;
    tokenUpdateObj['flags.token-variants.name'] = imgName;
  }

  const tokenCustomConfig = config || getTokenConfigForUpdate(imgSrc, imgName);
  const usingCustomConfig =
    token &&
    (token.document ? token.document : token).getFlag('token-variants', 'usingCustomConfig');
  const defaultConfig = getDefaultConfig(token);
  if (tokenCustomConfig || usingCustomConfig) {
    tokenUpdateObj = modMergeObject(tokenUpdateObj, defaultConfig);
  }

  if (tokenCustomConfig) {
    if (token) {
      tokenUpdateObj['flags.token-variants.usingCustomConfig'] = true;
      const tokenData = token.data.toObject ? token.data.toObject() : deepClone(token.data);
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

    tokenUpdateObj = modMergeObject(tokenUpdateObj, tokenCustomConfig);
  } else if (usingCustomConfig) {
    tokenUpdateObj['flags.token-variants.usingCustomConfig'] = false;
    delete tokenUpdateObj['flags.token-variants.defaultConfig'];
    tokenUpdateObj['flags.token-variants.-=defaultConfig'] = null;
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

async function showTileArtSelect() {
  for (const tileLayer of [canvas.background.controlled, canvas.foreground.controlled]) {
    for (const tile of tileLayer) {
      const tileName = tile.document.getFlag('token-variants', 'tileName') || tile.id;
      showArtSelect(tileName, {
        callback: async function (imgSrc, name) {
          tile.document.update({ img: imgSrc });
        },
        searchType: SEARCH_TYPE.TILE,
      });
    }
  }
}

/**
 * Checks if a key is pressed taking into account current game version.
 * @param {string} key v/Ctrl/Shift/Alt
 * @returns
 */
export function keyPressed(key) {
  if (key === 'v') return game.keyboard.downKeys.has('KeyV');
  return PRESSED_KEYS[key];
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
    restricted: false,
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
    restricted: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
  });
  game.keybindings.register('token-variants', 'showArtSelectPortrait', {
    name: 'Show Art Select: Portrait',
    hint: 'Brings up an Art Select pop-up to change the portrait images of the selected tokens.',
    editable: [
      {
        key: 'Digit1',
        modifiers: ['Shift'],
      },
    ],
    onDown: () => {
      for (const token of canvas.tokens.controlled) {
        const actor = game.actors.get(token.data.actorId);
        if (!actor) continue;
        showArtSelect(actor.data.name, {
          callback: async function (imgSrc, name) {
            await updateActorImage(actor, imgSrc);
          },
          searchType: SEARCH_TYPE.PORTRAIT,
          object: actor,
        });
      }
      if (TVA_CONFIG.tilesEnabled && canvas.tokens.controlled.length === 0) showTileArtSelect();
    },
    restricted: true,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
  });
  game.keybindings.register('token-variants', 'showArtSelectToken', {
    name: 'Show Art Select: Token',
    hint: 'Brings up an Art Select pop-up to change the token images of the selected tokens.',
    editable: [
      {
        key: 'Digit2',
        modifiers: ['Shift'],
      },
    ],
    onDown: () => {
      for (const token of canvas.tokens.controlled) {
        showArtSelect(token.data.name, {
          callback: async function (imgSrc, imgName) {
            updateTokenImage(imgSrc, {
              actor: token.actor,
              imgName: imgName,
              token: token,
            });
          },
          searchType: SEARCH_TYPE.TOKEN,
          object: token,
        });
      }
      if (TVA_CONFIG.tilesEnabled && canvas.tokens.controlled.length === 0) showTileArtSelect();
    },
    restricted: true,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
  });
  game.keybindings.register('token-variants', 'showArtSelectGeneral', {
    name: 'Show Art Select: Portrait+Token',
    hint: 'Brings up an Art Select pop-up to change both Portrait and Token images of the selected tokens.',
    editable: [
      {
        key: 'Digit3',
        modifiers: ['Shift'],
      },
    ],
    onDown: () => {
      for (const token of canvas.tokens.controlled) {
        const actor = game.actors.get(token.data.actorId);
        showArtSelect(token.data.name, {
          callback: async function (imgSrc, imgName) {
            if (actor) await updateActorImage(actor, imgSrc);
            updateTokenImage(imgSrc, {
              actor: token.actor,
              imgName: imgName,
              token: token,
            });
          },
          searchType: SEARCH_TYPE.PORTRAIT_AND_TOKEN,
          object: token,
        });
      }
      if (TVA_CONFIG.tilesEnabled && canvas.tokens.controlled.length === 0) showTileArtSelect();
    },
    restricted: true,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
  });
  game.keybindings.register('token-variants', 'openGlobalMappings', {
    name: 'Open Global Effect Configurations',
    hint: 'Brings up the settings window for Global Effect Configurations',
    editable: [
      {
        key: 'KeyC',
        modifiers: ['Shift'],
      },
    ],
    onDown: () => {
      const setting = game.settings.get('core', DefaultTokenConfig.SETTING);
      const data = new foundry.data.TokenData(setting);
      const token = new TokenDocument(data, { actor: null });
      new ActiveEffectConfigList(token, true).render(true);
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
    const config = deepClone(tokenConfig);
    delete config.tvImgSrc;
    delete config.tvImgName;
    for (var key in config) {
      if (key.startsWith('tvTab_')) {
        delete config[key];
      }
    }
    return config;
  }
  return undefined;
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
  updateSettings({ tokenConfigs: tokenConfigs });
  return !deleteConfig;
}

/**
 * Extracts the file name from the given path.
 */
export function getFileName(path) {
  if (!path) return '';
  return decodeURI(path).split('\\').pop().split('/').pop().split('.')[0];
}

/**
 * Extracts the file name including the extension from the given path.
 */
export function getFileNameWithExt(path) {
  if (!path) return '';
  return decodeURI(path).split('\\').pop().split('/').pop();
}

/**
 * Extract the directory path excluding the file name.
 */
export function getFilePath(path) {
  return decodeURI(path).match(/(.*)[\/\\]/)[1] || '';
}

/**
 * Simplify name.
 */
export function simplifyName(name) {
  return name.replace(simplifyRegex, '').toLowerCase();
}

export function simplifyPath(path) {
  return decodeURIComponent(path).replace(simplifyRegex, '').toLowerCase();
}

/**
 * Parses the 'excludedKeyword' setting (a comma separated string) into a Set
 */
export function parseKeywords(keywords) {
  return keywords
    .split(/\W/)
    .map((word) => simplifyName(word))
    .filter((word) => word != '');
}

/**
 * Returns true of provided path points to an image
 */
export function isImage(path) {
  var extension = path.split('.');
  extension = extension[extension.length - 1].toLowerCase();
  return ['jpg', 'jpeg', 'png', 'svg', 'webp', 'gif'].includes(extension);
}

/**
 * Returns true of provided path points to a video
 */
export function isVideo(path) {
  var extension = path.split('.');
  extension = extension[extension.length - 1].toLowerCase();
  return ['mp4', 'ogg', 'webm', 'm4v'].includes(extension);
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
export function getFilters(searchType, filters) {
  // Select filters based on type of search
  filters = filters ? filters : TVA_CONFIG.searchFilters;

  if (filters[searchType]) {
    filters = filters[searchType];
  } else {
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

async function _drawIcon(token) {
  let icon = new PIXI.Sprite(token.texture);
  icon.anchor.set(0.5, 0.5);
  if (!token.texture) return icon;
  icon.tint = token.data.tint ? foundry.utils.colorStringToHex(token.data.tint) : 0xffffff;
  icon.visible = false;
  return icon;
}

async function _overrideIcon(token, img) {
  token.texture = await loadTexture(img, { fallback: CONST.DEFAULT_TOKEN });
  token.removeChild(token.icon);
  token.icon = token.addChild(await _drawIcon(token));
  token.tva_iconOverride = img;
  token._refreshIcon();
  reDrawEffectOverlays(token);
}

export async function waitForTexture(token, callback, checks = 40) {
  if (!token.icon || !token.icon.texture) {
    checks--;
    if (checks > 1)
      new Promise((resolve) => setTimeout(resolve, 1)).then(() =>
        waitForTexture(token, callback, checks)
      );
    return;
  }
  callback();
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
    if (!token.icon || !token.icon.texture) {
      checks--;
      if (checks > 1)
        new Promise((resolve) => setTimeout(resolve, 1)).then(() =>
          checkAndDisplayUserSpecificImage(token, forceDraw, checks)
        );
      return;
    }

    // Change the image on the client side, without actually updating the token
    _overrideIcon(token, img);
  } else if (img) {
  } else if (token.tva_iconOverride) {
    await _overrideIcon(token, token.data.img);
    delete token.tva_iconOverride;
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

// Slightly modified version of mergeObject; added an option to ignore -= keys
export function modMergeObject(
  original,
  other = {},
  {
    insertKeys = true,
    insertValues = true,
    overwrite = true,
    recursive = true,
    inplace = true,
    enforceTypes = false,
  } = {},
  _d = 0
) {
  other = other || {};
  if (!(original instanceof Object) || !(other instanceof Object)) {
    throw new Error('One of original or other are not Objects!');
  }
  const options = {
    insertKeys,
    insertValues,
    overwrite,
    recursive,
    inplace,
    enforceTypes,
  };

  // Special handling at depth 0
  if (_d === 0) {
    if (!inplace) original = deepClone(original);
    if (Object.keys(original).some((k) => /\./.test(k))) original = expandObject(original);
    if (Object.keys(other).some((k) => /\./.test(k))) other = expandObject(other);
  }

  // Iterate over the other object
  for (let k of Object.keys(other)) {
    const v = other[k];
    if (original.hasOwnProperty('-=' + k)) {
      original[k] = original['-=' + k];
      delete original['-=' + k];
    }
    if (original.hasOwnProperty(k)) _modMergeUpdate(original, k, v, options, _d + 1);
    else _modMergeInsert(original, k, v, options, _d + 1);
  }
  return original;
}

/**
 * A helper function for merging objects when the target key does not exist in the original
 * @private
 */
function _modMergeInsert(original, k, v, { insertKeys, insertValues } = {}, _d) {
  // Recursively create simple objects
  if (v?.constructor === Object) {
    original[k] = modMergeObject({}, v, {
      insertKeys: true,
      inplace: true,
    });
    return;
  }

  // Delete a key
  // if (k.startsWith('-=')) {
  //   delete original[k.slice(2)];
  //   return;
  // }

  // Insert a key
  const canInsert = (_d <= 1 && insertKeys) || (_d > 1 && insertValues);
  if (canInsert) original[k] = v;
}

/**
 * A helper function for merging objects when the target key exists in the original
 * @private
 */
function _modMergeUpdate(
  original,
  k,
  v,
  { insertKeys, insertValues, enforceTypes, overwrite, recursive } = {},
  _d
) {
  const x = original[k];
  const tv = getType(v);
  const tx = getType(x);

  // Recursively merge an inner object
  if (tv === 'Object' && tx === 'Object' && recursive) {
    return modMergeObject(
      x,
      v,
      {
        insertKeys: insertKeys,
        insertValues: insertValues,
        overwrite: overwrite,
        inplace: true,
        enforceTypes: enforceTypes,
      },
      _d
    );
  }

  // Overwrite an existing value
  if (overwrite) {
    if (tx !== 'undefined' && tv !== tx && enforceTypes) {
      throw new Error(`Mismatched data types encountered during object merge.`);
    }
    original[k] = v;
  }
}

export function tv_executeScript(script, { actor, token } = {}) {
  // Add variables to the evaluation scope
  const speaker = ChatMessage.getSpeaker();
  const character = game.user.character;
  actor = actor || game.actors.get(speaker.actor);
  token = token || (canvas.ready ? canvas.tokens.get(speaker.token) : null);

  // Attempt script execution
  const body = `(async () => {${script}})()`;
  const fn = Function('speaker', 'actor', 'token', 'character', body);
  try {
    fn.call(null, speaker, actor, token, character);
  } catch (err) {
    ui.notifications.error(
      `There was an error in your script syntax. See the console (F12) for details`
    );
    console.error(err);
  }
}

export function tva_testInBrightVision(point, { tolerance = 2, object = null }) {
  const visionSources = canvas.sight.sources;
  const lightSources = canvas.lighting.sources;
  const d = canvas.dimensions;
  if (!visionSources.size) return game.user.isGM;

  // Determine the array of offset points to test
  const t = tolerance;
  const offsets =
    t > 0
      ? [
          [0, 0],
          [-t, -t],
          [-t, t],
          [t, t],
          [t, -t],
          [-t, 0],
          [t, 0],
          [0, -t],
          [0, t],
        ]
      : [[0, 0]];
  const points = offsets.map((o) => new PIXI.Point(point.x + o[0], point.y + o[1]));

  // If the point is entirely inside the buffer region, it may be hidden from view
  if (!canvas.sight._inBuffer && !points.some((p) => d.sceneRect.contains(p.x, p.y))) return false;

  // Check each point for one which provides both LOS and FOV membership
  return points.some((p) => {
    let hasLOS = false;
    let hasFOV = false;
    let requireFOV = !canvas.lighting.globalLight;

    // Check vision sources
    for (let source of visionSources.values()) {
      if (!source.active) continue; // The source may be currently inactive
      if (!hasLOS || (!hasFOV && requireFOV)) {
        // console.log(source);
        // Do we need to test for LOS?
        if (source.los.contains(p.x, p.y)) {
          hasLOS = true;
          if (!hasFOV && requireFOV) {
            // Do we need to test for FOV?
            if (source.fov.contains(p.x, p.y)) {
              // console.log(source);
              // console.log('test IN normal FOV');
            }
            const origRadius = source.fov.radius;
            source.fov.radius = source.data.bright;
            if (source.fov.contains(p.x, p.y)) {
              // console.log('test IN FOV');
              hasFOV = true;
            }

            source.fov.radius = origRadius;
          }
        }
      }
      if (hasLOS && (!requireFOV || hasFOV)) {
        // Did we satisfy all required conditions?
        return true;
      }
    }

    // Check light sources
    for (let source of lightSources.values()) {
      if (!source.active) continue; // The source may be currently inactive
      if (source.containsPoint(p)) {
        if (source.data.vision) hasLOS = true;
        hasFOV = true;
      }
      if (hasLOS && (!requireFOV || hasFOV)) {
        return true;
      }
    }
    return false;
  });
}

export async function drawEffectOverlay(token, img) {
  if (typeof img !== 'object') {
    img = { img: img };
  }

  const conf = {
    alpha: 1,
    scaleX: 0,
    scaleY: 0,
    offsetX: 0,
    offsetY: 0,
    filter: 'NONE',
    inheritTint: false,
    tint: null,
    loop: true,
  };
  mergeObject(conf, img);

  const texture = await loadTexture(conf.img, {
    fallback: 'modules/token-variants/img/token-images.svg',
  });

  // Create Sprite using the loaded texture
  let icon = new PIXI.Sprite(texture);
  icon.anchor.set(0.5 + conf.offsetX, 0.5 + conf.offsetY);
  icon.alpha = conf.alpha;
  let filter = PIXI.filters[conf.filter];
  if (filter) {
    icon.filters = [new filter()];
  }

  // Adjust the scale to be relative to the token image so that when it gets attached
  // as a child of the token image and inherits its scale, their sizes match up
  icon.scale.x = token.texture.width / texture.width + conf.scaleX;
  icon.scale.y = token.texture.height / texture.height + conf.scaleY;

  // Ensure playback state for video tokens
  const source = foundry.utils.getProperty(texture, 'baseTexture.resource.source');
  if (source && source.tagName === 'VIDEO') {
    // const s = source;
    const s = source.cloneNode();
    s.loop = conf.loop;
    s.muted = true;

    s.onplay = () => (s.currentTime = 0);
    await new Promise((resolve) => (s.oncanplay = resolve));
    icon.texture = PIXI.Texture.from(s, { resourceOptions: { autoPlay: false } });

    // s.currentTime = 0;

    game.video.play(s);
  }

  // Apply color tinting
  const tint = conf.inheritTint ? token.data.tint : conf.tint;
  icon.tint = tint ? foundry.utils.colorStringToHex(tint) : 0xffffff;
  return icon;
}

export async function reDrawEffectOverlays(token) {
  let overlays;
  if (token.data.actorLink && token.actor) {
    overlays = token.actor.getFlag('token-variants', 'overlays');
  } else {
    overlays = (token.document ?? token).getFlag('token-variants', 'overlays');
  }

  if (overlays) {
    waitForTexture(token, async () => {
      const overlayIcons = [];
      if (!token.tva_overlays) token.tva_overlays = [];
      const removedChildren = [];
      for (const overlay of token.tva_overlays) {
        const removed = token.icon.removeChild(overlay);
        if (removed) removedChildren.push(overlay);
      }
      for (const ov of overlays) {
        // Check if overlay is already drawn
        if (ov.effect) {
          let found;
          for (const c of removedChildren) {
            if (ov.effect === c.tva_overlay?.effect) {
              let icon;
              console.log('comparing', c.tva_overlay, ov);
              if (isObjectEmpty(diffObject(c.tva_overlay, ov))) {
                console.log('Found not redrawing', c, ov);
                icon = token.icon.addChild(c);
              } else {
                icon = token.icon.addChild(await drawEffectOverlay(token, ov));
              }
              icon.tva_overlay = ov;
              overlayIcons.push(icon);
              found = true;
              break;
            }
          }

          if (!found) {
            const icon = token.icon.addChild(await drawEffectOverlay(token, ov));
            icon.tva_overlay = ov;
            overlayIcons.push(icon);
          }
        } else {
          overlayIcons.push(token.icon.addChild(await drawEffectOverlay(token, ov)));
        }
      }
      if (overlayIcons.length) token.tva_overlays = overlayIcons;
      else delete token.tva_overlays;
    });
  } else if (token.tva_overlays) {
    for (const ol of token.tva_overlays) token.icon.removeChild(ol.icon);
    delete token.tva_overlays;
  }
  // Temporarily disabled
  // if (token.tva_dim && token.actor) {
  //   const dimMapping = ((token.actor.document ?? token.actor).getFlag(
  //     'token-variants',
  //     'effectMappings'
  //   ) || {})['token-variants-dim'];
  //   if (dimMapping && dimMapping.imgSrc) {
  //     if (dimMapping.overlay)
  //       overlays.push(token.icon.addChild(await drawEffectOverlay(token, dimMapping.imgSrc)));
  //     else await _overrideIcon(token, dimMapping.imgSrc);
  //   }
  // }
}

//
export function inDimLight(token) {
  const gm = game.user.isGM;
  if (token.data.hidden && gm) return false;
  if (!canvas.sight.tokenVision) return false;
  if (token._controlled) return false;
  if (canvas.sight.sources.has(token.sourceId)) return false;

  // This is where we want to do some work. The token is visible due to a visibility test
  // We want to perform our own to determine if the token is in dim or bright light.

  const tolerance = Math.min(token.w, token.h) / 4;
  return !tva_testInBrightVision(token.center, { tolerance, object: token });
}

export async function setEffectMappingsFlag(actor, mappings) {
  const currentMappings = actor.getFlag('token-variants', 'effectMappings');
  if (!currentMappings) {
    actor.setFlag('token-variants', 'effectMappings', mappings);
  } else {
    const keys = Object.keys(currentMappings);
    for (const key of keys) {
      if (!(key in mappings)) {
        mappings['-=' + key] = null;
      }
    }
    actor.update({ flags: { 'token-variants': { effectMappings: mappings } } });
  }
}

// Helper function to display a pop-up and change the categories assigned to a path
export async function onPathSelectCategory(event) {
  event.preventDefault();
  const typesInput = $(event.target).closest('.path-category').find('input');
  const selectedTypes = typesInput.val().split(',');

  const categories = BASE_IMAGE_CATEGORIES.concat(TVA_CONFIG.customImageCategories);

  let content = '<div class="token-variants-popup-settings">';

  // Split into rows of 4
  const splits = [];
  let currSplit = [];
  for (let i = 0; i < categories.length; i++) {
    if (i > 0 && i + 1 != categories.length && i % 4 == 0) {
      splits.push(currSplit);
      currSplit = [];
    }
    currSplit.push(categories[i]);
  }
  if (currSplit.length) splits.push(currSplit);

  for (const split of splits) {
    content += '<header class="table-header flexrow">';
    for (const type of split) {
      content += `<label>${type}</label>`;
    }
    content +=
      '</header><ul class="setting-list"><li class="setting form-group"><div class="form-fields">';
    for (const type of split) {
      content += `<input class="category" type="checkbox" name="${type}" data-dtype="Boolean" ${
        selectedTypes.includes(type) ? 'checked' : ''
      }>`;
    }
    content += '</div></li></ul>';
  }
  content += '</div>';

  new Dialog({
    title: `Image Categories/Filters`,
    content: content,
    buttons: {
      yes: {
        icon: "<i class='fas fa-check'></i>",
        label: 'Select',
        callback: (html) => {
          const types = [];
          $(html)
            .find('.category')
            .each(function () {
              if ($(this).is(':checked')) {
                types.push($(this).attr('name'));
              }
            });
          typesInput.val(types.join(','));
        },
      },
    },
    default: 'yes',
  }).render(true);
}
