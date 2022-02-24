import showArtSelect from '../token-variants.mjs';
import { SEARCH_TYPE, getFileName } from '../scripts/utils.js';

export default class ActiveEffectConfig extends FormApplication {
  constructor(token, effectImg, effectName) {
    super({}, {});

    this.token = token;
    this.effectImg = effectImg;
    this.effectName = effectName;

    // There is currently no way to track IDs of effects when Actor is not linked to a Token
    // Sof or now only supporting flagging on actors
    // if(token.actorId)
    this.objectToFlag = game.actors.get(token.actorId);
    // else
    //   this.objectToFlag = canvas.tokens.get(token._id);
    // this.objectToFlag = this.objectToFlag.document || this.objectToFlag;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-active-effect-config',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/activeEffectConfig.html',
      resizable: false,
      minimizable: false,
      title: 'Active Effect Config',
      width: 250,
    });
  }

  async getData(options) {
    const data = super.getData(options);

    const effectMappings = this.objectToFlag.getFlag('token-variants', 'effectMappings') || {};
    const mapping = effectMappings[this.effectName] || {};

    return mergeObject(data, {
      effectImg: this.effectImg,
      effectName: this.effectName,
      imgSrc: mapping.imgSrc,
      imgName: mapping.imgName,
      priority: mapping.priority || 50,
    });
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('.remove').click(this._onRemove.bind(this));
    html.find('img.image').click(this._onImageClick.bind(this));
    html.find('img.image').contextmenu(this._onImageRightClick.bind(this));
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

  async _onImageRightClick(event) {
    new FilePicker({
      type: 'image',
      callback: (path) => {
        event.target.src = path;
        event.target.title = getFileName(path);
        $(event.target).siblings('.imgSrc').val(path);
        $(event.target).siblings('.imgName').val(getFileName(path));
      },
    }).render();
  }

  async _onRemove(event) {
    if (this.objectToFlag) {
      const effectMappings = this.objectToFlag.getFlag('token-variants', 'effectMappings');
      if (effectMappings) {
        delete effectMappings[this.effectName];
        this.objectToFlag.unsetFlag('token-variants', 'effectMappings');
        this.objectToFlag.setFlag('token-variants', 'effectMappings', effectMappings);
      }
    }
    this.close();
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    if (this.objectToFlag) {
      if (!formData.imgSrc) this._onRemove();
      else {
        if (!formData.priority) formData.priority = 50;
        const effectMappings = this.objectToFlag.getFlag('token-variants', 'effectMappings') || {};
        effectMappings[this.effectName] = formData;
        this.objectToFlag.setFlag('token-variants', 'effectMappings', effectMappings);
      }
    }
  }
}
