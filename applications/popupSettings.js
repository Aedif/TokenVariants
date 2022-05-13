import { TVA_CONFIG } from '../scripts/settings.js';

export default class PopUpSettings extends FormApplication {
  constructor() {
    super({}, { title: game.i18n.localize('token-variants.settings.pop-up.Name') });
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-popup-settings',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/popupSettings.html',
      resizable: false,
      minimizable: false,
      closeOnSubmit: true,
      width: 600,
      height: 'auto',
      dragDrop: [{ dragSelector: null, dropSelector: null }],
    });
  }

  async getData(options) {
    const data = super.getData(options);
    const popupSettings = TVA_CONFIG.popup;

    // Get all actor types defined by the game system
    const actorTypes = (game.system.entityTypes ?? game.system.documentTypes)['Actor'];
    data.actorTypes = actorTypes.reduce((obj, t) => {
      const label = CONFIG['Actor']?.typeLabels?.[t] ?? t;
      obj[t] = {
        type: t,
        label: game.i18n.has(label) ? game.i18n.localize(label) : t,
        disable: popupSettings[`${t}Disable`] ?? false,
      };
      return obj;
    }, {});

    // Split into arrays of max length 3
    let allTypes = [];
    let tempTypes = [];
    let i = 0;
    for (const [key, value] of Object.entries(data.actorTypes)) {
      tempTypes.push(value);
      i++;
      if (i % 3 == 0) {
        allTypes.push(tempTypes);
        tempTypes = [];
      }
    }
    if (tempTypes.length > 0) allTypes.push(tempTypes);
    data.actorTypes = allTypes;

    return mergeObject(data, popupSettings);
  }

  async _updateObject(event, formData) {
    game.settings.set('token-variants', 'popupSettings', formData);
  }
}
