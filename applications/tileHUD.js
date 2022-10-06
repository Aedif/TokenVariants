import { getFileName, isImage, isVideo, SEARCH_TYPE, keyPressed } from '../scripts/utils.js';
import { doImageSearch } from '../token-variants.mjs';
import { TVA_CONFIG } from '../scripts/settings.js';

// not call if still caching
export async function renderTileHUD(hud, html, tileData, searchText = '') {
  const tile = hud.object;
  const hudSettings = TVA_CONFIG.hud;
  const worldHudSettings = TVA_CONFIG.worldHud;

  if (!hudSettings.enableSideMenu || !TVA_CONFIG.tilesEnabled) return;

  const tileName = tile.document.getFlag('token-variants', 'tileName') || tileData._id;

  const search = searchText ? searchText : tileName;
  if (!search || search.length < 3) return;

  const noSearch = !searchText && worldHudSettings.displayOnlySharedImages;

  let artSearch = noSearch
    ? null
    : await doImageSearch(search, {
        searchType: SEARCH_TYPE.TILE,
        searchOptions: { keywordSearch: worldHudSettings.includeKeywords },
      });

  // Merge full search, and keywords into a single array
  let images = [];
  if (artSearch) {
    artSearch.forEach((results) => {
      images.push(...results);
    });
  }

  const variants = tile.document.getFlag('token-variants', 'variants') || [];

  if (!searchText) {
    const mergeImages = function (imgArr) {
      imgArr.forEach((variant) => {
        for (const name of variant.names) {
          if (!images.find((obj) => obj.path === variant.imgSrc && obj.name === name)) {
            images.unshift({ path: variant.imgSrc, name: name });
          }
        }
      });
    };

    // Merge images found through search, with variants shared through 'variant' flag
    mergeImages(variants);
  }

  // If no images have been found check if the HUD button should be displayed regardless
  if (!images.length && !variants.length) {
    if (!hudSettings.alwaysShowButton) return;
  }

  // Retrieving the possibly custom name attached as a flag to the token
  let tileImageName = tile.document.getFlag('token-variants', 'name');
  if (!tileImageName) {
    tileImageName = getFileName(tile.img);
  }

  let imagesParsed = [];

  for (const imageObj of images) {
    const img = isImage(imageObj.path);
    const vid = isVideo(imageObj.path);

    let shared = false;
    if (game.user.isGM) {
      variants.forEach((variant) => {
        if (variant.imgSrc === imageObj.path && variant.names.includes(imageObj.name)) {
          shared = true;
        }
      });
    }

    const [title, style] = genTitleAndStyle({}, imageObj.path, imageObj.name);

    imagesParsed.push({
      route: imageObj.path,
      name: imageObj.name,
      used: imageObj.path === tile.data.img && imageObj.name === tileImageName,
      img,
      vid,
      unknownType: !img && !vid,
      shared: shared,
      hasConfig: false, //hasConfig,
      title: title,
      style: game.user.isGM && style ? 'box-shadow: ' + style + ';' : null,
    });
  }

  //
  // Render
  //
  const imageDisplay = hudSettings.displayAsImage;
  const imageOpacity = hudSettings.imageOpacity / 100;

  const sideSelect = await renderTemplate('modules/token-variants/templates/sideSelect.html', {
    imagesParsed,
    imageDisplay,
    imageOpacity,
    autoplay: !TVA_CONFIG.playVideoOnHover,
  });

  let divR = html.find('div.right').append(sideSelect);

  // Activate listeners
  divR.find('video').hover(
    function () {
      if (TVA_CONFIG.playVideoOnHover) {
        this.play();
        $(this).siblings('.fa-play').hide();
      }
    },
    function () {
      if (TVA_CONFIG.pauseVideoOnHoverOut) {
        this.pause();
        this.currentTime = 0;
        $(this).siblings('.fa-play').show();
      }
    }
  );
  divR.find('#token-variants-side-button').click((event) => _onSideButtonClick(event, tile));
  divR.find('.token-variants-button-select').click((event) => _onImageClick(event, tile));
  // Prevent enter key re-loading the world
  divR.find('.token-variants-side-search').keydown(function (event) {
    if (event.keyCode == 13) {
      event.preventDefault();
      return false;
    }
  });
  divR
    .find('.token-variants-side-search')
    .on('keyup', (event) => _onImageSearchKeyUp(event, hud, html, tile));

  divR.find('#token-variants-side-button').on('contextmenu', _onSideButtonRightClick);
  divR
    .find('.token-variants-button-select')
    .on('contextmenu', (event) => _onImageRightClick(event, tile));

  // If renderHud is being called from text box search the side menu should be enabled by default
  if (searchText) {
    divR.find('#token-variants-side-button').parent().addClass('active');
    divR.find('.token-variants-wrap').addClass('active');
  }
}

function _onSideButtonClick(event, tile) {
  if (keyPressed('config')) {
    setNameDialog(tile);
    return;
  }

  // De-activate 'Status Effects'
  const is080 = !isNewerVersion('0.8.0', game.version ?? game.data.version);
  const variantsControlIcon = $(event.target.parentElement);
  variantsControlIcon
    .closest('div.right')
    .find(is080 ? '.control-icon[data-action="effects"]' : 'div.control-icon.effects')
    .removeClass('active');
  variantsControlIcon.closest('div.right').find('.status-effects').removeClass('active');

  // Toggle variants side menu
  variantsControlIcon.toggleClass('active');
  const variantsWrap = variantsControlIcon.find('.token-variants-wrap');
  if (variantsControlIcon.hasClass('active')) {
    variantsWrap.addClass('active');
  } else {
    variantsWrap.removeClass('active');
  }
}

function _onSideButtonRightClick(event) {
  // Display side menu if button is not active yet
  const variantsControlIcon = $(event.target.parentElement);
  if (!variantsControlIcon.hasClass('active')) {
    variantsControlIcon.find('#token-variants-side-button').trigger('click');
  }

  // Display/hide buttons and search input
  const contextMenu = $(event.target)
    .closest('div.control-icon')
    .find('.token-variants-context-menu');
  const buttons = $(event.target).closest('div.control-icon').find('.token-variants-button-select');
  if (contextMenu.hasClass('active')) {
    contextMenu.removeClass('active');
    buttons.removeClass('hide');
  } else {
    contextMenu.addClass('active');
    buttons.addClass('hide');
  }
}

async function _onImageClick(event, tile) {
  event.preventDefault();
  event.stopPropagation();

  if (!tile) return;

  const imgButton = $(event.target).closest('.token-variants-button-select');
  const imgSrc = imgButton.attr('data-name');
  const name = imgButton.attr('data-filename');
  if (imgSrc) {
    canvas.background.hud.clear();
    await tile.document.update({ img: imgSrc });
    try {
      await tile.document.setFlag('token-variants', 'name', name);
    } catch (e) {}
  }
}

function _onImageRightClick(event, tile) {
  event.preventDefault();
  event.stopPropagation();

  if (!tile) return;

  const imgButton = $(event.target).closest('.token-variants-button-select');
  const imgSrc = imgButton.attr('data-name');
  const name = imgButton.attr('data-filename');

  if (!imgSrc || !name) return;

  let variants = tile.document.getFlag('token-variants', 'variants') || [];

  // Remove selected variant if present in the flag, add otherwise
  let del = false;
  let updated = false;
  for (let variant of variants) {
    if (variant.imgSrc === imgSrc) {
      let fNames = variant.names.filter((name) => name !== name);
      if (fNames.length === 0) {
        del = true;
      } else if (fNames.length === variant.names.length) {
        fNames.push(name);
      }
      variant.names = fNames;
      updated = true;
      break;
    }
  }
  if (del) variants = variants.filter((variant) => variant.imgSrc !== imgSrc);
  else if (!updated) variants.push({ imgSrc: imgSrc, names: [name] });

  // Set shared variants as a flag
  tile.document.unsetFlag('token-variants', 'variants');
  if (variants.length > 0) {
    tile.document.setFlag('token-variants', 'variants', variants);
  }
  imgButton.find('.fa-share').toggleClass('active'); // Display green arrow
}

function _onImageSearchKeyUp(event, hud, html, tileData) {
  event.preventDefault();
  event.stopPropagation();
  if (event.key === 'Enter' || event.keyCode === 13) {
    if (event.target.value.length >= 3) {
      $(event.target).closest('.control-icon[data-action="token-variants-side-selector"]').remove();
      html.find('.control-icon[data-action="token-variants-side-selector"]').remove();
      renderTileHUD(hud, html, tileData, event.target.value);
    }
  }
  return false;
}

function genTitleAndStyle(mappings, imgSrc, name) {
  let title = name;
  let style = '';
  let offset = 2;
  for (const [userId, img] of Object.entries(mappings)) {
    if (img === imgSrc) {
      const user = game.users.get(userId);
      if (!user) continue;
      if (style.length === 0) {
        style = `inset 0 0 0 ${offset}px ${user.data.color}`;
      } else {
        style += `, inset 0 0 0 ${offset}px ${user.data.color}`;
      }
      offset += 2;
      title += `\nDisplayed to: ${user.data.name}`;
    }
  }
  return [title, style];
}

function setNameDialog(tile) {
  const tileName = tile.document.getFlag('token-variants', 'tileName') || tile.id;
  new Dialog({
    title: `Assign a name to the Tile (3+ chars)`,
    content: `<table style="width:100%"><tr><th style="width:50%"><label>Tile Name</label></th><td style="width:50%"><input type="text" name="input" value="${tileName}"/></td></tr></table>`,
    buttons: {
      Ok: {
        label: `Save`,
        callback: (html) => {
          const name = html.find('input').val();
          if (name) {
            canvas.background.hud.clear();
            tile.document.setFlag('token-variants', 'tileName', name);
          }
        },
      },
    },
  }).render(true);
}
