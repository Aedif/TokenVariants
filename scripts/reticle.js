import EffectMappingForm from '../applications/effectMappingForm.js';
import OverlayConfig from '../applications/overlayConfig.js';
import { TVASprite } from './sprite/TVASprite.js';
import { evaluateOverlayExpressions } from './token/overlay.js';

export class Reticle {
  static app;
  static fields;
  static reticleOverlay;
  static active = false;
  static hitTest;
  static token = null;
  static dialog = null;

  // Offset calculation controls
  static mode = 'tooltip';
  static increment = 1;

  static _onReticleMove(event) {
    if (this.reticleOverlay.isMouseDown) {
      let pos = event.data.getLocalPosition(this.reticleOverlay);

      this.config.pOffsetX = 0;
      this.config.pOffsetY = 0;
      this.config.offsetX = 0;
      this.config.offsetY = 0;

      if (this.mode === 'token') {
        this.config.linkRotation = true;
        this.config.linkMirror = true;
      }

      this.tvaSprite.refresh(this.config, { preview: true });

      const tCoord = { x: this.tvaSprite.x, y: this.tvaSprite.y };

      if (this.tvaSprite.overlayConfig.parentID) {
        let parent = this.tvaSprite;
        do {
          parent = parent.parent;
          tCoord.x += parent.x;
          tCoord.y += parent.y;
        } while (!(parent instanceof TVASprite));
      }

      let dx = pos.x - tCoord.x;
      let dy = pos.y - tCoord.y;

      let angle = 0;
      if (!this.config.animation.relative) {
        angle = this.config.angle;
        if (this.config.linkRotation) angle += this.tvaSprite.object.document.rotation;
      }

      [dx, dy] = rotate(0, 0, dx, dy, angle);
      dx = round(dx, this.increment);
      dy = round(dy, this.increment);

      // let lPos = event.data.getLocalPosition(this.tvaSprite);
      // console.log(lPos);
      // // let dx = lPos.x;
      // // let dy = lPos.y;

      if (this.mode === 'static') {
        this.config.pOffsetX = dx;
        this.config.pOffsetY = dy;
      } else if (this.mode === 'token') {
        this.config.offsetX = -dx / this.tvaSprite.object.w;
        this.config.offsetY = -dy / this.tvaSprite.object.h;
      } else {
        let token = this.tvaSprite.object;

        let pWidth;
        let pHeight;

        if (this.tvaSprite.overlayConfig.parentID) {
          pWidth =
            (this.tvaSprite.parent.shapesWidth ?? this.tvaSprite.parent.width) /
            this.tvaSprite.parent.scale.x;
          pHeight =
            (this.tvaSprite.parent.shapesHeight ?? this.tvaSprite.parent.height) /
            this.tvaSprite.parent.scale.y;
        } else {
          pWidth = token.w;
          pHeight = token.h;
        }

        if (this.mode === 'tooltip') {
          if (Math.abs(dx) >= pWidth / 2) {
            this.config.offsetX = 0.5 * (dx < 0 ? 1 : -1);
            dx += (pWidth / 2) * (dx < 0 ? 1 : -1);
          } else {
            this.config.offsetX = -dx / this.tvaSprite.object.w;
            dx = 0;
          }

          if (Math.abs(dy) >= pHeight / 2) {
            this.config.offsetY = 0.5 * (dy < 0 ? 1 : -1);
            dy += (pHeight / 2) * (dy < 0 ? 1 : -1);
          } else {
            this.config.offsetY = -dy / this.tvaSprite.object.h;
            dy = 0;
          }
        } else {
          if (Math.abs(dx) >= pWidth / 2) {
            this.config.offsetX = 0.5 * (dx < 0 ? 1 : -1);
            dx += (pWidth / 2) * (dx < 0 ? 1 : -1);
          } else if (Math.abs(dy) >= pHeight / 2) {
            this.config.offsetY = 0.5 * (dy < 0 ? 1 : -1);
            dy += (pHeight / 2) * (dy < 0 ? 1 : -1);
          } else {
            this.config.offsetX = -dx / this.tvaSprite.object.w;
            dx = 0;
            this.config.offsetY = -dy / this.tvaSprite.object.h;
            dy = 0;
          }
        }

        this.config.pOffsetX = dx;
        this.config.pOffsetY = dy;
      }

      this.tvaSprite.refresh(this.config, { preview: true });
    }
  }

  static minimizeApps() {
    Object.values(ui.windows).forEach((app) => {
      if (app instanceof OverlayConfig || app instanceof EffectMappingForm) {
        app.minimize();
      }
    });
  }

  static maximizeApps() {
    Object.values(ui.windows).forEach((app) => {
      if (app instanceof OverlayConfig || app instanceof EffectMappingForm) {
        app.maximize();
      }
    });
  }

  static activate({ tvaSprite = null, config = {} } = {}) {
    if (this.deactivate() || !canvas.ready) return false;
    if (!tvaSprite || !config) return false;

    if (this.reticleOverlay) {
      this.reticleOverlay.destroy(true);
    }

    const interaction = canvas.app.renderer.plugins.interaction;
    if (!interaction.cursorStyles['reticle']) {
      interaction.cursorStyles['reticle'] = "url('modules/token-variants/img/reticle.webp'), auto";
    }

    this.tvaSprite = tvaSprite;

    this.minimizeApps();
    this.config = evaluateOverlayExpressions(deepClone(config), this.tvaSprite.object, {
      overlayConfig: config,
    });

    // Setup the overlay to be always visible while we're adjusting its position
    this.config.alwaysVisible = true;

    this.active = true;

    // Create the reticle overlay
    this.reticleOverlay = new PIXI.Container();
    this.reticleOverlay.hitArea = canvas.dimensions.rect;
    this.reticleOverlay.cursor = 'reticle';
    this.reticleOverlay.interactive = true;
    this.reticleOverlay.zIndex = Infinity;

    const stopEvent = function (event) {
      event.preventDefault();
      // event.stopPropagation();
    };

    this.reticleOverlay.on('mousedown', (event) => {
      event.preventDefault();

      if (event.data.originalEvent.which != 2 && event.data.originalEvent.nativeEvent.which != 2) {
        this.reticleOverlay.isMouseDown = true;
        this._onReticleMove(event);
      }
    });
    this.reticleOverlay.on('pointermove', (event) => {
      event.preventDefault();
      // event.stopPropagation();
      this._onReticleMove(event);
    });
    this.reticleOverlay.on('mouseup', (event) => {
      event.preventDefault();
      this.reticleOverlay.isMouseDown = false;
    });
    this.reticleOverlay.on('click', (event) => {
      event.preventDefault();
      if (event.data.originalEvent.which == 2 || event.data.originalEvent.nativeEvent.which == 2) {
        this.deactivate();
      }
    });

    canvas.stage.addChild(this.reticleOverlay);
    this.dialog = displayControlDialog();
    return true;
  }

  static deactivate() {
    if (this.active) {
      if (this.reticleOverlay) this.reticleOverlay.parent?.removeChild(this.reticleOverlay);
      this.active = false;
      this.tvaSprite = null;
      if (this.dialog && this.dialog._state !== Application.RENDER_STATES.CLOSED)
        this.dialog.close(true);
      this.dialog = null;
      this.maximizeApps();

      const app = Object.values(ui.windows).find((app) => app instanceof OverlayConfig);
      if (!app) {
        this.config = null;
        return;
      }
      const form = $(app.form);

      ['pOffsetX', 'pOffsetY', 'offsetX', 'offsetY'].forEach((field) => {
        if (field in this.config) {
          form.find(`[name="${field}"]`).val(this.config[field]);
        }
      });

      if (this.mode === 'token') {
        ['linkRotation', 'linkMirror'].forEach((field) => {
          form.find(`[name="${field}"]`).prop('checked', true);
        });
        ['linkDimensionsX', 'linkDimensionsY'].forEach((field) => {
          form.find(`[name="${field}"]`).prop('checked', false);
        });
      } else {
        ['linkRotation', 'linkMirror'].forEach((field) => {
          form.find(`[name="${field}"]`).prop('checked', false);
        });
      }

      form.find('[name="anchor.x"]').val(this.config.anchor.x);
      form.find('[name="anchor.y"]').val(this.config.anchor.y).trigger('change');
      this.config = null;

      return true;
    }
  }
}

function displayControlDialog() {
  const d = new Dialog({
    title: 'Set Overlay Position',
    content: `
      <style>
        .images { display: flex; }
        .images a { flex: 20%; width: 50px; margin: 2px; }
        .images a.active img { border-color: orange; border-width: 2px; }
        .anchorlbl {margin: auto; display: table; }
      </style>
      <div class="images">
        <a data-id="token"><img src="modules/token-variants/img/token_mode.png"></img></a>
        <a data-id="tooltip"><img src="modules/token-variants/img/tooltip_mode.png"></img></a>
        <a data-id="hud"><img src="modules/token-variants/img/hud_mode.png"></img></a>
        <a data-id="static"><img src="modules/token-variants/img/static_mode.png"></img></a>
      </div>
     <br>
      <label class="anchorlbl">Anchor</label>
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
      <div class="form-group">
        <label>Step Size</label>
        <div class="form-fields">
          <input type="number" name="step" min="0" step="1" value="${Reticle.increment}">
        </div>
      </div>
      <p class="notes"><b>Left-Click</b> to move the overlay</p>
      <p class="notes"><b>Middle-Click</b> or <b>Close Dialog</b> to exit overlay positioning</p>
     `,
    buttons: {},
    render: (html) => {
      // Mode Images
      const images = html.find('.images a');
      html.find('.images a').on('click', (event) => {
        images.removeClass('active');
        const target = $(event.target).closest('a');
        target.addClass('active');
        Reticle.mode = target.data('id');
      });
      html.find(`[data-id="${Reticle.mode}"]`).addClass('active');

      // Anchor
      let anchorX = Reticle.config?.anchor?.x || 0;
      let anchorY = Reticle.config?.anchor?.y || 0;

      let classes = '';
      if (anchorX < 0.5) classes += '.left';
      else if (anchorX > 0.5) classes += '.right';
      else classes += '.center';

      if (anchorY < 0.5) classes += '.top';
      else if (anchorY > 0.5) classes += '.bot';
      else classes += '.mid';

      html.find('.tva-anchor').find(classes).prop('checked', true);
      // end -  Pre-select anchor

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
        Reticle.increment = $(event.target).val() || 1;
      });
    },
    close: () => Reticle.deactivate(),
  });
  d.render(true);
  setTimeout(() => d.setPosition({ left: 200, top: window.innerHeight / 2, height: 'auto' }), 100);
  return d;
}

function round(number, increment, offset = 0) {
  return Math.ceil((number - offset) / increment) * increment + offset;
}

function rotate(cx, cy, x, y, angle) {
  var radians = (Math.PI / 180) * angle,
    cos = Math.cos(radians),
    sin = Math.sin(radians),
    nx = cos * (x - cx) + sin * (y - cy) + cx,
    ny = cos * (y - cy) - sin * (x - cx) + cy;
  return [nx, ny];
}
