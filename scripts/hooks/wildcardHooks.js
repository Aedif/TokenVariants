import { FEATURE_CONTROL, TVA_CONFIG } from '../settings.js';
import { extractDimensionsFromImgName } from '../utils.js';
import { registerHook, unregisterHook } from './hooks.js';

const feature_id = 'Wildcards';

export function registerWildcardHooks() {
  if (!FEATURE_CONTROL[feature_id]) {
    ['renderTokenConfig', 'preCreateToken'].forEach((name) => unregisterHook(feature_id, name));
    return;
  }

  // Insert default random image field
  registerHook(feature_id, 'renderTokenConfig', _renderTokenConfig);

  // Set Default Wildcard images if needed
  registerHook(feature_id, 'preCreateToken', _preCreateToken);
}

async function _renderTokenConfig(config, html) {
  const checkboxRandomize = html.find('input[name="randomImg"]');
  if (checkboxRandomize.length && !html.find('.token-variants-randomImgDefault').length) {
    const defaultImg =
      config.actor?.prototypeToken?.flags['token-variants']?.['randomImgDefault'] ||
      config.actor?.prototypeToken?.flags['token-hud-wildcard']?.['default'] ||
      '';

    const field = await renderTemplate('/modules/token-variants/templates/randomImgDefault.html', {
      defaultImg,
      active: checkboxRandomize.is(':checked'),
    });
    checkboxRandomize.closest('.form-group').after(field);

    const tvaRngField = html.find('.token-variants-randomImgDefault');

    tvaRngField.find('button').click((event) => {
      event.preventDefault();
      const input = tvaRngField.find('input');
      new FilePicker({ current: input.val(), field: input[0] }).browse(defaultImg);
    });

    checkboxRandomize.click((event) => {
      if (event.target.checked) {
        tvaRngField.addClass('active');
      } else {
        tvaRngField.removeClass('active');
      }
    });
  }
}

function _preCreateToken(tokenDocument, data, options, userId) {
  if (!game.user.id === userId) return;

  let update = {};
  if (tokenDocument.actor?.prototypeToken?.randomImg) {
    const defaultImg =
      tokenDocument.actor?.prototypeToken?.flags['token-variants']?.['randomImgDefault'] ||
      tokenDocument.actor?.prototypeToken?.flags['token-hud-wildcard']?.['default'] ||
      '';
    if (defaultImg) update['texture.src'] = defaultImg;
  }

  if (TVA_CONFIG.imgNameContainsDimensions) {
    extractDimensionsFromImgName(update['texture.src'] ?? tokenDocument.texture.src, update);
  }

  if (!isEmpty(update)) tokenDocument.updateSource(update);
}
