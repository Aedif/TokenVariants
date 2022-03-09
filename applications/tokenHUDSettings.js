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
    data.enableWorldSettings =
      game.user && game.user.can('FILES_BROWSE') && game.user.can('TOKEN_CONFIGURE');
    if (data.enableWorldSettings) {
      data = mergeObject(data, game.settings.get('token-variants', 'worldHudSettings'));
    }
    data = mergeObject(data, game.settings.get('token-variants', 'hudSettings'));
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
    if (game.user.isGM) {
      const worldSettings = game.settings.get('token-variants', 'worldHudSettings');
      for (const setting of [
        'enableButtonForAll',
        'displayOnlySharedImages',
        'disableIfTHWEnabled',
        'includeKeywords',
      ]) {
        worldSettings[setting] = formData[setting];
      }
      game.settings.set('token-variants', 'worldHudSettings', worldSettings);
    }

    const clientSettings = game.settings.get('token-variants', 'hudSettings');
    for (const setting of [
      'enableSideMenu',
      'displayAsImage',
      'imageOpacity',
      'alwaysShowButton',
      'updateActorImage',
      'includeWildcard',
    ]) {
      clientSettings[setting] = formData[setting];
    }
    game.settings.set('token-variants', 'hudSettings', clientSettings);
  }
}
