import { registerSettings, TVA_CONFIG, exportSettingsToJSON, updateSettings } from './scripts/settings.js';
import { ArtSelect, addToArtSelectQueue } from './applications/artSelect.js';
import {
  SEARCH_TYPE,
  registerKeybinds,
  updateActorImage,
  updateTokenImage,
  startBatchUpdater,
  userRequiresImageCache,
  waitForTokenTexture,
} from './scripts/utils.js';
import { renderTileHUD } from './applications/tileHUD.js';
import { checkAndDisplayUserSpecificImage } from './scripts/token/userToImage.js';
import { drawOverlays } from './scripts/token/overlay.js';
import { updateWithEffectMapping } from './scripts/token/effects.js';
import { registerTokenHooks } from './scripts/token/hooks.js';
import { registerTokenWrappers } from './scripts/token/wrappers.js';
import { cacheImages, doImageSearch, doRandomSearch } from './scripts/search.js';

// Tracks if module has been initialized
let MODULE_INITIALIZED = false;
export function isInitialized() {
  return MODULE_INITIALIZED;
}
let onInit = [];

// showArtSelect(...) can take a while to fully execute and it is possible for it to be called
// multiple times in very quick succession especially if copy pasting tokens or importing actors.
// This variable set early in the function execution is used to queue additional requests rather
// than continue execution
const showArtSelectExecuting = { inProgress: false };

/**
 * Initialize the Token Variants module on Foundry VTT init
 */
async function initialize() {
  // Initialization should only be performed once
  if (MODULE_INITIALIZED) {
    return;
  }

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

  await registerSettings();

  if (userRequiresImageCache()) {
    cacheImages();
  }

  // Startup ticker that will periodically call 'updateEmbeddedDocuments' with all the accrued updates since the last tick
  startBatchUpdater();

  registerTokenHooks();
  registerTokenWrappers();

  Hooks.on('renderArtSelect', () => {
    showArtSelectExecuting.inProgress = false;
  });

  // Handle broadcasts
  game.socket?.on(`module.token-variants`, (message) => {
    if (message.handlerName === 'drawMorphOverlay') {
      const token = canvas.tokens.get(message.args.tokenId);
      if (token) token.tvaMorph = message.args.morph;
    }

    // Workaround for forgeSearchPaths setting to be updated by non-GM clients
    if (message.handlerName === 'forgeSearchPaths' && message.type === 'UPDATE') {
      if (!game.user.isGM) return;
      const isResponsibleGM = !game.users
        .filter((user) => user.isGM && (user.active || user.isActive))
        .some((other) => other.id < game.user.id);
      if (!isResponsibleGM) return;
      updateSettings({ forgeSearchPaths: message.args });
    }

    if (message.handlerName === 'drawOverlays' && message.type === 'UPDATE') {
      if (message.args.all) {
        if (canvas.scene.id !== message.args.sceneId) {
          for (const tkn of canvas.tokens.placeables) {
            drawOverlays(tkn);
          }
        }
      } else if (message.args.tokenId) {
        const tkn = canvas.tokens.get(message.args.tokenId);
        if (tkn) drawOverlays(tkn);
      }
    }
  });

  // Insert buttons and listeners to open up ArtSelect forms from
  // various contexts
  Hooks.on('renderTileConfig', modTileConfig);
  Hooks.on('renderMeasuredTemplateConfig', modTemplateConfig);

  if (TVA_CONFIG.permissions.portrait_right_click[game.user.role]) {
    Hooks.on('renderActorSheet', modActorSheet);
    Hooks.on('renderItemSheet', modItemSheet);
    Hooks.on('renderItemActionSheet', modItemSheet);
    Hooks.on('renderJournalSheet', modJournalSheet);
  }

  Hooks.on('renderTileHUD', renderTileHUD);

  MODULE_INITIALIZED = true;
  for (const cb of onInit) {
    cb();
  }
  onInit = [];
}

/**
 * Adds a button to 'Tile Configuration' window's 'Tile Image or Video' form-group
 * to open an ArtSelect using the tile's name.
 */
function modTileConfig(tileConfig, html, _) {
  if (TVA_CONFIG.permissions.image_path_button[game.user.role]) {
    let fields = html[0].getElementsByClassName('image');
    for (let field of fields) {
      if (field.getAttribute('name') == 'texture.src') {
        let el = document.createElement('button');
        el.type = 'button';
        el.title = game.i18n.localize('token-variants.windows.art-select.select-variant');
        el.className = 'token-variants-image-select-button';
        el.innerHTML = '<i class="fas fa-images"></i>';
        el.tabIndex = -1;
        el.setAttribute('data-type', 'imagevideo');
        el.setAttribute('data-target', 'img');
        el.onclick = async () => {
          const tileName =
            tileConfig.object.getFlag('token-variants', 'tileName') || tileConfig.object.id || 'new tile';
          showArtSelect(tileName, {
            callback: (imgSrc, name) => {
              field.value = imgSrc;
            },
            searchType: SEARCH_TYPE.TILE,
          });
        };
        field.parentNode.append(el);
        return;
      }
    }
  }
}

/**
 * Adds a button to 'Measured Template Configuration' window
 */
function modTemplateConfig(templateConfig, html, _) {
  if (TVA_CONFIG.permissions.image_path_button[game.user.role]) {
    let fields = html[0].getElementsByClassName('image');
    for (let field of fields) {
      if (field.getAttribute('name') == 'texture') {
        let el = document.createElement('button');
        el.type = 'button';
        el.title = game.i18n.localize('token-variants.windows.art-select.select-variant');
        el.className = 'token-variants-image-select-button';
        el.innerHTML = '<i class="fas fa-images"></i>';
        el.tabIndex = -1;
        el.setAttribute('data-type', 'imagevideo');
        el.setAttribute('data-target', 'img');
        el.onclick = async () => {
          showArtSelect('template', {
            callback: (imgSrc, name) => {
              field.value = imgSrc;
            },
            searchType: SEARCH_TYPE.TILE,
          });
        };
        field.parentNode.append(el);
        return;
      }
    }
  }
}

/**
 * Adds right-click listener to Actor Sheet profile image to open up
 * the 'Art Select' screen.
 */
function modActorSheet(actorSheet, html, options) {
  if (options.editable && TVA_CONFIG.permissions.portrait_right_click[game.user.role]) {
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
          callback: (imgSrc, name) => updateActorImage(actorSheet.object, imgSrc),
          searchType: SEARCH_TYPE.PORTRAIT,
          object: actorSheet.object,
        });
      },
      false
    );
  }
}

function modItemSheet(itemSheet, html, options) {
  $(html)
    .find('img.profile, .profile-img, [data-edit="img"]')
    .on('contextmenu', () => {
      const item = itemSheet.object;
      if (!item) return;
      showArtSelect(item.name, {
        searchType: SEARCH_TYPE.ITEM,
        callback: (imgSrc) => item.update({ img: imgSrc }),
      });
    });
}

function modJournalSheet(journalSheet, html, options) {
  $(html)
    .find('.header-button.entry-image')
    .on('contextmenu', () => {
      const journal = journalSheet.object;
      if (!journal) return;
      showArtSelect(journal.name, {
        searchType: SEARCH_TYPE.JOURNAL,
        callback: (imgSrc) => journal.update({ img: imgSrc }),
      });
    });
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
  if (caching) return;

  const artSelects = Object.values(ui.windows).filter((app) => app instanceof ArtSelect);
  if (showArtSelectExecuting.inProgress || (!force && artSelects.length !== 0)) {
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

  showArtSelectExecuting.inProgress = true;
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
Hooks.once('ready', initialize);

// Register API and Keybinds
Hooks.on('init', function () {
  registerKeybinds();
  game.modules.get('token-variants').api = {
    cacheImages,
    doImageSearch,
    doRandomSearch,
    showArtSelect,
    updateTokenImage,
    exportSettingsToJSON,
    TVA_CONFIG,
  };
});

Hooks.on('canvasReady', async function () {
  for (const tkn of canvas.tokens.placeables) {
    // Once canvas is ready we need to overwrite token images if specific maps exist for the user
    checkAndDisplayUserSpecificImage(tkn);
    if (MODULE_INITIALIZED) {
      updateWithEffectMapping(tkn);
      drawOverlays(tkn);
    }
  }
});
