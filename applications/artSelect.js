import TokenCustomConfig from './tokenCustomConfig.js';
import { keyPressed, SEARCH_TYPE } from '../scripts/utils.js';
import { showArtSelect } from '../token-variants.mjs';

const ART_SELECT_QUEUE = {
  queue: [],
};

export function addToArtSelectQueue(search, options) {
  ART_SELECT_QUEUE.queue.push({
    search: search,
    options: options,
  });
  $('button#token-variant-art-clear-queue')
    .html(`Clear Queue (${ART_SELECT_QUEUE.queue.length})`)
    .show();
}

export function addToQueue(search, options) {
  ART_SELECT_QUEUE.queue.push({
    search: search,
    options: options,
  });
}

export function renderFromQueue(force = false) {
  console.log('QUEUE SIZE ', ART_SELECT_QUEUE.queue.length);
  if (!force) {
    const artSelects = Object.values(ui.windows).filter((app) => app instanceof ArtSelect);
    if (artSelects.length !== 0) {
      if (ART_SELECT_QUEUE.queue.length !== 0)
        $('button#token-variant-art-clear-queue')
          .html(`Clear Queue (${ART_SELECT_QUEUE.queue.length})`)
          .show();
      console.log('I AM HERE');
      return;
    }
  }

  let callData = ART_SELECT_QUEUE.queue.shift();
  if (callData) {
    showArtSelect(callData.search, callData.options);
  }
}

function getStartingWidth(allImages) {
  let maxLength = 0;
  if (allImages)
    allImages.forEach((tokens, _) => {
      if (maxLength < tokens.length) maxLength = tokens.length;
    });
  return maxLength < 4 ? 150 * maxLength + 30 : 550;
}

function getStartingHeight(allImages) {
  let maxRows = 0;
  let maxLength = 0;
  if (allImages)
    allImages.forEach((tokens, _) => {
      maxRows++;
      if (maxLength < tokens.length) maxLength = tokens.length;
    });
  if (maxRows > 2) return 500;
  if (maxLength > 8) return 500;
  return undefined;
}

export class ArtSelect extends FormApplication {
  constructor(
    search,
    {
      preventClose = false,
      object = null,
      callback = null,
      searchType = null,
      allImages = null,
      image1 = '',
      image2 = '',
    } = {}
  ) {
    let title = game.i18n.localize('token-variants.windows.art-select.select-variant');
    if (searchType === SEARCH_TYPE.TOKEN)
      title = game.i18n.localize('token-variants.windows.art-select.select-token-art');
    else if (searchType === SEARCH_TYPE.PORTRAIT)
      title = game.i18n.localize('token-variants.windows.art-select.select-portrait-art');

    super(
      {},
      {
        closeOnSubmit: false,
        width: getStartingWidth(allImages),
        height: getStartingHeight(allImages),
        title: title,
      }
    );
    this.search = search;
    this.allImages = allImages;
    this.callback = callback;
    this.doc = object;
    this.preventClose = preventClose;
    this.image1 = image1;
    this.image2 = image2;
    this.searchType = searchType;

    this.performSearch = (search) => {
      showArtSelect(search, {
        callback: callback,
        searchType: searchType,
        object: object,
        force: true,
        image1: image1,
        image2: image2,
      });
    };
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-art-select',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/artSelect.html',
      resizable: true,
      minimizable: false,
    });
  }

  async getData(options) {
    const data = super.getData(options);
    data.allImages = this.allImages;
    data.search = this.search;
    data.queue = ART_SELECT_QUEUE.queue.length;
    data.image1 = this.image1;
    data.image2 = this.image2;
    data.image1_active =
      this.searchType === SEARCH_TYPE.BOTH || this.searchType === SEARCH_TYPE.PORTRAIT;
    data.image2_active =
      this.searchType === SEARCH_TYPE.BOTH || this.searchType === SEARCH_TYPE.TOKEN;
    return data;
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
    const callback = this.callback;
    const close = () => this.close();
    const object = this.doc;
    const preventClose = this.preventClose;

    const boxes = html.find(`.token-variants-grid-box`);
    boxes.map((box) => {
      boxes[box].addEventListener('click', async function (event) {
        if (keyPressed('config')) {
          if (object)
            new TokenCustomConfig(
              object,
              {},
              event.target.dataset.name,
              event.target.dataset.filename
            ).render(true);
        } else {
          if (!preventClose) {
            close();
          }
          if (callback) {
            callback(event.target.dataset.name, event.target.dataset.filename);
          }
        }
      });
    });

    html.find(`button#custom-art-search-bt`).on('click', () => {
      this.performSearch(html.find(`input#custom-art-search`)[0].value);
    });

    html.find(`button#token-variant-art-clear-queue`).on('click', (event) => {
      ART_SELECT_QUEUE.queue = [];
      $(event.target).hide();
    });
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    if (formData && formData.search != this.search) {
      this.performSearch(formData.search);
    } else {
      this.close();
    }
  }

  async close(options = {}) {
    let callData = ART_SELECT_QUEUE.queue.shift();
    if (callData) {
      callData.options.force = true;
      showArtSelect(callData.search, callData.options);
    } else {
      // For some reason there might be app instances that have not closed themselves by this point
      // If there are, close them now
      const artSelects = Object.values(ui.windows)
        .filter((app) => app instanceof ArtSelect)
        .filter((app) => app.appId !== this.appId);
      for (const app of artSelects) {
        app.close();
      }

      return super.close(options);
    }
  }
}
