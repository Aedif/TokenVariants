import { registerEffectIconWrappers } from './effectIconWrappers.js';
import { registerHideElementWrappers } from './hideElementWrappers.js';
import { registerHUDWrappers } from './hudWrappers.js';
import { registerUserMappingWrappers } from './userMappingWrappers.js';

export const REGISTERED_WRAPPERS = {};

export function registerWrapper(feature_id, name, fn, method = 'WRAPPER') {
  if (typeof libWrapper !== 'function') return;
  if (!(feature_id in REGISTERED_WRAPPERS)) REGISTERED_WRAPPERS[feature_id] = {};
  if (name in REGISTERED_WRAPPERS[feature_id]) return;

  REGISTERED_WRAPPERS[feature_id][name] = libWrapper.register('token-variants', name, fn, method);
}

export function unregisterWrapper(feature_id, name) {
  if (typeof libWrapper !== 'function') return;
  if (feature_id in REGISTERED_WRAPPERS && name in REGISTERED_WRAPPERS[feature_id]) {
    libWrapper.unregister('token-variants', REGISTERED_WRAPPERS[feature_id][name]);
    delete REGISTERED_WRAPPERS[feature_id][name];
  }
}

export function registerAllWrappers() {
  // User to Image mappings for Tile and Tokens
  registerUserMappingWrappers();
  // Hide effect icons
  registerEffectIconWrappers();
  // Token HUD Variants Management
  registerHUDWrappers();
  // Hide Core Token Elements
  registerHideElementWrappers();
}
