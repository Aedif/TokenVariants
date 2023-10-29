import { registerSettings, TVA_CONFIG, exportSettingsToJSON, updateSettings } from './scripts/settings.js';
import { ArtSelect, addToArtSelectQueue } from './applications/artSelect.js';
import {
  SEARCH_TYPE,
  registerKeybinds,
  updateTokenImage,
  startBatchUpdater,
  userRequiresImageCache,
  waitForTokenTexture,
} from './scripts/utils.js';
import { FONT_LOADING, broadcastDrawOverlays, drawOverlays } from './scripts/token/overlay.js';
import {
  getTokenEffects,
  setOverlayVisibility,
  toggleTemplate,
  toggleTemplateOnSelected,
  updateWithEffectMapping,
} from './scripts/hooks/effectMappingHooks.js';
import { cacheImages, doImageSearch, doRandomSearch, isCaching } from './scripts/search.js';
import { REGISTERED_HOOKS, registerAllHooks, registerHook } from './scripts/hooks/hooks.js';
import { REGISTERED_WRAPPERS, registerAllWrappers } from './scripts/wrappers/wrappers.js';
import {
  assignUserSpecificImage,
  assignUserSpecificImageToSelected,
  unassignUserSpecificImage,
  unassignUserSpecificImageFromSelected,
} from './scripts/wrappers/userMappingWrappers.js';
import { toggleTemplateDialog } from './applications/dialogs.js';

// Tracks if module has been initialized
let MODULE_INITIALIZED = false;
export function isInitialized() {
  return MODULE_INITIALIZED;
}
let onInit = [];

/**
 * Initialize the Token Variants module on Foundry VTT init
 */
async function initialize() {
  // Initialization should only be performed once
  if (MODULE_INITIALIZED) {
    return;
  }

  // Font Awesome need to be loaded manually on FireFox
  FONT_LOADING.loading = FontConfig.loadFont('fontAwesome', {
    editor: false,
    fonts: [{ urls: ['fonts/fontawesome/webfonts/fa-solid-900.ttf'] }],
  });

  // Want this to be executed once the module has initialized
  onInit.push(() => {
    // Need to wait for icons do be drawn first however I could not find a way
    // to wait until that has occurred. Instead we'll just wait for some static
    // amount of time.
    new Promise((resolve) => setTimeout(resolve, 500)).then(() => {
      for (const tkn of canvas.tokens.placeables) {
        drawOverlays(tkn); // Draw Overlays

        // Disable effect icons
        if (TVA_CONFIG.disableEffectIcons) {
          waitForTokenTexture(tkn, (token) => {
            token.effects.removeChildren().forEach((c) => c.destroy());
            token.effects.bg = token.effects.addChild(new PIXI.Graphics());
            token.effects.overlay = null;
          });
        } else if (TVA_CONFIG.filterEffectIcons) {
          waitForTokenTexture(tkn, (token) => {
            token.drawEffects();
          });
        }
      }
    });
  });

  if (userRequiresImageCache()) cacheImages();

  // Register ALL Hooks
  registerAllHooks();

  // Startup ticker that will periodically call 'updateEmbeddedDocuments' with all the accrued updates since the last tick
  startBatchUpdater();

  registerHook('Search', 'renderArtSelect', () => {
    ArtSelect.executing = false;
  });

  // Handle broadcasts
  game.socket?.on(`module.token-variants`, (message) => {
    if (message.handlerName === 'forgeSearchPaths' && message.type === 'UPDATE') {
      // Workaround for forgeSearchPaths setting to be updated by non-GM clients
      if (!game.user.isGM) return;
      const isResponsibleGM = !game.users
        .filter((user) => user.isGM && (user.active || user.isActive))
        .some((other) => other.id < game.user.id);
      if (!isResponsibleGM) return;
      updateSettings({ forgeSearchPaths: message.args });
    } else if (message.handlerName === 'drawOverlays' && message.type === 'UPDATE') {
      if (message.args.all) {
        if (canvas.scene.id !== message.args.sceneId) {
          for (const tkn of canvas.tokens.placeables) {
            drawOverlays(tkn);
          }
        }
      } else if (message.args.actorId) {
        const actor = game.actors.get(message.args.actorId);
        if (actor) actor.getActiveTokens(true)?.forEach((tkn) => drawOverlays(tkn));
      } else if (message.args.tokenId) {
        const tkn = canvas.tokens.get(message.args.tokenId);
        if (tkn) drawOverlays(tkn);
      }
    } else if (message.handlerName === 'effectMappings') {
      if (!game.user.isGM) return;
      const isResponsibleGM = !game.users
        .filter((user) => user.isGM && (user.active || user.isActive))
        .some((other) => other.id < game.user.id);
      if (!isResponsibleGM) return;
      const args = message.args;
      const token = game.scenes.get(args.sceneId)?.tokens.get(args.tokenId);
      if (token) updateWithEffectMapping(token, { added: args.added, removed: args.removed });
    }
  });

  MODULE_INITIALIZED = true;
  for (const cb of onInit) {
    cb();
  }
  onInit = [];
}

/**
 * Performs searches and displays the Art Select pop-up with the results
 * @param {string} search The text to be used as the search criteria
 * @param {object} [options={}] Options which customize the search
 * @param {Function[]} [options.callback] Function to be called with the user selected image path
 * @param {SEARCH_TYPE|string} [options.searchType] Controls filters applied to the search results
 * @param {Token|Actor} [options.object] Token/Actor used when displaying Custom Token Config prompt
 * @param {boolean} [options.force] If true will always override the current Art Select window if one exists instead of adding it to the queue
 * @param {object} [options.searchOptions] Override search and filter settings
 */
export async function showArtSelect(
  search,
  {
    callback = null,
    searchType = SEARCH_TYPE.PORTRAIT_AND_TOKEN,
    object = null,
    force = false,
    preventClose = false,
    image1 = '',
    image2 = '',
    displayMode = ArtSelect.IMAGE_DISPLAY.NONE,
    multipleSelection = false,
    searchOptions = {},
    allImages = null,
  } = {}
) {
  if (isCaching()) return;

  const artSelects = Object.values(ui.windows).filter((app) => app instanceof ArtSelect);
  if (ArtSelect.executing || (!force && artSelects.length !== 0)) {
    addToArtSelectQueue(search, {
      callback,
      searchType,
      object,
      preventClose,
      searchOptions,
      allImages,
    });
    return;
  }

  ArtSelect.executing = true;
  if (!allImages)
    allImages = await doImageSearch(search, {
      searchType: searchType,
      searchOptions: searchOptions,
    });

  new ArtSelect(search, {
    allImages: allImages,
    searchType: searchType,
    callback: callback,
    object: object,
    preventClose: preventClose,
    image1: image1,
    image2: image2,
    displayMode: displayMode,
    multipleSelection: multipleSelection,
    searchOptions: searchOptions,
  }).render(true);
}

// Initialize module
registerHook('main', 'ready', initialize, { once: true });

// Register API and Keybinds
registerHook('main', 'init', function () {
  registerSettings();
  registerAllWrappers();

  registerKeybinds();

  const api = {
    cacheImages,
    doImageSearch,
    doRandomSearch,
    getTokenEffects,
    showArtSelect,
    updateTokenImage,
    exportSettingsToJSON,
    assignUserSpecificImage,
    assignUserSpecificImageToSelected,
    unassignUserSpecificImage,
    unassignUserSpecificImageFromSelected,
    setOverlayVisibility,
    toggleTemplateDialog,
    toggleTemplate,
    toggleTemplateOnSelected,
    drawOverlays,
    broadcastDrawOverlays,
    TVA_CONFIG,
  };

  Object.defineProperty(api, 'hooks', {
    get() {
      return deepClone(REGISTERED_HOOKS);
    },
    configurable: true,
  });

  Object.defineProperty(api, 'wrappers', {
    get() {
      return deepClone(REGISTERED_WRAPPERS);
    },
    configurable: true,
  });

  game.modules.get('token-variants').api = api;
});
