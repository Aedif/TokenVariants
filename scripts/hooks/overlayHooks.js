import { FEATURE_CONTROL } from '../settings.js';
import { TVASprite } from '../sprite/TVASprite.js';
import { drawOverlays } from '../token/overlay.js';
import { registerHook, unregisterHook } from './hooks.js';

const feature_id = 'Overlays';

export function registerOverlayHooks() {
  if (!FEATURE_CONTROL[feature_id]) {
    ['refreshToken', 'destroyToken', 'updateActor', 'renderCombatTracker', 'updateToken', 'createToken'].forEach((id) =>
      unregisterHook(feature_id, id)
    );
    return;
  }

  registerHook(feature_id, 'createToken', async function (token) {
    if (token.object) drawOverlays(token.object);
  });

  registerHook(feature_id, 'updateToken', async function (token) {
    if (token.object) drawOverlays(token.object);
  });

  registerHook(feature_id, 'refreshToken', (token) => {
    if (token.tva_sprites)
      for (const child of token.tva_sprites) {
        if (child instanceof TVASprite) {
          child.refresh(null, { preview: false, fullRefresh: false });
        }
      }
  });

  registerHook(feature_id, 'destroyToken', (token) => {
    if (token.tva_sprites)
      for (const child of token.tva_sprites) {
        child.parent?.removeChild(child)?.destroy();
      }
  });

  registerHook(feature_id, 'updateActor', async function (actor) {
    if (actor.getActiveTokens)
      actor.getActiveTokens(true).forEach((token) => {
        drawOverlays(token);
      });
  });

  registerHook(feature_id, 'renderCombatTracker', function () {
    for (const tkn of canvas.tokens.placeables) {
      drawOverlays(tkn);
    }
  });
}
