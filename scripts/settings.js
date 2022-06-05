import { cacheTokens } from '../token-variants.mjs';
import { parseSearchPaths, parseKeywords, userRequiresImageCache } from './utils.js';
import { ForgeSearchPaths } from '../applications/searchPaths.js';
import TokenHUDSettings from '../applications/tokenHUDSettings.js';
import CompendiumMapConfig from '../applications/compendiumMap.js';
import ImportExport from '../applications/importExport.js';
import ConfigureSettings from '../applications/configureSettings.js';

export const TVA_CONFIG = {
  debug: false,
  disableNotifs: false,
  searchPaths: [
    {
      text: 'modules/caeora-maps-tokens-assets/assets/tokens/',
      cache: true,
    },
  ],
  forgeSearchPaths: {},
  parsedSearchPaths: [],
  worldHud: {
    displayOnlySharedImages: false,
    disableIfTHWEnabled: false,
    includeKeywords: false,
    updateActorImage: false,
    useNameSimilarity: false,
    includeWildcard: true,
  },
  hud: {
    enableSideMenu: true,
    displayAsImage: true,
    imageOpacity: 50,
    alwaysShowButton: false,
  },
  keywordSearch: true,
  excludedKeywords: 'and,for',
  parsedExcludedKeywords: [],
  actorDirectoryKey: 'Control',
  runSearchOnPath: false,
  searchFilters: {
    portraitFilterInclude: '',
    portraitFilterExclude: '',
    portraitFilterRegex: '',
    tokenFilterInclude: '',
    tokenFilterExclude: '',
    tokenFilterRegex: '',
    generalFilterInclude: '',
    generalFilterExclude: '',
    generalFilterRegex: '',
  },
  algorithm: {
    exact: true,
    fuzzy: false,
    fuzzyLimit: 50,
    fuzzyThreshold: 0.3,
    fuzzyArtSelectPercentSlider: false,
  },
  tokenConfigs: [],
  randomizer: {
    actorCreate: false,
    tokenCreate: false,
    tokenCopyPaste: false,
    tokenName: true,
    keywords: false,
    shared: false,
    representedActorDisable: false,
    linkedActorDisable: true,
    popupOnDisable: false,
    diffImages: false,
    syncImages: false,
  },
  popup: {
    disableAutoPopupOnActorCreate: false,
    disableAutoPopupOnTokenCreate: false,
    disableAutoPopupOnTokenCopyPaste: false,
    twoPopups: false,
    twoPopupsNoDialog: false,
  },
  imgurClientId: '',
  enableStatusConfig: false,
  compendiumMapper: {
    missingOnly: false,
    diffImages: false,
    showImages: true,
    incKeywords: true,
    cache: false,
    autoDisplayArtSelect: true,
    syncImages: false,
  },
  permissions: {
    popups: {
      1: false,
      2: false,
      3: true,
      4: true,
    },
    portrait_right_click: {
      1: false,
      2: false,
      3: true,
      4: true,
    },
    image_path_button: {
      1: false,
      2: false,
      3: true,
      4: true,
    },
    hud: {
      1: true,
      2: true,
      3: true,
      4: true,
    },
    hudFullAccess: {
      1: false,
      2: false,
      3: true,
      4: true,
    },
  },
};

export async function registerSettings() {
  // TEST
  game.settings.registerMenu('token-variants', 'settings', {
    name: 'Configure Settings',
    hint: 'Configure Token Variant Art settings',
    scope: 'world',
    icon: 'fas fa-user-lock',
    type: ConfigureSettings,
    restricted: true,
  });

  game.settings.register('token-variants', 'settings', {
    scope: 'world',
    config: false,
    type: Object,
    default: {},
  });
  // TEST END

  game.settings.register('token-variants', 'debug', {
    scope: 'world',
    config: false,
    type: Boolean,
    default: TVA_CONFIG.debug,
    onChange: (val) => (TVA_CONFIG.debug = val),
  });

  if (typeof ForgeAPI !== 'undefined') {
    game.settings.registerMenu('token-variants', 'forgeSearchPaths', {
      name: game.i18n.localize('token-variants.settings.forge-search-paths.Name'),
      hint: game.i18n.localize('token-variants.settings.forge-search-paths.Hint'),
      icon: 'fas fa-exchange-alt',
      type: ForgeSearchPaths,
      scope: 'client',
      restricted: false,
    });
  }

  // Deprecated 01/06/2022
  game.settings.register('token-variants', 'searchPaths', {
    scope: 'world',
    config: false,
    type: Array,
    default: TVA_CONFIG.searchPaths,
  });

  game.settings.register('token-variants', 'forgeSearchPaths', {
    scope: 'world',
    config: false,
    type: Object,
    default: TVA_CONFIG.forgeSearchPaths,
    onChange: async function (val) {
      if (game.user.can('SETTINGS_MODIFY'))
        await game.settings.set('token-variants', 'forgevttPaths', []);
      TVA_CONFIG.forgeSearchPaths = val;
      TVA_CONFIG.parsedSearchPaths = await parseSearchPaths();
      if (userRequiresImageCache()) cacheTokens();
    },
  });

  // World level Token HUD setting
  game.settings.register('token-variants', 'worldHudSettings', {
    scope: 'world',
    config: false,
    type: Object,
    default: TVA_CONFIG.worldHud,
  });

  // Deprecated 01/06/2022
  game.settings.register('token-variants', 'keywordSearch', {
    scope: 'world',
    config: false,
    type: Boolean,
    default: TVA_CONFIG.keywordSearch,
  });

  // Deprecated 01/06/2022
  game.settings.register('token-variants', 'excludedKeywords', {
    scope: 'world',
    config: false,
    type: String,
    default: 'and,for',
  });

  // Deprecated 01/06/2022
  if (!isNewerVersion(game.version ?? game.data.version, '0.8.9')) {
    game.settings.register('token-variants', 'actorDirectoryKey', {
      scope: 'world',
      config: false,
      type: String,
      default: TVA_CONFIG.actorDirectoryKey,
    });
  }

  // Deprecated 01/06/2022
  game.settings.register('token-variants', 'runSearchOnPath', {
    scope: 'world',
    config: false,
    type: Boolean,
    default: TVA_CONFIG.runSearchOnPath,
  });

  // Deprecated 01/06/2022
  game.settings.register('token-variants', 'searchFilterSettings', {
    scope: 'world',
    config: false,
    type: Object,
    default: TVA_CONFIG.searchFilters,
  });

  game.settings.register('token-variants', 'algorithmSettings', {
    scope: 'world',
    config: false,
    type: Object,
    default: TVA_CONFIG.algorithm,
  });

  game.settings.register('token-variants', 'forgevttPaths', {
    scope: 'world',
    config: false,
    type: Array,
    default: TVA_CONFIG.forgevttPaths,
    onChange: (val) => (TVA_CONFIG.forgevttPaths = val),
  });

  game.settings.register('token-variants', 'tokenConfigs', {
    scope: 'world',
    config: false,
    type: Array,
    default: TVA_CONFIG.tokenConfigs,
    onChange: (val) => (TVA_CONFIG.tokenConfigs = val),
  });

  // Deprecated 01/06/2022
  game.settings.register('token-variants', 'randomizerSettings', {
    scope: 'world',
    config: false,
    type: Object,
    default: TVA_CONFIG.randomizer,
  });

  // Deprecated 01/06/2022
  game.settings.register('token-variants', 'popupSettings', {
    scope: 'world',
    config: false,
    type: Object,
    default: TVA_CONFIG.popup,
  });

  // Deprecated 01/06/2022
  game.settings.register('token-variants', 'imgurClientId', {
    scope: 'world',
    config: false,
    type: String,
    default: TVA_CONFIG.imgurClientId,
  });

  // Deprecated 01/06/2022
  game.settings.register('token-variants', 'enableStatusConfig', {
    scope: 'world',
    config: false,
    default: TVA_CONFIG.enableStatusConfig,
    type: Boolean,
  });

  // Deprecated 01/06/2022
  game.settings.register('token-variants', 'disableNotifs', {
    scope: 'world',
    config: false,
    default: TVA_CONFIG.disableNotifs,
    type: Boolean,
  });

  game.settings.registerMenu('token-variants', 'tokenHUDSettings', {
    name: game.i18n.localize('token-variants.settings.token-hud.Name'),
    hint: game.i18n.localize('token-variants.settings.token-hud.Hint'),
    scope: 'client',
    icon: 'fas fa-exchange-alt',
    type: TokenHUDSettings,
    restricted: false,
  });

  game.settings.registerMenu('token-variants', 'compendiumMapper', {
    name: game.i18n.localize('token-variants.settings.compendium-mapper.Name'),
    hint: game.i18n.localize('token-variants.settings.compendium-mapper.Hint'),
    scope: 'world',
    icon: 'fas fa-cogs',
    type: CompendiumMapConfig,
    restricted: true,
  });

  game.settings.register('token-variants', 'compendiumMapper', {
    scope: 'world',
    config: false,
    type: Object,
    default: TVA_CONFIG.compendiumMapper,
    onChange: (val) => (TVA_CONFIG.compendiumMapper = val),
  });

  game.settings.register('token-variants', 'hudSettings', {
    scope: 'client',
    config: false,
    type: Object,
    default: TVA_CONFIG.hud,
    onChange: (val) => (TVA_CONFIG.hud = val),
  });

  game.settings.register('token-variants', 'permissions', {
    scope: 'world',
    config: false,
    type: Object,
    default: TVA_CONFIG.permissions,
  });

  game.settings.registerMenu('token-variants', 'importExport', {
    name: `${game.i18n.localize('token-variants.common.import')}/${game.i18n.localize(
      'token-variants.common.export'
    )}`,
    hint: game.i18n.localize('token-variants.settings.import-export.Hint'),
    scope: 'world',
    icon: 'fas fa-toolbox',
    type: ImportExport,
    restricted: true,
  });

  // Implemented on 30/05/2022
  // This code should be kept here for long enough to make sure vast majority of users
  // have ran the module and generated the new setting.
  const settings = game.settings.get('token-variants', 'settings');
  if (Object.keys(settings).length === 0) {
    await fetchAllSettings();
    const initSettings = deepClone(TVA_CONFIG);
    delete initSettings.parsedSearchPaths;
    delete initSettings.parsedExcludedKeywords;
    game.settings.set('token-variants', 'settings', initSettings);
  } else {
    mergeObject(TVA_CONFIG, settings);
    // Some settings need to be parsed
    TVA_CONFIG.parsedSearchPaths = await parseSearchPaths(TVA_CONFIG);
    TVA_CONFIG.parsedExcludedKeywords = parseKeywords(TVA_CONFIG.excludedKeywords);
  }
}

export async function fetchAllSettings() {
  TVA_CONFIG.debug = game.settings.get('token-variants', 'debug');
  TVA_CONFIG.searchPaths = game.settings.get('token-variants', 'searchPaths');
  TVA_CONFIG.forgevttPaths = game.settings.get('token-variants', 'forgevttPaths');
  TVA_CONFIG.forgeSearchPaths = game.settings.get('token-variants', 'forgeSearchPaths');
  // Fix for search paths being accidentally stored as an array instead of an object
  if (Array.isArray(TVA_CONFIG.forgeSearchPaths)) {
    if (TVA_CONFIG.forgeSearchPaths.length !== 0) {
      TVA_CONFIG.forgeSearchPaths = TVA_CONFIG.forgeSearchPaths[0];
    } else {
      TVA_CONFIG.forgeSearchPaths = {};
    }
  }

  TVA_CONFIG.hud = game.settings.get('token-variants', 'hudSettings');
  TVA_CONFIG.worldHud = game.settings.get('token-variants', 'worldHudSettings');
  TVA_CONFIG.keywordSearch = game.settings.get('token-variants', 'keywordSearch');
  TVA_CONFIG.excludedKeywords = game.settings.get('token-variants', 'excludedKeywords');
  if (!isNewerVersion(game.version ?? game.data.version, '0.8.9')) {
    TVA_CONFIG.actorDirectoryKey = game.settings.get('token-variants', 'actorDirectoryKey');
  }
  TVA_CONFIG.runSearchOnPath = game.settings.get('token-variants', 'runSearchOnPath');
  TVA_CONFIG.searchFilters = game.settings.get('token-variants', 'searchFilterSettings');
  TVA_CONFIG.algorithm = game.settings.get('token-variants', 'algorithmSettings');
  TVA_CONFIG.tokenConfigs = game.settings.get('token-variants', 'tokenConfigs');
  TVA_CONFIG.randomizer = game.settings.get('token-variants', 'randomizerSettings');
  TVA_CONFIG.popup = game.settings.get('token-variants', 'popupSettings');
  TVA_CONFIG.imgurClientId = game.settings.get('token-variants', 'imgurClientId');
  TVA_CONFIG.enableStatusConfig = game.settings.get('token-variants', 'enableStatusConfig');
  TVA_CONFIG.compendiumMapper = game.settings.get('token-variants', 'compendiumMapper');
  TVA_CONFIG.disableNotifs = game.settings.get('token-variants', 'disableNotifs');
  TVA_CONFIG.permissions = game.settings.get('token-variants', 'permissions');

  // Some settings need to be parsed
  TVA_CONFIG.parsedSearchPaths = await parseSearchPaths(TVA_CONFIG);
  TVA_CONFIG.parsedExcludedKeywords = parseKeywords(TVA_CONFIG.excludedKeywords);
}

export function exportSettingsToJSON() {
  const settings = deepClone(TVA_CONFIG);
  delete settings.parsedSearchPaths;
  delete settings.parsedExcludedKeywords;

  const filename = `token-variants-settings.json`;
  saveDataToFile(JSON.stringify(settings, null, 2), 'text/json', filename);
}

export async function importSettingsFromJSON(json) {
  if (typeof json === 'string') json = JSON.parse(json);
  updateSettings(json);
}

export async function updateSettings(newSettings) {
  // Generate a diff, it will be required when doing post-processing of the modified settings
  const diff = _arrayAwareDiffObject(TVA_CONFIG, newSettings);
  console.log('DIFF', diff);

  let requiresImageCache = false;
  if ('permissions' in diff) {
    if (
      !userRequiresImageCache(TVA_CONFIG.permissions) &&
      userRequiresImageCache(newSettings.permissions)
    )
      requiresImageCache = true;
  }

  // Update live settings
  mergeObject(TVA_CONFIG, newSettings);

  // Save settings
  _saveSettings(TVA_CONFIG);

  // Check if any setting need to be parsed post-update
  if ('searchPaths' in diff) {
    TVA_CONFIG.parsedSearchPaths = await parseSearchPaths(TVA_CONFIG);
    if (userRequiresImageCache(TVA_CONFIG.permissions)) requiresImageCache = true;
  }
  if ('excludedKeywords' in diff) {
    TVA_CONFIG.parsedExcludedKeywords = parseKeywords(TVA_CONFIG.excludedKeywords);
  }

  // Cache/re-cache images if necessary
  if (requiresImageCache) {
    cacheTokens();
  }
}

async function _saveSettings(settings) {
  const newSettings = deepClone(settings);
  delete newSettings.parsedSearchPaths;
  delete newSettings.parsedExcludedKeywords;
  game.settings.set('token-variants', 'settings', newSettings);
}

export function _arrayAwareDiffObject(original, other, { inner = false } = {}) {
  function _difference(v0, v1) {
    let t0 = getType(v0);
    let t1 = getType(v1);
    if (t0 !== t1) return [true, v1];
    if (t0 === 'Array') return [!_arrayEquality(v0, v1), v1];
    if (t0 === 'Object') {
      if (isObjectEmpty(v0) !== isObjectEmpty(v1)) return [true, v1];
      let d = _arrayAwareDiffObject(v0, v1, { inner });
      return [!isObjectEmpty(d), d];
    }
    return [v0 !== v1, v1];
  }

  // Recursively call the _difference function
  return Object.keys(other).reduce((obj, key) => {
    if (inner && !(key in original)) return obj;
    let [isDifferent, difference] = _difference(original[key], other[key]);
    if (isDifferent) obj[key] = difference;
    return obj;
  }, {});
}

function _arrayEquality(a1, a2) {
  if (!(a2 instanceof Array) || a2.length !== a1.length) return false;
  return a1.every((v, i) => {
    if (getType(v) === 'Object') return Object.keys(_arrayAwareDiffObject(v, a2[i])).length === 0;
    return a2[i] === v;
  });
}
