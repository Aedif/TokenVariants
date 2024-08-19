export default class EditScriptConfig extends FormApplication {
  constructor(script, callback) {
    super({}, {});
    this.script = script;
    this.callback = callback;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'token-variants-config-script-edit',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/configScriptEdit.html',
      resizable: true,
      minimizable: false,
      title: 'Scripts',
      width: 640,
      height: 640,
    });
  }

  async getData(options) {
    const data = super.getData(options);

    const script = this.script ? this.script : {};
    data.hasScript = !foundry.utils.isEmpty(script);
    data.onApply = script.onApply;
    data.onRemove = script.onRemove;
    data.macroOnApply = script.macroOnApply;
    data.macroOnRemove = script.macroOnRemove;

    data.tmfxPreset = script.tmfxPreset;
    data.tmfxActive = game.modules.get('tokenmagic')?.active;
    if (data.tmfxActive) {
      data.tmfxPresets = TokenMagic.getPresets().map((p) => p.name);
    }

    data.ceActive = game.modules.get('dfreds-convenient-effects')?.active;
    if (data.ceActive) {
      data.ceEffect = script.ceEffect ?? { apply: true, remove: true };
      data.ceEffects = game.dfreds.effectInterface.findEffects().map((ef) => ef.name);
    }

    data.macros = game.macros.map((m) => m.name);

    return data;
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
    // Override 'Tab' key to insert spaces
    html.on('keydown', '.command textarea', function (e) {
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        var start = this.selectionStart;
        var end = this.selectionEnd;
        this.value = this.value.substring(0, start) + '  ' + this.value.substring(end);
        this.selectionStart = this.selectionEnd = start + 2;
        return false;
      }
    });

    html.find('.remove').click(this._onRemove.bind(this));
  }

  async _onRemove(event) {
    if (this.callback) this.callback(null);
    this.close();
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    formData = foundry.utils.expandObject(formData);
    ['onApply', 'onRemove', 'macroOnApply', 'macroOnRemove'].forEach((k) => {
      formData[k] = formData[k].trim();
    });
    if (formData.ceEffect?.name) formData.ceEffect.name = formData.ceEffect.name.trim();

    if (
      !formData.onApply &&
      !formData.onRemove &&
      !formData.tmfxPreset &&
      !formData.ceEffect.name &&
      !formData.macroOnApply &&
      !formData.macroOnRemove
    ) {
      if (this.callback) this.callback(null);
    } else {
      if (this.callback) this.callback(formData);
    }
  }
}
