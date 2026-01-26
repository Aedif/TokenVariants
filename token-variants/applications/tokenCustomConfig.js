import { getTokenConfig, setTokenConfig } from '../scripts/utils.js';

export default class TokenCustomConfig extends foundry.applications.sheets.TokenConfig {
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
    super({ ...options, document: token });
    this.imgSrc = imgSrc;
    this.imgName = imgName;
    this.callback = callback;
    this.config = config;
    if (this.config) {
      this.flags = this.config.flags;
      this.tv_script = this.config.tv_script;
    }
  }

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    window: {
      contentClasses: ['tva-custom-config'],
    },
  };

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    switch (partId) {
      case 'footer':
        context.buttons = [
          { type: 'submit', action: 'saveConfig', icon: 'fa-solid fa-floppy-disk', label: 'Save Config' },
        ];

        if (this.config || getTokenConfig(this.imgSrc, this.imgName)) {
          context.buttons.push({
            type: 'submit',
            action: 'deleteConfig',
            icon: 'fas fa-trash',
            label: 'Delete Config',
          });
        }

        break;
    }
    return context;
  }

  /** @override */
  _processChanges(submitData) {
    submitData.bar1 ||= {};
    submitData.bar2 ||= {};
    return super._processChanges(submitData);
  }

  /** @override */
  async _processSubmitData(event, form, formData, options) {
    if (event.submitter.dataset.action === 'deleteConfig') return this._onRemoveConfig();
    else return this._onSaveConfig(event, form, formData);
  }

  async _onSaveConfig(event, form, formData) {
    // filter form data by selected form-groups
    const filtered = {};
    form.querySelectorAll('.form-group').forEach((formGroup) => {
      const tva_checkbox = formGroup.querySelector('.tva-config-checkbox > input');
      if (tva_checkbox?.checked) {
        formGroup.querySelectorAll('[name]').forEach((namedElement) => {
          const name = namedElement.getAttribute('name');
          filtered[name] = foundry.utils.getProperty(formData, name);
        });
      }
    });

    if (this.tv_script) {
      filtered.tv_script = this.tv_script;
    }

    if (this.config) {
      let config = foundry.utils.expandObject(filtered);
      config.flags = config.flags ? foundry.utils.mergeObject(this.flags || {}, config.flags) : this.flags;
      if (this.callback) this.callback(config);
    } else {
      const saved = setTokenConfig(this.imgSrc, this.imgName, filtered);
      if (this.callback) this.callback(saved);
    }
  }

  async _onRemoveConfig() {
    if (this.config) {
      if (this.callback) this.callback({});
    } else {
      const saved = setTokenConfig(this.imgSrc, this.imgName, null);
      if (this.callback) this.callback(saved);
    }
    this.close();
  }

  applyCustomConfig(html) {
    html = html ?? this.form;
    const tokenConfig = foundry.utils.flattenObject(this.config || getTokenConfig(this.imgSrc, this.imgName));
    for (const key of Object.keys(tokenConfig)) {
      const el = html.querySelector(`[name="${key}"]`);
      if (el) {
        if (el.type === 'checkbox') el.checked = Boolean(tokenConfig[key]);
        else el.value = tokenConfig[key];
        el.dispatchEvent(new Event('change'));
      }
    }
  }

  // *************
  // consider moving html injection to:
  // _replaceHTML | _injectHTML

  _attachPartListeners(partId, element, options) {
    super._attachPartListeners(partId, element, options);
    this.activateListeners(element);
  }

  async activateListeners(html) {
    // Disable image path controls
    html.querySelector('.token-variants-image-select-button')?.setAttribute('disabled', '');
    html.querySelector('[name="texture.src"]')?.setAttribute('disabled', '');

    // Add checkboxes to control inclusion of specific tabs in the custom config
    const tokenConfig = this.config || getTokenConfig(this.imgSrc, this.imgName);
    this.tv_script = tokenConfig.tv_script;

    const processFormGroup = function (formGroup) {
      // Checkbox is not added for the Image Path group

      let savedField = false;
      if (tokenConfig) {
        const flatConfig = foundry.utils.flattenObject(tokenConfig);
        savedField = formGroup.querySelectorAll('[name]').forEach((el) => {
          if (el.getAttribute('name') in flatConfig) savedField = true;
        });
      }

      // Create checkbox
      const container = document.createElement('div');
      container.classList.add('tva-config-checkbox');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = savedField;

      container.appendChild(checkbox);

      const pHint = formGroup.querySelector('p.hint');
      if (pHint) pHint.insertAdjacentElement('beforebegin', container);
      else formGroup.appendChild(container);

      checkbox.dispatchEvent(new Event('change'));
    };
    // Add checkboxes to each form-group to control highlighting and which fields will are to be saved
    html.querySelectorAll('.form-group').forEach((formGroup) => processFormGroup(formGroup));

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
    observer.observe(html, {
      characterData: false,
      attributes: false,
      childList: true,
      subtree: true,
    });

    // On any field being changed we want to automatically select the form-group to be included in the update
    html.querySelectorAll('input, select, range-picker, color-picker').forEach((el) => {
      el.addEventListener('change', onInputChange);
    });
    html.querySelectorAll('button').forEach((el) => {
      el.addEventListener('click', onInputChange);
    });

    this.applyCustomConfig(html);
  }

  get id() {
    return `token-custom-config-${this.document.id}`;
  }
}

// Toggle checkbox if input has been detected inside it's form-group
async function onInputChange(event) {
  if (event.target.parentNode.className === 'tva-config-checkbox') return;
  const fromGroup = event.target.closest('.form-group');
  const tva_checkbox = fromGroup?.querySelector('.tva-config-checkbox input');
  if (tva_checkbox) {
    fromGroup.classList.add('selected');
    tva_checkbox.checked = true;
  }
}
