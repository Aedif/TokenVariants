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
import TVAActiveEffectConfig from './activeEffectConfig.js';
import ActiveEffectConfigList from './activeEffectConfigList.js';
import { doImageSearch, findImagesFuzzy } from '../token-variants.mjs';
import { TVA_CONFIG } from '../scripts/settings.js';
import UserList from './userList.js';
import TokenFlags from './tokenFlags.js';
import { getData, getTokenImg } from '../scripts/compatibility.js';

// not call if still caching
export async function renderHud(hud, html, token, searchText = '', fp_files = null) {
  const hudSettings = TVA_CONFIG.hud;
  const worldHudSettings = TVA_CONFIG.worldHud;
  const FULL_ACCESS = TVA_CONFIG.permissions.hudFullAccess[game.user.role];
  const PARTIAL_ACCESS = TVA_CONFIG.permissions.hud[game.user.role];

  if (
    TVA_CONFIG.permissions.statusConfig[game.user.role] &&
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
          new TVAActiveEffectConfig(
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
          new TVAActiveEffectConfig(
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
          new TVAActiveEffectConfig(
            token,
            event.target.getAttribute('src'),
            event.target.getAttribute(effectNameAttr)
          ).render(true);
        }
      });
  }

  if (!hudSettings.enableSideMenu || (!PARTIAL_ACCESS && !FULL_ACCESS)) return;

  const tokenActor = game.actors.get(token.actorId);
  if (worldHudSettings.disableIfTHWEnabled && game.modules.get('token-hud-wildcard')?.active) {
    if (tokenActor && tokenActor.data.token.randomImg) return;
  }

  let images = [];
  let actorVariants = [];
  if (!fp_files) {
    const search = searchText ? searchText : token.name;
    if (!search || search.length < 3) return;

    const noSearch = !searchText && (worldHudSettings.displayOnlySharedImages || !FULL_ACCESS);

    let artSearch = noSearch
      ? null
      : await doImageSearch(search, {
          searchType: SEARCH_TYPE.TOKEN,
          searchOptions: { keywordSearch: worldHudSettings.includeKeywords },
        });

    // Merge full search, and keywords into a single array
    if (artSearch) {
      artSearch.forEach((results) => {
        images.push(...results);
      });
    }

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
        if (worldHudSettings.includeWildcard && !worldHudSettings.displayOnlySharedImages) {
          const protoImg = tokenActor.prototypeToken
            ? tokenActor.prototypeToken.texture.src
            : tokenActor.data.token.img;
          if (protoImg.includes('*') || protoImg.includes('{') || protoImg.includes('}')) {
            // Modified version of Actor.getTokenImages()
            const getTokenImages = async () => {
              if (tokenActor._tokenImages) return tokenActor._tokenImages;

              let source = 'data';
              let pattern = tokenActor.data.token.img;
              const browseOptions = { wildcard: true };

              // Support non-user sources
              if (/\.s3\./.test(pattern)) {
                source = 's3';
                const { bucket, keyPrefix } = FilePicker.parseS3URL(pattern);
                if (bucket) {
                  browseOptions.bucket = bucket;
                  pattern = keyPrefix;
                }
              } else if (pattern.startsWith('icons/')) source = 'public';

              // Retrieve wildcard content
              try {
                const content = await FilePicker.browse(source, pattern, browseOptions);
                tokenActor._tokenImages = content.files;
              } catch (err) {
                tokenActor._tokenImages = [];
              }
              return tokenActor._tokenImages;
            };

            const wildcardImages = (await getTokenImages())
              .filter((img) => !img.includes('*') && (isImage(img) || isVideo(img)))
              .map((variant) => {
                return { imgSrc: variant, names: [getFileName(variant)] };
              });
            mergeImages(wildcardImages);
          }
        }
      }
    }
  } else {
    images = fp_files.map((f) => {
      return { path: f, name: getFileName(f) };
    });
  }

  // If no images have been found check if the HUD button should be displayed regardless
  if (!images.length && !actorVariants.length) {
    if (!(FULL_ACCESS && hudSettings.alwaysShowButton)) return;
  }

  // Retrieving the possibly custom name attached as a flag to the token
  let tokenImageName = '';
  if (token.flags['token-variants'] && token.flags['token-variants']['name']) {
    tokenImageName = token.flags['token-variants']['name'];
  } else {
    tokenImageName = getFileName(getTokenImg(token));
  }

  let imagesParsed = [];
  const tokenConfigs = (TVA_CONFIG.tokenConfigs || []).flat();
  const tkn = canvas.tokens.get(token._id);
  const userMappings = tkn.document.getFlag('token-variants', 'userMappings') || {};

  for (const imageObj of images) {
    const img = isImage(imageObj.path);
    const vid = isVideo(imageObj.path);

    const hasConfig = Boolean(
      tokenConfigs.find(
        (config) => config.tvImgSrc === imageObj.path && config.tvImgName === imageObj.name
      )
    );
    let shared = false;
    if (TVA_CONFIG.permissions.hudFullAccess[game.user.role]) {
      actorVariants.forEach((variant) => {
        if (variant.imgSrc === imageObj.path && variant.names.includes(imageObj.name)) {
          shared = true;
        }
      });
    }

    const [title, style] = genTitleAndStyle(userMappings, imageObj.path, imageObj.name);

    imagesParsed.push({
      route: imageObj.path,
      name: imageObj.name,
      used: imageObj.path === getTokenImg(token) && imageObj.name === tokenImageName,
      img,
      vid,
      unknownType: !img && !vid,
      shared: shared,
      hasConfig: hasConfig,
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
    tokenHud: true,
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
  divR.find('#token-variants-side-button').click((event) => _onSideButtonClick(event, token._id));
  divR.click(_deactiveTokenVariantsSideSelector);
  divR.find('.token-variants-button-select').click((event) => _onImageClick(event, token._id));
  const contextMenu = divR.find('.token-variants-context-menu');
  contextMenu
    .find('.token-variants-side-search')
    .on('keyup', (event) => _onImageSearchKeyUp(event, hud, html, token));
  contextMenu.find('.flags').click(() => {
    const tkn = canvas.tokens.get(token._id);
    if (tkn) {
      new TokenFlags(tkn).render(true);
    }
  });
  contextMenu.find('.file-picker').click((event) => {
    new FilePicker({
      type: 'folder',
      callback: (path, fp) => {
        let files = fp.result.files.filter((f) => isImage(f) || isVideo(f));
        if (files.length) {
          $(event.target)
            .closest('.control-icon[data-action="token-variants-side-selector"]')
            .remove();
          html.find('.control-icon[data-action="token-variants-side-selector"]').remove();
          renderHud(hud, html, token, '', files);
        }
      },
    }).render(true);
  });
  if (FULL_ACCESS) {
    divR.find('#token-variants-side-button').on('contextmenu', _onSideButtonRightClick);
    divR
      .find('.token-variants-button-select')
      .on('contextmenu', (event) => _onImageRightClick(event, token._id));
  }

  // If renderHud is being called from text box or FilePicker search the side menu should be enabled by default
  if (searchText || fp_files) {
    divR.find('#token-variants-side-button').parent().addClass('active');
    divR.find('.token-variants-wrap').addClass('active');
  }
}

function _onSideButtonClick(event, tokenId) {
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

  let token = canvas.tokens.controlled.find((t) => getData(t)._id === tokenId);
  if (!token) return;

  const worldHudSettings = TVA_CONFIG.worldHud;

  const imgButton = $(event.target).closest('.token-variants-button-select');
  const imgSrc = imgButton.attr('data-name');
  const name = imgButton.attr('data-filename');

  if (!imgSrc || !name) return;

  if (keyPressed('config') && game.user.isGM) {
    const toggleCog = (saved) => {
      const cog = imgButton.find('.fa-cog');
      if (saved) {
        cog.addClass('active');
      } else {
        cog.removeClass('active');
      }
    };
    new TokenCustomConfig(token, {}, imgSrc, name, toggleCog).render(true);
  } else if (getData(token).img === imgSrc) {
    let tokenImageName = token.document.getFlag('token-variants', 'name');
    if (!tokenImageName) tokenImageName = getFileName(token.data.img);
    if (tokenImageName !== name) {
      await updateTokenImage(imgSrc, { token: token, imgName: name });
      if (token.actor && worldHudSettings.updateActorImage) {
        if (worldHudSettings.useNameSimilarity) {
          updateActorWithSimilarName(imgSrc, name, token.actor);
        } else {
          updateActorImage(token.actor, imgSrc, { imgName: name });
        }
      }
    }
  } else {
    await updateTokenImage(imgSrc, { token: token, imgName: name });
    if (token.actor && worldHudSettings.updateActorImage) {
      if (worldHudSettings.useNameSimilarity) {
        updateActorWithSimilarName(imgSrc, name, token.actor);
      } else {
        updateActorImage(token.actor, imgSrc, { imgName: name });
      }
    }
  }
}

async function _onImageRightClick(event, tokenId) {
  let token = canvas.tokens.controlled.find((t) => getData(t)._id === tokenId);
  if (!token) return;

  const imgButton = $(event.target).closest('.token-variants-button-select');
  const imgSrc = imgButton.attr('data-name');
  const name = imgButton.attr('data-filename');

  if (!imgSrc || !name) return;

  if (keyPressed('config') && game.user.isGM) {
    const regenStyle = (token, img) => {
      const mappings = token.document.getFlag('token-variants', 'userMappings') || {};
      const name = imgButton.attr('data-filename');
      const [title, style] = genTitleAndStyle(mappings, img, name);
      imgButton
        .closest('.token-variants-wrap')
        .find(`.token-variants-button-select[data-name='${img}']`)
        .css('box-shadow', style)
        .prop('title', title);
    };
    new UserList(token, imgSrc, regenStyle).render(true);
  } else if (token.actor) {
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

function genTitleAndStyle(mappings, imgSrc, name) {
  let title = TVA_CONFIG.worldHud.showFullPath ? imgSrc : name;
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

async function updateActorWithSimilarName(imgSrc, imgName, actor) {
  const results = await findImagesFuzzy(
    imgName,
    SEARCH_TYPE.PORTRAIT,
    {
      fuzzyThreshold: 0.4,
      fuzzyLimit: 50,
    },
    true
  );

  if (results && results.length !== 0) {
    updateActorImage(actor, results[0].path, { imgName: results[0].name });
  } else {
    updateActorImage(actor, imgSrc, { imgName: imgName });
  }
}
