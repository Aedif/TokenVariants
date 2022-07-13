export default class OverlayConfig extends FormApplication {
  constructor(config, callback) {
    super({}, {});
    this.config = config;
    this.callback = callback;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-overlay-config',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/overlayConfig.html',
      resizable: true,
      minimizable: false,
      title: 'Overlay Settings',
      width: 500,
    });
  }

  async getData(options) {
    const data = super.getData(options);
    data.filters = Object.keys(PIXI.filters).sort();
    data.filters.unshift('NONE');
    const settings = mergeObject(
      { alpha: 1, scaleX: 0, scaleY: 0, offsetX: 0, offsetY: 0, filter: 'NONE' },
      this.config || {}
    );
    return mergeObject(data, settings);
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    if (this.callback) this.callback(formData);
  }
}
