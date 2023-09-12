import { FEATURE_CONTROL, TVA_CONFIG } from '../settings.js';
import { registerWrapper, unregisterWrapper } from './wrappers.js';

const feature_id = 'HideElement';

export function registerHideElementWrappers() {
  unregisterWrapper(feature_id, 'Token.prototype._getTooltipText');
  if (FEATURE_CONTROL[feature_id] && TVA_CONFIG.hideElevationTooltip) {
    registerWrapper(feature_id, 'Token.prototype._getTooltipText', _getTooltipText, 'WRAPPER');
  }

  unregisterWrapper(feature_id, 'Token.prototype._refreshBorder');
  if (FEATURE_CONTROL[feature_id] && TVA_CONFIG.hideTokenBorder) {
    registerWrapper(feature_id, 'Token.prototype._refreshBorder', _refreshVisibility, 'OVERRIDE');
  }
}

function _getTooltipText(wrapped, ...args) {
  wrapped(...args);
  return '';
}

function _refreshVisibility(...args) {}
