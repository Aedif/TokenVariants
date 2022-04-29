import {
  getFileName,
  isImage,
  isVideo,
  SEARCH_TYPE,
  keyPressed,
  updateActorImage,
  updateTokenImage,
} from '../scripts/utils.js';
import TokenCustomConfig from './tokenCustomConfig.js';
import ActiveEffectConfig from './activeEffectConfig.js';
import ActiveEffectConfigList from './activeEffectConfigList.js';
import { doImageSearch } from '../token-variants.mjs';

// not call if still caching
export async function renderHud(hud, html, token, searchText = '') {
  const hudSettings = game.settings.get('token-variants', 'hudSettings');
  const worldHudSettings = game.settings.get('token-variants', 'worldHudSettings');

  if (
    game.settings.get('token-variants', 'enableStatusConfig') &&
    token.actorId &&
    game.actors.get(token.actorId)
  ) {
    $('.control-icon[data-action="effects"]')
      .find('img:first')
      .click((event) => {
        event.preventDefault();
        if (keyPressed('config')) {
          event.stopPropagation();
          new ActiveEffectConfigList(token).render(true);
        }
      });

    $('.control-icon[data-action="visibility"]')
      .find('img')
      .click((event) => {
        event.preventDefault();
        if (keyPressed('config')) {
          event.stopPropagation();
          new ActiveEffectConfig(
            token,
            event.target.getAttribute('src'),
            'token-variants-visibility'
          ).render(true);
        }
      });

    $('.control-icon[data-action="combat"]')
      .find('img')
      .click((event) => {
        event.preventDefault();
        if (keyPressed('config')) {
          event.stopPropagation();
          new ActiveEffectConfig(
            token,
            event.target.getAttribute('src'),
            'token-variants-combat'
          ).render(true);
        }
      });

    $('.status-effects')
      .find('img')
      .click((event) => {
        event.preventDefault();
        if (keyPressed('config')) {
          event.stopPropagation();
          let effectNameAttr = 'title';
          if (game.system.id === 'pf2e') effectNameAttr = 'data-condition';
          new ActiveEffectConfig(
            token,
            event.target.getAttribute('src'),
            event.target.getAttribute(effectNameAttr)
          ).render(true);
        }
      });
  }

  if (!hudSettings.enableSideMenu) return;

  const tokenActor = game.actors.get(token.actorId);
  if (worldHudSettings.disableIfTHWEnabled && game.modules.get('token-hud-wildcard')?.active) {
    if (tokenActor && tokenActor.data.token.randomImg) return;
  }

  const search = searchText ? searchText : token.name;
  if (!search || search.length < 3) return;

  const userHasConfigRights =
    game.user && game.user.can('FILES_BROWSE') && game.user.can('TOKEN_CONFIGURE');

  let artSearch =
    !searchText && worldHudSettings.displayOnlySharedImages
      ? null
      : await doImageSearch(search, {
          searchType: SEARCH_TYPE.TOKEN,
          ignoreKeywords: !worldHudSettings.includeKeywords,
        });

  // Merge full search, and keywords into a single array
  let images = [];
  if (artSearch) {
    artSearch.forEach((results) => {
      images.push(...results);
    });
  }

  let actorVariants = new Map();

  if (tokenActor) {
    actorVariants = tokenActor.getFlag('token-variants', 'variants') || [];

    // To maintain compatibility with previous versions
    if (!(actorVariants instanceof Array)) {
      actorVariants = [];
    } else if (actorVariants.length != 0 && !(actorVariants[0] instanceof Object)) {
      actorVariants.forEach((src, i) => {
        actorVariants[i] = { imgSrc: src, names: [getFileName(src)] };
      });
    }
    // end of compatibility code

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
      mergeImages(actorVariants);

      // Merge wildcard images
      if (hudSettings.includeWildcard && !worldHudSettings.displayOnlySharedImages) {
        const wildcardImages = (await tokenActor.getTokenImages()).map((variant) => {
          return { imgSrc: variant, names: [getFileName(variant)] };
        });
        mergeImages(wildcardImages);
      }
    }
  }

  if (!hudSettings.alwaysShowButton && !images.size && !actorVariants.length) return;

  // Retrieving the possibly custom name attached as a flag to the token
  let tokenImageName = '';
  if (token.flags['token-variants'] && token.flags['token-variants']['name']) {
    tokenImageName = token.flags['token-variants']['name'];
  } else {
    tokenImageName = getFileName(token.img);
  }

  let imagesParsed = [];
  const tokenConfigs = (game.settings.get('token-variants', 'tokenConfigs') || []).flat();

  for (const imageObj of images) {
    const img = isImage(imageObj.path);
    const vid = isVideo(imageObj.path);

    const hasConfig = Boolean(
      tokenConfigs.find(
        (config) => config.tvImgSrc === imageObj.path && config.tvImgName === imageObj.name
      )
    );
    let shared = false;
    if (userHasConfigRights) {
      actorVariants.forEach((variant) => {
        if (variant.imgSrc === imageObj.path && variant.names.includes(imageObj.name)) {
          shared = true;
        }
      });
    }

    imagesParsed.push({
      route: imageObj.path,
      name: imageObj.name,
      used: imageObj.path === token.img && imageObj.name === tokenImageName,
      img,
      vid,
      shared: shared,
      hasConfig: hasConfig,
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
  });

  let divR = html.find('div.right').append(sideSelect);

  // Activate listeners
  divR.find('#token-variants-side-button').click(_onSideButtonClick);
  divR.click(_deactiveTokenVariantsSideSelector);
  divR.find('.token-variants-button-select').click((event) => _onImageClick(event, token._id));
  divR
    .find('.token-variants-side-search')
    .on('keyup', (event) => _onImageSearchKeyUp(event, hud, html, token));
  if (userHasConfigRights) {
    divR.find('#token-variants-side-button').on('contextmenu', _onSideButtonRightClick);
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
  const sideSearch = $(event.target)
    .closest('div.control-icon')
    .find('.token-variants-side-search');
  const buttons = $(event.target).closest('div.control-icon').find('.token-variants-button-select');
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
  $(event.target).closest('div.right').find('.token-variants-wrap').removeClass('active');
}

async function _onImageClick(event, tokenId) {
  event.preventDefault();
  event.stopPropagation();

  let token = canvas.tokens.controlled.find((t) => t.data._id === tokenId);
  if (!token) return;
  else {
    token = token.document ?? token;
  }

  const hudSettings = game.settings.get('token-variants', 'hudSettings');

  const imgButton = $(event.target).closest('.token-variants-button-select');
  const imgSrc = imgButton.attr('data-name');
  const name = imgButton.attr('data-filename');

  if (!imgSrc || !name) return;

  if (keyPressed('config')) {
    const toggleCog = (saved) => {
      const cog = imgButton.find('.fa-cog');
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
        updateActorImage(token.actor, imgSrc, { imgName: name });
      }
    }
  } else {
    await updateTokenImage(imgSrc, { token: token, imgName: name });
    if (token.actor && hudSettings.updateActorImage) {
      updateActorImage(token.actor, imgSrc, { imgName: name });
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

  const imgButton = $(event.target).closest('.token-variants-button-select');
  const imgSrc = imgButton.attr('data-name');
  const name = imgButton.attr('data-filename');

  if (!imgSrc || !name) return;

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
    imgButton.find('.fa-share').toggleClass('active'); // Display green arrow
  }
}

function _onImageSearchKeyUp(event, hud, html, tokenData) {
  event.preventDefault();
  event.stopPropagation();
  if (event.key === 'Enter' || event.keyCode === 13) {
    if (event.target.value.length >= 3) {
      $(event.target).closest('.control-icon[data-action="token-variants-side-selector"]').remove();
      html.find('.control-icon[data-action="token-variants-side-selector"]').remove();
      renderHud(hud, html, tokenData, event.target.value);
    }
  }
}
