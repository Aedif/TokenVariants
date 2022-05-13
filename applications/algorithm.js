import { TVA_CONFIG } from '../scripts/settings.js';

export default class AlgorithmSettings extends FormApplication {
  constructor(dummySettings) {
    super({}, {});
    if (dummySettings) {
      this.dummySettings = mergeObject(dummySettings, TVA_CONFIG.algorithm, {
        overwrite: false,
      });
    }
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-algorithm-settings',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/algorithm.html',
      resizable: false,
      minimizable: false,
      title: game.i18n.localize('token-variants.settings.algorithm.Name'),
      width: 500,
    });
  }

  async getData(options) {
    const data = super.getData(options);
    const settings = deepClone(this.dummySettings ? this.dummySettings : TVA_CONFIG.algorithm);
    settings.fuzzyThreshold = 100 - settings.fuzzyThreshold * 100;
    return mergeObject(data, settings);
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
    $(html)
      .find(`[name="exact"]`)
      .change((e) => {
        $(e.target).closest('form').find('[name="fuzzy"]').prop('checked', !e.target.checked);
      });
    $(html)
      .find(`[name="fuzzy"]`)
      .change((e) => {
        $(e.target).closest('form').find('[name="exact"]').prop('checked', !e.target.checked);
      });
    $(html)
      .find('[name="fuzzyThreshold"]')
      .change((e) => {
        $(e.target).siblings('.token-variants-range-value').html(`${e.target.value}%`);
      });
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    formData.fuzzyLimit = parseInt(formData.fuzzyLimit);
    if (isNaN(formData.fuzzyLimit) || formData.fuzzyLimit < 1) formData.fuzzyLimit = 50;

    formData.fuzzyThreshold = (100 - formData.fuzzyThreshold) / 100;

    if (this.dummySettings) {
      mergeObject(this.dummySettings, formData);
    } else {
      game.settings.set('token-variants', 'algorithmSettings', formData);
    }
  }
}
