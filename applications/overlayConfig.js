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
      resizable: false,
      minimizable: false,
      title: 'Overlay Settings',
      width: 500,
      height: 'auto',
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.content', initial: 'misc' }],
    });
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('input,select').on('change', this._onInputChange.bind(this));
    html.find('textarea').on('input', this._onInputChange.bind(this));

    html.find('[name="filter"]').on('change', (event) => {
      html.find('.filterOptions').empty();
      const filterOptions = $(genFilterOptionControls(event.target.value));
      html.find('.filterOptions').append(filterOptions);
      this.setPosition({ height: 'auto' });
      this.activateListeners(filterOptions);
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

    html.find('.me-edit-json').on('click', async (event) => {
      const textarea = $(event.target).closest('.form-group').find('textarea');
      let params;
      try {
        params = eval(textarea.val());
      } catch (e) {}

      if (params) {
        let param;
        if (Array.isArray(params)) {
          if (params.length === 1) param = params[0];
          else {
            let i = await promptParamChoice(params);
            if (i < 0) return;
            param = params[i];
          }
        } else {
          param = params;
        }

        if (param)
          game.modules
            .get('multi-token-edit')
            .api.showGenericForm(param, param.filterType ?? 'TMFX', {
              inputChangeCallback: (selected) => {
                mergeObject(param, selected, { inplace: true });
                textarea.val(JSON.stringify(params, null, 2)).trigger('input');
              },
            });
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
    if (event.target.name.startsWith('filterOptions')) {
      const filterOptions = expandObject(this._getSubmitData()).filterOptions;
      this.previewConfig.filterOptions = filterOptions;
    } else if (event.target.type === 'range') {
      this.previewConfig[event.target.name] = parseFloat($(event.target).val());
    } else if (event.target.type === 'color') {
      const color = $(event.target).siblings('.color');
      color.val(event.target.value).trigger('change');
      return;
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
      if (tkn.tva_sprites) {
        for (const c of tkn.tva_sprites) {
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
    if (typeof TokenMagic !== 'undefined') data.filters.unshift('Token Magic FX');
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
        filterOptions: {},
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
          relative: false,
        },
        limitToUser: false,
        limitedUsers: [],
        alwaysVisible: false,
      },
      this.config || {}
    );

    if (settings.filter !== 'NONE') {
      const filterOptions = genFilterOptionControls(settings.filter, settings.filterOptions);
      if (filterOptions) {
        settings.filterOptions = filterOptions;
      } else {
        settings.filterOptions = null;
      }
    } else {
      settings.filterOptions = null;
    }

    data.users = game.users.map((u) => {
      return { id: u.id, name: u.name, selected: settings.limitedUsers.includes(u.id) };
    });

    return mergeObject(data, settings);
  }

  async close(options = {}) {
    super.close(options);
    this._removePreviews();
  }

  _getSubmitData() {
    const formData = super._getSubmitData();
    if (formData.filter === 'OutlineOverlayFilter' && 'filterOptions.outlineColor' in formData) {
      formData['filterOptions.outlineColor'] = this._convertColor(
        formData['filterOptions.outlineColor']
      );
    } else if (formData.filter === 'BevelFilter') {
      if ('filterOptions.lightColor' in formData)
        formData['filterOptions.lightColor'] = Number(
          Color.fromString(formData['filterOptions.lightColor'])
        );
      if ('filterOptions.shadowColor' in formData)
        formData['filterOptions.shadowColor'] = Number(
          Color.fromString(formData['filterOptions.shadowColor'])
        );
    } else if (
      ['DropShadowFilter', 'GlowFilter', 'OutlineFilter', 'FilterFire'].includes(formData.filter)
    ) {
      if ('filterOptions.color' in formData)
        formData['filterOptions.color'] = Number(Color.fromString(formData['filterOptions.color']));
    }
    return formData;
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    if (this.callback) this.callback(expandObject(formData));
  }
}

export const FILTERS = {
  OutlineOverlayFilter: {
    defaultValues: {
      outlineColor: [0, 0, 0, 1],
      trueThickness: 1,
      animate: false,
    },
    controls: [
      {
        type: 'color',
        name: 'outlineColor',
      },
      {
        type: 'range',
        label: 'Thickness',
        name: 'trueThickness',
        min: 0,
        max: 5,
        step: 0.01,
      },
      {
        type: 'boolean',
        label: 'Oscillate',
        name: 'animate',
      },
    ],
    argType: 'args',
  },
  AlphaFilter: {
    defaultValues: {
      alpha: 1,
    },
    controls: [
      {
        type: 'range',
        name: 'alpha',
        min: 0,
        max: 1,
        step: 0.01,
      },
    ],
    argType: 'args',
  },
  BlurFilter: {
    defaultValues: {
      strength: 8,
      quality: 4,
    },
    controls: [
      { type: 'range', name: 'strength', min: 0, max: 20, step: 1 },
      { type: 'range', name: 'quality', min: 0, max: 20, step: 1 },
    ],
    argType: 'args',
  },
  BlurFilterPass: {
    defaultValues: {
      horizontal: false,
      strength: 8,
      quality: 4,
    },
    controls: [
      {
        type: 'boolean',
        name: 'horizontal',
      },
      { type: 'range', name: 'strength', min: 0, max: 20, step: 1 },
      { type: 'range', name: 'quality', min: 0, max: 20, step: 1 },
    ],
    argType: 'args',
  },
  NoiseFilter: {
    defaultValues: {
      noise: 0.5,
      seed: 4475160954091,
    },
    controls: [
      { type: 'range', name: 'noise', min: 0, max: 1, step: 0.01 },
      { type: 'range', name: 'seed', min: 0, max: 100000, step: 1 },
    ],
    argType: 'args',
  },
  AdjustmentFilter: {
    defaultValues: {
      gamma: 1,
      saturation: 1,
      contrast: 1,
      brightness: 1,
      red: 1,
      green: 1,
      blue: 1,
      alpha: 1,
    },
    controls: [
      { type: 'range', name: 'gamma', min: 0, max: 1, step: 0.01 },
      { type: 'range', name: 'saturation', min: 0, max: 1, step: 0.01 },
      { type: 'range', name: 'contrast', min: 0, max: 1, step: 0.01 },
      { type: 'range', name: 'brightness', min: 0, max: 1, step: 0.01 },
      { type: 'range', name: 'red', min: 0, max: 1, step: 0.01 },
      { type: 'range', name: 'green', min: 0, max: 1, step: 0.01 },
      { type: 'range', name: 'blue', min: 0, max: 1, step: 0.01 },
      { type: 'range', name: 'alpha', min: 0, max: 1, step: 0.01 },
    ],
    argType: 'options',
  },
  AdvancedBloomFilter: {
    defaultValues: {
      threshold: 0.5,
      bloomScale: 1,
      brightness: 1,
      blur: 8,
      quality: 4,
    },
    controls: [
      { type: 'range', name: 'threshold', min: 0, max: 1, step: 0.01 },
      { type: 'range', name: 'bloomScale', min: 0, max: 5, step: 0.01 },
      { type: 'range', name: 'brightness', min: 0, max: 1, step: 0.01 },
      { type: 'range', name: 'blur', min: 0, max: 20, step: 1 },
      { type: 'range', name: 'quality', min: 0, max: 20, step: 1 },
    ],
    argType: 'options',
  },
  AsciiFilter: {
    defaultValues: {
      size: 8,
    },
    controls: [{ type: 'range', name: 'size', min: 0, max: 20, step: 0.01 }],
    argType: 'args',
  },
  BevelFilter: {
    defaultValues: {
      rotation: 45,
      thickness: 2,
      lightColor: 0xffffff,
      lightAlpha: 0.7,
      shadowColor: 0x000000,
      shadowAlpha: 0.7,
    },
    controls: [
      { type: 'range', name: 'rotation', min: 0, max: 360, step: 1 },
      { type: 'range', name: 'thickness', min: 0, max: 20, step: 0.01 },
      { type: 'color', name: 'lightColor' },
      { type: 'range', name: 'lightAlpha', min: 0, max: 1, step: 0.01 },
      { type: 'color', name: 'shadowColor' },
      { type: 'range', name: 'shadowAlpha', min: 0, max: 1, step: 0.01 },
    ],
    argType: 'options',
  },
  BloomFilter: {
    defaultValues: {
      blur: 2,
      quality: 4,
    },
    controls: [
      { type: 'range', name: 'blur', min: 0, max: 20, step: 1 },
      { type: 'range', name: 'quality', min: 0, max: 20, step: 1 },
    ],
    argType: 'args',
  },
  BulgePinchFilter: {
    defaultValues: {
      radius: 100,
      strength: 1,
    },
    controls: [
      { type: 'range', name: 'radius', min: 0, max: 500, step: 1 },
      { type: 'range', name: 'strength', min: -1, max: 1, step: 0.01 },
    ],
    argType: 'options',
  },
  CRTFilter: {
    defaultValues: {
      curvature: 1,
      lineWidth: 1,
      lineContrast: 0.25,
      verticalLine: false,
      noise: 0.3,
      noiseSize: 1,
      seed: 0,
      vignetting: 0.3,
      vignettingAlpha: 1,
      vignettingBlur: 0.3,
      time: 0,
    },
    controls: [
      { type: 'range', name: 'curvature', min: 0, max: 20, step: 0.01 },
      { type: 'range', name: 'lineWidth', min: 0, max: 20, step: 0.01 },
      { type: 'range', name: 'lineContrast', min: 0, max: 5, step: 0.01 },
      { type: 'boolean', name: 'verticalLine' },
      { type: 'range', name: 'noise', min: 0, max: 2, step: 0.01 },
      { type: 'range', name: 'noiseSize', min: 0, max: 20, step: 0.01 },
      { type: 'range', name: 'seed', min: 0, max: 100000, step: 1 },
      { type: 'range', name: 'vignetting', min: 0, max: 20, step: 0.01 },
      { type: 'range', name: 'vignettingAlpha', min: 0, max: 1, step: 0.01 },
      { type: 'range', name: 'vignettingBlur', min: 0, max: 5, step: 0.01 },
      { type: 'range', name: 'time', min: 0, max: 10000, step: 1 },
    ],
    argType: 'options',
  },
  DotFilter: {
    defaultValues: {
      scale: 1,
      angle: 5,
    },
    controls: [
      { type: 'range', name: 'scale', min: 0, max: 50, step: 1 },
      { type: 'range', name: 'angle', min: 0, max: 360, step: 0.1 },
    ],
    argType: 'args',
  },
  DropShadowFilter: {
    defaultValues: {
      rotation: 45,
      distance: 5,
      color: 0x000000,
      alpha: 0.5,
      shadowOnly: false,
      blur: 2,
      quality: 3,
    },
    controls: [
      { type: 'range', name: 'rotation', min: 0, max: 360, step: 0.1 },
      { type: 'range', name: 'distance', min: 0, max: 100, step: 0.1 },
      { type: 'color', name: 'color' },
      { type: 'range', name: 'alpha', min: 0, max: 1, step: 0.01 },
      { type: 'boolean', name: 'shadowOnly' },
      { type: 'range', name: 'blur', min: 0, max: 20, step: 0.1 },
      { type: 'range', name: 'quality', min: 0, max: 20, step: 1 },
    ],
    argType: 'options',
  },
  EmbossFilter: {
    defaultValues: {
      strength: 5,
    },
    controls: [{ type: 'range', name: 'strength', min: 0, max: 20, step: 1 }],
    argType: 'args',
  },
  GlitchFilter: {
    defaultValues: {
      slices: 5,
      offset: 100,
      direction: 0,
      fillMode: 0,
      seed: 0,
      average: false,
      minSize: 8,
      sampleSize: 512,
    },
    controls: [
      { type: 'range', name: 'slices', min: 0, max: 50, step: 1 },
      { type: 'range', name: 'distance', min: 0, max: 1000, step: 1 },
      { type: 'range', name: 'direction', min: 0, max: 360, step: 0.1 },
      {
        type: 'select',
        name: 'fillMode',
        options: [
          { value: 0, label: 'TRANSPARENT' },
          { value: 1, label: 'ORIGINAL' },
          { value: 2, label: 'LOOP' },
          { value: 3, label: 'CLAMP' },
          { value: 4, label: 'MIRROR' },
        ],
      },
      { type: 'range', name: 'seed', min: 0, max: 10000, step: 1 },
      { type: 'boolean', name: 'average' },
      { type: 'range', name: 'minSize', min: 0, max: 500, step: 1 },
      { type: 'range', name: 'sampleSize', min: 0, max: 1024, step: 1 },
    ],
    argType: 'options',
  },
  GlowFilter: {
    defaultValues: {
      distance: 10,
      outerStrength: 4,
      innerStrength: 0,
      color: 0xffffff,
      quality: 0.1,
      knockout: false,
    },
    controls: [
      { type: 'range', name: 'distance', min: 1, max: 50, step: 1 },
      { type: 'range', name: 'outerStrength', min: 0, max: 20, step: 1 },
      { type: 'range', name: 'innerStrength', min: 0, max: 20, step: 1 },
      { type: 'color', name: 'color' },
      { type: 'range', name: 'quality', min: 0, max: 5, step: 0.1 },
      { type: 'boolean', name: 'knockout' },
    ],
    argType: 'options',
  },
  GodrayFilter: {
    defaultValues: {
      angle: 30,
      gain: 0.5,
      lacunarity: 2.5,
      parallel: true,
      time: 0,
      alpha: 1.0,
    },
    controls: [
      { type: 'range', name: 'angle', min: 0, max: 360, step: 0.1 },
      { type: 'range', name: 'gain', min: 0, max: 5, step: 0.01 },
      { type: 'range', name: 'lacunarity', min: 0, max: 5, step: 0.01 },
      { type: 'boolean', name: 'parallel' },
      { type: 'range', name: 'time', min: 0, max: 10000, step: 1 },
      { type: 'range', name: 'alpha', min: 0, max: 1, step: 0.01 },
    ],
    argType: 'options',
  },
  KawaseBlurFilter: {
    defaultValues: {
      blur: 4,
      quality: 3,
      clamp: false,
    },
    controls: [
      { type: 'range', name: 'blur', min: 0, max: 20, step: 0.1 },
      { type: 'range', name: 'quality', min: 0, max: 20, step: 1 },
      { type: 'boolean', name: 'clamp' },
    ],
    argType: 'args',
  },
  OldFilmFilter: {
    defaultValues: {
      sepia: 0.3,
      noise: 0.3,
      noiseSize: 1.0,
      scratch: 0.5,
      scratchDensity: 0.3,
      scratchWidth: 1.0,
      vignetting: 0.3,
      vignettingAlpha: 1.0,
      vignettingBlur: 0.3,
    },
    controls: [
      { type: 'range', name: 'sepia', min: 0, max: 1, step: 0.01 },
      { type: 'range', name: 'noise', min: 0, max: 1, step: 0.01 },
      { type: 'range', name: 'noiseSize', min: 0, max: 5, step: 0.01 },
      { type: 'range', name: 'scratch', min: 0, max: 5, step: 0.01 },
      { type: 'range', name: 'scratchDensity', min: 0, max: 5, step: 0.01 },
      { type: 'range', name: 'scratchWidth', min: 0, max: 20, step: 0.01 },
      { type: 'range', name: 'vignetting', min: 0, max: 1, step: 0.01 },
      { type: 'range', name: 'vignettingAlpha', min: 0, max: 1, step: 0.01 },
      { type: 'range', name: 'vignettingBlur', min: 0, max: 5, step: 0.01 },
    ],
    argType: 'options',
  },
  OutlineFilter: {
    defaultValues: {
      thickness: 1,
      color: 0x000000,
      quality: 0.1,
    },
    controls: [
      { type: 'range', name: 'thickness', min: 0, max: 20, step: 0.1 },
      { type: 'color', name: 'color' },
      { type: 'range', name: 'quality', min: 0, max: 1, step: 0.01 },
    ],
    argType: 'args',
  },
  PixelateFilter: {
    defaultValues: {
      size: 1,
    },
    controls: [{ type: 'range', name: 'size', min: 1, max: 100, step: 1 }],
    argType: 'args',
  },
  RGBSplitFilter: {
    defaultValues: {
      red: [-10, 0],
      green: [0, 10],
      blue: [0, 0],
    },
    controls: [
      { type: 'point', name: 'red', min: 0, max: 50, step: 1 },
      { type: 'point', name: 'green', min: 0, max: 50, step: 1 },
      { type: 'point', name: 'blue', min: 0, max: 50, step: 1 },
    ],
    argType: 'args',
  },
  RadialBlurFilter: {
    defaultValues: {
      angle: 0,
      center: [0, 0],
      radius: -1,
    },
    controls: [
      { type: 'range', name: 'angle', min: 0, max: 360, step: 1 },
      { type: 'point', name: 'center', min: 0, max: 1000, step: 1 },
      { type: 'range', name: 'radius', min: -1, max: 1000, step: 1 },
    ],
    argType: 'args',
  },
  ReflectionFilter: {
    defaultValues: {
      mirror: true,
      boundary: 0.5,
      amplitude: [0, 20],
      waveLength: [30, 100],
      alpha: [1, 1],
      time: 0,
    },
    controls: [
      { type: 'boolean', name: 'mirror' },
      { type: 'range', name: 'boundary', min: 0, max: 1, step: 0.01 },
      { type: 'point', name: 'amplitude', min: 0, max: 100, step: 1 },
      { type: 'point', name: 'waveLength', min: 0, max: 500, step: 1 },
      { type: 'point', name: 'alpha', min: 0, max: 1, step: 0.01 },
      { type: 'range', name: 'time', min: 0, max: 10000, step: 1 },
    ],
    argType: 'options',
  },
  'Token Magic FX': {
    defaultValues: {
      params: [],
    },
    controls: [{ type: 'json', name: 'params' }],
  },
};

function genFilterOptionControls(filterName, filterOptions = {}) {
  if (!(filterName in FILTERS)) return;

  const options = mergeObject(FILTERS[filterName].defaultValues, filterOptions);
  const values = getControlValues(filterName, options);

  const controls = FILTERS[filterName].controls;
  let controlsHTML = '<fieldset><legend>Options</legend>';
  for (const control of controls) {
    controlsHTML += genControl(control, values);
  }
  controlsHTML += '</fieldset>';

  return controlsHTML;
}

function getControlValues(filterName, options) {
  if (filterName === 'OutlineOverlayFilter') {
    options.outlineColor = Color.fromRGB(options.outlineColor).toString();
  } else if (filterName === 'BevelFilter') {
    options.lightColor = Color.from(options.lightColor).toString();
    options.shadowColor = Color.from(options.shadowColor).toString();
  } else if (['DropShadowFilter', 'GlowFilter', 'OutlineFilter'].includes(filterName)) {
    options.color = Color.from(options.color).toString();
  }
  return options;
}

function genControl(control, values) {
  const val = values[control.name];
  const name = control.name;
  const label = control.label ?? name.charAt(0).toUpperCase() + name.slice(1);
  const type = control.type;
  if (type === 'color') {
    return `
<div class="form-group">
  <label>${label}</label>
  <div class="form-fields">
      <input class="color" type="text" name="filterOptions.${name}" value="${val}">
      <input type="color" value="${val}" data-edit="filterOptions.${name}">
  </div>
</div>
`;
  } else if (type === 'range') {
    return `
<div class="form-group">
  <label>${label}</label>
  <div class="form-fields">
      <input type="range" name="filterOptions.${name}" value="${val}" min="${control.min}" max="${control.max}" step="${control.step}">
      <span class="range-value">${val}</span>
  </div>
</div>
`;
  } else if (type === 'boolean') {
    return `
<div class="form-group">
  <label>${label}</label>
  <div class="form-fields">
      <input type="checkbox" name="filterOptions.${name}" data-dtype="Boolean" value="${val}" ${
      val ? 'checked' : ''
    }>
  </div>
</div>
    `;
  } else if (type === 'select') {
    let select = `
    <div class="form-group">
    <label>${label}</label>
    <div class="form-fields">
      <select name="${name}">
`;

    for (const opt of control.options) {
      select += `<option value="${opt.value}" ${val === opt.value ? 'selected="selected"' : ''}>${
        opt.label
      }</option>`;
    }

    select += `</select></div></div>`;

    return select;
  } else if (type === 'point') {
    return `
<div class="form-group">
  <label>${label}</label>
  <div class="form-fields">
      <input type="range" name="filterOptions.${name}" value="${val[0]}" min="${control.min}" max="${control.max}" step="${control.step}">
      <span class="range-value">${val[0]}</span>
  </div>
  <div class="form-fields">
    <input type="range" name="filterOptions.${name}" value="${val[1]}" min="${control.min}" max="${control.max}" step="${control.step}">
    <span class="range-value">${val[1]}</span>
  </div>
</div>
`;
  } else if (type === 'json') {
    let control = `
<div class="form-group">
  <label>${label}</label>
  <div class="form-fields">
      <textarea style="width: 450px; height: 200px;" name="filterOptions.${name}">${val}</textarea>
  </div>`;
    if (game.modules.get('multi-token-edit')?.api.showGenericForm) {
      control += `
  <div style="text-align: right; color: orangered;">
      <a> <i class="me-edit-json fas fa-edit" title="Show Generic Form"></i></a>
  </div>`;
    }
    control += `</div>`;
    return control;
  }
}

async function promptParamChoice(params) {
  return new Promise((resolve, reject) => {
    const buttons = {};
    for (let i = 0; i < params.length; i++) {
      const label = params[i].filterType ?? params[i].filterId;
      buttons[label] = {
        label,
        callback: () => {
          resolve(i);
        },
      };
    }

    const dialog = new Dialog({
      title: 'Select Filter To Edit',
      content: '',
      buttons,
      close: () => resolve(-1),
    });
    dialog.render(true);
  });
}
