import { FEATURE_CONTROL } from '../settings.js';
import { registerHook, unregisterHook } from './hooks.js';

const feature_id = 'wildcard';

export function registerWildcardHooks() {
  if (!FEATURE_CONTROL[feature_id]) {
    ['renderTokenConfig', 'preCreateToken'].forEach((name) => unregisterHook(feature_id, name));
  }

  // Insert default random image field
  registerHook(feature_id, 'renderTokenConfig', async (config, html) => {
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
  });

  // Set Default Wildcard images if needed
  registerHook('preCreateToken', (tokenDocument, data, options, userId) => {
    if (game.user.id === userId && tokenDocument.actor?.prototypeToken?.randomImg) {
      const defaultImg =
        tokenDocument.actor?.prototypeToken?.flags['token-variants']?.['randomImgDefault'] ||
        tokenDocument.actor?.prototypeToken?.flags['token-hud-wildcard']?.['default'] ||
        '';
      if (defaultImg) tokenDocument.updateSource({ 'texture.src': defaultImg });
    }
  });
}
