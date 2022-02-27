import { showArtSelect, updateTokenImage, doImageSearch } from '../token-variants.mjs';
import { SEARCH_TYPE, updateActorImage, getFileName } from '../scripts/utils.js';
import { addToQueue, renderFromQueue } from './artSelect.js';

async function autoApply(actor, diffImages, image1, image2, ignoreKeywords, dispArtSelect) {
  let portraitFound = false;
  let tokenFound = false;

  if (diffImages) {
    let results = await doImageSearch(actor.data.name, {
      searchType: SEARCH_TYPE.PORTRAIT,
      simpleResults: true,
      ignoreKeywords: ignoreKeywords,
    });

    if ((results ?? []).length != 0) {
      portraitFound = true;
      await updateActorImage(actor, results[0], {
        imgName: getFileName(results[0]),
      });
    }

    await doImageSearch(actor.data.token.name, {
      searchType: SEARCH_TYPE.TOKEN,
      simpleResults: true,
      ignoreKeywords: ignoreKeywords,
    });

    if ((results ?? []).length != 0) {
      tokenFound = true;
      updateTokenImage(results[0], {
        actor: actor,
        imgName: getFileName(results[0]),
      });
    }
  } else {
    let results = await doImageSearch(actor.data.name, {
      searchType: SEARCH_TYPE.BOTH,
      simpleResults: true,
      ignoreKeywords: ignoreKeywords,
    });

    if ((results ?? []).length != 0) {
      portraitFound = tokenFound = true;
      const imgSrc = results[0];
      const imgName = getFileName(imgSrc);
      await updateActorImage(actor, imgSrc, {
        imgName: imgName,
      });
      updateTokenImage(imgSrc, {
        actor: actor,
        imgName: imgName,
      });
    }
  }

  if (!(tokenFound && portraitFound) && dispArtSelect) {
    addToArtSelectQueue(actor, diffImages, image1, image2, ignoreKeywords);
  }
}

function addToArtSelectQueue(actor, diffImages, image1, image2, ignoreKeywords) {
  if (diffImages) {
    addToQueue(actor.data.name, {
      searchType: SEARCH_TYPE.PORTRAIT,
      object: actor,
      preventClose: true,
      image1: image1,
      image2: image2,
      ignoreKeywords: ignoreKeywords,
      callback: async function (imgSrc, name) {
        await updateActorImage(actor, imgSrc, {
          imgName: name,
        });
        showArtSelect(actor.data.token.name, {
          searchType: SEARCH_TYPE.TOKEN,
          object: actor,
          force: true,
          image1: imgSrc,
          image2: image2,
          ignoreKeywords: ignoreKeywords,
          callback: (imgSrc, name) =>
            updateTokenImage(imgSrc, {
              actor: actor,
              imgName: name,
            }),
        });
      },
    });
  } else {
    addToQueue(actor.data.name, {
      searchType: SEARCH_TYPE.BOTH,
      object: actor,
      image1: image1,
      image2: image2,
      ignoreKeywords: ignoreKeywords,
      callback: async function (imgSrc, name) {
        await updateActorImage(actor, imgSrc, {
          imgName: name,
        });
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
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-compendium-map-config',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/compendiumMap.html',
      resizable: false,
      minimizable: false,
      title: 'Compendium Map',
      width: 500,
    });
  }

  async getData(options) {
    const data = super.getData(options);

    const packs = [];
    game.packs.forEach((pack) => {
      if (pack.documentName === 'Actor' && !pack.locked) {
        packs.push({ title: pack.title, id: pack.collection });
      }
    });
    data.compendiums = packs;
    data.incKeywords = game.settings.get('token-variants', 'keywordSearch');

    return data;
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    if (formData.compendium) {
      const compendium = game.packs.get(formData.compendium);
      const ignoreKeywords = !formData.incKeywords;

      const processItem = async function (item) {
        const actor = await compendium.getDocument(item._id);

        let includeThisActor = true;
        if (formData.missingOnly && actor.img !== CONST.DEFAULT_TOKEN) {
          includeThisActor = false;
        }

        let includeThisToken = true;
        if (formData.missingOnly && actor.data.token.img !== CONST.DEFAULT_TOKEN) {
          includeThisToken = false;
        }

        const image1 = formData.showImages ? actor.img : '';
        const image2 = formData.showImages ? actor.data.token.img : '';

        if (includeThisActor || includeThisToken) {
          if (formData.autoApply) {
            await autoApply(
              actor,
              formData.diffImages,
              image1,
              image2,
              ignoreKeywords,
              formData.autoDisplayArtSelect
            );
          } else {
            addToArtSelectQueue(actor, formData.diffImages, image1, image2, ignoreKeywords);
          }
        }
      };

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
        });
      }
    }
  }
}
