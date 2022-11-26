import { TVA_CONFIG, updateSettings } from '../scripts/settings.js';
import { cacheImages } from '../token-variants.mjs';
import ActiveEffectConfigList from './activeEffectConfigList.js';
import { showPathSelectCategoryDialog } from './dialogs.js';

export default class ConfigureSettings extends FormApplication {
  constructor(
    dummySettings,
    {
      searchPaths = true,
      searchFilters = true,
      searchAlgorithm = true,
      randomizer = true,
      popup = true,
      permissions = true,
      worldHud = true,
      misc = true,
      activeEffects = true,
    } = {}
  ) {
    super({}, {});
    this.enabledTabs = {
      searchPaths,
      searchFilters,
      searchAlgorithm,
      randomizer,
      popup,
      permissions,
      worldHud,
      misc,
      activeEffects,
    };
    this.settings = foundry.utils.deepClone(TVA_CONFIG);
    if (dummySettings) {
      this.settings = mergeObject(this.settings, dummySettings, { insertKeys: false });
      this.dummySettings = dummySettings;
    }
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-configure-settings',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/configureSettings.html',
      resizable: false,
      minimizable: false,
      title: 'Configure Settings',
      width: 600,
      height: 'auto',
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.content', initial: 'searchPaths' }],
    });
  }

  async getData(options) {
    const data = super.getData(options);
    const settings = this.settings;

    data.enabledTabs = this.enabledTabs;

    // === Search Paths ===
    const paths = settings.searchPaths.map((path) => {
      const r = {};
      r.text = path.text;
      r.icon = this._pathIcon(path.source || '');
      r.cache = path.cache;
      r.source = path.source || '';
      r.types = path.types.join(',');
      return r;
    });
    data.searchPaths = paths;

    // === Search Filters ===
    data.searchFilters = settings.searchFilters;
    for (const filter in data.searchFilters) {
      data.searchFilters[filter].label = filter;
    }

    // === Algorithm ===
    data.algorithm = deepClone(settings.algorithm);
    data.algorithm.fuzzyThreshold = 100 - data.algorithm.fuzzyThreshold * 100;

    // === Randomizer ===
    // Get all actor types defined by the game system
    data.randomizer = deepClone(settings.randomizer);
    const actorTypes = (game.system.entityTypes ?? game.system.documentTypes)['Actor'];
    data.randomizer.actorTypes = actorTypes.reduce((obj, t) => {
      const label = CONFIG['Actor']?.typeLabels?.[t] ?? t;
      obj[t] = {
        label: game.i18n.has(label) ? game.i18n.localize(label) : t,
        disable: settings.randomizer[`${t}Disable`] ?? false,
      };
      return obj;
    }, {});

    data.randomizer.tokenToPortraitDisabled =
      !(settings.randomizer.tokenCreate || settings.randomizer.tokenCopyPaste) ||
      data.randomizer.diffImages;

    // === Pop-up ===
    data.popup = deepClone(settings.popup);
    // Get all actor types defined by the game system
    data.popup.actorTypes = actorTypes.reduce((obj, t) => {
      const label = CONFIG['Actor']?.typeLabels?.[t] ?? t;
      obj[t] = {
        type: t,
        label: game.i18n.has(label) ? game.i18n.localize(label) : t,
        disable: settings.popup[`${t}Disable`] ?? false,
      };
      return obj;
    }, {});

    // Split into arrays of max length 3
    let allTypes = [];
    let tempTypes = [];
    let i = 0;
    for (const [key, value] of Object.entries(data.popup.actorTypes)) {
      tempTypes.push(value);
      i++;
      if (i % 3 == 0) {
        allTypes.push(tempTypes);
        tempTypes = [];
      }
    }
    if (tempTypes.length > 0) allTypes.push(tempTypes);
    data.popup.actorTypes = allTypes;

    // === Permissions ===
    data.permissions = settings.permissions;

    // === Token HUD ===
    data.worldHud = deepClone(settings.worldHud);
    data.worldHud.tokenHUDWildcardActive = game.modules.get('token-hud-wildcard')?.active;

    // === Misc ===
    data.keywordSearch = settings.keywordSearch;
    data.excludedKeywords = settings.excludedKeywords;
    data.runSearchOnPath = settings.runSearchOnPath;
    data.imgurClientId = settings.imgurClientId;
    data.enableStatusConfig = settings.enableStatusConfig;
    data.disableNotifs = settings.disableNotifs;
    data.staticCache = settings.staticCache;
    data.staticCacheFile = settings.staticCacheFile;
    data.stackStatusConfig = settings.stackStatusConfig;
    data.customImageCategories = settings.customImageCategories.join(',');
    data.disableEffectIcons = settings.disableEffectIcons;
    data.displayEffectIconsOnHover = settings.displayEffectIconsOnHover;
    data.filterEffectIcons = settings.filterEffectIcons;
    data.filterCustomEffectIcons = settings.filterCustomEffectIcons;
    data.filterIconList = settings.filterIconList.join(',');
    data.tilesEnabled = settings.tilesEnabled;
    data.updateTokenProto = settings.updateTokenProto;
    data.playVideoOnHover = settings.playVideoOnHover;
    data.pauseVideoOnHoverOut = settings.pauseVideoOnHoverOut;

    // Controls
    data.pathfinder = ['pf1e', 'pf2e'].includes(game.system.id);

    return data;
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);

    // Search Paths
    super.activateListeners(html);
    html.find('a.create-path').click(this._onCreatePath.bind(this));
    html.on('input', '.searchSource', this._onSearchSourceTextChange.bind(this));
    $(html).on('click', 'a.delete-path', this._onDeletePath.bind(this));
    $(html).on('click', 'a.convert-imgur', this._onConvertImgurPath.bind(this));
    $(html).on('click', '.path-image.source-icon a', this._onBrowseFolder.bind(this));
    $(html).on('click', 'a.select-category', showPathSelectCategoryDialog.bind(this));

    // Search Filters
    html.on('input', 'input.filterRegex', this._validateRegex.bind(this));

    // Algorithm
    const algorithmTab = $(html).find('div[data-tab="searchAlgorithm"]');
    algorithmTab.find(`input[name="algorithm.exact"]`).change((e) => {
      $(e.target)
        .closest('form')
        .find('input[name="algorithm.fuzzy"]')
        .prop('checked', !e.target.checked);
    });
    algorithmTab.find(`input[name="algorithm.fuzzy"]`).change((e) => {
      $(e.target)
        .closest('form')
        .find('input[name="algorithm.exact"]')
        .prop('checked', !e.target.checked);
    });
    algorithmTab.find('input[name="algorithm.fuzzyThreshold"]').change((e) => {
      $(e.target).siblings('.token-variants-range-value').html(`${e.target.value}%`);
    });

    // Randomizer
    const tokenCreate = html.find('input[name="randomizer.tokenCreate"]');
    const tokenCopyPaste = html.find('input[name="randomizer.tokenCopyPaste"]');
    const tokenToPortrait = html.find('input[name="randomizer.tokenToPortrait"]');
    const _toggle = () => {
      tokenToPortrait.prop(
        'disabled',
        !(tokenCreate.is(':checked') || tokenCopyPaste.is(':checked'))
      );
    };
    tokenCreate.change(_toggle);
    tokenCopyPaste.change(_toggle);

    const diffImages = html.find('input[name="randomizer.diffImages"]');
    const syncImages = html.find('input[name="randomizer.syncImages"]');
    diffImages.change(() => {
      syncImages.prop('disabled', !diffImages.is(':checked'));
      tokenToPortrait.prop('disabled', diffImages.is(':checked'));
    });

    // Token HUD
    html.find('input[name="worldHud.updateActorImage"]').change((event) => {
      $(event.target)
        .closest('form')
        .find('input[name="worldHud.useNameSimilarity"]')
        .prop('disabled', !event.target.checked);
    });

    // Static Cache
    html.find('button.token-variants-cache-images').click((event) => {
      const tab = $(event.target).closest('.tab');
      const staticOn = tab.find('input[name="staticCache"]');
      const staticFile = tab.find('input[name="staticCacheFile"]');
      cacheImages({ staticCache: staticOn.is(':checked'), staticCacheFile: staticFile.val() });
    });

    // Global Mappings
    html.find('button.token-variants-global-mapping').click(() => {
      const setting = game.settings.get('core', DefaultTokenConfig.SETTING);
      const data = new foundry.data.PrototypeToken(setting);
      const token = new TokenDocument(data, { actor: null });
      new ActiveEffectConfigList(
        token,
        true,
        () => (this.settings.globalMappings = TVA_CONFIG.globalMappings)
      ).render(true);
    });
  }

  /**
   * Validates regex entered into Search Filter's RegEx input field
   */
  async _validateRegex(event) {
    if (this._validRegex(event.target.value)) {
      event.target.style.backgroundColor = '';
    } else {
      event.target.style.backgroundColor = '#ff7066';
    }
  }

  _validRegex(val) {
    if (val) {
      try {
        new RegExp(val);
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  /**
   * Open a FilePicker so the user can select a local folder to use as an image source
   */
  async _onBrowseFolder(event) {
    const pathInput = $(event.target).closest('.table-row').find('.path-text input');
    const sourceInput = $(event.target).closest('.table-row').find('.path-source input');

    let activeSource = sourceInput.val() || 'data';
    let current = pathInput.val();

    if (activeSource.startsWith('s3:')) {
      const bucketName = activeSource.replace('s3:', '');
      current = `${game.data.files.s3?.endpoint.protocol}//${bucketName}.${game.data.files.s3?.endpoint.host}/${current}`;
    } else if (activeSource.startsWith('rolltable')) {
      let content = `<select style="width: 100%;" name="table-name" id="output-tableKey">`;

      game.tables.forEach((rollTable) => {
        content += `<option value='${rollTable.name}'>${rollTable.name}</option>`;
      });

      content += `</select>`;

      new Dialog({
        title: `Select a Rolltable`,
        content: content,
        buttons: {
          yes: {
            icon: "<i class='fas fa-check'></i>",
            label: 'Select',
            callback: (html) => {
              pathInput.val();
              const tableName = html.find("select[name='table-name']").val();
              pathInput.val(tableName);
            },
          },
        },
        default: 'yes',
      }).render(true);
      return;
    }

    new FilePicker({
      type: 'folder',
      activeSource: activeSource,
      current: current,
      callback: (path, fp) => {
        pathInput.val(fp.result.target);
        if (fp.activeSource === 's3') {
          sourceInput.val(`s3:${fp.result.bucket}`);
        } else {
          sourceInput.val(fp.activeSource);
        }
      },
    }).render(true);
  }

  /**
   * Converts Imgur path to a rolltable
   */
  async _onConvertImgurPath(event) {
    event.preventDefault();

    const pathInput = $(event.target).closest('.table-row').find('.path-text input');
    const sourceInput = $(event.target).closest('.table-row').find('.path-source input');

    const albumHash = pathInput.val();
    const imgurClientId =
      TVA_CONFIG.imgurClientId === '' ? 'df9d991443bb222' : TVA_CONFIG.imgurClientId;

    fetch('https://api.imgur.com/3/gallery/album/' + albumHash, {
      headers: {
        Authorization: 'Client-ID ' + imgurClientId,
        Accept: 'application/json',
      },
    })
      .then((response) => response.json())
      .then(
        async function (result) {
          if (!result.success && location.hostname === 'localhost') {
            ui.notifications.warn(
              game.i18n.format('token-variants.notifications.warn.imgur-localhost')
            );
            return;
          }

          const data = result.data;

          let resultsArray = [];
          data.images.forEach((img, i) => {
            resultsArray.push({
              type: 0,
              text: img.title ?? img.description ?? '',
              weight: 1,
              range: [i + 1, i + 1],
              collection: 'Text',
              drawn: false,
              img: img.link,
            });
          });

          await RollTable.create({
            name: data.title,
            description:
              'Token Variant Art auto generated RollTable: https://imgur.com/gallery/' + albumHash,
            results: resultsArray,
            replacement: true,
            displayRoll: true,
            img: 'modules/token-variants/img/token-images.svg',
          });

          pathInput.val(data.title);
          sourceInput.val('rolltable').trigger('input');
        }.bind(this)
      )
      .catch((error) => console.log('Token Variant Art | ', error));
  }

  /**
   * Generates a new search path row
   */
  async _onCreatePath(event) {
    event.preventDefault();
    const table = $(event.currentTarget).closest('.token-variant-table');
    let row = `
    <li class="table-row flexrow">
        <div class="path-image source-icon">
            <a><i class="${this._pathIcon('')}"></i></a>
        </div>
        <div class="path-source">
          <input class="searchSource" type="text" name="searchPaths.source" value="" placeholder="data"/>
        </div>
        <div class="path-text">
            <input class="searchPath" type="text" name="searchPaths.text" value="" placeholder="Path to folder"/>
        </div>
        <div class="imgur-control">
            <a class="convert-imgur" title="Convert to Rolltable"><i class="fas fa-angle-double-left"></i></a>
        </div>
        <div class="path-category">
            <a class="select-category" title="Select image categories/filters"><i class="fas fa-swatchbook"></i></a>
            <input type="hidden" name="searchPaths.types" value="Portrait,Token,PortraitAndToken">
        </div>
        <div class="path-cache">
            <input type="checkbox" name="searchPaths.cache" data-dtype="Boolean" checked/>
        </div>
        <div class="path-controls">
            <a class="delete-path" title="Delete path"><i class="fas fa-trash"></i></a>
        </div>
    </li>
  `;
    table.append(row);

    this._reIndexPaths(table);

    this.setPosition(); // Auto-resize window
  }

  async _reIndexPaths(table) {
    table
      .find('.path-source')
      .find('input')
      .each(function (index) {
        $(this).attr('name', `searchPaths.${index}.source`);
      });

    table
      .find('.path-text')
      .find('input')
      .each(function (index) {
        $(this).attr('name', `searchPaths.${index}.text`);
      });

    table
      .find('.path-cache')
      .find('input')
      .each(function (index) {
        $(this).attr('name', `searchPaths.${index}.cache`);
      });
    table
      .find('.path-category')
      .find('input')
      .each(function (index) {
        $(this).attr('name', `searchPaths.${index}.types`);
      });
  }

  async _onDeletePath(event) {
    event.preventDefault();

    const li = event.currentTarget.closest('.table-row');
    li.remove();

    const table = $(event.currentTarget).closest('.token-variant-table');
    this._reIndexPaths(table);

    this.setPosition(); // Auto-resize window
  }

  async _onSearchSourceTextChange(event) {
    const image = this._pathIcon(event.target.value);
    const imgur = image === 'fas fa-info';

    const imgurControl = $(event.currentTarget).closest('.table-row').find('.imgur-control');
    if (imgur) imgurControl.addClass('active');
    else imgurControl.removeClass('active');

    $(event.currentTarget).closest('.table-row').find('.path-image i').attr('class', image);
  }

  // Return icon appropriate for the path provided
  _pathIcon(source) {
    if (source.startsWith('s3')) {
      return 'fas fa-database';
    } else if (source.startsWith('rolltable')) {
      return 'fas fa-dice';
    } else if (source.startsWith('forgevtt') || source.startsWith('forge-bazaar')) {
      return 'fas fa-hammer';
    } else if (source.startsWith('imgur')) {
      return 'fas fa-info';
    }

    return 'fas fa-folder';
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    const settings = this.settings;
    formData = expandObject(formData);

    // Search Paths
    settings.searchPaths = formData.hasOwnProperty('searchPaths')
      ? Object.values(formData.searchPaths)
      : [];
    settings.searchPaths.forEach((path) => {
      if (!path.source) path.source = 'data';
      if (path.types) path.types = path.types.split(',');
      else path.types = [];
    });

    // Search Filters
    for (const filter in formData.searchFilters) {
      if (!this._validRegex(formData.searchFilters[filter].regex))
        formData.searchFilters[filter].regex = '';
    }
    mergeObject(settings.searchFilters, formData.searchFilters);

    // Algorithm
    formData.algorithm.fuzzyLimit = parseInt(formData.algorithm.fuzzyLimit);
    if (isNaN(formData.algorithm.fuzzyLimit) || formData.algorithm.fuzzyLimit < 1)
      formData.algorithm.fuzzyLimit = 50;
    formData.algorithm.fuzzyThreshold = (100 - formData.algorithm.fuzzyThreshold) / 100;
    mergeObject(settings.algorithm, formData.algorithm);

    // Randomizer
    mergeObject(settings.randomizer, formData.randomizer);

    // Pop-up
    mergeObject(settings.popup, formData.popup);

    // Permissions
    mergeObject(settings.permissions, formData.permissions);

    // Token HUD
    mergeObject(settings.worldHud, formData.worldHud);

    // Misc
    mergeObject(settings, {
      keywordSearch: formData.keywordSearch,
      excludedKeywords: formData.excludedKeywords,
      runSearchOnPath: formData.runSearchOnPath,
      imgurClientId: formData.imgurClientId,
      enableStatusConfig: formData.enableStatusConfig,
      disableNotifs: formData.disableNotifs,
      staticCache: formData.staticCache,
      staticCacheFile: formData.staticCacheFile,
      tilesEnabled: formData.tilesEnabled,
      stackStatusConfig: formData.stackStatusConfig,
      customImageCategories: (formData.customImageCategories || '')
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t),
      disableEffectIcons: formData.disableEffectIcons,
      displayEffectIconsOnHover: formData.displayEffectIconsOnHover,
      filterEffectIcons: formData.filterEffectIcons,
      filterCustomEffectIcons: formData.filterCustomEffectIcons,
      filterIconList: (formData.filterIconList || '')
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t),
      updateTokenProto: formData.updateTokenProto,
      playVideoOnHover: formData.playVideoOnHover,
      pauseVideoOnHoverOut: formData.pauseVideoOnHoverOut,
    });

    // Save Settings
    if (this.dummySettings) {
      mergeObjectFix(this.dummySettings, settings, { insertKeys: false });
    } else {
      updateSettings(settings);
    }
  }
}

// ========================
// v8 support, broken merge
// ========================
export function mergeObjectFix(
  original,
  other = {},
  {
    insertKeys = true,
    insertValues = true,
    overwrite = true,
    recursive = true,
    inplace = true,
    enforceTypes = false,
  } = {},
  _d = 0
) {
  other = other || {};
  if (!(original instanceof Object) || !(other instanceof Object)) {
    throw new Error('One of original or other are not Objects!');
  }
  const options = { insertKeys, insertValues, overwrite, recursive, inplace, enforceTypes };

  // Special handling at depth 0
  if (_d === 0) {
    if (!inplace) original = deepClone(original);
    if (Object.keys(original).some((k) => /\./.test(k))) original = expandObject(original);
    if (Object.keys(other).some((k) => /\./.test(k))) other = expandObject(other);
  }

  // Iterate over the other object
  for (let k of Object.keys(other)) {
    const v = other[k];
    if (original.hasOwnProperty(k)) _mergeUpdate(original, k, v, options, _d + 1);
    else _mergeInsertFix(original, k, v, options, _d + 1);
  }
  return original;
}

function _mergeInsertFix(original, k, v, { insertKeys, insertValues } = {}, _d) {
  // Recursively create simple objects
  if (v?.constructor === Object && insertKeys) {
    original[k] = mergeObjectFix({}, v, { insertKeys: true, inplace: true });
    return;
  }

  // Delete a key
  if (k.startsWith('-=')) {
    delete original[k.slice(2)];
    return;
  }

  // Insert a key
  const canInsert = (_d <= 1 && insertKeys) || (_d > 1 && insertValues);
  if (canInsert) original[k] = v;
}

function _mergeUpdate(
  original,
  k,
  v,
  { insertKeys, insertValues, enforceTypes, overwrite, recursive } = {},
  _d
) {
  const x = original[k];
  const tv = getType(v);
  const tx = getType(x);

  // Recursively merge an inner object
  if (tv === 'Object' && tx === 'Object' && recursive) {
    return mergeObjectFix(
      x,
      v,
      {
        insertKeys: insertKeys,
        insertValues: insertValues,
        overwrite: overwrite,
        inplace: true,
        enforceTypes: enforceTypes,
      },
      _d
    );
  }

  // Overwrite an existing value
  if (overwrite) {
    if (tx !== 'undefined' && tv !== tx && enforceTypes) {
      throw new Error(`Mismatched data types encountered during object merge.`);
    }
    original[k] = v;
  }
}
