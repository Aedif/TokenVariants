import { TVA_CONFIG } from '../scripts/settings.js';

export default class TokenHUDSettings extends FormApplication {
  constructor() {
    super({}, { title: `Token HUD Settings` });
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-hud-settings',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/tokenHUDSettings.html',
      resizable: false,
      minimizable: false,
      title: '',
      width: 500,
    });
  }

  async getData(options) {
    let data = super.getData(options);
    data.enableWorldSettings = game.user && game.user.isGM;
    if (data.enableWorldSettings) {
      data = mergeObject(data, TVA_CONFIG.worldHud);
    }
    data = mergeObject(data, TVA_CONFIG.hud);
    data.tokenHUDWildcardActive = game.modules.get('token-hud-wildcard')?.active;
    return data;
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    const worldSettings = TVA_CONFIG.worldHud;

    const w_settings = ['displayOnlySharedImages', 'disableIfTHWEnabled:', 'includeKeywords'];

    w_settings.forEach((setting) => {
      if (setting in formData) worldSettings[setting] = formData[setting];
    });
    game.settings.set('token-variants', 'worldHudSettings', worldSettings);

    const clientSettings = TVA_CONFIG.hud;
    const c_settings = [
      'enableSideMenu',
      'displayAsImage',
      'imageOpacity',
      'alwaysShowButton',
      'updateActorImage',
      'includeWildcard',
    ];
    c_settings.forEach((setting) => {
      if (setting in formData) clientSettings[setting] = formData[setting];
    });
    game.settings.set('token-variants', 'hudSettings', clientSettings);
  }
}
