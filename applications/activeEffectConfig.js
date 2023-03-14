export default class TVAActiveEffectConfig extends FormApplication {
  constructor(token, mapping, callback) {
    super({}, { title: 'TVA - Active Effect Config' });

    this.token = token;
    this.mapping = mapping;
    this.callback = callback;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-active-effect-config',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/activeEffectConfig.html',
      resizable: false,
      minimizable: false,
      closeOnSubmit: true,
      height: 'auto',
      scrollY: ['ol.token-variant-table'],
      width: 700,
      // tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.content', initial: 'main' }],

      tabs: [
        { navSelector: '.tabs[data-group="main"]', contentSelector: 'form', initial: 'main' },
        { navSelector: '.tabs[data-group="config"]', contentSelector: 'form', initial: 'token-configuration' },
      ],
    });
  }

  async getData(options) {
    const data = super.getData(options);
    mergeObject(data, this.mapping);

    // Prepare a clean token config field
    try {
      data.tokenConfig = deepClone(data.config ?? {});
      ['tv_script'].forEach((p) => {
        delete data.tokenConfig[p];
      });
      data.tokenConfig = JSON.stringify(data.tokenConfig, null, 2);
    } catch (e) {
      data.tokenConfig = '{}';
    }

    return data;
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);

    html.find('button.tva-token-config').click(this._onTokenConfig.bind(this));
  }

  _onTokenConfig(event) {
    const configTextArea = $(event.target).closest('.tab').find('[name="config"]');

    // Read config from textarea
    let currentConfig = {};
    try {
      currentConfig = JSON.parse(configTextArea.val());
    } catch (e) {
      console.log(e);
    }

    // Put config in textarea
    const callback = (fields) => {
      try {
        configTextArea.val(JSON.stringify(fields, null, 2));
      } catch (e) {}
    };

    const MassEdit = game.modules.get('multi-token-edit');
    if (MassEdit?.active && isNewerVersion(MassEdit.version, '1.37.2"')) {
      const meForm = MassEdit.api.showMassEdit(this.token, 'Token', { simplified: true, callback });

      setTimeout(() => {
        meForm._applyPreset(flattenObject(currentConfig));
      }, 500);
    } else {
      new TokenCustomConfig(this.token, {}, null, null, callback, currentConfig).render(true);
    }
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    try {
      formData.config = JSON.parse(formData.config);
    } catch (e) {
      formData.config = {};
    }

    const expanded = expandObject(formData);

    // ======
    // Script
    // ======
    const tv_script = expanded.config.tv_script ?? {};
    tv_script.onApply = tv_script.onApply.trim();
    tv_script.onRemove = tv_script.onRemove.trim();
    try {
      const tmfxMorph = JSON.parse(tv_script.tmfxMorph?.trim());
      if (
        foundry.utils.getType(tmfxMorph) === 'Object' &&
        tmfxMorph.filterType === 'polymorph' &&
        tmfxMorph.animated?.progress?.loopDuration
      ) {
        tv_script.tmfxMorph = tmfxMorph;
      } else {
        delete tv_script.tmfxMorph;
      }
    } catch (ex) {
      delete tv_script.tmfxMorph;
    }
    if (!tv_script.onApply && !tv_script.onRemove && !tv_script.tmfxPreset && !tv_script.tmfxMorph) {
      delete expanded.config.tv_script;
    }
    // End of Script

    if (this.callback) this.callback(expanded);

    console.log(expanded);
  }
}
