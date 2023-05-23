import { insertArtSelectButton } from '../../applications/artSelect.js';
import { showArtSelect } from '../../token-variants.mjs';
import { TVA_CONFIG } from '../settings.js';
import { SEARCH_TYPE, getTokenConfigForUpdate, updateActorImage } from '../utils.js';
import { registerHook, unregisterHook } from './hooks.js';

const feature_id = 'ArtSelect';

export function registerArtSelectButtonHooks() {
  // Insert right-click listeners to open up ArtSelect forms from various contexts
  if (TVA_CONFIG.permissions.portrait_right_click[game.user.role]) {
    registerHook(feature_id, 'renderActorSheet', _modActorSheet);
    registerHook(feature_id, 'renderItemSheet', _modItemSheet);
    registerHook(feature_id, 'renderItemActionSheet', _modItemSheet);
    registerHook(feature_id, 'renderJournalSheet', _modJournalSheet);
    registerHook(feature_id, 'renderRollTableConfig', _modRollTableSheet);
  } else {
    [
      'renderActorSheet',
      'renderItemSheet',
      'renderItemActionSheet',
      'renderJournalSheet',
      'renderRollTableConfig',
    ].forEach((name) => unregisterHook(feature_id, name));
  }

  // Insert buttons
  if (TVA_CONFIG.permissions.image_path_button[game.user.role]) {
    registerHook(feature_id, 'renderTileConfig', _modTileConfig);
    registerHook(feature_id, 'renderMeasuredTemplateConfig', _modTemplateConfig);
    registerHook(feature_id, 'renderTokenConfig', _modTokenConfig);
    registerHook(feature_id, 'renderDrawingConfig', _modDrawingConfig);
    registerHook(feature_id, 'renderNoteConfig', _modNoteConfig);
    registerHook(feature_id, 'renderSceneConfig', _modSceneConfig);
  } else {
    [
      'renderTileConfig',
      'renderMeasuredTemplateConfig',
      'renderTokenConfig',
      'renderDrawingConfig',
      'renderNoteConfig',
      'renderSceneConfig',
    ].forEach((name) => unregisterHook(feature_id, name));
  }
}

function _modTokenConfig(config, html) {
  insertArtSelectButton(html, 'texture.src', { search: config.object.name, searchType: SEARCH_TYPE.TOKEN });
}

function _modTemplateConfig(config, html) {
  insertArtSelectButton(html, 'texture', { search: 'Template', searchType: SEARCH_TYPE.TILE });
}

function _modDrawingConfig(config, html) {
  insertArtSelectButton(html, 'texture', {
    search: 'Drawing',
    searchType: TVA_CONFIG.customImageCategories.includes('Drawing') ? 'Drawing' : SEARCH_TYPE.TILE,
  });
}

function _modNoteConfig(config, html) {
  insertArtSelectButton(html, 'icon.custom', {
    search: 'Note',
    searchType: TVA_CONFIG.customImageCategories.includes('Note') ? 'Note' : SEARCH_TYPE.ITEM,
  });
}

function _modSceneConfig(config, html) {
  insertArtSelectButton(html, 'background.src', {
    search: config.object.name,
    searchType: TVA_CONFIG.customImageCategories.includes('Scene') ? 'Scene' : SEARCH_TYPE.TILE,
  });
  insertArtSelectButton(html, 'foreground', {
    search: config.object.name,
    searchType: TVA_CONFIG.customImageCategories.includes('Scene') ? 'Scene' : SEARCH_TYPE.TILE,
  });
  insertArtSelectButton(html, 'fogOverlay', {
    search: config.object.name,
    searchType: TVA_CONFIG.customImageCategories.includes('Fog') ? 'Fog' : SEARCH_TYPE.TILE,
  });
}

function _modTileConfig(tileConfig, html) {
  insertArtSelectButton(html, 'texture.src', {
    search: tileConfig.object.getFlag('token-variants', 'tileName') || 'Tile',
    searchType: SEARCH_TYPE.TILE,
  });
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

function _modRollTableSheet(sheet, html) {
  $(html)
    .find('.result-image')
    .on('contextmenu', (event) => {
      const table = sheet.object;
      if (!table) return;
      const img = $(event.target).closest('.result-image').find('img');
      showArtSelect(table.name, {
        searchType: TVA_CONFIG.customImageCategories.includes('RollTable') ? 'RollTable' : SEARCH_TYPE.ITEM,
        callback: (imgSrc) => {
          img.attr('src', imgSrc);
          sheet._onSubmit(event);
        },
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
      console.log('TVA |', game.i18n.localize('token-variants.notifications.warn.profile-image-not-found'));
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
