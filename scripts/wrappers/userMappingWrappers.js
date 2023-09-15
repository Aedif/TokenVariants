import { TVA_CONFIG } from '../settings.js';
import { decodeURISafely } from '../utils.js';
import { registerWrapper } from './wrappers.js';

const feature_id = 'UserMappings';

export function registerUserMappingWrappers() {
  registerWrapper(feature_id, 'Tile.prototype.draw', _draw);
  registerWrapper(feature_id, 'Token.prototype.draw', _draw);
}

async function _draw(wrapped, ...args) {
  let result;

  // If the Token/Tile has a UserToImage mappings momentarily set document.texture.src to it
  // so that it's texture gets loaded instead of the actual Token image
  const mappings = this.document.getFlag('token-variants', 'userMappings') || {};
  const img = mappings[game.userId];
  let previous;
  if (img) {
    previous = this.document.texture.src;
    this.document.texture.src = img;
    this.tva_iconOverride = img;
    result = await wrapped(...args);
    this.document.texture.src = previous;
    overrideVisibility(this, img);
  } else {
    overrideVisibility(this);
    result = await wrapped(...args);
  }

  return result;
}

/**
 * If the img is the same as TVA_CONFIG.invisibleImage then we'll override the isVisible
 * getter to return false of this client if it's not a GM. Reset it to default if not.
 * @param {*} obj object whose isVisible is to be overriden
 * @param {*} img UserToImage mapping
 */
function overrideVisibility(obj, img) {
  if (img && decodeURISafely(img) === TVA_CONFIG.invisibleImage && !obj.tva_customVisibility) {
    const originalIsVisible = _getIsVisibleDescriptor(obj).get;
    Object.defineProperty(obj, 'isVisible', {
      get: function () {
        const isVisible = originalIsVisible.call(this);
        if (isVisible && !game.user.isGM) return false;
        return isVisible;
      },
      configurable: true,
    });
    obj.tva_customVisibility = true;
  } else if (!img && obj.tva_customVisibility) {
    Object.defineProperty(obj, 'isVisible', _getIsVisibleDescriptor(obj));
    delete obj.tva_customVisibility;
  }
}

function _getIsVisibleDescriptor(obj) {
  let iObj = Object.getPrototypeOf(obj);
  let descriptor = null;
  while (iObj) {
    descriptor = Object.getOwnPropertyDescriptor(iObj, 'isVisible');
    if (descriptor) break;
    iObj = Object.getPrototypeOf(iObj);
  }
  return descriptor;
}

/**
 * Assign an image to be displayed to only that user.
 * @param {*} token token the image is to be applied to
 * @param {*} img image to be displayed, if no image is provided unassignUserSpecificImage(...) will be called
 * @param {*} opts.userName name of the user that the image is to be displayed to
 * @param {*} opts.id id of the user that the image is to be displayed to
 * @returns
 */
export function assignUserSpecificImage(token, img, { userName = null, userId = null } = {}) {
  if (!img) return unassignUserSpecificImage(token, { userName, userId });

  if (userName instanceof Array) {
    for (const name of userName) assignUserSpecificImage(token, img, { userName: name });
    return;
  }

  if (userId instanceof Array) {
    for (const id of userId) assignUserSpecificImage(token, img, { userId: id });
    return;
  }

  let id = userId;
  if (!id && userName) {
    id = game.users.find((u) => u.name === userName)?.id;
  }
  if (!id) return;

  const doc = token.document ?? token;
  const mappings = doc.getFlag('token-variants', 'userMappings') || {};

  mappings[id] = img;
  doc.setFlag('token-variants', 'userMappings', mappings);
}

/**
 * Calls assignUserSpecificImage passing in all currently selected tokens.
 * @param {*} img image to be displayed
 * @param {*} opts id or name of the user as per assignUserSpecificImage(...)
 */
export function assignUserSpecificImageToSelected(img, opts = {}) {
  const selected = [...canvas.tokens.controlled];
  for (const t of selected) assignUserSpecificImage(t, img, opts);
}

/**
 * Un-assign image if one has been set to be displayed to a user.
 * @param {*} token token the image is to be removed from
 * @param {*} opts.userName name of the user that the image is to be removed for
 * @param {*} opts.id id of the user that the image is to be removed for
 */
export function unassignUserSpecificImage(token, { userName = null, userId = null } = {}) {
  if (userName instanceof Array) {
    for (const name of userName) unassignUserSpecificImage(token, { userName: name });
    return;
  }

  if (userId instanceof Array) {
    for (const id of userId) unassignUserSpecificImage(token, { userId: id });
    return;
  }

  let id = userId;
  if (!id && userName) {
    id = game.users.find((u) => u.name === userName)?.id;
  }
  if (!id) {
    if (!userName && !userId) (token.document ?? token).unsetFlag('token-variants', 'userMappings');
  } else {
    const update = {};
    update['flags.token-variants.userMappings.-=' + id] = null;
    (token.document ?? token).update(update);
  }
}

/**
 * Calls unassignUserSpecificImage passing in all currently selected tokens.
 * @param {*} opts id or name of the user as per unassignUserSpecificImage(...)
 */
export function unassignUserSpecificImageFromSelected(opts = {}) {
  const selected = [...canvas.tokens.controlled];
  for (const t of selected) unassignUserSpecificImage(t, opts);
}
