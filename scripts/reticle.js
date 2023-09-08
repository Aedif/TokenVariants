import { TVASprite } from './sprite/TVASprite.js';

export class Reticle {
  static app;
  static fields;
  static brushOverlay;
  static active = false;
  static hitTest;
  static token = null;
  static dialog = null;

  // Offset calculation controls
  static mode = 'relative_static';
  static increment = 1;

  static _onBrushMove(event) {
    if (this.brushOverlay.isMouseDown) {
      const pos = event.data.getLocalPosition(this.brushOverlay);

      const increment = this.increment;

      this.config.pOffsetX = 0;
      this.config.pOffsetY = 0;
      this.config.offsetX = 0;
      this.config.offsetY = 0;

      this.tvaSprite.refresh(this.config, { preview: true });

      let center = { x: this.tvaSprite.x, y: this.tvaSprite.y };
      if (this.tvaSprite.overlayConfig.parentID) {
        let parent = this.tvaSprite;
        do {
          parent = parent.parent;
          center.x += parent.x;
          center.y = parent.y;
        } while (!(parent instanceof TVASprite));
      }

      console.log(center);

      if (this.mode === 'static') {
        this.config.pOffsetX = round(pos.x - center.x, increment);
        this.config.pOffsetY = round(pos.y - center.y, increment);
      } else if (this.mode === 'relative') {
        this.config.offsetX = -round(pos.x - center.x, increment) / this.tvaSprite.object.w;
        this.config.offsetY = -round(pos.y - center.y, increment) / this.tvaSprite.object.h;
      } else {
        let dx = round(pos.x - center.x, increment);
        let dy = round(pos.y - center.y, increment);
        let token = this.tvaSprite.object;

        const pWidth = this.tvaSprite.overlayConfig.parentID
          ? (this.tvaSprite.parent.shapesWidth ?? this.tvaSprite.parent.width) /
            this.tvaSprite.parent.scale.x
          : token.w;
        const pHeight = this.tvaSprite.overlayConfig.parentID
          ? (this.tvaSprite.parent.shapesHeight ?? this.tvaSprite.parent.height) /
            this.tvaSprite.parent.scale.y
          : token.h;

        if (Math.abs(dx) >= pWidth / 2) {
          this.config.offsetX = 0.5 * (dx < 0 ? 1 : -1);
          dx += (pWidth / 2) * (dx < 0 ? 1 : -1);
        } else if (Math.abs(dy) >= pHeight / 2) {
          this.config.offsetY = 0.5 * (dy < 0 ? 1 : -1);
          dy += (pHeight / 2) * (dy < 0 ? 1 : -1);
        }

        this.config.pOffsetX = dx;
        this.config.pOffsetY = dy;
      }

      // console.log({ x: this.config.pOffsetX, y: this.config.pOffsetY });
      this.tvaSprite.refresh(this.config, { preview: true });
    }
  }

  static activate({ tvaSprite = null, config = {}, app = null } = {}) {
    if (this.deactivate() || !canvas.ready) return false;
    if (!tvaSprite || !config) return false;

    if (this.brushOverlay) {
      this.brushOverlay.destroy(true);
    }

    const interaction = canvas.app.renderer.plugins.interaction;
    if (!interaction.cursorStyles['brush']) {
      interaction.cursorStyles['brush'] = "url('modules/token-variants/img/reticle.webp'), auto";
    }

    this.tvaSprite = tvaSprite;
    this.app = app;
    this.app.minimize();
    this.config = config;

    this.active = true;

    // Create the brush overlay
    this.brushOverlay = new PIXI.Container();
    this.brushOverlay.hitArea = canvas.dimensions.rect;
    this.brushOverlay.cursor = 'brush';
    this.brushOverlay.interactive = true;
    this.brushOverlay.zIndex = Infinity;

    this.brushOverlay.on('mousedown', (event) => {
      event.preventDefault();

      if (event.data.originalEvent.which != 2 && event.data.originalEvent.nativeEvent.which != 2) {
        this.brushOverlay.isMouseDown = true;
        this._onBrushMove(event);
      }
    });
    this.brushOverlay.on('pointermove', (event) => {
      event.preventDefault();
      this._onBrushMove(event);
    });
    this.brushOverlay.on('mouseup', (event) => {
      event.preventDefault();
      this.brushOverlay.isMouseDown = false;
    });
    this.brushOverlay.on('click', (event) => {
      event.preventDefault();
      if (event.data.originalEvent.which == 2 || event.data.originalEvent.nativeEvent.which == 2) {
        this.deactivate();
      }
    });

    canvas.stage.addChild(this.brushOverlay);
    this.dialog = displayControlDialog();
    return true;
  }

  static deactivate() {
    console.log('DEATIVATE');
    if (this.active) {
      if (this.brushOverlay) this.brushOverlay.parent?.removeChild(this.brushOverlay);
      this.active = false;
      this.tvaSprite = null;

      const form = $(this.app.form);

      ['pOffsetX', 'pOffsetY', 'offsetX', 'offsetY'].forEach((field) => {
        if (field in this.config) {
          form.find(`[name="${field}"]`).val(this.config[field]);
        }
      });

      form.find('[name="anchor.x"]').val(this.config.anchor.x);
      form.find('[name="anchor.y"]').val(this.config.anchor.y);

      if (this.app) this.app.maximize();
      this.app = null;
      this.config = null;
      if (this.dialog && this.dialog._state !== Application.RENDER_STATES.CLOSED)
        this.dialog.close(true);
      this.dialog = null;
      return true;
    }
  }
}

function displayControlDialog() {
  const d = new Dialog({
    title: 'Set Overlay Position',
    content: `
     <input type="radio" id="relative" name="mode" ${Reticle.mode === 'relative' ? 'checked' : ''}>
     <label for="relative">Relative (scale with token)</label><br>
     <input type="radio" id="static" name="mode" ${Reticle.mode === 'static' ? 'checked' : ''}>
     <label for="static">Static (fixed position no scaling)</label><br>
     <input type="radio" id="relative_static" name="mode" ${
       Reticle.mode === 'relative_static' ? 'checked' : ''
     }>
     <label for="relative_static">Smart (mix of scaling and fixed positioning)</label><br>
     <br>
     <div class="form-group">
      <label>Step Size</label>
      <div class="form-fields">
        <input type="number" name="step" min="0" step="1" value="${Reticle.increment}">
      </div>
      <label>Anchor</label>
      <div class="tva-anchor">
        <input type="radio" class="top left" name="anchor">
        <input type="radio" class="top center" name="anchor">
        <input type="radio" class="top right" name="anchor">
        <input type="radio" class="mid left" name="anchor">
        <input type="radio" class="mid center" name="anchor">
        <input type="radio" class="mid right" name="anchor">
        <input type="radio" class="bot left" name="anchor">
        <input type="radio" class="bot center" name="anchor">
        <input type="radio" class="bot right" name="anchor">
      </div>
     </div>
     `,
    buttons: {},
    render: (html) => {
      html.find('input[name="mode"]').on('change', (event) => {
        Reticle.mode = event.target.id;
      });

      html.find('input[name="anchor"]').on('change', (event) => {
        const anchor = $(event.target);
        let x;
        let y;
        if (anchor.hasClass('left')) x = 0;
        else if (anchor.hasClass('center')) x = 0.5;
        else x = 1;

        if (anchor.hasClass('top')) y = 0;
        else if (anchor.hasClass('mid')) y = 0.5;
        else y = 1;

        Reticle.config.anchor.x = x;
        Reticle.config.anchor.y = y;
      });

      html.find('[name="step"]').on('input', (event) => {
        console.log('step change');
        Reticle.increment = $(event.target).val() || 1;
      });
    },
    close: () => Reticle.deactivate(),
  });
  d.render(true);
  setTimeout(() => d.setPosition({ left: window.innerWidth / 2 - 200, top: 50 }), 100);
  return d;
}

function round(number, increment, offset = 0) {
  return Math.ceil((number - offset) / increment) * increment + offset;
}
