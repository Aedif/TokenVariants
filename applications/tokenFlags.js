export default class TokenFlags extends FormApplication {
  constructor(token) {
    super({}, {});
    this.objectToFlag = game.actors.get(token.data.actorId) || token.document;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-token-flags',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/tokenFlags.html',
      resizable: true,
      minimizable: false,
      title: 'Flags',
      width: 500,
    });
  }

  async getData(options) {
    const data = super.getData(options);
    const randomize = this.objectToFlag.getFlag('token-variants', 'randomize');
    const popups = this.objectToFlag.getFlag('token-variants', 'popups');

    return mergeObject(data, {
      randomize: randomize,
      randomizeSetFlag: randomize != null,
      popups: popups,
      popupsSetFlag: popups != null,
    });
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('.controlFlag').click((e) => {
      $(e.target).siblings('.flag').prop('disabled', !e.target.checked);
    });
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    ['randomize', 'popups'].forEach((flag) => {
      if (flag in formData) {
        this.objectToFlag.setFlag('token-variants', flag, formData[flag]);
      } else {
        this.objectToFlag.unsetFlag('token-variants', flag);
      }
    });
  }
}
