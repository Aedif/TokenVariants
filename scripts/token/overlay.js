import { TVA_CONFIG } from '../settings.js';
import { TVASprite } from '../sprite/TVASprite.js';
import { string2Hex, waitForTokenTexture } from '../utils.js';
import { getAllEffectMappings, getTokenEffects, getTokenHP } from '../hooks/effectMappingHooks.js';

export async function drawOverlays(token) {
  if (token.tva_drawing_overlays) return;
  token.tva_drawing_overlays = true;

  const mappings = getAllEffectMappings(token);
  let filteredOverlays = getTokenEffects(token, true);
  filteredOverlays = mappings
    .filter((m) => m.overlay && filteredOverlays.includes(m.id))
    .sort(
      (m1, m2) =>
        (m1.priority - m1.overlayConfig?.parent ? 0 : 999) - (m2.priority - m2.overlayConfig?.parent ? 0 : 999)
    )
    .map((m) => {
      const overlayConfig = m.overlayConfig ?? {};
      overlayConfig.label = m.label;
      return overlayConfig;
    });

  // See if the whole stack or just top of the stack should be used according to settings
  let overlays = [];
  if (filteredOverlays.length) {
    overlays = TVA_CONFIG.stackStatusConfig ? filteredOverlays : [filteredOverlays[filteredOverlays.length - 1]];
  }

  // Process strings as expressions
  overlays = overlays.map((ov) => evaluateObjExpressions(deepClone(ov), token, ov));

  if (overlays.length) {
    waitForTokenTexture(token, async (token) => {
      if (!token.tva_sprites) token.tva_sprites = [];
      // Temporarily mark every overlay for removal.
      // We'll only keep overlays that are still applicable to the token
      _markAllOverlaysForRemoval(token);

      // To keep track of the overlay order
      let overlaySort = 0;
      let underlaySort = 0;
      for (const ov of overlays) {
        let sprite = _findTVASprite(ov.label, token);
        if (sprite) {
          const diff = diffObject(sprite.overlayConfig, ov);

          // Check if we need to create a new texture or simply refresh the overlay
          if (!isEmpty(diff)) {
            if (ov.img?.includes('*') || (ov.img?.includes('{') && ov.img?.includes('}'))) {
              sprite.refresh(ov);
            } else if (diff.img || diff.text || diff.shapes) {
              sprite.setTexture(await genTexture(token, ov), { configuration: ov });
            } else if (diff.parent) {
              sprite.parent?.removeChild(sprite)?.destroy();
              sprite = null;
            } else {
              sprite.refresh(ov);
            }
          } else if (diff.text?.text || diff.shapes) {
            sprite.setTexture(await genTexture(token, ov), { configuration: ov });
          }
        }
        if (!sprite) {
          if (ov.parent) {
            const parent = _findTVASprite(ov.parent, token);
            if (parent) sprite = parent.addChild(new TVASprite(await genTexture(token, ov), token, ov));
          } else {
            sprite = canvas.primary.addChild(new TVASprite(await genTexture(token, ov), token, ov));
          }
          if (sprite) token.tva_sprites.push(sprite);
        }

        if (sprite) {
          sprite.tvaRemove = false; // Sprite in use, do not remove

          // Assign order to the overlay
          if (sprite.overlayConfig.underlay) {
            underlaySort -= 0.01;
            sprite.overlaySort = underlaySort;
          } else {
            overlaySort += 0.01;
            sprite.overlaySort = overlaySort;
          }
        }
      }

      removeMarkedOverlays(token);
      token.tva_drawing_overlays = false;
    });
  } else {
    _removeAllOverlays(token);
    token.tva_drawing_overlays = false;
  }
}

export async function genTexture(token, conf) {
  if (conf.img?.trim()) {
    let img = conf.img;
    if (conf.img.includes('*') || (conf.img.includes('{') && conf.img.includes('}'))) {
      const images = await wildcardImageSearch(conf.img);
      if (images.length) {
        if (images.length) {
          img = images[Math.floor(Math.random() * images.length)];
        }
      }
    }

    return await loadTexture(img, {
      fallback: 'modules/token-variants/img/token-images.svg',
    });
  } else if (conf.text?.text != null) {
    return await generateTextTexture(token, conf);
  } else if (conf.shapes?.length) {
    return await generateShapeTexture(token, conf);
  } else {
    return await loadTexture('modules/token-variants/img/token-images.svg');
  }
}

export async function generateShapeTexture(token, conf) {
  let graphics = new PIXI.Graphics();

  for (const obj of conf.shapes) {
    let fillColor;
    if (obj.fill.color2 && getType(obj.fill.prc) === 'number') {
      fillColor = interpolateColor(obj.fill.color, obj.fill.color2, obj.fill.prc);
    } else {
      fillColor = string2Hex(obj.fill.color);
    }
    graphics.beginFill(fillColor, obj.fill.alpha);
    graphics.lineStyle(obj.line.width, string2Hex(obj.line.color), obj.line.alpha);
    const shape = obj.shape;
    if (shape.type === 'rectangle') {
      graphics.drawRoundedRect(shape.x, shape.y, shape.width, shape.height, shape.radius);
    } else if (shape.type === 'ellipse') {
      graphics.drawEllipse(shape.x, shape.y, shape.width, shape.height);
    } else if (shape.type === 'polygon') {
      graphics.drawPolygon(
        shape.points.split(',').map((p, i) => Number(p) * shape.scale + (i % 2 === 0 ? shape.x : shape.y))
      );
    }
  }

  const container = new PIXI.Container();
  container.addChild(graphics);
  const bounds = container.getLocalBounds();
  const matrix = new PIXI.Matrix();
  matrix.tx = -bounds.x;
  matrix.ty = -bounds.y;

  const renderTexture = PIXI.RenderTexture.create({
    width: bounds.width,
    height: bounds.height,
    resolution: 2,
  });

  if (isNewerVersion('11', game.version)) {
    canvas.app.renderer.render(container, renderTexture, true, matrix, false);
  } else {
    canvas.app.renderer.render(container, {
      renderTexture,
      clear: true,
      transform: matrix,
      skipUpdateTransform: false,
    });
  }

  renderTexture.shapes = deepClone(conf.shapes);
  return renderTexture;
}

function interpolateColor(minColor, maxColor, percentage) {
  minColor = new PIXI.Color(minColor);
  maxColor = new PIXI.Color(maxColor);

  let minHsv = rgb2hsv(minColor.red, minColor.green, minColor.blue);
  let maxHsv = rgb2hsv(maxColor.red, maxColor.green, maxColor.blue);

  let deltaHue = maxHsv[0] - minHsv[0];
  let deltaAngle = deltaHue + (Math.abs(deltaHue) > 180 ? (deltaHue < 0 ? 360 : -360) : 0);

  let targetHue = minHsv[0] + deltaAngle * percentage;
  let targetSaturation = (1 - percentage) * minHsv[1] + percentage * maxHsv[1];
  let targetValue = (1 - percentage) * minHsv[2] + percentage * maxHsv[2];

  let result = new PIXI.Color({ h: targetHue, s: targetSaturation * 100, v: targetValue * 100 });
  return result.toNumber();
}

/**
 * Converts a color from RGB to HSV space.
 * Source: https://stackoverflow.com/questions/8022885/rgb-to-hsv-color-in-javascript/54070620#54070620
 */
function rgb2hsv(r, g, b) {
  let v = Math.max(r, g, b),
    c = v - Math.min(r, g, b);
  let h = c && (v == r ? (g - b) / c : v == g ? 2 + (b - r) / c : 4 + (r - g) / c);
  return [60 * (h < 0 ? h + 6 : h), v && c / v, v];
}

function _evaluateString(str, token, conf = null) {
  const re = new RegExp('{{.*?}}', 'gi');
  return str
    .replace(re, function replace(match) {
      const property = match.substring(2, match.length - 2);
      if (conf && property === 'effect') return conf.label;
      else if (token && property === 'hp') return getTokenHP(token)?.[0];
      else if (token && property === 'hpMax') return getTokenHP(token)?.[1];
      const val = getProperty(token.document ?? token, property);
      return val === undefined ? match : val;
    })
    .replace('\\n', '\n');
}

// Evaluate provided object values substituting in {{path.to.property}} with token properties, and performing eval() on strings
export function evaluateObjExpressions(obj, token, conf = null) {
  const t = getType(obj);
  if (t === 'string') {
    const str = _evaluateString(obj, token, conf);
    try {
      return eval(str);
    } catch (e) {}
    return str;
  } else if (t === 'Array') {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = evaluateObjExpressions(obj[i], token, conf);
    }
  } else if (t === 'Object') {
    for (const [k, v] of Object.entries(obj)) {
      // Exception for text overlay
      if (k === 'text' && getType(v) === 'string' && v) {
        obj[k] = _evaluateString(v, token, conf);
      } else obj[k] = evaluateObjExpressions(v, token, conf);
    }
  }
  return obj;
}

export async function generateTextTexture(token, conf) {
  let label = conf.text.text;

  let text = new PreciseText(
    label,
    PreciseText.getTextStyle({
      ...conf.text,
      fontFamily: [conf.text.fontFamily, 'fontAwesome'],
    })
  );
  text.updateText(false);

  if (!conf.text.curve?.radius) {
    text.texture.textLabel = label;
    return text.texture;
  }

  // Curve
  const curve = conf.text.curve;
  const radius = curve.radius;
  const maxRopePoints = 100;
  const step = Math.PI / maxRopePoints;

  let ropePoints = maxRopePoints - Math.round((text.texture.width / (radius * Math.PI)) * maxRopePoints);
  ropePoints /= 2;

  const points = [];
  for (let i = maxRopePoints - ropePoints; i > ropePoints; i--) {
    const x = radius * Math.cos(step * i);
    const y = radius * Math.sin(step * i);
    points.push(new PIXI.Point(x, curve.invert ? y : -y));
  }

  const container = new PIXI.Container();
  const rope = new PIXI.SimpleRope(text.texture, points);
  container.addChild(rope);
  const bounds = container.getLocalBounds();
  const matrix = new PIXI.Matrix();
  matrix.tx = -bounds.x;
  matrix.ty = -bounds.y;

  const renderTexture = PIXI.RenderTexture.create({
    width: bounds.width,
    height: bounds.height,
    resolution: 2,
  });
  // const renderTexture = PIXI.RenderTexture.create(bounds.width, bounds.height);

  if (isNewerVersion('11', game.version)) {
    canvas.app.renderer.render(container, renderTexture, true, matrix, false);
  } else {
    canvas.app.renderer.render(container, {
      renderTexture,
      clear: true,
      transform: matrix,
      skipUpdateTransform: false,
    });
  }
  text.destroy();

  renderTexture.textLabel = label;
  return renderTexture;
}

function _markAllOverlaysForRemoval(token) {
  for (const child of token.tva_sprites) {
    if (child instanceof TVASprite) {
      child.tvaRemove = true;
    }
  }
}

export function removeMarkedOverlays(token) {
  const sprites = [];
  for (const child of token.tva_sprites) {
    if (child.tvaRemove) {
      child.parent?.removeChild(child)?.destroy();
    } else {
      sprites.push(child);
    }
  }
  token.tva_sprites = sprites;
}

function _findTVASprite(label, token) {
  for (const child of token.tva_sprites) {
    if (child.overlayConfig?.label === label) {
      return child;
    }
  }
  return null;
}

function _removeAllOverlays(token) {
  if (token.tva_sprites)
    for (const child of token.tva_sprites) {
      child.parent?.removeChild(child)?.destroy();
    }
  token.tva_sprites = null;
}

export function broadcastOverlayRedraw(token) {
  // Need to broadcast to other users to re-draw the overlay
  if (token) drawOverlays(token);
  const actorId = token.document?.actorLink ? token.actor?.id : null;
  const message = {
    handlerName: 'drawOverlays',
    args: { tokenId: token.id, actorId },
    type: 'UPDATE',
  };
  game.socket?.emit('module.token-variants', message);
}
