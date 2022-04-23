import { getTokenConfig, setTokenConfig } from '../scripts/utils.js';

export default class TokenCustomConfig extends TokenConfig {
  constructor(object, options, imgSrc, imgName, callback) {
    let token;
    if (object instanceof Actor) {
      token = new TokenDocument(object.data.token, {
        actor: object,
      });
    } else {
      token = new TokenDocument(object.data, {
        actor: object.actor,
      });
    }
    super(token, options);
    this.imgSrc = imgSrc;
    this.imgName = imgName;
    this.callback = callback;
  }

  async _updateObject(event, formData) {
    const filtered = {};

    const form = $(event.target).closest('form');
    form.find('.token-variants-config-control').each(function (index) {
      const input = $(this).find('input');
      const checked = input.is(':checked');

      if (checked) {
        filtered[`tvTab_${input.attr('data-token-variants-tab')}`] = checked;
        $(this)
          .closest('.tab')
          .find('[name]')
          .each(function (index) {
            const name = $(this).attr('name');
            filtered[name] = formData[name];
          });
      }
    });

    const saved = setTokenConfig(this.imgSrc, this.imgName, filtered);
    if (this.callback) this.callback(saved);
  }

  async getData(options) {
    let data = await super.getData(options);
    const tokenConfig = getTokenConfig(this.imgSrc, this.imgName);
    if (tokenConfig) {
      mergeObject(data.object, tokenConfig, {
        inplace: true,
      });
    }
    return data;
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
    const tokenConfig = getTokenConfig(this.imgSrc, this.imgName);
    $(html)
      .find('.tabs')
      .find('.item')
      .each(function (index) {
        const type = $(this).attr('data-tab');
        const checked = tokenConfig && tokenConfig[`tvTab_${type}`];
        const control = `<div class="form-group token-variants-config-control">
                          <label>&nbsp;Store <u>${type}</u> tab config</label>
                          <input type="checkbox" data-token-variants-tab="${type}" data-dtype="Boolean" ${
          checked ? 'checked' : ''
        }>
                         </div>`;
        $(html).find(`.tab[data-tab="${type}"]`).prepend(control);
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

  async _onRemoveConfig(event) {
    const saved = setTokenConfig(this.imgSrc, this.imgName, null);
    if (this.callback) this.callback(saved);
    this.close();
  }

  get id() {
    return `token-custom-config-${this.object.id}`;
  }
}

/**
 * Modified foundry.utils.diffObject function to treat null and undefined values in
 * the 'original' object as equal to empty string in the 'other'
 */
function _diffObject(original, other, { inner = false } = {}) {
  function _difference(v0, v1) {
    let t0 = getType(v0);
    let t1 = getType(v1);
    if (t0 !== t1) {
      if ((t0 === 'undefined' || t0 === 'null') && v1 === '') return [false, v1];
      return [true, v1];
    }
    if (t0 === 'Array') return [!v0.equals(v1), v1];
    if (t0 === 'Object') {
      if (isObjectEmpty(v0) !== isObjectEmpty(v1)) return [true, v1];
      let d = _diffObject(v0, v1, {
        inner,
      });
      return [!isObjectEmpty(d), d];
    }
    return [v0 !== v1, v1];
  }

  // Recursively call the _difference function
  return Object.keys(other).reduce((obj, key) => {
    if (inner && !(key in original)) return obj;
    let [isDifferent, difference] = _difference(original[key], other[key]);
    if (isDifferent) obj[key] = difference;
    return obj;
  }, {});
}
