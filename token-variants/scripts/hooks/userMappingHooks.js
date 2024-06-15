import { FEATURE_CONTROL, TVA_CONFIG } from '../settings.js';
import { registerHook, unregisterHook } from './hooks.js';

const feature_id = 'UserMappings';

export function registerUserMappingHooks() {
  if (!FEATURE_CONTROL[feature_id]) {
    ['updateToken', 'updateTile', 'sightRefresh'].forEach((id) => unregisterHook(feature_id, id));
    return;
  }

  registerHook(feature_id, 'updateToken', _updateToken);
  registerHook(feature_id, 'updateTile', _updateTile);
  registerHook(feature_id, 'sightRefresh', _sightRefresh);
}

async function _updateToken(token, change) {
  // Update User Specific Image
  if (change.flags?.['token-variants']) {
    if ('userMappings' in change.flags['token-variants'] || '-=userMappings' in change.flags['token-variants']) {
      const t = canvas.tokens.get(token.id);
      if (t) {
        await t.draw();
        canvas.visibility.restrictVisibility();
      }
    }
  }
}

async function _updateTile(tile, change) {
  // Update User Specific Image
  if (change.flags?.['token-variants']) {
    if ('userMappings' in change.flags['token-variants'] || '-=userMappings' in change.flags['token-variants']) {
      const t = canvas.tiles.get(tile.id);
      if (t) {
        await t.draw();
        canvas.visibility.restrictVisibility();
      }
    }
  }
}

function _sightRefresh() {
  if (!game.user.isGM) {
    for (let t of canvas.tokens.placeables) {
      if (_isInvisible(t)) t.visible = false;
    }
    for (let t of canvas.tiles.placeables) {
      if (_isInvisible(t)) t.visible = false;
    }
  }
}

function _isInvisible(obj) {
  const img = (obj.document.getFlag('token-variants', 'userMappings') || {})?.[game.userId];
  return img === TVA_CONFIG.invisibleImage;
}
