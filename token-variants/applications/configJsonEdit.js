export default class EditJsonConfig extends FormApplication {
  constructor(config, callback) {
    super({}, {});
    this.config = config;
    this.callback = callback;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-config-json-edit',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/configJsonEdit.html',
      resizable: true,
      minimizable: false,
      title: 'Edit Token Configuration',
      width: 400,
      height: 380,
    });
  }

  async getData(options) {
    const data = super.getData(options);

    data.hasConfig = this.config != null && Object.keys(this.config).length !== 0;
    data.config = JSON.stringify(data.hasConfig ? this.config : {}, null, 2);

    return data;
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
    html.on('input', '.command textarea', this._validateJSON.bind(this));
    // Override 'Tab' key to insert spaces
    html.on('keydown', '.command textarea', function (e) {
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        var start = this.selectionStart;
        var end = this.selectionEnd;
        this.value = this.value.substring(0, start) + '  ' + this.value.substring(end);
        this.selectionStart = this.selectionEnd = start + 2;
        return false;
      }
    });

    html.find('.remove').click(this._onRemove.bind(this));
    html.find('.format').click(this._onFormat.bind(this));
  }

  async _validateJSON(event) {
    const controls = $(event.target).closest('form').find('button[type="submit"], button.format');
    try {
      this.config = JSON.parse(event.target.value);
      this.config = expandObject(this.config);
      this.flag = this.config.flag;
      controls.prop('disabled', false);
    } catch (e) {
      controls.prop('disabled', true);
    }
  }

  async _onRemove(event) {
    this.config = {};
    this.submit();
  }

  async _onFormat(event) {
    $(event.target)
      .closest('form')
      .find('textarea[name="config"]')
      .val(JSON.stringify(this.config, null, 2));
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    if (this.callback) this.callback(this.config);
  }
}
