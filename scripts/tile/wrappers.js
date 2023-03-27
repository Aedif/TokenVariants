import { libWrapper } from '../libWrapper/shim.js';
import { TVA_CONFIG } from '../settings.js';
import { overrideTileVisibility } from './userToImage.js';

export function registerTileWrappers() {
  if (TVA_CONFIG.tilesEnabled) _registerDraw();
}

// Controls image change UserToImage mappings
function _registerDraw() {
  libWrapper.register(
    'token-variants',
    'Tile.prototype.draw',
    async function (wrapped, ...args) {
      let result;

      // If the Token has a UserToImage mappings momentarily set document.texture.src to it
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
        overrideTileVisibility(this, img);
      } else {
        overrideTileVisibility(this);
        result = await wrapped(...args);
      }
      return result;
    },
    'WRAPPER'
  );
}
