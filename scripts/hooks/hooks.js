import { registerEffectIconHooks } from './effectIconHooks.js';
import { registerArtSelectButtonHooks } from './artSelectButtonHooks.js';
import { registerOverlayHooks } from './overlayHooks.js';
import { registerEffectMappingHooks } from './effectMappingHooks.js';
import { registerTileHooks } from './tileHooks.js';
import { registerUserMappingHooks } from './userMappingHooks.js';
import { registerWildcardHooks } from './wildcardHooks.js';
import { registerTokenHooks } from './tokenHooks.js';

export const REGISTERED_HOOKS = {};

export function registerHook(feature_id, name, fn, { once = false } = {}) {
  if (!(feature_id in REGISTERED_HOOKS)) REGISTERED_HOOKS[feature_id] = {};
  if (name in REGISTERED_HOOKS[feature_id]) return;
  const num = Hooks.on(name, fn, { once });
  REGISTERED_HOOKS[feature_id][name] = num;
}

export function unregisterHook(feature_id, name) {
  if (feature_id in REGISTERED_HOOKS && name in REGISTERED_HOOKS[feature_id]) {
    Hooks.off(REGISTERED_HOOKS[feature_id][name]);
    delete REGISTERED_HOOKS[feature_id][name];
  }
}

export function registerAllHooks() {
  registerEffectIconHooks();
  registerOverlayHooks();
  registerArtSelectButtonHooks();
  registerEffectMappingHooks();
  registerTileHooks();
  registerWildcardHooks();
  registerUserMappingHooks();
  registerTokenHooks();
}
