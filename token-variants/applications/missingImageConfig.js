import { TVA_CONFIG, updateSettings } from '../scripts/settings.js';
import { getFileName } from '../scripts/utils.js';
import { showArtSelect } from '../token-variants.mjs';

export default class MissingImageConfig extends FormApplication {
  constructor() {
    super({}, {});
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-missing-images',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/missingImageConfig.html',
      resizable: true,
      minimizable: false,
      title: 'Define Missing Images',
      width: 560,
      height: 'auto',
    });
  }

  async getData(options) {
    const data = super.getData(options);

    if (!this.missingImages)
      this.missingImages = deepClone(TVA_CONFIG.compendiumMapper.missingImages);

    data.missingImages = this.missingImages;

    data.documents = ['all', 'Actor', 'Cards', 'Item', 'Macro', 'RollTable'];
    return data;
  }

  _processFormData(formData) {
    if (!Array.isArray(formData.document)) {
      formData.document = [formData.document];
      formData.image = [formData.image];
    }

    const missingImages = [];
    for (let i = 0; i < formData.document.length; i++) {
      missingImages.push({ document: formData.document[i], image: formData.image[i] });
    }
    return missingImages;
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);

    html.on('click', '.add-row', () => {
      const formData = this._getSubmitData();
      this.missingImages = this._processFormData(formData);
      this.missingImages.push({ document: 'all', image: CONST.DEFAULT_TOKEN });
      this.render();
    });

    html.on('click', '.delete-row', (event) => {
      const formData = this._getSubmitData();
      this.missingImages = this._processFormData(formData);
      const index = $(event.target).closest('li')[0].dataset.index;
      this.missingImages.splice(index, 1);
      this.render();
    });

    html.on('click', '.file-picker', (event) => {
      new FilePicker({
        type: 'imagevideo',
        callback: (path) => {
          $(event.target).closest('li').find('[name="image"]').val(path);
          $(event.target).closest('li').find('img').attr('src', path);
        },
      }).render();
    });

    html.on('click', '.duplicate-picker', (event) => {
      let content = `<select style="width: 100%;" name="compendium">`;

      game.packs.forEach((pack) => {
        content += `<option value='${pack.collection}'>${pack.title}</option>`;
      });

      content += `</select>`;

      new Dialog({
        title: `Compendiums`,
        content: content,
        buttons: {
          yes: {
            icon: "<i class='far fa-search'></i>",
            label: 'Search for Duplicates',
            callback: (html) => {
              const found = new Set();
              const duplicates = new Set();
              const compendium = game.packs.get(html.find("[name='compendium']").val());
              compendium.index.forEach((k) => {
                if (found.has(k.img)) {
                  duplicates.add(k.img);
                }
                found.add(k.img);
              });
              if (!duplicates.size) {
                ui.notifications.info('No duplicates found in: ' + compendium.title);
              }

              const images = Array.from(duplicates).map((img) => {
                return { path: img, name: getFileName(img) };
              });
              const allImages = new Map();
              allImages.set('Duplicates', images);

              showArtSelect('Duplicates', {
                allImages,
                callback: (img) => {
                  $(event.target).closest('li').find('[name="image"]').val(img);
                  $(event.target).closest('li').find('img').attr('src', img);
                },
              });
            },
          },
        },
        default: 'yes',
      }).render(true);
    });
  }

  async _updateObject(event, formData) {
    updateSettings({
      compendiumMapper: { missingImages: this._processFormData(formData) },
    });
  }
}
