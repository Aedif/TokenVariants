import { showArtSelect, updateTokenImage } from '../token-variants.mjs';
import { SEARCH_TYPE, updateActorImage } from '../scripts/utils.js';
import { addToQueue, renderFromQueue } from './artSelect.js';

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

    return data;
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    if (formData.compendium) {
      const compendium = game.packs.get(formData.compendium);

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
          if (formData.diffImages) {
            addToQueue(actor.data.name, {
              searchType: SEARCH_TYPE.PORTRAIT,
              object: actor,
              preventClose: true,
              image1: image1,
              image2: image2,
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
      };

      const allItems = [];
      compendium.index.forEach((k) => {
        allItems.push(processItem(k));
      });

      Promise.all(allItems).then(() => {
        renderFromQueue();
      });
    }
  }
}
