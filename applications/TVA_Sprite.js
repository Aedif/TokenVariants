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
        inheritTint: false,
        underlay: false,
        linkRotation: true,
        tint: null,
        loop: true,
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

      s.loop = this.tvaOverlayConfig.loop;
      s.muted = true;
      s.onplay = () => (s.currentTime = 0);

      await new Promise((resolve) => (s.oncanplay = resolve));
      this.texture = PIXI.Texture.from(s, { resourceOptions: { autoPlay: false } });
      game.video.play(s);
    }
  }

  refresh(configuration, preview = false) {
    if (!this.texture) return;
    this.visible = false;
    const config = mergeObject(this.tvaOverlayConfig, configuration, { inplace: !preview });
    // this.anchor.set(
    //   1 / this.token.data.width - 1 + config.offsetX,
    //   1 / this.token.data.height - 1 + config.offsetY
    // );

    // Implementation 2

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

    //
    const tex = this.texture;
    let aspect = tex.width / tex.height;
    const scale = this.scale;
    if (aspect >= 1) {
      this.width = this.token.w * this.token.data.scale;
      scale.y = Number(scale.x);
    } else {
      this.height = this.token.h * this.token.data.scale;
      scale.x = Number(scale.y);
    }

    // this.width = this.width * (this.scale.x + config.scaleX);
    // this.scale.y = this.scale.y + config.scaleY;
    // this.scale.x = this.scale.x + config.scaleX;

    this.position.set(this.token.w / 2, this.token.h / 2);

    // Mirror horizontally or vertically
    this.scale.x = this.scale.x * config.scaleX;
    this.scale.y = this.scale.y * config.scaleY;

    // this.x = this.width / 2 / this.token.data.scale;
    // this.y = this.height / 2 / this.token.data.scale;

    // aspect = this.token.data.width / this.token.data.height;
    // if (aspect != 1) {
    //   this.y = this.y / aspect;
    // }

    // scale.x = scale.x + config.scaleX;
    // scale.y = scale.y + config.scaleY;

    // Apply config options
    // this.scale.x = Number(this.scale.x) + config.scaleX;
    // this.scale.y = Number(this.scale.y) + config.scaleY;

    // this.achor.set(this.achor.x + config.offsetX, this.anchor.y + config.offsetY);
    // this.x = this.x + config.offsetX;
    // this.y = this.y + config.offsetY;

    // // Mirror horizontally or vertically
    // this.icon.scale.x = Math.abs(this.icon.scale.x) * (this.data.mirrorX ? -1 : 1);
    // this.icon.scale.y = Math.abs(this.icon.scale.y) * (this.data.mirrorY ? -1 : 1);

    // Implementation 1 : CLOSE

    // const tex = this.texture;
    // let aspect = tex.width / tex.height;
    // const scale = this.scale;
    // if (aspect >= 1) {
    //   this.width = this.width * this.data.scale;
    //   scale.y = Number(scale.x);
    // } else {
    //   this.icon.height = this.h * this.data.scale;
    //   scale.x = Number(scale.y);
    // }

    // // Mirror horizontally or vertically
    // this.icon.scale.x = Math.abs(this.icon.scale.x) * (this.data.mirrorX ? -1 : 1);
    // this.icon.scale.y = Math.abs(this.icon.scale.y) * (this.data.mirrorY ? -1 : 1);

    this.alpha = config.alpha;

    let filter = PIXI.filters[config.filter];
    if (filter) {
      this.filters = [new filter()];
    } else {
      this.filters = [];
    }

    // Adjust the scale to be relative to the token image so that when it gets attached
    // as a child of the token image and inherits its scale, their sizes match up
    // this.scale.x = this.token.texture.width / this.texture.width + config.scaleX;
    // this.scale.y = this.token.texture.height / this.texture.height + config.scaleY;

    // TEMP TEST
    // const xRatio = this.token.texture.width / this.texture.width;
    // const yRatio = this.token.texture.height / this.texture.height;

    // this.scale.x =

    // this.scale.x = 1 / Number(this.token.icon.scale.x) + config.scaleX;
    // this.scale.y = 1 / Number(this.token.icon.scale.y) + config.scaleY;
    // this.width = this.token.w * this.token.data.scale;
    // this.height = this.token.h * this.token.data.scale;

    // const tex = this.texture;
    // let aspect = tex.width / tex.height;
    // const scale = this.scale;
    // if (aspect >= 1) {
    //   this.width = this.token.w * this.token.data.scale;
    //   scale.y = Number(scale.x);
    // } else {
    //   this.height = this.token.h * this.token.data.scale;
    //   scale.x = Number(scale.y);
    // }

    // Mirror horizontally or vertically
    // this.scale.x = Math.abs(this.scale.x) * (token.data.mirrorX ? -1 : 1);
    // this.scale.y = Math.abs(this.scale.y) * (token.data.mirrorY ? -1 : 1);

    // Angle in degrees
    this.angle = config.linkRotation ? this.token.data.rotation + config.angle : config.angle;

    // Apply color tinting
    const tint = config.inheritTint ? this.token.data.tint : config.tint;
    this.tint = tint ? foundry.utils.colorStringToHex(tint) : 0xffffff;

    // Scale
    this.scale.x = this.scale.x * config.scaleX;
    this.scale.y = this.scale.y * config.scaleY;

    this.visible = true;
  }

  destroy() {
    if (this.texture?.baseTexture.resource.source?.tagName === 'VIDEO') {
      this.texture.baseTexture.destroy();
    }
    super.destroy();
  }
}
