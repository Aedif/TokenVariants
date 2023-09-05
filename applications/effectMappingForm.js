import { showArtSelect } from '../token-variants.mjs';
import { SEARCH_TYPE, getFileName, isVideo, keyPressed } from '../scripts/utils.js';
import TokenCustomConfig from './tokenCustomConfig.js';
import {
  TVA_CONFIG,
  getFlagMappings,
  migrateMappings,
  updateSettings,
} from '../scripts/settings.js';
import EditJsonConfig from './configJsonEdit.js';
import EditScriptConfig from './configScriptEdit.js';
import OverlayConfig from './overlayConfig.js';
import {
  showMappingSelectDialog,
  showMappingTemplateDialog,
  showOverlayJsonConfigDialog,
  showTokenCaptureDialog,
} from './dialogs.js';
import { DEFAULT_ACTIVE_EFFECT_CONFIG } from '../scripts/models.js';
import { updateWithEffectMapping } from '../scripts/hooks/effectMappingHooks.js';
import { drawOverlays } from '../scripts/token/overlay.js';

// Persist group toggles across forms
let TOGGLED_GROUPS;

export default class EffectMappingForm extends FormApplication {
  constructor(token, { globalMappings = false, callback = null, createMapping = null } = {}) {
    super({}, { title: (globalMappings ? 'GLOBAL ' : 'ACTOR  ') + 'Mappings' });

    this.token = token;
    if (globalMappings) {
      this.globalMappings = deepClone(TVA_CONFIG.globalMappings).filter(Boolean);
    }
    if (!globalMappings) this.objectToFlag = game.actors.get(token.actorId);
    this.callback = callback;
    TOGGLED_GROUPS = game.settings.get('token-variants', 'effectMappingToggleGroups') || {
      Default: true,
    };
    this.createMapping = createMapping;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-active-effect-config',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/effectMappingForm.html',
      resizable: true,
      minimizable: false,
      closeOnSubmit: false,
      width: 1020,
      height: 'auto',
      scrollY: ['ol.token-variant-table'],
    });
  }

  _processConfig(mapping) {
    if (!mapping.config) mapping.config = {};
    let hasTokenConfig = Object.keys(mapping.config).filter((k) => mapping.config[k]).length;
    if (mapping.config.flags) hasTokenConfig--;
    if (mapping.config.tv_script) hasTokenConfig--;

    return {
      id: mapping.id || randomID(8),
      label: mapping.label,
      expression: mapping.expression,
      codeExp: mapping.codeExp,
      hasCodeExp: Boolean(mapping.codeExp),
      highlightedExpression: highlightOperators(mapping.expression),
      imgName: mapping.imgName,
      imgSrc: mapping.imgSrc,
      isVideo: mapping.imgSrc ? isVideo(mapping.imgSrc) : false,
      priority: mapping.priority,
      hasConfig: mapping.config ? !isEmpty(mapping.config) : false,
      hasScript: mapping.config && mapping.config.tv_script,
      hasTokenConfig: hasTokenConfig > 0,
      config: mapping.config,
      overlay: mapping.overlay,
      alwaysOn: mapping.alwaysOn,
      disabled: mapping.disabled,
      overlayConfig: mapping.overlayConfig,
      targetActors: mapping.targetActors,
      group: mapping.group,
      parentID: mapping.overlayConfig?.parentID,
    };
  }

  async getData(options) {
    const data = super.getData(options);

    let mappings = [];
    if (this.object.mappings) {
      mappings = this.object.mappings.map(this._processConfig);
    } else {
      const effectMappings = this.globalMappings ?? getFlagMappings(this.objectToFlag);
      mappings = effectMappings.map(this._processConfig);

      if (
        this.createMapping &&
        !effectMappings.find((m) => m.expression === this.createMapping.expression)
      ) {
        mappings.push(this._processConfig(this._getNewEffectConfig(this.createMapping)));
      }
      this.createMapping = null;
    }

    mappings = mappings.sort((m1, m2) => {
      if (!m1.label && m2.label) return -1;
      else if (m1.label && !m2.label) return 1;

      if (!m1.overlayConfig?.parentID && m2.overlayConfig?.parentID) return -1;
      else if (m1.overlayConfig?.parentID && !m2.overlayConfig?.parentID) return 1;

      let priorityDiff = m1.priority - m2.priority;
      if (priorityDiff === 0) return m1.label.localeCompare(m2.label);
      return priorityDiff;
    });

    const [sMappings, groupedMappings] = sortMappingsToGroups(mappings);
    data.groups = Object.keys(groupedMappings);

    this.object.mappings = sMappings;
    data.groupedMappings = groupedMappings;
    data.global = Boolean(this.globalMappings);
    return data;
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('.delete-mapping').click(this._onRemove.bind(this));
    html.find('.clone-mapping').click(this._onClone.bind(this));
    html.find('.create-mapping').click(this._onCreate.bind(this));
    html.find('.save-mappings').click(this._onSaveMappings.bind(this));
    if (TVA_CONFIG.permissions.image_path_button[game.user.role]) {
      html.find('.mapping-image img').click(this._onImageClick.bind(this));
      html.find('.mapping-image img').mousedown(this._onImageMouseDown.bind(this));
      html.find('.mapping-image video').click(this._onImageClick.bind(this));
      html.find('.mapping-target').click(this._onConfigureApplicableActors.bind(this));
    }
    html.find('.mapping-image img').contextmenu(this._onImageRightClick.bind(this));
    html.find('.mapping-image video').contextmenu(this._onImageRightClick.bind(this));
    html.find('.mapping-config i.config').click(this._onConfigClick.bind(this));
    html.find('.mapping-config i.config-edit').click(this._onConfigEditClick.bind(this));
    html.find('.mapping-config i.config-script').click(this._onConfigScriptClick.bind(this));
    html.find('.mapping-overlay i.overlay-config').click(this._onOverlayConfigClick.bind(this));
    html.on(
      'contextmenu',
      '.mapping-overlay i.overlay-config',
      this._onOverlayConfigRightClick.bind(this)
    );
    html.find('.mapping-overlay input').on('change', this._onOverlayChange).trigger('change');
    html.find('.div-input').on('input paste focus click', this._onExpressionChange);
    const app = this;
    html
      .find('.group-toggle > a')
      .on('click', this._onGroupToggle.bind(this))
      .each(function () {
        const group = $(this).closest('.group-toggle');
        const groupName = group.data('group');
        if (!TOGGLED_GROUPS[groupName]) {
          $(this).trigger('click');
        }
      });
    this.setPosition({ width: 1020 });
    html.find('.mapping-disable > input').on('change', this._onDisable.bind(this));
    html.find('.group-disable > a').on('click', this._onGroupDisable.bind(this));
    html.find('.group-delete').on('click', this._onGroupDelete.bind(this));
    html.find('.mapping-group > input').on('change', this._onGroupChange.bind(this));
    html.find('.expression-switch').on('click', this._onExpressionSwitch.bind(this));
    html
      .find('.expression-code textarea')
      .focus((event) => $(event.target).animate({ height: '10em' }, 500, () => this.setPosition()))
      .focusout((event) =>
        $(event.target).animate({ height: '1em' }, 500, () => {
          if (this._state === Application.RENDER_STATES.RENDERED) this.setPosition();
        })
      );
  }

  _onExpressionSwitch(event) {
    const container = $(event.target).closest('.expression-container');
    const divInput = container.find('.div-input');
    const codeExp = container.find('.expression-code');

    if (codeExp.hasClass('hidden')) {
      codeExp.removeClass('hidden');
      divInput.addClass('hidden');
    } else {
      codeExp.addClass('hidden');
      divInput.removeClass('hidden');
    }
  }

  async _onDisable(event) {
    const groupName = $(event.target).closest('.table-row').data('group');
    const disableGroupToggle = $(event.target)
      .closest('.token-variant-table')
      .find(`.group-disable[data-group="${groupName}"]`);

    const checkboxes = $(event.target)
      .closest('.token-variant-table')
      .find(`[data-group="${groupName}"] > .mapping-disable`);
    const numChecked = checkboxes.find('input:checked').length;

    if (checkboxes.length !== numChecked) {
      disableGroupToggle.addClass('active');
    } else disableGroupToggle.removeClass('active');
  }

  async _onGroupDisable(event) {
    const group = $(event.target).closest('.group-disable');
    const groupName = group.data('group');
    const chks = $(event.target)
      .closest('form')
      .find(`[data-group="${groupName}"]`)
      .find('.mapping-disable > input');

    if (group.hasClass('active')) {
      group.removeClass('active');
      chks.prop('checked', true);
    } else {
      group.addClass('active');
      chks.prop('checked', false);
    }
  }

  async _onGroupDelete(event) {
    const group = $(event.target).closest('.group-delete');
    const groupName = group.data('group');
    await this._onSubmit(event);
    this.object.mappings = this.object.mappings.filter((m) => m.group !== groupName);
    this.render();
  }

  async _onGroupChange(event) {
    const input = $(event.target);
    let group = input.val().trim();
    if (!group) group = 'Default';
    input.val(group);

    await this._onSubmit(event);
    this.render();
  }

  _onGroupToggle(event) {
    const group = $(event.target).closest('.group-toggle');
    const groupName = group.data('group');
    const form = $(event.target).closest('form');
    form.find(`li[data-group="${groupName}"]`).toggle();
    if (group.hasClass('active')) {
      group.removeClass('active');
      group.find('i').addClass('fa-rotate-180');
      TOGGLED_GROUPS[groupName] = false;
    } else {
      group.addClass('active');
      group.find('i').removeClass('fa-rotate-180');
      TOGGLED_GROUPS[groupName] = true;
    }
    game.settings.set('token-variants', 'effectMappingToggleGroups', TOGGLED_GROUPS);
    this.setPosition({ height: 'auto' });
  }

  async _onExpressionChange(event) {
    var el = event.target;

    // Update the hidden input field so that the text entered in the div will be submitted via the form
    $(el).siblings('input').val(event.target.innerText);

    // The rest of the function is to handle operator highlighting and management of the caret position

    if (!el.childNodes.length) return;

    // Calculate the true/total caret offset within the div
    const sel = window.getSelection();
    const focusNode = sel.focusNode;
    let offset = sel.focusOffset;

    for (const ch of el.childNodes) {
      if (ch === focusNode || ch.childNodes[0] === focusNode) break;
      offset += ch.nodeName === 'SPAN' ? ch.innerText.length : ch.length;
    }

    // Highlight the operators and update the div
    let text = highlightOperators(event.target.innerText);
    $(event.target).html(text);

    // Set the new caret position with the div
    setCaretPosition(el, offset);
  }

  async _onOverlayChange(event) {
    if (event.target.checked) {
      $(event.target).siblings('a').show();
    } else {
      $(event.target).siblings('a').hide();
    }
  }

  async _onOverlayConfigClick(event) {
    const li = event.currentTarget.closest('.table-row');
    const mapping = this.object.mappings[li.dataset.index];

    new OverlayConfig(
      mapping.overlayConfig,
      (config) => {
        mapping.overlayConfig = config;
        const gear = $(li).find('.mapping-overlay > a');
        if (config?.parentID && config.parentID !== 'TOKEN') {
          gear.addClass('child');
          gear.attr('title', 'Child Of: ' + config.parentID);
        } else {
          gear.removeClass('child');
          gear.attr('title', '');
        }
      },
      mapping.id,
      this.token
    ).render(true);
  }

  async _onOverlayConfigRightClick(event) {
    const li = event.currentTarget.closest('.table-row');
    const mapping = this.object.mappings[li.dataset.index];
    showOverlayJsonConfigDialog(
      mapping.overlayConfig,
      (config) => (mapping.overlayConfig = config)
    );
  }

  async _toggleActiveControls(event) {
    const li = event.currentTarget.closest('.table-row');
    const mapping = this.object.mappings[li.dataset.index];
    const tokenConfig = $(event.target).closest('.mapping-config').find('.config');
    const configEdit = $(event.target).closest('.mapping-config').find('.config-edit');
    const scriptEdit = $(event.target).closest('.mapping-config').find('.config-script');

    let hasTokenConfig = Object.keys(mapping.config).filter((k) => mapping.config[k]).length;
    if (mapping.config.flags) hasTokenConfig--;
    if (mapping.config.tv_script) hasTokenConfig--;

    if (hasTokenConfig) tokenConfig.addClass('active');
    else tokenConfig.removeClass('active');

    if (Object.keys(mapping.config).filter((k) => mapping.config[k]).length)
      configEdit.addClass('active');
    else configEdit.removeClass('active');

    if (mapping.config.tv_script) scriptEdit.addClass('active');
    else scriptEdit.removeClass('active');
  }

  async _onConfigScriptClick(event) {
    const li = event.currentTarget.closest('.table-row');
    const mapping = this.object.mappings[li.dataset.index];

    new EditScriptConfig(mapping.config?.tv_script, (script) => {
      if (!mapping.config) mapping.config = {};
      if (script) mapping.config.tv_script = script;
      else delete mapping.config.tv_script;
      this._toggleActiveControls(event);
    }).render(true);
  }

  async _onConfigEditClick(event) {
    const li = event.currentTarget.closest('.table-row');
    const mapping = this.object.mappings[li.dataset.index];

    new EditJsonConfig(mapping.config, (config) => {
      mapping.config = config;
      this._toggleActiveControls(event);
    }).render(true);
  }

  async _onConfigClick(event) {
    const li = event.currentTarget.closest('.table-row');
    const mapping = this.object.mappings[li.dataset.index];
    new TokenCustomConfig(
      this.token,
      {},
      null,
      null,
      (config) => {
        if (!config || isEmpty(config)) {
          config = {};
          config.tv_script = mapping.config.tv_script;
          config.flags = mapping.config.flags;
        }
        mapping.config = config;
        this._toggleActiveControls(event);
      },
      mapping.config ? mapping.config : {}
    ).render(true);
  }

  _removeImage(event) {
    const vid = $(event.target).closest('.mapping-image').find('video');
    const img = $(event.target).closest('.mapping-image').find('img');
    vid.add(img).attr('src', '').attr('title', '');
    vid.hide();
    img.show();
    $(event.target).siblings('.imgSrc').val('');
    $(event.target).siblings('.imgName').val('');
  }

  async _onImageMouseDown(event) {
    if (event.which === 2) {
      this._removeImage(event);
    }
  }

  async _onImageClick(event) {
    if (keyPressed('config')) {
      this._removeImage(event);
      return;
    }

    let search = this.token.name;
    if (search === 'Unknown') {
      const li = event.currentTarget.closest('.table-row');
      const mapping = this.object.mappings[li.dataset.index];
      search = mapping.label;
    }

    showArtSelect(search, {
      searchType: SEARCH_TYPE.TOKEN,
      callback: (imgSrc, imgName) => {
        const vid = $(event.target).closest('.mapping-image').find('video');
        const img = $(event.target).closest('.mapping-image').find('img');
        vid.add(img).attr('src', imgSrc).attr('title', imgName);
        if (isVideo(imgSrc)) {
          vid.show();
          img.hide();
        } else {
          vid.hide();
          img.show();
        }
        $(event.target).siblings('.imgSrc').val(imgSrc);
        $(event.target).siblings('.imgName').val(imgName);
      },
    });
  }

  async _onImageRightClick(event) {
    if (keyPressed('config')) {
      this._removeImage(event);
      return;
    }

    const li = event.currentTarget.closest('.table-row');
    const mapping = this.object.mappings[li.dataset.index];

    new FilePicker({
      type: 'imagevideo',
      current: mapping.imgSrc,
      callback: (path) => {
        const vid = $(event.target).closest('.mapping-image').find('video');
        const img = $(event.target).closest('.mapping-image').find('img');
        vid.add(img).attr('src', path).attr('title', getFileName(path));
        if (isVideo(path)) {
          vid.show();
          img.hide();
        } else {
          vid.hide();
          img.show();
        }
        $(event.target).siblings('.imgSrc').val(path);
        $(event.target).siblings('.imgName').val(getFileName(path));
      },
    }).render();
  }

  async _onRemove(event) {
    event.preventDefault();
    await this._onSubmit(event);
    const li = event.currentTarget.closest('.table-row');
    this.object.mappings.splice(li.dataset.index, 1);
    this.render();
  }

  async _onClone(event) {
    event.preventDefault();
    await this._onSubmit(event);
    const li = event.currentTarget.closest('.table-row');
    const clone = deepClone(this.object.mappings[li.dataset.index]);
    clone.label = clone.label + ' - Copy';
    clone.id = randomID(8);
    this.object.mappings.push(clone);
    this.render();
  }

  async _onCreate(event) {
    event.preventDefault();
    await this._onSubmit(event);
    this.object.mappings.push(this._getNewEffectConfig());
    this.render();
  }

  _getNewEffectConfig({ label = '', expression = '' } = {}) {
    // if (textOverlay) {
    //   TOGGLED_GROUPS['Text Overlays'] = true;
    //   return {
    //     id: randomID(8),
    //     label: label,
    //     expression: label,
    //     highlightedExpression: highlightOperators(label),
    //     imgName: '',
    //     imgSrc: '',
    //     priority: 50,
    //     overlay: false,
    //     alwaysOn: false,
    //     disabled: false,
    //     group: 'Text Overlays',
    //     overlay: true,
    //     overlayConfig: mergeObject(
    //       DEFAULT_OVERLAY_CONFIG,
    //       {
    //         img: '',
    //         linkScale: false,
    //         linkRotation: false,
    //         linkMirror: false,
    //         offsetY: 0.5 + Math.round(Math.random() * 0.3 * 100) / 100,
    //         offsetX: 0,
    //         scaleX: 0.68,
    //         scaleY: 0.68,
    //         text: {
    //           text: '{{effect}}',
    //           fontFamily: CONFIG.defaultFontFamily,
    //           fontSize: 36,
    //           fill: new Color(Math.round(Math.random() * 16777215)).toString(),
    //           stroke: '#000000',
    //           strokeThickness: 2,
    //           dropShadow: false,
    //           curve: {
    //             radius: 160,
    //             invert: false,
    //           },
    //         },
    //         animation: {
    //           rotate: true,
    //           duration: 10000 + Math.round(Math.random() * 14000) + 10000,
    //           clockwise: true,
    //         },
    //       },
    //       { inplace: false }
    //     ),
    //   };
    // } else {
    TOGGLED_GROUPS['Default'] = true;
    return mergeObject(deepClone(DEFAULT_ACTIVE_EFFECT_CONFIG), {
      label,
      expression,
      id: randomID(8),
    });
    // }
  }

  _getHeaderButtons() {
    const buttons = super._getHeaderButtons();

    buttons.unshift({
      label: 'Export',
      class: 'token-variants-export',
      icon: 'fas fa-file-export',
      onclick: (ev) => this._exportConfigs(ev),
    });
    buttons.unshift({
      label: 'Import',
      class: 'token-variants-import',
      icon: 'fas fa-file-import',
      onclick: (ev) => this._importConfigs(ev),
    });

    buttons.unshift({
      label: 'Templates',
      class: 'token-variants-templates',
      icon: 'fa-solid fa-book',
      onclick: async (ev) => {
        showMappingTemplateDialog(
          this.globalMappings ?? getFlagMappings(this.objectToFlag),
          (template) => {
            this._insertMappings(ev, template.mappings);
          }
        );
      },
    });

    if (this.globalMappings) return buttons;

    buttons.unshift({
      label: 'Copy Global Config',
      class: 'token-variants-copy-global',
      icon: 'fas fa-globe',
      onclick: (ev) => this._copyGlobalConfig(ev),
    });
    buttons.unshift({
      label: 'Open Global',
      class: 'token-variants-open-global',
      icon: 'fas fa-globe',
      onclick: async (ev) => {
        await this.close();
        new EffectMappingForm(this.token, { globalMappings: true }).render(true);
      },
    });

    buttons.unshift({
      label: '',
      class: 'token-variants-print-token',
      icon: 'fa fa-print',
      onclick: () => showTokenCaptureDialog(canvas.tokens.get(this.token._id)),
    });
    return buttons;
  }

  async _exportConfigs(event) {
    let mappings;
    let filename = '';
    if (this.globalMappings) {
      mappings = { globalMappings: deepClone(TVA_CONFIG.globalMappings) };
      filename = 'token-variants-global-mappings.json';
    } else {
      mappings = {
        globalMappings: deepClone(getFlagMappings(this.objectToFlag)),
      };

      let actorName = this.objectToFlag.name ?? 'Actor';
      actorName = actorName.replace(/[/\\?%*:|"<>]/g, '-');
      filename = 'token-variants-' + actorName + '.json';
    }

    if (mappings && !isEmpty(mappings)) {
      saveDataToFile(JSON.stringify(mappings, null, 2), 'text/json', filename);
    }
  }

  async _importConfigs(event) {
    const content = await renderTemplate('templates/apps/import-data.html', {
      entity: 'token-variants',
      name: 'settings',
    });
    let dialog = new Promise((resolve, reject) => {
      new Dialog(
        {
          title: 'Import Effect Configurations',
          content: content,
          buttons: {
            import: {
              icon: '<i class="fas fa-file-import"></i>',
              label: game.i18n.localize('token-variants.common.import'),
              callback: (html) => {
                const form = html.find('form')[0];
                if (!form.data.files.length)
                  return ui.notifications?.error('You did not upload a data file!');
                readTextFromFile(form.data.files[0]).then((json) => {
                  json = JSON.parse(json);
                  if (!json || !('globalMappings' in json)) {
                    return ui.notifications?.error('No mappings found within the file!');
                  }

                  this._insertMappings(event, migrateMappings(json.globalMappings));
                  resolve(true);
                });
              },
            },
            no: {
              icon: '<i class="fas fa-times"></i>',
              label: 'Cancel',
              callback: (html) => resolve(false),
            },
          },
          default: 'import',
        },
        {
          width: 400,
        }
      ).render(true);
    });
    return await dialog;
  }

  _copyGlobalConfig(event) {
    showMappingSelectDialog(TVA_CONFIG.globalMappings, {
      title1: 'Global Mappings',
      title2: 'Select Mappings to Copy:',
      buttonTitle: 'Copy',
      callback: (mappings) => {
        this._insertMappings(event, mappings);
      },
    });
  }

  async _insertMappings(event, mappings) {
    const cMappings = deepClone(mappings).map(this._processConfig);
    await this._onSubmit(event);

    const changedIDs = {};

    for (const m of cMappings) {
      const i = this.object.mappings.findIndex(
        (mapping) => mapping.label === m.label && mapping.group === m.group
      );
      if (i === -1) this.object.mappings.push(m);
      else {
        changedIDs[this.object.mappings.id] = m.id;
        this.object.mappings[i] = m;
      }
      if (m.group) {
        TOGGLED_GROUPS[m.group] = true;
      }
    }

    // If parent's id has been changed we need to update all the children
    this.object.mappings.forEach((m) => {
      let pID = m.overlayConfig?.parentID;
      if (pID && pID in changedIDs) {
        m.overlayConfig.parentID = changedIDs[pID];
      }
    });
    this.render();
  }

  _onConfigureApplicableActors(event) {
    const li = event.currentTarget.closest('.table-row');
    const mapping = this.object.mappings[li.dataset.index];

    let actorTypes = (game.system.entityTypes ?? game.system.documentTypes)['Actor'];
    let actors = [];
    for (const t of actorTypes) {
      const label = CONFIG['Actor']?.typeLabels?.[t] ?? t;
      actors.push({
        id: t,
        label: game.i18n.has(label) ? game.i18n.localize(label) : t,
        enabled: !mapping.targetActors || mapping.targetActors.includes(t),
      });
    }

    let content = '<form style="overflow-y: scroll; height:250x;">';
    for (const act of actors) {
      content += `
      <div class="form-group">
        <label>${act.label}</label>
        <div class="form-fields">
            <input type="checkbox" name="${act.id}" data-dtype="Boolean" ${
        act.enabled ? 'checked' : ''
      }>
        </div>
      </div>
      `;
    }
    content += `</form><div class="form-group"><button type="button" class="select-all">Select all</div>`;

    new Dialog({
      title: `Configure Applicable Actors`,
      content: content,
      buttons: {
        Ok: {
          label: `Save`,
          callback: async (html) => {
            let targetActors = [];
            html.find('input[type="checkbox"]').each(function () {
              if (this.checked) {
                targetActors.push(this.name);
              }
            });
            mapping.targetActors = targetActors;
          },
        },
      },
      render: (html) => {
        html.find('.select-all').click(() => {
          html.find('input[type="checkbox"]').prop('checked', true);
        });
      },
    }).render(true);
  }

  // TODO fix this spaghetti code related to globalMappings...
  async _onSaveMappings(event) {
    await this._onSubmit(event);
    if (this.objectToFlag || this.globalMappings) {
      // First filter out empty mappings
      let mappings = this.object.mappings;
      mappings = mappings.filter((m) => Boolean(m.label?.trim()) || Boolean(m.expression?.trim()));

      // Make sure a priority is assigned
      for (const mapping of mappings) {
        mapping.priority = mapping.priority ? mapping.priority : 50;
        mapping.overlayConfig = mapping.overlayConfig ?? {};
        mapping.overlayConfig.label = mapping.label;
      }

      if (mappings.length !== 0) {
        const effectMappings = mappings.map((m) =>
          mergeObject(DEFAULT_ACTIVE_EFFECT_CONFIG, m, {
            inplace: false,
            insertKeys: false,
            recursive: false,
          })
        );
        if (this.globalMappings) {
          updateSettings({ globalMappings: effectMappings });
        } else {
          await this.objectToFlag.setFlag('token-variants', 'effectMappings', effectMappings);
        }
      } else if (this.globalMappings) {
        updateSettings({ globalMappings: [] });
      } else {
        await this.objectToFlag.unsetFlag('token-variants', 'effectMappings');
      }

      const tokens = this.globalMappings
        ? canvas.tokens.placeables
        : this.objectToFlag.getActiveTokens();
      for (const tkn of tokens) {
        if (TVA_CONFIG.filterEffectIcons) {
          await tkn.drawEffects();
        }
        await updateWithEffectMapping(tkn);
        drawOverlays(tkn);
      }

      // Instruct users on other scenes to refresh the overlays
      const message = {
        handlerName: 'drawOverlays',
        args: { all: true, sceneId: canvas.scene.id },
        type: 'UPDATE',
      };
      game.socket?.emit('module.token-variants', message);
    }
    if (this.callback) this.callback();
    this.close();
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    const mappings = expandObject(formData).mappings ?? {};

    // Merge form data with internal mappings
    for (let i = 0; i < this.object.mappings.length; i++) {
      const m1 = mappings[i];
      const m2 = this.object.mappings[i];
      m2.id = m1.id;
      m2.label = m1.label.replaceAll(String.fromCharCode(160), ' ');
      m2.expression = m1.expression.replaceAll(String.fromCharCode(160), ' ');
      m2.codeExp = m1.codeExp?.trim();
      m2.imgSrc = m1.imgSrc;
      m2.imgName = m1.imgName;
      m2.priority = m1.priority;
      m2.overlay = m1.overlay;
      m2.alwaysOn = m1.alwaysOn;
      m2.disabled = m1.disabled;
      m2.group = m1.group;
    }
  }
}

// Insert <span/> around operators
function highlightOperators(text) {
  // text = text.replaceAll(' ', '&nbsp;');

  const re = new RegExp('([a-zA-Z\\.\\-\\|\\+]+)([><=]+)(".*?"|-?\\d+)(%{0,1})', `gi`);
  text = text.replace(re, function replace(match) {
    return '<span class="hp-expression">' + match + '</span>';
  });

  for (const op of ['\\(', '\\)', '&&', '||', '\\!', '\\*', '\\{', '\\}']) {
    text = text.replaceAll(op, `<span>${op}</span>`);
  }
  return text;
}

// Move caret to a specific point in a DOM element
function setCaretPosition(el, pos) {
  for (var node of el.childNodes) {
    // Check if it's a text node
    if (node.nodeType == 3) {
      if (node.length >= pos) {
        var range = document.createRange(),
          sel = window.getSelection();
        range.setStart(node, pos);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return -1; // We are done
      } else {
        pos -= node.length;
      }
    } else {
      pos = setCaretPosition(node, pos);
      if (pos == -1) {
        return -1; // No need to finish the for loop
      }
    }
  }
  return pos;
}

export function sortMappingsToGroups(mappings) {
  mappings.sort((m1, m2) => {
    if (!m1.label && m2.label) return -1;
    else if (m1.label && !m2.label) return 1;

    if (!m1.overlayConfig?.parentID && m2.overlayConfig?.parentID) return -1;
    else if (m1.overlayConfig?.parentID && !m2.overlayConfig?.parentID) return 1;

    let priorityDiff = m1.priority - m2.priority;
    if (priorityDiff === 0) return m1.label.localeCompare(m2.label);
    return priorityDiff;
  });

  let groupedMappings = { Default: { list: [], active: false } };
  mappings.forEach((mapping, index) => {
    mapping.i = index; // assign so that we can reference the mapping inside of an array
    if (!mapping.group || !mapping.group.trim()) mapping.group = 'Default';
    if (!(mapping.group in groupedMappings))
      groupedMappings[mapping.group] = { list: [], active: false };
    if (!mapping.disabled) groupedMappings[mapping.group].active = true;
    groupedMappings[mapping.group].list.push(mapping);
  });
  return [mappings, groupedMappings];
}
