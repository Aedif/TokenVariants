import { showArtSelect } from '../../token-variants.mjs';
import { doRandomSearch, doSyncSearch } from '../search.js';
import { FEATURE_CONTROL, TVA_CONFIG } from '../settings.js';
import { keyPressed, nameForgeRandomize, SEARCH_TYPE, updateActorImage, updateTokenImage } from '../utils.js';
import { registerHook, unregisterHook } from './hooks.js';

const feature_id = 'PopUpAndRandomize';

export function registerPopRandomizeHooks() {
  if (FEATURE_CONTROL[feature_id]) {
    registerHook(feature_id, 'createActor', _createActor);
    registerHook(feature_id, 'createToken', _createToken);
  } else {
    ['createActor', 'createToken'].forEach((name) => unregisterHook(feature_id, name));
  }
}

async function _createToken(token, options, userId) {
  if (userId && game.user.id != userId) return;

  // Check if random search is enabled and if so perform it
  const actorRandSettings = game.actors.get(token.actorId)?.getFlag('token-variants', 'randomizerSettings');
  const randSettings = mergeObject(TVA_CONFIG.randomizer, actorRandSettings ?? {}, {
    inplace: false,
    recursive: false,
  });

  let vDown = keyPressed('v');
  const flagTarget = token.actor ? game.actors.get(token.actor.id) : token.document ?? token;
  const popupFlag = flagTarget.getFlag('token-variants', 'popups');

  if ((vDown && randSettings.tokenCopyPaste) || (!vDown && randSettings.tokenCreate)) {
    let performRandomSearch = true;
    if (!actorRandSettings) {
      if (randSettings.representedActorDisable && token.actor) performRandomSearch = false;
      if (randSettings.linkedActorDisable && token.actorLink) performRandomSearch = false;
      if (_disableRandomSearchForType(randSettings, token.actor)) performRandomSearch = false;
    } else {
      performRandomSearch = Boolean(actorRandSettings);
    }

    if (performRandomSearch) {
      // Randomize Token Name if need be
      const randomName = await nameForgeRandomize(randSettings);
      if (randomName) {
        token.update({ name: randomName });
      }

      const img = await doRandomSearch(token.name, {
        searchType: SEARCH_TYPE.TOKEN,
        actor: token.actor,
        randomizerOptions: randSettings,
      });
      if (img) {
        await updateTokenImage(img[0], {
          token: token,
          actor: token.actor,
          imgName: img[1],
        });
      }

      if (randSettings.diffImages) {
        let imgPortrait;
        if (randSettings.syncImages) {
          if (!img) return;
          imgPortrait = await doSyncSearch(img[1], {
            searchType: SEARCH_TYPE.PORTRAIT,
          });
        } else {
          // Prevent searches via method intended purely for tokens
          if (!(randSettings.tokenName || randSettings.actorName)) randSettings.tokenName = true;
          randSettings.wildcard = false;
          randSettings.shared = false;
          imgPortrait = await doRandomSearch(token.name, {
            searchType: SEARCH_TYPE.PORTRAIT,
            actor: token.actor,
            randomizerOptions: randSettings,
          });
        }

        if (imgPortrait) {
          await updateActorImage(token.actor, imgPortrait[0]);
        }
      } else if (randSettings.tokenToPortrait) {
        if (!img) return;
        await updateActorImage(token.actor, img[0]);
      }
      return;
    }
    if (popupFlag == null && !randSettings.popupOnDisable) {
      return;
    }
  } else if (randSettings.tokenCreate || randSettings.tokenCopyPaste) {
    return;
  }

  // Check if pop-up is enabled and if so open it
  if (!TVA_CONFIG.permissions.popups[game.user.role]) {
    return;
  }

  let dirKeyDown = keyPressed('popupOverride');

  if (vDown && TVA_CONFIG.popup.disableAutoPopupOnTokenCopyPaste) {
    return;
  }

  if (!dirKeyDown || (dirKeyDown && vDown)) {
    if (TVA_CONFIG.popup.disableAutoPopupOnTokenCreate && !vDown) {
      return;
    } else if (popupFlag == null && _disablePopupForType(token.actor)) {
      return;
    } else if (popupFlag != null && !popupFlag) {
      return;
    }
  }

  showArtSelect(token.name, {
    callback: async function (imgSrc, imgName) {
      if (TVA_CONFIG.popup.twoPopups) {
        await updateActorImage(token.actor, imgSrc);
        _twoPopupPrompt(token.actor, imgSrc, imgName, token);
      } else {
        updateTokenImage(imgSrc, {
          actor: token.actor,
          imgName: imgName,
          token: token,
        });
      }
    },
    searchType: TVA_CONFIG.popup.twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.TOKEN,
    object: token,
    preventClose: TVA_CONFIG.popup.twoPopups && TVA_CONFIG.popup.twoPopupsNoDialog,
  });
}

async function _createActor(actor, options, userId) {
  if (userId && game.user.id != userId) return;

  // Check if random search is enabled and if so perform it
  const randSettings = TVA_CONFIG.randomizer;
  if (randSettings.actorCreate) {
    let performRandomSearch = true;
    if (randSettings.linkedActorDisable && actor.prototypeToken.actorLink) performRandomSearch = false;
    if (_disableRandomSearchForType(randSettings, actor)) performRandomSearch = false;
    if (performRandomSearch) {
      const img = await doRandomSearch(actor.name, {
        searchType: SEARCH_TYPE.PORTRAIT,
        actor: actor,
      });
      if (img) {
        await updateActorImage(actor, img[0]);
      }

      if (!img) return;

      if (randSettings.diffImages) {
        let imgToken;
        if (randSettings.syncImages) {
          imgToken = await doSyncSearch(img[1], { searchType: SEARCH_TYPE.TOKEN });
        } else {
          imgToken = await doRandomSearch(actor.name, {
            searchType: SEARCH_TYPE.TOKEN,
            actor: actor,
          });
        }

        if (imgToken) {
          await updateTokenImage(imgToken[0], { actor: actor, imgName: imgToken[1] });
        }
      }
      return;
    }
    if (!randSettings.popupOnDisable) {
      return;
    }
  }

  // Check if pop-up is enabled and if so open it
  if (!TVA_CONFIG.permissions.popups[game.user.role]) {
    return;
  }

  if (TVA_CONFIG.popup.disableAutoPopupOnActorCreate && !keyPressed('popupOverride')) {
    return;
  } else if (_disablePopupForType(actor)) {
    return;
  }

  showArtSelect(actor.name, {
    callback: async function (imgSrc, name) {
      const actTokens = actor.getActiveTokens();
      const token = actTokens.length === 1 ? actTokens[0] : null;
      await updateActorImage(actor, imgSrc);
      if (TVA_CONFIG.popup.twoPopups) _twoPopupPrompt(actor, imgSrc, name, token);
      else {
        updateTokenImage(imgSrc, {
          actor: actor,
          imgName: name,
          token: token,
        });
      }
    },
    searchType: TVA_CONFIG.popup.twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.PORTRAIT_AND_TOKEN,
    object: actor,
    preventClose: TVA_CONFIG.popup.twoPopups && TVA_CONFIG.popup.twoPopupsNoDialog,
  });
}

function _disableRandomSearchForType(randSettings, actor) {
  if (!actor) return false;
  return randSettings[`${actor.type}Disable`] ?? false;
}

function _disablePopupForType(actor) {
  if (!actor) return false;
  return TVA_CONFIG.popup[`${actor.type}Disable`] ?? false;
}

function _twoPopupPrompt(actor, imgSrc, imgName, token) {
  if (TVA_CONFIG.popup.twoPopups && TVA_CONFIG.popup.twoPopupsNoDialog) {
    showArtSelect((token ?? actor.prototypeToken).name, {
      callback: (imgSrc, name) =>
        updateTokenImage(imgSrc, {
          actor: actor,
          imgName: name,
          token: token,
        }),
      searchType: SEARCH_TYPE.TOKEN,
      object: token ? token : actor,
      force: true,
    });
  } else if (TVA_CONFIG.popup.twoPopups) {
    let d = new Dialog({
      title: 'Portrait -> Token',
      content: `<p>${game.i18n.localize('token-variants.windows.art-select.apply-same-art')}</p>`,
      buttons: {
        one: {
          icon: '<i class="fas fa-check"></i>',
          callback: () => {
            updateTokenImage(imgSrc, {
              actor: actor,
              imgName: imgName,
              token: token,
            });
            const artSelects = Object.values(ui.windows).filter((app) => app instanceof ArtSelect);
            for (const app of artSelects) {
              app.close();
            }
          },
        },
        two: {
          icon: '<i class="fas fa-times"></i>',
          callback: () => {
            showArtSelect((token ?? actor.prototypeToken).name, {
              callback: (imgSrc, name) =>
                updateTokenImage(imgSrc, {
                  actor: actor,
                  imgName: name,
                  token: token,
                }),
              searchType: SEARCH_TYPE.TOKEN,
              object: token ? token : actor,
              force: true,
            });
          },
        },
      },
      default: 'one',
    });
    d.render(true);
  }
}
