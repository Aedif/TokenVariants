import { showArtSelect } from '../../token-variants.mjs';
import { TVA_CONFIG } from '../settings.js';
import { SEARCH_TYPE, getTokenConfigForUpdate, updateActorImage } from '../utils.js';
import { registerHook, unregisterHook } from './hooks.js';

const feature_id = 'artSelect';

export function registerArtSelectButtonHooks() {
  // Insert buttons and listeners to open up ArtSelect forms from various contexts
  if (TVA_CONFIG.permissions.portrait_right_click[game.user.role]) {
    registerHook(feature_id, 'renderActorSheet', _modActorSheet);
    registerHook(feature_id, 'renderItemSheet', _modItemSheet);
    registerHook(feature_id, 'renderItemActionSheet', _modItemSheet);
    registerHook(feature_id, 'renderJournalSheet', _modJournalSheet);
    registerHook(feature_id, 'renderTileConfig', _modTileConfig);
    registerHook(feature_id, 'renderMeasuredTemplateConfig', _modTemplateConfig);
    registerHook(feature_id, 'renderTokenConfig', _modTokenConfig);
  } else {
    [
      'renderActorSheet',
      'renderItemSheet',
      'renderItemActionSheet',
      'renderJournalSheet',
      'renderTileConfig',
      'renderMeasuredTemplateConfig',
      'renderTokenConfig',
    ].forEach((name) => unregisterHook(feature_id, name));
  }
}

/**
 * Adds a button to 'Token Configuration' window's 'Image' tab which opens
 * ArtSelect using the token's name.
 */
function _modTokenConfig(tokenConfig, html, _) {
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
        el.setAttribute('data-target', 'texture.src');
        el.onclick = async () => {
          showArtSelect(tokenConfig.object.name, {
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
}

function _modItemSheet(itemSheet, html, options) {
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

function _modJournalSheet(journalSheet, html, options) {
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
 * Adds right-click listener to Actor Sheet profile image to open up
 * the 'Art Select' screen.
 */
function _modActorSheet(actorSheet, html, options) {
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

/**
 * Adds a button to 'Measured Template Configuration' window
 */
function _modTemplateConfig(templateConfig, html, _) {
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
 * Adds a button to 'Tile Configuration' window's 'Tile Image or Video' form-group
 * to open an ArtSelect using the tile's name.
 */
function _modTileConfig(tileConfig, html, _) {
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
