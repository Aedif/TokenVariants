import { TVA_CONFIG } from '../settings.js';

/**
 * If the img is the same as TVA_CONFIG.invisibleImage then we'll override the isVisible
 * getter to return false of this client if it's not a GM. Reset it to default if not.
 * @param {*} token token whose isVisible is to be overriden
 * @param {*} img UserToImage mapping
 */
export function overrideTileVisibility(token, img) {
  if (img && decodeURI(img) === TVA_CONFIG.invisibleImage && !token.tva_customVisibility) {
    const originalIsVisible = Object.getOwnPropertyDescriptor(Token.prototype, 'isVisible').get;
    Object.defineProperty(token, 'isVisible', {
      get: function () {
        const isVisible = originalIsVisible.call(this);
        if (isVisible && !game.user.isGM) return false;
        return isVisible;
      },
      configurable: true,
    });
    token.visible = token.isVisible;
    token.tva_customVisibility = true;
  } else if (token.tva_customVisibility) {
    Object.defineProperty(token, 'isVisible', Object.getOwnPropertyDescriptor(Token.prototype, 'isVisible'));
    token.visible = token.isVisible;
    delete token.tva_customVisibility;
  }
}
