import TokenCustomConfig from './tokenCustomConfig.js';
import {
  isVideo,
  isImage,
  keyPressed,
  SEARCH_TYPE,
  BASE_IMAGE_CATEGORIES,
  getFileName,
} from '../scripts/utils.js';
import { showArtSelect } from '../token-variants.mjs';
import { TVA_CONFIG, getSearchOptions } from '../scripts/settings.js';

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
  static instance = null;

  static IMAGE_DISPLAY = {
    NONE: 0,
    PORTRAIT: 1,
    TOKEN: 2,
    PORTRAIT_TOKEN: 3,
    IMAGE: 4,
  };

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
      displayMode = ArtSelect.IMAGE_DISPLAY.NONE,
      multipleSelection = false,
      searchOptions = {},
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
    this.displayMode = displayMode;
    this.multipleSelection = multipleSelection;
    this.searchType = searchType;
    this.searchOptions = mergeObject(searchOptions, getSearchOptions(), {
      overwrite: false,
    });
    ArtSelect.instance = this;
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

  _getHeaderButtons() {
    const buttons = super._getHeaderButtons();
    buttons.unshift({
      label: 'FilePicker',
      class: 'file-picker',
      icon: 'fas fa-file-import fa-fw',
      onclick: () => {
        new FilePicker({
          type: 'imagevideo',
          callback: (path) => {
            if (!this.preventClose) {
              this.close();
            }
            if (this.callback) {
              this.callback(path, getFileName(path));
            }
          },
        }).render();
      },
    });
    buttons.unshift({
      label: 'Image Category',
      class: 'type',
      icon: 'fas fa-swatchbook',
      onclick: () => {
        if (ArtSelect.instance) ArtSelect.instance._typeSelect();
      },
    });
    return buttons;
  }

  _typeSelect() {
    const categories = BASE_IMAGE_CATEGORIES.concat(TVA_CONFIG.customImageCategories);

    const buttons = {};
    for (const c of categories) {
      let label = c;
      if (c === this.searchType) {
        label = '<b>>>> ' + label + ' <<<</b>';
      }
      buttons[c] = {
        label: label,
        callback: () => {
          if (this.searchType !== c) {
            this.searchType = c;
            this._performSearch(this.search, true);
          }
        },
      };
    }

    new Dialog({
      title: `Select Image Category and Filter`,
      content: `<style>.dialog .dialog-button {flex: 0 0 auto;}</style>`,
      buttons: buttons,
    }).render(true);
  }

  async getData(options) {
    const data = super.getData(options);
    if (this.doc instanceof Item) {
      data.item = true;
      data.description = this.doc.system?.description?.value ?? '';
    }
    const searchOptions = this.searchOptions;
    const algorithm = searchOptions.algorithm;

    //
    // Create buttons
    //
    const tokenConfigs = (TVA_CONFIG.tokenConfigs || []).flat();
    const fuzzySearch = algorithm.fuzzy;

    let allButtons = new Map();
    let artFound = false;

    const genLabel = function (str, indices, start = '<mark>', end = '</mark>', fillChar = null) {
      if (!indices) return str;
      let fillStr = fillChar ? fillChar.repeat(str.length) : str;
      let label = '';
      let lastIndex = 0;
      for (const index of indices) {
        label += fillStr.slice(lastIndex, index[0]);
        label += start + str.slice(index[0], index[1] + 1) + end;
        lastIndex = index[1] + 1;
      }
      label += fillStr.slice(lastIndex, fillStr.length);

      return label;
    };

    const genTitle = function (obj) {
      if (!fuzzySearch) return obj.path;

      let percent = Math.ceil((1 - obj.score) * 100) + '%';
      if (searchOptions.runSearchOnPath) {
        return percent + '\n' + genLabel(obj.path, obj.indices, '', '', '-') + '\n' + obj.path;
      }
      return percent;
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
          label:
            fuzzySearch && !searchOptions.runSearchOnPath
              ? genLabel(imageObj.name, imageObj.indices)
              : imageObj.name,
          title: genTitle(imageObj),
          hasConfig:
            this.searchType === SEARCH_TYPE.TOKEN ||
            this.searchType === SEARCH_TYPE.PORTRAIT_AND_TOKEN
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
    data.displayMode = this.displayMode;
    data.multipleSelection = this.multipleSelection;
    data.displaySlider = algorithm.fuzzy && algorithm.fuzzyArtSelectPercentSlider;
    data.fuzzyThreshold = algorithm.fuzzyThreshold;
    if (data.displaySlider) {
      data.fuzzyThreshold = 100 - data.fuzzyThreshold * 100;
      data.fuzzyThreshold = data.fuzzyThreshold.toFixed(0);
    }
    data.autoplay = !TVA_CONFIG.playVideoOnHover;
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
    const multipleSelection = this.multipleSelection;

    const boxes = html.find(`.token-variants-grid-box`);
    boxes.hover(
      function () {
        if (TVA_CONFIG.playVideoOnHover) {
          const vid = $(this).siblings('video');
          if (vid.length) {
            vid[0].play();
            $(this).siblings('.fa-play').hide();
          }
        }
      },
      function () {
        if (TVA_CONFIG.pauseVideoOnHoverOut) {
          const vid = $(this).siblings('video');
          if (vid.length) {
            vid[0].pause();
            vid[0].currentTime = 0;
            $(this).siblings('.fa-play').show();
          }
        }
      }
    );
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
      if (multipleSelection) {
        boxes[box].addEventListener('contextmenu', async function (event) {
          $(event.target).toggleClass('selected');
        });
      }
    });

    let searchInput = html.find('#custom-art-search');
    searchInput.focus();
    searchInput[0].selectionStart = searchInput[0].selectionEnd = 10000;

    searchInput.on(
      'input',
      delay((event) => {
        this._performSearch(event.target.value);
      }, 350)
    );

    html.find(`button#token-variant-art-clear-queue`).on('click', (event) => {
      ART_SELECT_QUEUE.queue = [];
      $(event.target).hide();
    });

    $(html)
      .find('[name="fuzzyThreshold"]')
      .change((e) => {
        $(e.target)
          .siblings('.token-variants-range-value')
          .html(`${parseFloat(e.target.value).toFixed(0)}%`);
        this.searchOptions.algorithm.fuzzyThreshold = (100 - e.target.value) / 100;
      })
      .change(
        delay((event) => {
          this._performSearch(this.search, true);
        }, 350)
      );

    if (multipleSelection) {
      html.find(`button#token-variant-art-return-selected`).on('click', () => {
        if (callback) {
          const images = [];
          html
            .find(`.token-variants-grid-box.selected`)
            .siblings('.token-variants-grid-image')
            .each(function () {
              images.push(this.getAttribute('src'));
            });
          callback(images);
        }
        close();
      });
      html.find(`button#token-variant-art-return-all`).on('click', () => {
        if (callback) {
          const images = [];
          html.find(`.token-variants-grid-image`).each(function () {
            images.push(this.getAttribute('src'));
          });
          callback(images);
        }
        close();
      });
    }
  }

  _performSearch(search, force = false) {
    if (!force && this.search.trim() === search.trim()) return;
    showArtSelect(search, {
      callback: this.callback,
      searchType: this.searchType,
      object: this.doc,
      force: true,
      image1: this.image1,
      image2: this.image2,
      displayMode: this.displayMode,
      multipleSelection: this.multipleSelection,
      searchOptions: this.searchOptions,
      preventClose: this.preventClose,
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
