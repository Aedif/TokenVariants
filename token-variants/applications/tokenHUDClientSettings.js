import { TVA_CONFIG } from '../scripts/settings.js';

export default class TokenHUDClientSettings extends FormApplication {
  constructor() {
    super({}, { title: `Token HUD Settings` });
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'token-variants-hud-settings',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/tokenHUDClientSettings.html',
      resizable: false,
      minimizable: false,
      title: '',
      width: 500,
    });
  }

  async getData(options) {
    const data = super.getData(options);
    return foundry.utils.mergeObject(data, TVA_CONFIG.hud);
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    game.settings.set('token-variants', 'hudSettings', foundry.utils.mergeObject(TVA_CONFIG.hud, formData));
  }
}
