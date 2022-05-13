import { TVA_CONFIG } from '../scripts/settings.js';

function addInputValidation(html, regex, include, exclude) {
  let filterRegex = html.find(`[name=${regex}]`)[0];
  let filterInclude = html.find(`[name=${include}]`)[0];
  let filterExclude = html.find(`[name=${exclude}]`)[0];

  filterRegex.addEventListener('input', function (event) {
    if (event.target.value) {
      try {
        new RegExp(event.target.value);
        filterInclude.disabled = true;
        filterExclude.disabled = true;

        filterRegex.style.backgroundColor = '';
      } catch (e) {
        filterRegex.style.backgroundColor = '#ff7066';
      }
    } else {
      filterInclude.removeAttribute('disabled');
      filterExclude.removeAttribute('disabled');
      filterRegex.style.backgroundColor = '';
    }
  });
}

export default class FilterSettings extends FormApplication {
  constructor() {
    super({}, {});
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-filter-settings',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/searchFilters.html',
      resizable: false,
      minimizable: false,
      title: game.i18n.localize('token-variants.settings.search-filters.Name'),
      width: 500,
    });
  }

  async getData(options) {
    const data = super.getData(options);
    return mergeObject(data, TVA_CONFIG.searchFilters);
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
    addInputValidation(
      html,
      'portraitFilterRegex',
      'portraitFilterInclude',
      'portraitFilterExclude'
    );
    addInputValidation(html, 'tokenFilterRegex', 'tokenFilterInclude', 'tokenFilterExclude');
    addInputValidation(html, 'generalFilterRegex', 'generalFilterInclude', 'generalFilterExclude');
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    function validateRegex(regex) {
      try {
        new RegExp(regex);
        return regex;
      } catch (e) {}
      return '';
    }
    formData.generalFilterRegex = validateRegex(formData.generalFilterRegex);
    formData.tokenFilterRegex = validateRegex(formData.tokenFilterRegex);
    formData.portraitFilterRegex = validateRegex(formData.portraitFilterRegex);

    let updatedSettings = mergeObject(TVA_CONFIG.searchFilters, formData, {
      insertKeys: false,
    });
    game.settings.set('token-variants', 'searchFilterSettings', updatedSettings);
  }
}
