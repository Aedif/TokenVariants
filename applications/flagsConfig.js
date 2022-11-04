export default class FlagsConfig extends FormApplication {
  constructor(obj) {
    super({}, {});
    if (obj instanceof Tile) {
      this.objectToFlag = obj.document;
      this.isTile = true;
    } else {
      this.objectToFlag = game.actors.get(obj.document.actorId) || obj.document;
    }
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-token-flags',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/flagsConfig.html',
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
    const disableNameSearch = this.objectToFlag.getFlag('token-variants', 'disableNameSearch');
    const directory = this.objectToFlag.getFlag('token-variants', 'directory') || {};

    return mergeObject(data, {
      randomize: randomize,
      randomizeSetFlag: randomize != null,
      popups: popups,
      popupsSetFlag: popups != null,
      disableNameSearch: disableNameSearch,
      disableNameSearchSetFlag: disableNameSearch != null,
      directory: directory.path,
      directorySource: directory.source,
      directorySetFlag: !isEmpty(directory),
      tile: this.isTile,
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
    html.find('.directory-fp').click((event) => {
      new FilePicker({
        type: 'folder',
        activeSource: 'data',
        callback: (path, fp) => {
          html.find('[name="directory"]').val(fp.result.target);
          $(event.target)
            .closest('button')
            .attr('title', 'Directory: ' + fp.result.target);
          const sourceEl = html.find('[name="directorySource"]');
          if (fp.activeSource === 's3') {
            sourceEl.val(`s3:${fp.result.bucket}`);
          } else {
            sourceEl.val(fp.activeSource);
          }
        },
      }).render(true);
    });
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    if ('directory' in formData) {
      formData.directory = { path: formData.directory, source: formData.directorySource };
    }

    ['randomize', 'popups', 'disableNameSearch', 'directory'].forEach((flag) => {
      if (flag in formData) {
        this.objectToFlag.setFlag('token-variants', flag, formData[flag]);
      } else {
        this.objectToFlag.unsetFlag('token-variants', flag);
      }
    });
  }
}
