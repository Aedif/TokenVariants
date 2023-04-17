import { TVA_CONFIG, updateSettings, _arrayAwareDiffObject } from './settings.js';
import { showArtSelect } from '../token-variants.mjs';
import ActiveEffectConfigList from '../applications/activeEffectConfigList.js';
import { TVASprite } from './sprite/TVASprite.js';
import CompendiumMapConfig from '../applications/compendiumMap.js';

const simplifyRegex = new RegExp(/[^A-Za-z0-9/\\]/g);

export const SUPPORTED_COMP_ATTRIBUTES = ['rotation', 'elevation'];
export const EXPRESSION_OPERATORS = ['\\(', '\\)', '&&', '||', '\\!'];
export const FAUX_DOT = '¶';

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
  TOKEN_CONTEXT: { animate: true },
  ACTOR: [],
  ACTOR_CONTEXT: null,
};

export function startBatchUpdater() {
  canvas.app.ticker.add(() => {
    if (BATCH_UPDATES.TOKEN.length) {
      canvas.scene.updateEmbeddedDocuments('Token', BATCH_UPDATES.TOKEN, BATCH_UPDATES.TOKEN_CONTEXT).then(() => {
        for (const cb of BATCH_UPDATES.TOKEN_CALLBACKS) {
          cb();
        }
        BATCH_UPDATES.TOKEN_CALLBACKS = [];
      });
      BATCH_UPDATES.TOKEN = [];
    }
    if (BATCH_UPDATES.ACTOR.length !== 0) {
      if (BATCH_UPDATES.ACTOR_CONTEXT) Actor.updateDocuments(BATCH_UPDATES.ACTOR, BATCH_UPDATES.ACTOR_CONTEXT);
      else Actor.updateDocuments(BATCH_UPDATES.ACTOR);
      BATCH_UPDATES.ACTOR = [];
      BATCH_UPDATES.ACTOR_CONTEXT = null;
    }
  });
}

export function queueTokenUpdate(id, update, callback = null, animate = true) {
  update._id = id;
  BATCH_UPDATES.TOKEN.push(update);
  BATCH_UPDATES.TOKEN_CONTEXT = { animate };
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
    animate = true,
  } = {}
) {
  if (!(token || actor)) {
    console.warn(game.i18n.localize('token-variants.notifications.warn.update-image-no-token-actor'));
    return;
  }

  // Check if it's a wildcard image
  if ((imgSrc && imgSrc.includes('*')) || (imgSrc.includes('{') && imgSrc.includes('}'))) {
    const images = await wildcardImageSearch(imgSrc);
    if (images.length) {
      imgSrc = images[Math.floor(Math.random() * images.length)];
      imgName = getFileName(imgSrc);
    }
  }

  if (imgSrc && !imgName) imgName = getFileName(imgSrc);
  if (!actor && token.actor) {
    actor = game.actors.get(token.actor.id);
  }

  const getDefaultConfig = (token, actor) => {
    let configEntries = [];
    if (token) configEntries = (token.document ?? token).getFlag('token-variants', 'defaultConfig') || [];
    else if (actor) {
      const tokenData = actor.prototypeToken;
      if ('token-variants' in tokenData.flags && 'defaultConfig' in tokenData['token-variants'])
        configEntries = tokenData['token-variants']['defaultConfig'];
    }
    return expandObject(Object.fromEntries(configEntries));
  };

  const constructDefaultConfig = (origData, customConfig) => {
    const flatOrigData = flattenObject(origData);
    TokenDataAdapter.dataToForm(flatOrigData);
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

  //
  // Accumulate all scripts that will need to be run after the update
  // const executeOnCallback = [];
  // let deferredUpdateScripts = [];
  // for (const ef of removed) {
  //   const onRemove = mappings[ef]?.config?.tv_script?.onRemove;
  //   if (onRemove) {
  //     if (onRemove.includes('tvaUpdate')) deferredUpdateScripts.push(onRemove);
  //     else executeOnCallback.push({ script: onRemove, token: tokenDoc });
  //   }
  //   const tmfxPreset = mappings[ef]?.config?.tv_script?.tmfxPreset;
  //   if (tmfxPreset) executeOnCallback.push({ tmfxPreset, token: tokenDoc, action: 'remove' });
  // }
  // for (const ef of added) {
  //   const onApply = mappings[ef]?.config?.tv_script?.onApply;
  //   if (onApply) {
  //     if (onApply.includes('tvaUpdate')) deferredUpdateScripts.push(onApply);
  //     else executeOnCallback.push({ script: onApply, token: tokenDoc });
  //   }
  //   const tmfxPreset = mappings[ef]?.config?.tv_script?.tmfxPreset;
  //   if (tmfxPreset) executeOnCallback.push({ tmfxPreset, token: tokenDoc, action: 'apply' });
  // }
  //

  const usingCustomConfig = token && (token.document ?? token).getFlag('token-variants', 'usingCustomConfig');
  const defaultConfig = getDefaultConfig(token);
  if (tokenCustomConfig || usingCustomConfig) {
    tokenUpdateObj = modMergeObject(tokenUpdateObj, defaultConfig);
  }

  if (tokenCustomConfig && !isEmpty(tokenCustomConfig)) {
    if (token) {
      tokenUpdateObj['flags.token-variants.usingCustomConfig'] = true;
      let doc = token.document ?? token;
      const tokenData = doc.toObject ? doc.toObject() : deepClone(doc);

      const defConf = constructDefaultConfig(mergeObject(tokenData, defaultConfig), tokenCustomConfig);
      tokenUpdateObj['flags.token-variants.defaultConfig'] = defConf;
    } else if (actor && !token) {
      tokenUpdateObj['flags.token-variants.usingCustomConfig'] = true;
      const tokenData = actor.prototypeToken instanceof Object ? actor.prototypeToken : actor.prototypeToken.toObject();
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

  if (!isEmpty(tokenUpdateObj)) {
    if (actor && !token) {
      TokenDataAdapter.formToData(actor.prototypeToken, tokenUpdateObj);
      actorUpdate.token = tokenUpdateObj;
      if (pack) {
        queueActorUpdate(actor.id, actorUpdate, { pack: pack });
      } else {
        await (actor.document ?? actor).update(actorUpdate);
      }
    }

    if (token) {
      TokenDataAdapter.formToData(token, tokenUpdateObj);
      if (TVA_CONFIG.updateTokenProto && token.actor) {
        // Timeout to prevent race conditions with other modules namely MidiQOL
        // this is a low priority update so it should be Ok to do
        if ((token.document ?? token).actorLink) {
          setTimeout(() => queueActorUpdate(token.actor.id, { token: tokenUpdateObj }), 500);
        } else {
          setTimeout(() => token.actor.update({ token: tokenUpdateObj }), 500);
        }
      }
      let doc = token.document ?? token;

      if (doc.object) queueTokenUpdate(token.id, tokenUpdateObj, callback, animate);
      else {
        await doc.update(tokenUpdateObj, { animate });
        callback();
      }
    }
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
  for (const tile of canvas.tiles.controlled) {
    const tileName = tile.document.getFlag('token-variants', 'tileName') || tile.id;
    showArtSelect(tileName, {
      callback: async function (imgSrc, name) {
        tile.document.update({ img: imgSrc });
      },
      searchType: SEARCH_TYPE.TILE,
    });
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
        const actor = token.actor;
        if (!actor) continue;
        showArtSelect(actor.name, {
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
        showArtSelect(token.name, {
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
        const actor = token.actor;
        showArtSelect(token.name, {
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
      const data = new foundry.data.PrototypeToken(setting);
      const token = new TokenDocument(data, { actor: null });
      new ActiveEffectConfigList(token, { globalMappings: true }).render(true);
    },
    restricted: true,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
  });

  game.keybindings.register('token-variants', 'compendiumMapper', {
    name: 'Compendium Mapper',
    hint: 'Opens Compendium Mapper',
    editable: [
      {
        key: 'KeyM',
        modifiers: ['Shift'],
      },
    ],
    onDown: () => {
      new CompendiumMapConfig().render(true);
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
  if (!imgSrc || !imgName) return undefined;
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
  const tcIndex = tokenConfigs.findIndex((config) => config.tvImgSrc == imgSrc && config.tvImgName == imgName);

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

export async function waitForTokenTexture(token, callback, checks = 40) {
  // v10/v9 compatibility

  if (!token.mesh || !token.mesh.texture) {
    checks--;
    if (checks > 1)
      new Promise((resolve) => setTimeout(resolve, 1)).then(() => waitForTokenTexture(token, callback, checks));
    return;
  }

  callback(token);
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
function _modMergeUpdate(original, k, v, { insertKeys, insertValues, enforceTypes, overwrite, recursive } = {}, _d) {
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

export async function tv_executeScript(script, { actor, token, tvaUpdate } = {}) {
  // Add variables to the evaluation scope
  const speaker = ChatMessage.getSpeaker();
  const character = game.user.character;
  actor = actor || game.actors.get(speaker.actor);
  token = token.object || (canvas.ready ? canvas.tokens.get(speaker.token) : null);

  // Attempt script execution
  const AsyncFunction = async function () {}.constructor;
  try {
    const fn = AsyncFunction('speaker', 'actor', 'token', 'character', 'tvaUpdate', `${script}`);
    await fn.call(null, speaker, actor, token, character, tvaUpdate);
  } catch (err) {
    ui.notifications.error(`There was an error in your script syntax. See the console (F12) for details`);
    console.error(err);
  }
}

export async function applyTMFXPreset(tokenDoc, presetName, action = 'apply') {
  if (game.modules.get('tokenmagic')?.active && tokenDoc.object) {
    const preset = TokenMagic.getPreset(presetName);
    if (preset) {
      if (action === 'apply') {
        await TokenMagic.addUpdateFilters(tokenDoc.object, preset);
      } else if (action === 'remove') {
        for (const filter of preset) {
          if (filter?.filterId) await TokenMagic.deleteFilters(tokenDoc.object, filter.filterId);
        }
      }
    }
  }
}

export class TokenDataAdapter {
  static dataToForm(data) {
    if ('texture.scaleX' in data) {
      data.scale = Math.abs(data['texture.scaleX']);
      data.mirrorX = data['texture.scaleX'] < 0;
    }
    if ('texture.scaleY' in data) {
      data.scale = Math.abs(data['texture.scaleY']);
      data.mirrorY = data['texture.scaleY'] < 0;
    }
  }

  static formToData(token, formData) {
    // Scale/mirroring
    if ('scale' in formData || 'mirrorX' in formData || 'mirrorY' in formData) {
      const doc = token.document ? token.document : token;
      if (!('scale' in formData)) formData.scale = Math.abs(doc.texture.scaleX);
      if (!('mirrorX' in formData)) formData.mirrorX = doc.texture.scaleX < 0;
      if (!('mirrorY' in formData)) formData.mirrorY = doc.texture.scaleY < 0;
      formData['texture.scaleX'] = formData.scale * (formData.mirrorX ? -1 : 1);
      formData['texture.scaleY'] = formData.scale * (formData.mirrorY ? -1 : 1);
      ['scale', 'mirrorX', 'mirrorY'].forEach((k) => delete formData[k]);
    }
  }
}

export function determineAddedRemovedEffects(addedEffects, removedEffects, newEffects, oldEffects) {
  for (const ef of newEffects) {
    if (!oldEffects.includes(ef)) {
      addedEffects.push(ef);
    }
  }
  for (const ef of oldEffects) {
    if (!newEffects.includes(ef)) {
      removedEffects.push(ef);
    }
  }
}

export async function wildcardImageSearch(imgSrc) {
  let source = 'data';
  const browseOptions = { wildcard: true };

  // Support non-user sources
  if (/\.s3\./.test(imgSrc)) {
    source = 's3';
    const { bucket, keyPrefix } = FilePicker.parseS3URL(imgSrc);
    if (bucket) {
      browseOptions.bucket = bucket;
      imgSrc = keyPrefix;
    }
  } else if (imgSrc.startsWith('icons/')) source = 'public';

  // Retrieve wildcard content
  try {
    const content = await FilePicker.browse(source, imgSrc, browseOptions);
    return content.files;
  } catch (err) {}
  return [];
}

/**
 * Returns a random name generated using Name Forge module
 * @param {*} randomizerSettings
 * @returns
 */
export async function nameForgeRandomize(randomizerSettings) {
  const nameForgeSettings = randomizerSettings.nameForge;
  if (nameForgeSettings?.randomize && nameForgeSettings?.models) {
    const nameForge = game.modules.get('nameforge');
    if (nameForge?.active) {
      const randomNames = [];
      for (const modelKey of nameForgeSettings.models) {
        const modelProp = getProperty(nameForge.models, modelKey);
        if (modelProp) {
          const model = await nameForge.api.createModel(modelProp);
          if (model) {
            randomNames.push(nameForge.api.generateName(model)[0]);
          }
        }
      }
      return randomNames[Math.floor(Math.random() * randomNames.length)];
    }
  }

  return null;
}

/**
 * Upload Token and associated overlays as a single image
 */
export async function uploadTokenImage(token, options) {
  let renderTexture = captureToken(token, options);
  if (renderTexture) {
    const b64 = canvas.app.renderer.extract.base64(renderTexture, 'image/webp', 1);
    let res = await fetch(b64);
    let blob = await res.blob();
    const filename = options.name + `.webp`;
    let file = new File([blob], filename, { type: 'image/webp' });
    await FilePicker.upload('data', options.path, file, {});
  }
}

/**
 * Modified version of 'dev7355608' captureCanvas function. Captures combined Token and Overlay image
 */
function captureToken(token, { scale = 3, width = null, height = null } = {}) {
  if (!canvas.ready || !token) {
    return;
  }

  width = width ?? token.texture.width;
  height = height ?? token.texture.height;

  scale = scale * Math.min(width / token.texture.width, height / token.texture.height);

  const renderer = canvas.app.renderer;
  const viewPosition = { ...canvas.scene._viewPosition };

  renderer.resize(width ?? renderer.screen.width, height ?? renderer.screen.height);

  width = canvas.screenDimensions[0] = renderer.screen.width;
  height = canvas.screenDimensions[1] = renderer.screen.height;

  canvas.stage.position.set(width / 2, height / 2);

  canvas.pan({
    x: token.center.x,
    y: token.center.y,
    scale,
  });

  const renderTexture = PIXI.RenderTexture.create({
    width,
    height,
    resolution: token.texture.resolution,
  });

  const cacheParent = canvas.stage.enableTempParent();

  canvas.stage.updateTransform();
  canvas.stage.disableTempParent(cacheParent);

  let spritesToRender = [token.mesh];
  if (token.tva_sprites) spritesToRender = spritesToRender.concat(token.tva_sprites);
  spritesToRender.sort((sprite) => sprite.sort);

  for (const sprite of spritesToRender) {
    renderer.render(sprite, { renderTexture, skipUpdateTransform: true, clear: false });
  }

  canvas._onResize();
  canvas.pan(viewPosition);

  return renderTexture;
}

export function getAllActorTokens(actor, linked = false, document = false) {
  if (actor.isToken) {
    if (document) return [actor.token];
    else if (actor.token.object) return [actor.token.object];
    else return [];
  }

  const tokens = [];
  game.scenes.forEach((scene) =>
    scene.tokens.forEach((token) => {
      if (token.actorId === actor.id) {
        if (linked && token.actorLink) tokens.push(token);
        else if (!linked) tokens.push(token);
      }
    })
  );
  if (document) return tokens;
  else return tokens.map((token) => token.object).filter((token) => token);
}
