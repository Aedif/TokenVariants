import { showArtSelect, updateWithEffectMapping } from '../token-variants.mjs';
import {
  SEARCH_TYPE,
  getFileName,
  isVideo,
  setGlobalEffectMappings,
  fixEffectMappings,
  EXPRESSION_OPERATORS,
  HP_EXPRESSION_RE,
} from '../scripts/utils.js';
import TokenCustomConfig from './tokenCustomConfig.js';
import { TVA_CONFIG, updateSettings } from '../scripts/settings.js';
import EditJsonConfig from './configJsonEdit.js';
import EditScriptConfig from './configScriptEdit.js';
import OverlayConfig from './overlayConfig.js';
import { showOverlayJsonConfigDialog } from './dialogs.js';

export default class ActiveEffectConfigList extends FormApplication {
  constructor(token, { globalMappings = false, callback = null, createMapping = null } = {}) {
    super({}, { title: (globalMappings ? 'GLOBAL ' : '') + 'Effect Config' });

    this.token = token;
    if (globalMappings) {
      this.globalMappings = deepClone(TVA_CONFIG.globalMappings);
    }
    if (!globalMappings) this.objectToFlag = game.actors.get(token.actorId);
    this.callback = callback;
    this.createMapping = createMapping;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-active-effect-config',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/activeEffectConfigList.html',
      resizable: false,
      minimizable: false,
      closeOnSubmit: false,
      height: 'auto',
      scrollY: ['ol.token-variant-table'],
      width: 600,
    });
  }

  async getData(options) {
    const data = super.getData(options);

    let mappings = [];
    if (this.object.mappings) {
      mappings = this.object.mappings;
    } else {
      const effectMappings = this.globalMappings
        ? this.globalMappings
        : this.objectToFlag.getFlag('token-variants', 'effectMappings') || {};
      fixEffectMappings(effectMappings);
      for (const [effectName, attrs] of Object.entries(effectMappings)) {
        if (!attrs.config) attrs.config = {};
        let hasTokenConfig = Object.keys(attrs.config).length;
        if (attrs.config.flags) hasTokenConfig--;
        if (attrs.config.tv_script) hasTokenConfig--;

        mappings.push({
          effectName: effectName,
          highlightedEffectName: highlightOperators(effectName),
          imgName: attrs.imgName,
          imgSrc: attrs.imgSrc,
          isVideo: attrs.imgSrc ? isVideo(attrs.imgSrc) : false,
          priority: attrs.priority,
          hasConfig: attrs.config ? !isEmpty(attrs.config) : false,
          hasScript: attrs.config && attrs.config.tv_script,
          hasTokenConfig: hasTokenConfig > 0,
          config: attrs.config,
          overlay: attrs.overlay,
          alwaysOn: attrs.alwaysOn,
          overlayConfig: attrs.overlayConfig,
        });
      }

      if (this.createMapping && !(this.createMapping in effectMappings)) {
        mappings.push({
          effectName: this.createMapping,
          imgName: '',
          imgSrc: '',
          priority: 50,
          overlay: false,
          alwaysOn: false,
        });
      }
      this.createMapping = null;
    }

    this.object.mappings = mappings;
    data.mappings = mappings;
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
      html.find('.effect-image img').click(this._onImageClick.bind(this));
      html.find('.effect-image img').mousedown(this._onImageMouseDown.bind(this));
      html.find('.effect-image video').click(this._onImageClick.bind(this));
    }
    html.find('.effect-image img').contextmenu(this._onImageRightClick.bind(this));
    html.find('.effect-image video').contextmenu(this._onImageRightClick.bind(this));
    html.find('.effect-config i.config').click(this._onConfigClick.bind(this));
    html.find('.effect-config i.config-edit').click(this._onConfigEditClick.bind(this));
    html.find('.effect-config i.config-script').click(this._onConfigScriptClick.bind(this));
    html.find('.effect-overlay i.overlay-config').click(this._onOverlayConfigClick.bind(this));
    html.on(
      'contextmenu',
      '.effect-overlay i.overlay-config',
      this._onOverlayConfigRightClick.bind(this)
    );
    html.find('.effect-overlay input').on('change', this._onOverlayChange).trigger('change');
    html.find('.div-input').on('input paste', this._onEffectNameChange);
  }

  async _onEffectNameChange(event) {
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
      },
      mapping.effectName,
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
    const tokenConfig = $(event.target).closest('.effect-config').find('.config');
    const configEdit = $(event.target).closest('.effect-config').find('.config-edit');
    const scriptEdit = $(event.target).closest('.effect-config').find('.config-script');

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

  async _onImageMouseDown(event) {
    if (event.which === 2) {
      const vid = $(event.target).closest('.effect-image').find('video');
      const img = $(event.target).closest('.effect-image').find('img');
      vid.add(img).attr('src', '').attr('title', '');
      vid.hide();
      img.show();
      $(event.target).siblings('.imgSrc').val('');
      $(event.target).siblings('.imgName').val('');
    }
  }

  async _onImageClick(event) {
    let search = this.token.name;
    if (search === 'Unknown') {
      const li = event.currentTarget.closest('.table-row');
      const mapping = this.object.mappings[li.dataset.index];
      search = mapping.effectName;
    }

    showArtSelect(search, {
      searchType: SEARCH_TYPE.TOKEN,
      callback: (imgSrc, imgName) => {
        const vid = $(event.target).closest('.effect-image').find('video');
        const img = $(event.target).closest('.effect-image').find('img');
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
    const li = event.currentTarget.closest('.table-row');
    const mapping = this.object.mappings[li.dataset.index];

    new FilePicker({
      type: 'imagevideo',
      current: mapping.imgSrc,
      callback: (path) => {
        const vid = $(event.target).closest('.effect-image').find('video');
        const img = $(event.target).closest('.effect-image').find('img');
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
    clone.effectName = clone.effectName + ' - Copy';
    this.object.mappings.push(clone);
    this.render();
  }

  async _onCreate(event) {
    event.preventDefault();
    await this._onSubmit(event);
    this.object.mappings.push({
      effectName: '',
      imgName: '',
      imgSrc: '',
      priority: 50,
      overlay: false,
      alwaysOn: false,
    });
    this.render();
  }

  _getHeaderButtons() {
    const buttons = super._getHeaderButtons();

    // buttons.unshift({
    //   label: 'Import',
    //   class: 'token-variants-import',
    //   icon: 'fas fa-globe',
    //   onclick: (ev) => this._importConfigs(ev),
    // });

    if (this.globalMappings) return buttons;

    buttons.unshift({
      label: 'Copy Global Effect',
      class: 'token-variants-copy-global',
      icon: 'fas fa-globe',
      onclick: (ev) => this._copyGlobalEffect(ev),
    });
    buttons.unshift({
      label: 'Open Global',
      class: 'token-variants-open-global',
      icon: 'fas fa-globe',
      onclick: async (ev) => {
        await this.close();
        new ActiveEffectConfigList(this.token, { globalMappings: true }).render(true);
      },
    });
    return buttons;
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
                  // importSettingsFromJSON(json);
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

  _copyGlobalEffect(event) {
    const mappings = TVA_CONFIG.globalMappings;
    if (!mappings || isEmpty(mappings)) return;

    let content =
      '<form style="overflow-y: scroll; height:400px;"><h2>Select effects to copy:</h2>';
    for (const key of Object.keys(mappings)) {
      content += `
      <div class="form-group">
        <label>${key}</label>
        <div class="form-fields">
            <input type="checkbox" name="${key}" data-dtype="Boolean">
        </div>
      </div>
      `;
    }
    content += `</form><div class="form-group"><button type="button" class="select-all">Select all</div>`;

    new Dialog({
      title: `Global Effect Mappings`,
      content: content,
      buttons: {
        Ok: {
          label: `Copy`,
          callback: async (html) => {
            const toCopy = {};
            html.find('input[type="checkbox"]').each(function () {
              if (this.checked && mappings[this.name]) {
                toCopy[this.name] = deepClone(mappings[this.name]);
              }
            });
            if (!isEmpty(toCopy)) {
              await this._onSubmit(event);
              for (const effect of Object.keys(toCopy)) {
                toCopy[effect].effectName = effect;

                const found = this.object.mappings.find((m) => m.effectName === effect);
                if (found) {
                  this.object.mappings.splice(found, 1);
                }
                this.object.mappings.push(toCopy[effect]);
              }
              this.render();
            }
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

  _configureApplicableActors(event) {}

  // TODO fix this spaghetti code related to globalMappings...
  async _onSaveMappings(event) {
    await this._onSubmit(event);
    if (this.objectToFlag || this.globalMappings) {
      // First filter out empty mappings
      let mappings = this.object.mappings;
      mappings = mappings.filter(function (mapping) {
        return Boolean(mapping.effectName?.trim());
      });

      // Make sure a priority is assigned
      for (const mapping of mappings) {
        mapping.priority = mapping.priority ? mapping.priority : 50;
      }

      if (mappings.length !== 0) {
        const effectMappings = {};
        for (const mapping of mappings) {
          effectMappings[mapping.effectName] = {
            imgName: mapping.imgName,
            imgSrc: mapping.imgSrc,
            priority: mapping.priority,
            config: mapping.config,
            overlay: mapping.overlay,
            alwaysOn: mapping.alwaysOn,
            overlayConfig: mapping.overlayConfig || {},
          };
          effectMappings[mapping.effectName].overlayConfig.effect = mapping.effectName;
        }
        if (this.globalMappings) {
          setGlobalEffectMappings(effectMappings);
          updateSettings({ globalMappings: effectMappings });
        } else {
          await this.objectToFlag.unsetFlag('token-variants', 'effectMappings');
          setTimeout(
            () => this.objectToFlag.setFlag('token-variants', 'effectMappings', effectMappings),
            500
          );
        }
      } else if (this.globalMappings) {
        setGlobalEffectMappings(null);
        updateSettings({ globalMappings: {} });
      } else {
        this.objectToFlag.unsetFlag('token-variants', 'effectMappings');
      }

      if (this.globalMappings) {
        for (const tkn of canvas.tokens.placeables) {
          if (TVA_CONFIG.filterEffectIcons) {
            await tkn.drawEffects();
          }
          updateWithEffectMapping(tkn);
          // Instruct users on other scenes to refresh the overlays
          const message = {
            handlerName: 'drawOverlays',
            args: { all: true, sceneId: canvas.scene.id },
            type: 'UPDATE',
          };
          game.socket?.emit('module.token-variants', message);
        }
      }
    }
    if (this.callback) this.callback();
    this.close();
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    const expanded = expandObject(formData);
    const mappings = expanded.hasOwnProperty('mappings') ? Object.values(expanded.mappings) : [];
    for (let i = 0; i < mappings.length; i++) {
      const m1 = mappings[i];
      const m2 = this.object.mappings[i];
      m2.imgSrc = m1.imgSrc;
      m2.imgName = m1.imgName;
      m2.priority = m1.priority;
      m2.effectName = m1.effectName;
      m2.overlay = m1.overlay;
      m2.alwaysOn = m1.alwaysOn;
    }
  }
}

// Insert <span/> around operators
function highlightOperators(text) {
  for (const op of EXPRESSION_OPERATORS) {
    text = text.replace(op, `<span>${op}</span>`);
  }

  text = text.replace(/hp(<|>|=|<=|>=)(\d+)(%{0,1})/gi, function replace(match) {
    return '<span class="hp-expression">' + match + '</span>';
  });

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
