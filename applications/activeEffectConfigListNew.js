import { TVA_CONFIG, updateSettings } from '../scripts/settings.js';
import { showTokenCaptureDialog } from './dialogs.js';
import { DEFAULT_ACTIVE_EFFECT_CONFIG } from '../scripts/models.js';
import { fixEffectMappings, updateWithEffectMapping } from '../scripts/token/effects.js';
import TVAActiveEffectConfig from './activeEffectConfig.js';
import { EXPRESSION_OPERATORS } from '../scripts/utils.js';

export default class ActiveEffectConfigListNew extends FormApplication {
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
      id: 'token-variants-active-effect-config-list',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/activeEffectConfigListNew.html',
      resizable: false,
      minimizable: false,
      closeOnSubmit: false,
      height: 'auto',
      scrollY: ['ol.token-variant-table'],
      width: 700,
    });
  }

  _processConfig(effectName, attrs) {
    if (!attrs.config) attrs.config = {};

    //DEFAULT_ACTIVE_EFFECT_CONFIG
    let mapping = deepClone(attrs);
    mapping.effectName = effectName;
    mapping.highlightedEffectName = highlightOperators(effectName);

    return mapping;
  }

  async getData(options) {
    const data = super.getData(options);

    let mappings = [];
    if (this.object.mappings) {
      for (const mapping of this.object.mappings) {
        mappings.push(this._processConfig(mapping.effectName, mapping));
      }
    } else {
      const effectMappings = this.globalMappings
        ? this.globalMappings
        : this.objectToFlag.getFlag('token-variants', 'effectMappings') || {};
      fixEffectMappings(effectMappings);
      for (const [effectName, attrs] of Object.entries(effectMappings)) {
        mappings.push(this._processConfig(effectName, attrs));
      }

      if (this.createMapping && !(this.createMapping in effectMappings)) {
        mappings.push(this._processConfig(this.createMapping, DEFAULT_ACTIVE_EFFECT_CONFIG));
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

    html.find('.effect-config i.config').click(this._onConfigClick.bind(this));
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

  async _onConfigClick(event) {
    const li = event.currentTarget.closest('.table-row');
    const mapping = this.object.mappings[li.dataset.index];
    new TVAActiveEffectConfig(this.token, mapping, (nMapping) => {
      mergeObject(mapping, nMapping ?? {});
    }).render(true);
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
    this.object.mappings.push(deepClone(DEFAULT_ACTIVE_EFFECT_CONFIG));
    this.render();
  }

  async _onSceneConfig(event) {
    event.preventDefault();
    console.log('SCENE CONFIG');
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

    if (this.globalMappings) {
      const massEdit = game.modules.get('multi-token-edit');
      if (massEdit?.active && isNewerVersion(massEdit.version, '1.37.2"')) {
        buttons.unshift({
          label: 'Scene',
          class: 'token-variants-scene',
          icon: 'fas fa-map',
          onclick: (ev) => this._onSceneConfig(ev),
        });
      }
    }

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
        new ActiveEffectConfigList(this.token, { globalMappings: true }).render(true);
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
        globalMappings: deepClone(this.objectToFlag.getFlag('token-variants', 'effectMappings') || {}),
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
                if (!form.data.files.length) return ui.notifications?.error('You did not upload a data file!');
                readTextFromFile(form.data.files[0]).then((json) => {
                  json = JSON.parse(json);
                  if (!json || !('globalMappings' in json)) {
                    return ui.notifications?.error('No mappings found within the file!');
                  }

                  const mappings = this.object.mappings;
                  for (const key of Object.keys(json.globalMappings)) {
                    const processedMapping = this._processConfig(key, json.globalMappings[key]);
                    const i = mappings.findIndex((m) => m.effectName === key);
                    if (i === -1) {
                      mappings.push(processedMapping);
                    } else {
                      mappings[i] = processedMapping;
                    }
                  }
                  this.render();
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
    const mappings = TVA_CONFIG.globalMappings;
    if (!mappings || isEmpty(mappings)) return;

    let content = '<form style="overflow-y: scroll; height:400px;"><h2>Select effects to copy:</h2>';
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
                delete toCopy[this.name].targetActors;
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

  // TODO fix this spaghetti code related to globalMappings...
  async _onSaveMappings(event) {
    await this._onSubmit(event);
    if (this.objectToFlag || this.globalMappings) {
      // First filter out empty mappings
      let mappings = this.object.mappings;
      mappings = mappings.filter(function (mapping) {
        return Boolean(mapping.effectName?.trim());
      });

      if (mappings.length !== 0) {
        const effectMappings = {};
        for (const mapping of mappings) {
          mapping.overlayConfig.effect = mapping.effectName;
          delete mapping.highlightedEffectName;
          delete mapping.effectName;

          effectMappings[mapping.effectName] = mapping;
        }
        if (this.globalMappings) {
          _setGlobalEffectMappings(effectMappings);
          updateSettings({ globalMappings: effectMappings });
        } else {
          await this.objectToFlag.unsetFlag('token-variants', 'effectMappings');
          setTimeout(() => this.objectToFlag.setFlag('token-variants', 'effectMappings', effectMappings), 500);
        }
      } else if (this.globalMappings) {
        _setGlobalEffectMappings(null);
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
      this.object.mappings[i].effectName = mappings[i].effectName;
    }
  }
}

// Insert <span/> around operators
function highlightOperators(text) {
  for (const op of EXPRESSION_OPERATORS) {
    text = text.replaceAll(op, `<span>${op}</span>`);
  }

  const re = new RegExp('([a-zA-Z\\.-]+)([><=]+)(".*"|\\d+)(%{0,1})', `gi`);
  text = text.replace(re, function replace(match) {
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

async function _setGlobalEffectMappings(mappings) {
  if (!mappings) {
    for (const k of Object.keys(TVA_CONFIG.globalMappings)) {
      delete TVA_CONFIG.globalMappings[k];
    }
    return;
  }

  const keys = Object.keys(TVA_CONFIG.globalMappings);
  for (const key of keys) {
    if (!(key in mappings)) {
      delete TVA_CONFIG.globalMappings[key];
    }
  }
  mergeObject(TVA_CONFIG.globalMappings, mappings);
}
