import { renderTileHUD } from '../../applications/tileHUD.js';

export function registerTileHooks() {
  Hooks.on('renderTileHUD', renderTileHUD);

  Hooks.on('updateTile', async function (tile, change, options, userId) {
    // Update User Specific Image
    if (change.flags?.['token-variants']) {
      if ('userMappings' in change.flags['token-variants'] || '-=userMappings' in change.flags['token-variants']) {
        let p = canvas.tiles.get(tile.id);
        if (p) {
          await p.draw();
          // p.visible = p.isVisible;
        }
      }
    }
  });
}
