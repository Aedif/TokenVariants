import { renderTokenHUD } from '../../applications/tokenHUD.js';
import { FEATURE_CONTROL, TVA_CONFIG } from '../settings.js';
import { registerHook, unregisterHook } from './hooks.js';

const feature_id = 'HUD';

export function registerHUDHooks() {
  if (
    FEATURE_CONTROL[feature_id] &&
    (TVA_CONFIG.permissions.hudFullAccess[game.user.role] || TVA_CONFIG.permissions.hud[game.user.role])
  ) {
    registerHook(feature_id, 'renderTokenHUD', renderTokenHUD);
  } else {
    unregisterHook(feature_id, 'renderTokenHUD');
  }
}
