import { SearchPaths, ForgeSearchPaths } from './applications/searchPaths.js';
import { ArtSelect, addToArtSelectQueue } from './applications/artSelect.js';
import TokenHUDSettings from './applications/tokenHUDSettings.js';
import FilterSettings from './applications/searchFilters.js';
import RandomizerSettings from './applications/randomizerSettings.js';
import PopUpSettings from './applications/popupSettings.js';
import {
  getFileName,
  getFileNameWithExt,
  simplifyTokenName,
  simplifyPath,
  parseSearchPaths,
  parseKeywords,
  isImage,
  isVideo,
  getTokenConfigForUpdate,
  SEARCH_TYPE,
  callForgeVTT,
  keyPressed,
  registerKeybinds,
  updateActorImage,
  stringSimilarity,
} from './scripts/utils.js';
import { renderHud } from './applications/tokenHUD.js';
import CompendiumMapConfig from './applications/compendiumMap.js';

// Default path where the script will look for token art
const DEFAULT_TOKEN_PATHS = [
  {
    text: 'modules/caeora-maps-tokens-assets/assets/tokens/',
    cache: true,
  },
];

// Controls whether a keyword search is to be performed in addition to full-name search
let keywordSearch = false;
let excludedKeywords = [];

// True if in the middle of caching image paths
let caching = false;

// A cached map of all the found tokens
let cachedTokens = new Map();

// Tokens found with caching disabled
let foundTokens = new Map();

// Tracks if module has been initialized
let initialized = false;

// Controls whether separate popups are displayed for portrait and token art
let twoPopups = false;
let noTwoPopupsPrompt = false;

// Prevent registering of right-click listener on the character sheet
let disableActorPortraitListener = false;

let debug = false;

let runSearchOnPath = false;

let imgurClientId;
let enableStatusConfig = false;

// Search paths parsed into a format usable in search functions
let parsedSearchPaths;

// showArtSelect(...) can take a while to fully execute and it is possible for it to be called
// multiple times in very quick succession especially if copy pasting tokens or importing actors
// this variable set early in the function execution is used to queue additional requests rather
// than continue execution
const showArtSelectExecuting = { inProgress: false };

async function registerWorldSettings() {
  game.settings.register('token-variants', 'debug', {
    scope: 'world',
    config: false,
    type: Boolean,
    default: false,
    onChange: (val) => (debug = val),
  });

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
    default: DEFAULT_TOKEN_PATHS,
    onChange: async function (_) {
      if (game.user.can('SETTINGS_MODIFY'))
        await game.settings.set('token-variants', 'forgevttPaths', []);
      parsedSearchPaths = await parseSearchPaths(debug);
      cacheTokens();
    },
  });

  game.settings.register('token-variants', 'forgeSearchPaths', {
    scope: 'world',
    config: false,
    type: Object,
    default: {},
    onChange: async function (_) {
      if (game.user.can('SETTINGS_MODIFY'))
        await game.settings.set('token-variants', 'forgevttPaths', []);
      parsedSearchPaths = await parseSearchPaths(debug);
      cacheTokens();
    },
  });

  // World level Token HUD setting
  game.settings.register('token-variants', 'enableTokenHUDButtonForAll', {
    scope: 'world',
    type: Boolean,
    default: false,
  });

  // World level Token HUD setting
  game.settings.register('token-variants', 'displayOnlySharedImages', {
    scope: 'world',
    type: Boolean,
    default: false,
  });

  // World level Token HUD setting
  game.settings.register('token-variants', 'disableSideMenuIfTHW', {
    scope: 'world',
    type: Boolean,
    default: false,
  });

  // Deprecated, caching is now controlled on per image source basis
  game.settings.register('token-variants', 'disableCaching', {
    scope: 'world',
    type: Boolean,
    default: false,
  });

  // Deprecated
  game.settings.register('token-variants', 'disableAutomaticPopup', {
    scope: 'world',
    type: Boolean,
    default: false,
  });

  // Deprecated
  game.settings.register('token-variants', 'filterMSRD', {
    scope: 'world',
    type: Boolean,
  });

  game.settings.register('token-variants', 'keywordSearch', {
    name: game.i18n.localize('token-variants.settings.keywords-search.Name'),
    hint: game.i18n.localize('token-variants.settings.keywords-search.Hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    onChange: (kSearch) => (keywordSearch = kSearch),
  });

  game.settings.register('token-variants', 'excludedKeywords', {
    name: game.i18n.localize('token-variants.settings.excluded-keywords.Name'),
    hint: game.i18n.localize('token-variants.settings.excluded-keywords.Hint'),
    scope: 'world',
    config: true,
    type: String,
    default: 'and,for',
    onChange: (keywords) => (excludedKeywords = parseKeywords(keywords)),
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
      default: 'Control',
    });
  }

  // Deprecated
  game.settings.register('token-variants', 'twoPopups', {
    scope: 'world',
    type: Boolean,
    default: false,
  });

  // Deprecated
  game.settings.register('token-variants', 'twoPopupsNoDialog', {
    scope: 'world',
    type: Boolean,
    default: false,
  });

  game.settings.register('token-variants', 'runSearchOnPath', {
    name: game.i18n.localize('token-variants.settings.run-search-on-path.Name'),
    hint: game.i18n.localize('token-variants.settings.run-search-on-path.Hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    onChange: (val) => (runSearchOnPath = val),
  });

  // Legacy filter setting, retained in case some users have used this setting
  game.settings.register('token-variants', 'portraitFilter', {
    scope: 'world',
    config: false,
    type: String,
    default: '',
  });

  // Legacy filter setting, retained in case some users have used this setting
  game.settings.register('token-variants', 'tokenFilter', {
    scope: 'world',
    config: false,
    type: String,
    default: '',
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
    default: {
      portraitFilterInclude: game.settings.get('token-variants', 'portraitFilter'),
      portraitFilterExclude: '',
      portraitFilterRegex: '',
      tokenFilterInclude: game.settings.get('token-variants', 'tokenFilter'),
      tokenFilterExclude: '',
      tokenFilterRegex: '',
      generalFilterInclude: '',
      generalFilterExclude: '',
      generalFilterRegex: '',
    },
  });

  game.settings.register('token-variants', 'forgevttPaths', {
    scope: 'world',
    config: false,
    type: Array,
    default: [],
  });

  game.settings.register('token-variants', 'tokenConfigs', {
    scope: 'world',
    config: false,
    type: Array,
    default: [],
  });

  // Deprecated
  game.settings.register('token-variants', 'disableActorPortraitArtSelect', {
    scope: 'world',
    type: Boolean,
    default: false,
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
    default: {
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
    default: {
      disableAutoPopupOnActorCreate: game.settings.get('token-variants', 'disableAutomaticPopup'),
      disableAutoPopupOnTokenCreate: game.settings.get('token-variants', 'disableAutomaticPopup'),
      disableAutoPopupOnTokenCopyPaste: game.settings.get(
        'token-variants',
        'disableAutomaticPopup'
      ),
      twoPopups: game.settings.get('token-variants', 'twoPopups'),
      twoPopupsNoDialog: game.settings.get('token-variants', 'twoPopupsNoDialog'),
      disableActorPortraitArtSelect: game.settings.get(
        'token-variants',
        'disableActorPortraitArtSelect'
      ),
    },
    onChange: (settings) => {
      twoPopups = settings.twoPopups;
      noTwoPopupsPrompt = settings.twoPopupsNoDialog;
      disableActorPortraitListener = settings.disableActorPortraitArtSelect;
    },
  });

  game.settings.register('token-variants', 'imgurClientId', {
    name: game.i18n.localize('token-variants.settings.imgur-client-id.Name'),
    hint: game.i18n.localize('token-variants.settings.imgur-client-id.Hint'),
    scope: 'world',
    config: true,
    type: String,
    onChange: (id) => (imgurClientId = id),
  });

  game.settings.register('token-variants', 'enableStatusConfig', {
    name: game.i18n.localize('token-variants.settings.status-config.Name'),
    hint: game.i18n.localize('token-variants.settings.status-config.Hint'),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
    onChange: (enable) => (enableStatusConfig = enable),
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
    default: {
      missingOnly: false,
      diffImages: false,
      showImages: true,
      incKeywords: true,
      cache: false,
      autoDisplayArtSelect: true,
      syncImages: false,
    },
  });

  // Backwards compatibility for setting format used in versions <=1.18.2
  const tokenConfigs = (game.settings.get('token-variants', 'tokenConfigs') || []).flat();
  tokenConfigs.forEach((config) => {
    if (!config.hasOwnProperty('tvImgSrc')) {
      config['tvImgSrc'] = config.imgSrc;
      config['tvImgName'] = config.name;
      config['tvTab_image'] = true;
      delete config.imgSrc;
      delete config.name;
    }
  });
  game.settings.set('token-variants', 'tokenConfigs', tokenConfigs);
  // end of compatibility code

  const popupSettings = game.settings.get('token-variants', 'popupSettings');
  twoPopups = popupSettings.twoPopups;
  noTwoPopupsPrompt = popupSettings.twoPopupsNoDialog;
  disableActorPortraitListener = popupSettings.disableActorPortraitArtSelect;

  keywordSearch = game.settings.get('token-variants', 'keywordSearch');
  debug = game.settings.get('token-variants', 'debug');
  runSearchOnPath = game.settings.get('token-variants', 'runSearchOnPath');
  parsedSearchPaths = await parseSearchPaths(debug);
  imgurClientId = game.settings.get('token-variants', 'imgurClientId');
  enableStatusConfig = game.settings.get('token-variants', 'enableStatusConfig');
}

function registerHUD() {
  game.settings.registerMenu('token-variants', 'tokenHUDSettings', {
    name: game.i18n.localize('token-variants.settings.token-hud.Name'),
    hint: game.i18n.localize('token-variants.settings.token-hud.Hint'),
    scope: 'client',
    icon: 'fas fa-exchange-alt',
    type: TokenHUDSettings,
    restricted: false,
  });

  // Deprecated
  game.settings.register('token-variants', 'enableTokenHUD', {
    scope: 'client',
    config: false,
    type: Boolean,
    default: true,
  });

  // Deprecated
  game.settings.register('token-variants', 'alwaysShowHUD', {
    scope: 'client',
    config: false,
    type: Boolean,
    default: false,
  });

  // Deprecated
  game.settings.register('token-variants', 'HUDDisplayImage', {
    scope: 'client',
    config: false,
    type: Boolean,
    default: true,
  });

  // Deprecated
  game.settings.register('token-variants', 'HUDImageOpacity', {
    scope: 'client',
    config: false,
    range: {
      min: 0,
      max: 100,
      step: 1,
    },
    type: Number,
    default: 50,
  });

  game.settings.register('token-variants', 'hudSettings', {
    scope: 'client',
    config: false,
    type: Object,
    default: {
      enableSideMenu: game.settings.get('token-variants', 'enableTokenHUD'),
      displayAsImage: game.settings.get('token-variants', 'HUDDisplayImage'),
      imageOpacity: game.settings.get('token-variants', 'HUDImageOpacity'),
      alwaysShowButton: game.settings.get('token-variants', 'alwaysShowHUD'),
      updateActorImage: false,
      includeWildcard: true,
    },
  });

  async function renderHudButton(hud, html, token) {
    renderHud(hud, html, token, '', doImageSearch, updateTokenImage, updateActorImage);
  }

  // Incorporating 'FVTT-TokenHUDWildcard' token hud button
  Hooks.on('renderTokenHUD', renderHudButton);
}

/**
 * Initialize the Token Variants module on Foundry VTT init
 */
async function initialize() {
  // Initialization should only be performed once
  if (initialized) {
    return;
  }

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

  await registerWorldSettings();

  const getEffects = (token) => {
    if (game.system.id === 'pf2e') {
      return (token.data.actorData?.items || []).map((ef) => ef.name);
    }
    return (token.data.actorData?.effects || []).map((ef) => ef.label);
  };

  const updateWithEffectMapping = async function (token, effects, toggleStatus) {
    const tokenImgSrc = token.data.img;
    const tokenImgName =
      (token.document ?? token).getFlag('token-variants', 'name') || getFileName(tokenImgSrc);
    const tokenDefaultImg = (token.actor.document ?? token.actor).getFlag(
      'token-variants',
      'defaultImg'
    );
    const hadActiveHUD = (token._object || token).hasActiveHUD;
    const mappings =
      (token.actor.document ?? token.actor).getFlag('token-variants', 'effectMappings') || {};

    // Filter effects that do not have a mapping and sort based on priority
    effects = effects
      .filter((ef) => ef in mappings)
      .map((ef) => mappings[ef])
      .sort((ef1, ef2) => ef1.priority - ef2.priority);

    if (effects.length > 0) {
      const effect = effects[effects.length - 1];
      if (tokenImgSrc !== effect.imgSrc || tokenImgName !== effect.imgName) {
        if (!tokenDefaultImg) {
          (token.actor.document ?? token.actor).setFlag('token-variants', 'defaultImg', {
            imgSrc: tokenImgSrc,
            imgName: tokenImgName,
          });
        }

        await updateTokenImage(effect.imgSrc, {
          token: token,
          imgName: effect.imgName,
        });

        // HUD will automatically close due to the update
        // Re-open it and the 'Assign Status Effects' view
        if (hadActiveHUD) {
          canvas.tokens.hud.bind(token._object || token);
          if (toggleStatus) canvas.tokens.hud._toggleStatusEffects(true);
        }
      }
    }

    // If no mapping has been found and the default image (image prior to effect triggered update) is different from current one
    // reset the token image back to default
    if (effects.length === 0 && tokenDefaultImg) {
      await (token.actor.document ?? token.actor).unsetFlag('token-variants', 'defaultImg');
      if (tokenDefaultImg.imgSrc !== tokenImgSrc || tokenDefaultImg.imgName !== tokenImgName)
        await updateTokenImage(tokenDefaultImg.imgSrc, {
          token: token,
          imgName: tokenDefaultImg.imgName,
        });

      // HUD will automatically close due to the update
      // Re-open it and the 'Assign Status Effects' view
      if (hadActiveHUD) {
        canvas.tokens.hud.bind(token._object || token);
        if (toggleStatus) canvas.tokens.hud._toggleStatusEffects(true);
      }
    }
  };

  Hooks.on('createCombatant', (combatant, options, userId) => {
    if (!enableStatusConfig) return;
    const token = combatant._token || canvas.tokens.get(combatant.data.tokenId);

    const mappings = token.actor.getFlag('token-variants', 'effectMappings') || {};
    if (!('token-variants-combat' in mappings)) return;

    const effects = getEffects(token);
    if (token.data.hidden) effects.push('token-variants-visibility');
    effects.push('token-variants-combat');
    updateWithEffectMapping(token, effects, canvas.tokens.hud._statusEffects);
  });

  Hooks.on('deleteCombatant', (combatant, options, userId) => {
    if (!enableStatusConfig) return;
    const token = combatant._token || canvas.tokens.get(combatant.data.tokenId);

    const mappings = token.actor.getFlag('token-variants', 'effectMappings') || {};
    if (!('token-variants-combat' in mappings)) return;

    const effects = getEffects(token);
    if (token.data.hidden) effects.push('token-variants-visibility');
    updateWithEffectMapping(token, effects, canvas.tokens.hud._statusEffects);
  });

  Hooks.on('preUpdateToken', (token, change, options, userId) => {
    if (!enableStatusConfig) return;
    if (!token.actor) return; // Only tokens with associated actors supported

    const mappings =
      (token.actor.document ?? token.actor).getFlag('token-variants', 'effectMappings') || {};

    let oldEffects = [];
    let newEffects = [];

    if (game.system.id === 'pf2e') {
      newEffects = change.actorData?.items
        ? change.actorData.items.map((ef) => ef.name)
        : getEffects(token);
      oldEffects = getEffects(token);
    } else {
      newEffects = change.actorData?.effects
        ? change.actorData.effects.map((ef) => ef.label)
        : getEffects(token);
      oldEffects = getEffects(token);
    }

    const effectAdded = oldEffects.length < newEffects.length;
    const effectRemoved = oldEffects.length > newEffects.length;

    let performUpdate = false;
    if (effectAdded) {
      performUpdate = newEffects[newEffects.length - 1] in mappings;
    }
    if (effectRemoved) {
      performUpdate = oldEffects[oldEffects.length - 1] in mappings;
    }

    if (token.inCombat) newEffects.unshift('token-variants-combat');
    if (change.hidden) newEffects.push('token-variants-visibility');
    else if (change.hidden == null && token.data.hidden)
      newEffects.unshift('token-variants-visibility');

    if (
      change.hidden != null &&
      change.hidden !== token.data.hidden &&
      'token-variants-visibility' in mappings
    ) {
      performUpdate = true;
    }

    if (performUpdate) {
      options['token-variants'] = {
        effects: newEffects,
        toggleStatus: canvas.tokens.hud._statusEffects,
      };
    }
  });

  Hooks.on('updateToken', async function (token, change, options, userId) {
    if (!enableStatusConfig) return;
    if (options['token-variants'] && token.actor) {
      updateWithEffectMapping(
        token,
        options['token-variants'].effects,
        options['token-variants'].toggleStatus
      );
    }
  });

  Hooks.on('renderArtSelect', () => {
    showArtSelectExecuting.inProgress = false;
  });

  if (game.user && game.user.can('FILES_BROWSE') && game.user.can('TOKEN_CONFIGURE')) {
    const disableRandomSearchForType = (randSettings, actor) => {
      if (!actor) return false;
      return randSettings[`${actor.type}Disable`] ?? false;
    };

    const disablePopupForType = (actor) => {
      const popupSettings = game.settings.get('token-variants', 'popupSettings');
      if (!actor) return false;
      return popupSettings[`${actor.type}Disable`] ?? false;
    };

    // Workaround for forgeSearchPaths setting to be updated by non-GM clients
    game.socket?.on(`module.token-variants`, (message) => {
      if (message.handlerName === 'forgeSearchPaths' && message.type === 'UPDATE') {
        if (!game.user.isGM) return;
        const isResponsibleGM = !game.users
          .filter((user) => user.isGM && (user.active || user.isActive))
          .some((other) => other.data._id < game.user.data._id);
        if (!isResponsibleGM) return;
        game.settings.set('token-variants', 'forgeSearchPaths', message.args);
      }
    });

    // Handle actor/token art replacement
    Hooks.on('createActor', async (actor, options, userId) => {
      if (userId && game.user.id != userId) return;

      // Check if random search is enabled and if so perform it
      const randSettings = game.settings.get('token-variants', 'randomizerSettings');
      if (randSettings.actorCreate) {
        let performRandomSearch = true;
        if (randSettings.linkedActorDisable && actor.data.token.actorLink)
          performRandomSearch = false;
        if (disableRandomSearchForType(randSettings, actor)) performRandomSearch = false;

        if (performRandomSearch) {
          const img = await doRandomSearch(actor.data.name, {
            searchType: SEARCH_TYPE.PORTRAIT,
            actor: actor,
          });
          if (img) {
            await updateActorImage(actor, img[0], { imgName: img[1] });
          }

          if (!img) return;

          if (randSettings.diffImages) {
            let imgToken;
            if (randSettings.syncImages) {
              imgToken = await doSyncSearch(actor.data.name, img[1], { actor: actor });
            } else {
              imgToken = await doRandomSearch(actor.data.name, {
                searchType: SEARCH_TYPE.TOKEN,
                actor: actor,
              });
            }

            if (imgToken) {
              await updateTokenImage(imgToken[0], { actor: actor, imgName: imgToken[1] });
            }
          } else if (randSettings.portraitToToken) {
            await updateTokenImage(img[0], { actor: actor, imgName: img[1] });
          }
          return;
        }
        if (!randSettings.popupOnDisable) {
          return;
        }
      }

      // Check if pop-up is enabled and if so open it
      const popupSettings = game.settings.get('token-variants', 'popupSettings');

      if (popupSettings.disableAutoPopupOnActorCreate && !keyPressed('popupOverride')) {
        return;
      } else if (disablePopupForType(actor)) {
        return;
      }

      showArtSelect(actor.data.name, {
        callback: async function (imgSrc, name) {
          const actTokens = actor.getActiveTokens();
          const token = actTokens.length === 1 ? actTokens[0] : null;
          await updateActorImage(actor, imgSrc, {
            imgName: name,
            token: token,
          });
          if (twoPopups) twoPopupPrompt(actor, imgSrc, name, token);
          else {
            updateTokenImage(imgSrc, {
              actor: actor,
              imgName: imgName,
              token: token,
            });
          }
        },
        searchType: twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.BOTH,
        object: actor,
        preventClose: twoPopups,
      });
    });
    Hooks.on('createToken', async (op1, op2, op3, op4) => {
      let tokenDoc = op1;
      let options = op2;
      let userId = op3;

      // Compatability for 0.7.x
      if (op4) userId = op4;

      if (userId && game.user.id != userId) return;

      let token;
      if (isNewerVersion(game.version ?? game.data.version, '0.7.10')) {
        token = tokenDoc;
      } else {
        token = canvas.tokens.get(options._id);
      }

      const updateTokenCallback = (imgSrc, name) =>
        updateTokenImage(imgSrc, {
          token: token,
          actor: token.actor,
          imgName: name,
        });

      // Check if random search is enabled and if so perform it

      const randSettings = game.settings.get('token-variants', 'randomizerSettings');
      let vDown = keyPressed('v');

      if ((vDown && randSettings.tokenCopyPaste) || (!vDown && randSettings.tokenCreate)) {
        let performRandomSearch = true;
        if (randSettings.representedActorDisable && token.actor) performRandomSearch = false;
        if (randSettings.linkedActorDisable && token.data.actorLink) performRandomSearch = false;
        if (disableRandomSearchForType(randSettings, token.actor)) performRandomSearch = false;

        if (performRandomSearch) {
          const img = await doRandomSearch(token.data.name, {
            searchType: SEARCH_TYPE.TOKEN,
            actor: token.actor,
          });
          if (img) {
            await updateTokenImage(img[0], {
              token: token,
              actor: token.actor,
              imgName: img[1],
            });
          }

          if (!img) return;

          if (randSettings.diffImages) {
            let imgPortrait;
            if (randSettings.syncImages) {
              imgPortrait = await doSyncSearch(token.data.name, img[1], {
                actor: token.actor,
                searchType: SEARCH_TYPE.PORTRAIT,
              });
            } else {
              imgPortrait = await doRandomSearch(token.data.name, {
                searchType: SEARCH_TYPE.PORTRAIT,
                actor: token.actor,
              });
            }

            if (imgPortrait) {
              await updateActorImage(token.actor, imgPortrait[0]);
            }
          } else if (randSettings.tokenToPortrait) {
            await updateActorImage(token.actor, img[0]);
          }
          return;
        }
        if (!randSettings.popupOnDisable) {
          return;
        }
      } else if (randSettings.tokenCreate || randSettings.tokenCopyPaste) {
        return;
      }

      // Check if pop-up is enabled and if so open it
      const popupSettings = game.settings.get('token-variants', 'popupSettings');
      let dirKeyDown = keyPressed('popupOverride');

      if (vDown && popupSettings.disableAutoPopupOnTokenCopyPaste) {
        return;
      }

      if (!dirKeyDown || (dirKeyDown && vDown)) {
        if (popupSettings.disableAutoPopupOnTokenCreate) {
          return;
        } else if (disablePopupForType(token.actor)) {
          return;
        }
      }

      showArtSelect(token.data.name, {
        callback: async function (imgSrc, imgName) {
          if (twoPopups) {
            await updateActorImage(token.actor, imgSrc, {
              imgName: imgName,
              token: token,
            });
            twoPopupPrompt(token.actor, imgSrc, imgName, token);
          } else {
            updateTokenImage(imgSrc, {
              actor: token.actor,
              imgName: imgName,
              token: token,
            });
          }
        },
        searchType: twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.BOTH,
        object: token,
        preventClose: twoPopups,
      });
    });
    Hooks.on('renderTokenConfig', modTokenConfig);
    Hooks.on('renderActorSheet', modActorSheet);
    await cacheTokens();
  } else if (game.settings.get('token-variants', 'enableTokenHUDButtonForAll')) {
    await cacheTokens();
  }
  registerHUD();

  initialized = true;
}

/**
 * Adds a button to 'Token Configuration' window's 'Image' tab which opens
 * ArtSelect using the token's name.
 */
function modTokenConfig(tokenConfig, html, _) {
  let fields = html[0].getElementsByClassName('image');
  for (let field of fields) {
    if (field.getAttribute('name') == 'img') {
      let el = document.createElement('button');
      el.type = 'button';
      el.title = game.i18n.localize('token-variants.windows.art-select.select-variant');
      el.className = 'token-variants-image-select-button';
      el.innerHTML = '<i class="fas fa-images"></i>';
      el.tabIndex = -1;
      el.setAttribute('data-type', 'imagevideo');
      el.setAttribute('data-target', 'img');
      el.onclick = async () => {
        showArtSelect(tokenConfig.object.data.name, {
          callback: (imgSrc, name) => {
            field.value = imgSrc;
            const tokenConfig = getTokenConfigForUpdate(imgSrc, name);
            if (tokenConfig) {
              for (var key in tokenConfig) {
                $(html).find(`[name="${key}"]`).val(tokenConfig[key]);
              }
            }
          },
          searchType: SEARCH_TYPE.TOKEN,
          object: tokenConfig.object,
        });
      };
      field.parentNode.append(el);
      return;
    }
  }
}

/**
 * Adds right-click listener to Actor Sheet profile image to open up
 * the 'Art Select' screen.
 */
function modActorSheet(actorSheet, html, options) {
  if (!options.editable || disableActorPortraitListener) return;

  let profile = null;
  let profileQueries = {
    all: ['.profile', '.profile-img', '.profile-image'],
    pf2e: ['.player-image', '.actor-icon', '.sheet-header img', '.actor-image'],
  };

  for (let query of profileQueries.all) {
    profile = html[0].querySelector(query);
    if (profile) break;
  }

  if (!profile && game.system.id in profileQueries) {
    for (let query of profileQueries[game.system.id]) {
      profile = html[0].querySelector(query);
      if (profile) break;
    }
  }

  if (!profile) {
    console.log(game.i18n.localize('token-variants.notifications.warn.profile-image-not-found'));
    return;
  }

  profile.addEventListener(
    'contextmenu',
    function (ev) {
      showArtSelect(actorSheet.object.name, {
        callback: (imgSrc, name) =>
          updateActorImage(actorSheet.object, imgSrc, {
            imgName: name,
          }),
        searchType: SEARCH_TYPE.PORTRAIT,
        object: actorSheet.object,
      });
    },
    false
  );
}

/**
 * Search for and cache all the found token art
 */
export async function cacheTokens() {
  if (caching) return;
  caching = true;
  ui.notifications.info(game.i18n.format('token-variants.notifications.info.caching-started'));

  if (debug) console.log('STARTING: Token Caching');
  cachedTokens.clear();

  await findTokens('', '');
  cachedTokens = foundTokens;
  foundTokens = new Map();
  if (debug) console.log('ENDING: Token Caching');

  caching = false;
  ui.notifications.info(
    game.i18n.format('token-variants.notifications.info.caching-finished', {
      imageCount: cachedTokens.size,
    })
  );
}

/**
 * Checks if token image path and name match the provided search text and filters
 * @param search search text
 * @param tokenSrc token image path
 * @param name name of the token
 * @param filters filters to be applied
 * @returns true|false
 */
function searchMatchesToken(search, tokenSrc, name, filters) {
  // Is the search text contained in name/path
  const simplified = runSearchOnPath ? simplifyPath(tokenSrc) : simplifyTokenName(name);
  if (!simplified.includes(search)) return false;

  if (!filters) return true;

  // Filters are applied to path depending on the 'runSearchOnPath' setting, and actual or custom rolltable name
  let text;
  if (runSearchOnPath) {
    text = decodeURIComponent(tokenSrc);
  } else if (getFileName(tokenSrc) === name) {
    text = getFileNameWithExt(tokenSrc);
  } else {
    text = name;
  }

  if (filters.regex) {
    return filters.regex.test(text);
  }
  if (filters.include) {
    if (!text.includes(filters.include)) return false;
  }
  if (filters.exclude) {
    if (text.includes(filters.exclude)) return false;
  }
  return true;
}

/**
 * Search for tokens matching the supplied name
 */
async function findTokens(name, searchType = '') {
  if (debug) console.log('STARTING: Token Search', name, searchType, caching);

  // Select filters based on type of search
  let filters = game.settings.get('token-variants', 'searchFilterSettings');
  switch (searchType) {
    case SEARCH_TYPE.BOTH:
      filters = {
        include: filters.generalFilterInclude,
        exclude: filters.generalFilterExclude,
        regex: filters.generalFilterRegex,
      };
      break;
    case SEARCH_TYPE.PORTRAIT:
      filters = {
        include: filters.portraitFilterInclude,
        exclude: filters.portraitFilterExclude,
        regex: filters.portraitFilterRegex,
      };
      break;
    case SEARCH_TYPE.TOKEN:
      filters = {
        include: filters.tokenFilterInclude,
        exclude: filters.tokenFilterExclude,
        regex: filters.tokenFilterRegex,
      };
      break;
    default:
      filters = {
        include: '',
        exclude: '',
        regex: '',
      };
  }
  if (filters.regex) filters.regex = new RegExp(filters.regex);

  foundTokens = new Map();
  const simpleName = simplifyTokenName(name);

  cachedTokens.forEach((names, tokenSrc) => {
    for (let n of names) {
      if (searchMatchesToken(simpleName, tokenSrc, n, filters)) {
        addTokenToFound(tokenSrc, n);
      }
    }
  });

  let searchPaths = parsedSearchPaths;

  for (let path of searchPaths.get('data')) {
    if ((path.cache && caching) || (!path.cache && !caching))
      await walkFindTokens(path.text, {
        name: simpleName,
        filters: filters,
      });
  }
  for (let [bucket, paths] of searchPaths.get('s3')) {
    for (let path of paths) {
      if ((path.cache && caching) || (!path.cache && !caching))
        await walkFindTokens(path.text, {
          name: simpleName,
          bucket: bucket,
          filters: filters,
        });
    }
  }
  for (let path of searchPaths.get('forge')) {
    if ((path.cache && caching) || (!path.cache && !caching))
      await walkFindTokens(path.text, {
        name: simpleName,
        filters: filters,
        forge: true,
      });
  }
  for (let path of searchPaths.get('rolltable')) {
    if ((path.cache && caching) || (!path.cache && !caching))
      await walkFindTokens(path.text, {
        name: simpleName,
        filters: filters,
        rollTableName: path.text,
      });
  }
  for (let path of searchPaths.get('forgevtt')) {
    if ((path.cache && caching) || (!path.cache && !caching))
      await walkFindTokens(path.text, {
        name: simpleName,
        filters: filters,
        forgevtt: true,
        apiKey: path.apiKey,
      });
  }
  for (let path of searchPaths.get('imgur')) {
    if ((path.cache && caching) || (!path.cache && !caching))
      await walkFindTokens(path.text, {
        name: simpleName,
        filters: filters,
        imgur: true,
      });
  }

  if (debug) console.log('ENDING: Token Search', foundTokens);
  return foundTokens;
}

function addTokenToFound(tokenSrc, name) {
  if (foundTokens.has(tokenSrc)) {
    if (!foundTokens.get(tokenSrc).includes(name)) {
      foundTokens.get(tokenSrc).push(name);
    }
  } else {
    foundTokens.set(tokenSrc, [name]);
  }
}

/**
 * Walks the directory tree and finds all the matching token art
 */
async function walkFindTokens(
  path,
  {
    name = '',
    bucket = '',
    filters = null,
    forge = false,
    rollTableName = '',
    forgevtt = false,
    apiKey = '',
    imgur = false,
  } = {}
) {
  if (!bucket && !path) return;

  let files = {};
  try {
    if (bucket) {
      files = await FilePicker.browse('s3', path, {
        bucket: bucket,
      });
    } else if (forge) {
      files = await FilePicker.browse('', path, {
        wildcard: true,
      });
    } else if (forgevtt) {
      if (apiKey) {
        const response = await callForgeVTT(path, apiKey);
        files.files = response.files.map((f) => f.url);
      } else {
        files = await FilePicker.browse('forgevtt', path, {
          recursive: true,
        });
      }
    } else if (imgur && location.hostname !== 'localhost') {
      await fetch('https://api.imgur.com/3/gallery/album/' + path, {
        headers: {
          Authorization: 'Client-ID ' + (imgurClientId ? imgurClientId : 'df9d991443bb222'),
          Accept: 'application/json',
        },
      })
        .then((response) => response.json())
        .then(async function (result) {
          if (!result.success) {
            return;
          }
          result.data.images.forEach((img) => {
            const path = img.link;
            const rtName = img.title ?? img.description ?? getFileName(img.link);
            if (!name) {
              addTokenToFound(path, rtName);
            } else {
              if (searchMatchesToken(simplifyTokenName(name), path, rtName, filters)) {
                addTokenToFound(path, rtName);
              }
            }
          });
        })
        .catch((error) => console.log('Token Variant Art: ', error));
      return;
    } else if (rollTableName) {
      const table = game.tables.contents.find((t) => t.name === rollTableName);
      if (!table) {
        ui.notifications.warn(
          game.i18n.format('token-variants.notifications.warn.invalid-table', {
            rollTableName,
          })
        );
      } else {
        for (let baseTableData of table.data.results) {
          const path = baseTableData.data.img;
          const rtName = baseTableData.data.text;
          if (!name) {
            addTokenToFound(path, rtName);
          } else {
            if (searchMatchesToken(simplifyTokenName(name), path, rtName, filters)) {
              addTokenToFound(path, rtName);
            }
          }
        }
      }
      return;
    } else {
      files = await FilePicker.browse('data', path);
    }
  } catch (err) {
    console.log(
      `${game.i18n.localize('token-variants.notifications.warn.path-not-found')} ${path}`
    );
    return;
  }

  if (files.target == '.') return;

  for (let tokenSrc of files.files) {
    const tName = getFileName(tokenSrc);
    if (!name) {
      addTokenToFound(tokenSrc, tName);
    } else {
      if (searchMatchesToken(simplifyTokenName(name), tokenSrc, tName, filters)) {
        addTokenToFound(tokenSrc, tName);
      }
    }
  }

  if (forgevtt) return;

  for (let dir of files.dirs) {
    await walkFindTokens(dir, {
      name: name,
      bucket: bucket,
      filters: filters,
      forge: forge,
    });
  }
}

/**
 * Performs searches and displays the Art Select pop-up with the results
 * @param {string} search The text to be used as the search criteria
 * @param {object} [options={}] Options which customize the search
 * @param {Function[]} [options.callback] Function to be called with the user selected image path
 * @param {string} [options.searchType] (token|portrait|both) Controls filters applied to the search results
 * @param {Token|Actor} [options.object] Token/Actor used when displaying Custom Token Config prompt
 */
export async function showArtSelect(
  search,
  {
    callback = null,
    searchType = SEARCH_TYPE.BOTH,
    object = null,
    force = false,
    preventClose = false,
    image1 = '',
    image2 = '',
    ignoreKeywords = false,
  } = {}
) {
  if (caching) return;

  const artSelects = Object.values(ui.windows).filter((app) => app instanceof ArtSelect);
  if (showArtSelectExecuting.inProgress || (!force && artSelects.length !== 0)) {
    addToArtSelectQueue(search, {
      callback: callback,
      searchType: searchType,
      object: object,
      preventClose: preventClose,
    });
    return;
  }

  showArtSelectExecuting.inProgress = true;

  let allImages = await doImageSearch(search, {
    searchType: searchType,
    ignoreKeywords: ignoreKeywords,
  });

  const tokenConfigs = (game.settings.get('token-variants', 'tokenConfigs') || []).flat();

  let artFound = false;
  let allButtons = new Map();
  allImages.forEach((tokens, search) => {
    let buttons = [];
    tokens.forEach((names, tokenSrc) => {
      artFound = true;
      const vid = isVideo(tokenSrc);
      const img = isImage(tokenSrc);
      for (let name of names) {
        buttons.push({
          path: tokenSrc,
          img: img,
          vid: vid,
          type: vid || img,
          label: name,
          hasConfig:
            searchType === SEARCH_TYPE.TOKEN || searchType === SEARCH_TYPE.BOTH
              ? Boolean(
                  tokenConfigs.find(
                    (config) => config.tvImgSrc == tokenSrc && config.tvImgName == name
                  )
                )
              : false,
        });
      }
    });
    allButtons.set(search, buttons);
  });

  new ArtSelect(search, {
    allImages: artFound ? allButtons : null,
    searchType: searchType,
    callback: callback,
    object: object,
    preventClose: preventClose,
    image1: image1,
    image2: image2,
  }).render(true);
}

// Deprecated
async function displayArtSelect(search, callback, searchType = SEARCH_TYPE.BOTH, object = {}) {
  showArtSelect(search, {
    callback: callback,
    searchType: searchType,
    object: object,
  });
}

async function _randSearchUtil(search, { searchType = SEARCH_TYPE.BOTH, actor = null } = {}) {
  const randSettings = game.settings.get('token-variants', 'randomizerSettings');
  if (!(randSettings.tokenName || randSettings.keywords || randSettings.shared)) return null;

  // Gather all images
  let results =
    randSettings.tokenName || randSettings.keywords
      ? await doImageSearch(search, {
          searchType: searchType,
          ignoreKeywords: !randSettings.keywords,
        })
      : new Map();

  if (!randSettings.tokenName) {
    results.delete(search);
  }
  if (randSettings.shared && actor) {
    let sharedVariants = actor.getFlag('token-variants', 'variants') || [];
    if (sharedVariants.length != 0) {
      results.set('variants95436723', new Map(sharedVariants.map((v) => [v.imgSrc, v.names])));
    }
  }

  return results;
}

async function doSyncSearch(search, target, { searchType = SEARCH_TYPE.TOKEN, actor = null } = {}) {
  if (caching) return null;
  const results = await _randSearchUtil(search, { searchType: searchType, actor: actor });
  if (!results) return results;

  // Find image with the name most similar to target
  let mostSimilar = { imgSrc: '', imgName: '', similarity: 0.0 };
  results.forEach((images, _) => {
    images.forEach((imgNames, imgSrc) => {
      for (const name of imgNames) {
        const similarity = stringSimilarity(name, target);
        if (mostSimilar.similarity < similarity) {
          mostSimilar = { imgSrc: imgSrc, imgName: name, similarity: similarity };
        }
      }
    });
  });

  if (mostSimilar.imgName) {
    console.log('Similarity: ', mostSimilar.similarity);
    return [mostSimilar.imgSrc, mostSimilar.imgName];
  }

  return null;
}

/**
 * @param {*} search Text to be used as the search criteria
 * @param {object} [options={}] Options which customize the search
 * @param {SEARCH_TYPE|string} [options.searchType] Controls filters applied to the search results
 * @param {Actor} [options.actor] Used to retrieve 'shared' images from if enabled in the Randomizer Settings
 * @param {Function[]} [options.callback] Function to be called with the random image
 * @returns Array<string>|null} Image path and name
 */
async function doRandomSearch(
  search,
  { searchType = SEARCH_TYPE.BOTH, actor = null, callback = null } = {}
) {
  if (caching) return null;

  const results = await _randSearchUtil(search, { searchType: searchType, actor: actor });
  if (!results) return results;

  // Pick random image
  let total = 0;
  results.forEach((v) => (total += v.size));
  let randImageNum = Math.floor(Math.random() * total);
  for (const [_, images] of results.entries()) {
    if (randImageNum < images.size) {
      for (let src of images.keys()) {
        if (randImageNum == 0) {
          const names = images.get(src);
          const result = [src, names[Math.floor(Math.random() * names.length)]];
          if (callback) callback(result[0], result[1]);
          return result;
        }
        randImageNum--;
      }
    } else {
      randImageNum -= images.size;
    }
  }
  return null;
}

/**
 * @param {*} search Text to be used as the search criteria
 * @param {object} [options={}] Options which customize the search
 * @param {SEARCH_TYPE|string} [options.searchType] Controls filters applied to the search results
 * @param {Boolean} [options.ignoreKeywords] Ignores keywords search setting
 * @param {Boolean} [options.simpleResults] Results will be returned as an array of all image paths found
 * @param {Function[]} [options.callback] Function to be called with the found images
 * @returns {Promise<Map<string, Map<string, Map<string, Array<string>>>>>|Array<String>|null} All images found split by original criteria and keywords
 */
export async function doImageSearch(
  search,
  {
    searchType = SEARCH_TYPE.BOTH,
    ignoreKeywords = false,
    simpleResults = false,
    callback = null,
  } = {}
) {
  if (caching) return;
  if (debug) console.log('STARTING: Art Search', search, searchType);

  let searches = [search];
  let allImages = new Map();
  let usedTokens = new Set();

  if (keywordSearch && !ignoreKeywords) {
    excludedKeywords = parseKeywords(game.settings.get('token-variants', 'excludedKeywords'));
    searches = searches.concat(
      search
        .split(/\W/)
        .filter((word) => word.length > 2 && !excludedKeywords.includes(word.toLowerCase()))
        .reverse()
    );
  }

  for (let search of searches) {
    if (allImages.get(search) !== undefined) continue;
    let map = await findTokens(search, searchType);
    let tokens = new Map();
    for (let tokenSrc of map.keys()) {
      if (!usedTokens.has(tokenSrc)) {
        usedTokens.add(tokenSrc);
        tokens.set(tokenSrc, map.get(tokenSrc));
      }
    }
    allImages.set(search, tokens);
  }

  if (debug) console.log('ENDING: Art Search');

  if (simpleResults) {
    allImages = Array.from(usedTokens);
  }

  if (callback) callback(allImages);
  return allImages;
}

/**
 * Updates Token and/or Proto Token  with the new image and custom configuration if one exists.
 * @param {string} imgSrc Image source path/url
 * @param {object} [options={}] Update options
 * @param {Token[]} [options.token] Token to be updated with the new image
 * @param {Actor} [options.actor] Actor with Proto Token to be updated with the new image
 * @param {string} [options.imgName] Image name if it differs from the file name. Relevant for rolltable sourced images.
 */
export async function updateTokenImage(
  imgSrc,
  { token = null, actor = null, imgName = null } = {}
) {
  if (!(token || actor)) {
    console.warn(
      game.i18n.localize('token-variants.notifications.warn.update-image-no-token-actor')
    );
    return;
  }

  if (!imgName) imgName = getFileName(imgSrc);
  if (!actor && token.actor) {
    actor = game.actors.get(token.actor.id);
  }

  const getDefaultConfig = (token, actor) => {
    let configEntries = [];
    if (token)
      configEntries =
        (token.document ? token.document : token).getFlag('token-variants', 'defaultConfig') || [];
    else if (actor) {
      const tokenData = actor.data.token;
      if ('token-variants' in tokenData.flags && 'defaultConfig' in tokenData['token-variants'])
        configEntries = tokenData['token-variants']['defaultConfig'];
    }
    return expandObject(Object.fromEntries(configEntries));
  };

  const constructDefaultConfig = (origData, customConfig) => {
    return Object.entries(flattenObject(filterObject(origData, customConfig)));
  };

  let tokenUpdateObj = {
    img: imgSrc,
  };
  const tokenCustomConfig = getTokenConfigForUpdate(imgSrc, imgName);
  const usingCustomConfig =
    token &&
    (token.document ? token.document : token).getFlag('token-variants', 'usingCustomConfig');
  const defaultConfig = getDefaultConfig(token);

  if (tokenCustomConfig || usingCustomConfig) {
    tokenUpdateObj = mergeObject(tokenUpdateObj, defaultConfig);
  }

  if (tokenCustomConfig) {
    if (token) {
      await token.setFlag('token-variants', 'usingCustomConfig', true);
      const tokenData = token.data instanceof Object ? token.data : token.data.toObject();
      const defConf = constructDefaultConfig(
        mergeObject(tokenData, defaultConfig),
        tokenCustomConfig
      );
      await token.setFlag('token-variants', 'defaultConfig', defConf);
    } else if (actor && !token) {
      tokenUpdateObj.flags = {
        'token-variants': {
          usingCustomConfig: true,
        },
      };
      const tokenData =
        actor.data.token instanceof Object ? actor.data.token : actor.data.token.toObject();
      const defConf = constructDefaultConfig(tokenData, tokenCustomConfig);
      tokenUpdateObj.flags = {
        'token-variants': {
          defaultConfig: defConf,
        },
      };
    }

    tokenUpdateObj = mergeObject(tokenUpdateObj, tokenCustomConfig);
  } else if (usingCustomConfig) {
    if (token) {
      await token.setFlag('token-variants', 'usingCustomConfig', false);
      await token.unsetFlag('token-variants', 'defaultConfig');
    } else if (actor && !token) {
      tokenUpdateObj.flags = {
        'token-variants': {
          usingCustomConfig: false,
          defaultConfig: [],
        },
      };
    }
  }

  if (actor && !token) {
    await (actor.document ?? actor).update({
      'token.img': imgSrc,
    });
    tokenUpdateObj = mergeObject(tokenUpdateObj, {
      flags: {
        'token-variants': {
          name: imgName,
        },
      },
    });
    if (isNewerVersion(game.version ?? game.data.version, '0.7.10'))
      await actor.data.token.update(tokenUpdateObj);
    else {
      for (const [key, value] of Object.entries(tokenUpdateObj)) {
        tokenUpdateObj[`token.${key}`] = value;
        delete tokenUpdateObj[key];
      }
      await actor.update(tokenUpdateObj);
    }
  }

  if (token) {
    const obj = token.document ?? token;
    await obj.setFlag('token-variants', 'name', imgName);
    await obj.update(tokenUpdateObj);
  }
}

function twoPopupPrompt(actor, imgSrc, imgName, token) {
  if (twoPopups && noTwoPopupsPrompt) {
    showArtSelect((token ?? actor.data.token).name, {
      callback: (imgSrc, name) =>
        updateTokenImage(imgSrc, {
          actor: actor,
          imgName: name,
          token: token,
        }),
      searchType: SEARCH_TYPE.TOKEN,
      object: token ? token : actor,
      force: true,
    });
  } else if (twoPopups) {
    let d = new Dialog({
      title: 'Portrait -> Token',
      content: `<p>${game.i18n.localize('token-variants.windows.art-select.apply-same-art')}</p>`,
      buttons: {
        one: {
          icon: '<i class="fas fa-check"></i>',
          callback: () => {
            updateTokenImage(imgSrc, {
              actor: actor,
              imgName: imgName,
              token: token,
            });
            const artSelects = Object.values(ui.windows).filter((app) => app instanceof ArtSelect);
            for (const app of artSelects) {
              app.close();
            }
          },
        },
        two: {
          icon: '<i class="fas fa-times"></i>',
          callback: () => {
            showArtSelect((token ?? actor.data.token).name, {
              callback: (imgSrc, name) =>
                updateTokenImage(imgSrc, {
                  actor: actor,
                  imgName: name,
                  token: token,
                }),
              searchType: SEARCH_TYPE.TOKEN,
              object: token ? token : actor,
              force: true,
            });
          },
        },
      },
      default: 'one',
    });
    d.render(true);
  }
}

// Initialize module
Hooks.once('ready', initialize);

// Register API and Keybinds
Hooks.on('init', function () {
  registerKeybinds();

  game.modules.get('token-variants').api = {
    cacheTokens,
    doImageSearch,
    doRandomSearch,
    showArtSelect,
    updateTokenImage,
  };

  // Deprecated api access
  const deprecatedWarn = () =>
    console.warn(
      "game.TokenVariants has been deprecated since 1.20.3, use game.modules.get('token-variants')?.api instead."
    );
  game.TokenVariants = {
    displayArtSelect: async (...args) => {
      deprecatedWarn();
      console.warn('displayArtSelect has been deprecated in favour of showArtSelect.');
      await displayArtSelect(...args);
    },
    cacheTokens: async () => {
      deprecatedWarn();
      await cacheTokens();
    },
    doImageSearch: (...args) => {
      deprecatedWarn();
      doImageSearch(...args);
    },
    doRandomSearch: async (...args) => {
      deprecatedWarn();
      await doRandomSearch(...args);
    },
    showArtSelect: async (...args) => {
      deprecatedWarn();
      await showArtSelect(...args);
    },
  };
});
