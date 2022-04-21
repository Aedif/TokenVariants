import TokenCustomConfig from './tokenCustomConfig.js';
import { isVideo, isImage, keyPressed, SEARCH_TYPE } from '../scripts/utils.js';
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
  if (!force) {
    const artSelects = Object.values(ui.windows).filter((app) => app instanceof ArtSelect);
    if (artSelects.length !== 0) {
      if (ART_SELECT_QUEUE.queue.length !== 0)
        $('button#token-variant-art-clear-queue')
          .html(`Clear Queue (${ART_SELECT_QUEUE.queue.length})`)
          .show();
      return;
    }
  }

  let callData = ART_SELECT_QUEUE.queue.shift();
  if (callData) {
    showArtSelect(callData.search, callData.options);
  }
}

function delay(fn, ms) {
  let timer = 0;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(fn.bind(this, ...args), ms || 0);
  };
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
        width: ArtSelect.WIDTH || 500,
        height: ArtSelect.HEIGHT || 500,
        left: ArtSelect.LEFT,
        top: ArtSelect.TOP,
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

    //
    // Create buttons
    //
    const tokenConfigs = (game.settings.get('token-variants', 'tokenConfigs') || []).flat();
    const fuzzySearch = game.settings.get('token-variants', 'algorithmSettings').fuzzy;

    let allButtons = new Map();
    let artFound = false;

    const genLabel = function (obj) {
      if (!fuzzySearch || !obj.indexes) return obj.name;

      const name = obj.name;
      const indexes = obj.indexes;

      let lastIndex = indexes[0];
      let label = '';

      let substringLength = 1;

      if (lastIndex !== 0) {
        label = name.substring(0, lastIndex);
      }

      for (let i = 0; i < indexes.length; i++) {
        if (i + 1 === indexes.length) {
          label += '<mark>' + name.substring(lastIndex, lastIndex + substringLength) + '</mark>';
        } else if (indexes[i + 1] - indexes[i] === 1) {
          substringLength++;
        } else {
          label += '<mark>' + name.substring(lastIndex, lastIndex + substringLength) + '</mark>';
          label += name.substring(lastIndex + substringLength, indexes[i + 1]);
          lastIndex = indexes[i + 1];
          substringLength = 1;
        }
      }

      label += name.substring(lastIndex + substringLength, name.length);
      return label;
    };

    this.allImages.forEach((images, search) => {
      const buttons = [];
      images.forEach((imageObj) => {
        artFound = true;
        const vid = isVideo(imageObj.path);
        const img = isImage(imageObj.path);
        buttons.push({
          path: imageObj.path,
          img: img,
          vid: vid,
          type: vid || img,
          name: imageObj.name,
          label: genLabel(imageObj),
          hasConfig:
            this.searchType === SEARCH_TYPE.TOKEN || this.searchType === SEARCH_TYPE.BOTH
              ? Boolean(
                  tokenConfigs.find(
                    (config) =>
                      config.tvImgSrc == imageObj.path && config.tvImgName == imageObj.name
                  )
                )
              : false,
        });
      });
      allButtons.set(search, buttons);
    });

    if (artFound) data.allImages = allButtons;

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

    html.find('button#custom-art-search-bt').on('click', () => {
      this._performSearch(html.find(`input#custom-art-search`)[0].value);
    });

    let searchInput = html.find('#custom-art-search');
    searchInput.on(
      'input',
      delay((event) => {
        this._performSearch(event.target.value);
      }, 250)
    );
    searchInput = searchInput[0];
    searchInput.selectionStart = searchInput.selectionEnd = searchInput.value.length;

    html.find(`button#token-variant-art-clear-queue`).on('click', (event) => {
      ART_SELECT_QUEUE.queue = [];
      $(event.target).hide();
    });
  }

  _performSearch(search) {
    showArtSelect(search, {
      callback: this.callback,
      searchType: this.searchType,
      object: this.doc,
      force: true,
      image1: this.image1,
      image2: this.image2,
    });
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    if (formData && formData.search != this.search) {
      this._performSearch(formData.search);
    } else {
      this.close();
    }
  }

  setPosition(options = {}) {
    if (options.width) ArtSelect.WIDTH = options.width;
    if (options.height) ArtSelect.HEIGHT = options.height;
    if (options.top) ArtSelect.TOP = options.top;
    if (options.left) ArtSelect.LEFT = options.left;
    super.setPosition(options);
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
