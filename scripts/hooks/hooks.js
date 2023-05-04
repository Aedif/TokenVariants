import { registerEffectIconHooks } from './effectIconHooks.js';
import { registerArtSelectButtonHooks } from './artSelectButtonHooks.js';
import { registerOverlayHooks } from './overlayHooks.js';
import { registerEffectMappingHooks } from './effectMappingHooks.js';
import { registerHUDHooks } from './hudHooks.js';
import { registerUserMappingHooks } from './userMappingHooks.js';
import { registerWildcardHooks } from './wildcardHooks.js';
import { registerPopRandomizeHooks } from './popUpRandomizeHooks.js';

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
  // Hide effect icons
  registerEffectIconHooks();
  // Display overlays
  registerOverlayHooks();
  // Insert Art Select buttons and contextmenu listeners
  registerArtSelectButtonHooks();
  // Effect Mapping related listening for state changes and applying configurations
  registerEffectMappingHooks();
  // Display HUD buttons for Tokens and Tiles
  registerHUDHooks();
  // Default Wildcard image controls
  registerWildcardHooks();
  // User to Image mappings for Tile and Tokens
  registerUserMappingHooks();
  // Handle pop-ups and randomization on token/actor create
  registerPopRandomizeHooks();
}
