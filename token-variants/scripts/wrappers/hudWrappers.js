import { renderContextMenuPalette, renderPalette, TOKEN_HUD_VARIANTS } from '../../applications/tokenHUD.js';
import { Reticle } from '../reticle.js';
import { FEATURE_CONTROL, TVA_CONFIG } from '../settings.js';
import { registerWrapper, unregisterWrapper } from './wrappers.js';

const feature_id = 'HUD';

export function registerHUDWrappers() {
  unregisterWrapper(feature_id, 'foundry.applications.hud.TokenHUD.prototype.clear');
  unregisterWrapper(feature_id, 'foundry.applications.hud.TokenHUD.prototype._initializeApplicationOptions');
  if (FEATURE_CONTROL[feature_id]) {
    registerWrapper(feature_id, 'foundry.applications.hud.TokenHUD.prototype.clear', _clear, 'MIXED');
    registerWrapper(
      feature_id,
      'foundry.applications.hud.TokenHUD.prototype._initializeApplicationOptions',
      _initializeApplicationOptions,
      'WRAPPER'
    );
  }
}

function _clear(wrapped, ...args) {
  _applyVariantFlags();

  // HUD should not close if we're in assisted overlay positioning mode
  if (Reticle.active && Reticle.mode === 'hud') return;
  return wrapped(...args);
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

function _initializeApplicationOptions(wrapped, options) {
  const actions = options.actions ?? {};
  actions.tva = tvaButtonClick;
  options.actions = actions;
  return wrapped(options);
}

async function tvaButtonClick(event) {
  const palette = this.element.querySelector(`.palette[data-palette="tva"]`);

  const FULL_ACCESS = TVA_CONFIG.permissions.hudFullAccess[game.user.role];

  if (FULL_ACCESS && event.shiftKey) {
    if (!palette || !palette.classList.contains('contextmenu')) {
      palette?.remove();
      this.element.querySelector('.col.right').appendChild((await renderContextMenuPalette(this.document))[0]);
    }
  } else if (!palette || palette.classList.contains('contextmenu')) {
    palette?.remove();
    this.element.querySelector('.col.right').appendChild((await renderPalette(this.document))[0]);
  }

  this.togglePalette('tva');
}
