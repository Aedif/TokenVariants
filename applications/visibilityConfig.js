import { showArtSelect } from '../token-variants.mjs';
import { SEARCH_TYPE } from '../scripts/utils.js';

export default class VisibilityConfig extends FormApplication {
  constructor(token) {
    super({}, {});
    this.token = canvas.tokens.get(token._id);
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-visibility-config',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/visibilityConfig.html',
      resizable: false,
      minimizable: false,
      title: 'Config',
      width: 250,
    });
  }

  async getData(options) {
    let data = super.getData(options);
    const visibility = this.token.document.getFlag('token-variants', 'visibility');
    if (visibility) {
      data = mergeObject(data, visibility);
    }
    console.log(visibility);
    return data;
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('.remove').click(this._onRemove.bind(this));
    html.find('img.image').click(this._onImageClick.bind(this));
  }

  async _onImageClick(event) {
    showArtSelect(this.token.name, {
      searchType: SEARCH_TYPE.TOKEN,
      callback: (imgSrc, name) => {
        event.target.src = imgSrc;
        event.target.title = name;
        $(event.target).siblings('.imgSrc').val(imgSrc);
        $(event.target).siblings('.imgName').val(name);
      },
    });
  }

  async _onRemove(event) {
    this.token.document.unsetFlag('token-variants', 'visibility');
    if (this.token.actor) {
      this.token.actor.update({ 'token.flags.token-variants.visibility': null });
    }
    this.close();
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    console.log(formData);
    this.token.document.setFlag('token-variants', 'visibility', formData);
    if (this.token.actor) {
      this.token.actor.update({ 'token.flags.token-variants.visibility': formData });
    }
  }
}
