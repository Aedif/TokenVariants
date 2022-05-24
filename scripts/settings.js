import { cacheTokens } from '../token-variants.mjs';
import { parseSearchPaths, parseKeywords, userRequiresImageCache } from './utils.js';
import { SearchPaths, ForgeSearchPaths } from '../applications/searchPaths.js';
import TokenHUDSettings from '../applications/tokenHUDSettings.js';
import PopUpSettings from '../applications/popupSettings.js';
import CompendiumMapConfig from '../applications/compendiumMap.js';
import FilterSettings from '../applications/searchFilters.js';
import AlgorithmSettings from '../applications/algorithm.js';
import RandomizerSettings from '../applications/randomizerSettings.js';
import ImportExport from '../applications/importExport.js';
import TVAPermissions from '../applications/permissions.js';

export const TVA_CONFIG = {
  debug: false,
  disableNotifs: false,
  searchPaths: [
    {
      text: 'modules/caeora-maps-tokens-assets/assets/tokens/',
      cache: true,
    },
  ],
  forgevttPaths: [],
  forgeSearchPaths: {},
  parsedSearchPaths: [],
  worldHud: {
    displayOnlySharedImages: false,
    disableIfTHWEnabled: false,
    includeKeywords: false,
    updateActorImage: false,
    useNameSimilarity: false,
  },
  hud: {
    enableSideMenu: true,
    displayAsImage: true,
    imageOpacity: 50,
    alwaysShowButton: false,
    includeWildcard: true,
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

  game.settings.registerMenu('token-variants', 'searchPaths', {
    name: game.i18n.localize('token-variants.settings.search-paths.Name'),
    hint: game.i18n.localize('token-variants.settings.search-paths.Hint'),
    icon: 'fas fa-exchange-alt',
    type: SearchPaths,
    restricted: true,
  });

  game.settings.register('token-variants', 'searchPaths', {
    scope: 'world',
    config: false,
    type: Array,
    default: TVA_CONFIG.searchPaths,
    onChange: async function (val) {
      if (game.user.can('SETTINGS_MODIFY'))
        await game.settings.set('token-variants', 'forgevttPaths', []);
      TVA_CONFIG.searchPaths = val;
      TVA_CONFIG.parsedSearchPaths = await parseSearchPaths();
      if (userRequiresImageCache()) cacheTokens();
    },
  });

  game.settings.register('token-variants', 'forgeSearchPaths', {
    scope: 'world',
    config: false,
    type: Array,
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
    onChange: (val) => (TVA_CONFIG.worldHud = val),
  });

  game.settings.register('token-variants', 'keywordSearch', {
    name: game.i18n.localize('token-variants.settings.keywords-search.Name'),
    hint: game.i18n.localize('token-variants.settings.keywords-search.Hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: TVA_CONFIG.keywordSearch,
    onChange: (val) => (TVA_CONFIG.keywordSearch = val),
  });

  game.settings.register('token-variants', 'excludedKeywords', {
    name: game.i18n.localize('token-variants.settings.excluded-keywords.Name'),
    hint: game.i18n.localize('token-variants.settings.excluded-keywords.Hint'),
    scope: 'world',
    config: true,
    type: String,
    default: 'and,for',
    onChange: (val) => {
      TVA_CONFIG.excludedKeywords = val;
      TVA_CONFIG.parsedExcludedKeywords = parseKeywords(val);
    },
  });

  if (!isNewerVersion(game.version ?? game.data.version, '0.8.9')) {
    game.settings.register('token-variants', 'actorDirectoryKey', {
      name: game.i18n.localize('token-variants.settings.actor-directory-key.Name'),
      hint: game.i18n.localize('token-variants.settings.actor-directory-key.Hint'),
      scope: 'world',
      config: true,
      type: String,
      choices: {
        Control: 'Ctrl',
        Shift: 'Shift',
        Alt: 'Alt',
      },
      default: TVA_CONFIG.actorDirectoryKey,
      onChange: (val) => (TVA_CONFIG.actorDirectoryKey = val),
    });
  }

  game.settings.register('token-variants', 'runSearchOnPath', {
    name: game.i18n.localize('token-variants.settings.run-search-on-path.Name'),
    hint: game.i18n.localize('token-variants.settings.run-search-on-path.Hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: TVA_CONFIG.runSearchOnPath,
    onChange: (val) => (TVA_CONFIG.runSearchOnPath = val),
  });

  game.settings.registerMenu('token-variants', 'searchFilterMenu', {
    name: game.i18n.localize('token-variants.settings.search-filters.Name'),
    hint: game.i18n.localize('token-variants.settings.search-filters.Hint'),
    scope: 'world',
    icon: 'fas fa-exchange-alt',
    type: FilterSettings,
    restricted: true,
  });

  game.settings.register('token-variants', 'searchFilterSettings', {
    scope: 'world',
    config: false,
    type: Object,
    default: TVA_CONFIG.searchFilters,
    onChange: (val) => (TVA_CONFIG.searchFilters = val),
  });

  game.settings.registerMenu('token-variants', 'algorithmMenu', {
    name: game.i18n.localize('token-variants.settings.algorithm.Name'),
    hint: game.i18n.localize('token-variants.settings.algorithm.Hint'),
    scope: 'world',
    icon: 'fas fa-exchange-alt',
    type: AlgorithmSettings,
    restricted: true,
  });

  game.settings.register('token-variants', 'algorithmSettings', {
    scope: 'world',
    config: false,
    type: Object,
    default: TVA_CONFIG.algorithm,
    onChange: (val) => (TVA_CONFIG.algorithm = val),
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

  game.settings.registerMenu('token-variants', 'randomizerMenu', {
    name: game.i18n.localize('token-variants.settings.randomizer.Name'),
    hint: game.i18n.localize('token-variants.settings.randomizer.Hint'),
    scope: 'world',
    icon: 'fas fa-exchange-alt',
    type: RandomizerSettings,
    restricted: true,
  });

  game.settings.register('token-variants', 'randomizerSettings', {
    scope: 'world',
    config: false,
    type: Object,
    default: TVA_CONFIG.randomizer,
    onChange: (val) => (TVA_CONFIG.randomizer = val),
  });

  game.settings.registerMenu('token-variants', 'popupMenu', {
    name: game.i18n.localize('token-variants.settings.pop-up.Name'),
    hint: game.i18n.localize('token-variants.settings.pop-up.Hint'),
    scope: 'world',
    icon: 'fas fa-exchange-alt',
    type: PopUpSettings,
    restricted: true,
  });

  game.settings.register('token-variants', 'popupSettings', {
    scope: 'world',
    config: false,
    type: Object,
    default: TVA_CONFIG.popup,
    onChange: (val) => (TVA_CONFIG.popup = val),
  });

  game.settings.register('token-variants', 'imgurClientId', {
    name: game.i18n.localize('token-variants.settings.imgur-client-id.Name'),
    hint: game.i18n.localize('token-variants.settings.imgur-client-id.Hint'),
    scope: 'world',
    config: true,
    type: String,
    default: TVA_CONFIG.imgurClientId,
    onChange: (val) => (TVA_CONFIG.imgurClientId = val),
  });

  game.settings.register('token-variants', 'enableStatusConfig', {
    name: game.i18n.localize('token-variants.settings.status-config.Name'),
    hint: game.i18n.localize('token-variants.settings.status-config.Hint'),
    scope: 'world',
    config: true,
    default: TVA_CONFIG.enableStatusConfig,
    type: Boolean,
    onChange: (val) => (TVA_CONFIG.enableStatusConfig = val),
  });

  game.settings.register('token-variants', 'disableNotifs', {
    name: game.i18n.localize('token-variants.settings.disable-notifs.Name'),
    hint: game.i18n.localize('token-variants.settings.disable-notifs.Hint'),
    scope: 'world',
    config: true,
    default: TVA_CONFIG.disableNotifs,
    type: Boolean,
    onChange: (val) => (TVA_CONFIG.disableNotifs = val),
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

  game.settings.registerMenu('token-variants', 'tokenHUDSettings', {
    name: game.i18n.localize('token-variants.settings.token-hud.Name'),
    hint: game.i18n.localize('token-variants.settings.token-hud.Hint'),
    scope: 'client',
    icon: 'fas fa-exchange-alt',
    type: TokenHUDSettings,
    restricted: false,
  });

  game.settings.register('token-variants', 'hudSettings', {
    scope: 'client',
    config: false,
    type: Object,
    default: TVA_CONFIG.hud,
    onChange: (val) => (TVA_CONFIG.hud = val),
  });

  game.settings.registerMenu('token-variants', 'permissions', {
    name: 'Permissions',
    hint: 'Control access to module features based on user role',
    scope: 'world',
    icon: 'fas fa-user-lock',
    type: TVAPermissions,
    restricted: true,
  });

  game.settings.register('token-variants', 'permissions', {
    scope: 'world',
    config: false,
    type: Object,
    default: TVA_CONFIG.permissions,
    onChange: (val) => {
      if (!userRequiresImageCache(TVA_CONFIG.permissions) && userRequiresImageCache(val)) {
        cacheTokens();
      }
      TVA_CONFIG.permissions = val;
    },
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

  await fetchAllSettings();
}

export async function fetchAllSettings() {
  TVA_CONFIG.debug = game.settings.get('token-variants', 'debug');
  TVA_CONFIG.searchPaths = game.settings.get('token-variants', 'searchPaths');
  TVA_CONFIG.forgevttPaths = game.settings.get('token-variants', 'forgevttPaths');
  TVA_CONFIG.forgeSearchPaths = game.settings.get('token-variants', 'forgeSearchPaths');
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
  TVA_CONFIG.parsedSearchPaths = await parseSearchPaths();
  TVA_CONFIG.parsedExcludedKeywords = parseKeywords(TVA_CONFIG.excludedKeywords);
}

export function exportSettingsToJSON() {
  const filename = `token-variants-settings.json`;
  const settings = deepClone(TVA_CONFIG);
  delete settings.parsedSearchPaths;
  delete settings.parsedExcludedKeywords;
  saveDataToFile(JSON.stringify(settings, null, 2), 'text/json', filename);
}

export async function importSettingsFromJSON(json) {
  if (typeof json === 'string') json = JSON.parse(json);

  if ('debug' in json) game.settings.set('token-variants', 'debug', json.debug);
  if ('disableNotifs' in json)
    game.settings.set('token-variants', 'disableNotifs', json.disableNotifs);
  if ('forgevttPaths' in json)
    game.settings.set('token-variants', 'forgevttPaths', json.forgevttPaths);
  if ('hud' in json) game.settings.set('token-variants', 'hudSettings', json.hud);
  if ('worldHud' in json) game.settings.set('token-variants', 'worldHudSettings', json.worldHud);
  if ('keywordSearch' in json)
    game.settings.set('token-variants', 'keywordSearch', json.keywordSearch);
  if ('excludedKeywords' in json)
    game.settings.set('token-variants', 'excludedKeywords', json.excludedKeywords);

  if (!isNewerVersion(game.version ?? game.data.version, '0.8.9')) {
    if ('actorDirectoryKey' in json)
      game.settings.set('token-variants', 'actorDirectoryKey', json.actorDirectoryKey);
  }

  if ('runSearchOnPath' in json)
    game.settings.set('token-variants', 'runSearchOnPath', json.runSearchOnPath);
  if ('searchFilters' in json)
    game.settings.set('token-variants', 'searchFilterSettings', json.searchFilters);
  if ('algorithm' in json) game.settings.set('token-variants', 'algorithmSettings', json.algorithm);
  if ('tokenConfigs' in json)
    game.settings.set('token-variants', 'tokenConfigs', json.tokenConfigs);
  if ('randomizer' in json)
    game.settings.set('token-variants', 'randomizerSettings', json.randomizer);
  if ('popup' in json) game.settings.set('token-variants', 'popupSettings', json.popup);
  if ('imgurClientId' in json)
    game.settings.set('token-variants', 'imgurClientId', json.imgurClientId);
  if ('enableStatusConfig' in json)
    game.settings.set('token-variants', 'enableStatusConfig', json.enableStatusConfig);
  if ('compendiumMapper' in json)
    game.settings.set('token-variants', 'compendiumMapper', json.compendiumMapper);
  if ('permissions' in json) game.settings.set('token-variants', 'permissions', json.permissions);

  if ('searchPaths' in json) game.settings.set('token-variants', 'searchPaths', json.searchPaths);
  if ('forgeSearchPaths' in json)
    game.settings.set('token-variants', 'forgeSearchPaths', json.forgeSearchPaths);
}
