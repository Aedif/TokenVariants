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
      this.templates = await communityTemplates();
    }

    for (const template of this.templates) {
      template.hint = template.hint?.replace(/(\r\n|\n|\r)/gm, '<br>');
    }

    data.category = this.category;
    data.templates = this.templates;
    data.allowDelete = this.category === 'user';
    data.allowCreate = this.category === 'user';
    data.allowCopy = this.category === 'community' || this.category === 'core';

    return data;
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);

    // Position tooltip
    const appWindow = html.closest('#token-variants-templates');
    html.find('.template').on('mouseover', (event) => {
      const template = $(event.target).closest('.template');
      const pos = template.position();
      const tooltip = template.find('.tooltiptext');
      const windowPos = appWindow.position();
      tooltip.css('top', windowPos.top + pos.top).css('left', windowPos.left + pos.left);

      // Lazy load image
      const img = template.find('img');
      if (!img.attr('src')) img.attr('src', img.data('src'));
    });

    if (this.callback) {
      html.find('.template').on('click', async (event) => {
        const li = $(event.target).closest('.template');
        const id = li.data('id');
        const url = li.data('url');
        let mappings;
        let templateName;
        if (url) {
          const template = await getTemplateFromFileURL(url);
          if (template) mappings = template.mappings;
        } else if (id) {
          const template = this.templates.find((t) => t.id === id);
          if (template) {
            templateName = template.name;
            mappings = template.mappings;
          }
        }

        if (mappings) this.callback(templateName, mappings);
      });
    }

    html.find('.search').on('input', () => {
      const filter = html.find('.search').val().trim().toLowerCase();
      html.find('.template-list li').each(function () {
        const li = $(this);
        const description = li.find('.description').text().trim().toLowerCase();
        const name = li.data('name').trim().toLowerCase();
        const createdBy = li.data('creator').trim().toLowerCase();
        if (name.includes(filter) || description.includes(filter) || createdBy.includes(filter)) li.show();
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

    html.find('.copy').on('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const id = $(event.target).closest('.template').data('id');
      if (id) {
        let template;
        if (this.category === 'core') {
          template = deepClone(CORE_TEMPLATES.find((t) => t.id === id));
        } else {
          const fileURL = $(event.target).closest('.template').data('url');
          if (fileURL) template = await getTemplateFromFileURL(fileURL);
        }

        if (template) {
          TVA_CONFIG.templateMappings.push(template);
          await updateSettings({
            templateMappings: TVA_CONFIG.templateMappings,
          });
          ui.notifications.info(`Template {${template.name}} copied to User templates.`);
          this.render(true);
        }
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

  _getHeaderButtons() {
    const buttons = super._getHeaderButtons();
    buttons.unshift({
      label: 'Upload Template',
      class: '.token-variants-submit-template',
      icon: 'fa-solid fa-cloud-arrow-up',
      onclick: () => {
        new TemplateSubmissionForm().render(true);
      },
    });
    return buttons;
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {}
}

class TemplateSubmissionForm extends FormApplication {
  constructor() {
    super({}, {});
  }

  static apiKey = 'AIzaSyCJpwIkpjrG10jaHwcpllvSChxRPawcMXE';

  static get pk() {
    const k2 = 'AIzaSyCJpw';
    const k1 = 'IkpjrG10jaHwcpllv';
    const k3 = 'SChxRPawcMXE';
    return k2 + k1 + k3;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-template-submission',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/templateSubmission.html',
      resizable: true,
      minimizable: false,
      closeOnSubmit: false,
      title: 'Upload Template',
      width: 500,
      height: 'auto',
    });
  }

  async getData(options) {
    const data = super.getData(options);

    data.systemID = game.system.id;
    data.systemTitle = game.system.title;
    data.templates = TVA_CONFIG.templateMappings;

    return data;
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    if (!formData.template) return;
    let template = TVA_CONFIG.templateMappings.find((t) => t.id === formData.template);
    if (!template) return;

    console.log(formData);

    const name = formData.name.trim() || template.name;
    const hint = formData.hint.trim() || template.hint?.trim();
    const createdBy = formData.createdBy.trim();
    const system = formData.system;
    const id = randomID();
    const img = formData.img.trim();

    const result = submitTemplate({ id, name, hint, img, createdBy, system, mappings: template.mappings });
    if (result) this.close();
  }
}

function _setStringField(template, fields, field) {
  if (template[field] && template[field] !== '') {
    fields[field] = { stringValue: template[field] };
  }
}

async function submitTemplate(template) {
  const fields = {};
  ['name', 'hint', 'img', 'id', 'createdBy', 'system'].forEach((field) => _setStringField(template, fields, field));
  fields.mappings = { stringValue: JSON.stringify(template.mappings) };
  fields.createTime = { integerValue: new Date().getTime() };
  fields.approved = { booleanValue: false };

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/tva---templates/databases/(default)/documents/templates?key=${TemplateSubmissionForm.pk}`,
    {
      method: 'POST',
      body: JSON.stringify({
        fields: fields,
      }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }
  );

  if (response.ok && response.status === 200) {
    ui.notifications.info('Template submission completed.');
    return true;
  } else {
    ui.notifications.warn('Template submission failed.');
    return false;
  }
}

const SEARCH_QUERY = {
  structuredQuery: {
    select: {
      fields: [
        {
          fieldPath: 'id',
        },
        {
          fieldPath: 'name',
        },
        {
          fieldPath: 'hint',
        },
        {
          fieldPath: 'createdBy',
        },
        {
          fieldPath: 'img',
        },
        {
          fieldPath: 'system',
        },
      ],
    },
    where: {
      fieldFilter: {
        field: {
          fieldPath: 'approved',
        },
        op: 'EQUAL',
        value: {
          booleanValue: true,
        },
      },
    },
    from: [{ collectionId: 'templates' }],
    orderBy: [
      {
        field: {
          fieldPath: 'createTime',
        },
      },
    ],
    offset: 0,
    limit: 50,
  },
};

async function communityTemplates(search = null) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/tva---templates/databases/(default)/documents:runQuery?key=${TemplateSubmissionForm.pk}`,
    {
      method: 'POST',
      body: JSON.stringify(SEARCH_QUERY),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }
  );

  const templates = [];
  if (response.ok && response.status === 200) {
    const documents = await response.json();

    for (let doc of documents) {
      if ('document' in doc) templates.push(_docToTemplate(doc.document));
    }
  } else {
    ui.notifications.warn('Failed to retrieve Community templates.');
  }
  return templates;
}

function _docToTemplate(doc) {
  const template = {};
  ['id', 'name', 'mappings', 'createdBy', 'img', 'hint', 'system'].forEach((f) => {
    template[f] = doc.fields[f]?.stringValue || '';
  });
  if (template.mappings) template.mappings = JSON.parse(template.mappings);
  else template.fileURL = doc.name;

  if (!template.createdBy) template.createdBy = 'Anonymous';
  return template;
}

async function getTemplateFromFileURL(fileURL) {
  const response = await fetch(`https://firestore.googleapis.com/v1/${fileURL}?key=${TemplateSubmissionForm.pk}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  if (response.ok && response.status === 200) {
    const doc = await response.json();
    return _docToTemplate(doc);
  }
  return null;
}
