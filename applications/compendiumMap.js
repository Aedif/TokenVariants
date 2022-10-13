import { showArtSelect, doImageSearch, cacheImages } from '../token-variants.mjs';
import {
  BASE_IMAGE_CATEGORIES,
  SEARCH_TYPE,
  updateActorImage,
  updateTokenImage,
  userRequiresImageCache,
} from '../scripts/utils.js';
import { addToQueue, ArtSelect, renderFromQueue } from './artSelect.js';
import { getSearchOptions, TVA_CONFIG, updateSettings } from '../scripts/settings.js';
import ConfigureSettings from './configureSettings.js';
import MissingImageConfig from './missingImageConfig.js';

async function autoApply(actor, image1, image2, formData, typeOverride) {
  let portraitFound = formData.ignorePortrait;
  let tokenFound = formData.ignoreToken;

  if (formData.diffImages) {
    let results = [];

    if (!formData.ignorePortrait) {
      results = await doImageSearch(actor.name, {
        searchType: typeOverride ?? SEARCH_TYPE.PORTRAIT,
        simpleResults: true,
        searchOptions: formData.searchOptions,
      });

      if ((results ?? []).length != 0) {
        portraitFound = true;
        await updateActorImage(actor, results[0], false, formData.compendium);
      }
    }

    if (!formData.ignoreToken) {
      results = await doImageSearch(actor.prototypeToken.name, {
        searchType: SEARCH_TYPE.TOKEN,
        simpleResults: true,
        searchOptions: formData.searchOptions,
      });

      if ((results ?? []).length != 0) {
        tokenFound = true;
        updateTokenImage(results[0], { actor: actor, pack: formData.compendium });
      }
    }
  } else {
    let results = await doImageSearch(actor.name, {
      searchType: typeOverride ?? SEARCH_TYPE.PORTRAIT_AND_TOKEN,
      simpleResults: true,
      searchOptions: formData.searchOptions,
    });

    if ((results ?? []).length != 0) {
      portraitFound = tokenFound = true;
      updateTokenImage(results[0], {
        actor: actor,
        actorUpdate: { img: results[0] },
        pack: formData.compendium,
      });
    }
  }

  if (!(tokenFound && portraitFound) && formData.autoDisplayArtSelect) {
    addToArtSelectQueue(actor, image1, image2, formData, typeOverride);
  }
}

function addToArtSelectQueue(actor, image1, image2, formData, typeOverride) {
  if (formData.diffImages) {
    if (!formData.ignorePortrait && !formData.ignoreToken) {
      addToQueue(actor.name, {
        searchType: typeOverride ?? SEARCH_TYPE.PORTRAIT,
        object: actor,
        preventClose: true,
        image1: image1,
        image2: image2,
        displayMode: ArtSelect.IMAGE_DISPLAY.PORTRAIT,
        searchOptions: formData.searchOptions,
        callback: async function (imgSrc, _) {
          await updateActorImage(actor, imgSrc);
          showArtSelect(actor.prototypeToken.name, {
            searchType: typeOverride ?? SEARCH_TYPE.TOKEN,
            object: actor,
            force: true,
            image1: imgSrc,
            image2: image2,
            displayMode: ArtSelect.IMAGE_DISPLAY.TOKEN,
            searchOptions: formData.searchOptions,
            callback: (imgSrc, name) =>
              updateTokenImage(imgSrc, {
                actor: actor,
                imgName: name,
              }),
          });
        },
      });
    } else if (formData.ignorePortrait) {
      addToQueue(actor.name, {
        searchType: typeOverride ?? SEARCH_TYPE.TOKEN,
        object: actor,
        image1: image1,
        image2: image2,
        displayMode: ArtSelect.IMAGE_DISPLAY.TOKEN,
        searchOptions: formData.searchOptions,
        callback: async function (imgSrc, name) {
          updateTokenImage(imgSrc, {
            actor: actor,
            imgName: name,
          });
        },
      });
    } else if (formData.ignoreToken) {
      addToQueue(actor.name, {
        searchType: typeOverride ?? SEARCH_TYPE.PORTRAIT,
        object: actor,
        image1: image1,
        image2: image2,
        displayMode: ArtSelect.IMAGE_DISPLAY.PORTRAIT,
        searchOptions: formData.searchOptions,
        callback: async function (imgSrc, name) {
          await updateActorImage(actor, imgSrc);
        },
      });
    }
  } else {
    addToQueue(actor.name, {
      searchType: typeOverride ?? SEARCH_TYPE.PORTRAIT_AND_TOKEN,
      object: actor,
      image1: image1,
      image2: image2,
      displayMode: ArtSelect.IMAGE_DISPLAY.PORTRAIT_TOKEN,
      searchOptions: formData.searchOptions,
      callback: async function (imgSrc, name) {
        await updateActorImage(actor, imgSrc);
        updateTokenImage(imgSrc, {
          actor: actor,
          imgName: name,
        });
      },
    });
  }
}

export default class CompendiumMapConfig extends FormApplication {
  constructor() {
    super({}, {});
    let searchOptions = deepClone(TVA_CONFIG.compendiumMapper.searchOptions);
    if (!searchOptions) {
      searchOptions = deepClone(getSearchOptions());
    }
    this.searchOptions = searchOptions;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-compendium-map-config',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/compendiumMap.html',
      resizable: false,
      minimizable: false,
      title: game.i18n.localize('token-variants.settings.compendium-mapper.Name'),
      width: 500,
    });
  }

  async getData(options) {
    let data = super.getData(options);
    data = mergeObject(data, TVA_CONFIG.compendiumMapper);

    const supportedPacks = ['Actor', 'Cards', 'Item', 'Macro', 'RollTable'];
    data.supportedPacks = supportedPacks.join(', ');

    const packs = [];
    game.packs.forEach((pack) => {
      if (!pack.locked && supportedPacks.includes(pack.documentName)) {
        packs.push({ title: pack.title, id: pack.collection, type: pack.documentName });
      }
    });
    data.compendiums = packs;
    data.compendium = TVA_CONFIG.compendiumMapper.compendium;

    data.categories = BASE_IMAGE_CATEGORIES.concat(TVA_CONFIG.customImageCategories);
    data.category = TVA_CONFIG.compendiumMapper.category;

    return data;
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
    html
      .find('.token-variants-override-category')
      .change(this._onCategoryOverride)
      .trigger('change');
    html.find('.token-variants-auto-apply').change(this._onAutoApply);
    html.find('.token-variants-diff-images').change(this._onDiffImages);
    html.find(`.token-variants-search-options`).on('click', this._onSearchOptions.bind(this));
    html.find(`.token-variants-missing-images`).on('click', this._onMissingImages.bind(this));

    $(html)
      .find('[name="compendium"]')
      .change(this._onCompendiumSelect.bind(this))
      .trigger('change');
  }

  async _onAutoApply(event) {
    $(event.target)
      .closest('form')
      .find('.token-variants-auto-art-select')
      .prop('disabled', !event.target.checked);
  }

  async _onCategoryOverride(event) {
    $(event.target)
      .closest('form')
      .find('.token-variants-category')
      .prop('disabled', !event.target.checked);
  }

  async _onDiffImages(event) {
    $(event.target)
      .closest('form')
      .find('.token-variants-tp-ignore')
      .prop('disabled', !event.target.checked);
  }

  async _onCompendiumSelect(event) {
    const compendium = game.packs.get($(event.target).val());
    if (compendium) {
      $(event.target)
        .closest('form')
        .find('.token-specific')
        .css('visibility', compendium.documentName === 'Actor' ? 'visible' : 'hidden');
    }
  }

  async _onSearchOptions(event) {
    new ConfigureSettings(this.searchOptions, {
      searchPaths: false,
      searchFilters: true,
      searchAlgorithm: true,
      randomizer: false,
      popup: false,
      permissions: false,
      worldHud: false,
      misc: false,
      activeEffects: false,
    }).render(true);
  }

  async _onMissingImages(event) {
    new MissingImageConfig().render(true);
  }

  async startMapping(formData) {
    if (formData.diffImages && formData.ignoreToken && formData.ignorePortrait) {
      return;
    }

    if (formData.cache || !userRequiresImageCache()) {
      await cacheImages();
    }

    const compendium = game.packs.get(formData.compendium);
    let missingImageList = TVA_CONFIG.compendiumMapper.missingImages
      .filter((mi) => mi.document === 'all' || mi.document === compendium.documentName)
      .map((mi) => mi.image);
    const typeOverride = formData.overrideCategory ? formData.category : null;
    let artSelectDisplayed = false;

    let processItem;
    if (compendium.documentName === 'Actor') {
      processItem = async function (item) {
        const actor = await compendium.getDocument(item._id);
        if (actor.name === '#[CF_tempEntity]') return; // Compendium Folders module's control entity

        let hasPortrait =
          actor.img !== CONST.DEFAULT_TOKEN && !missingImageList.includes(actor.img);
        let hasToken =
          actor.prototypeToken.texture.src !== CONST.DEFAULT_TOKEN &&
          !missingImageList.includes(actor.prototypeToken.texture.src);
        if (formData.syncImages && hasPortrait !== hasToken) {
          if (hasPortrait) {
            await updateTokenImage(actor.img, { actor: actor });
          } else {
            await updateActorImage(actor, actor.prototypeToken.texture.src);
          }
          hasPortrait = hasToken = true;
        }

        let includeThisActor = !(formData.missingOnly && hasPortrait) && !formData.ignorePortrait;
        let includeThisToken = !(formData.missingOnly && hasToken) && !formData.ignoreToken;

        const image1 = formData.showImages ? actor.img : '';
        const image2 = formData.showImages ? actor.prototypeToken.texture.src : '';

        if (includeThisActor || includeThisToken) {
          if (formData.autoApply) {
            await autoApply(actor, image1, image2, formData, typeOverride);
          } else {
            artSelectDisplayed = true;
            addToArtSelectQueue(actor, image1, image2, formData, typeOverride);
          }
        }
      };
    } else {
      processItem = async function (item) {
        const doc = await compendium.getDocument(item._id);
        if (doc.name === '#[CF_tempEntity]') return; // Compendium Folders module's control entity

        let defaultImg = '';
        if (doc.schema.fields.img || doc.schema.fields.texture) {
          defaultImg = (doc.schema.fields.img ?? doc.schema.fields.texture).initial();
        }
        const hasImage =
          doc.img != null && doc.img !== defaultImg && !missingImageList.includes(doc.img);

        let imageFound = false;
        if (formData.missingOnly && hasImage) return;
        if (formData.autoApply) {
          let results = await doImageSearch(doc.name, {
            searchType: typeOverride ?? compendium.documentName,
            simpleResults: true,
            searchOptions: formData.searchOptions,
          });

          if ((results ?? []).length != 0) {
            imageFound = true;
            await updateActorImage(doc, results[0], false, formData.compendium);
          }
        }

        if (!formData.autoApply || (formData.autoDisplayArtSelect && !imageFound)) {
          artSelectDisplayed = true;
          addToQueue(doc.name, {
            searchType: typeOverride ?? compendium.documentName,
            object: doc,
            image1: formData.showImages ? doc.img : '',
            displayMode: ArtSelect.IMAGE_DISPLAY.IMAGE,
            searchOptions: formData.searchOptions,
            callback: async function (imgSrc, name) {
              await updateActorImage(doc, imgSrc);
            },
          });
        }
      };
    }

    const allItems = [];
    compendium.index.forEach((k) => {
      allItems.push(k);
    });

    if (formData.autoApply) {
      const starterPromise = Promise.resolve(null);
      allItems
        .reduce((p, item) => p.then(() => processItem(item)), starterPromise)
        .then(() => renderFromQueue());
    } else {
      const tasks = allItems.map(processItem);
      Promise.all(tasks).then(() => {
        renderFromQueue();
        if (formData.missingOnly && !artSelectDisplayed) {
          ui.notifications.warn('Token Variant Art: No documents found containing missing images.');
        }
      });
    }
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    formData.searchOptions = this.searchOptions;
    updateSettings({ compendiumMapper: formData });
    if (formData.compendium) {
      this.startMapping(formData);
    }
  }
}
