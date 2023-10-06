export class HTMLOverlay {
  static container = null;
  static renderQueue = [];
  static hudReady = false;

  static hudRendered() {
    HTMLOverlay.hudReady = true;
    HTMLOverlay.renderQueue.forEach((ov) => ov.render());
    HTMLOverlay.renderQueue = [];
  }

  constructor(overlayConfig, token) {
    this.overlayConfig = overlayConfig;
    this.token = token;
    this.render();
  }

  render(overlayConfig = null, force = false) {
    if (!HTMLOverlay.hudReady) {
      HTMLOverlay.renderQueue.push(this);
      return;
    }

    if (!HTMLOverlay.container) {
      HTMLOverlay.container = $('<div id="tva-html-overlays"></div>');
      $('#hud').append(HTMLOverlay.container);
    }

    if (this.element) this.remove();
    if (overlayConfig) this.overlayConfig = overlayConfig;

    this.element = $(renderTemplate(this.overlayConfig, this.getData(), force));
    HTMLOverlay.container.append(this.element);
    this.activateListeners(this.element);
    this.setPosition();
  }

  remove() {
    if (this.element) this.element.remove();
    this.element = null;
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
  activateListeners(html) {
    try {
      eval(this.overlayConfig.html.listeners);
    } catch (e) {}
  }
}

const _templateCache = {};

function _compile(stringHTML) {
  return Handlebars.compile(
    '<div class="tva-html-overlay"> <section class="window-content"><form>' + stringHTML + '</form></section></div>'
  );
}

function constructTemplate(ovConfig, force = false) {
  if (!_templateCache.hasOwnProperty(ovConfig.id)) {
    const compiled = _compile(ovConfig.html.template);
    Handlebars.registerPartial(ovConfig.id, compiled);
    _templateCache[ovConfig.id] = compiled;
  } else if (force) {
    return _compile(ovConfig.html.template);
  }
  return _templateCache[ovConfig.id];
}

function renderTemplate(ovConfig, data, force = false) {
  const template = constructTemplate(ovConfig, force);
  console.log(data.x);
  return template(data || {}, {
    allowProtoMethodsByDefault: true,
    allowProtoPropertiesByDefault: true,
  });
}
