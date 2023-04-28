import { TVA_CONFIG } from '../settings.js';
import { registerWrapper } from './wrappers.js';

const feature_id = 'userMapping';

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
  if (img && decodeURI(img) === TVA_CONFIG.invisibleImage && !obj.tva_customVisibility) {
    const originalIsVisible = Object.getOwnPropertyDescriptor(obj.constructor.prototype, 'isVisible').get;
    Object.defineProperty(obj, 'isVisible', {
      get: function () {
        const isVisible = originalIsVisible.call(this);
        if (isVisible && !game.user.isGM) return false;
        return isVisible;
      },
      configurable: true,
    });
    obj.visible = obj.isVisible;
    obj.tva_customVisibility = true;
  } else if (obj.tva_customVisibility) {
    Object.defineProperty(obj, 'isVisible', Object.getOwnPropertyDescriptor(obj.constructor.prototype, 'isVisible'));
    obj.visible = obj.isVisible;
    delete obj.tva_customVisibility;
  }
}
