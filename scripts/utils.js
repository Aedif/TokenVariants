import { TVA_CONFIG, updateSettings, _arrayAwareDiffObject } from './settings.js';
import { showArtSelect } from '../token-variants.mjs';
import ActiveEffectConfigList from '../applications/activeEffectConfigList.js';
import { TVA_Sprite } from '../applications/TVA_Sprite.js';
import { emptyObject, getData } from './compatibility.js';

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
      const tokenData = getData(token).toObject
        ? getData(token).toObject()
        : deepClone(getData(token));

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

    // Fix, an empty flag may be passed which would overwrite any current flags in the updateObj
    // Remove it before doing the merge
    if (!tokenCustomConfig.flags) {
      delete tokenCustomConfig.flags;
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
    if (TVA_CONFIG.updateTokenProto && token.actor) {
      // Timeout to prevent race conditions with other modules namely MidiQOL
      // this is a low priority update so it should be Ok to do
      setTimeout(() => queueActorUpdate(token.actor.id, { token: tokenUpdateObj }), 500);
    }
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
  return decodeURI(path).split('\\').pop().split('/').pop().split('.').slice(0, -1).join('.');
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
  drawOverlays(token);
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
  callback(token);
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

async function _drawEffectOverlay(token, conf) {
  const texture = await loadTexture(conf.img, {
    fallback: 'modules/token-variants/img/token-images.svg',
  });
  const sprite = new TVA_Sprite(texture, token, conf);
  return sprite;
}

export async function drawOverlays(token) {
  if (token.tva_drawing_overlays) return;
  token.tva_drawing_overlays = true;

  const mappings = mergeObject(
    TVA_CONFIG.globalMappings,
    token.actor ? token.actor.getFlag('token-variants', 'effectMappings') : {},
    { inplace: false, recursive: false }
  );

  let filteredOverlays = getTokenEffects(token)
    .filter((ef) => ef in mappings && mappings[ef].overlay)
    .sort((ef1, ef2) => mappings[ef1].priority - mappings[ef2].priority)
    .map((ef) => {
      const overlayConfig = mappings[ef].overlayConfig ?? {};
      overlayConfig.img = mappings[ef].imgSrc;
      overlayConfig.effect = ef;
      return overlayConfig;
    });

  // See if the whole stack or just top of the stack should be used according to settings
  let overlays = [];
  if (filteredOverlays.length) {
    overlays = TVA_CONFIG.stackStatusConfig
      ? filteredOverlays
      : [filteredOverlays[filteredOverlays.length - 1]];
  }

  if (overlays.length) {
    waitForTexture(token, async (token) => {
      // Temporarily mark every overlay for removal.
      // We'll only keep overlays that are still applicable to the token
      markAllOverlaysForRemoval(token);

      // To keep track of the overlay order
      // We're starting at 100 to make sure there is room for underlays
      let zIndex = 100;
      for (const ov of overlays) {
        let sprite = findTVASprite(ov.effect, token);
        if (sprite) {
          if (!emptyObject(diffObject(sprite.tvaOverlayConfig, ov))) {
            if (sprite.tvaOverlayConfig.img !== ov.img) {
              token.removeChild(sprite);
              sprite = token.addChild(await _drawEffectOverlay(token, ov));
            } else {
              sprite.refresh(ov);
            }
          }
        } else {
          sprite = token.addChild(await _drawEffectOverlay(token, ov));
        }
        sprite.tvaRemove = false; // Sprite in use, do not remove

        // Assign order to the overlay
        if (sprite.tvaOverlayConfig.underlay) {
          sprite.zIndex = zIndex - 100;
          // Make sure the token icon is always above the underlays
          token.icon.zIndex = sprite.zIndex + 1;
        } else {
          sprite.zIndex = zIndex;
        }
        zIndex += 1;
      }

      removeMarkedOverlays(token);
      token.sortChildren();
      token.tva_drawing_overlays = false;
    });
  } else {
    removeAllOverlays(token);
    token.tva_drawing_overlays = false;
  }
}

function markAllOverlaysForRemoval(token) {
  for (const child of token.children) {
    if (child instanceof TVA_Sprite) {
      child.tvaRemove = true;
    }
  }
}

function removeMarkedOverlays(token) {
  for (const child of token.children) {
    if (child.tvaRemove) {
      token.removeChild(child)?.destroy();
    }
  }
}

function findTVASprite(effect, token) {
  for (const child of token.children) {
    if (child.tvaOverlayConfig?.effect === effect) {
      return child;
    }
  }
  return null;
}

function removeAllOverlays(token) {
  const toRemove = [];
  for (const child of token.children) {
    if (child instanceof TVA_Sprite) {
      toRemove.push(child);
    }
  }
  for (const child of toRemove) {
    token.removeChild(child)?.destroy();
  }
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

export async function setGlobalEffectMappings(mappings) {
  if (!mappings) {
    for (const k of Object.keys(TVA_CONFIG.globalMappings)) {
      delete TVA_CONFIG.globalMappings[k];
    }
    return;
  }

  const keys = Object.keys(TVA_CONFIG.globalMappings);
  for (const key of keys) {
    if (!(key in mappings)) {
      delete TVA_CONFIG.globalMappings[key];
    }
  }
  mergeObject(TVA_CONFIG.globalMappings, mappings);
}

export function getEffectsFromActor(actor) {
  let effects = [];
  if (!actor) return effects;

  if (game.system.id === 'pf2e') {
    (actor.data.items || []).forEach((item, id) => {
      if (item.type === 'condition' && item.isActive) effects.push(item.name);
    });
  } else {
    (getData(actor).effects || []).forEach((activeEffect, id) => {
      if (!getData(activeEffect).disabled && !activeEffect.isSuppressed)
        effects.push(getData(activeEffect).label);
    });
  }

  return effects;
}

export function getTokenEffects(token) {
  if (game.system.id === 'pf2e') {
    if (getData(token).actorLink) {
      return getEffectsFromActor(token.actor);
    } else {
      return (getData(token).actorData?.items || [])
        .filter((item) => item.type === 'condition')
        .map((item) => item.name);
    }
  } else {
    if (getData(token).actorLink && token.actor) {
      return getEffectsFromActor(token.actor);
    } else {
      const actorEffects = getEffectsFromActor(token.actor);
      return (getData(token).effects || [])
        .filter((ef) => !ef.disabled && !ef.isSuppressed)
        .map((ef) => ef.label)
        .concat(actorEffects);
    }
  }
}
