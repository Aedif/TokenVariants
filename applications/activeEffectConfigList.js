import { showArtSelect } from '../token-variants.mjs';
import { SEARCH_TYPE, getFileName } from '../scripts/utils.js';

export default class ActiveEffectConfigList extends FormApplication {
  constructor(token) {
    super({}, {});

    this.token = token;
    this.objectToFlag = game.actors.get(token.actorId);
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-active-effect-config',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/activeEffectConfigList.html',
      resizable: false,
      minimizable: false,
      closeOnSubmit: false,
      height: 'auto',
      scrollY: ['ol.token-variant-table'],
      title: 'Config',
      width: 350,
    });
  }

  async getData(options) {
    const data = super.getData(options);

    let mappings = [];
    if (this.object.mappings) {
      mappings = this.object.mappings;
    } else {
      const effectMappings = this.objectToFlag.getFlag('token-variants', 'effectMappings') || {};
      for (const [effectName, attrs] of Object.entries(effectMappings)) {
        mappings.push({
          effectName: effectName,
          imgName: attrs['imgName'],
          imgSrc: attrs['imgSrc'],
          priority: attrs['priority'],
        });
      }
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
    html.find('.create-mapping').click(this._onCreate.bind(this));
    html.find('.save-mappings').click(this._onSaveMappings.bind(this));
    html.find('.effect-image img').click(this._onImageClick.bind(this));
    html.find('.effect-image img').contextmenu(this._onImageRightClick.bind(this));
  }

  async _onImageClick(event) {
    showArtSelect(this.token.name, {
      searchType: SEARCH_TYPE.TOKEN,
      callback: (imgSrc, imgName) => {
        event.target.src = imgSrc;
        event.target.title = imgName;
        $(event.target).siblings('.imgSrc').val(imgSrc);
        $(event.target).siblings('.imgName').val(imgName);
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
    event.preventDefault();
    await this._onSubmit(event);
    const li = event.currentTarget.closest('.table-row');
    this.object.mappings.splice(li.dataset.index, 1);
    this.render();
  }

  async _onCreate(event) {
    event.preventDefault();
    await this._onSubmit(event);
    this.object.mappings.push({
      effectName: '',
      imgName: '',
      imgSrc: '',
      priority: 50,
    });
    this.render();
  }

  async _onSaveMappings(event) {
    await this._onSubmit(event);
    if (this.objectToFlag) {
      // First filter out empty mappings
      let mappings = this.object.mappings;
      mappings = mappings.filter(
        (mapping) => mapping.imgSrc && mapping.imgName && mapping.effectName
      );
      // Make sure a priority is assigned
      for (const mapping of mappings) {
        mapping.priority = mapping.priority ? mapping.priority : 50;
      }

      // If any mapping are remaining set them as a flag
      await this.objectToFlag.unsetFlag('token-variants', 'effectMappings');
      if (mappings.length !== 0) {
        const effectMappings = {};
        for (const mapping of mappings) {
          effectMappings[mapping.effectName] = {
            imgName: mapping.imgName,
            imgSrc: mapping.imgSrc,
            priority: mapping.priority,
          };
        }
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
    const expanded = expandObject(formData);
    this.object.mappings = expanded.hasOwnProperty('mappings')
      ? Object.values(expanded.mappings)
      : [];
  }
}
