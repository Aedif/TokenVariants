export class HTMLOverlay {
  static container = null;
  static renderQueue = [];
  static hudReady = false;

  static hudRendered() {
    HTMLOverlay.hudReady = true;
    HTMLOverlay.renderQueue.forEach((ov) => ov._render());
    HTMLOverlay.renderQueue = [];
  }

  constructor(overlayConfig, token) {
    this.overlayConfig = overlayConfig;
    this.token = token;

    if (HTMLOverlay.hudReady) this._render();
    else HTMLOverlay.renderQueue.push(this);
  }

  _render() {
    if (!HTMLOverlay.container) {
      HTMLOverlay.container = $('<div id="tva-html-overlays"></div>');
      $('#hud').append(HTMLOverlay.container);
    }
    this.element = $(renderTemplate(this.overlayConfig, this.getData()));
    HTMLOverlay.container.append(this.element);
    this.setPosition();
  }

  remove() {
    this.element.remove();
  }

  getData(options = {}) {
    const data = this.token.document.toObject();
    return foundry.utils.mergeObject(data, {
      isGM: game.user.isGM,
    });
  }

  setPosition({ left, top, width, height, scale, angle, origin } = {}) {
    if (!HTMLOverlay.hudReady) return;
    const ratio = canvas.dimensions.size / 100;
    const position = {
      width: width || this.token.document.width * 100,
      height: height || this.token.document.height * 100,
      left: left ?? this.token.document.x,
      top: top ?? this.token.document.y,
    };
    if (ratio !== 1) position.transform = `scale(${ratio})`;
    this.element.css(position);
    if (angle != null) {
      this.element.css({ transform: 'rotate(' + angle + 'deg)' });
    }
    if (origin != null) {
      this.element.css({ 'transform-origin': origin.x + 'px ' + origin.y + 'px' });
    }
  }

  /** @override */
  activateListeners(html) {}
}

const _templateCache = {};

function constructTemplate(ovConfig) {
  if (!_templateCache.hasOwnProperty(ovConfig.id)) {
    const compiled = Handlebars.compile(
      '<form class="tva-html-overlay"><section class="window-content">' + ovConfig.html.template + '</section></form>'
    );
    Handlebars.registerPartial(ovConfig.id, compiled);
    _templateCache[ovConfig.id] = compiled;
  }
  return _templateCache[ovConfig.id];
}

function renderTemplate(ovConfig, data) {
  const template = constructTemplate(ovConfig);
  return template(data || {}, {
    allowProtoMethodsByDefault: true,
    allowProtoPropertiesByDefault: true,
  });
}
