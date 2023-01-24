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
    if (script.tmfxMorph) {
      data.tmfxMorph = JSON.stringify(script.tmfxMorph, null, 2);
    }
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
    html.find('.defaultMorph').click((event) => {
      $(event.target)
        .closest('form')
        .find('[name="tmfxMorph"]')
        .val(JSON.stringify(DEFAULT_MORPH, null, 2));
    });
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
    try {
      const tmfxMorph = JSON.parse(formData.tmfxMorph?.trim());
      if (
        foundry.utils.getType(tmfxMorph) === 'Object' &&
        tmfxMorph.filterType === 'polymorph' &&
        tmfxMorph.animated?.progress?.loopDuration
      ) {
        formData.tmfxMorph = tmfxMorph;
      } else {
        delete formData.tmfxMorph;
      }
    } catch (ex) {
      delete formData.tmfxMorph;
    }
    if (!formData.onApply && !formData.onRemove && !formData.tmfxPreset && !formData.tmfxMorph) {
      if (this.callback) this.callback(null);
    } else {
      if (this.callback)
        this.callback({
          onApply: formData.onApply,
          onRemove: formData.onRemove,
          tmfxPreset: formData.tmfxPreset,
          tmfxMorph: formData.tmfxMorph,
        });
    }
  }
}

const DEFAULT_MORPH = {
  filterType: 'polymorph',
  filterId: 'WILL BE SET BY THE MODULE',
  type: 4,
  padding: 70,
  magnify: 1,
  imagePath: 'WILL BE SET BY THE MODULE',
  animated: {
    progress: {
      active: true,
      animType: 'halfCosOscillation',
      val1: 0,
      val2: 100,
      loops: 1,
      loopDuration: 1000,
    },
  },
};
