import { getAllEffectMappings } from '../hooks/effectMappingHooks.js';
import { FEATURE_CONTROL, TVA_CONFIG } from '../settings.js';
import { registerWrapper, unregisterWrapper } from './wrappers.js';

const feature_id = 'EffectIcons';

export function registerEffectIconWrappers() {
  unregisterWrapper(feature_id, 'Token.prototype.drawEffects');
  unregisterWrapper(feature_id, 'CombatTracker.prototype.getData');
  if (!FEATURE_CONTROL[feature_id]) return;

  if (
    !TVA_CONFIG.disableEffectIcons &&
    TVA_CONFIG.filterEffectIcons &&
    !['pf1e', 'pf2e'].includes(game.system.id)
  ) {
    registerWrapper(feature_id, 'Token.prototype.drawEffects', _drawEffects, 'OVERRIDE');
  } else if (TVA_CONFIG.disableEffectIcons) {
    registerWrapper(
      feature_id,
      'Token.prototype.drawEffects',
      _drawEffects_fullReplace,
      'OVERRIDE'
    );
  } else if (TVA_CONFIG.displayEffectIconsOnHover) {
    registerWrapper(feature_id, 'Token.prototype.drawEffects', _drawEffects_hoverOnly, 'WRAPPER');
  }

  if (TVA_CONFIG.disableEffectIcons || TVA_CONFIG.filterCustomEffectIcons) {
    registerWrapper(
      feature_id,
      'CombatTracker.prototype.getData',
      _combatTrackerGetData,
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

async function _combatTrackerGetData(wrapped, ...args) {
  let data = await wrapped(...args);

  if (data && data.combat && data.turns) {
    const combat = data.combat;
    for (const turn of data.turns) {
      const combatant = combat.combatants.find((c) => c.id === turn.id);
      if (combatant) {
        if (TVA_CONFIG.disableEffectIcons) {
          turn.effects = new Set();
        } else if (TVA_CONFIG.filterEffectIcons) {
          const restrictedEffects = _getRestrictedEffects(combatant.token);

          // Copied from CombatTracker.getData(...)
          turn.effects = new Set();
          if (combatant.token) {
            combatant.token.effects.forEach((e) => turn.effects.add(e));
            if (combatant.token.overlayEffect) turn.effects.add(combatant.token.overlayEffect);
          }

          // modified to filter restricted effects
          if (combatant.actor) {
            for (const effect of combatant.actor.temporaryEffects) {
              if (effect.statuses.has(CONFIG.specialStatusEffects.DEFEATED)) {
              } else if (effect.icon && !restrictedEffects.includes(effect.name ?? effect.label))
                turn.effects.add(effect.icon);
            }
          }
          // end of copy
        }
      }
    }
  }
  return data;
}

async function _drawEffects(...args) {
  this.effects.renderable = false;
  this.effects.removeChildren().forEach((c) => c.destroy());
  this.effects.bg = this.effects.addChild(new PIXI.Graphics());
  this.effects.overlay = null;

  // Categorize new effects
  let tokenEffects = this.document.effects;
  let actorEffects = this.actor?.temporaryEffects || [];
  let overlay = {
    src: this.document.overlayEffect,
    tint: null,
  };

  // Modified from the original token.drawEffects
  if (TVA_CONFIG.displayEffectIconsOnHover) this.effects.visible = this.hover;
  if (tokenEffects.length || actorEffects.length) {
    const restrictedEffects = _getRestrictedEffects(this.document);
    actorEffects = actorEffects.filter((ef) => !restrictedEffects.includes(ef.name ?? ef.label));
    tokenEffects = tokenEffects.filter(
      // check if it's a string here
      // for tokens without representing actors effects are just stored as paths to icons
      (ef) => typeof ef === 'string' || !restrictedEffects.includes(ef.name ?? ef.label)
    );
  }
  // End of modifications

  // Draw status effects
  if (tokenEffects.length || actorEffects.length) {
    const promises = [];

    // Draw actor effects first
    for (let f of actorEffects) {
      if (!f.icon) continue;
      const tint = Color.from(f.tint ?? null);
      if (f.getFlag('core', 'overlay')) {
        overlay = { src: f.icon, tint };
        continue;
      }
      promises.push(this._drawEffect(f.icon, tint));
    }

    // Next draw token effects
    for (let f of tokenEffects) promises.push(this._drawEffect(f, null));
    await Promise.all(promises);
  }

  // Draw overlay effect
  this.effects.overlay = await this._drawOverlay(overlay.src, overlay.tint);
  this._refreshEffects();
  this.effects.renderable = true;
}

function _getRestrictedEffects(tokenDoc) {
  let restrictedEffects = TVA_CONFIG.filterIconList;
  if (TVA_CONFIG.filterCustomEffectIcons) {
    const mappings = getAllEffectMappings(tokenDoc);
    if (mappings) restrictedEffects = restrictedEffects.concat(mappings.map((m) => m.expression));
  }
  return restrictedEffects;
}
