import { showArtSelect } from '../token-variants.mjs';
import { TVA_CONFIG } from './settings.js';
import { SEARCH_TYPE, updateActorImage } from './utils.js';

export function registerMiscHooks() {
  // Insert buttons and listeners to open up ArtSelect forms from
  // various contexts
  Hooks.on('renderTileConfig', _modTileConfig);
  Hooks.on('renderMeasuredTemplateConfig', _modTemplateConfig);

  if (TVA_CONFIG.permissions.portrait_right_click[game.user.role]) {
    Hooks.on('renderActorSheet', _modActorSheet);
    Hooks.on('renderItemSheet', _modItemSheet);
    Hooks.on('renderItemActionSheet', _modItemSheet);
    Hooks.on('renderJournalSheet', _modJournalSheet);
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
