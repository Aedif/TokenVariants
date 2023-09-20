import { insertArtSelectButton } from '../../applications/artSelect.js';
import { FEATURE_CONTROL, TVA_CONFIG } from '../settings.js';
import { SEARCH_TYPE, updateTokenImage } from '../utils.js';
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
  if (checkboxRandomize.length && !html.find('.token-variants-proto').length) {
    const defaultImg =
      config.actor?.prototypeToken?.flags['token-variants']?.['randomImgDefault'] ||
      config.actor?.prototypeToken?.flags['token-hud-wildcard']?.['default'] ||
      '';

    const field = await renderTemplate('/modules/token-variants/templates/protoTokenElement.html', {
      defaultImg,
      disableHUDButton: config.object?.getFlag('token-variants', 'disableHUDButton'),
    });
    checkboxRandomize.closest('.form-group').after(field);

    const tvaFieldset = html.find('.token-variants-proto');

    tvaFieldset.find('button').click((event) => {
      event.preventDefault();
      const input = tvaFieldset.find('input');
      new FilePicker({ current: input.val(), field: input[0] }).browse(defaultImg);
    });

    insertArtSelectButton(tvaFieldset, 'flags.token-variants.randomImgDefault', {
      search: config.object.name,
      searchType: SEARCH_TYPE.TOKEN,
    });

    // Hide/Show Default Img Form Group
    const rdmImgFormGroup = tvaFieldset.find('.imagevideo').closest('.form-group');
    const showHideGroup = function (checked) {
      if (checked) {
        rdmImgFormGroup.show();
      } else {
        rdmImgFormGroup.hide();
      }
      config.setPosition();
    };
    checkboxRandomize.on('click', (event) => showHideGroup(event.target.checked));
    showHideGroup(checkboxRandomize.is(':checked'));
  }
}

function _preCreateToken(tokenDocument, data, options, userId) {
  if (game.user.id !== userId) return;
  const update = {};
  if (tokenDocument.actor?.prototypeToken?.randomImg) {
    const defaultImg =
      tokenDocument.actor?.prototypeToken?.flags['token-variants']?.['randomImgDefault'] ||
      tokenDocument.actor?.prototypeToken?.flags['token-hud-wildcard']?.['default'] ||
      '';
    if (defaultImg) update['texture.src'] = defaultImg;
  }

  if (TVA_CONFIG.imgNameContainsDimensions || TVA_CONFIG.imgNameContainsFADimensions) {
    updateTokenImage(update['texture.src'] ?? tokenDocument.texture.src, {
      token: tokenDocument,
      update,
    });
  }

  if (!isEmpty(update)) tokenDocument.updateSource(update);
}
