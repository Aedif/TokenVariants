import { TVA_CONFIG } from '../settings.js';
import { TVAOverlay } from '../sprite/TVAOverlay.js';
import { string2Hex, waitForTokenTexture } from '../utils.js';
import { getAllEffectMappings, getTokenEffects, getTokenHP } from '../hooks/effectMappingHooks.js';

export const FONT_LOADING = {};

export async function drawOverlays(token) {
  if (token.tva_drawing_overlays) return;
  token.tva_drawing_overlays = true;

  const mappings = getAllEffectMappings(token);
  const effects = getTokenEffects(token, true);
  let processedMappings = mappings
    .filter((m) => m.overlay && effects.includes(m.id))
    .sort(
      (m1, m2) =>
        (m1.priority - m1.overlayConfig?.parentID ? 0 : 999) - (m2.priority - m2.overlayConfig?.parentID ? 0 : 999)
    );

  // See if the whole stack or just top of the stack should be used according to settings
  if (processedMappings.length) {
    processedMappings = TVA_CONFIG.stackStatusConfig
      ? processedMappings
      : [processedMappings[processedMappings.length - 1]];
  }

  // Process strings as expressions
  const overlays = processedMappings.map((m) => evaluateOverlayExpressions(deepClone(m.overlayConfig), token, m));

  if (overlays.length) {
    waitForTokenTexture(token, async (token) => {
      if (!token.tvaOverlays) token.tvaOverlays = [];
      // Temporarily mark every overlay for removal.
      // We'll only keep overlays that are still applicable to the token
      _markAllOverlaysForRemoval(token);

      // To keep track of the overlay order
      let overlaySort = 0;
      let underlaySort = 0;
      for (const ov of overlays) {
        let sprite = _findTVAOverlay(ov.id, token);
        if (sprite) {
          _evaluateLinkedImages(ov, token.document.texture.src);

          const diff = diffObject(sprite.overlayConfig, ov);

          // Check if we need to create a new texture or simply refresh the overlay
          if (!isEmpty(diff)) {
            if (ov.img instanceof Array && ov.img.length > 1) {
              sprite.refresh(ov);
            } else if (diff.img || diff.text || diff.shapes || diff.repeat || diff.html) {
              sprite.setTexture(await genTexture(token, ov), { configuration: ov });
            } else if (diff.parentID) {
              sprite.parent?.removeChild(sprite)?.destroy();
              sprite = null;
            } else {
              sprite.refresh(ov);
            }
          } else if (diff.text?.text || diff.shapes) {
            sprite.setTexture(await genTexture(token, ov), { configuration: ov });
          }

          if ('ui' in diff) {
            sprite.parent.removeChild(sprite);
            const layer = ov.ui ? canvas.tokens : canvas.primary;
            sprite = layer.addChild(sprite);
          }
        }
        if (!sprite) {
          if (ov.parentID) {
            const parent = _findTVAOverlay(ov.parentID, token);
            if (parent && !parent.tvaRemove)
              sprite = parent.addChildAuto(new TVAOverlay(await genTexture(token, ov), token, ov));
          } else {
            const layer = ov.ui ? canvas.tokens : canvas.primary;
            sprite = layer.addChild(new TVAOverlay(await genTexture(token, ov), token, ov));
          }
          if (sprite) token.tvaOverlays.push(sprite);
        }

        // If the sprite has a parent confirm that the parent has not been removed
        if (sprite?.overlayConfig.parentID) {
          const parent = _findTVAOverlay(sprite.overlayConfig.parentID, token);
          if (!parent || parent.tvaRemove) sprite = null;
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

function _evaluateLinkedImages(ov, tokenImage) {
  if (ov.img instanceof Array) {
    for (const img of ov.img) {
      if (img.linked) img.src = tokenImage;
    }
  } else if (ov.imgLinked) ov.img = tokenImage;
}

// function _getLayer(ov) {
//   const layer = ov.ui ? canvas.tokens : canvas.primary;
//   if (!layer.tvaOverlay) layer.tvaOverlays = layer.addChild(new PIXI.Container());
//   return layer.tvaOverlays;
// }

export async function genTexture(token, conf) {
  if (conf.img) {
    return await generateImage(token, conf);
  } else if (conf.text?.text != null) {
    return await generateTextTexture(token, conf);
  } else if (conf.shapes?.length) {
    return await generateShapeTexture(token, conf.shapes);
  } else if (conf.html?.template) {
    return { html: true, texture: await loadTexture('modules\\token-variants\\img\\html_bg.webp') };
  } else {
    return {
      texture: await loadTexture('modules/token-variants/img/token-images.svg'),
    };
  }
}

async function generateImage(token, conf) {
  _evaluateLinkedImages(conf, token.document.texture.src);

  let img = conf.img;

  if (img instanceof Array) {
    img = img[Math.floor(Math.random() * img.length)].src;
  }

  let texture = await loadTexture(img, {
    fallback: 'modules/token-variants/img/token-images.svg',
  });

  // Repeat image if needed
  // Repeating the shape if necessary
  if (conf.repeating && conf.repeat) {
    const repeat = conf.repeat;
    let numRepeats;
    if (repeat.isPercentage) {
      numRepeats = Math.ceil(repeat.value / repeat.maxValue / (repeat.increment / 100));
    } else {
      numRepeats = Math.ceil(repeat.value / repeat.increment);
    }
    let n = 0;
    let rows = 0;
    const maxRows = repeat.maxRows ?? Infinity;
    let xOffset = 0;
    let yOffset = 0;
    const paddingX = repeat.paddingX ?? 0;
    const paddingY = repeat.paddingY ?? 0;
    let container = new PIXI.Container();
    while (numRepeats > 0) {
      let img = new PIXI.Sprite(texture);
      img.x = xOffset;
      img.y = yOffset;
      container.addChild(img);
      xOffset += texture.width + paddingX;
      numRepeats--;
      n++;
      if (numRepeats != 0 && n >= repeat.perRow) {
        rows += 1;
        if (rows >= maxRows) break;
        yOffset += texture.height + paddingY;
        xOffset = 0;
        n = 0;
      }
    }

    texture = _renderContainer(container, texture.resolution);
  }

  return { texture };
}

function _renderContainer(container, resolution, { width = null, height = null } = {}) {
  const bounds = container.getLocalBounds();
  const matrix = new PIXI.Matrix();
  matrix.tx = -bounds.x;
  matrix.ty = -bounds.y;

  const renderTexture = PIXI.RenderTexture.create({
    width: width ?? bounds.width,
    height: height ?? bounds.height,
    resolution: resolution,
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
  renderTexture.destroyable = true;
  return renderTexture;
}

// Return width and height of the drawn shape
function _drawShape(graphics, shape, xOffset = 0, yOffset = 0) {
  if (shape.type === 'rectangle') {
    graphics.drawRoundedRect(shape.x + xOffset, shape.y + yOffset, shape.width, shape.height, shape.radius);
    return [shape.width, shape.height];
  } else if (shape.type === 'ellipse') {
    graphics.drawEllipse(shape.x + xOffset + shape.width, shape.y + yOffset + shape.height, shape.width, shape.height);
    return [shape.width * 2, shape.height * 2];
  } else if (shape.type === 'polygon') {
    graphics.drawPolygon(
      shape.points.split(',').map((p, i) => Number(p) * shape.scale + (i % 2 === 0 ? shape.x : shape.y))
    );
  } else if (shape.type === 'torus') {
    drawTorus(
      graphics,
      shape.x + xOffset + shape.outerRadius,
      shape.y + yOffset + shape.outerRadius,
      shape.innerRadius,
      shape.outerRadius,
      Math.toRadians(shape.startAngle),
      shape.endAngle >= 360 ? Math.PI * 2 : Math.toRadians(shape.endAngle)
    );
    return [shape.outerRadius * 2, shape.outerRadius * 2];
  }
}

export async function generateShapeTexture(token, shapes) {
  let graphics = new PIXI.Graphics();

  for (const obj of shapes) {
    graphics.beginFill(interpolateColor(obj.fill.color, obj.fill.interpolateColor), obj.fill.alpha);
    graphics.lineStyle(obj.line.width, string2Hex(obj.line.color), obj.line.alpha);

    const shape = obj.shape;

    // Repeating the shape if necessary
    if (obj.repeating && obj.repeat) {
      const repeat = obj.repeat;
      let numRepeats;
      if (repeat.isPercentage) {
        numRepeats = Math.ceil(repeat.value / repeat.maxValue / (repeat.increment / 100));
      } else {
        numRepeats = Math.ceil(repeat.value / repeat.increment);
      }
      let n = 0;
      let rows = 0;
      const maxRows = repeat.maxRows ?? Infinity;
      let xOffset = 0;
      let yOffset = 0;
      const paddingX = repeat.paddingX ?? 0;
      const paddingY = repeat.paddingY ?? 0;
      while (numRepeats > 0) {
        const [width, height] = _drawShape(graphics, shape, xOffset, yOffset);
        xOffset += width + paddingX;
        numRepeats--;
        n++;
        if (numRepeats != 0 && n >= repeat.perRow) {
          rows += 1;
          if (rows >= maxRows) break;
          yOffset += height + paddingY;
          xOffset = 0;
          n = 0;
        }
      }
    } else {
      _drawShape(graphics, shape);
    }
  }

  // Store original graphics dimensions as these may change when children are added
  graphics.shapesWidth = Number(graphics.width);
  graphics.shapesHeight = Number(graphics.height);

  return { texture: PIXI.Texture.EMPTY, shapes: graphics };
}

function drawTorus(graphics, x, y, innerRadius, outerRadius, startArc = 0, endArc = Math.PI * 2) {
  if (Math.abs(endArc - startArc) >= Math.PI * 2) {
    return graphics.drawCircle(x, y, outerRadius).beginHole().drawCircle(x, y, innerRadius).endHole();
  }

  graphics.finishPoly();
  graphics.arc(x, y, innerRadius, endArc, startArc, true).arc(x, y, outerRadius, startArc, endArc, false).finishPoly();
}

export function interpolateColor(minColor, interpolate, rString = false) {
  if (!interpolate || !interpolate.color2 || !interpolate.prc) return rString ? minColor : string2Hex(minColor);

  if (!PIXI.Color) return _interpolateV10(minColor, interpolate, rString);

  const percentage = interpolate.prc;
  minColor = new PIXI.Color(minColor);
  const maxColor = new PIXI.Color(interpolate.color2);

  let minHsv = rgb2hsv(minColor.red, minColor.green, minColor.blue);
  let maxHsv = rgb2hsv(maxColor.red, maxColor.green, maxColor.blue);

  let deltaHue = maxHsv[0] - minHsv[0];
  let deltaAngle = deltaHue + (Math.abs(deltaHue) > 180 ? (deltaHue < 0 ? 360 : -360) : 0);

  let targetHue = minHsv[0] + deltaAngle * percentage;
  let targetSaturation = (1 - percentage) * minHsv[1] + percentage * maxHsv[1];
  let targetValue = (1 - percentage) * minHsv[2] + percentage * maxHsv[2];

  let result = new PIXI.Color({ h: targetHue, s: targetSaturation * 100, v: targetValue * 100 });
  return rString ? result.toHex() : result.toNumber();
}

function _interpolateV10(minColor, interpolate, rString = false) {
  const percentage = interpolate.prc;
  minColor = PIXI.utils.hex2rgb(string2Hex(minColor));
  const maxColor = PIXI.utils.hex2rgb(string2Hex(interpolate.color2));

  let minHsv = rgb2hsv(minColor[0], minColor[1], minColor[2]);
  let maxHsv = rgb2hsv(maxColor[0], maxColor[1], maxColor[2]);

  let deltaHue = maxHsv[0] - minHsv[0];
  let deltaAngle = deltaHue + (Math.abs(deltaHue) > 180 ? (deltaHue < 0 ? 360 : -360) : 0);

  let targetHue = minHsv[0] + deltaAngle * percentage;
  let targetSaturation = (1 - percentage) * minHsv[1] + percentage * maxHsv[1];
  let targetValue = (1 - percentage) * minHsv[2] + percentage * maxHsv[2];

  let result = Color.fromHSV([targetHue / 360, targetSaturation, targetValue]);
  return rString ? result.toString() : Number(result);
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

const CORE_VARIABLES = {
  '@hp': (token) => getTokenHP(token)?.[0],
  '@hpMax': (token) => getTokenHP(token)?.[1],
  '@gridSize': () => canvas.grid?.size,
  '@label': (_, conf) => conf.label,
};

function _evaluateString(str, token, conf) {
  let variables = conf.overlayConfig?.variables;
  const re2 = new RegExp('@\\w+', 'gi');
  str = str.replace(re2, function replace(match) {
    let name = match.substr(1, match.length);
    let v = variables?.find((v) => v.name === name);
    if (v) return v.value;
    else if (match in CORE_VARIABLES) return CORE_VARIABLES[match](token, conf);
    return match;
  });

  const re = new RegExp('{{.*?}}', 'gi');
  str = str
    .replace(re, function replace(match) {
      const property = match.substring(2, match.length - 2);
      if (conf && property === 'effect') {
        return conf.expression;
      }
      if (token && property === 'hp') return getTokenHP(token)?.[0];
      else if (token && property === 'hpMax') return getTokenHP(token)?.[1];
      const val = getProperty(token.document ?? token, property);
      return val ?? 0;
    })
    .replace('\\n', '\n');

  return str;
}

function _executeString(evalString, token) {
  try {
    const actor = token.actor; // So that actor is easily accessible within eval() scope
    const result = eval(evalString);
    if (getType(result) === 'Object') evalString;
    return result;
  } catch (e) {}
  return evalString;
}

export function evaluateOverlayExpressions(obj, token, conf) {
  for (const [k, v] of Object.entries(obj)) {
    if (
      ![
        'label',
        'interactivity',
        'variables',
        'id',
        'parentID',
        'limitedUsers',
        'filter',
        'limitOnProperty',
        'html',
      ].includes(k)
    ) {
      obj[k] = _evaluateObjExpressions(v, token, conf);
    }
  }
  return obj;
}

// Evaluate provided object values substituting in {{path.to.property}} with token properties, and performing eval() on strings
function _evaluateObjExpressions(obj, token, conf) {
  const t = getType(obj);
  if (t === 'string') {
    const str = _evaluateString(obj, token, conf);
    return _executeString(str, token);
  } else if (t === 'Array') {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = _evaluateObjExpressions(obj[i], token, conf);
    }
  } else if (t === 'Object') {
    for (const [k, v] of Object.entries(obj)) {
      // Exception for text overlay
      if (k === 'text' && getType(v) === 'string' && v) {
        const evalString = _evaluateString(v, token, conf);
        const result = _executeString(evalString, token);
        if (getType(result) !== 'string') obj[k] = evalString;
        else obj[k] = result;
      } else obj[k] = _evaluateObjExpressions(v, token, conf);
    }
  }
  return obj;
}

export async function generateTextTexture(token, conf) {
  await FONT_LOADING.loading;
  let label = conf.text.text;

  // Repeating the string if necessary
  if (conf.text.repeating && conf.text.repeat) {
    let tmp = '';
    const repeat = conf.text.repeat;
    let numRepeats;
    if (repeat.isPercentage) {
      numRepeats = Math.ceil(repeat.value / repeat.maxValue / (repeat.increment / 100));
    } else {
      numRepeats = Math.ceil(repeat.value / repeat.increment);
    }
    let n = 0;
    let rows = 0;
    let maxRows = repeat.maxRows ?? Infinity;
    while (numRepeats > 0) {
      tmp += label;
      numRepeats--;
      n++;
      if (numRepeats != 0 && n >= repeat.perRow) {
        rows += 1;
        if (rows >= maxRows) break;
        tmp += '\n';
        n = 0;
      }
    }
    label = tmp;
  }

  let style = PreciseText.getTextStyle({
    ...conf.text,
    fontFamily: [conf.text.fontFamily, 'fontAwesome'].join(','),
    fill: interpolateColor(conf.text.fill, conf.text.interpolateColor, true),
  });
  const text = new PreciseText(label, style);
  text.updateText(false);

  const texture = text.texture;
  const height = conf.text.maxHeight ? Math.min(texture.height, conf.text.maxHeight) : null;
  const curve = conf.text.curve;

  if (!height && !curve?.radius && !curve?.angle) {
    texture.textLabel = label;
    return { texture };
  }

  const container = new PIXI.Container();

  if (curve?.radius || curve?.angle) {
    // Curve the text
    const letterSpacing = conf.text.letterSpacing ?? 0;
    const radius = curve.angle ? (texture.width + letterSpacing) / (Math.PI * 2) / (curve.angle / 360) : curve.radius;
    const maxRopePoints = 100;
    const step = Math.PI / maxRopePoints;

    let ropePoints = maxRopePoints - Math.round((texture.width / (radius * Math.PI)) * maxRopePoints);
    ropePoints /= 2;

    const points = [];
    for (let i = maxRopePoints - ropePoints; i > ropePoints; i--) {
      const x = radius * Math.cos(step * i);
      const y = radius * Math.sin(step * i);
      points.push(new PIXI.Point(x, curve.invert ? y : -y));
    }
    const rope = new PIXI.SimpleRope(texture, points);
    container.addChild(rope);
  } else {
    container.addChild(new PIXI.Sprite(texture));
  }

  const renderTexture = _renderContainer(container, 2, { height });
  text.destroy();

  renderTexture.textLabel = label;
  return { texture: renderTexture };
}

function _markAllOverlaysForRemoval(token) {
  for (const child of token.tvaOverlays) {
    if (child instanceof TVAOverlay) {
      child.tvaRemove = true;
    }
  }
}

export function removeMarkedOverlays(token) {
  const sprites = [];
  for (const child of token.tvaOverlays) {
    if (child.tvaRemove) {
      child.parent?.removeChild(child)?.destroy();
    } else {
      sprites.push(child);
    }
  }
  token.tvaOverlays = sprites;
}

function _findTVAOverlay(id, token) {
  for (const child of token.tvaOverlays) {
    if (child.overlayConfig?.id === id) {
      return child;
    }
  }
  return null;
}

function _removeAllOverlays(token) {
  if (token.tvaOverlays)
    for (const child of token.tvaOverlays) {
      child.parent?.removeChild(child)?.destroy();
    }
  token.tvaOverlays = null;
}

export function broadcastDrawOverlays(token) {
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
