import {
  getFileName,
  isImage,
  isVideo,
  SEARCH_TYPE,
} from '../scripts/utils.js';
import TokenCustomConfig from './tokenCustomConfig.js';

// not call if still caching
export async function renderHud(
  hud,
  html,
  token,
  searchText,
  doImageSearch,
  updateTokenImage,
  updateActorImage
) {
  const hudSettings = game.settings.get('token-variants', 'hudSettings');

  if (!hudSettings.enableSideMenu) return;

  const tokenActor = game.actors.get(token.actorId);
  const disableIfTHW = game.settings.get(
    'token-variants',
    'disableSideMenuIfTHW'
  );
  if (disableIfTHW && game.modules.get('token-hud-wildcard')?.active) {
    if (tokenActor && tokenActor.data.token.randomImg) return;
  }

  const search = searchText ? searchText : token.name;
  if (!search || search.length < 3) return;

  const userHasConfigRights =
    game.user &&
    game.user.can('FILES_BROWSE') &&
    game.user.can('TOKEN_CONFIGURE');
  const sharedOnly = game.settings.get(
    'token-variants',
    'displayOnlySharedImages'
  );

  let artSearch =
    !searchText && sharedOnly
      ? null
      : await doImageSearch(search, {
          searchType: SEARCH_TYPE.TOKEN,
          ignoreKeywords: true,
        });
  let images = artSearch ? artSearch.get(search) : new Map();

  let actorVariants = new Map();

  if (tokenActor) {
    actorVariants = tokenActor.getFlag('token-variants', 'variants') || [];

    // To maintain compatibility with previous versions
    if (!(actorVariants instanceof Array)) {
      actorVariants = [];
    } else if (
      actorVariants.length != 0 &&
      !(actorVariants[0] instanceof Object)
    ) {
      actorVariants.forEach((src, i) => {
        actorVariants[i] = { imgSrc: src, names: [getFileName(src)] };
      });
    }
    // end of compatibility code

    if (!searchText) {

      const mergeImages = function (imgArr) {
        imgArr.forEach((variant) => {
          for (let name of variant.names) {
            if (images.has(variant.imgSrc)) {
              if (!images.get(variant.imgSrc).includes(name))
                images.get(variant.imgSrc).push(name);
            } else {
              images.set(variant.imgSrc, [name]);
            }
          }
        });
      };
      
      // Merge images found through search, with variants shared through 'variant' flag
      mergeImages(actorVariants);

      // Merge wildcard images
      if(hudSettings.includeWildcard){
        const wildcardImages = (await tokenActor.getTokenImages()).map(
          (variant) => {
            return { imgSrc: variant, names: [getFileName(variant)] };
          }
        );
        mergeImages(wildcardImages);
      }
    }
  }

  if (
    !hudSettings.alwaysShowButton &&
    images.size == 0 &&
    actorVariants.length == 0
  )
    return;

  // Retrieving the possibly custom name attached as a flag to the token
  let tokenImageName = '';
  if (token.flags['token-variants'] && token.flags['token-variants']['name']) {
    tokenImageName = token.flags['token-variants']['name'];
  } else {
    tokenImageName = getFileName(token.img);
  }

  let imagesParsed = [];
  const tokenConfigs = (
    game.settings.get('token-variants', 'tokenConfigs') || []
  ).flat();
  images.forEach((names, tokenSrc) => {
    const img = isImage(tokenSrc);
    const vid = isVideo(tokenSrc);
    for (let name of names) {
      const hasConfig = Boolean(
        tokenConfigs.find(
          (config) => config.tvImgSrc == tokenSrc && config.tvImgName == name
        )
      );
      let shared = false;
      if (userHasConfigRights) {
        actorVariants.forEach((variant) => {
          if (variant.imgSrc === tokenSrc && variant.names.includes(name)) {
            shared = true;
          }
        });
      }

      imagesParsed.push({
        route: tokenSrc,
        name: name,
        used: tokenSrc === token.img && name === tokenImageName,
        img,
        vid,
        type: img || vid,
        shared: shared,
        hasConfig: hasConfig,
      });
    }
  });

  // Render

  const imageDisplay = hudSettings.displayAsImage;
  const imageOpacity = hudSettings.imageOpacity / 100;

  const sideSelect = await renderTemplate(
    'modules/token-variants/templates/sideSelect.html',
    { imagesParsed, imageDisplay, imageOpacity }
  );

  let divR = html.find('div.right').append(sideSelect);

  // Activate listeners
  divR.find('#token-variants-side-button').click(_onSideButtonClick);
  divR.click(_deactiveTokenVariantsSideSelector);
  divR
    .find('.token-variants-button-select')
    .click((event) =>
      _onImageClick(event, token._id, updateTokenImage, updateActorImage)
    );
  divR
    .find('.token-variants-side-search')
    .on('keyup', (event) =>
      _onImageSearchKeyUp(
        event,
        hud,
        html,
        token,
        doImageSearch,
        updateTokenImage,
        updateActorImage
      )
    );
  if (userHasConfigRights) {
    divR
      .find('#token-variants-side-button')
      .on('contextmenu', _onSideButtonRightClick);
    divR
      .find('.token-variants-button-select')
      .on('contextmenu', (event) => _onImageRightClick(event, token._id));
  }

  // If renderHud is being called from text box search the side menu should be enabled by default
  if (searchText) {
    divR.find('#token-variants-side-button').parent().addClass('active');
    divR.find('.token-variants-wrap').addClass('active');
  }
}

function _onSideButtonClick(event) {
  // De-activate 'Status Effects'
  const is080 = !isNewerVersion('0.8.0', game.version ?? game.data.version);
  const variantsControlIcon = $(event.target.parentElement);
  variantsControlIcon
    .closest('div.right')
    .find(
      is080
        ? '.control-icon[data-action="effects"]'
        : 'div.control-icon.effects'
    )
    .removeClass('active');
  variantsControlIcon
    .closest('div.right')
    .find('.status-effects')
    .removeClass('active');

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
  const sideSearch = $(event.target)
    .closest('div.control-icon')
    .find('.token-variants-side-search');
  const buttons = $(event.target)
    .closest('div.control-icon')
    .find('.token-variants-button-select');
  if (sideSearch.hasClass('active')) {
    sideSearch.removeClass('active');
    buttons.removeClass('hide');
  } else {
    sideSearch.addClass('active');
    buttons.addClass('hide');
  }
}

function _deactiveTokenVariantsSideSelector(event) {
  const controlIcon = $(event.target).closest('.control-icon');
  const dataAction = controlIcon.attr('data-action');

  switch (dataAction) {
    case 'effects':
      break; // Effects button
    case 'thwildcard-selector':
      break; // Token HUD Wildcard module button
    default:
      const is080 = !isNewerVersion('0.8.0', game.version ?? game.data.version);
      if (is080 && controlIcon.hasClass('effects')) break;
      return;
  }

  $(event.target)
    .closest('div.right')
    .find('.control-icon[data-action="token-variants-side-selector"]')
    .removeClass('active');
  $(event.target)
    .closest('div.right')
    .find('.token-variants-wrap')
    .removeClass('active');
}

async function _onImageClick(
  event,
  tokenId,
  updateTokenImage,
  updateActorImage
) {
  event.preventDefault();
  event.stopPropagation();

  let token = canvas.tokens.controlled.find((t) => t.data._id === tokenId);
  if (!token) return;
  else {
    token = token.document ?? token;
  }

  const hudSettings = game.settings.get('token-variants', 'hudSettings');
  const name = event.target.dataset.filename;
  const imgSrc = event.target.dataset.name;

  let shiftKeyDown;
  if (isNewerVersion(game.version ?? game.data.version, '0.8.9')) {
    shiftKeyDown =
      game.keyboard.downKeys.has('ShiftLeft') ||
      game.keyboard.downKeys.has('ShiftRight');
  } else {
    shiftKeyDown = keyboard.isDown('Shift');
  }

  if (shiftKeyDown) {
    const toggleCog = (saved) => {
      const cog = $(event.target).parent().find('.fa-cog');
      if (saved) {
        cog.addClass('active');
      } else {
        cog.removeClass('active');
      }
    };
    new TokenCustomConfig(token, {}, imgSrc, name, toggleCog).render(true);
  } else if (token.data.img === imgSrc) {
    let tokenImageName = token.getFlag('token-variants', 'name');
    if (!tokenImageName) tokenImageName = getFileName(token.data.img);
    if (tokenImageName !== name) {
      await updateTokenImage(imgSrc, { token: token, imgName: name });
      if (token.actor && hudSettings.updateActorImage) {
        updateActorImage(token.actor, imgSrc, {
          updateActorOnly: true,
          imgName: name,
        });
      }
    }
  } else {
    await updateTokenImage(imgSrc, { token: token, imgName: name });
    if (token.actor && hudSettings.updateActorImage) {
      updateActorImage(token.actor, imgSrc, {
        updateActorOnly: true,
        imgName: name,
      });
    }
  }
}

function _onImageRightClick(event, tokenId) {
  event.preventDefault();
  event.stopPropagation();

  let token = canvas.tokens.controlled.find((t) => t.data._id === tokenId);
  if (!token) return;
  else {
    token = token.document ?? token;
  }

  const imgSrc = event.target.dataset.name;
  const name = event.target.dataset.filename;

  if (token.actor) {
    let tokenActor = game.actors.get(token.actor.id);
    let variants = tokenActor.getFlag('token-variants', 'variants') || [];

    // To maintain compatibility with previous versions
    if (!(variants instanceof Array)) {
      variants = [];
    } else if (variants.length != 0 && !(variants[0] instanceof Object)) {
      variants.forEach((src, i) => {
        variants[i] = { imgSrc: src, names: [getFileName(src)] };
      });
    }
    // end of compatibility code

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

    // Set shared variants as an actor flag
    tokenActor.unsetFlag('token-variants', 'variants');
    if (variants.length > 0) {
      tokenActor.setFlag('token-variants', 'variants', variants);
    }
    $(event.target).parent().find('.fa-share').toggleClass('active'); // Display green arrow
  }
}

function _onImageSearchKeyUp(
  event,
  hud,
  html,
  tokenData,
  doImageSearch,
  updateTokenImage,
  updateActorImage
) {
  event.preventDefault();
  event.stopPropagation();
  if (event.key === 'Enter' || event.keyCode === 13) {
    if (event.target.value.length >= 3) {
      $(event.target)
        .closest('.control-icon[data-action="token-variants-side-selector"]')
        .remove();
      html
        .find('.control-icon[data-action="token-variants-side-selector"]')
        .remove();
      renderHud(
        hud,
        html,
        tokenData,
        event.target.value,
        doImageSearch,
        updateTokenImage,
        updateActorImage
      );
    }
  }
}
