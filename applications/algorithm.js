export default class AlgorithmSettings extends FormApplication {
  constructor() {
    super({}, {});
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-algorithm-settings',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/algorithm.html',
      resizable: false,
      minimizable: false,
      title: 'Algorithm Settings',
      width: 500,
    });
  }

  async getData(options) {
    const data = super.getData(options);
    const settings = game.settings.get('token-variants', 'algorithmSettings');
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
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    formData.fuzzyLimit = parseInt(formData.fuzzyLimit);
    if (isNaN(formData.fuzzyLimit) || formData.fuzzyLimit < 1) formData.fuzzyLimit = 50;

    formData.fuzzyThreshold = (100 - formData.fuzzyThreshold) / 100;

    game.settings.set('token-variants', 'algorithmSettings', formData);
  }
}
