export default class RandomizerSettings extends FormApplication {
  constructor() {
    super(
      {},
      { title: game.i18n.localize('token-variants.settings.randomizer.Name') }
    );
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

    const randomizerSettings = game.settings.get(
      'token-variants',
      'randomizerSettings'
    );

    // Get all actor types defined by the game system
    const actorTypes = (game.system.entityTypes ?? game.system.documentTypes)[
      'Actor'
    ];
    data.actorTypes = actorTypes.reduce((obj, t) => {
      const label = CONFIG['Actor']?.typeLabels?.[t] ?? t;
      obj[t] = {
        label: game.i18n.has(label) ? game.i18n.localize(label) : t,
        disable: randomizerSettings[`${t}Disable`] ?? false,
      };
      return obj;
    }, {});

    return mergeObject(data, randomizerSettings);
  }

  async _updateObject(event, formData) {
    game.settings.set('token-variants', 'randomizerSettings', formData);
  }
}
