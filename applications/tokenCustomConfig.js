import { getTokenConfig, setTokenConfig } from '../scripts/utils.js';

export default class TokenCustomConfig extends TokenConfig {
  constructor(object, options, imgSrc, imgName, callback, config) {
    let token;
    if (object instanceof Actor) {
      token = new TokenDocument(object.token, {
        actor: object,
      });
    } else {
      token = new TokenDocument(object.document, {
        actor: game.actors.get(object.actorId),
      });
    }
    super(token, options);
    this.imgSrc = imgSrc;
    this.imgName = imgName;
    this.callback = callback;
    this.config = config;
    if (this.config) {
      this.flags = this.config.flags;
      this.tv_script = this.config.tv_script;
    }
  }

  _getSubmitData(updateData = {}) {
    if (!this.form) throw new Error('The FormApplication subclass has no registered form element');
    const fd = new FormDataExtended(this.form, { editors: this.editors });
    let data = fd.object;
    if (updateData) data = foundry.utils.flattenObject(foundry.utils.mergeObject(data, updateData));

    // Clear detection modes array
    if (!('detectionModes.0.id' in data)) data.detectionModes = [];

    // Treat "None" as null for bar attributes
    data['bar1.attribute'] ||= null;
    data['bar2.attribute'] ||= null;
    return data;
  }

  async _updateObject(event, formData) {
    const filtered = {};

    const form = $(event.target).closest('form');

    form.find('.form-group').each(function (_) {
      const tva_checkbox = $(this).find('.tva-config-checkbox > input');
      if (tva_checkbox.length && tva_checkbox.is(':checked')) {
        $(this)
          .find('[name]')
          .each(function (_) {
            const name = $(this).attr('name');
            filtered[name] = formData[name];
          });
      }
    });

    if (this.config) {
      let config = expandObject(filtered);
      config.flags = config.flags ? mergeObject(this.flags || {}, config.flags) : this.flags;
      config.tv_script = this.tv_script;
      if (this.callback) this.callback(config);
    } else {
      const saved = setTokenConfig(this.imgSrc, this.imgName, filtered);
      if (this.callback) this.callback(saved);
    }
  }

  applyCustomConfig() {
    const tokenConfig = flattenObject(
      this.config || getTokenConfig(this.imgSrc, this.imgName) || {}
    );
    const form = $(this.form);
    for (const key of Object.keys(tokenConfig)) {
      const el = form.find(`[name="${key}"]`);
      if (el.is(':checkbox')) {
        el.prop('checked', tokenConfig[key]);
      } else {
        el.val(tokenConfig[key]);
      }
      el.trigger('change');
    }
  }

  // *************
  // consider moving html injection to:
  // _replaceHTML | _injectHTML

  async activateListeners(html) {
    await super.activateListeners(html);

    // Disable image path controls
    $(html).find('.token-variants-image-select-button').prop('disabled', true);
    $(html).find('.file-picker').prop('disabled', true);
    $(html).find('.image').prop('disabled', true);

    // Remove 'Assign Token' button
    $(html).find('.assign-token').remove();

    // Add checkboxes to control inclusion of specific tabs in the custom config
    const tokenConfig = this.config || getTokenConfig(this.imgSrc, this.imgName);

    $(html).on('change', '.tva-config-checkbox', this._onCheckboxChange);

    const processFormGroup = function (formGroup) {
      // Checkbox is not added for the Image Path group
      if (!$(formGroup).find('[name="img"]').length) {
        let savedField = false;
        if (tokenConfig) {
          const flatConfig = flattenObject(tokenConfig);
          $(formGroup)
            .find('[name]')
            .each(function (_) {
              const name = $(this).attr('name');
              if (name in flatConfig) {
                savedField = true;
              }
            });
        }

        const checkbox = $(
          `<div class="tva-config-checkbox"><input type="checkbox" data-dtype="Boolean" ${
            savedField ? 'checked=""' : ''
          }></div>`
        );
        if ($(formGroup).find('p.hint').length) {
          $(formGroup).find('p.hint').before(checkbox);
        } else {
          $(formGroup).append(checkbox);
        }
        checkbox.find('input').trigger('change');
      }
    };
    // Add checkboxes to each form-group to control highlighting and which fields will are to be saved
    $(html)
      .find('.form-group')
      .each(function (index) {
        processFormGroup(this);
      });

    // Add 'update' and 'remove' config buttons
    $(html).find('.sheet-footer > button').remove();
    $(html)
      .find('.sheet-footer')
      .append('<button type="submit" value="1"><i class="far fa-save"></i> Save Config</button>');
    if (tokenConfig) {
      $(html)
        .find('.sheet-footer')
        .append(
          '<button type="button" class="remove-config"><i class="fas fa-trash"></i> Remove Config</button>'
        );
      html.find('.remove-config').click(this._onRemoveConfig.bind(this));
    }

    // Pre-select image or appearance tab
    $(html).find('.tabs > .item[data-tab="image"] > i').trigger('click');
    $(html).find('.tabs > .item[data-tab="appearance"] > i').trigger('click');

    document.activeElement.blur(); // Hack fix for key UP/DOWN effects not registering after config has been opened

    // TokenConfig might be changed by some modules after activateListeners is processed
    // Look out for these updates and add checkboxes for any newly added form-groups
    const mutate = (mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === 'DIV' && node.className === 'form-group') {
            processFormGroup(node);
            this.applyCustomConfig();
          }
        });
      });
    };

    const observer = new MutationObserver(mutate);
    observer.observe(html[0], {
      characterData: false,
      attributes: false,
      childList: true,
      subtree: true,
    });

    // On any field being changed we want to automatically select the form-group to be included in the update
    $(html).on('change', 'input, select', onInputChange);
    $(html).on('click', 'button', onInputChange);

    this.applyCustomConfig();
  }

  async _onCheckboxChange(event) {
    const checkbox = $(event.target);
    checkbox.closest('.form-group').css({
      'outline-color': checkbox.is(':checked') ? 'green' : '#ffcc6e',
      'outline-width': '2px',
      'outline-style': 'dotted',
      'margin-bottom': '5px',
    });
    checkbox.closest('.tva-config-checkbox').css({
      'outline-color': checkbox.is(':checked') ? 'green' : '#ffcc6e',
      'outline-width': '2px',
      'outline-style': 'solid',
    });
  }

  async _onRemoveConfig(event) {
    if (this.config) {
      if (this.callback) this.callback({});
    } else {
      const saved = setTokenConfig(this.imgSrc, this.imgName, null);
      if (this.callback) this.callback(saved);
    }
    this.close();
  }

  get id() {
    return `token-custom-config-${this.object.id}`;
  }
}

// Toggle checkbox if input has been detected inside it's form-group
async function onInputChange(event) {
  if (event.target.parentNode.className === 'tva-config-checkbox') return;
  $(event.target).closest('.form-group').find('.tva-config-checkbox input').prop('checked', true);
}
