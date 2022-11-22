import { FILTERS } from './overlayConfig.js';

class OutlineFilter extends OutlineOverlayFilter {
  /** @inheritdoc */
  static createFragmentShader() {
    return `
    varying vec2 vTextureCoord;
    varying vec2 vFilterCoord;
    uniform sampler2D uSampler;
    
    uniform vec2 thickness;
    uniform vec4 outlineColor;
    uniform vec4 filterClamp;
    uniform float alphaThreshold;
    uniform float time;
    uniform bool knockout;
    uniform bool wave;
    
    ${this.CONSTANTS}
    ${this.WAVE()}
    
    void main(void) {
        float dist = distance(vFilterCoord, vec2(0.5)) * 2.0;
        vec4 ownColor = texture2D(uSampler, vTextureCoord);
        vec4 wColor = wave ? outlineColor * 
                             wcos(0.0, 1.0, dist * 75.0, 
                                  -time * 0.01 + 3.0 * dot(vec4(1.0), ownColor)) 
                             * 0.33 * (1.0 - dist) : vec4(0.0);
        float texAlpha = smoothstep(alphaThreshold, 1.0, ownColor.a);
        vec4 curColor;
        float maxAlpha = 0.;
        vec2 displaced;
        for ( float angle = 0.0; angle <= TWOPI; angle += ${this.#quality.toFixed(7)} ) {
            displaced.x = vTextureCoord.x + thickness.x * cos(angle);
            displaced.y = vTextureCoord.y + thickness.y * sin(angle);
            curColor = texture2D(uSampler, clamp(displaced, filterClamp.xy, filterClamp.zw));
            curColor.a = clamp((curColor.a - 0.6) * 2.5, 0.0, 1.0);
            maxAlpha = max(maxAlpha, curColor.a);
        }
        float resultAlpha = max(maxAlpha, texAlpha);
        vec3 result = (ownColor.rgb + outlineColor.rgb * (1.0 - texAlpha)) * resultAlpha;
        gl_FragColor = vec4((ownColor.rgb + outlineColor.rgb * (1. - ownColor.a)) * resultAlpha, resultAlpha);
    }
    `;
  }

  static get #quality() {
    switch (canvas.performance.mode) {
      case CONST.CANVAS_PERFORMANCE_MODES.LOW:
        return (Math.PI * 2) / 10;
      case CONST.CANVAS_PERFORMANCE_MODES.MED:
        return (Math.PI * 2) / 20;
      default:
        return (Math.PI * 2) / 30;
    }
  }
}

export class TVA_Sprite extends TokenMesh {
  constructor(texture, token, config) {
    super(token);

    this.texture = texture;

    this.tvaOverlayConfig = mergeObject(
      {
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        offsetX: 0,
        offsetY: 0,
        angle: 0,
        filter: 'NONE',
        filterOptions: {},
        inheritTint: false,
        underlay: false,
        linkRotation: true,
        linkMirror: true,
        linkOpacity: false,
        mirror: false,
        tint: null,
        loop: true,
        playOnce: false,
        animation: {
          rotate: false,
          duration: 5000,
          clockwise: true,
          relative: false,
        },
        limitToUser: false,
        limitedUsers: [],
        alwaysVisible: false,
      },
      config
    );
    this._tvaPlay().then(() => this.refresh());
  }

  get sort() {
    return this.overlaySort || this.object.document.sort || 0;
  }

  get visible() {
    return (
      (this.object.visible || this.tvaOverlayConfig.alwaysVisible) &&
      (!this.tvaOverlayConfig.limitToUser ||
        this.tvaOverlayConfig.limitedUsers.includes(game.user.id))
    );
  }
  set visible(visible) {}

  async _tvaPlay() {
    // Ensure playback state for video
    const source = foundry.utils.getProperty(this.texture, 'baseTexture.resource.source');
    if (source && source.tagName === 'VIDEO') {
      // Detach video from others
      const s = source.cloneNode();

      if (this.tvaOverlayConfig.playOnce) {
        s.onended = () => {
          this.alpha = 0;
          this.tvaVideoEnded = true;
        };
      }

      await new Promise((resolve) => (s.oncanplay = resolve));
      this.texture = PIXI.Texture.from(s, { resourceOptions: { autoPlay: false } });

      const options = {
        loop: this.tvaOverlayConfig.loop && !this.tvaOverlayConfig.playOnce,
        volume: 0,
        offset: 0,
        playing: true,
      };
      game.video.play(s, options);
    }
  }

  refresh(configuration, preview = false, fullRefresh = true) {
    if (!this.texture) return;
    const config = mergeObject(this.tvaOverlayConfig, configuration, { inplace: !preview });

    if (fullRefresh) {
      const source = foundry.utils.getProperty(this.texture, 'baseTexture.resource.source');
      if (source && source.tagName === 'VIDEO') {
        if (!source.loop && config.loop) {
          game.video.play(source);
        } else if (source.loop && !config.loop) {
          game.video.stop(source);
        }
        source.loop = config.loop;
      }

      if (this.anchor) {
        if (config.animation.relative) {
          this.anchor.set(0.5, 0.5);
        } else {
          this.anchor.set(0.5 + config.offsetX, 0.5 + config.offsetY);
        }
      }
    }

    // Scale the image using the same logic as the token
    const tex = this.texture;
    let aspect = tex.width / tex.height;
    const scale = this.scale;
    if (aspect >= 1) {
      this.width = this.object.w * this.object.document.texture.scaleX;
      scale.y = Number(scale.x);
    } else {
      this.height = this.object.h * this.object.document.texture.scaleY;
      scale.x = Number(scale.y);
    }

    // Adjust scale according to config
    this.scale.x = this.scale.x * config.scaleX;
    this.scale.y = this.scale.y * config.scaleY;

    // Check if mirroring should be inherited from the token and if so apply it
    if (config.linkMirror) {
      this.scale.x = Math.abs(this.scale.x) * (this.object.document.texture.scaleX < 0 ? -1 : 1);
      this.scale.y = Math.abs(this.scale.y) * (this.object.document.texture.scaleY < 0 ? -1 : 1);
    }

    // Center the image
    if (config.animation.relative) {
      this.position.set(
        this.object.document.x + this.object.w / 2 - config.offsetX * this.width,
        this.object.document.y + this.object.h / 2 - config.offsetY * this.width
      );
    } else {
      this.position.set(
        this.object.document.x + this.object.w / 2,
        this.object.document.y + this.object.h / 2
      );
    }

    // Set alpha but only if playOnce is disabled and the video hasn't
    // finished playing yet. Otherwise we want to keep alpha as 0 to keep the video hidden
    if (!this.tvaVideoEnded) {
      this.alpha = config.linkOpacity ? this.object.document.alpha : config.alpha;
    }

    // Angle in degrees
    if (fullRefresh) {
      if (config.linkRotation) this.angle = this.object.document.rotation + config.angle;
      else this.angle = config.angle;
    } else if (!config.animation.rotate) {
      if (config.linkRotation) this.angle = this.object.document.rotation + config.angle;
    }

    // Apply color tinting
    const tint = config.inheritTint ? this.object.document.texture.tint : config.tint;
    this.tint = tint ? Color.from(tint) : 0xffffff;

    if (fullRefresh) {
      if (config.animation.rotate) {
        this.animate(config);
      } else {
        this.stopAnimation();
      }
    }

    // Apply filters
    if (fullRefresh) this._applyFilters(config);
    //if (fullRefresh) this.filters = this._getFilters(config);
  }

  async _applyFilters(config) {
    const filterName = config.filter;
    const FilterClass = PIXI.filters[filterName];
    const options = mergeObject(FILTERS[filterName]?.defaultValues || {}, config.filterOptions);
    let filter;
    if (FilterClass) {
      if (FILTERS[filterName]?.argType === 'args') {
        let args = [];
        const controls = FILTERS[filterName]?.controls;
        if (controls) {
          controls.forEach((c) => args.push(options[c.name]));
        }
        filter = new FilterClass(...args);
      } else if (FILTERS[filterName]?.argType === 'options') {
        filter = new FilterClass(options);
      } else {
        filter = new FilterClass();
      }
    } else if (filterName === 'OutlineOverlayFilter') {
      filter = OutlineFilter.create(options);
      filter.thickness = options.trueThickness ?? 1;
      filter.animate = options.animate ?? false;
    } else if (filterName === 'Token Magic FX') {
      this.filters = await constructTMFXFilters(options.params || [], this);
      return;
    } else if (filterName === 'FilterFire') {
      let fxModule = await import('../../tokenmagic/fx/filters/FilterFire.js');

      options.animated = {
        time: {
          active: true,
          speed: -0.0024,
          animType: 'move',
        },
        intensity: {
          active: true,
          loopDuration: 15000,
          val1: 0.8,
          val2: 2,
          animType: 'syncCosOscillation',
        },
        amplitude: {
          active: true,
          loopDuration: 4400,
          val1: 1,
          val2: 1.4,
          animType: 'syncCosOscillation',
        },
      };

      filter = new fxModule.FilterFire({ dummy: false, ...options });
      filter.placeableImg = this;
      filter.targetPlaceable = this.object;
    }

    if (filter) {
      this.filters = [filter];
    } else {
      this.filters = [];
    }
  }

  async stopAnimation() {
    if (this.animationName) {
      CanvasAnimation.terminateAnimation(this.animationName);
    }
  }

  async animate(config) {
    if (!this.animationName) this.animationName = this.object.sourceId + '.' + randomID(5);

    let newAngle = this.angle + (config.animation.clockwise ? 360 : -360);
    const rotate = [{ parent: this, attribute: 'angle', to: newAngle }];

    const completed = await CanvasAnimation.animate(rotate, {
      duration: config.animation.duration,
      name: this.animationName,
    });
    if (completed) {
      this.animate(config);
    }
  }

  destroy() {
    if (this.texture?.baseTexture.resource.source?.tagName === 'VIDEO') {
      this.texture.baseTexture.destroy();
    }
    this.stopAnimation();
    super.destroy();
  }
}

async function constructTMFXFilters(paramsArray, sprite) {
  if (typeof TokenMagic === 'undefined') return [];

  try {
    paramsArray = eval(paramsArray);
  } catch (e) {
    return [];
  }

  if (!Array.isArray(paramsArray)) {
    paramsArray = TokenMagic.getPreset(paramsArray);
  }
  if (!(paramsArray instanceof Array && paramsArray.length > 0)) return [];

  let filters = [];
  for (const params of paramsArray) {
    if (
      !params.hasOwnProperty('filterType') ||
      !TMFXFilterTypes.hasOwnProperty(params.filterType)
    ) {
      // one invalid ? all rejected.
      return [];
    }

    if (!params.hasOwnProperty('rank')) {
      params.rank = 5000;
    }

    if (!params.hasOwnProperty('filterId') || params.filterId == null) {
      params.filterId = randomID();
    }

    if (!params.hasOwnProperty('enabled') || !(typeof params.enabled === 'boolean')) {
      params.enabled = true;
    }

    // params.placeableId = token.id;
    params.filterInternalId = randomID();
    params.filterOwner = game.data.userId;
    // params.placeableType = placeable._TMFXgetPlaceableType();
    params.updateId = randomID();

    const filterClass = await getTMFXFilter(params.filterType);
    if (filterClass) {
      const filter = new filterClass(params);
      if (filter) {
        // Patch fixes
        filter.placeableImg = sprite;
        filter.targetPlaceable = sprite.object;
        // end of fixes
        filters.unshift(filter);
      }
    }
  }
  return filters;
}

async function getTMFXFilter(id) {
  if (id in TMFXFilterTypes) {
    if (id in LOADED_TMFXFilters) return LOADED_TMFXFilters[id];
    else {
      try {
        const className = TMFXFilterTypes[id];
        let fxModule = await import(`../../tokenmagic/fx/filters/${className}.js`);
        if (fxModule && fxModule[className]) {
          LOADED_TMFXFilters[id] = fxModule[className];
          return fxModule[className];
        }
      } catch (e) {}
    }
  }
  return null;
}

const LOADED_TMFXFilters = {};

const TMFXFilterTypes = {
  adjustment: 'FilterAdjustment',
  distortion: 'FilterDistortion',
  oldfilm: 'FilterOldFilm',
  glow: 'FilterGlow',
  outline: 'FilterOutline',
  bevel: 'FilterBevel',
  xbloom: 'FilterXBloom',
  shadow: 'FilterDropShadow',
  twist: 'FilterTwist',
  zoomblur: 'FilterZoomBlur',
  blur: 'FilterBlur',
  bulgepinch: 'FilterBulgePinch',
  zapshadow: 'FilterRemoveShadow',
  ray: 'FilterRays',
  fog: 'FilterFog',
  xfog: 'FilterXFog',
  electric: 'FilterElectric',
  wave: 'FilterWaves',
  shockwave: 'FilterShockwave',
  fire: 'FilterFire',
  fumes: 'FilterFumes',
  smoke: 'FilterSmoke',
  flood: 'FilterFlood',
  images: 'FilterMirrorImages',
  field: 'FilterForceField',
  xray: 'FilterXRays',
  liquid: 'FilterLiquid',
  xglow: 'FilterGleamingGlow',
  pixel: 'FilterPixelate',
  web: 'FilterSpiderWeb',
  ripples: 'FilterSolarRipples',
  globes: 'FilterGlobes',
  transform: 'FilterTransform',
  splash: 'FilterSplash',
  polymorph: 'FilterPolymorph',
  xfire: 'FilterXFire',
  sprite: 'FilterSprite',
  replaceColor: 'FilterReplaceColor',
  ddTint: 'FilterDDTint',
};
