import { CORE_SHAPE, DEFAULT_OVERLAY_CONFIG, OVERLAY_SHAPES } from '../scripts/models.js';
import { VALID_EXPRESSION, getAllEffectMappings } from '../scripts/hooks/effectMappingHooks.js';
import { evaluateObjExpressions, genTexture } from '../scripts/token/overlay.js';
import { SEARCH_TYPE } from '../scripts/utils.js';
import { showArtSelect } from '../token-variants.mjs';
import { sortMappingsToGroups } from './effectMappingForm.js';
import { getFlagMappings } from '../scripts/settings.js';

export default class OverlayConfig extends FormApplication {
  constructor(config, callback, id, token) {
    super({}, {});
    this.config = config ?? {};
    this.config.id = id;
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

    html.find('.repeat').on('change', (event) => {
      const content = $(event.target).closest('fieldset').find('.content');
      if (event.target.checked) content.show();
      else content.hide();
      this.setPosition();
    });

    // Insert Controls to the Shape Legend
    const shapeLegends = html.find('.shape-legend');
    let config = this.config;
    shapeLegends.each(function (i) {
      const legend = $(this);
      legend.append(
        `&nbsp;<a class="cloneShape" data-index="${i}" title="Clone"><i class="fas fa-clone"></i></a>
         &nbsp;<a class="deleteShape" data-index="${i}" title="Remove"><i class="fas fa-trash-alt"></i></a>`
      );
      if (i != 0) {
        legend.append(
          `&nbsp;<a class="moveShapeUp" data-index="${i}" title="Move Up"><i class="fas fa-arrow-up"></i></a>`
        );
      }
      if (i != shapeLegends.length - 1) {
        legend.append(
          `&nbsp;<a class="moveShapeDown" data-index="${i}" title="Move Down"><i class="fas fa-arrow-down"></i></a>`
        );
      }
      legend.append(
        `<input class="shape-legend-input" type="text" name="shapes.${i}.label" value="${
          config.shapes?.[i]?.label ?? ''
        }">`
      );
    });

    // Shape listeners
    html.find('.addShape').on('click', this._onAddShape.bind(this));
    html.find('.deleteShape').on('click', this._onDeleteShape.bind(this));
    html.find('.moveShapeUp').on('click', this._onMoveShapeUp.bind(this));
    html.find('.moveShapeDown').on('click', this._onMoveShapeDown.bind(this));
    html.find('.cloneShape').on('click', this._onCloneShape.bind(this));

    html.find('input,select').on('change', this._onInputChange.bind(this));
    html.find('textarea').on('input', this._onInputChange.bind(this));
    html.find('[name="parentID"]').on('change', (event) => {
      if (event.target.value === 'TOKEN') {
        html.find('.token-specific-fields').show();
      } else {
        html.find('.token-specific-fields').hide();
      }
      this.setPosition();
    });
    html.find('[name="parentID"]').trigger('change');

    html.find('[name="filter"]').on('change', (event) => {
      html.find('.filterOptions').empty();
      const filterOptions = $(genFilterOptionControls(event.target.value));
      html.find('.filterOptions').append(filterOptions);
      this.setPosition({ height: 'auto' });
      this.activateListeners(filterOptions);
    });

    html.find('.token-variants-image-select-button').click((event) => {
      showArtSelect(this.token?.name ?? 'overlay', {
        searchType: SEARCH_TYPE.TOKEN,
        callback: (imgSrc, imgName) => {
          if (imgSrc) $(event.target).closest('.form-group').find('input').val(imgSrc).trigger('change');
        },
      });
    });

    html.find('.presetImport').on('click', (event) => {
      const presetName = $(event.target).closest('.form-group').find('.tmfxPreset').val();
      if (presetName) {
        const preset = TokenMagic.getPreset(presetName);
        if (preset) {
          $(event.target).closest('.form-group').find('textarea').val(JSON.stringify(preset, null, 2)).trigger('input');
        }
      }
    });

    // Controls for locking scale sliders together
    let scaleState = { locked: true };

    html.find('.offsetX, .offsetY').on('change', (event) => {
      $(event.target).siblings('.range-value').val($(event.target).val()).trigger('change');
    });

    const lockButtons = $(html).find('.scaleLock > a');
    const sliderScaleWidth = $(html).find('[name="scaleX"]');
    const sliderScaleHeight = $(html).find('[name="scaleY"]');
    const sliderWidth = html.find('.scaleX');
    const sliderHeight = html.find('.scaleY');

    lockButtons.on('click', function () {
      scaleState.locked = !scaleState.locked;
      lockButtons.html(scaleState.locked ? '<i class="fas fa-link"></i>' : '<i class="fas fa-unlink"></i>');
    });

    sliderScaleWidth.on('change', function () {
      if (scaleState.locked && sliderScaleWidth.val() !== sliderScaleHeight.val()) {
        sliderScaleHeight.val(sliderScaleWidth.val()).trigger('change');
        sliderHeight.val(sliderScaleWidth.val());
      }
    });
    sliderScaleHeight.on('change', function () {
      if (scaleState.locked && sliderScaleWidth.val() !== sliderScaleHeight.val()) {
        sliderScaleWidth.val(sliderScaleHeight.val()).trigger('change');
        sliderWidth.val(sliderScaleHeight.val());
      }
    });
    html.on('change', '.scaleX', () => {
      sliderScaleWidth.trigger('change');
    });
    html.on('change', '.scaleY', () => {
      sliderScaleHeight.trigger('change');
    });

    html.find('.me-edit-json').on('click', async (event) => {
      const textarea = $(event.target).closest('.form-group').find('textarea');
      let params;
      try {
        params = eval(textarea.val());
      } catch (e) {
        console.warn('TVA |', e);
      }

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
          game.modules.get('multi-token-edit').api.showGenericForm(param, param.filterType ?? 'TMFX', {
            inputChangeCallback: (selected) => {
              mergeObject(param, selected, { inplace: true });
              textarea.val(JSON.stringify(params, null, 2)).trigger('input');
            },
          });
      }
    });

    const underlay = html.find('[name="underlay"]');
    const top = html.find('[name="top"]');
    const bottom = html.find('[name="bottom"]');
    underlay.change(function () {
      if (this.checked) top.prop('checked', false);
      else bottom.prop('checked', false);
    });
    top.change(function () {
      if (this.checked) {
        underlay.prop('checked', false);
        bottom.prop('checked', false);
      }
    });
    bottom.change(function () {
      if (this.checked) {
        underlay.prop('checked', true);
        top.prop('checked', false);
      }
    });

    const linkScale = html.find('[name="linkScale"]');
    const linkDimensions = html.find('[name="linkDimensionsX"], [name="linkDimensionsY"]');
    const linkStageScale = html.find('[name="linkStageScale"]');
    linkScale.change(function () {
      if (this.checked) {
        linkDimensions.prop('checked', false);
        linkStageScale.prop('checked', false);
      }
    });
    linkDimensions.change(function () {
      if (this.checked) {
        linkScale.prop('checked', false);
        linkStageScale.prop('checked', false);
      }
    });
    linkStageScale.change(function () {
      if (this.checked) {
        linkScale.prop('checked', false);
        linkDimensions.prop('checked', false);
      }
    });

    // Setting border color for property expression
    const limitOnProperty = html.find('[name="limitOnProperty"]');
    limitOnProperty.on('input', (event) => {
      const input = $(event.target);
      if (input.val() === '') {
        input.removeClass('tvaValid');
        input.removeClass('tvaInvalid');
      } else if (input.val().match(VALID_EXPRESSION)) {
        input.addClass('tvaValid');
        input.removeClass('tvaInvalid');
      } else {
        input.addClass('tvaInvalid');
        input.removeClass('tvaValid');
      }
    });
    limitOnProperty.trigger('input');

    html.find('.create-variable').on('click', this._onCreateVariable.bind(this));
    html.find('.delete-variable').on('click', this._onDeleteVariable.bind(this));
  }

  _onDeleteVariable(event) {
    let index = $(event.target).closest('tr').data('index');
    if (index != null) {
      this.config = this._getSubmitData();
      if (!this.config.variables) this.config.variables = [];
      this.config.variables.splice(index, 1);
      this.render(true);
    }
  }

  _onCreateVariable(event) {
    this.config = this._getSubmitData();
    if (!this.config.variables) this.config.variables = [];
    this.config.variables.push({ name: '', value: '' });
    this.render(true);
  }

  _onAddShape(event) {
    let shape = $(event.target).siblings('select').val();
    shape = deepClone(OVERLAY_SHAPES[shape]);
    shape = mergeObject(deepClone(CORE_SHAPE), { shape });

    this.config = this._getSubmitData();

    if (!this.config.shapes) this.config.shapes = [];
    this.config.shapes.push(shape);

    this.render(true);
  }

  _onDeleteShape(event) {
    const index = $(event.target).closest('.deleteShape').data('index');
    if (index == null) return;

    this.config = this._getSubmitData();
    if (!this.config.shapes) this.config.shapes = [];
    this.config.shapes.splice(index, 1);

    this.render(true);
  }

  _onCloneShape(event) {
    const index = $(event.target).closest('.cloneShape').data('index');
    if (!index && index != 0) return;

    this.config = this._getSubmitData();
    if (!this.config.shapes) return;
    const nShape = deepClone(this.config.shapes[index]);
    if (nShape.label) {
      nShape.label = nShape.label + ' - Copy';
    }
    this.config.shapes.push(nShape);

    this.render(true);
  }

  _onMoveShapeUp(event) {
    const index = $(event.target).closest('.moveShapeUp').data('index');
    if (!index) return;

    this.config = this._getSubmitData();
    if (!this.config.shapes) this.config.shapes = [];
    if (this.config.shapes.length >= 2) this._swapShapes(index, index - 1);

    this.render(true);
  }

  _onMoveShapeDown(event) {
    const index = $(event.target).closest('.moveShapeDown').data('index');
    if (!index && index != 0) return;

    this.config = this._getSubmitData();
    if (!this.config.shapes) this.config.shapes = [];
    if (this.config.shapes.length >= 2) this._swapShapes(index, index + 1);

    this.render(true);
  }

  _swapShapes(i1, i2) {
    let temp = this.config.shapes[i1];
    this.config.shapes[i1] = this.config.shapes[i2];
    this.config.shapes[i2] = temp;
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
    this.previewConfig = this._getSubmitData();
    if (event.target.type === 'color') {
      const color = $(event.target).siblings('.color');
      color.val(event.target.value).trigger('change');
      return;
    }
    this._applyPreviews();
  }

  getPreviewIcons() {
    if (!this.config.id) return [];
    const tokens = this.token ? [this.token] : canvas.tokens.placeables;
    const previewIcons = [];
    for (const tkn of tokens) {
      if (tkn.tva_sprites) {
        for (const c of tkn.tva_sprites) {
          if (c.overlayConfig && c.overlayConfig.id === this.config.id) {
            // Effect icon found, however if we're in global preview then we need to take into account
            // a token/actor specific mapping which may override the global one
            if (this.token) {
              previewIcons.push({ token: tkn, icon: c });
            } else if (!getFlagMappings(tkn).find((m) => m.id === this.config.id)) {
              previewIcons.push({ token: tkn, icon: c });
            }
          }
        }
      }
    }
    return previewIcons;
  }

  async _applyPreviews() {
    const targets = this.getPreviewIcons();
    for (const target of targets) {
      const preview = evaluateObjExpressions(deepClone(this.previewConfig), target.token, {
        overlayConfig: this.previewConfig,
      });
      target.icon.refresh(preview, {
        preview: true,
        previewTexture: await genTexture(target.token, preview),
      });
    }
  }

  async _removePreviews() {
    const targets = this.getPreviewIcons();
    for (const target of targets) {
      target.icon.refresh();
    }
  }

  async getData(options) {
    const data = super.getData(options);
    data.filters = Object.keys(PIXI.filters);
    data.filters.push('OutlineOverlayFilter');
    data.filters.sort();
    if (typeof TokenMagic !== 'undefined') data.filters.unshift('Token Magic FX');
    data.filters.unshift('NONE');
    const settings = mergeObject(DEFAULT_OVERLAY_CONFIG, this.config, {
      inplace: false,
    });

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

    data.fonts = Object.keys(CONFIG.fontDefinitions);

    const allMappings = getAllEffectMappings(this.token, true).filter((m) => m.id !== this.config.id);
    const [_, groupedMappings] = sortMappingsToGroups(allMappings);

    data.parents = groupedMappings;
    if (!data.parentID) data.parentID = 'TOKEN';
    if (!data.anchor) data.anchor = { x: 0.5, y: 0.5 };

    // Cache Partials
    for (const shapeName of Object.keys(OVERLAY_SHAPES)) {
      await getTemplate(`modules/token-variants/templates/partials/shape${shapeName}.html`);
    }
    await getTemplate('modules/token-variants/templates/partials/repeating.html');

    data.allShapes = Object.keys(OVERLAY_SHAPES);
    data.textAlignmentOptions = [
      { value: 'left', label: 'Left' },
      { value: 'center', label: 'Center' },
      { value: 'right', label: 'Right' },
      { value: 'justify', label: 'Justify' },
    ];

    // linkDimensions has been converted to linkDimensionsX and linkDimensionsY
    // Make sure we're using the latest fields
    // 20/07/2023
    if (!('linkDimensionsX' in settings) && settings.linkDimensions) {
      settings.linkDimensionsX = true;
      settings.linkDimensionsY = true;
    }

    return mergeObject(data, settings);
  }

  async close(options = {}) {
    super.close(options);
    this._removePreviews();
  }

  _getSubmitData() {
    let formData = super._getSubmitData();
    formData = expandObject(formData);

    if (!formData.text.repeating) delete formData.text.repeat;

    if (formData.shapes) {
      formData.shapes = Object.values(formData.shapes);
      formData.shapes.forEach((shape) => {
        if (!shape.repeating) delete shape.repeat;
      });
    }
    if (formData.variables) {
      formData.variables = Object.values(formData.variables);
      formData.variables = formData.variables.filter((v) => v.name.trim() && v.value.trim());
    }
    if (formData.limitedUsers) {
      if (getType(formData.limitedUsers) === 'string') formData.limitedUsers = [formData.limitedUsers];
      formData.limitedUsers = formData.limitedUsers.filter((uid) => uid);
    } else {
      formData.limitedUsers = [];
    }

    formData.limitOnEffect = formData.limitOnEffect.trim();
    formData.limitOnProperty = formData.limitOnProperty.trim();
    if (formData.parentID === 'TOKEN') formData.parentID = '';

    if (formData.filter === 'OutlineOverlayFilter' && 'filterOptions.outlineColor' in formData) {
      formData['filterOptions.outlineColor'] = this._convertColor(formData['filterOptions.outlineColor']);
    } else if (formData.filter === 'BevelFilter') {
      if ('filterOptions.lightColor' in formData)
        formData['filterOptions.lightColor'] = Number(Color.fromString(formData['filterOptions.lightColor']));
      if ('filterOptions.shadowColor' in formData)
        formData['filterOptions.shadowColor'] = Number(Color.fromString(formData['filterOptions.shadowColor']));
    } else if (['DropShadowFilter', 'GlowFilter', 'OutlineFilter', 'FilterFire'].includes(formData.filter)) {
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
    if (this.callback) this.callback(formData);
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
  DisplacementFilter: {
    defaultValues: {
      sprite: '',
      textureScale: 1,
      displacementScale: 1,
    },
    controls: [
      { type: 'text', name: 'sprite' },
      { type: 'range', name: 'textureScale', min: 0, max: 100, step: 0.1 },
      { type: 'range', name: 'displacementScale', min: 0, max: 100, step: 0.1 },
    ],
    argType: 'options',
  },
  'Token Magic FX': {
    defaultValues: {
      params: [],
    },
    controls: [
      { type: 'tmfxPreset', name: 'tmfxPreset' },
      { type: 'json', name: 'params' },
    ],
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
      <input type="checkbox" name="filterOptions.${name}" data-dtype="Boolean" value="${val}" ${val ? 'checked' : ''}>
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
      select += `<option value="${opt.value}" ${val === opt.value ? 'selected="selected"' : ''}>${opt.label}</option>`;
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
  } else if (type === 'text') {
    return `
<div class="form-group">
  <label>${label}</label>
  <div class="form-fields">
      <input type="text" name="filterOptions.${name}" value="${val}">
  </div>
</div>
`;
  } else if (type === 'tmfxPreset' && game.modules.get('tokenmagic')?.active) {
    let content = '<datalist id="tmfxPresets">';
    TokenMagic.getPresets().forEach((p) => (content += `<option value="${p.name}">`));
    content += `</datalist><input list="tmfxPresets" class="tmfxPreset">`;

    return `
      <div class="form-group">
        <label>Preset <span class="units">(TMFX)</span></label>
        <div class="form-fields">
          ${content}
          <button type="button" class="presetImport"><i class="fas fa-download"></i></button>
        </div>
      `;
  }
  return '';
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
