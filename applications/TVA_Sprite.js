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

export class TVA_Sprite extends PIXI.Sprite {
  constructor(texture, token, config) {
    super(texture);

    this.tvaOverlayConfig = mergeObject(
      {
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        offsetX: 0,
        offsetY: 0,
        angle: 0,
        filter: 'NONE',
        filterOptions: {
          outlineColor: [0, 0, 0, 1],
          trueThickness: 1,
          animate: false,
        },
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
        },
      },
      config
    );
    this.token = token;
    this.visible = false;
    this._tvaPlay().then(() => this.refresh());
  }

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

  refresh(configuration, preview = false) {
    if (!this.texture) return;
    this.visible = false;
    const config = mergeObject(this.tvaOverlayConfig, configuration, { inplace: !preview });

    const source = foundry.utils.getProperty(this.texture, 'baseTexture.resource.source');
    if (source && source.tagName === 'VIDEO') {
      if (!source.loop && config.loop) {
        game.video.play(source);
      } else if (source.loop && !config.loop) {
        game.video.stop(source);
      }
      source.loop = config.loop;
    }

    if (this.anchor) this.anchor.set(0.5 + config.offsetX, 0.5 + config.offsetY);

    // Scale the image using the same logic as the token
    const tex = this.texture;
    let aspect = tex.width / tex.height;
    const scale = this.scale;
    if (aspect >= 1) {
      this.width = this.token.w * this.token.document.texture.scaleX;
      scale.y = Number(scale.x);
    } else {
      this.height = this.token.h * this.token.document.texture.scaleY;
      scale.x = Number(scale.y);
    }

    // Center the image
    this.position.set(this.token.w / 2, this.token.h / 2);

    // Adjust scale according to config
    this.scale.x = this.scale.x * config.scaleX;
    this.scale.y = this.scale.y * config.scaleY;

    // Check if mirroring should be inherited from the token and if so apply it
    if (config.linkMirror) {
      this.scale.x = Math.abs(this.scale.x) * (this.token.document.texture.scaleX < 0 ? -1 : 1);
      this.scale.y = Math.abs(this.scale.y) * (this.token.document.texture.scaleY < 0 ? -1 : 1);
    }

    // Set alpha but only if playOnce is disabled and the video hasn't
    // finished playing yet. Otherwise we want to keep alpha as 0 to keep the video hidden
    if (!this.tvaVideoEnded) {
      this.alpha = config.linkOpacity ? this.token.alpha : config.alpha;
    }

    let filter = PIXI.filters[config.filter];
    if (filter) {
      this.filters = [new filter()];
    } else if (config.filter === 'OutlineOverlayFilter') {
      filter = OutlineFilter.create(config.filterOptions);
      filter.thickness = config.filterOptions.trueThickness ?? 1;
      filter.animate = config.filterOptions.animate ?? false;
      this.filters = [filter];
    } else {
      this.filters = [];
    }

    // Angle in degrees
    this.angle = config.linkRotation ? this.token.rotation + config.angle : config.angle;

    // Apply color tinting
    const tint = config.inheritTint ? this.token.document.texture.tint : config.tint;
    this.tint = tint ? Color.from(tint) : 0xffffff;

    this.visible = true;

    if (config.animation.rotate) {
      this.animate(config);
    } else {
      this.stopAnimation();
    }
  }

  async stopAnimation() {
    if (this.animationName) {
      CanvasAnimation.terminateAnimation(this.animationName);
    }
  }

  //test
  async animate(config) {
    if (!this.animationName) this.animationName = this.token.sourceId + '.' + randomID(5);

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
