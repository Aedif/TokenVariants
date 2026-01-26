import { importSettingsFromJSON, exportSettingsToJSON } from '../scripts/settings.js';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class ImportExport extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'token-variants-import-export',
    window: { title: 'Import/Export', resizable: false, minimizable: false },
    classes: ['token-variants'],
    actions: {
      export: ImportExport._onExport,
      import: ImportExport._onImport,
    },
    position: { width: 250 },
  };

  /** @override */
  static PARTS = {
    main: {
      template: 'modules/token-variants/templates/importExport.hbs',
    },
  };

  static _onExport() {
    exportSettingsToJSON();
    this.close();
  }

  static async _onImport() {
    const html = `
      <div class="form-group">
          <label for="data">${game.i18n.localize('FILES.SelectFile', false)} </label>
          <input type="file" name="data">
      </div>`;

    const content = document.createElement('div');
    content.innerHTML = html;

    let file;

    await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize('token-variants.settings.import-export.window.import-dialog') },
      content: await foundry.applications.handlebars.renderTemplate('templates/apps/import-data.hbs', {
        hint1: 'You may import Preset data from an exported JSON file.',
        hint2: 'Newly created presets will be added to the current working compendium.',
      }),
      position: { width: 400 },
      buttons: [
        {
          action: 'import',
          label: 'Import',
          icon: 'fa-solid fa-file-import',
          callback: (event, button) => {
            const form = button.form;
            if (!form.data.files.length) {
              return ui.notifications.error('DOCUMENT.ImportDataError', { localize: true });
            }
            file = form.data.files[0];
          },
        },
        {
          action: 'cancel',
          label: 'Cancel',
        },
      ],
    });

    if (file) {
      foundry.utils.readTextFromFile(file).then((json) => {
        importSettingsFromJSON(json);
      });
    }
  }
}
