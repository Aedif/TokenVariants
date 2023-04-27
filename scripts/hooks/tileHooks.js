import { renderTileHUD } from '../../applications/tileHUD.js';
import { TVA_CONFIG } from '../settings.js';
import { registerHook, unregisterHook } from './hooks.js';

const feature_id = 'tile';

export function registerTileHooks() {
  if (!TVA_CONFIG.tilesEnabled) {
    ['renderTileHUD', 'updateTile'].forEach((name) => unregisterHook(feature_id, name));
    return;
  }

  registerHook(feature_id, 'renderTileHUD', renderTileHUD);

  registerHook(feature_id, 'updateTile', async function (tile, change, options, userId) {
    // Update User Specific Image
    if (change.flags?.['token-variants']) {
      if ('userMappings' in change.flags['token-variants'] || '-=userMappings' in change.flags['token-variants']) {
        let p = canvas.tiles.get(tile.id);
        if (p) {
          await p.draw();
        }
      }
    }
  });
}
