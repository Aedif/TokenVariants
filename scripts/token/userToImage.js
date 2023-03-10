import { drawOverlays } from './overlay.js';

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
  if (img && img !== token.document.texture.src) {
    // This function may be called while the Token is in the middle of loading it's textures.
    // Attempting to perform a draw() call then would result in multiple overlapped images.
    // We should wait for the texture to be loaded and change the image after. As a failsafe
    // give up after a certain number of checks.
    if (!token.mesh || !token.texture) {
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
    await _overrideIcon(token, token.document.texture.src);
    delete token.tva_iconOverride;
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
