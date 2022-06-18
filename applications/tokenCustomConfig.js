import { getTokenConfig, setTokenConfig } from '../scripts/utils.js';

export default class TokenCustomConfig extends TokenConfig {
  constructor(object, options, imgSrc, imgName, callback, config) {
    let token;
    if (object instanceof Actor) {
      token = new TokenDocument(object.data.token, {
        actor: object,
      });
    } else {
      token = new TokenDocument(object.data, {
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
      filtered.flags = this.flags;
      filtered.tv_script = this.tv_script;
      if (this.callback) this.callback(expandObject(filtered));
    } else {
      const saved = setTokenConfig(this.imgSrc, this.imgName, filtered);
      if (this.callback) this.callback(saved);
    }
  }

  async getData(options) {
    let data = await super.getData(options);
    const tokenConfig = this.config || getTokenConfig(this.imgSrc, this.imgName);
    if (tokenConfig) {
      mergeObject(data.object, tokenConfig, {
        inplace: true,
      });
    }
    return super.getData(options);
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

    // Add checkboxes to each form-group to control highlighting and which fields will are to be saved
    $(html)
      .find('.form-group')
      .each(function (index) {
        // Checkbox is not added for the Image Path group
        if (!$(this).find('[name="img"]').length) {
          let savedField = false;
          if (tokenConfig) {
            const flatConfig = flattenObject(tokenConfig);
            $(this)
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
          if ($(this).find('p.hint').length) {
            $(this).find('p.hint').before(checkbox);
          } else {
            $(this).append(checkbox);
          }
          checkbox.find('input').trigger('change');
        }
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
