import { BASE_IMAGE_CATEGORIES, userRequiresImageCache, waitForTokenTexture } from './utils.js';
import { ForgeSearchPaths } from '../applications/forgeSearchPaths.js';
import TokenHUDClientSettings from '../applications/tokenHUDClientSettings.js';
import CompendiumMapConfig from '../applications/compendiumMap.js';
import ImportExport from '../applications/importExport.js';
import ConfigureSettings from '../applications/configureSettings.js';
import { cacheImages, saveCache } from './search.js';
import { registerAllHooks } from './hooks/hooks.js';
import { registerAllWrappers } from './wrappers/wrappers.js';

export const TVA_CONFIG = {
  debug: false,
  disableNotifs: false,
  searchPaths: [
    {
      text: 'modules/caeora-maps-tokens-assets/assets/tokens',
      cache: true,
      source: typeof ForgeAPI === 'undefined' ? 'data' : 'forge-bazaar',
      types: ['Portrait', 'Token', 'PortraitAndToken'],
    },
  ],
  forgeSearchPaths: {},
  worldHud: {
    displayOnlySharedImages: false,
    disableIfTHWEnabled: false,
    includeKeywords: false,
    updateActorImage: false,
    useNameSimilarity: false,
    includeWildcard: true,
    showFullPath: false,
    animate: true,
  },
  hud: {
    enableSideMenu: true,
    imageOpacity: 50,
  },
  keywordSearch: true,
  excludedKeywords: 'and,for',
  runSearchOnPath: false,
  searchFilters: {},
  algorithm: {
    exact: false,
    fuzzy: true,
    fuzzyLimit: 100,
    fuzzyThreshold: 0.3,
    fuzzyArtSelectPercentSlider: true,
  },
  tokenConfigs: [],
  randomizer: {
    actorCreate: false,
    tokenCreate: false,
    tokenCopyPaste: false,
    tokenName: true,
    keywords: false,
    shared: false,
    wildcard: false,
    representedActorDisable: false,
    linkedActorDisable: true,
    popupOnDisable: false,
    diffImages: false,
    syncImages: false,
    nonRepeat: false,
  },
  popup: {
    disableAutoPopupOnActorCreate: true,
    disableAutoPopupOnTokenCreate: true,
    disableAutoPopupOnTokenCopyPaste: true,
    twoPopups: false,
    twoPopupsNoDialog: false,
  },
  imgurClientId: '',
  stackStatusConfig: true,
  mergeGroup: false,
  staticCache: false,
  staticCacheFile: 'modules/token-variants/token-variants-cache.json',
  compendiumMapper: {
    missingOnly: false,
    diffImages: false,
    showImages: true,
    cache: false,
    autoDisplayArtSelect: true,
    syncImages: false,
    overrideCategory: false,
    category: 'Token',
    missingImages: [{ document: 'all', image: CONST.DEFAULT_TOKEN }],
    searchOptions: {},
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
    statusConfig: {
      1: false,
      2: false,
      3: true,
      4: true,
    },
  },
  globalMappings: [],
  templateMappings: [],
  customImageCategories: [],
  displayEffectIconsOnHover: false,
  disableEffectIcons: false,
  filterEffectIcons: false,
  filterCustomEffectIcons: true,
  filterIconList: [],
  updateTokenProto: false,
  imgNameContainsDimensions: false,
  imgNameContainsFADimensions: false,
  playVideoOnHover: true,
  pauseVideoOnHoverOut: false,
  disableImageChangeOnPolymorphed: false,
  disableImageUpdateOnNonPrototype: false,
  disableTokenUpdateAnimation: false,
  evaluateOverlayOnHover: true,
  invisibleImage: '',
  systemHpPath: '',
  internalEffects: {
    hpChange: { enabled: false, duration: null },
  },
  hideElevationTooltip: false,
  hideTokenBorder: false,
};

export const FEATURE_CONTROL = {
  EffectMappings: true,
  EffectIcons: true,
  Overlays: true,
  UserMappings: true,
  Wildcards: true,
  PopUpAndRandomize: true,
  HUD: true,
  HideElement: true,
};

export function registerSettings() {
  game.settings.register('token-variants', 'featureControl', {
    scope: 'world',
    config: false,
    type: Object,
    default: FEATURE_CONTROL,
    onChange: async (val) => {
      foundry.utils.mergeObject(FEATURE_CONTROL, val);
      registerAllHooks();
      registerAllWrappers();
    },
  });
  foundry.utils.mergeObject(FEATURE_CONTROL, game.settings.get('token-variants', 'featureControl'));

  game.settings.registerMenu('token-variants', 'settings', {
    name: 'Configure Settings',
    hint: 'Configure Token Variant Art settings',
    label: 'Settings',
    scope: 'world',
    icon: 'fas fa-cog',
    type: ConfigureSettings,
    restricted: true,
  });

  const systemHpPaths = {
    'cyberpunk-red-core': 'derivedStats.hp',
    lfg: 'health',
    worldbuilding: 'health',
    twodsix: 'hits',
  };
  TVA_CONFIG.systemHpPath = systemHpPaths[game.system.id] ?? 'attributes.hp';

  game.settings.register('token-variants', 'effectMappingToggleGroups', {
    scope: 'world',
    config: false,
    type: Object,
    default: { Default: true },
  });

  game.settings.register('token-variants', 'settings', {
    scope: 'world',
    config: false,
    type: Object,
    default: TVA_CONFIG,
    onChange: async (val) => {
      // Generate a diff, it will be required when doing post-processing of the modified settings
      const diff = _arrayAwareDiffObject(TVA_CONFIG, val);

      // Check image re-cache required due to permission changes
      let requiresImageCache = false;
      if ('permissions' in diff) {
        if (!userRequiresImageCache(TVA_CONFIG.permissions) && userRequiresImageCache(val.permissions))
          requiresImageCache = true;
      }

      // Update live settings
      foundry.utils.mergeObject(TVA_CONFIG, val);

      if (TVA_CONFIG.filterEffectIcons && ('filterCustomEffectIcons' in diff || 'filterIconList' in diff)) {
        for (const tkn of canvas.tokens.placeables) {
          waitForTokenTexture(tkn, (token) => {
            token.drawEffects();
          });
        }
      }

      // Check image re-cache required due to search path changes
      if ('searchPaths' in diff || 'forgeSearchPaths' in diff) {
        if (userRequiresImageCache(TVA_CONFIG.permissions)) requiresImageCache = true;
      }

      // Cache/re-cache images if necessary
      if (requiresImageCache) {
        await cacheImages();
      }

      if (diff.staticCache) {
        const cacheFile = diff.staticCacheFile ? diff.staticCacheFile : TVA_CONFIG.staticCacheFile;
        saveCache(cacheFile);
      }

      TVA_CONFIG.hud = game.settings.get('token-variants', 'hudSettings');

      registerAllHooks();
      registerAllWrappers();

      if ('displayEffectIconsOnHover' in diff) {
        for (const tkn of canvas.tokens.placeables) {
          if (tkn.effects) tkn.effects.visible = !diff.displayEffectIconsOnHover;
        }
      }

      if ('hideElevationTooltip' in diff) {
        for (const tkn of canvas.tokens.placeables) {
          if (tkn.tooltip) tkn.tooltip.text = tkn._getTooltipText();
        }
      }

      if ('hideTokenBorder' in diff) {
        for (const tkn of canvas.tokens.placeables) {
          if (tkn.border) tkn.border.visible = !diff.hideTokenBorder;
        }
      }

      if ('filterEffectIcons' in diff || 'disableEffectIcons' in diff) {
        for (const tkn of canvas.tokens.placeables) {
          tkn.drawEffects();
        }
      }
    },
  });

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
      icon: 'fas fa-search',
      type: ForgeSearchPaths,
      scope: 'client',
      restricted: false,
    });
  }

  game.settings.register('token-variants', 'tokenConfigs', {
    scope: 'world',
    config: false,
    type: Array,
    default: TVA_CONFIG.tokenConfigs,
    onChange: (val) => (TVA_CONFIG.tokenConfigs = val),
  });

  game.settings.registerMenu('token-variants', 'tokenHUDSettings', {
    name: game.i18n.localize('token-variants.settings.token-hud.Name'),
    hint: game.i18n.localize('token-variants.settings.token-hud.Hint'),
    scope: 'client',
    icon: 'fas fa-images',
    type: TokenHUDClientSettings,
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

  game.settings.registerMenu('token-variants', 'importExport', {
    name: `Import/Export`,
    hint: game.i18n.localize('token-variants.settings.import-export.Hint'),
    scope: 'world',
    icon: 'fas fa-toolbox',
    type: ImportExport,
    restricted: true,
  });

  // Read settings
  const settings = game.settings.get('token-variants', 'settings');
  foundry.utils.mergeObject(TVA_CONFIG, settings);

  if (foundry.utils.isEmpty(TVA_CONFIG.searchFilters)) {
    BASE_IMAGE_CATEGORIES.forEach((cat) => {
      TVA_CONFIG.searchFilters[cat] = {
        include: '',
        exclude: '',
        regex: '',
      };
    });
  }

  for (let uid in TVA_CONFIG.forgeSearchPaths) {
    TVA_CONFIG.forgeSearchPaths[uid].paths = TVA_CONFIG.forgeSearchPaths[uid].paths.map((p) => {
      if (!p.source) {
        p.source = 'forgevtt';
      }
      if (!p.types) {
        if (p.tiles) p.types = ['Tile'];
        else p.types = ['Portrait', 'Token', 'PortraitAndToken'];
      }
      return p;
    });
  }

  // 20/07/2023 Convert globalMappings to a new format
  if (foundry.utils.getType(settings.globalMappings) === 'Object') {
    Hooks.once('ready', () => {
      TVA_CONFIG.globalMappings = migrateMappings(settings.globalMappings);
      setTimeout(() => updateSettings({ globalMappings: TVA_CONFIG.globalMappings }), 10000);
    });
  }

  // Read client settings
  TVA_CONFIG.hud = game.settings.get('token-variants', 'hudSettings');
}

export function migrateMappings(mappings, globalMappings = []) {
  if (!mappings) return [];
  if (foundry.utils.getType(mappings) === 'Object') {
    let nMappings = [];
    for (const [effect, mapping] of Object.entries(mappings)) {
      if (!mapping.label) mapping.label = effect.replaceAll('¶', '.');
      if (!mapping.expression) mapping.expression = effect.replaceAll('¶', '.');
      if (!mapping.id) mapping.id = foundry.utils.randomID(8);
      delete mapping.effect;
      if (mapping.overlayConfig) mapping.overlayConfig.id = mapping.id;
      delete mapping.overlayConfig?.effect;
      nMappings.push(mapping);
    }
    // Convert parents to parentIDs
    let combMappings = nMappings.concat(globalMappings);
    for (const mapping of nMappings) {
      if (mapping.overlayConfig?.parent) {
        if (mapping.overlayConfig.parent === 'Token (Placeable)') {
          mapping.overlayConfig.parentID = 'TOKEN';
        } else {
          const parent = combMappings.find((m) => m.label === mapping.overlayConfig.parent);
          if (parent) mapping.overlayConfig.parentID = parent.id;
          else mapping.overlayConfig.parentID = '';
        }
        delete mapping.overlayConfig.parent;
      }
    }
    mappings = nMappings;
  }
  // If overlay enabled but no image, text, or shape is being rendered, assume that imgSrs if available should be
  // used as the image
  for (const m of mappings) {
    if (m.overlay && m.overlayConfig) {
      if (m.imgSrc && !m.overlayConfig.img && !m.overlayConfig.text?.text && !m.overlayConfig.shapes?.length) {
        m.overlayConfig.img = m.imgSrc;
        m.imgSrc = '';
        m.imgName = '';
      }
    }
  }
  return mappings;
}

export function getFlagMappings(object) {
  if (!object) return [];
  let doc = object.document ?? object;
  const actorId = doc.actor?.id;
  if (actorId) {
    doc = game.actors.get(actorId);
    if (!doc) return [];
  }

  // 23/07/2023
  let mappings = doc.getFlag('token-variants', 'effectMappings') ?? [];
  if (foundry.utils.getType(mappings) === 'Object') {
    mappings = migrateMappings(mappings, TVA_CONFIG.globalMappings);
    doc.setFlag('token-variants', 'effectMappings', mappings);
  }
  return mappings;
}

export function exportSettingsToJSON() {
  const settings = foundry.utils.deepClone(TVA_CONFIG);
  const filename = `token-variants-settings.json`;
  saveDataToFile(JSON.stringify(settings, null, 2), 'text/json', filename);
}

export async function importSettingsFromJSON(json) {
  if (typeof json === 'string') json = JSON.parse(json);

  if (json.forgeSearchPaths)
    for (let uid in json.forgeSearchPaths) {
      json.forgeSearchPaths[uid].paths = json.forgeSearchPaths[uid].paths.map((p) => {
        if (!p.source) {
          p.source = 'forgevtt';
        }
        if (!p.types) {
          if (p.tiles) p.types = ['Tile'];
          else p.types = ['Portrait', 'Token', 'PortraitAndToken'];
        }
        return p;
      });
    }

  // 09/07/2022 Convert filters to new format if old one is still in use
  if (json.searchFilters && json.searchFilters.portraitFilterInclude != null) {
    const filters = json.searchFilters;
    json.searchFilters = {
      Portrait: {
        include: filters.portraitFilterInclude ?? '',
        exclude: filters.portraitFilterExclude ?? '',
        regex: filters.portraitFilterRegex ?? '',
      },
      Token: {
        include: filters.tokenFilterInclude ?? '',
        exclude: filters.tokenFilterExclude ?? '',
        regex: filters.tokenFilterRegex ?? '',
      },
      PortraitAndToken: {
        include: filters.generalFilterInclude ?? '',
        exclude: filters.generalFilterExclude ?? '',
        regex: filters.generalFilterRegex ?? '',
      },
    };
    if (json.compendiumMapper) delete json.compendiumMapper.searchFilters;
  }

  // Global Mappings need special merge
  if (json.globalMappings) {
    const nMappings = migrateMappings(json.globalMappings);
    for (const m of nMappings) {
      const i = TVA_CONFIG.globalMappings.findIndex((mapping) => m.label === mapping.label);
      if (i === -1) TVA_CONFIG.globalMappings.push(m);
      else TVA_CONFIG.globalMappings[i] = m;
    }
    json.globalMappings = TVA_CONFIG.globalMappings;
  }

  updateSettings(json);
}

function _refreshFilters(filters, customCategories, updateTVAConfig = false) {
  const categories = BASE_IMAGE_CATEGORIES.concat(customCategories ?? TVA_CONFIG.customImageCategories);
  for (const filter in filters) {
    if (!categories.includes(filter)) {
      delete filters[filter];
      if (updateTVAConfig) delete TVA_CONFIG.searchFilters[filter];
    }
  }
  for (const category of customCategories) {
    if (filters[category] == null) {
      filters[category] = {
        include: '',
        exclude: '',
        regex: '',
      };
    }
  }
}

export async function updateSettings(newSettings) {
  const settings = foundry.utils.mergeObject(foundry.utils.deepClone(TVA_CONFIG), newSettings, { insertKeys: false });
  // Custom image categories might have changed, meaning we may have filters that are no longer relevant
  // or need to be added
  if ('customImageCategories' in newSettings) {
    _refreshFilters(settings.searchFilters, newSettings.customImageCategories, true);
    if (settings.compendiumMapper?.searchOptions?.searchFilters != null) {
      _refreshFilters(settings.compendiumMapper.searchOptions.searchFilters, newSettings.customImageCategories);
      TVA_CONFIG.compendiumMapper.searchOptions.searchFilters = settings.compendiumMapper.searchOptions.searchFilters;
    }
  }
  await game.settings.set('token-variants', 'settings', settings);
}

export function _arrayAwareDiffObject(original, other, { inner = false } = {}) {
  function _difference(v0, v1) {
    let t0 = foundry.utils.getType(v0);
    let t1 = foundry.utils.getType(v1);
    if (t0 !== t1) return [true, v1];
    if (t0 === 'Array') return [!_arrayEquality(v0, v1), v1];
    if (t0 === 'Object') {
      if (foundry.utils.isEmpty(v0) !== foundry.utils.isEmpty(v1)) return [true, v1];
      let d = _arrayAwareDiffObject(v0, v1, { inner });
      return [!foundry.utils.isEmpty(d), d];
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
    if (foundry.utils.getType(v) === 'Object') return Object.keys(_arrayAwareDiffObject(v, a2[i])).length === 0;
    return a2[i] === v;
  });
}

export function getSearchOptions() {
  return {
    keywordSearch: TVA_CONFIG.keywordSearch,
    excludedKeywords: TVA_CONFIG.excludedKeywords,
    runSearchOnPath: TVA_CONFIG.runSearchOnPath,
    algorithm: TVA_CONFIG.algorithm,
    searchFilters: TVA_CONFIG.searchFilters,
  };
}
