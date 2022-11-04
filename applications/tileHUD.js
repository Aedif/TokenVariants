import { getFileName, isImage, isVideo, SEARCH_TYPE, keyPressed } from '../scripts/utils.js';
import { doImageSearch } from '../token-variants.mjs';
import { TVA_CONFIG } from '../scripts/settings.js';
import FlagsConfig from './flagsConfig.js';

export async function renderTileHUD(hud, html, tileData, searchText = '', fp_files = null) {
  const tile = hud.object;
  const hudSettings = TVA_CONFIG.hud;

  if (!hudSettings.enableSideMenu || !TVA_CONFIG.tilesEnabled) return;

  const button = $(`
  <div class="control-icon" data-action="token-variants-side-selector">
    <img
      id="token-variants-side-button"
      src="modules/token-variants/img/token-images.svg"
      width="36"
      height="36"
      title="${game.i18n.localize('token-variants.windows.art-select.select-variant')}"
    />
  </div>
`);

  html.find('div.right').last().append(button);
  html.find('div.right').click(_deactivateTokenVariantsSideSelector);

  button.click((event) => _onButtonClick(event, tile));
  button.contextmenu((event) => _onButtonRightClick(event, tile));
}

async function _onButtonClick(event, tile) {
  if (keyPressed('config')) {
    setNameDialog(tile);
    return;
  }

  const button = $(event.target).closest('.control-icon');

  // De-activate 'Status Effects'
  button.closest('div.right').find('div.control-icon.effects').removeClass('active');
  button.closest('div.right').find('.status-effects').removeClass('active');

  // Remove contextmenu
  button.find('.contextmenu').remove();

  // Toggle variants side menu
  button.toggleClass('active');
  let variantsWrap = button.find('.token-variants-wrap');
  if (button.hasClass('active')) {
    if (!variantsWrap.length) {
      variantsWrap = await renderSideSelect(tile);
      if (variantsWrap) button.find('img').after(variantsWrap);
      else return;
    }
    variantsWrap.addClass('active');
  } else {
    variantsWrap.removeClass('active');
  }
}

function _onButtonRightClick(event, tile) {
  // Display side menu if button is not active yet
  const button = $(event.target).closest('.control-icon');
  if (!button.hasClass('active')) {
    // button.trigger('click');
    button.addClass('active');
  }

  if (button.find('.contextmenu').length) {
    // Contextmenu already displayed. Remove and activate images
    button.find('.contextmenu').remove();
    button.removeClass('active').trigger('click');
    //button.find('.token-variants-wrap.images').addClass('active');
  } else {
    // Contextmenu is not displayed. Hide images, create it and add it
    button.find('.token-variants-wrap.images').removeClass('active');
    const contextMenu = $(`
    <div class="token-variants-wrap contextmenu active">
      <div class="token-variants-context-menu active">
        <input class="token-variants-side-search" type="text" />
        <button class="flags" type="button"><i class="fab fa-font-awesome-flag"></i><label>Flags</label></button>
        <button class="file-picker" type="button"><i class="fas fa-file-import fa-fw"></i><label>FilePicker</label></button>
      </div>
    </div>
      `);
    button.append(contextMenu);

    // Register contextmenu listeners
    contextMenu
      .find('.token-variants-side-search')
      .on('keydown', (event) => _onImageSearchKeyUp(event, tile))
      .on('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    contextMenu.find('.flags').click((event) => {
      event.preventDefault();
      event.stopPropagation();
      new FlagsConfig(tile).render(true);
    });
    contextMenu.find('.file-picker').click(async (event) => {
      event.preventDefault();
      event.stopPropagation();
      new FilePicker({
        type: 'folder',
        callback: async (path, fp) => {
          const content = await FilePicker.browse(fp.activeSource, fp.result.target);
          let files = content.files.filter((f) => isImage(f) || isVideo(f));
          if (files.length) {
            button.find('.token-variants-wrap').remove();
            const sideSelect = await renderSideSelect(tile, null, files);
            if (sideSelect) {
              sideSelect.addClass('active');
              button.append(sideSelect);
            }
          }
        },
      }).render(true);
    });
  }
}

function _deactivateTokenVariantsSideSelector(event) {
  const controlIcon = $(event.target).closest('.control-icon');
  const dataAction = controlIcon.attr('data-action');

  switch (dataAction) {
    case 'effects':
      break; // Effects button
    case 'thwildcard-selector':
      break; // Token HUD Wildcard module button
    default:
      return;
  }

  $(event.target)
    .closest('div.right')
    .find('.control-icon[data-action="token-variants-side-selector"]')
    .removeClass('active');
  $(event.target).closest('div.right').find('.token-variants-wrap').removeClass('active');
}

async function renderSideSelect(tile, searchText = null, fp_files = null) {
  const hudSettings = TVA_CONFIG.hud;
  const worldHudSettings = TVA_CONFIG.worldHud;
  const FULL_ACCESS = TVA_CONFIG.permissions.hudFullAccess[game.user.role];
  let images = [];
  let variants = [];
  let imageDuplicates = new Set();
  const pushImage = (img) => {
    if (imageDuplicates.has(img.path)) {
      if (!images.find((obj) => obj.path === img.path && obj.name === img.name)) {
        images.push(img);
      }
    } else {
      images.push(img);
      imageDuplicates.add(img.path);
    }
  };

  if (!fp_files) {
    if (searchText !== null && searchText < 3) return;

    if (!searchText) {
      variants = tile.document.getFlag('token-variants', 'variants') || [];
      variants.forEach((variant) => {
        for (const name of variant.names) {
          pushImage({ path: variant.imgSrc, name: name });
        }
      });

      // Parse directory flag and include the images
      const directoryFlag = tile.document.getFlag('token-variants', 'directory');
      if (directoryFlag) {
        let dirFlagImages;
        try {
          let path = directoryFlag.path;
          let source = directoryFlag.source;
          let bucket = '';
          if (source.startsWith('s3:')) {
            bucket = source.substring(3, source.length);
            source = 's3';
          }
          const content = await FilePicker.browse(source, path, {
            type: 'imagevideo',
            bucket,
          });
          dirFlagImages = content.files;
        } catch (err) {
          dirFlagImages = [];
        }
        dirFlagImages.forEach((f) => {
          if (isImage(f) || isVideo(f)) pushImage({ path: f, name: getFileName(f) });
        });
      }
    }

    // Perform the search if needed
    const search = searchText ?? tile.document.getFlag('token-variants', 'tileName');
    const noSearch = !search || (!searchText && worldHudSettings.displayOnlySharedImages);
    let artSearch = noSearch
      ? null
      : await doImageSearch(search, {
          searchType: SEARCH_TYPE.TILE,
          searchOptions: { keywordSearch: worldHudSettings.includeKeywords },
        });

    if (artSearch) {
      artSearch.forEach((results) => {
        images.push(...results);
      });
    }
  } else {
    images = fp_files.map((f) => {
      return { path: f, name: getFileName(f) };
    });
  }

  // Retrieving the possibly custom name attached as a flag to the token
  let tileImageName = tile.document.getFlag('token-variants', 'name');
  if (!tileImageName) {
    tileImageName = getFileName(tile.document.texture.src);
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
      used: imageObj.path === tile.document.texture.src && imageObj.name === tileImageName,
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

  const sideSelect = $(
    await renderTemplate('modules/token-variants/templates/sideSelect.html', {
      imagesParsed,
      imageDisplay,
      imageOpacity,
      autoplay: !TVA_CONFIG.playVideoOnHover,
    })
  );

  // Activate listeners
  sideSelect.find('video').hover(
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
  sideSelect.find('.token-variants-button-select').click((event) => _onImageClick(event, tile));

  if (FULL_ACCESS) {
    sideSelect
      .find('.token-variants-button-select')
      .on('contextmenu', (event) => _onImageRightClick(event, tile));
  }

  return sideSelect;
}

async function _onImageClick(event, tile) {
  event.preventDefault();
  event.stopPropagation();

  if (!tile) return;

  const imgButton = $(event.target).closest('.token-variants-button-select');
  const imgSrc = imgButton.attr('data-name');
  const name = imgButton.attr('data-filename');
  if (imgSrc) {
    canvas.tiles.hud.clear();
    await tile.document.update({ img: imgSrc });
    try {
      await tile.document.setFlag('token-variants', 'name', name);
    } catch (e) {}
  }
}

async function _onImageRightClick(event, tile) {
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

async function _onImageSearchKeyUp(event, tile) {
  if (event.key === 'Enter' || event.keyCode === 13) {
    event.preventDefault();
    if (event.target.value.length >= 3) {
      const button = $(event.target).closest('.control-icon');
      button.find('.token-variants-wrap').remove();
      const sideSelect = await renderSideSelect(tile, event.target.value);
      if (sideSelect) {
        sideSelect.addClass('active');
        button.append(sideSelect);
      }
    }
    return false;
  }
}

function genTitleAndStyle(mappings, imgSrc, name) {
  let title = TVA_CONFIG.worldHud.showFullPath ? imgSrc : name;
  let style = '';
  let offset = 2;
  for (const [userId, img] of Object.entries(mappings)) {
    if (img === imgSrc) {
      const user = game.users.get(userId);
      if (!user) continue;
      if (style.length === 0) {
        style = `inset 0 0 0 ${offset}px ${user.color}`;
      } else {
        style += `, inset 0 0 0 ${offset}px ${user.color}`;
      }
      offset += 2;
      title += `\nDisplayed to: ${user.name}`;
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
            canvas.tiles.hud.clear();
            tile.document.setFlag('token-variants', 'tileName', name);
          }
        },
      },
    },
  }).render(true);
}
