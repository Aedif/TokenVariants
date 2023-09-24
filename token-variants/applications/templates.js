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
      this.templates = await retrieveCommunityTemplates();
    }

    for (const template of this.templates) {
      template.hint = template.hint.replace(/(\r\n|\n|\r)/gm, '<br>');
    }

    data.category = this.category;
    data.templates = this.templates;
    data.allowDelete = this.category === 'user';
    data.allowCreate = this.category === 'user';
    data.allowCopy = this.category === 'community';

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
          const template = await (await fetch(url)).json();
          if (template) mapping = template.mappings;
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

  _getHeaderButtons() {
    const buttons = super._getHeaderButtons();
    buttons.unshift({
      label: 'Submit Template',
      class: '.token-variants-submit-template',
      icon: 'fas fa-file-import fa-fw',
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

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-template-submission',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/templateSubmission.html',
      resizable: false,
      minimizable: false,
      title: 'Submit Template',
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

    template = deepClone(template);

    formData.name = formData.name.trim();
    if (formData.name) template.name = formData.name;

    formData.description = formData.description.trim();
    if (formData.description) template.hint = formData.description;

    if (!formData.createdBy || formData.createdBy.length === 1) template.createdBy = 'Anonymous';
    else template.createdBy = formData.createdBy;

    template.system = formData.system;

    uploadTemplate(template);
  }
}

async function uploadTemplate(template) {
  let success = false;
  try {
    const description = generateControlString(template);
    if (description) {
      const fileName = 'template-' + randomID() + '.json';
      const files = {};
      files[fileName] = {
        content: JSON.stringify(template),
      };

      let response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        body: JSON.stringify({
          description: description,
          files: files,
          public: false,
        }),
        headers: {
          Authorization: _getToken(),
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
      });
      success = response.ok && response.status === 201;
    }
  } catch (e) {
    console.log(e);
  }
  if (success) ui.notifications.info('Template submitted.');
  else ui.notifications.warn('Template submission failed.');
}

function generateControlString(template) {
  // Sanitize
  const name = template.name.replaceAll('¬', '');
  const hint = template.hint.replaceAll('¬', '');
  const createdBy = template.createdBy.replaceAll('¬', '');

  return [false, name, hint, template.system, createdBy].join('¬');
}

async function retrieveCommunityTemplates(approved = true) {
  let templates = [];

  let response = await fetch('https://api.github.com/users/aedif/gists', {
    method: 'GET',
    headers: {
      Authorization: _getToken(),
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
  });

  if (response.ok && response.status === 200) {
    const gists = await response.json();
    if (Array.isArray(gists)) {
      for (const gist of gists) {
        const template = await parseGistToTemplate(gist, approved);
        if (template) templates.push(template);
      }
    }
  }
  return templates;
}

// Control: {approved}¬{name}¬{description}¬{gameSystem}¬{createdBy}
async function parseGistToTemplate(gist, approved) {
  try {
    const controlArr = gist.description.split('¬');
    if (controlArr.length < 5) return null; // Control must have minimum of 5 fields to be valid

    if (approved && !eval(controlArr[0])) return null;

    const fileURL = gist.files[Object.keys(gist.files)[0]]['raw_url'];
    return {
      name: controlArr[1],
      hint: controlArr[2],
      system: controlArr[3],
      createdBy: controlArr[4],
      templateURL: fileURL,
    };
  } catch (e) {}

  return null;
}

function _getToken() {
  let p1, p2, p3;
  p1 = 'Iaaf2k6rYZ92VFI8H';
  p2 = 'xVxyoej8Rz6N';
  p3 = 'ghp_qeJmpSX';
  return 'Bearer ' + p3 + p2 + p1;
}
