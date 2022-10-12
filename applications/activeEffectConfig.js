import { showArtSelect } from '../token-variants.mjs';
import { SEARCH_TYPE, getFileName, isVideo } from '../scripts/utils.js';
import TokenCustomConfig from './tokenCustomConfig.js';
import { TVA_CONFIG } from '../scripts/settings.js';
import EditJsonConfig from './configJsonEdit.js';
import EditScriptConfig from './configScriptEdit.js';
import OverlayConfig from './overlayConfig.js';
import { showOverlayJsonConfigDialog } from './dialogs.js';

export default class TVAActiveEffectConfig extends FormApplication {
  constructor(token, effectImg, effectName) {
    super({}, {});

    this.token = token;
    this.effectImg = effectImg;
    this.effectName = effectName;

    // There is currently no way to track IDs of effects when Actor is not linked to a Token
    // Sof or now only supporting flagging on actors
    // if(token.actorId)
    this.objectToFlag = game.actors.get(token.actorId);
    // else
    //   this.objectToFlag = canvas.tokens.get(token._id);
    // this.objectToFlag = this.objectToFlag.document || this.objectToFlag;

    const effectMappings = deepClone(
      this.objectToFlag.getFlag('token-variants', 'effectMappings') || {}
    );
    const mapping = effectMappings[this.effectName] || {};
    this.config = mapping.config || {};
    this.overlayConfig = mapping.overlayConfig;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-active-effect-config',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/activeEffectConfig.html',
      resizable: false,
      minimizable: false,
      title: 'Config',
      width: 250,
    });
  }

  async getData(options) {
    const data = super.getData(options);

    const effectMappings = deepClone(
      this.objectToFlag.getFlag('token-variants', 'effectMappings') || {}
    );
    const mapping = effectMappings[this.effectName] || {};
    if (!mapping.config) mapping.config = {};

    let hasTokenConfig = Object.keys(mapping.config).length;
    if (mapping.flags) hasTokenConfig--;
    if (mapping.config.tv_script) hasTokenConfig--;

    return mergeObject(data, {
      effectImg: this.effectImg,
      effectName: this.effectName,
      imgSrc: mapping.imgSrc,
      imgName: mapping.imgName,
      priority: mapping.priority || 50,
      overlay: mapping.overlay,
      config: this.config,
      hasConfig: this.config ? !isEmpty(this.config) : false,
      hasTokenConfig: hasTokenConfig > 0,
      hasScript: this.config && this.config.tv_script,
      isVideo: mapping.imgSrc ? isVideo(mapping.imgSrc) : false,
    });
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('.remove').click(this._onRemove.bind(this));
    if (TVA_CONFIG.permissions.image_path_button[game.user.role])
      html.find('.image').click(this._onImageClick.bind(this));
    html.find('.image').contextmenu(this._onImageRightClick.bind(this));
    html.find('button.effect-config').click(this._onConfigClick.bind(this));
    html.find('button.effect-config-edit').click(this._onConfigEditClick.bind(this));
    html.find('button.effect-config-script').click(this._onConfigScriptClick.bind(this));
    html.find('.overlay-config').click(this._onOverlayConfigClick.bind(this));
    html.on('contextmenu', '.overlay-config', this._onOverlayConfigRightClick.bind(this));
  }

  async _onOverlayConfigClick() {
    new OverlayConfig(
      this.overlayConfig,
      (config) => {
        this.overlayConfig = config;
      },
      this.effectName,
      this.token
    ).render(true);
  }

  async _onOverlayConfigRightClick() {
    showOverlayJsonConfigDialog(this.overlayConfig, (config) => (this.overlayConfig = config));
  }

  async _toggleActiveControls(event) {
    const tokenConfig = $(event.target).closest('.form-group').find('.effect-config');
    const configEdit = $(event.target).closest('.form-group').find('.effect-config-edit');
    const scriptEdit = $(event.target).closest('.form-group').find('.effect-config-script');

    let hasTokenConfig = Object.keys(this.config).filter((k) => this.config[k]).length;
    if (this.config.flags) hasTokenConfig--;
    if (this.config.tv_script) hasTokenConfig--;

    if (hasTokenConfig) tokenConfig.addClass('active');
    else tokenConfig.removeClass('active');

    if (Object.keys(this.config).filter((k) => this.config[k]).length)
      configEdit.addClass('active');
    else configEdit.removeClass('active');

    if (this.config.tv_script) scriptEdit.addClass('active');
    else scriptEdit.removeClass('active');
  }

  async _onConfigScriptClick(event) {
    new EditScriptConfig(this.config.tv_script, (script) => {
      if (script) this.config.tv_script = script;
      else delete this.config.tv_script;
      this._toggleActiveControls(event);
    }).render(true);
  }

  async _onConfigEditClick(event) {
    new EditJsonConfig(this.config, (config) => {
      this.config = config;
      this._toggleActiveControls(event);
    }).render(true);
  }

  async _onConfigClick(event) {
    new TokenCustomConfig(
      this.token,
      {},
      null,
      null,
      (config) => {
        if (!config || isEmpty(config)) {
          config = {};
          config.tv_script = this.config.tv_script;
          config.flags = this.config.flags;
        }
        this.config = config;
        this._toggleActiveControls(event);
      },
      this.config
    ).render(true);
  }

  async _onImageClick(event) {
    showArtSelect(this.token.name, {
      searchType: SEARCH_TYPE.TOKEN,
      callback: (imgSrc, imgName) => {
        const vid = $(event.target).closest('.form-group').find('video.image');
        const img = $(event.target).closest('.form-group').find('img.image');
        vid.add(img).attr('src', imgSrc).attr('title', imgName);
        if (isVideo(imgSrc)) {
          vid.show();
          img.hide();
        } else {
          vid.hide();
          img.show();
        }
        $(event.target).siblings('.imgSrc').val(imgSrc);
        $(event.target).siblings('.imgName').val(imgName);
      },
    });
  }

  async _onImageRightClick(event) {
    new FilePicker({
      type: 'imagevideo',
      callback: (path) => {
        const vid = $(event.target).closest('.form-group').find('video.image');
        const img = $(event.target).closest('.form-group').find('img.image');
        vid.add(img).attr('src', path).attr('title', getFileName(path));
        if (isVideo(path)) {
          vid.show();
          img.hide();
        } else {
          vid.hide();
          img.show();
        }
        $(event.target).siblings('.imgSrc').val(path);
        $(event.target).siblings('.imgName').val(getFileName(path));
      },
    }).render();
  }

  async _onRemove(event) {
    if (this.objectToFlag) {
      const effectMappings = this.objectToFlag.getFlag('token-variants', 'effectMappings');
      if (effectMappings && this.effectName in effectMappings) {
        const tempMappings = deepClone(effectMappings);
        delete tempMappings[this.effectName];
        await this.objectToFlag.unsetFlag('token-variants', 'effectMappings');
        this.objectToFlag.setFlag('token-variants', 'effectMappings', tempMappings);
      }
    }
    this.close();
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    if (this.objectToFlag) {
      const hasKeys = Object.keys(this.config).filter((k) => this.config[k]).length;
      if (!formData.imgSrc && !hasKeys) this._onRemove();
      else {
        if (!formData.priority) formData.priority = 50;
        formData.config = this.config;
        formData.overlayConfig = this.overlayConfig;
        const effectMappings = deepClone(
          this.objectToFlag.getFlag('token-variants', 'effectMappings') || {}
        );
        effectMappings[this.effectName] = formData;

        await this.objectToFlag.unsetFlag('token-variants', 'effectMappings');
        this.objectToFlag.setFlag('token-variants', 'effectMappings', effectMappings);
      }
    }
  }
}
