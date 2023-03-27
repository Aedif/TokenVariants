export default class EditScriptConfig extends FormApplication {
  constructor(script, imgSrc, callback) {
    super({}, {});
    this.script = script;
    this.callback = callback;
    this.imgSrc = imgSrc;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
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
    data.hasScript = !isEmpty(script);
    data.onApply = script.onApply;
    data.onRemove = script.onRemove;

    data.tmfxPreset = script.tmfxPreset;
    data.tmfxActive = game.modules.get('tokenmagic')?.active;
    if (data.tmfxActive) {
      data.tmfxPresets = TokenMagic.getPresets().map((p) => p.name);
    }
    if (game.settings.get('token-variants', 'secretCode')) {
      data.hasTokenImage = this.imgSrc && this.imgSrc.trim();
    }

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
    formData.onApply = formData.onApply.trim();
    formData.onRemove = formData.onRemove.trim();
    if (!formData.onApply && !formData.onRemove && !formData.tmfxPreset) {
      if (this.callback) this.callback(null);
    } else {
      if (this.callback)
        this.callback({
          onApply: formData.onApply,
          onRemove: formData.onRemove,
          tmfxPreset: formData.tmfxPreset,
        });
    }
  }
}
