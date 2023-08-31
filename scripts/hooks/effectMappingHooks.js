import { FEATURE_CONTROL, TVA_CONFIG, getFlagMappings } from '../settings.js';
import {
  applyCEEffect,
  applyTMFXPreset,
  determineAddedRemovedEffects,
  executeMacro,
  EXPRESSION_OPERATORS,
  getAllActorTokens,
  getFileName,
  tv_executeScript,
  updateTokenImage,
} from '../utils.js';
import { broadcastOverlayRedraw } from '../token/overlay.js';
import { registerHook, unregisterHook } from './hooks.js';

const EXPRESSION_MATCH_RE = /(\\\()|(\\\))|(\|\|)|(\&\&)|(\\\!)/g;
const PF2E_ITEM_TYPES = ['condition', 'effect', 'weapon', 'equipment'];
const ITEM_TYPES = ['equipment', 'weapon'];
const feature_id = 'EffectMappings';

export function registerEffectMappingHooks() {
  if (!FEATURE_CONTROL[feature_id]) {
    [
      'canvasReady',
      'createActiveEffect',
      'deleteActiveEffect',
      'preUpdateActiveEffect',
      'updateActiveEffect',
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
      'preUpdateItem',
      'updateItem',
      'createItem',
      'deleteItem',
    ].forEach((name) => unregisterHook(feature_id, name));
    return;
  }

  if (game.user.isGM) {
    registerHook(feature_id, 'canvasReady', _refreshTokenMappings);
    _refreshTokenMappings();
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

  const applicable_item_types = game.system.id === 'pf2e' ? PF2E_ITEM_TYPES : ITEM_TYPES;
  // Want to track condition/effect previous name so that the config can be reverted for it
  registerHook(feature_id, 'preUpdateItem', (item, change, options, userId) => {
    if (game.user.id === userId && applicable_item_types.includes(item.type)) {
      options['token-variants-old-name'] = item.name;
    }
    _preUpdateAssign(item.parent, change, options);
  });

  registerHook(feature_id, 'createItem', (item, options, userId) => {
    if (game.userId !== userId || !applicable_item_types.includes(item.type) || !item.parent)
      return;
    _updateImageOnEffectChange(item.name, item.parent, true);
  });

  registerHook(feature_id, 'deleteItem', (item, options, userId) => {
    if (
      game.userId !== userId ||
      !applicable_item_types.includes(item.type) ||
      !item.parent ||
      item.disabled
    )
      return;
    _updateImageOnEffectChange(item.name, item.parent, false);
  });

  // Status Effects can be applied "stealthily" on item equip/un-equip
  registerHook(feature_id, 'updateItem', _updateItem);
}

async function _refreshTokenMappings() {
  for (const tkn of canvas.tokens.placeables) {
    await updateWithEffectMapping(tkn);
  }
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
  if (game.user.id !== userId || change.actorId) return;

  const preUpdateEffects = getTokenEffects(token, true);
  if (preUpdateEffects.length) {
    setProperty(options, 'token-variants.preUpdateEffects', preUpdateEffects);
  }

  if (game.system.id === 'dnd5e' && token.actor?.isPolymorphed) {
    setProperty(options, 'token-variants.wasPolymorphed', true);
  }
}

async function _updateToken(token, change, options, userId) {
  if (game.user.id !== userId || change.actorId) return;

  const addedEffects = [];
  const removedEffects = [];
  const preUpdateEffects = getProperty(options, 'token-variants.preUpdateEffects') || [];
  const postUpdateEffects = getTokenEffects(token, true);
  determineAddedRemovedEffects(addedEffects, removedEffects, postUpdateEffects, preUpdateEffects);

  if (addedEffects.length || removedEffects.length || 'actorLink' in change) {
    updateWithEffectMapping(token, { added: addedEffects, removed: removedEffects });
  } else if (getProperty(options, 'token-variants.wasPolymorphed') && !token.actor?.isPolymorphed) {
    updateWithEffectMapping(token);
  }

  if (game.userId === userId && 'hidden' in change) {
    updateWithEffectMapping(token, {
      added: change.hidden ? ['token-variants-visibility'] : [],
      removed: !change.hidden ? ['token-variants-visibility'] : [],
    });
  }
}

function _preUpdateActor(actor, change, options, userId) {
  if (game.user.id !== userId) return;
  _preUpdateAssign(actor, change, options);
}

async function _updateActor(actor, change, options, userId) {
  if (game.user.id !== userId) return;

  if ('flags' in change && 'token-variants' in change.flags) {
    const tokenVariantFlags = change.flags['token-variants'];
    if ('effectMappings' in tokenVariantFlags || '-=effectMappings' in tokenVariantFlags) {
      const tokens = actor.token
        ? [actor.token]
        : getAllActorTokens(actor, true, !TVA_CONFIG.mappingsCurrentSceneOnly);
      tokens.forEach((tkn) => updateWithEffectMapping(tkn));
      for (const tkn of tokens) {
        if (tkn.object && TVA_CONFIG.filterEffectIcons) {
          await tkn.object.drawEffects();
        }
      }
    }
  }

  _preUpdateCheck(actor, options);
}

function _preUpdateAssign(actor, change, options) {
  if (!actor) return;

  // Determine which comparators are applicable so that we can compare after the
  // actor update
  const tokens = actor.token
    ? [actor.token]
    : getAllActorTokens(actor, true, !TVA_CONFIG.mappingsCurrentSceneOnly);
  if (TVA_CONFIG.internalEffects.hpChange.enabled && tokens.length) {
    applyHpChangeEffect(actor, change, tokens);
  }
  for (const tkn of tokens) {
    const preUpdateEffects = getTokenEffects(tkn, true);

    if (preUpdateEffects.length) {
      setProperty(options, 'token-variants.' + tkn.id + '.preUpdateEffects', preUpdateEffects);
    }
  }
}

function _preUpdateCheck(actor, options, pAdded = [], pRemoved = []) {
  if (!actor) return;
  const tokens = actor.token
    ? [actor.token]
    : getAllActorTokens(actor, true, !TVA_CONFIG.mappingsCurrentSceneOnly);
  for (const tkn of tokens) {
    // Check if effects changed by comparing them against the ones calculated in preUpdate*
    const added = [...pAdded];
    const removed = [...pRemoved];
    const postUpdateEffects = getTokenEffects(tkn, true);
    const preUpdateEffects =
      getProperty(options, 'token-variants.' + tkn.id + '.preUpdateEffects') ?? [];

    determineAddedRemovedEffects(added, removed, postUpdateEffects, preUpdateEffects);
    if (added.length || removed.length) updateWithEffectMapping(tkn, { added, removed });
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
    if (currentCombatantId) updateCombatant(currentCombatantId, ['combat-turn'], []);
  }
  if (previousNextCombatantId !== currentNextCombatantId) {
    if (previousNextCombatantId) updateCombatant(previousNextCombatantId, [], ['combat-turn-next']);
    if (currentNextCombatantId) updateCombatant(currentNextCombatantId, ['combat-turn-next'], []);
  }
}

function _updateItem(item, change, options, userId) {
  const added = [];
  const removed = [];

  if (game.user.id === userId) {
    // Handle condition/effect name change
    if (options['token-variants-old-name'] !== item.name) {
      added.push(item.name);
      removed.push(options['token-variants-old-name']);
    }

    _preUpdateCheck(item.parent, options, added, removed);
  }
}

let EFFECT_M_QUEUES = {};
let EFFECT_M_TIMER;

export async function updateWithEffectMapping(token, { added = [], removed = [] } = {}) {
  const callUpdateWithEffectMapping = function () {
    for (const id of Object.keys(EFFECT_M_QUEUES)) {
      const m = EFFECT_M_QUEUES[id];
      _updateWithEffectMapping(m.token, m.opts.added, m.opts.removed);
    }
    EFFECT_M_QUEUES = {};
  };

  clearTimeout(EFFECT_M_TIMER);

  if (token.id in EFFECT_M_QUEUES) {
    const opts = EFFECT_M_QUEUES[token.id].opts;
    added.forEach((a) => opts.added.add(a));
    removed.forEach((a) => opts.removed.add(a));
  } else {
    EFFECT_M_QUEUES[token.id] = {
      token,
      opts: { added: new Set(added), removed: new Set(removed) },
    };
  }
  EFFECT_M_TIMER = setTimeout(callUpdateWithEffectMapping, 100);
}

async function _updateWithEffectMapping(token, added, removed) {
  const placeable = token.object ?? token._object ?? token;
  token = token.document ?? token;

  const tokenImgName = token.getFlag('token-variants', 'name') || getFileName(token.texture.src);
  let tokenDefaultImg = token.getFlag('token-variants', 'defaultImg');
  const animate = !TVA_CONFIG.disableTokenUpdateAnimation;
  const tokenUpdateObj = {};
  const hadActiveHUD = token.object?.hasActiveHUD;
  const toggleStatus =
    canvas.tokens.hud.object?.id === token.id ? canvas.tokens.hud._statusEffects : false;

  let effects = getTokenEffects(token);

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

  const mappings = getAllEffectMappings(token);

  // 3. Configurations may contain effect names in a form of a logical expressions
  //    We need to evaluate them and insert them into effects/added/removed if needed
  for (const mapping of mappings) {
    evaluateMappingExpression(mapping, effects, token, added, removed);
  }

  // Accumulate all scripts that will need to be run after the update
  const executeOnCallback = [];
  const deferredUpdateScripts = [];
  for (const ef of removed) {
    const script = mappings.find((m) => m.id === ef)?.config?.tv_script;
    if (script) {
      if (script.onRemove) {
        if (script.onRemove.includes('tvaUpdate')) deferredUpdateScripts.push(script.onRemove);
        else executeOnCallback.push({ script: script.onRemove, token });
      }
      if (script.tmfxPreset)
        executeOnCallback.push({ tmfxPreset: script.tmfxPreset, token, action: 'remove' });
      if (script.ceEffect?.name)
        executeOnCallback.push({ ceEffect: script.ceEffect, token, action: 'remove' });
      if (script.macroOnApply) executeOnCallback.push({ macro: script.macroOnApply, token });
    }
  }
  for (const ef of added) {
    const script = mappings.find((m) => m.id === ef)?.config?.tv_script;
    if (script) {
      if (script.onApply) {
        if (script.onApply.includes('tvaUpdate')) deferredUpdateScripts.push(script.onApply);
        else executeOnCallback.push({ script: script.onApply, token });
      }
      if (script.tmfxPreset)
        executeOnCallback.push({ tmfxPreset: script.tmfxPreset, token, action: 'apply' });
      if (script.ceEffect?.name)
        executeOnCallback.push({ ceEffect: script.ceEffect, token, action: 'apply' });
      if (script.macroOnRemove) executeOnCallback.push({ macro: script.macroOnRemove, token });
    }
  }

  // Next we're going to determine what configs need to be applied and in what order
  // Filter effects that do not have a mapping and sort based on priority
  effects = mappings
    .filter((m) => effects.includes(m.id))
    .sort((ef1, ef2) => ef1.priority - ef2.priority);

  // Check if image update should be prevented based on module settings
  let disableImageUpdate = false;
  if (TVA_CONFIG.disableImageChangeOnPolymorphed && token.actor?.isPolymorphed) {
    disableImageUpdate = true;
  } else if (
    TVA_CONFIG.disableImageUpdateOnNonPrototype &&
    token.actor?.prototypeToken?.texture?.src !== token.texture.src
  ) {
    disableImageUpdate = true;
    const tknImg = token.texture.src;
    for (const m of mappings) {
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
            if (!added.has(effects[i].overlayConfig?.effect)) {
              newImg.imgSrc = token.texture.src;
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
      delete tokenUpdateObj.flags?.['token-variants']?.defaultImg;
      setProperty(tokenUpdateObj, 'flags.token-variants.-=defaultImg', null);
      newImg.imgSrc = tokenDefaultImg.imgSrc;
      newImg.imgName = tokenDefaultImg.imgName;
    } else if (!tokenDefaultImg && newImg.imgSrc) {
      setProperty(tokenUpdateObj, 'flags.token-variants.defaultImg', {
        imgSrc: token.texture.src,
        imgName: tokenImgName,
      });
    }

    updateCall = () =>
      updateTokenImage(newImg.imgSrc ?? null, {
        token,
        imgName: newImg.imgName ? newImg.imgName : tokenImgName,
        tokenUpdate: tokenUpdateObj,
        callback: _postTokenUpdateProcessing.bind(
          null,
          token,
          hadActiveHUD,
          toggleStatus,
          executeOnCallback
        ),
        config: config,
        animate,
      });
  }

  // If no mapping has been found and the default image (image prior to effect triggered update) is different from current one
  // reset the token image back to default
  if (effects.length === 0 && tokenDefaultImg) {
    delete tokenUpdateObj.flags?.['token-variants']?.defaultImg;
    setProperty(tokenUpdateObj, 'flags.token-variants.-=defaultImg', null);

    updateCall = () =>
      updateTokenImage(tokenDefaultImg.imgSrc, {
        token,
        imgName: tokenDefaultImg.imgName,
        tokenUpdate: tokenUpdateObj,
        callback: _postTokenUpdateProcessing.bind(
          null,
          token,
          hadActiveHUD,
          toggleStatus,
          executeOnCallback
        ),
        animate,
      });
    // If no default image exists but a custom effect is applied, we still want to perform an update to
    // clear it
  } else if (effects.length === 0 && token.getFlag('token-variants', 'usingCustomConfig')) {
    updateCall = () =>
      updateTokenImage(token.texture.src, {
        token,
        imgName: tokenImgName,
        tokenUpdate: tokenUpdateObj,
        callback: _postTokenUpdateProcessing.bind(
          null,
          token,
          hadActiveHUD,
          toggleStatus,
          executeOnCallback
        ),
        animate,
      });
  }

  if (updateCall) {
    if (deferredUpdateScripts.length) {
      for (let i = 0; i < deferredUpdateScripts.length; i++) {
        if (i === deferredUpdateScripts.length - 1) {
          await tv_executeScript(deferredUpdateScripts[i], {
            token,
            tvaUpdate: () => {
              updateCall();
            },
          });
        } else {
          await tv_executeScript(deferredUpdateScripts[i], {
            token,
            tvaUpdate: () => {},
          });
        }
      }
    } else {
      updateCall();
    }
  }
  broadcastOverlayRedraw(placeable);
}

async function _postTokenUpdateProcessing(token, hadActiveHUD, toggleStatus, scripts) {
  if (hadActiveHUD && token.object) {
    canvas.tokens.hud.bind(token.object);
    if (toggleStatus) canvas.tokens.hud._toggleStatusEffects(true);
  }
  for (const scr of scripts) {
    if (scr.script) {
      await tv_executeScript(scr.script, { token: scr.token });
    } else if (scr.tmfxPreset) {
      await applyTMFXPreset(scr.token, scr.tmfxPreset, scr.action);
    } else if (scr.ceEffect) {
      await applyCEEffect(scr.token, scr.ceEffect, scr.action);
    } else if (scr.macro) {
      await executeMacro(scr.macro, token);
    }
  }
}

export function getAllEffectMappings(token = null, includeDisabled = false) {
  let allMappings = getFlagMappings(token);
  const unique = new Set();

  // TODO: replace with a setting
  allMappings.forEach((m) => unique.add(TVA_CONFIG.mergeGroup ? m.group : m.label));

  // Sort out global mappings that do not apply to this actor
  let applicableGlobal = TVA_CONFIG.globalMappings;
  if (token?.actor?.type) {
    const actorType = token.actor.type;
    applicableGlobal = applicableGlobal.filter((m) => {
      if (!m.targetActors || m.targetActors.includes(actorType)) {
        return !unique.has(TVA_CONFIG.mergeGroup ? m.group : m.label);
      }
      return false;
    });
  }
  allMappings = allMappings.concat(applicableGlobal);

  if (!includeDisabled) allMappings = allMappings.filter((m) => !m.disabled);

  return allMappings;
}

function getHPChangeEffect(token, effects) {
  const internals = token.actor?.getFlag('token-variants', 'internalEffects') || {};
  const delta = getProperty(
    token,
    `${
      isNewerVersion('11', game.version) ? 'actorData' : 'delta'
    }.flags.token-variants.internalEffects`
  );
  if (delta) mergeObject(internals, delta);
  if (internals['hp--'] != null) effects.push('hp--');
  if (internals['hp++'] != null) effects.push('hp++');
}

function applyHpChangeEffect(actor, change, tokens) {
  let duration = Number(TVA_CONFIG.internalEffects.hpChange.duration);

  const newHpValue = getProperty(change, `system.${TVA_CONFIG.systemHpPath}.value`);
  if (newHpValue != null) {
    const [currentHpVal, _] = getTokenHP(tokens[0]);
    if (currentHpVal !== newHpValue) {
      if (currentHpVal < newHpValue) {
        setProperty(change, 'flags.token-variants.internalEffects.-=hp--', null);
        setProperty(change, 'flags.token-variants.internalEffects.hp++', newHpValue - currentHpVal);
        if (duration) {
          setTimeout(() => {
            actor.update({
              'flags.token-variants.internalEffects.-=hp++': null,
            });
          }, duration * 1000);
        }
      } else {
        setProperty(change, 'flags.token-variants.internalEffects.-=hp++', null);
        setProperty(change, 'flags.token-variants.internalEffects.hp--', newHpValue - currentHpVal);
        if (duration) {
          setTimeout(() => {
            actor.update({
              'flags.token-variants.internalEffects.-=hp--': null,
            });
          }, duration * 1000);
        }
      }
    }
  }
}

export function getTokenEffects(token, includeExpressions = false) {
  const data = token.document ?? token;
  let effects = [];

  // TVA Effects
  const tokenInCombat = game.combats.some((combat) => {
    return combat.combatants.some((c) => c.tokenId === token.id);
  });
  if (tokenInCombat) {
    effects.push('token-variants-combat');
  }

  if (game.combat?.started) {
    if (game.combat?.combatant?.token?.id === token.id) {
      effects.push('combat-turn');
    } else if (game.combat?.nextCombatant?.token?.id === token.id) {
      effects.push('combat-turn-next');
    }
  }
  if (data.hidden) {
    effects.push('token-variants-visibility');
  }

  if (TVA_CONFIG.internalEffects.hpChange.enabled) {
    getHPChangeEffect(data, effects);
  }

  // Actor/Token effects
  if (data.actorLink) {
    getEffectsFromActor(token.actor, effects);
  } else {
    if (game.system.id === 'pf2e') {
      (data.delta?.items || []).forEach((item) => {
        if (_activePF2EItem(item)) {
          effects.push(item.name);
        }
      });
    } else {
      (data.effects || [])
        .filter((ef) => !ef.disabled && !ef.isSuppressed)
        .forEach((ef) => effects.push(ef.label));
      getEffectsFromActor(token.actor, effects);
    }
  }

  // Expression/Mapping effects
  evaluateComparatorEffects(token, effects);
  evaluateStateEffects(token, effects);

  // Include mappings marked as always applicable
  // as well as the ones defined as logical expressions if needed
  const mappings = getAllEffectMappings(token);

  for (const m of mappings) {
    if (m.alwaysOn) effects.unshift(m.id);
    else if (includeExpressions) {
      const evaluation = evaluateMappingExpression(m, effects, token);
      if (evaluation) effects.unshift(m.id);
    }
  }

  return effects;
}

export function getEffectsFromActor(actor, effects = []) {
  if (!actor) return effects;

  if (game.system.id === 'pf2e') {
    (actor.items || []).forEach((item, id) => {
      if (_activePF2EItem(item)) effects.push(item.name);
    });
  } else {
    (actor.effects || []).forEach((activeEffect, id) => {
      if (!activeEffect.disabled && !activeEffect.isSuppressed)
        effects.push(activeEffect.name ?? activeEffect.label);
    });
    (actor.items || []).forEach((item) => {
      if (ITEM_TYPES.includes(item.type) && item.system.equipped)
        effects.push(item.name ?? item.label);
    });
  }

  return effects;
}

function _activePF2EItem(item) {
  if (PF2E_ITEM_TYPES.includes(item.type)) {
    if ('active' in item) {
      return item.active;
    } else if ('isEquipped' in item) {
      return item.isEquipped;
    } else {
      return true;
    }
  }
  return false;
}

export const VALID_EXPRESSION = new RegExp('([a-zA-Z\\-\\.\\+]+)([><=]+)(".*"|-?\\d+)(%{0,1})');

export function evaluateComparator(token, expression) {
  const match = expression.match(VALID_EXPRESSION);
  if (match) {
    const property = match[1];

    let currVal;
    let maxVal;
    if (property === 'hp') {
      [currVal, maxVal] = getTokenHP(token);
    } else if (property === 'hp++' || property === 'hp--') {
      [currVal, maxVal] = getTokenHP(token);
      currVal = getProperty(token, `actor.flags.token-variants.internalEffects.${property}`) ?? 0;
    } else currVal = getProperty(token, property);
    if (currVal == null) currVal = 0;

    const sign = match[2];
    let val = Number(match[3]);
    if (isNaN(val)) {
      val = match[3].substring(1, match[3].length - 1);
      if (val === 'true') val = true;
      if (val === 'false') val = false;
      // Convert currVal to a truthy/falsy one if this is a bool check
      if (val === true || val === false) {
        if (isEmpty(currVal)) currVal = false;
        else currVal = Boolean(currVal);
      }
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
    } else if (sign === '<>') {
      passed = toCompare < val || toCompare > val;
    }
    return passed;
  }
  return false;
}

export function evaluateComparatorEffects(token, effects = []) {
  token = token.document ?? token;

  const mappings = getAllEffectMappings(token);

  const matched = new Set();

  for (const m of mappings) {
    const expressions = m.expression
      .split(EXPRESSION_MATCH_RE)
      .filter(Boolean)
      .map((exp) => exp.trim())
      .filter(Boolean);
    for (let i = 0; i < expressions.length; i++) {
      if (evaluateComparator(token, expressions[i])) {
        matched.add(expressions[i]);
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

/**
 * Replaces {1,a,5,b} type string in the expressions with (1|a|5|b)
 * @param {*} exp
 * @returns
 */
function _findReplaceBracketWildcard(exp) {
  let nExp = '';
  let lIndex = 0;
  while (lIndex >= 0) {
    let i1 = exp.indexOf('\\\\\\{', lIndex);
    if (i1 !== -1) {
      let i2 = exp.indexOf('\\\\\\}', i1);
      if (i2 !== -1) {
        nExp += exp.substring(lIndex, i1);
        nExp +=
          '(' +
          exp
            .substring(i1 + 4, i2)
            .split(',')
            .join('|') +
          ')';
      }
      lIndex = i2 + 4;
    } else {
      return nExp + exp.substring(lIndex, exp.length);
    }
  }
  return nExp ?? exp;
}

function _testRegExEffect(effect, effects) {
  let re = effect.replace(/[/\-\\^$+?.()|[\]{}]/g, '\\$&').replaceAll('\\\\*', '.*');
  re = _findReplaceBracketWildcard(re);
  re = new RegExp('^' + re + '$');
  return effects.find((ef) => re.test(ef));
}

export function evaluateMappingExpression(
  mapping,
  effects,
  token,
  added = new Set(),
  removed = new Set()
) {
  let arrExpression = mapping.expression
    .split(EXPRESSION_MATCH_RE)
    .filter(Boolean)
    .map((s) => s.trim())
    .filter(Boolean);

  let temp = '';
  let hasAdded = false;
  let hasRemoved = false;
  for (let exp of arrExpression) {
    if (EXPRESSION_OPERATORS.includes(exp)) {
      temp += exp.replace('\\', '');
      continue;
    }

    if (/\\\*|\\{.*\\}/g.test(exp)) {
      let rExp = _testRegExEffect(exp, effects);
      if (rExp) {
        temp += 'true';
      } else {
        temp += 'false';
      }

      if (_testRegExEffect(exp, added)) hasAdded = true;
      else if (_testRegExEffect(exp, removed)) hasRemoved = true;
      continue;
    } else if (effects.includes(exp)) {
      temp += 'true';
    } else {
      temp += 'false';
    }

    if (!hasAdded && added.has(exp)) hasAdded = true;
    if (!hasRemoved && removed.has(exp)) hasRemoved = true;
  }

  try {
    let evaluation = eval(temp);

    // Evaluate JS code
    if (mapping.codeExp) {
      try {
        token = token.document ?? token;
        if (!eval(mapping.codeExp)) evaluation = false;
        else if (!mapping.expression) evaluation = true;
      } catch (e) {
        evaluation = false;
      }
    }

    if (evaluation) {
      if (hasAdded || hasRemoved) {
        added.add(mapping.id);
        effects.push(mapping.id);
      } else effects.unshift(mapping.id);
    } else if (hasRemoved || hasAdded) {
      removed.add(mapping.id);
    }
    return evaluation;
  } catch (e) {}
  return false;
}

function _getTokenHPv11(token) {
  let attributes;

  if (token.actorLink) {
    attributes = getProperty(token.actor?.system, TVA_CONFIG.systemHpPath);
  } else {
    attributes = mergeObject(
      getProperty(token.actor?.system, TVA_CONFIG.systemHpPath) || {},
      getProperty(token.delta?.system) || {},
      {
        inplace: false,
      }
    );
  }

  return [attributes?.value, attributes?.max];
}

export function getTokenHP(token) {
  if (!isNewerVersion('11', game.version)) return _getTokenHPv11(token);

  let attributes;

  if (token.actorLink) {
    attributes = getProperty(token.actor.system, TVA_CONFIG.systemHpPath);
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
  const tokens = actor.token
    ? [actor.token]
    : getAllActorTokens(actor, true, !TVA_CONFIG.mappingsCurrentSceneOnly);
  for (const token of tokens) {
    await updateWithEffectMapping(token, {
      added: added ? [effectName] : [],
      removed: !added ? [effectName] : [],
    });
  }
}

async function _updateImageOnMultiEffectChange(actor, added = [], removed = []) {
  if (!actor) return;
  const tokens = actor.token
    ? [actor.token]
    : getAllActorTokens(actor, true, !TVA_CONFIG.mappingsCurrentSceneOnly);
  for (const token of tokens) {
    await updateWithEffectMapping(token, {
      added: added,
      removed: removed,
    });
  }
}

async function _deleteCombatant(combatant) {
  const token = combatant._token || canvas.tokens.get(combatant.tokenId);
  if (!token || !token.actor) return;
  await updateWithEffectMapping(token, {
    removed: ['token-variants-combat'],
  });
}
