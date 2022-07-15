export class TVA_Sprite extends PIXI.Sprite {
  constructor(texture, token, config) {
    super(texture);

    this.tva_config = mergeObject(
      {
        alpha: 1,
        scaleX: 0,
        scaleY: 0,
        offsetX: 0,
        offsetY: 0,
        filter: 'NONE',
        inheritTint: false,
        tint: null,
        loop: true,
      },
      config
    );
    this.token = token;
    this._tvaPlay();
    this.refreshConfig();
  }

  async _tvaPlay() {
    // Ensure playback state for video
    const source = foundry.utils.getProperty(this.texture, 'baseTexture.resource.source');
    if (source && source.tagName === 'VIDEO') {
      // Detach video from others
      const s = source.cloneNode();

      s.loop = this.tva_config.loop;
      s.muted = true;
      s.onplay = () => (s.currentTime = 0);

      await new Promise((resolve) => (s.oncanplay = resolve));
      this.texture = PIXI.Texture.from(s, { resourceOptions: { autoPlay: false } });
      game.video.play(s);
    }
  }

  refreshConfig(configuration) {
    const config = mergeObject(this.tva_config, configuration ?? {});

    this.anchor.set(0.5 + config.offsetX, 0.5 + config.offsetY);
    this.alpha = config.alpha;

    let filter = PIXI.filters[config.filter];
    if (filter) {
      this.filters = [new filter()];
    }

    // Adjust the scale to be relative to the token image so that when it gets attached
    // as a child of the token image and inherits its scale, their sizes match up
    this.scale.x = this.token.texture.width / this.texture.width + config.scaleX;
    this.scale.y = this.token.texture.height / this.texture.height + config.scaleY;

    // Apply color tinting
    const tint = config.inheritTint ? this.token.data.tint : config.tint;
    this.tint = tint ? foundry.utils.colorStringToHex(tint) : 0xffffff;

    const source = foundry.utils.getProperty(this.texture, 'baseTexture.resource.source');
    if (source && source.tagName === 'VIDEO') {
      if (!source.loop && config.loop) {
        game.video.play(source);
      } else if (source.loop && !config.loop) {
        game.video.stop(source);
      }
      source.loop = config.loop;
    }
  }

  destroy() {
    if (this.texture?.baseTexture.resource.source?.tagName === 'VIDEO') {
      this.texture.baseTexture.destroy();
      console.log('destoryed video');
    }
    super.destroy();
  }
}
