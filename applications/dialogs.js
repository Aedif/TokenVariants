import { TVA_CONFIG } from '../scripts/settings.js';
import { BASE_IMAGE_CATEGORIES } from '../scripts/utils.js';

// Edit overlay configuration as a json string
export function showOverlayJsonConfigDialog(overlayConfig, callback) {
  const config = deepClone(overlayConfig || {});
  delete config.effect;
  let content = `<div style="height: 300px;" class="form-group stacked command"><textarea style="height: 300px;" class="configJson">${JSON.stringify(
    config,
    null,
    2
  )}</textarea></div>`;

  new Dialog({
    title: `Overlay Configuration`,
    content: content,
    buttons: {
      yes: {
        icon: "<i class='fas fa-save'></i>",
        label: 'Save',
        callback: (html) => {
          let json = $(html).find('.configJson').val();
          if (json) {
            try {
              json = JSON.parse(json);
            } catch (e) {
              console.log(e);
              json = {};
            }
          } else {
            json = {};
          }
          callback(json);
        },
      },
    },
    default: 'yes',
  }).render(true);
}

// Change categories assigned to a path
export async function showPathSelectCategoryDialog(event) {
  event.preventDefault();
  const typesInput = $(event.target).closest('.path-category').find('input');
  const selectedTypes = typesInput.val().split(',');

  const categories = BASE_IMAGE_CATEGORIES.concat(TVA_CONFIG.customImageCategories);

  let content = '<div class="token-variants-popup-settings">';

  // Split into rows of 4
  const splits = [];
  let currSplit = [];
  for (let i = 0; i < categories.length; i++) {
    if (i > 0 && i + 1 != categories.length && i % 4 == 0) {
      splits.push(currSplit);
      currSplit = [];
    }
    currSplit.push(categories[i]);
  }
  if (currSplit.length) splits.push(currSplit);

  for (const split of splits) {
    content += '<header class="table-header flexrow">';
    for (const type of split) {
      content += `<label>${type}</label>`;
    }
    content +=
      '</header><ul class="setting-list"><li class="setting form-group"><div class="form-fields">';
    for (const type of split) {
      content += `<input class="category" type="checkbox" name="${type}" data-dtype="Boolean" ${
        selectedTypes.includes(type) ? 'checked' : ''
      }>`;
    }
    content += '</div></li></ul>';
  }
  content += '</div>';

  new Dialog({
    title: `Image Categories/Filters`,
    content: content,
    buttons: {
      yes: {
        icon: "<i class='fas fa-save'></i>",
        label: 'Apply',
        callback: (html) => {
          const types = [];
          $(html)
            .find('.category')
            .each(function () {
              if ($(this).is(':checked')) {
                types.push($(this).attr('name'));
              }
            });
          typesInput.val(types.join(','));
        },
      },
    },
    default: 'yes',
  }).render(true);
}
