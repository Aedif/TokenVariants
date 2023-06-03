import { FEATURE_CONTROL, TVA_CONFIG } from '../settings.js';
import {
  applyTMFXPreset,
  determineAddedRemovedEffects,
  EXPRESSION_OPERATORS,
  FAUX_DOT,
  getAllActorTokens,
  getFileName,
  tv_executeScript,
  updateTokenImage,
} from '../utils.js';
import { broadcastOverlayRedraw } from '../token/overlay.js';
import { registerHook, unregisterHook } from './hooks.js';

const EXPRESSION_MATCH_RE = /(\\\()|(\\\))|(\|\|)|(\&\&)|(\\\!)/g;
const PF2E_ITEM_TYPES = ['condition', 'effect', 'weapon', 'equipment'];
const feature_id = 'EffectMappings';

export function registerEffectMappingHooks() {
  if (!FEATURE_CONTROL[feature_id]) {
    [
      'renderCombatTracker',
      'createActiveEffect',
      'deleteActiveEffect',
      'preUpdateActiveEffect',
      'updateActiveEffect',
      'updateItem',
      'createCombatant',
      'deleteCombatant',
      'preUpdateCombat',
      'updateCombat',
      'deleteCombat',
      'preUpdateToken',
      'preUpdateActor',
      'updateActor',
      'updateToken',
      'createToken',
    ].forEach((name) => unregisterHook(feature_id, name));

    if (game.system.id === 'pf2e') {
      ['preUpdateItem', 'updateItem', 'createItem', 'deleteItem'].forEach((name) =>
        unregisterHook(feature_id + '-pf2e', name)
      );
    }
    return;
  }

  if (game.user.isGM) {
    registerHook(feature_id, 'renderCombatTracker', async function () {
      for (const tkn of canvas.tokens.placeables) {
        await updateWithEffectMapping(tkn);
      }
    });
  }

  registerHook(feature_id, 'createActiveEffect', (activeEffect, options, userId) => {
    if (!activeEffect.parent || activeEffect.disabled || game.userId !== userId) return;
    const effectName = activeEffect.name ?? activeEffect.label;
    _updateImageOnEffectChange(effectName, activeEffect.parent, true);
  });
  registerHook(feature_id, 'deleteActiveEffect', (activeEffect, options, userId) => {
    if (!activeEffect.parent || activeEffect.disabled || game.userId !== userId) return;
    const effectName = activeEffect.name ?? activeEffect.label;
    _updateImageOnEffectChange(effectName, activeEffect.parent, false);
  });
  registerHook(feature_id, 'preUpdateActiveEffect', _preUpdateActiveEffect);
  registerHook(feature_id, 'updateActiveEffect', _updateActiveEffect);
  registerHook(feature_id, 'preUpdateToken', _preUpdateToken);
  registerHook(feature_id, 'preUpdateActor', _preUpdateActor);
  registerHook(feature_id, 'updateActor', _updateActor);
  registerHook(feature_id, 'updateToken', _updateToken);
  registerHook(feature_id, 'createToken', _createToken);
  registerHook(feature_id, 'createCombatant', _createCombatant);
  registerHook(feature_id, 'deleteCombatant', (combatant, options, userId) => {
    if (game.userId !== userId) return;
    _deleteCombatant(combatant);
  });
  registerHook(feature_id, 'preUpdateCombat', _preUpdateCombat);
  registerHook(feature_id, 'updateCombat', _updateCombat);
  registerHook(feature_id, 'deleteCombat', (combat, options, userId) => {
    if (game.userId !== userId) return;
    combat.combatants.forEach((combatant) => {
      _deleteCombatant(combatant);
    });
  });

  //
  // PF2e hooks
  //

  if (game.system.id === 'pf2e') {
    const pf2e_feature_id = feature_id + '-pf2e';
    // Want to track condition/effect previous name so that the config can be reverted for it
    registerHook(pf2e_feature_id, 'preUpdateItem', (item, change, options, userId) => {
      if (game.user.id === userId && PF2E_ITEM_TYPES.includes(item.type) && 'name' in change) {
        options['token-variants-old-name'] = item.name;
      }
    });

    registerHook(pf2e_feature_id, 'updateItem', (item, change, options, userId) => {
      if (game.user.id !== userId) return;
      // Handle condition/effect name change
      if (PF2E_ITEM_TYPES.includes(item.type) && 'name' in change) {
        _updateImageOnMultiEffectChange(item.parent, [change.name], [options['token-variants-old-name']]);
      }
    });

    registerHook(pf2e_feature_id, 'createItem', (item, options, userId) => {
      if (game.userId !== userId || !PF2E_ITEM_TYPES.includes(item.type) || !item.parent) return;
      _updateImageOnEffectChange(item.name, item.parent, true);
    });

    registerHook(pf2e_feature_id, 'deleteItem', (item, options, userId) => {
      if (game.userId !== userId || !PF2E_ITEM_TYPES.includes(item.type) || !item.parent || item.disabled) return;
      _updateImageOnEffectChange(item.name, item.parent, false);
    });
  }
  // Status Effects can be applied "stealthily" on item equip/un-equip
  registerHook(feature_id, 'updateItem', _updateItem);
}

function _createCombatant(combatant, options, userId) {
  if (game.userId !== userId) return;
  const token = combatant._token || canvas.tokens.get(combatant.tokenId);
  if (!token || !token.actor) return;

  updateWithEffectMapping(token, {
    added: ['token-variants-combat'],
  });
}

function _preUpdateActiveEffect(activeEffect, change, options, userId) {
  if (!activeEffect.parent || game.userId !== userId) return;

  if ('label' in change) {
    options['token-variants-old-name'] = activeEffect.label;
  }
}

function _updateActiveEffect(activeEffect, change, options, userId) {
  if (!activeEffect.parent || game.userId !== userId) return;

  const added = [];
  const removed = [];

  if ('disabled' in change) {
    if (change.disabled) removed.push(activeEffect.label);
    else added.push(activeEffect.label);
  }
  if ('label' in change) {
    removed.push(options['token-variants-old-name']);
    added.push(change.label);
  }

  if (added.length || removed.length) {
    _updateImageOnMultiEffectChange(activeEffect.parent, added, removed);
  }
}

function _preUpdateToken(token, change, options, userId) {
  if (game.user.id !== userId) return;

  const preUpdateEffects = evaluateComparatorEffects(token);
  if (preUpdateEffects.length) {
    if (!options['token-variants']) options['token-variants'] = {};
    options['token-variants'].preUpdateEffects = preUpdateEffects;
  }

  // System specific effects
  const stateEffects = [];
  evaluateStateEffects(token, stateEffects);
  if (stateEffects.length) {
    if (!options['token-variants']) options['token-variants'] = {};
    options['token-variants']['system'] = stateEffects;
  }

  if (game.system.id === 'dnd5e' && token.actor?.isPolymorphed) {
    options['token-variants'] = {
      wasPolymorphed: true,
    };
  }
}

async function _updateActor(actor, change, options, userId) {
  if (game.user.id !== userId) return;

  if ('flags' in change && 'token-variants' in change.flags) {
    const tokenVariantFlags = change.flags['token-variants'];
    if ('effectMappings' in tokenVariantFlags || '-=effectMappings' in tokenVariantFlags) {
      const tokens = actor.token ? [actor.token] : getAllActorTokens(actor, true, true);
      tokens.forEach((tkn) => updateWithEffectMapping(tkn));
      for (const tkn of tokens) {
        if (tkn.object && TVA_CONFIG.filterEffectIcons) {
          await tkn.object.drawEffects();
        }
      }
    }
  }

  const tokens = getAllActorTokens(actor, true, true);
  for (const tkn of tokens) {
    // Check if effects changed by comparing them against the ones calculated in preUpdateActor
    const added = [];
    const removed = [];
    const postUpdateEffects = evaluateComparatorEffects(tkn);
    const preUpdateEffects = [...(options['token-variants']?.[tkn.id]?.preUpdateEffects || [])];

    determineAddedRemovedEffects(added, removed, postUpdateEffects, preUpdateEffects);
    if (added.length || removed.length) updateWithEffectMapping(tkn, { added, removed });
  }
}

function _preUpdateActor(actor, change, options, userId) {
  if (game.user.id !== userId) return;

  // Determine which comparators are applicable so that we can compare after the
  // actor update
  const tokens = actor.getActiveTokens();
  for (const tkn of tokens) {
    const preUpdateEffects = evaluateComparatorEffects(tkn);
    if (preUpdateEffects.length) {
      if (!options['token-variants']) options['token-variants'] = {};
      options['token-variants'][tkn.id] = { preUpdateEffects };
    }
  }
}

async function _updateToken(token, change, options, userId) {
  if (game.user.id !== userId) return;

  const addedEffects = [];
  const removedEffects = [];
  const postUpdateEffects = evaluateComparatorEffects(token);
  const preUpdateEffects = options['token-variants']?.preUpdateEffects || [];
  determineAddedRemovedEffects(addedEffects, removedEffects, postUpdateEffects, preUpdateEffects);

  const newStateEffects = [];
  evaluateStateEffects(token, newStateEffects);
  const oldStateEffects = options['token-variants']?.['system'] || [];
  determineAddedRemovedEffects(addedEffects, removedEffects, newStateEffects, oldStateEffects);

  if (addedEffects.length || removedEffects.length || 'actorLink' in change) {
    updateWithEffectMapping(token, { added: addedEffects, removed: removedEffects });
  } else if (options['token-variants']?.wasPolymorphed && !token.actor?.isPolymorphed) {
    updateWithEffectMapping(token);
  }

  if (game.userId === userId && 'hidden' in change) {
    updateWithEffectMapping(token, {
      added: change.hidden ? ['token-variants-visibility'] : [],
      removed: !change.hidden ? ['token-variants-visibility'] : [],
    });
  }
}

function _createToken(token, options, userId) {
  if (userId && userId === game.user.id) updateWithEffectMapping(token);
}

function _preUpdateCombat(combat, round, options, userId) {
  if (game.userId !== userId) return;
  options['token-variants'] = {
    combatantId: combat?.combatant?.token?.id,
    nextCombatantId: combat?.nextCombatant?.token?.id,
  };
}

function _updateCombat(combat, round, options, userId) {
  if (game.userId !== userId) return;

  const previousCombatantId = options['token-variants']?.combatantId;
  const previousNextCombatantId = options['token-variants']?.nextCombatantId;

  const currentCombatantId = combat?.combatant?.token?.id;
  const currentNextCombatantId = combat?.nextCombatant?.token?.id;

  const updateCombatant = function (id, added = [], removed = []) {
    if (game.user.isGM) {
      const token = canvas.tokens.get(id);
      if (token) updateWithEffectMapping(token, { added, removed });
    } else {
      const message = {
        handlerName: 'effectMappings',
        args: { tokenId: id, sceneId: canvas.scene.id, added, removed },
        type: 'UPDATE',
      };
      game.socket?.emit('module.token-variants', message);
    }
  };

  if (previousCombatantId !== currentCombatantId) {
    if (previousCombatantId) updateCombatant(previousCombatantId, [], ['combat-turn']);
    if (currentCombatantId) updateCombatant(previousCombatantId, ['combat-turn'], []);
  }
  if (previousNextCombatantId !== currentNextCombatantId) {
    if (previousNextCombatantId) updateCombatant(previousNextCombatantId, [], ['combat-turn-next']);
    if (currentNextCombatantId) updateCombatant(currentNextCombatantId, ['combat-turn-next'], []);
  }
}

function _updateItem(item, change, options, userId) {
  if (
    game.user.id === userId &&
    item.parent &&
    change.system &&
    'equipped' in change.system &&
    item.effects &&
    item.effects.size
  ) {
    const added = [];
    const removed = [];
    item.effects.forEach((effect) => {
      if (!effect.disabled) {
        if (change.system.equipped) added.push(effect.label);
        else removed.push(effect.label);
      }
    });

    if (added.length || removed.length) {
      _updateImageOnMultiEffectChange(item.parent, added, removed);
    }
  }
}

export async function updateWithEffectMapping(token, { added = [], removed = [] } = {}) {
  token = token.object ?? token._object ?? token;
  const tokenDoc = token.document ?? token;
  const tokenImgName = tokenDoc.getFlag('token-variants', 'name') || getFileName(tokenDoc.texture.src);
  let tokenDefaultImg = tokenDoc.getFlag('token-variants', 'defaultImg');
  const animate = !TVA_CONFIG.disableTokenUpdateAnimation;
  const tokenUpdateObj = {};
  const hadActiveHUD = tokenDoc.object?.hasActiveHUD;
  const toggleStatus = canvas.tokens.hud.object?.id === tokenDoc.id ? canvas.tokens.hud._statusEffects : false;

  let effects = getTokenEffects(tokenDoc);

  // If effect is included in `added` or `removed` we need to:
  // 1. Insert it into `effects` if it's not there in case of 'added' and place it on top of the list
  // 2. Remove it in case of 'removed'
  for (const ef of added) {
    const i = effects.findIndex((s) => s === ef);
    if (i === -1) {
      effects.push(ef);
    } else if (i < effects.length - 1) {
      effects.splice(i, 1);
      effects.push(ef);
    }
  }
  for (const ef of removed) {
    const i = effects.findIndex((s) => s === ef);
    if (i !== -1) {
      effects.splice(i, 1);
    }
  }

  const mappings = getAllEffectMappings(tokenDoc);

  // 3. Configurations may contain effect names in a form of a logical expressions
  //    We need to evaluate them and insert them into effects/added/removed if needed
  for (const key of Object.keys(mappings)) {
    const [evaluation, identifiedEffects] = evaluateEffectAsExpression(key, effects);
    if (identifiedEffects == null) continue;
    if (evaluation) {
      let containsAdded = false;
      for (const ef of identifiedEffects) {
        if (added.includes(ef) || removed.includes(ef)) {
          containsAdded = true;
          added.push(key);
          break;
        }
      }
      if (containsAdded) effects.push(key);
      else effects.unshift(key);
    } else {
      for (const ef of identifiedEffects) {
        if (removed.includes(ef) || added.includes(ef)) {
          removed.push(key);
          break;
        }
      }
    }
  }

  // Accumulate all scripts that will need to be run after the update
  const executeOnCallback = [];
  let deferredUpdateScripts = [];
  for (const ef of removed) {
    const onRemove = mappings[ef]?.config?.tv_script?.onRemove;
    if (onRemove) {
      if (onRemove.includes('tvaUpdate')) deferredUpdateScripts.push(onRemove);
      else executeOnCallback.push({ script: onRemove, token: tokenDoc });
    }
    const tmfxPreset = mappings[ef]?.config?.tv_script?.tmfxPreset;
    if (tmfxPreset) executeOnCallback.push({ tmfxPreset, token: tokenDoc, action: 'remove' });
  }
  for (const ef of added) {
    const onApply = mappings[ef]?.config?.tv_script?.onApply;
    if (onApply) {
      if (onApply.includes('tvaUpdate')) deferredUpdateScripts.push(onApply);
      else executeOnCallback.push({ script: onApply, token: tokenDoc });
    }
    const tmfxPreset = mappings[ef]?.config?.tv_script?.tmfxPreset;
    if (tmfxPreset) executeOnCallback.push({ tmfxPreset, token: tokenDoc, action: 'apply' });
  }

  // Next we're going to determine what configs need to be applied and in what order
  // Filter effects that do not have a mapping and sort based on priority
  effects = effects
    .filter((ef) => ef in mappings)
    .map((ef) => mappings[ef])
    .sort((ef1, ef2) => ef1.priority - ef2.priority);

  // Check if image update should be prevented based on module settings
  let disableImageUpdate = false;
  if (TVA_CONFIG.disableImageChangeOnPolymorphed && tokenDoc.actor?.isPolymorphed) {
    disableImageUpdate = true;
  } else if (
    TVA_CONFIG.disableImageUpdateOnNonPrototype &&
    tokenDoc.actor?.prototypeToken?.texture?.src !== tokenDoc.texture.src
  ) {
    disableImageUpdate = true;
    const tknImg = tokenDoc.texture.src;
    for (const m of Object.values(mappings)) {
      if (m.imgSrc === tknImg) {
        disableImageUpdate = false;
        break;
      }
    }
  }

  if (disableImageUpdate) {
    tokenDefaultImg = '';
  }

  let updateCall;

  if (effects.length > 0) {
    // Some effect mappings may not have images, find a mapping with one if it exists
    const newImg = { imgSrc: '', imgName: '' };

    if (!disableImageUpdate) {
      for (let i = effects.length - 1; i >= 0; i--) {
        if (effects[i].imgSrc) {
          let iSrc = effects[i].imgSrc;
          if (iSrc.includes('*') || (iSrc.includes('{') && iSrc.includes('}'))) {
            // wildcard image, if this effect hasn't been newly applied we do not want to randomize the image again
            if (!added.includes(effects[i].overlayConfig?.effect)) {
              newImg.imgSrc = tokenDoc.texture.src;
              newImg.imgName = getFileName(newImg.imgSrc);
              break;
            }
          }
          newImg.imgSrc = effects[i].imgSrc;
          newImg.imgName = effects[i].imgName;
          break;
        }
      }
    }

    // Collect custom configs to be applied to the token
    let config;
    if (TVA_CONFIG.stackStatusConfig) {
      config = {};
      for (const ef of effects) {
        config = mergeObject(config, ef.config);
      }
    } else {
      for (let i = effects.length - 1; i >= 0; i--) {
        if (effects[i].config && Object.keys(effects[i].config).length !== 0) {
          config = effects[i].config;
          break;
        }
      }
    }

    // Use or update the default (original) token image
    if (!newImg.imgSrc && tokenDefaultImg) {
      delete tokenUpdateObj['flags.token-variants.defaultImg'];
      tokenUpdateObj['flags.token-variants.-=defaultImg'] = null;
      newImg.imgSrc = tokenDefaultImg.imgSrc;
      newImg.imgName = tokenDefaultImg.imgName;
    } else if (!tokenDefaultImg && newImg.imgSrc) {
      tokenUpdateObj['flags.token-variants.defaultImg'] = {
        imgSrc: tokenDoc.texture.src,
        imgName: tokenImgName,
      };
    }

    updateCall = () =>
      updateTokenImage(newImg.imgSrc ?? null, {
        token: tokenDoc,
        imgName: newImg.imgName ? newImg.imgName : tokenImgName,
        tokenUpdate: tokenUpdateObj,
        callback: _postTokenUpdateProcessing.bind(null, tokenDoc, hadActiveHUD, toggleStatus, executeOnCallback),
        config: config,
        animate,
      });
  }

  // If no mapping has been found and the default image (image prior to effect triggered update) is different from current one
  // reset the token image back to default
  if (effects.length === 0 && tokenDefaultImg) {
    delete tokenUpdateObj['flags.token-variants.defaultImg'];
    tokenUpdateObj['flags.token-variants.-=defaultImg'] = null;

    updateCall = () =>
      updateTokenImage(tokenDefaultImg.imgSrc, {
        token: tokenDoc,
        imgName: tokenDefaultImg.imgName,
        tokenUpdate: tokenUpdateObj,
        callback: _postTokenUpdateProcessing.bind(null, tokenDoc, hadActiveHUD, toggleStatus, executeOnCallback),
        animate,
      });
    // If no default image exists but a custom effect is applied, we still want to perform an update to
    // clear it
  } else if (effects.length === 0 && tokenDoc.getFlag('token-variants', 'usingCustomConfig')) {
    updateCall = () =>
      updateTokenImage(tokenDoc.texture.src, {
        token: tokenDoc,
        imgName: tokenImgName,
        tokenUpdate: tokenUpdateObj,
        callback: _postTokenUpdateProcessing.bind(null, tokenDoc, hadActiveHUD, toggleStatus, executeOnCallback),
        animate,
      });
  }

  if (updateCall) {
    if (deferredUpdateScripts.length) {
      for (let i = 0; i < deferredUpdateScripts.length; i++) {
        if (i === deferredUpdateScripts.length - 1) {
          await tv_executeScript(deferredUpdateScripts[i], {
            token: tokenDoc,
            tvaUpdate: () => {
              broadcastOverlayRedraw(tokenDoc);
              updateCall();
            },
          });
        } else {
          await tv_executeScript(deferredUpdateScripts[i], {
            token: tokenDoc,
            tvaUpdate: () => {},
          });
        }
      }
    } else {
      broadcastOverlayRedraw(tokenDoc);
      updateCall();
    }
  } else {
    broadcastOverlayRedraw(tokenDoc);
  }
}

async function _postTokenUpdateProcessing(tokenDoc, hadActiveHUD, toggleStatus, scripts) {
  if (hadActiveHUD && tokenDoc.object) {
    canvas.tokens.hud.bind(tokenDoc.object);
    if (toggleStatus) canvas.tokens.hud._toggleStatusEffects(true);
  }
  for (const scr of scripts) {
    if (scr.script) {
      await tv_executeScript(scr.script, { token: scr.token });
    } else if (scr.tmfxPreset) {
      await applyTMFXPreset(scr.token, scr.tmfxPreset, scr.action);
    }
  }
}

export function getAllEffectMappings(token = null, includeDisabled = false) {
  let allMappings;

  // Sort out global mappings that do not apply to this actor
  let applicableGlobal = {};
  if (token?.actor?.type) {
    const actorType = token.actor.type;
    for (const [k, v] of Object.entries(TVA_CONFIG.globalMappings)) {
      if (!v.targetActors || v.targetActors.includes(actorType)) {
        applicableGlobal[k] = v;
      }
    }
  } else {
    applicableGlobal = { ...TVA_CONFIG.globalMappings };
  }

  if (token) {
    allMappings = mergeObject(applicableGlobal, token.actor?.getFlag('token-variants', 'effectMappings') || {}, {
      inplace: false,
      recursive: false,
    });
  } else {
    allMappings = applicableGlobal;
  }

  if (!includeDisabled)
    for (const [k, v] of Object.entries(allMappings)) {
      if (v.disabled) delete allMappings[k];
    }

  fixEffectMappings(allMappings);

  return allMappings;
}

// 19/01/2023
// The same mapping can now apply both an image change as well as an overlay
// We need to adjust old configs to account for this
export function fixEffectMappings(mappings) {
  for (const v of Object.values(mappings)) {
    if (v.overlay && !v.overlayConfig.img) {
      v.overlayConfig.img = v.imgSrc;
      v.imgSrc = null;
      v.imgName = null;
    }
  }
  return mappings;
}

export function getTokenEffects(token, includeExpressions = false) {
  const data = token.document ?? token;
  let effects = [];

  if (game.system.id === 'pf2e') {
    if (data.actorLink) {
      effects = getEffectsFromActor(token.actor);
    } else {
      if (isNewerVersion('11', game.version)) {
        effects = (data.actorData?.items || [])
          .filter((item) => PF2E_ITEM_TYPES.includes(item.type))
          .map((item) => item.name);
      } else {
        effects = (data.delta?.items || [])
          .filter((item) => PF2E_ITEM_TYPES.includes(item.type))
          .map((item) => item.name);
      }
    }
  } else {
    if (data.actorLink && token.actor) {
      effects = getEffectsFromActor(token.actor);
    } else {
      const actorEffects = getEffectsFromActor(token.actor);
      effects = (data.effects || [])
        .filter((ef) => !ef.disabled && !ef.isSuppressed)
        .map((ef) => ef.label)
        .concat(actorEffects);
    }
  }

  if (data.inCombat) {
    effects.unshift('token-variants-combat');
  }
  if (game.combat?.started) {
    if (game.combat?.combatant?.token?.id === token.id) {
      effects.unshift('combat-turn');
    } else if (game.combat?.nextCombatant?.token?.id === token.id) {
      effects.unshift('combat-turn-next');
    }
  }
  if (data.hidden) {
    effects.unshift('token-variants-visibility');
  }

  evaluateComparatorEffects(token, effects);
  evaluateStateEffects(token, effects);

  // Include mappings marked as always applicable
  // as well as the ones defined as logical expressions if needed
  const mappings = getAllEffectMappings(token);
  for (const [k, m] of Object.entries(mappings)) {
    if (m.alwaysOn) effects.unshift(k);
    else if (includeExpressions) {
      const [evaluation, identifiedEffects] = evaluateEffectAsExpression(k, effects);
      if (evaluation && identifiedEffects !== null) effects.unshift(k);
    }
  }

  return effects;
}

export function getEffectsFromActor(actor) {
  let effects = [];
  if (!actor) return effects;

  if (game.system.id === 'pf2e') {
    (actor.items || []).forEach((item, id) => {
      if (PF2E_ITEM_TYPES.includes(item.type)) {
        if ('active' in item) {
          if (item.active) effects.push(item.name);
        } else {
          effects.push(item.name);
        }
      }
    });
  } else {
    (actor.effects || []).forEach((activeEffect, id) => {
      if (!activeEffect.disabled && !activeEffect.isSuppressed) effects.push(activeEffect.name ?? activeEffect.label);
    });
  }

  return effects;
}

export const VALID_EXPRESSION = new RegExp('([a-zA-Z\\-\\.]+)([><=]+)(".*"|\\d+)(%{0,1})');

export function evaluateComparator(token, expression) {
  const exp = expression.replaceAll(FAUX_DOT, '.');
  const match = exp.match(VALID_EXPRESSION);
  if (match) {
    const property = match[1];

    let currVal;
    let maxVal;
    if (property === 'hp') {
      [currVal, maxVal] = _getTokenHP(token);
    } else currVal = getProperty(token, property);

    if (currVal != null) {
      const sign = match[2];
      let val = Number(match[3]);
      if (isNaN(val)) {
        val = match[3].substring(1, match[3].length - 1);
        if (val === 'true') val = true;
        if (val === 'false') val = false;
      }
      const isPercentage = Boolean(match[4]);

      if (property === 'rotation') {
        maxVal = 360;
      } else if (maxVal == null) {
        maxVal = 999999;
      }
      const toCompare = isPercentage ? (currVal / maxVal) * 100 : currVal;

      let passed = false;
      if (sign === '=') {
        passed = toCompare == val;
      } else if (sign === '>') {
        passed = toCompare > val;
      } else if (sign === '<') {
        passed = toCompare < val;
      } else if (sign === '>=') {
        passed = toCompare >= val;
      } else if (sign === '<=') {
        passed = toCompare <= val;
      }
      return passed;
    }
  }
  return false;
}

export function evaluateComparatorEffects(token, effects = []) {
  token = token.document ? token.document : token;

  const mappings = getAllEffectMappings(token);

  const matched = new Set();
  for (const key of Object.keys(mappings)) {
    const expressions = key
      .split(EXPRESSION_MATCH_RE)
      .filter(Boolean)
      .map((exp) => exp.trim())
      .filter(Boolean);
    for (let i = 0; i < expressions.length; i++) {
      if (evaluateComparator(token, expressions[i])) {
        matched.add(expressions[i].replaceAll('.', FAUX_DOT));
      }
    }
  }

  // Remove duplicate expressions and insert into effects
  matched.forEach((exp) => effects.unshift(exp));

  return effects;
}

export function evaluateStateEffects(token, effects) {
  if (game.system.id === 'pf2e') {
    const deathIcon = game.settings.get('pf2e', 'deathIcon');
    if ((token.document ?? token).overlayEffect === deathIcon) effects.push('Dead');
  }
}

export function evaluateEffectAsExpression(effect, effects) {
  let arrExpression = effect
    .split(EXPRESSION_MATCH_RE)
    .filter(Boolean)
    .map((s) => s.trim())
    .filter(Boolean);

  // Not an expression, return as false
  if (arrExpression.length < 2) {
    return [false, null];
  }

  let temp = '';
  let foundEffects = [];
  for (const exp of arrExpression) {
    if (EXPRESSION_OPERATORS.includes(exp)) {
      temp += exp.replace('\\', '');
    } else if (effects.includes(exp)) {
      foundEffects.push(exp);
      temp += 'true';
    } else {
      foundEffects.push(exp);
      temp += 'false';
    }
  }

  let evaluation = false;
  try {
    evaluation = eval(temp);
  } catch (e) {
    return [false, null];
  }
  return [evaluation, foundEffects];
}

function _getTokenHPv11(token) {
  let attributes;

  if (token.actorLink) {
    attributes = mergeObject(getProperty(token.actor.system, TVA_CONFIG.systemHpPath));
  } else {
    attributes = mergeObject(
      getProperty(token.actor.system, TVA_CONFIG.systemHpPath) || {},
      getProperty(token.delta?.system) || {},
      {
        inplace: false,
      }
    );
  }

  return [attributes?.value, attributes?.max];
}

function _getTokenHP(token) {
  if (!isNewerVersion('11', game.version)) return _getTokenHPv11(token);

  let attributes;

  if (token.actorLink) {
    attributes = mergeObject(getProperty(token.actor.system, TVA_CONFIG.systemHpPath));
  } else {
    attributes = mergeObject(
      getProperty(token.actor.system, TVA_CONFIG.systemHpPath) || {},
      getProperty(token.actorData?.system) || {},
      {
        inplace: false,
      }
    );
  }
  return [attributes?.value, attributes?.max];
}

async function _updateImageOnEffectChange(effectName, actor, added = true) {
  const mappings = getAllEffectMappings({ actor });
  if (effectName in mappings) {
    const tokens = actor.token ? [actor.token] : getAllActorTokens(actor, true, true);
    for (const token of tokens) {
      await updateWithEffectMapping(token, {
        added: added ? [effectName] : [],
        removed: !added ? [effectName] : [],
      });
    }
  }
}

async function _updateImageOnMultiEffectChange(actor, added = [], removed = []) {
  if (!actor) return;
  const mappings = getAllEffectMappings({ actor });
  if (added.filter((ef) => ef in mappings).length || removed.filter((ef) => ef in mappings).length) {
    const tokens = actor.token ? [actor.token] : getAllActorTokens(actor, true, true);
    for (const token of tokens) {
      await updateWithEffectMapping(token, {
        added: added,
        removed: removed,
      });
    }
  }
}

async function _deleteCombatant(combatant) {
  const token = combatant._token || canvas.tokens.get(combatant.tokenId);
  if (!token || !token.actor) return;
  await updateWithEffectMapping(token, {
    removed: ['token-variants-combat'],
  });
}
