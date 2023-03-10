import { TVA_CONFIG } from '../settings.js';
import { drawOverlays } from './overlay.js';

/**
 * If the img is the same as TVA_CONFIG.invisibleImage then we'll override the isVisible
 * getter to return false of this client if it's not a GM. Reset it to default if not.
 * @param {*} token token whose isVisible is to be overriden
 * @param {*} img UserToImage mapping
 */
export function overrideTokenVisibility(token, img) {
  if (img && decodeURI(img) === TVA_CONFIG.invisibleImage && !token.tva_customVisibility) {
    console.log('OVERRIDING VISIBLITY');
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
    console.log('rESETTING VISIBILITY');
    Object.defineProperty(token, 'isVisible', Object.getOwnPropertyDescriptor(Token.prototype, 'isVisible'));
    token.visible = token.isVisible;
    delete token.tva_customVisibility;
  }
}

async function _overrideIcon(token, img) {
  let mesh = canvas.primary.tokens.get(token.sourceId);
  if (!mesh) mesh = canvas.primary.addChild(new TokenMesh(token));
  else mesh.object = token;
  mesh.texture = await _loadTexture(img);
  mesh.anchor.set(0.5, 0.5);
  canvas.primary.tokens.set(token.sourceId, mesh);
  if (mesh.isVideo) canvas.primary.videoMeshes.add(mesh);

  // If this is an image flagged as invisible, we need to override visibility check for this client
  if (
    (decodeURI(token.tva_iconOverride) === TVA_CONFIG.invisibleImage || token.tva_customVisibility) &&
    decodeURI(img) !== TVA_CONFIG.invisibleImage
  ) {
    Object.defineProperty(token, 'isVisible', Object.getOwnPropertyDescriptor(Token.prototype, 'isVisible'));
    token.visible = token.isVisible;
    delete token.tva_customVisibility;
  } else if (decodeURI(img) === TVA_CONFIG.invisibleImage) {
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
  }

  token.tva_iconOverride = img;
  token.refresh();
  drawOverlays(token);

  return mesh;
}

async function _loadTexture(img) {
  // Load token texture
  let texture = await loadTexture(img, { fallback: CONST.DEFAULT_TOKEN });

  // Manage video playback
  let video = game.video.getVideoSource(texture);
  if (video) {
    const playOptions = { volume: 0 };
    game.video.play(video, playOptions);
  }
  return texture;
}
