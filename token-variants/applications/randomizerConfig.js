export default class RandomizerConfig extends FormApplication {
  constructor(obj) {
    super({}, {});
    this.actor = game.actors.get(obj.actorId);
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-token-flags',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/randomizerConfig.html',
      resizable: true,
      minimizable: false,
      title: 'Randomizer',
      width: 500,
    });
  }

  async getData(options) {
    const data = super.getData(options);
    const settings = this.actor.getFlag('token-variants', 'randomizerSettings') || {};
    data.randomizer = settings;
    data.hasSettings = !isEmpty(settings);
    data.nameForgeActive = game.modules.get('nameforge')?.active;
    if (data.randomizer.nameForge?.models && Array.isArray(data.randomizer.nameForge.models)) {
      data.randomizer.nameForge.models = data.randomizer.nameForge.models.join(',');
    }
    return data;
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('.selectNameForgeModels').click(this._selectNameForgeModels.bind(this));

    // Can't have both tokenName and actorName checkboxes checked at the same time
    const tokenName = html.find('input[name="randomizer.tokenName"]');
    const actorName = html.find('input[name="randomizer.actorName"]');
    tokenName.change(() => {
      if (tokenName.is(':checked')) actorName.prop('checked', false);
    });
    actorName.change(() => {
      if (actorName.is(':checked')) tokenName.prop('checked', false);
    });
  }

  _selectNameForgeModels(event) {
    const inputSelected = $(event.target).siblings('input');
    const selected = inputSelected.val().split(',');
    const genCheckbox = function (name, value) {
      return `
      <div class="form-group">
        <label>${name}</label>
        <div class="form-fields">
            <input type="checkbox" name="model" value="${value}" data-dtype="Boolean" ${
        selected?.find((v) => v === value) ? 'checked' : ''
      }>
        </div>
      </div>
      `;
    };

    let content = '<form style="overflow-y: scroll; height:400px;">';

    const models = game.modules.get('nameforge').models;
    for (const [k, v] of Object.entries(models.defaultModels)) {
      content += genCheckbox(v.name, 'defaultModels.' + k);
    }
    for (const [k, v] of Object.entries(models.userModels)) {
      content += genCheckbox(v.name, 'userModels.' + k);
    }
    content += `</form>`;

    new Dialog({
      title: `Name Forge Models`,
      content: content,
      buttons: {
        Ok: {
          label: `Select`,
          callback: async (html) => {
            const selectedModels = [];
            html.find('input[type="checkbox"]').each(function () {
              if (this.checked) selectedModels.push(this.value);
            });
            inputSelected.val(selectedModels.join(','));
          },
        },
      },
    }).render(true);
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    if (event.submitter.value === 'remove') {
      await this.actor.unsetFlag('token-variants', 'randomizerSettings');
    } else {
      const expanded = expandObject(formData);
      if (expanded.randomizer.nameForge?.models) {
        expanded.randomizer.nameForge.models = expanded.randomizer.nameForge.models.split(',');
      }
      this.actor.setFlag('token-variants', 'randomizerSettings', expanded.randomizer);
    }
  }
}
