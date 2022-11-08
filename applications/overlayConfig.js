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

    html.find('[name="filter"]').on('change', (event) => {
      if (event.target.value === 'OutlineOverlayFilter') {
        html.find('.filterOptions').show();
      } else {
        html.find('.filterOptions').hide();
      }
    });

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

  _convertColor(colString) {
    try {
      const c = Color.fromString(colString);
      const rgba = c.rgb;
      rgba.push(1);
      return rgba;
    } catch (e) {
      return [1, 1, 1, 1];
    }
  }

  async _onInputChange(event) {
    if (event.target.type === 'range') {
      this.previewConfig[event.target.name] = parseFloat($(event.target).val());
    } else if (event.target.type === 'color') {
      const color = $(event.target).siblings('.color');

      if (color.attr('name') === 'filterOptions.outlineColor') {
        this.previewConfig[color.attr('name')] = this._convertColor(event.target.value);
      } else {
        this.previewConfig[color.attr('name')] = event.target.value;
      }
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
    const preview = expandObject(this.previewConfig);
    for (const icon of icons) {
      icon.refresh(preview, true);
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
    data.filters = Object.keys(PIXI.filters);
    data.filters.push('OutlineOverlayFilter');
    data.filters.sort();
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
        filterOptions: {
          outlineColor: [0, 0, 0, 1],
          trueThickness: 1,
          animate: false,
        },
        inheritTint: false,
        underlay: false,
        linkRotation: true,
        linkMirror: true,
        linkOpacity: false,
        tint: '',
        loop: true,
        playOnce: false,
        effect: null,
        animation: {
          rotate: false,
          duration: 5000,
          clockwise: true,
        },
      },
      this.config || {}
    );

    settings.filterOptions.outlineColor = Color.fromRGB(
      settings.filterOptions.outlineColor
    ).toString();

    if (settings.filter === 'OutlineOverlayFilter') data.showOutlineSettings = true;

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
    if ('filterOptions.outlineColor' in formData) {
      formData['filterOptions.outlineColor'] = this._convertColor(
        formData['filterOptions.outlineColor']
      );
    }

    if (this.callback) this.callback(expandObject(formData));
  }
}
