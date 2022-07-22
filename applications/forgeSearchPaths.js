import { TVA_CONFIG, updateSettings } from '../scripts/settings.js';
import { showPathSelectCategoryDialog } from './dialogs.js';

export class ForgeSearchPaths extends FormApplication {
  constructor() {
    super({}, {});
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-search-paths',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/forgeSearchPaths.html',
      resizable: true,
      minimizable: false,
      closeOnSubmit: false,
      title: game.i18n.localize('token-variants.settings.search-paths.Name'),
      width: 592,
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
      r.cache = path.cache;
      r.share = path.share;
      r.types = path.types.join(',');
      return r;
    });

    const data = super.getData(options);
    data.paths = paths;
    data.apiKey = this.apiKey;
    return data;
  }

  async _getPaths() {
    const forgePaths = deepClone(TVA_CONFIG.forgeSearchPaths) || {};
    this.userId = typeof ForgeAPI !== 'undefined' ? await ForgeAPI.getUserId() : 'tempUser'; // TODO
    this.apiKey = forgePaths[this.userId]?.apiKey;
    return forgePaths[this.userId]?.paths || [];
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('a.create-path').click(this._onCreatePath.bind(this));
    $(html).on('click', 'a.select-category', showPathSelectCategoryDialog.bind(this));
    html.find('a.delete-path').click(this._onDeletePath.bind(this));
    html.find('button.reset').click(this._onReset.bind(this));
    html.find('button.update').click(this._onUpdate.bind(this));
    $(html).on('click', '.path-image.source-icon a', this._onBrowseFolder.bind(this));
  }

  /**
   * Open a FilePicker so the user can select a local folder to use as an image source
   */
  async _onBrowseFolder(event) {
    const pathInput = $(event.target).closest('.table-row').find('.path-text input');

    new FilePicker({
      type: 'folder',
      activeSource: 'forgevtt',
      current: pathInput.val(),
      callback: (path, fp) => {
        if (fp.activeSource !== 'forgevtt') {
          ui.notifications.warn("Token Variant Art: Only 'Assets Library' paths are supported");
        } else {
          pathInput.val(fp.result.target);
        }
      },
    }).render(true);
  }

  async _onCreatePath(event) {
    event.preventDefault();
    await this._onSubmit(event);

    this.object.paths.push({
      text: '',
      cache: true,
      share: true,
      types: ['Portrait', 'Token', 'PortraitAndToken'],
    });
    this.render();
  }

  async _onDeletePath(event) {
    event.preventDefault();
    await this._onSubmit(event);

    const li = event.currentTarget.closest('.table-row');
    this.object.paths.splice(li.dataset.index, 1);
    this.render();
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
        share: path.share,
        source: path.source,
        types: path.types.split(','),
      };
    });
    this.apiKey = expanded.apiKey;
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
    if (this.userId) {
      const forgePaths = deepClone(TVA_CONFIG.forgeSearchPaths) || {};
      forgePaths[this.userId] = {
        paths: this._cleanPaths(),
        apiKey: this.apiKey,
      };

      if (game.user.isGM) {
        updateSettings({ forgeSearchPaths: forgePaths });
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

  async close(options = {}) {
    await this._onSubmit(event);
    this._updatePaths();
    return super.close(options);
  }
}
