import { getAllEffectMappings } from '../hooks/effectMappingHooks.js';
import { FEATURE_CONTROL, TVA_CONFIG } from '../settings.js';
import { registerWrapper, unregisterWrapper } from './wrappers.js';

const feature_id = 'EffectIcons';

export function registerEffectIconWrappers() {
  unregisterWrapper(feature_id, 'foundry.canvas.placeables.Token.prototype.drawEffects');
  unregisterWrapper(feature_id, 'foundry.applications.sidebar.tabs.CombatTracker.prototype._prepareTurnContext');
  if (!FEATURE_CONTROL[feature_id]) return;

  if (!TVA_CONFIG.disableEffectIcons && TVA_CONFIG.filterEffectIcons && !['pf1e', 'pf2e'].includes(game.system.id)) {
    registerWrapper(feature_id, 'foundry.canvas.placeables.Token.prototype.drawEffects', _drawEffects, 'OVERRIDE');
  } else if (TVA_CONFIG.disableEffectIcons) {
    registerWrapper(
      feature_id,
      'foundry.canvas.placeables.Token.prototype._drawEffects',
      _drawEffects_fullReplace,
      'OVERRIDE'
    );
  } else if (TVA_CONFIG.displayEffectIconsOnHover) {
    registerWrapper(
      feature_id,
      'foundry.canvas.placeables.Token.prototype.drawEffects',
      _drawEffects_hoverOnly,
      'WRAPPER'
    );
  }

  if (TVA_CONFIG.disableEffectIcons || TVA_CONFIG.filterCustomEffectIcons) {
    registerWrapper(
      feature_id,
      'foundry.applications.sidebar.tabs.CombatTracker.prototype._prepareTurnContext',
      _combatTrackerPrepareTurnContext,
      'WRAPPER'
    );
  }
}

async function _drawEffects_hoverOnly(wrapped, ...args) {
  let result = await wrapped(...args);
  this.effects.visible = this.hover;
  return result;
}

async function _drawEffects_fullReplace(...args) {
  this.effects.removeChildren().forEach((c) => c.destroy());
  this.effects.bg = this.effects.addChild(new PIXI.Graphics());
  this.effects.overlay = null;
}

async function _combatTrackerPrepareTurnContext(wrapped, ...args) {
  const context = await wrapped(...args);

  if (TVA_CONFIG.disableEffectIcons) {
    context.effects = {};
  } else if (TVA_CONFIG.filterEffectIcons && context.effects?.icons) {
    const restrictedEffects = _getRestrictedEffects(args[1].token);
    if (!restrictedEffects.length) return;

    const icons = context.effect.icons.filter((i) => !restrictedEffects.includes(i.name));
    context.effects = {
      icons,
      tooltip: this._formatEffectsTooltip(icons),
    };
  }

  return context;
}

async function _drawEffects(...args) {
  this.effects.renderable = false;

  // Clear Effects Container
  this.effects.removeChildren().forEach((c) => c.destroy());
  this.effects.bg = this.effects.addChild(new PIXI.Graphics());
  this.effects.bg.zIndex = -1;
  this.effects.overlay = null;

  // Categorize effects
  let activeEffects = this.actor?.temporaryEffects || [];
  let overlayEffect = activeEffects.findLast((e) => e.img && e.getFlag('core', 'overlay'));

  // Modified from the original token.drawEffects
  if (TVA_CONFIG.displayEffectIconsOnHover) this.effects.visible = this.hover;
  if (activeEffects.length) {
    const restrictedEffects = _getRestrictedEffects(this.document);
    activeEffects = activeEffects.filter((ef) => !restrictedEffects.includes(ef.name));
  }
  // End of modifications

  // Draw effects
  const promises = [];
  for (const [i, effect] of activeEffects.entries()) {
    if (!effect.img) continue;
    const promise =
      effect === overlayEffect ? this._drawOverlay(effect.img, effect.tint) : this._drawEffect(effect.img, effect.tint);
    promises.push(
      promise.then((e) => {
        if (e) e.zIndex = i;
      })
    );
  }
  await Promise.allSettled(promises);

  this.effects.sortChildren();
  this.effects.renderable = true;
  this.renderFlags.set({ refreshEffects: true });
}

function _getRestrictedEffects(tokenDoc) {
  let restrictedEffects = TVA_CONFIG.filterIconList;
  if (TVA_CONFIG.filterCustomEffectIcons) {
    const mappings = getAllEffectMappings(tokenDoc);
    if (mappings) restrictedEffects = restrictedEffects.concat(mappings.map((m) => m.expression));
  }
  return restrictedEffects;
}
