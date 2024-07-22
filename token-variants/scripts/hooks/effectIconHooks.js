import { FEATURE_CONTROL, TVA_CONFIG } from '../settings.js';
import { registerHook, unregisterHook } from './hooks.js';

const feature_id = 'EffectIcons';

export function registerEffectIconHooks() {
  // OnHover settings specific hooks
  if (FEATURE_CONTROL[feature_id] && TVA_CONFIG.displayEffectIconsOnHover) {
    registerHook(feature_id, 'hoverToken', (token, hoverIn) => {
      if (token.effects) token.effects.meVisible = hoverIn;
    });
  } else {
    unregisterHook(feature_id, 'hoverToken');
  }

  if (FEATURE_CONTROL[feature_id] && TVA_CONFIG.displayEffectIconsOnHover) {
    registerHook(feature_id, 'highlightObjects', (active) => {
      if (canvas.tokens.active) {
        for (const tkn of canvas.tokens.placeables) {
          if (tkn.effects) tkn.effects.meVisible = active || tkn.hover;
        }
      }
    });
  } else {
    unregisterHook(feature_id, 'highlightObjects');
  }

  if (FEATURE_CONTROL[feature_id] && TVA_CONFIG.displayEffectIconsOnHover) {
    registerHook(feature_id, 'refreshToken', (token) => {
      if (token.visible && token.effects) token.effects.visible = Boolean(token.effects.meVisible);
    });
  } else {
    unregisterHook(feature_id, 'refreshToken');
  }
}
