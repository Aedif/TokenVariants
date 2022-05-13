import { importSettingsFromJSON, exportSettingsToJSON } from '../scripts/settings.js';

export default class ImportExport extends FormApplication {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-import-export',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/importExport.html',
      resizable: false,
      minimizable: false,
      title: 'Import/Export',
      width: 250,
    });
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('.import').click(this._importFromJSONDialog.bind(this));
    html.find('.export').click(() => {
      exportSettingsToJSON();
      this.close();
    });
  }

  async _importFromJSONDialog() {
    const content = await renderTemplate('templates/apps/import-data.html', {
      entity: 'token-variants',
      name: 'settings',
    });
    let dialog = new Promise((resolve, reject) => {
      new Dialog(
        {
          title: game.i18n.localize('token-variants.settings.import-export.window.import-dialog'),
          content: content,
          buttons: {
            import: {
              icon: '<i class="fas fa-file-import"></i>',
              label: game.i18n.localize('token-variants.common.import'),
              callback: (html) => {
                const form = html.find('form')[0];
                if (!form.data.files.length)
                  return ui.notifications?.error('You did not upload a data file!');
                readTextFromFile(form.data.files[0]).then((json) => {
                  importSettingsFromJSON(json);
                  resolve(true);
                });
              },
            },
            no: {
              icon: '<i class="fas fa-times"></i>',
              label: 'Cancel',
              callback: (html) => resolve(false),
            },
          },
          default: 'import',
        },
        {
          width: 400,
        }
      ).render(true);
    });
    this.close();
    return await dialog;
  }
}
