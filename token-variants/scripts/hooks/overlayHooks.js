import { FEATURE_CONTROL, TVA_CONFIG } from '../settings.js';
import { HTMLOverlay } from '../sprite/HTMLOverlay.js';
import { TVAOverlay } from '../sprite/TVAOverlay.js';
import { drawOverlays } from '../token/overlay.js';
import { registerHook, unregisterHook } from './hooks.js';

const feature_id = 'Overlays';

export function registerOverlayHooks() {
  if (!FEATURE_CONTROL[feature_id]) {
    [
      'refreshToken',
      'destroyToken',
      'updateActor',
      'renderCombatTracker',
      'updateToken',
      'createToken',
      'hoverToken',
      'renderHeadsUpDisplay',
    ].forEach((id) => unregisterHook(feature_id, id));
    return;
  } else if (!TVA_CONFIG.evaluateOverlayOnHover) {
    unregisterHook(feature_id, 'hoverToken');
  }

  if (TVA_CONFIG.evaluateOverlayOnHover) {
    registerHook(feature_id, 'hoverToken', function (token, hover) {
      drawOverlays(token);
    });
  }

  registerHook(feature_id, 'createToken', async function (token) {
    if (token.object) drawOverlays(token.object);
  });

  registerHook(feature_id, 'updateToken', async function (token) {
    if (token.object) drawOverlays(token.object);
  });

  registerHook(feature_id, 'refreshToken', (token) => {
    if (token.tvaOverlays)
      for (const child of token.tvaOverlays) {
        if (child instanceof TVAOverlay) {
          child.refresh(null, { preview: false, fullRefresh: false });
        }
      }
  });

  registerHook(feature_id, 'destroyToken', (token) => {
    if (token.tvaOverlays)
      for (const child of token.tvaOverlays) {
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

  registerHook(feature_id, 'renderHeadsUpDisplay', () => {
    HTMLOverlay.hudRendered();
  });
}

const REFRESH_HOOKS = {};

export function registerOverlayRefreshHook(tvaOverlay, hookName) {
  if (!(hookName in REFRESH_HOOKS)) {
    registerHook('TVAOverlayRefresh', hookName, () => {
      REFRESH_HOOKS[hookName]?.forEach((s) => s.refresh());
    });
    REFRESH_HOOKS[hookName] = [tvaOverlay];
  } else if (!REFRESH_HOOKS[hookName].find((s) => s == tvaOverlay)) {
    REFRESH_HOOKS[hookName].push(tvaOverlay);
  }
}

export function unregisterOverlayRefreshHooks(tvaOverlay, hookName = null) {
  const unregister = function (hook) {
    if (REFRESH_HOOKS[hook]) {
      let index = REFRESH_HOOKS[hook].findIndex((s) => s == tvaOverlay);
      if (index > -1) {
        REFRESH_HOOKS[hook].splice(index, 1);
        if (!REFRESH_HOOKS[hook].length) {
          unregisterHook('TVAOverlayRefresh', hook);
          delete REFRESH_HOOKS[hook];
        }
      }
    }
  };

  if (hookName) unregister(hookName);
  else {
    Object.keys(REFRESH_HOOKS).forEach((k) => unregister(k));
  }
}
