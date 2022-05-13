import { TVA_CONFIG } from '../scripts/settings.js';

export class SearchPaths extends FormApplication {
  constructor() {
    super({}, {});
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-search-paths',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/searchPaths.html',
      resizable: true,
      minimizable: false,
      closeOnSubmit: false,
      title: game.i18n.localize('token-variants.settings.search-paths.Name'),
      width: 500,
      height: 'auto',
      scrollY: ['ol.token-variant-table'],
      dragDrop: [{ dragSelector: null, dropSelector: null }],
    });
  }

  async getData(options) {
    if (!this.object.paths) this.object.paths = await this._getPaths();

    const paths = this.object.paths.map((path) => {
      const r = {};
      r.text = path.text;
      r.type = this._determineType(path.text);
      r.cache = path.cache;
      r.share = path.share;
      return r;
    });

    const data = super.getData(options);
    data.paths = paths;
    return data;
  }

  async _getPaths() {
    const paths = (TVA_CONFIG.searchPaths || []).flat();

    // To maintain compatibility with previous versions
    if (paths.length > 0 && !(paths[0] instanceof Object)) {
      paths.forEach((path, i) => {
        paths[i] = { text: path, cache: true };
      });
    }
    // end of compatibility code

    return paths;
  }

  _determineType(path) {
    const regexpForge = /(.*assets\.forge\-vtt\.com\/)(\w+)\/(.*)/;

    if (path.startsWith('s3:')) {
      return 's3';
    } else if (path.startsWith('rolltable:')) {
      return 'rolltable';
    } else if (path.startsWith('forgevtt:') || path.match(regexpForge)) {
      return 'forge';
    } else if (path.startsWith('imgur:')) {
      return 'imgur';
    }

    return 'local';
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('a.create-path').click(this._onCreatePath.bind(this));
    html.find('a.delete-path').click(this._onDeletePath.bind(this));
    html.find('a.convert-imgur').click(this._onConvertImgur.bind(this));
    html.find('button.reset').click(this._onReset.bind(this));
    html.find('button.update').click(this._onUpdate.bind(this));
    html.on('input', '[type=text]', this._onTextChange.bind(this));
  }

  async _onTextChange(event) {
    const type = this._determineType(event.target.value);
    let image = 'fas fa-folder';
    let imgur = false;
    if (type === 'rolltable') {
      image = 'fas fa-dice';
    } else if (type === 's3') {
      image = 'fas fa-database';
    } else if (type === 'forge') {
      image = 'fas fa-hammer';
    } else if (type === 'imgur') {
      image = 'fas fa-info';
      imgur = true;
    }

    const imgurControl = $(event.currentTarget).closest('.table-row').find('.imgur-control');
    if (imgur) imgurControl.addClass('active');
    else imgurControl.removeClass('active');

    $(event.currentTarget).closest('.table-row').find('.path-image i').attr('class', image);
  }

  async _onCreatePath(event) {
    event.preventDefault();
    await this._onSubmit(event);

    this.object.paths.push({ text: '', cache: true, share: true });
    this.render();
  }

  async _onDeletePath(event) {
    event.preventDefault();
    await this._onSubmit(event);

    const li = event.currentTarget.closest('.table-row');
    this.object.paths.splice(li.dataset.index, 1);
    this.render();
  }

  async _onConvertImgur(event) {
    event.preventDefault();
    await this._onSubmit(event);

    const li = event.currentTarget.closest('.table-row');
    const albumHash = this.object.paths[li.dataset.index].text.split(':')[1];
    const imgurClientId = TVA_CONFIG.imgurClientId ?? 'df9d991443bb222';

    fetch('https://api.imgur.com/3/gallery/album/' + albumHash, {
      headers: {
        Authorization: 'Client-ID ' + imgurClientId,
        Accept: 'application/json',
      },
    })
      .then((response) => response.json())
      .then(
        async function (result) {
          if (!result.success && location.hostname === 'localhost') {
            ui.notifications.warn(
              game.i18n.format('token-variants.notifications.warn.imgur-localhost')
            );
            return;
          }

          const data = result.data;

          let resultsArray = [];
          data.images.forEach((img, i) => {
            resultsArray.push({
              type: 0,
              text: img.title ?? img.description ?? '',
              weight: 1,
              range: [i + 1, i + 1],
              collection: 'Text',
              drawn: false,
              img: img.link,
            });
          });

          await RollTable.create({
            name: data.title,
            description: 'Token Variant Art auto generated RollTable: ' + data.link,
            results: resultsArray,
            replacement: true,
            displayRoll: true,
            img: 'modules/token-variants/img/token-images.svg',
          });

          this.object.paths[li.dataset.index].text = 'rolltable:' + data.title;
          this.render();
        }.bind(this)
      )
      .catch((error) => console.log('Token Variant Art: ', error));
  }

  _onReset(event) {
    event.preventDefault();
    this.object.paths = this._getPaths();
    this.render();
  }

  async _onUpdate(event) {
    event.preventDefault();
    await this._onSubmit(event);
    this._updatePaths();
  }

  async _updateObject(event, formData) {
    const expanded = expandObject(formData);
    expanded.paths = expanded.hasOwnProperty('paths') ? Object.values(expanded.paths) : [];
    expanded.paths.forEach((path, index) => {
      this.object.paths[index] = {
        text: path.text,
        cache: path.cache,
      };
    });
  }

  _cleanPaths() {
    // Cleanup empty and duplicate paths
    let uniquePaths = new Set();
    let paths = this.object.paths.filter((path) => {
      if (!path.text || uniquePaths.has(path.text)) return false;
      uniquePaths.add(path.text);
      return true;
    });
    return paths;
  }

  _updatePaths() {
    const paths = this._cleanPaths();
    game.settings.set('token-variants', 'searchPaths', paths);
  }

  async close(options = {}) {
    await this._onSubmit(event);
    this._updatePaths();
    return super.close(options);
  }
}

export class ForgeSearchPaths extends SearchPaths {
  async _getPaths() {
    const forgePaths = TVA_CONFIG.forgeSearchPaths || {};
    this.userId = typeof ForgeAPI !== 'undefined' ? await ForgeAPI.getUserId() : 'tempUser'; // TODO
    this.apiKey = forgePaths[this.userId]?.apiKey;
    return forgePaths[this.userId]?.paths || [];
  }

  _determineType(path) {
    return 'forge';
  }

  _updatePaths() {
    if (this.userId) {
      const forgePaths = TVA_CONFIG.forgeSearchPaths || {};
      forgePaths[this.userId] = {
        paths: this._cleanPaths(),
        apiKey: this.apiKey,
      };

      if (game.user.isGM) {
        game.settings.set('token-variants', 'forgeSearchPaths', forgePaths);
      } else {
        // Workaround for forgeSearchPaths setting to be updated by non-GM clients
        const message = {
          handlerName: 'forgeSearchPaths',
          args: forgePaths,
          type: 'UPDATE',
        };
        game.socket?.emit('module.token-variants', message);
      }
    }
  }

  async _updateObject(event, formData) {
    const expanded = expandObject(formData);
    expanded.paths = expanded.hasOwnProperty('paths') ? Object.values(expanded.paths) : [];
    expanded.paths.forEach((path, index) => {
      this.object.paths[index] = {
        text: path.text,
        cache: path.cache,
        share: path.share,
      };
    });
    this.apiKey = expanded.apiKey;
  }

  async getData(options) {
    const data = await super.getData(options);
    data.forge = true;
    data.apiKey = this.apiKey;
    return data;
  }
}
