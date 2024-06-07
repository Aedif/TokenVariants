import { TVA_CONFIG, updateSettings } from '../scripts/settings.js';
import { SEARCH_TYPE, decodeURISafely } from '../scripts/utils.js';
import { insertArtSelectButton } from './artSelect.js';

export default class UserList extends FormApplication {
  constructor(object, img, regenStyle) {
    super({}, {});
    this.object = object;
    this.img = img;
    this.regenStyle = regenStyle;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'token-variants-user-list',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/userList.html',
      resizable: false,
      minimizable: false,
      title: 'User To Image',
      width: 300,
    });
  }

  async getData(options) {
    const data = super.getData(options);
    const mappings = this.object.document.getFlag('token-variants', 'userMappings') || {};
    let users = [];
    game.users.forEach((user) => {
      users.push({
        avatar: user.avatar,
        name: user.name,
        apply: user.id in mappings && mappings[user.id] === this.img,
        userId: user.id,
        color: user.color,
      });
    });
    data.users = users;
    data.invisibleImage = TVA_CONFIG.invisibleImage;
    return data;
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
    insertArtSelectButton(html, 'invisibleImage', {
      search: 'Invisible Image',
      searchType: SEARCH_TYPE.TOKEN,
    });
  }

  async _updateObject(event, formData) {
    const mappings = this.object.document.getFlag('token-variants', 'userMappings') || {};

    if (formData.invisibleImage !== TVA_CONFIG.invisibleImage) {
      updateSettings({ invisibleImage: decodeURISafely(formData.invisibleImage) });
    }
    delete formData.invisibleImage;

    const affectedImages = [this.img];

    for (const [userId, apply] of Object.entries(formData)) {
      if (apply) {
        if (mappings[userId] && mappings[userId] !== this.img) affectedImages.push(mappings[userId]);
        mappings[userId] = this.img;
      } else if (mappings[userId] === this.img) {
        delete mappings[userId];
        mappings['-=' + userId] = null;
      }
    }

    if (Object.keys(mappings).filter((userId) => !userId.startsWith('-=')).length === 0) {
      await this.object.document.unsetFlag('token-variants', 'userMappings');
    } else {
      await this.object.document.setFlag('token-variants', 'userMappings', mappings);
    }

    for (const img of affectedImages) {
      this.regenStyle(this.object, img);
    }
  }
}
