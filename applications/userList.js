import { checkAndDisplayUserSpecificImage } from '../scripts/utils.js';

export default class UserList extends FormApplication {
  constructor(token, img, regenStyle) {
    super({}, {});
    this.token = token;
    this.img = img;
    this.regenStyle = regenStyle;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-user-list',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/userList.html',
      resizable: false,
      minimizable: false,
      title: 'User To Image',
      width: 260,
    });
  }

  async getData(options) {
    const data = super.getData(options);
    const mappings = this.token.document.getFlag('token-variants', 'userMappings') || {};
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
    return data;
  }

  async _updateObject(event, formData) {
    const mappings = this.token.document.getFlag('token-variants', 'userMappings') || {};
    let newMappings = {};

    const affectedImages = [this.img];
    const affectedUsers = [];

    for (const [userId, apply] of Object.entries(formData)) {
      if (apply) {
        newMappings[userId] = this.img;

        if (mappings[userId] && mappings[userId] !== this.img) {
          affectedImages.push(mappings[userId]);
          affectedUsers.push(userId);
        } else if (!mappings[userId]) {
          affectedUsers.push(userId);
        }
      } else if (mappings[userId] === this.img) {
        delete mappings[userId];
        affectedUsers.push(userId);
      }
    }

    newMappings = mergeObject(mappings, newMappings);

    if (Object.keys(newMappings).length === 0) {
      await this.token.document.unsetFlag('token-variants', 'userMappings');
    } else {
      await this.token.document.unsetFlag('token-variants', 'userMappings');
      await this.token.document.setFlag('token-variants', 'userMappings', newMappings);
    }

    for (const img of affectedImages) {
      this.regenStyle(this.token, img);
    }

    if (affectedUsers.includes(game.userId)) checkAndDisplayUserSpecificImage(this.token, true);
    // Broadcast the update to the user specific image
    const message = {
      handlerName: 'userMappingChange',
      args: { tokenId: this.token.id, users: affectedUsers },
      type: 'UPDATE',
    };
    game.socket?.emit('module.token-variants', message);
  }
}
