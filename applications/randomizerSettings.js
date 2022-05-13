import { TVA_CONFIG } from '../scripts/settings.js';

export default class RandomizerSettings extends FormApplication {
  constructor() {
    super({}, { title: game.i18n.localize('token-variants.settings.randomizer.Name') });
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-randomizer-settings',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/randomizerSettings.html',
      resizable: false,
      minimizable: false,
      closeOnSubmit: true,
      width: 480,
      height: 'auto',
      dragDrop: [{ dragSelector: null, dropSelector: null }],
    });
  }

  async getData(options) {
    const data = super.getData(options);

    const randomizerSettings = TVA_CONFIG.randomizer;

    // Get all actor types defined by the game system
    const actorTypes = (game.system.entityTypes ?? game.system.documentTypes)['Actor'];
    data.actorTypes = actorTypes.reduce((obj, t) => {
      const label = CONFIG['Actor']?.typeLabels?.[t] ?? t;
      obj[t] = {
        label: game.i18n.has(label) ? game.i18n.localize(label) : t,
        disable: randomizerSettings[`${t}Disable`] ?? false,
      };
      return obj;
    }, {});

    data.tokenToPortraitDisabled =
      !(randomizerSettings.tokenCreate || randomizerSettings.tokenCopyPaste) ||
      randomizerSettings.diffImages;

    return mergeObject(data, randomizerSettings);
  }

  async _updateObject(event, formData) {
    game.settings.set('token-variants', 'randomizerSettings', formData);
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('input[name="diffImages"]').change((event) => {
      this._tokenToPortraitToggle(event);
      $(event.target)
        .closest('form')
        .find('input[name="syncImages"]')
        .prop('disabled', !event.target.checked);
    });

    html.find('input[name="tokenCreate"]').change(this._tokenToPortraitToggle);
    html.find('input[name="tokenCopyPaste"]').change(this._tokenToPortraitToggle);
  }

  async _tokenToPortraitToggle(event) {
    const tokenCreate = $(event.target)
      .closest('form')
      .find('input[name="tokenCreate"]')
      .is(':checked');
    const tokenCopyPaste = $(event.target)
      .closest('form')
      .find('input[name="tokenCopyPaste"]')
      .is(':checked');
    const diffImages = $(event.target)
      .closest('form')
      .find('input[name="diffImages"]')
      .is(':checked');
    $(event.target)
      .closest('form')
      .find('input[name="tokenToPortrait"]')
      .prop('disabled', !(tokenCreate || tokenCopyPaste) || diffImages);
  }

  async _onAutoApply(event) {
    $(event.target)
      .closest('form')
      .find('.token-variants-auto-art-select')
      .prop('disabled', !event.target.checked);
  }
}
