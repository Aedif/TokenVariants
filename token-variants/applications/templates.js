import { CORE_TEMPLATES } from '../scripts/mappingTemplates.js';
import { TVA_CONFIG, updateSettings } from '../scripts/settings.js';
import { showMappingSelectDialog, showUserTemplateCreateDialog } from './dialogs.js';

export class Templates extends FormApplication {
  constructor({ mappings = null, callback = null } = {}) {
    super({}, {});
    this.mappings = mappings;
    this.callback = callback;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-templates',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/templates.html',
      resizable: false,
      minimizable: false,
      title: 'Mapping Templates',
      width: 500,
      height: 'auto',
    });
  }

  async getData(options) {
    const data = super.getData(options);

    if (!this.category) this.category = TVA_CONFIG.templateMappings?.length ? 'user' : 'core';
    if (this.category === 'user') {
      this.templates = TVA_CONFIG.templateMappings;
    } else if (this.category === 'core') {
      this.templates = CORE_TEMPLATES;
    } else {
      this.templates = [];
    }

    data.category = this.category;
    data.templates = this.templates;
    data.allowDelete = this.category === 'user';
    data.allowCreate = this.category === 'user';
    data.allowCopy = this.category === 'community';

    console.log(data);

    return data;
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);

    if (this.callback) {
      html.find('.template').on('click', (event) => {
        console.log('CLICK');
        let id = $(event.target).closest('.template').data('id');
        if (id) this.callback(this.templates.find((t) => t.id === id));
      });
    }

    html.find('.search').on('input', () => {
      const filter = html.find('.search').val().trim().toLowerCase();
      html.find('.template-list li').each(function () {
        const li = $(this);
        const description = li.attr('title').trim().toLowerCase();
        const name = li.data('name').trim().toLowerCase();
        if (name.includes(filter) || description.includes(filter)) li.show();
        else li.hide();
      });
    });

    html.find('[name="category"]').on('change', (event) => {
      this.category = event.target.value;
      this.render(true);
    });

    html.find('.delete').on('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const id = $(event.target).closest('.template').data('id');
      if (id) {
        await updateSettings({
          templateMappings: TVA_CONFIG.templateMappings.filter((m) => m.id !== id),
        });
        this.render(true);
      }
    });
    html.find('.create').on('click', () => {
      showMappingSelectDialog(this.mappings, {
        title1: 'Create Template',
        callback: (selectedMappings) => {
          if (selectedMappings.length) showUserTemplateCreateDialog(selectedMappings);
        },
      });
    });
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    console.log(formData);
    // if (this.callback) this.callback(this.config);
  }
}
