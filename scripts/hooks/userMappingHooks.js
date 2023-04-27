import { FEATURE_CONTROL } from '../settings.js';
import { registerHook, unregisterHook } from './hooks.js';

const feature_id = 'userMapping';

export function registerUserMappingHooks() {
  if (!FEATURE_CONTROL[feature_id]) {
    ['updateToken'].forEach((id) => unregisterHook(feature_id, id));
    return;
  }

  registerHook(feature_id, 'updateToken', async function (token, change) {
    // Update User Specific Image
    if (change.flags?.['token-variants']) {
      if ('userMappings' in change.flags['token-variants'] || '-=userMappings' in change.flags['token-variants']) {
        let p = canvas.tokens.get(token.id);
        if (p) {
          await p.draw();
          p.visible = p.isVisible;
        }
      }
    }
  });
}
