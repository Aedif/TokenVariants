import { TVA_CONFIG } from '../scripts/settings.js';

export default class TVAPermissions extends FormApplication {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-permissions',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/permissions.html',
      resizable: false,
      minimizable: false,
      title: 'Permission Configuration',
      width: 660,
    });
  }

  async getData(options) {
    let data = super.getData(options);
    data = mergeObject(data, TVA_CONFIG.permissions);
    return data;
  }

  async _updateObject(event, formData) {
    const expanded = expandObject(formData);
    game.settings.set('token-variants', 'permissions', expanded);
  }
}
