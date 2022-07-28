export default class OverlayConfig extends FormApplication {
  constructor(config, callback, effectName, token) {
    super({}, {});
    this.config = config ?? {};
    this.config.effect = effectName;
    this.callback = callback;
    this.token = canvas.tokens.get(token._id);
    this.previewConfig = deepClone(this.config);
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-overlay-config',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/overlayConfig.html',
      resizable: true,
      minimizable: false,
      title: 'Overlay Settings',
      width: 500,
    });
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('input,select').on('change', this._onInputChange.bind(this));

    // Controls for locking scale sliders together
    let scaleState = { locked: true };
    const lockButtons = $(html).find('.scaleLock > a');
    const sliderScaleWidth = $(html).find('[name="scaleX"]');
    const sliderScaleHeight = $(html).find('[name="scaleY"]');

    lockButtons.on('click', function () {
      scaleState.locked = !scaleState.locked;
      lockButtons.html(
        scaleState.locked ? '<i class="fas fa-link"></i>' : '<i class="fas fa-unlink"></i>'
      );
    });

    sliderScaleWidth.on('change', function () {
      if (scaleState.locked && sliderScaleWidth.val() !== sliderScaleHeight.val()) {
        sliderScaleHeight.val(sliderScaleWidth.val()).trigger('change');
      }
    });
    sliderScaleHeight.on('change', function () {
      if (scaleState.locked && sliderScaleWidth.val() !== sliderScaleHeight.val()) {
        sliderScaleWidth.val(sliderScaleHeight.val()).trigger('change');
      }
    });
  }

  async _onInputChange(event) {
    if (event.target.type === 'range') {
      this.previewConfig[event.target.name] = parseFloat($(event.target).val());
    } else if (event.target.type === 'color') {
      const color = $(event.target).siblings('.color');
      this.previewConfig[color.attr('name')] = event.target.value;
    } else if (event.target.type === 'checkbox') {
      this.previewConfig[event.target.name] = event.target.checked;
    } else {
      this.previewConfig[event.target.name] = $(event.target).val();
    }
    this._applyPreviews();
  }

  getPreviewIcons() {
    if (!this.config.effect) return [];
    const tokens = this.token ? [this.token] : canvas.tokens.placeables;
    const previewIcons = [];
    for (const tkn of tokens) {
      for (const c of tkn.children) {
        if (c.tvaOverlayConfig && c.tvaOverlayConfig.effect === this.config.effect) {
          // Effect icon found, however if we're in global preview then we need to take into account
          // a token/actor specific mapping which may override the global one
          if (this.token) {
            previewIcons.push(c);
          } else if (
            !(tkn.actor ? tkn.actor.getFlag('token-variants', 'effectMappings') || {} : {})[
              this.config.effect
            ]
          ) {
            previewIcons.push(c);
          }
        }
      }
    }
    return previewIcons;
  }

  async _applyPreviews() {
    const icons = this.getPreviewIcons();
    for (const icon of icons) {
      icon.refresh(this.previewConfig, true);
    }
  }

  async _removePreviews() {
    const icons = this.getPreviewIcons();
    for (const icon of icons) {
      icon.refresh();
    }
  }

  async getData(options) {
    const data = super.getData(options);
    data.filters = Object.keys(PIXI.filters).sort();
    data.filters.unshift('NONE');
    const settings = mergeObject(
      {
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        offsetX: 0,
        offsetY: 0,
        angle: 0,
        filter: 'NONE',
        inheritTint: false,
        underlay: false,
        linkRotation: true,
        linkMirror: true,
        linkOpacity: false,
        tint: '',
        loop: true,
        playOnce: false,
        effect: null,
      },
      this.config || {}
    );
    return mergeObject(data, settings);
  }

  async close(options = {}) {
    super.close(options);
    this._removePreviews();
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    if (this.callback) this.callback(formData);
  }
}
