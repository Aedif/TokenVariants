import { TOKEN_HUD_VARIANTS } from '../../applications/tokenHUD.js';
import { FEATURE_CONTROL, TVA_CONFIG } from '../settings.js';
import { registerWrapper, unregisterWrapper } from './wrappers.js';

const feature_id = 'HUD';

export function registerHUDWrappers() {
  unregisterWrapper(feature_id, 'TokenHUD.prototype.clear');
  if (FEATURE_CONTROL[feature_id]) {
    registerWrapper(feature_id, 'TokenHUD.prototype.clear', _clear, 'WRAPPER');
  }
}

function _clear(wrapped, ...args) {
  let result = wrapped(...args);
  _applyVariantFlags();
  return result;
}

async function _applyVariantFlags() {
  const { actor, variants } = TOKEN_HUD_VARIANTS;
  if (actor) {
    if (!variants?.length) {
      actor.unsetFlag('token-variants', 'variants');
    } else {
      actor.setFlag('token-variants', 'variants', variants);
    }
  }
  TOKEN_HUD_VARIANTS.actor = null;
  TOKEN_HUD_VARIANTS.variants = null;
}
