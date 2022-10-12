import { TVA_CONFIG, updateSettings } from '../scripts/settings.js';

export default class MissingImageConfig extends FormApplication {
  constructor() {
    super({}, {});
    // this.token = token;
    // this.img = img;
    // this.regenStyle = regenStyle;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-user-list',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/missingImageConfig.html',
      resizable: true,
      minimizable: false,
      title: 'User To Image',
      width: 560,
    });
  }

  async getData(options) {
    const data = super.getData(options);

    if (!this.missingImages)
      this.missingImages = deepClone(TVA_CONFIG.compendiumMapper.missingImages);

    data.missingImages = this.missingImages;
    console.log(this.missingImages);

    data.documents = ['All', 'Actor', 'Cards', 'Item', 'Macro', 'RollTable'];
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
  }

  async _updateObject(event, formData) {
    updateSettings({
      compendiumMapper: { missingImages: this._processFormData(this.missingImages) },
    });

    // const mappings = this.token.document.getFlag('token-variants', 'userMappings') || {};
    // let newMappings = {};
    // const affectedImages = [this.img];
    // const affectedUsers = [];
    // for (const [userId, apply] of Object.entries(formData)) {
    //   if (apply) {
    //     newMappings[userId] = this.img;
    //     if (mappings[userId] && mappings[userId] !== this.img) {
    //       affectedImages.push(mappings[userId]);
    //       affectedUsers.push(userId);
    //     } else if (!mappings[userId]) {
    //       affectedUsers.push(userId);
    //     }
    //   } else if (mappings[userId] === this.img) {
    //     delete mappings[userId];
    //     affectedUsers.push(userId);
    //   }
    // }
    // newMappings = mergeObject(mappings, newMappings);
    // if (Object.keys(newMappings).length === 0) {
    //   await this.token.document.unsetFlag('token-variants', 'userMappings');
    // } else {
    //   await this.token.document.unsetFlag('token-variants', 'userMappings');
    //   await this.token.document.setFlag('token-variants', 'userMappings', newMappings);
    // }
    // for (const img of affectedImages) {
    //   this.regenStyle(this.token, img);
    // }
    // if (affectedUsers.includes(game.userId)) checkAndDisplayUserSpecificImage(this.token, true);
    // // Broadcast the update to the user specific image
    // const message = {
    //   handlerName: 'userMappingChange',
    //   args: { tokenId: this.token.id, users: affectedUsers },
    //   type: 'UPDATE',
    // };
    // game.socket?.emit('module.token-variants', message);
  }
}
