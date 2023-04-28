import { libWrapper } from '../libWrapper/shim.js';
import { registerEffectIconWrappers } from './effectIconWrappers.js';
import { registerUserMappingWrappers } from './userMappingWrappers.js';

export const REGISTERED_WRAPPERS = {};

export function registerWrapper(feature_id, name, fn, method = 'WRAPPER') {
  if (!(feature_id in REGISTERED_WRAPPERS)) REGISTERED_WRAPPERS[feature_id] = {};
  if (name in REGISTERED_WRAPPERS[feature_id]) return;

  REGISTERED_WRAPPERS[feature_id][name] = libWrapper.register('token-variants', name, fn, method);
}

export function unregisterWrapper(feature_id, name) {
  if (feature_id in REGISTERED_WRAPPERS && name in REGISTERED_WRAPPERS[feature_id]) {
    libWrapper.unregister('token-variants', REGISTERED_WRAPPERS[feature_id][name]);
    delete REGISTERED_WRAPPERS[feature_id][name];
  }
}

export function registerAllWrappers() {
  registerUserMappingWrappers();
  registerEffectIconWrappers();
}
