import {
  registerSettings,
  TVA_CONFIG,
  exportSettingsToJSON,
  updateSettings,
  getSearchOptions,
} from './scripts/settings.js';
import { ArtSelect, addToArtSelectQueue } from './applications/artSelect.js';
import {
  getFileName,
  getFileNameWithExt,
  getFilters,
  simplifyName,
  simplifyPath,
  getTokenConfigForUpdate,
  SEARCH_TYPE,
  callForgeVTT,
  keyPressed,
  registerKeybinds,
  updateActorImage,
  updateTokenImage,
  startBatchUpdater,
  userRequiresImageCache,
  checkAndDisplayUserSpecificImage,
  flattenSearchResults,
  parseKeywords,
  tv_executeScript,
  drawOverlays,
  getFilePath,
  waitForTexture,
  getTokenEffects,
  isVideo,
  isImage,
  applyHealthEffects,
} from './scripts/utils.js';
import { renderHud } from './applications/tokenHUD.js';
import { renderTileHUD } from './applications/tileHUD.js';
import { Fuse } from './scripts/fuse/fuse.js';
import { libWrapper } from './scripts/libWrapper/shim.js';
import { TVA_Sprite } from './applications/TVA_Sprite.js';

// Tracks if module has been initialized
let initialized = false;
let onInit = [];

// True if in the middle of caching image paths
let caching = false;

// Cached images
let CACHED_IMAGES = {};

// showArtSelect(...) can take a while to fully execute and it is possible for it to be called
// multiple times in very quick succession especially if copy pasting tokens or importing actors.
// This variable set early in the function execution is used to queue additional requests rather
// than continue execution
const showArtSelectExecuting = { inProgress: false };

function disableRandomSearchForType(randSettings, actor) {
  if (!actor) return false;
  return randSettings[`${actor.type}Disable`] ?? false;
}

function disablePopupForType(actor) {
  if (!actor) return false;
  return TVA_CONFIG.popup[`${actor.type}Disable`] ?? false;
}

function postTokenUpdateProcessing(token, hadActiveHUD, toggleStatus, scripts) {
  if (hadActiveHUD) {
    canvas.tokens.hud.bind(token);
    if (toggleStatus) canvas.tokens.hud._toggleStatusEffects(true);
  }
  scripts.forEach((scr) => tv_executeScript(scr.script, { token: scr.token }));
}

export async function updateWithEffectMapping(token, effects, { added = [], removed = [] } = {}) {
  token = token._object ? token._object : token;
  const tokenImgName =
    (token.document ?? token).getFlag('token-variants', 'name') ||
    getFileName(token.document.texture.src);
  const tokenDefaultImg = (token.document ?? token).getFlag('token-variants', 'defaultImg');
  const tokenUpdateObj = {};
  const hadActiveHUD = token.hasActiveHUD;
  const toggleStatus =
    canvas.tokens.hud.object?.id === token.id ? canvas.tokens.hud._statusEffects : false;
  const mappings = mergeObject(
    TVA_CONFIG.globalMappings,
    token.actor ? token.actor.getFlag('token-variants', 'effectMappings') : {},
    { inplace: false }
  );

  // Accumulate all scripts that will need to be run after the update
  const executeOnCallback = [];
  for (const ef of added) {
    const onApply = mappings[ef]?.config?.tv_script?.onApply;
    if (onApply) executeOnCallback.push({ script: onApply, token: token });
  }
  for (const ef of removed) {
    const onRemove = mappings[ef]?.config?.tv_script?.onRemove;
    if (onRemove) executeOnCallback.push({ script: onRemove, token: token });
  }

  // Need to broadcast to other users to re-draw the overlay
  drawOverlays(token);
  const message = {
    handlerName: 'drawOverlays',
    args: { tokenId: token.id },
    type: 'UPDATE',
  };
  game.socket?.emit('module.token-variants', message);

  // Next we're going to determine what configs need to be applied and in what order
  // Filter effects that do not have a mapping and sort based on priority
  effects = effects
    .filter((ef) => ef in mappings)
    .map((ef) => mappings[ef])
    .sort((ef1, ef2) => ef1.priority - ef2.priority);

  if (effects.length > 0) {
    // Some effect mappings may not have images, find a mapping with one if it exists
    const newImg = { imgSrc: '', imgName: '' };
    for (let i = effects.length - 1; i >= 0; i--) {
      if (effects[i].imgSrc && !effects[i].overlay) {
        newImg.imgSrc = effects[i].imgSrc;
        newImg.imgName = effects[i].imgName;
        break;
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
        imgSrc: token.document.texture.src,
        imgName: tokenImgName,
      };
    }

    await updateTokenImage(newImg.imgSrc ?? null, {
      token: token,
      imgName: newImg.imgName ? newImg.imgName : tokenImgName,
      tokenUpdate: tokenUpdateObj,
      callback: postTokenUpdateProcessing.bind(
        null,
        token,
        hadActiveHUD,
        toggleStatus,
        executeOnCallback
      ),
      config: config,
    });
  }

  // If no mapping has been found and the default image (image prior to effect triggered update) is different from current one
  // reset the token image back to default
  if (effects.length === 0 && tokenDefaultImg) {
    delete tokenUpdateObj['flags.token-variants.defaultImg'];
    tokenUpdateObj['flags.token-variants.-=defaultImg'] = null;

    await updateTokenImage(tokenDefaultImg.imgSrc, {
      token: token,
      imgName: tokenDefaultImg.imgName,
      tokenUpdate: tokenUpdateObj,
      callback: postTokenUpdateProcessing.bind(
        null,
        token,
        hadActiveHUD,
        toggleStatus,
        executeOnCallback
      ),
    });
    // If no default image exists but a custom effect is applied, we still want to perform an update to
    // clear it
  } else if (
    effects.length === 0 &&
    (token.document ?? token).getFlag('token-variants', 'usingCustomConfig')
  ) {
    await updateTokenImage(token.document.texture.src, {
      token: token,
      imgName: tokenImgName,
      tokenUpdate: tokenUpdateObj,
      callback: postTokenUpdateProcessing.bind(
        null,
        token,
        hadActiveHUD,
        toggleStatus,
        executeOnCallback
      ),
    });
  }
}

/**
 * Initialize the Token Variants module on Foundry VTT init
 */
async function initialize() {
  // Initialization should only be performed once
  if (initialized) {
    return;
  }

  // Want this to be executed once the module has initialized
  onInit.push(() => {
    // Need to wait for icons do be drawn first however I could not find a way
    // to wait until that has occurred. Instead we'll just wait for some static
    // amount of time.
    new Promise((resolve) => setTimeout(resolve, 500)).then(() => {
      for (const tkn of canvas.tokens.placeables) {
        drawOverlays(tkn); // Draw Overlays

        // Disable effect icons
        if (TVA_CONFIG.disableEffectIcons) {
          waitForTexture(tkn, (token) => {
            token.effects.removeChildren().forEach((c) => c.destroy());
            token.effects.bg = token.effects.addChild(new PIXI.Graphics());
            token.effects.overlay = null;
          });
        } else if (TVA_CONFIG.filterEffectIcons) {
          waitForTexture(tkn, (token) => {
            token.drawEffects();
          });
        }
      }
    });
  });

  await registerSettings();

  if (userRequiresImageCache()) {
    cacheImages();
  }

  // Startup ticker that will periodically call 'updateEmbeddedDocuments' with all the accrued updates since the last tick
  startBatchUpdater();

  // Insert default random image field
  Hooks.on('renderTokenConfig', async (config, html) => {
    const checkboxRandomize = html.find('input[name="randomImg"]');
    if (checkboxRandomize.length && !html.find('.token-variants-randomImgDefault').length) {
      const defaultImg =
        config.actor?.prototypeToken?.flags['token-variants']?.['randomImgDefault'] ||
        config.actor?.prototypeToken?.flags['token-hud-wildcard']?.['default'] ||
        '';

      const field = await renderTemplate(
        '/modules/token-variants/templates/randomImgDefault.html',
        { defaultImg, active: checkboxRandomize.is(':checked') }
      );
      checkboxRandomize.closest('.form-group').after(field);

      const tvaRngField = html.find('.token-variants-randomImgDefault');

      tvaRngField.find('button').click((event) => {
        event.preventDefault();
        const input = tvaRngField.find('input');
        new FilePicker({ current: input.val(), field: input[0] }).browse(defaultImg);
      });

      checkboxRandomize.click((event) => {
        if (event.target.checked) {
          tvaRngField.addClass('active');
        } else {
          tvaRngField.removeClass('active');
        }
      });
    }
  });

  // Set Default Wildcard images if needed
  Hooks.on('preCreateToken', (tokenDocument, data, options, userId) => {
    if (game.user.id === userId && tokenDocument.actor?.prototypeToken?.randomImg) {
      const defaultImg =
        tokenDocument.actor?.prototypeToken?.flags['token-variants']?.['randomImgDefault'] ||
        tokenDocument.actor?.prototypeToken?.flags['token-hud-wildcard']?.['default'] ||
        '';
      if (defaultImg) tokenDocument.updateSource({ 'texture.src': defaultImg });
    }
  });

  Hooks.on('createCombatant', (combatant, options, userId) => {
    if (game.userId !== userId) return;
    const token = combatant._token || canvas.tokens.get(combatant.tokenId);
    if (!token || !token.actor) return;

    const mappings = mergeObject(
      TVA_CONFIG.globalMappings,
      token.actor.getFlag('token-variants', 'effectMappings'),
      { inplace: false }
    );
    if (!('token-variants-combat' in mappings)) return;

    const effects = getTokenEffects(token, ['token-variants-combat']);

    effects.push('token-variants-combat');
    updateWithEffectMapping(token, effects, {
      added: ['token-variants-combat'],
    });
  });

  const deleteCombatant = async function (combatant) {
    const token = combatant._token || canvas.tokens.get(combatant.tokenId);
    if (!token || !token.actor) return;

    const mappings = mergeObject(
      TVA_CONFIG.globalMappings,
      token.actor.getFlag('token-variants', 'effectMappings'),
      { inplace: false }
    );
    if (!('token-variants-combat' in mappings)) return;

    const effects = getTokenEffects(token, ['token-variants-combat']);
    await updateWithEffectMapping(token, effects, {
      removed: ['token-variants-combat'],
    });
  };

  Hooks.on('deleteCombatant', (combatant, options, userId) => {
    if (game.userId !== userId) return;
    deleteCombatant(combatant);
  });

  Hooks.on('deleteCombat', (combat, options, userId) => {
    if (game.userId !== userId) return;
    combat.combatants.forEach((combatant) => {
      deleteCombatant(combatant);
    });
  });

  //
  // Handle image updates for Active Effects applied to Tokens WITH Linked Actors
  //

  let updateImageOnEffectChange = async function (effectName, actor, added = true) {
    const mappings = mergeObject(
      TVA_CONFIG.globalMappings,
      actor.getFlag('token-variants', 'effectMappings'),
      { inplace: false }
    );
    if (effectName in mappings) {
      const tokens = actor.token
        ? [actor.token]
        : actor.getActiveTokens().filter((tkn) => tkn.document.actorLink);
      for (const token of tokens) {
        const effects = getTokenEffects(token);
        await updateWithEffectMapping(token, effects, {
          added: added ? [effectName] : [],
          removed: !added ? [effectName] : [],
        });
      }
    }
  };

  let updateImageOnMultiEffectChange = async function (actor, added = [], removed = []) {
    if (!actor) return;
    const mappings = mergeObject(
      TVA_CONFIG.globalMappings,
      actor.getFlag('token-variants', 'effectMappings'),
      { inplace: false }
    );
    if (
      added.filter((ef) => ef in mappings).length ||
      removed.filter((ef) => ef in mappings).length
    ) {
      const tokens = actor.token
        ? [actor.token]
        : actor.getActiveTokens().filter((tkn) => tkn.document.actorLink);
      for (const token of tokens) {
        const effects = getTokenEffects(token);
        await updateWithEffectMapping(token, effects, {
          added: added,
          removed: removed,
        });
      }
    }
  };

  Hooks.on('createActiveEffect', (activeEffect, options, userId) => {
    if (!activeEffect.parent || activeEffect.disabled || game.userId !== userId) return;
    const effectName = game.system.id === 'pf2e' ? activeEffect.name : activeEffect.label;
    updateImageOnEffectChange(effectName, activeEffect.parent, true);
  });

  Hooks.on('deleteActiveEffect', (activeEffect, options, userId) => {
    if (!activeEffect.parent || activeEffect.disabled || game.userId !== userId) return;
    const effectName = game.system.id === 'pf2e' ? activeEffect.name : activeEffect.label;
    updateImageOnEffectChange(effectName, activeEffect.parent, false);
  });

  Hooks.on('preUpdateActiveEffect', (activeEffect, change, options, userId) => {
    if (!activeEffect.parent || game.userId !== userId) return;

    if ('label' in change) {
      options['token-variants-old-name'] = activeEffect.label;
    }
  });

  Hooks.on('updateActiveEffect', (activeEffect, change, options, userId) => {
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
      updateImageOnMultiEffectChange(activeEffect.parent, added, removed);
    }
  });

  // Want to track condition/effect previous name so that the config can be reverted for it
  Hooks.on('preUpdateItem', (item, change, options, userId) => {
    if (
      game.user.id === userId &&
      game.system.id === 'pf2e' &&
      ['condition', 'effect'].includes(item.type) &&
      'name' in change
    ) {
      options['token-variants-old-name'] = item.name;
    }
  });

  Hooks.on('updateItem', (item, change, options, userId) => {
    if (game.user.id !== userId) return;
    // Handle condition/effect name change
    if (
      game.system.id === 'pf2e' &&
      ['condition', 'effect'].includes(item.type) &&
      'name' in change
    ) {
      updateImageOnMultiEffectChange(
        item.parent,
        [change.name],
        [options['token-variants-old-name']]
      );
    }

    // Status Effects can be applied "stealthily" on item equip/un-equip
    if (
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
        updateImageOnMultiEffectChange(item.parent, added, removed);
      }
    }
  });

  //
  // PF2e hooks
  //

  Hooks.on('createItem', (item, options, userId) => {
    if (game.userId !== userId) return;
    if (game.system.id !== 'pf2e' || !['condition', 'effect'].includes(item.type) || !item.parent)
      return;
    updateImageOnEffectChange(item.name, item.parent, true);
  });

  Hooks.on('deleteItem', (item, options, userId) => {
    if (
      game.system.id !== 'pf2e' ||
      !['condition', 'effect'].includes(item.type) ||
      !item.parent ||
      item.disabled ||
      game.userId !== userId
    )
      return;
    updateImageOnEffectChange(item.name, item.parent, false);
  });

  if (typeof libWrapper === 'function') {
    // A fix to make sure that the "ghost" image of the token during drag reflects assigned user mappings
    libWrapper.register(
      'token-variants',
      'PlaceableObject.prototype._onDragLeftStart',
      function (wrapped, ...args) {
        // Change all the controlled tokens' source data if needed before they are cloned and drawn
        const targets = this.layer.options.controllableObjects ? this.layer.controlled : [this];
        const toUndo = [];
        for (const token of targets) {
          const mappings = token.document?.getFlag('token-variants', 'userMappings') || {};
          const img = mappings[game.userId];
          if (img) {
            toUndo.push([token, token.document._source.img]);
            token.document._source.img = img;
            token.document.texture.src = img;
          }
        }

        // Call _onDragLeftStart function to draw the new image
        let result = wrapped(...args);

        // Now that the image is drawn, reset the source data back to the original
        for (const [token, img] of toUndo) {
          token.document._source.img = img;
          token.document.texture.src = img;
        }

        return result;
      },
      'WRAPPER'
    );

    //
    // Overlay related wrappers
    //
    libWrapper.register(
      'token-variants',
      'Token.prototype.draw',
      async function (wrapped, ...args) {
        let result = await wrapped(...args);
        // drawOverlays(this);
        checkAndDisplayUserSpecificImage(this);
        return result;
      },
      'WRAPPER'
    );

    Hooks.on('refreshToken', (token) => {
      if (token.tva_sprites)
        for (const child of token.tva_sprites) {
          if (child instanceof TVA_Sprite) {
            child.refresh(null, false, false);
          }
        }
    });

    Hooks.on('destroyToken', (token) => {
      if (token.tva_sprites)
        for (const child of token.tva_sprites) {
          canvas.primary.removeChild(child)?.destroy();
        }
    });

    Hooks.on('hoverToken', (token, hoverIn) => {
      if (TVA_CONFIG.displayEffectIconsOnHover) {
        if (token.effects) {
          token.effects.visible = hoverIn;
        }
      }
    });

    Hooks.on('highlightObjects', () => {
      if (TVA_CONFIG.displayEffectIconsOnHover && canvas.tokens.active) {
        for (const tkn of canvas.tokens.placeables) {
          if (tkn.effects) {
            tkn.effects.visible = tkn.hover;
          }
        }
      }
    });

    if (TVA_CONFIG.disableEffectIcons) {
      libWrapper.register(
        'token-variants',
        'Token.prototype.drawEffects',
        async function (...args) {
          this.effects.removeChildren().forEach((c) => c.destroy());
          this.effects.bg = this.effects.addChild(new PIXI.Graphics());
          this.effects.overlay = null;
        },
        'OVERRIDE'
      );
    } else if (TVA_CONFIG.filterEffectIcons && !['pf1e', 'pf2e'].includes(game.system.id)) {
      libWrapper.register(
        'token-variants',
        'Token.prototype.drawEffects',
        async function (wrapped, ...args) {
          if (this.effects && TVA_CONFIG.displayEffectIconsOnHover) {
            this.effects.visible = false;
          }
          // Temporarily removing token and actor effects based on module settings
          // after the effect icons have been drawn, they will be reset to originals
          const tokenEffects = this.document.effects;
          const actorEffects = this.actor?.effects;

          let restrictedEffects = TVA_CONFIG.filterIconList;
          if (TVA_CONFIG.filterCustomEffectIcons) {
            const mappings = mergeObject(
              TVA_CONFIG.globalMappings,
              (this.actor ? this.actor : this.document).getFlag('token-variants', 'effectMappings'),
              { inplace: false }
            );
            if (mappings) restrictedEffects = restrictedEffects.concat(Object.keys(mappings));
          }

          let removed = [];
          if (restrictedEffects.length) {
            if (tokenEffects.length) {
              this.document.effects = tokenEffects.filter(
                // check if it's a string here
                // for tokens without representing actors effects are just stored as paths to icons
                (ef) => typeof ef === 'string' || !restrictedEffects.includes(ef.label)
              );
            }
            if (this.actor && actorEffects.size) {
              removed = actorEffects.filter((ef) => restrictedEffects.includes(ef.label));
              for (const r of removed) {
                actorEffects.delete(r.id);
              }
            }
          }

          const result = await wrapped(...args);

          if (restrictedEffects.length) {
            if (tokenEffects.length) {
              this.document.effects = tokenEffects;
            }
            if (removed.length) {
              for (const r of removed) {
                actorEffects.set(r.id, r);
              }
            }
          }
          return result;
        },
        'WRAPPER'
      );
    } else if (TVA_CONFIG.displayEffectIconsOnHover) {
      libWrapper.register(
        'token-variants',
        'Token.prototype.drawEffects',
        async function (wrapped, ...args) {
          if (this.effects && TVA_CONFIG.displayEffectIconsOnHover) {
            this.effects.visible = false;
          }
          return wrapped(...args);
        },
        'WRAPPER'
      );
    }
  }

  Hooks.on('preUpdateActor', function (actor, change, options, userId) {
    if (game.user.id !== userId) return;

    // If this is an HP update we need to determine what the current HP effects would be
    // so that they can be compared against in 'updateActor' hook
    let containsHPUpdate = false;
    if (game.system.id === 'cyberpunk-red-core') {
      containsHPUpdate = change.system?.derivedStats?.hp;
    } else {
      containsHPUpdate = change.system?.attributes?.hp;
    }

    if (containsHPUpdate) {
      const tokens = actor.token ? [actor.token] : actor.getActiveTokens();
      for (const tkn of tokens) {
        const hpEffects = [];
        applyHealthEffects(tkn, hpEffects);
        if (hpEffects.length) {
          if (!options['token-variants']) options['token-variants'] = {};
          options['token-variants'][tkn.id] = { hpEffects };
        }
      }
    }
  });

  Hooks.on('updateActor', async function (actor, change, options, userId) {
    if (game.user.id !== userId) return;

    if ('flags' in change && 'token-variants' in change.flags) {
      const tokenVariantFlags = change.flags['token-variants'];
      if ('effectMappings' in tokenVariantFlags || '-=effectMappings' in tokenVariantFlags) {
        const tokens = actor.token ? [actor.token] : actor.getActiveTokens();
        for (const tkn of tokens) {
          if (TVA_CONFIG.filterEffectIcons) {
            await tkn.drawEffects();
          }

          if (game.user.id === userId) updateWithEffectMapping(tkn, getTokenEffects(tkn));
          else drawOverlays(tkn);
        }
      }
    }

    let containsHPUpdate = false;
    if (game.system.id === 'cyberpunk-red-core') {
      containsHPUpdate = change.system?.derivedStats?.hp;
    } else {
      containsHPUpdate = change.system?.attributes?.hp;
    }

    if (containsHPUpdate) {
      const tokens = actor.token ? [actor.token] : actor.getActiveTokens();
      for (const tkn of tokens) {
        // Check if HP effects changed by comparing them against the ones calculated in preUpdateActor
        const newHPEffects = [];
        const added = [];
        const removed = [];
        applyHealthEffects(tkn, newHPEffects);
        const oldEffects = options['token-variants']?.[tkn.id]?.hpEffects || [];

        for (const ef of newHPEffects) {
          if (!oldEffects.includes(ef)) {
            added.push(ef);
          }
        }
        for (const ef of oldEffects) {
          if (!newHPEffects.includes(ef)) {
            removed.push(ef);
          }
        }

        if (added.length || removed.length)
          updateWithEffectMapping(tkn, getTokenEffects(tkn), { added, removed });
      }
    }
  });

  Hooks.on('updateToken', async function (token, change, options, userId) {
    if (game.user.id !== userId) return;

    let containsHPUpdate = false;
    if (game.system.id === 'cyberpunk-red-core') {
      containsHPUpdate = change.actorData?.system?.derivedStats?.hp;
    } else {
      containsHPUpdate = change.actorData?.system?.attributes?.hp;
    }

    if ('actorLink' in change || containsHPUpdate) {
      updateWithEffectMapping(token, getTokenEffects(token));
    }

    if (game.userId === userId && 'hidden' in change) {
      const effects = getTokenEffects(token, ['token-variants-visibility']);
      if (change.hidden) effects.push('token-variants-visibility');
      updateWithEffectMapping(token, effects, {
        added: change.hidden ? ['token-variants-visibility'] : [],
        removed: !change.hidden ? ['token-variants-visibility'] : [],
      });
    }
  });

  Hooks.on('renderArtSelect', () => {
    showArtSelectExecuting.inProgress = false;
  });

  game.socket?.on(`module.token-variants`, (message) => {
    // Workaround for forgeSearchPaths setting to be updated by non-GM clients
    if (message.handlerName === 'forgeSearchPaths' && message.type === 'UPDATE') {
      if (!game.user.isGM) return;
      const isResponsibleGM = !game.users
        .filter((user) => user.isGM && (user.active || user.isActive))
        .some((other) => other.id < game.user.id);
      if (!isResponsibleGM) return;
      updateSettings({ forgeSearchPaths: message.args });
    }

    // User specific token image update
    if (message.handlerName === 'userMappingChange' && message.type === 'UPDATE') {
      if (message.args.users.includes(game.userId)) {
        const tkn = canvas.tokens.get(message.args.tokenId);
        if (tkn) checkAndDisplayUserSpecificImage(tkn, true);
      }
    }

    if (message.handlerName === 'drawOverlays' && message.type === 'UPDATE') {
      if (message.args.all) {
        if (canvas.scene.id !== message.args.sceneId) {
          for (const tkn of canvas.tokens.placeables) {
            drawOverlays(tkn);
          }
        }
      } else if (message.args.tokenId) {
        const tkn = canvas.tokens.get(message.args.tokenId);
        if (tkn) drawOverlays(tkn);
      }
    }
  });

  // Handle actor/token art replacement
  Hooks.on('createActor', createActor);
  Hooks.on('createToken', createToken);

  Hooks.on('renderTokenConfig', modTokenConfig);
  Hooks.on('renderTileConfig', modTileConfig);
  Hooks.on('renderMeasuredTemplateConfig', modTemplateConfig);
  Hooks.on('renderActorSheet', modActorSheet);
  Hooks.on('renderItemSheet', modItemSheet);
  Hooks.on('renderItemActionSheet', modItemSheet);
  Hooks.on('renderJournalSheet', modJournalSheet);

  Hooks.on('renderTokenHUD', renderHud);
  Hooks.on('renderTileHUD', renderTileHUD);

  initialized = true;
  for (const cb of onInit) {
    cb();
  }
  onInit = [];
}

async function createToken(token, options, userId) {
  drawOverlays(token._object);
  if (userId && game.user.id != userId) return;
  updateWithEffectMapping(token, getTokenEffects(token));

  // Check if random search is enabled and if so perform it
  const randSettings = TVA_CONFIG.randomizer;
  let vDown = keyPressed('v');
  const flagTarget = token.actor ? game.actors.get(token.actor.id) : token.document ?? token;
  const randFlag = flagTarget.getFlag('token-variants', 'randomize');
  const popupFlag = flagTarget.getFlag('token-variants', 'popups');

  if (randFlag == null || randFlag) {
    if ((vDown && randSettings.tokenCopyPaste) || (!vDown && randSettings.tokenCreate)) {
      let performRandomSearch = true;
      if (randFlag == null) {
        if (randSettings.representedActorDisable && token.actor) performRandomSearch = false;
        if (randSettings.linkedActorDisable && token.actorLink) performRandomSearch = false;
        if (disableRandomSearchForType(randSettings, token.actor)) performRandomSearch = false;
      } else {
        performRandomSearch = randFlag;
      }

      if (performRandomSearch) {
        const img = await doRandomSearch(token.name, {
          searchType: SEARCH_TYPE.TOKEN,
          actor: token.actor,
        });
        if (img) {
          await updateTokenImage(img[0], {
            token: token,
            actor: token.actor,
            imgName: img[1],
          });
        }

        if (!img) return;

        if (randSettings.diffImages) {
          let imgPortrait;
          if (randSettings.syncImages) {
            imgPortrait = await doSyncSearch(token.name, img[1], {
              actor: token.actor,
              searchType: SEARCH_TYPE.PORTRAIT,
            });
          } else {
            imgPortrait = await doRandomSearch(token.name, {
              searchType: SEARCH_TYPE.PORTRAIT,
              actor: token.actor,
            });
          }

          if (imgPortrait) {
            await updateActorImage(token.actor, imgPortrait[0]);
          }
        } else if (randSettings.tokenToPortrait) {
          await updateActorImage(token.actor, img[0]);
        }
        return;
      }
      if (popupFlag == null && !randSettings.popupOnDisable) {
        return;
      }
    } else if (randSettings.tokenCreate || randSettings.tokenCopyPaste) {
      return;
    }
  }

  // Check if pop-up is enabled and if so open it
  if (!TVA_CONFIG.permissions.popups[game.user.role]) {
    return;
  }

  let dirKeyDown = keyPressed('popupOverride');

  if (vDown && TVA_CONFIG.popup.disableAutoPopupOnTokenCopyPaste) {
    return;
  }

  if (!dirKeyDown || (dirKeyDown && vDown)) {
    if (TVA_CONFIG.popup.disableAutoPopupOnTokenCreate && !vDown) {
      return;
    } else if (popupFlag == null && disablePopupForType(token.actor)) {
      return;
    } else if (popupFlag != null && !popupFlag) {
      return;
    }
  }

  showArtSelect(token.name, {
    callback: async function (imgSrc, imgName) {
      if (TVA_CONFIG.popup.twoPopups) {
        await updateActorImage(token.actor, imgSrc);
        twoPopupPrompt(token.actor, imgSrc, imgName, token);
      } else {
        updateTokenImage(imgSrc, {
          actor: token.actor,
          imgName: imgName,
          token: token,
        });
      }
    },
    searchType: TVA_CONFIG.popup.twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.TOKEN,
    object: token,
    preventClose: TVA_CONFIG.popup.twoPopups && TVA_CONFIG.popup.twoPopupsNoDialog,
  });
}

async function createActor(actor, options, userId) {
  if (userId && game.user.id != userId) return;

  // Check if random search is enabled and if so perform it
  const randSettings = TVA_CONFIG.randomizer;
  if (randSettings.actorCreate) {
    let performRandomSearch = true;
    if (randSettings.linkedActorDisable && actor.prototypeToken.actorLink)
      performRandomSearch = false;
    if (disableRandomSearchForType(randSettings, actor)) performRandomSearch = false;

    if (performRandomSearch) {
      const img = await doRandomSearch(actor.name, {
        searchType: SEARCH_TYPE.PORTRAIT,
        actor: actor,
      });
      if (img) {
        await updateActorImage(actor, img[0]);
      }

      if (!img) return;

      if (randSettings.diffImages) {
        let imgToken;
        if (randSettings.syncImages) {
          imgToken = await doSyncSearch(actor.name, img[1], { actor: actor });
        } else {
          imgToken = await doRandomSearch(actor.name, {
            searchType: SEARCH_TYPE.TOKEN,
            actor: actor,
          });
        }

        if (imgToken) {
          await updateTokenImage(imgToken[0], { actor: actor, imgName: imgToken[1] });
        }
      }
      return;
    }
    if (!randSettings.popupOnDisable) {
      return;
    }
  }

  // Check if pop-up is enabled and if so open it
  if (!TVA_CONFIG.permissions.popups[game.user.role]) {
    return;
  }

  if (TVA_CONFIG.popup.disableAutoPopupOnActorCreate && !keyPressed('popupOverride')) {
    return;
  } else if (disablePopupForType(actor)) {
    return;
  }

  showArtSelect(actor.name, {
    callback: async function (imgSrc, name) {
      const actTokens = actor.getActiveTokens();
      const token = actTokens.length === 1 ? actTokens[0] : null;
      await updateActorImage(actor, imgSrc);
      if (TVA_CONFIG.popup.twoPopups) twoPopupPrompt(actor, imgSrc, name, token);
      else {
        updateTokenImage(imgSrc, {
          actor: actor,
          imgName: name,
          token: token,
        });
      }
    },
    searchType: TVA_CONFIG.popup.twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.PORTRAIT_AND_TOKEN,
    object: actor,
    preventClose: TVA_CONFIG.popup.twoPopups && TVA_CONFIG.popup.twoPopupsNoDialog,
  });
}

/**
 * Adds a button to 'Token Configuration' window's 'Image' tab which opens
 * ArtSelect using the token's name.
 */
function modTokenConfig(tokenConfig, html, _) {
  if (TVA_CONFIG.permissions.image_path_button[game.user.role]) {
    let fields = html[0].getElementsByClassName('image');
    for (let field of fields) {
      if (field.getAttribute('name') == 'texture.src') {
        let el = document.createElement('button');
        el.type = 'button';
        el.title = game.i18n.localize('token-variants.windows.art-select.select-variant');
        el.className = 'token-variants-image-select-button';
        el.innerHTML = '<i class="fas fa-images"></i>';
        el.tabIndex = -1;
        el.setAttribute('data-type', 'imagevideo');
        el.setAttribute('data-target', 'texture.src');
        el.onclick = async () => {
          showArtSelect(tokenConfig.object.name, {
            callback: (imgSrc, name) => {
              field.value = imgSrc;
              const tokenConfig = getTokenConfigForUpdate(imgSrc, name);
              if (tokenConfig) {
                for (var key in tokenConfig) {
                  $(html).find(`[name="${key}"]`).val(tokenConfig[key]);
                }
              }
            },
            searchType: SEARCH_TYPE.TOKEN,
            object: tokenConfig.object,
          });
        };
        field.parentNode.append(el);
        return;
      }
    }
  }
}

/**
 * Adds a button to 'Tile Configuration' window's 'Tile Image or Video' form-group
 * to open an ArtSelect using the tile's name.
 */
function modTileConfig(tileConfig, html, _) {
  if (TVA_CONFIG.permissions.image_path_button[game.user.role]) {
    let fields = html[0].getElementsByClassName('image');
    for (let field of fields) {
      if (field.getAttribute('name') == 'texture.src') {
        let el = document.createElement('button');
        el.type = 'button';
        el.title = game.i18n.localize('token-variants.windows.art-select.select-variant');
        el.className = 'token-variants-image-select-button';
        el.innerHTML = '<i class="fas fa-images"></i>';
        el.tabIndex = -1;
        el.setAttribute('data-type', 'imagevideo');
        el.setAttribute('data-target', 'img');
        el.onclick = async () => {
          const tileName =
            tileConfig.object.getFlag('token-variants', 'tileName') ||
            tileConfig.object.id ||
            'new tile';
          showArtSelect(tileName, {
            callback: (imgSrc, name) => {
              field.value = imgSrc;
            },
            searchType: SEARCH_TYPE.TILE,
          });
        };
        field.parentNode.append(el);
        return;
      }
    }
  }
}

/**
 * Adds a button to 'Measured Template Configuration' window
 */
function modTemplateConfig(templateConfig, html, _) {
  if (TVA_CONFIG.permissions.image_path_button[game.user.role]) {
    let fields = html[0].getElementsByClassName('image');
    for (let field of fields) {
      if (field.getAttribute('name') == 'texture') {
        let el = document.createElement('button');
        el.type = 'button';
        el.title = game.i18n.localize('token-variants.windows.art-select.select-variant');
        el.className = 'token-variants-image-select-button';
        el.innerHTML = '<i class="fas fa-images"></i>';
        el.tabIndex = -1;
        el.setAttribute('data-type', 'imagevideo');
        el.setAttribute('data-target', 'img');
        el.onclick = async () => {
          showArtSelect('template', {
            callback: (imgSrc, name) => {
              field.value = imgSrc;
            },
            searchType: SEARCH_TYPE.TILE,
          });
        };
        field.parentNode.append(el);
        return;
      }
    }
  }
}

/**
 * Adds right-click listener to Actor Sheet profile image to open up
 * the 'Art Select' screen.
 */
function modActorSheet(actorSheet, html, options) {
  if (options.editable && TVA_CONFIG.permissions.portrait_right_click[game.user.role]) {
    let profile = null;
    let profileQueries = {
      all: ['.profile', '.profile-img', '.profile-image'],
      pf2e: ['.player-image', '.actor-icon', '.sheet-header img', '.actor-image'],
    };

    for (let query of profileQueries.all) {
      profile = html[0].querySelector(query);
      if (profile) break;
    }

    if (!profile && game.system.id in profileQueries) {
      for (let query of profileQueries[game.system.id]) {
        profile = html[0].querySelector(query);
        if (profile) break;
      }
    }

    if (!profile) {
      console.log(game.i18n.localize('token-variants.notifications.warn.profile-image-not-found'));
      return;
    }

    profile.addEventListener(
      'contextmenu',
      function (ev) {
        showArtSelect(actorSheet.object.name, {
          callback: (imgSrc, name) => updateActorImage(actorSheet.object, imgSrc),
          searchType: SEARCH_TYPE.PORTRAIT,
          object: actorSheet.object,
        });
      },
      false
    );
  }
}

function modItemSheet(itemSheet, html, options) {
  $(html)
    .find('img.profile')
    .on('contextmenu', () => {
      const item = itemSheet.object;
      if (!item) return;
      showArtSelect(item.name, {
        searchType: SEARCH_TYPE.ITEM,
        callback: (imgSrc) => item.update({ img: imgSrc }),
      });
    });
}

function modJournalSheet(journalSheet, html, options) {
  $(html)
    .find('.header-button.entry-image')
    .on('contextmenu', () => {
      const journal = journalSheet.object;
      if (!journal) return;
      showArtSelect(journal.name, {
        searchType: SEARCH_TYPE.JOURNAL,
        callback: (imgSrc) => journal.update({ img: imgSrc }),
      });
    });
}

export async function saveCache(cacheFile) {
  const data = {};

  const caches = Object.keys(CACHED_IMAGES);
  for (const c of caches) {
    if (!(c in data)) data[c] = [];
    for (const img of CACHED_IMAGES[c]) {
      if (getFileName(img.path) === img.name) {
        data[c].push(img.path);
      } else {
        data[c].push([img.path, img.name]);
      }
    }
  }

  let file = new File([JSON.stringify(data)], getFileNameWithExt(cacheFile), {
    type: 'text/plain',
  });
  FilePicker.upload('data', getFilePath(cacheFile), file);
}

async function _readCacheFromFile(fileName) {
  CACHED_IMAGES = {};
  try {
    await jQuery.getJSON(fileName, (json) => {
      for (let category in json) {
        // Old version cache support
        if (category === 'tokenImages') {
          category = 'Portrait,Token,PortraitAndToken';
          json[category] = json.tokenImages;
        } else if (category === 'tileImages') {
          category = 'Tile';
          json[category] = json.tileImages;
        }

        CACHED_IMAGES[category] = [];

        for (const img of json[category]) {
          if (Array.isArray(img)) {
            CACHED_IMAGES[category].push({ path: img[0], name: img[1] });
          } else {
            CACHED_IMAGES[category].push({ path: img, name: getFileName(img) });
          }
        }
      }
      if (!TVA_CONFIG.disableNotifs)
        ui.notifications.info(
          `Token Variant Art: Using Static Cache (${Object.keys(CACHED_IMAGES).reduce(
            (count, c) => count + CACHED_IMAGES[c].length,
            0
          )} images)`
        );
    });
  } catch (error) {
    ui.notifications.warn(`Token Variant Art: Static Cache not found`);
    CACHED_IMAGES = {};
    return false;
  }
  return true;
}

/**
 * Search for and cache all the found token art
 */
export async function cacheImages({
  staticCache = TVA_CONFIG.staticCache,
  staticCacheFile = TVA_CONFIG.staticCacheFile,
} = {}) {
  if (caching) return;
  caching = true;

  if (!initialized && staticCache) {
    if (await _readCacheFromFile(staticCacheFile)) {
      caching = false;
      return;
    }
  }

  if (!TVA_CONFIG.disableNotifs)
    ui.notifications.info(game.i18n.format('token-variants.notifications.info.caching-started'));

  if (TVA_CONFIG.debug) console.log('STARTING: Token Caching');
  const found_images = await walkAllPaths();
  CACHED_IMAGES = found_images;

  if (TVA_CONFIG.debug) console.log('ENDING: Token Caching');

  caching = false;
  if (!TVA_CONFIG.disableNotifs)
    ui.notifications.info(
      game.i18n.format('token-variants.notifications.info.caching-finished', {
        imageCount: Object.keys(CACHED_IMAGES).reduce(
          (count, types) => count + CACHED_IMAGES[types].length,
          0
        ),
      })
    );

  if (staticCache && game.user.isGM) {
    saveCache(staticCacheFile);
  }
}

/**
 * Checks if image path and name match the provided search text and filters
 * @param imagePath image path
 * @param imageName image name
 * @param filters filters to be applied
 * @returns true|false
 */
function exactSearchMatchesImage(simplifiedSearch, imagePath, imageName, filters, runSearchOnPath) {
  // Is the search text contained in the name/path
  const simplified = runSearchOnPath ? simplifyPath(imagePath) : simplifyName(imageName);
  if (!simplified.includes(simplifiedSearch)) {
    return false;
  }

  if (!filters) return true;
  return imagePassesFilter(imageName, imagePath, filters, runSearchOnPath);
}

function imagePassesFilter(imageName, imagePath, filters, runSearchOnPath) {
  // Filters are applied to path depending on the 'runSearchOnPath' setting, and actual or custom rolltable name
  let text;
  if (runSearchOnPath) {
    text = decodeURIComponent(imagePath);
  } else if (getFileName(imagePath) === imageName) {
    text = getFileNameWithExt(imagePath);
  } else {
    text = imageName;
  }

  if (filters.regex) {
    return filters.regex.test(text);
  }
  if (filters.include) {
    if (!text.includes(filters.include)) return false;
  }
  if (filters.exclude) {
    if (text.includes(filters.exclude)) return false;
  }
  return true;
}

async function findImages(name, searchType = '', searchOptions = {}) {
  const sOptions = mergeObject(searchOptions, getSearchOptions(), { overwrite: false });
  if (sOptions.algorithm.exact) {
    return await findImagesExact(name, searchType, sOptions);
  } else {
    return await findImagesFuzzy(name, searchType, sOptions);
  }
}

async function findImagesExact(name, searchType, searchOptions) {
  if (TVA_CONFIG.debug)
    console.log('STARTING: Exact Image Search', name, searchType, searchOptions);

  const found_images = await walkAllPaths(searchType);

  const simpleName = simplifyName(name);
  const filters = getFilters(searchType, searchOptions.searchFilters);

  const matchedImages = [];

  for (const container of [CACHED_IMAGES, found_images]) {
    for (const typeKey in container) {
      const types = typeKey.split(',');
      if (types.includes(searchType)) {
        for (const imgOBj of container[typeKey]) {
          if (
            exactSearchMatchesImage(
              simpleName,
              imgOBj.path,
              imgOBj.name,
              filters,
              searchOptions.runSearchOnPath
            )
          ) {
            matchedImages.push(imgOBj);
          }
        }
      }
    }
  }

  if (TVA_CONFIG.debug) console.log('ENDING: Exact Image Search', matchedImages);
  return matchedImages;
}

export async function findImagesFuzzy(name, searchType, searchOptions, forceSearchName = false) {
  if (TVA_CONFIG.debug)
    console.log('STARTING: Fuzzy Image Search', name, searchType, searchOptions, forceSearchName);

  const filters = getFilters(searchType, searchOptions.searchFilters);

  const fuse = new Fuse([], {
    keys: [!forceSearchName && searchOptions.runSearchOnPath ? 'path' : 'name'],
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 1,
    ignoreLocation: true,
    threshold: searchOptions.algorithm.fuzzyThreshold,
  });

  const found_images = await walkAllPaths(searchType);

  for (const container of [CACHED_IMAGES, found_images]) {
    for (const typeKey in container) {
      const types = typeKey.split(',');
      if (types.includes(searchType)) {
        for (const imgObj of container[typeKey]) {
          if (imagePassesFilter(imgObj.name, imgObj.path, filters, searchOptions.runSearchOnPath)) {
            fuse.add(imgObj);
          }
        }
      }
    }
  }

  let results;
  if (name === '') {
    results = fuse.getIndex().docs.slice(0, searchOptions.algorithm.fuzzyLimit);
  } else {
    results = fuse.search(name).slice(0, searchOptions.algorithm.fuzzyLimit);
    results = results.map((r) => {
      r.item.indices = r.matches[0].indices;
      r.item.score = r.score;
      return r.item;
    });
  }

  if (TVA_CONFIG.debug) console.log('ENDING: Fuzzy Image Search', results);

  return results;
}

function filterPathsByType(paths, searchType) {
  if (!searchType) return paths;
  return paths.filter((p) => p.types.includes(searchType));
}

async function walkAllPaths(searchType) {
  const found_images = {};
  const paths = filterPathsByType(TVA_CONFIG.searchPaths, searchType);

  for (const path of paths) {
    if ((path.cache && caching) || (!path.cache && !caching))
      await walkFindImages(path, {}, found_images);
  }

  // ForgeVTT specific path handling
  const userId = typeof ForgeAPI !== 'undefined' ? await ForgeAPI.getUserId() : '';
  for (const uid in TVA_CONFIG.forgeSearchPaths) {
    const apiKey = TVA_CONFIG.forgeSearchPaths[uid].apiKey;
    const paths = filterPathsByType(TVA_CONFIG.forgeSearchPaths[uid].paths, searchType);
    if (uid === userId) {
      for (const path of paths) {
        if ((path.cache && caching) || (!path.cache && !caching))
          await walkFindImages(path, {}, found_images);
      }
    } else if (apiKey) {
      for (const path of paths) {
        if ((path.cache && caching) || (!path.cache && !caching)) {
          if (path.share) await walkFindImages(path, { apiKey: apiKey }, found_images);
        }
      }
    }
  }

  return found_images;
}

function addToFound(img, typeKey, found_images) {
  if (isImage(img.path) || isVideo(img.path)) {
    if (found_images[typeKey] == null) {
      found_images[typeKey] = [img];
    } else {
      found_images[typeKey].push(img);
    }
  }
}

async function walkFindImages(path, { apiKey = '' } = {}, found_images) {
  let files = {};
  if (!path.source) {
    path.source = 'data';
  }
  const typeKey = path.types.sort().join(',');
  try {
    if (path.source.startsWith('s3:')) {
      files = await FilePicker.browse('s3', path.text, {
        bucket: path.source.replace('s3:', ''),
      });
    } else if (path.source.startsWith('forgevtt')) {
      if (apiKey) {
        const response = await callForgeVTT(path.text, apiKey);
        files.files = response.files.map((f) => f.url);
      } else {
        files = await FilePicker.browse('forgevtt', path.text, { recursive: true });
      }
    } else if (path.source.startsWith('forge-bazaar')) {
      files = await FilePicker.browse('forge-bazaar', path.text, { recursive: true });
    } else if (path.source.startsWith('imgur')) {
      await fetch('https://api.imgur.com/3/gallery/album/' + path.text, {
        headers: {
          Authorization:
            'Client-ID ' +
            (TVA_CONFIG.imgurClientId ? TVA_CONFIG.imgurClientId : 'df9d991443bb222'),
          Accept: 'application/json',
        },
      })
        .then((response) => response.json())
        .then(async function (result) {
          if (!result.success) {
            return;
          }
          result.data.images.forEach((img) => {
            const rtName = img.title ?? img.description ?? getFileName(img.link);
            addToFound({ path: img.link, name: rtName }, typeKey, found_images);
          });
        })
        .catch((error) => console.log('Token Variant Art: ', error));
      return;
    } else if (path.source.startsWith('rolltable')) {
      const table = game.tables.contents.find((t) => t.name === path.text);
      if (!table) {
        const rollTableName = path.text;
        ui.notifications.warn(
          game.i18n.format('token-variants.notifications.warn.invalid-table', {
            rollTableName,
          })
        );
      } else {
        for (let baseTableData of table.results) {
          const rtPath = baseTableData.img;
          const rtName = baseTableData.text || getFileName(rtPath);
          addToFound({ path: rtPath, name: rtName }, typeKey, found_images);
        }
      }
      return;
    } else {
      files = await FilePicker.browse(path.source, path.text);
    }
  } catch (err) {
    console.log(
      `Token Variant Art | ${game.i18n.localize(
        'token-variants.notifications.warn.path-not-found'
      )} ${path.source}:${path.text}`
    );
    return;
  }

  if (files.target == '.') return;

  if (files.files) {
    files.files.forEach((tokenSrc) => {
      addToFound({ path: tokenSrc, name: getFileName(tokenSrc) }, typeKey, found_images);
    });
  }

  if (path.source.startsWith('forgevtt') || path.source.startsWith('forge-bazaar')) return;

  for (let f_dir of files.dirs) {
    await walkFindImages(
      { text: f_dir, source: path.source, types: path.types },
      { apiKey: apiKey },
      found_images
    );
  }
}

/**
 * Performs searches and displays the Art Select pop-up with the results
 * @param {string} search The text to be used as the search criteria
 * @param {object} [options={}] Options which customize the search
 * @param {Function[]} [options.callback] Function to be called with the user selected image path
 * @param {SEARCH_TYPE|string} [options.searchType] Controls filters applied to the search results
 * @param {Token|Actor} [options.object] Token/Actor used when displaying Custom Token Config prompt
 * @param {boolean} [options.force] If true will always override the current Art Select window if one exists instead of adding it to the queue
 * @param {object} [options.searchOptions] Override search and filter settings
 */
export async function showArtSelect(
  search,
  {
    callback = null,
    searchType = SEARCH_TYPE.PORTRAIT_AND_TOKEN,
    object = null,
    force = false,
    preventClose = false,
    image1 = '',
    image2 = '',
    displayMode = ArtSelect.IMAGE_DISPLAY.NONE,
    multipleSelection = false,
    searchOptions = {},
    allImages = null,
  } = {}
) {
  if (caching) return;

  const artSelects = Object.values(ui.windows).filter((app) => app instanceof ArtSelect);
  if (showArtSelectExecuting.inProgress || (!force && artSelects.length !== 0)) {
    addToArtSelectQueue(search, {
      callback,
      searchType,
      object,
      preventClose,
      searchOptions,
      allImages,
    });
    return;
  }

  showArtSelectExecuting.inProgress = true;

  if (!allImages)
    allImages = await doImageSearch(search, {
      searchType: searchType,
      searchOptions: searchOptions,
    });

  new ArtSelect(search, {
    allImages: allImages,
    searchType: searchType,
    callback: callback,
    object: object,
    preventClose: preventClose,
    image1: image1,
    image2: image2,
    displayMode: displayMode,
    multipleSelection: multipleSelection,
    searchOptions: searchOptions,
  }).render(true);
}

async function _randSearchUtil(
  search,
  {
    searchType = SEARCH_TYPE.PORTRAIT_AND_TOKEN,
    actor = null,
    randomizerOptions = {},
    searchOptions = {},
  } = {}
) {
  const randSettings = mergeObject(randomizerOptions, TVA_CONFIG.randomizer, { overwrite: false });
  if (
    !(
      randSettings.tokenName ||
      randSettings.keywords ||
      randSettings.shared ||
      randSettings.wildcard
    )
  )
    return null;

  // Randomizer settings take precedence
  searchOptions.keywordSearch = randSettings.keywords;

  // Gather all images
  let results =
    randSettings.tokenName || randSettings.keywords
      ? await doImageSearch(search, {
          searchType: searchType,
          searchOptions: searchOptions,
        })
      : new Map();

  if (!randSettings.tokenName) {
    results.delete(search);
  }
  if (randSettings.shared && actor) {
    let sharedVariants = actor.getFlag('token-variants', 'variants') || [];
    if (sharedVariants.length != 0) {
      const sv = [];
      sharedVariants.forEach((variant) => {
        variant.names.forEach((name) => {
          sv.push({ path: variant.imgSrc, name: name });
        });
      });
      results.set('variants95436723', sv);
    }
  }
  if (randSettings.wildcard && actor) {
    let protoImg = actor.prototypeToken.texture.src;
    if (protoImg.includes('*') || (protoImg.includes('{') && protoImg.includes('}'))) {
      // Modified version of Actor.getTokenImages()
      const getTokenImages = async (actor) => {
        if (actor._tokenImages) return actor._tokenImages;
        let source = 'data';
        const browseOptions = { wildcard: true };

        // Support non-user sources
        if (/\.s3\./.test(protoImg)) {
          source = 's3';
          const { bucket, keyPrefix } = FilePicker.parseS3URL(protoImg);
          if (bucket) {
            browseOptions.bucket = bucket;
            protoImg = keyPrefix;
          }
        } else if (protoImg.startsWith('icons/')) source = 'public';

        // Retrieve wildcard content
        try {
          const content = await FilePicker.browse(source, protoImg, browseOptions);
          return content.files;
        } catch (err) {
          return [];
        }
      };

      const wildcardImages = (await getTokenImages(actor))
        .filter((img) => !img.includes('*') && (isImage(img) || isVideo(img)))
        .map((variant) => {
          return { path: variant, name: getFileName(variant) };
        });
      results.set('variants95436623', wildcardImages);
    }
  }

  return results;
}

async function doSyncSearch(search, target, { searchType = SEARCH_TYPE.TOKEN, actor = null } = {}) {
  if (caching) return null;

  const results = flattenSearchResults(
    await _randSearchUtil(search, { searchType: searchType, actor: actor })
  );

  // Find the image with the most similar name
  const fuse = new Fuse(results, {
    keys: ['name'],
    minMatchCharLength: 1,
    ignoreLocation: true,
    threshold: 0.4,
  });

  const fResults = fuse.search(target);

  if (fResults && fResults.length !== 0) {
    return [fResults[0].item.path, fResults[0].item.name];
  } else {
    return null;
  }
}

/**
 * @param {*} search Text to be used as the search criteria
 * @param {object} [options={}] Options which customize the search
 * @param {SEARCH_TYPE|string} [options.searchType] Controls filters applied to the search results
 * @param {Actor} [options.actor] Used to retrieve 'shared' images from if enabled in the Randomizer Settings
 * @param {Function[]} [options.callback] Function to be called with the random image
 * @param {object} [options.searchOptions] Override search settings
 * @param {object} [options.randomizerOptions] Override randomizer settings. These take precedence over searchOptions
 * @returns Array<string>|null} Image path and name
 */
async function doRandomSearch(
  search,
  {
    searchType = SEARCH_TYPE.PORTRAIT_AND_TOKEN,
    actor = null,
    callback = null,
    randomizerOptions = {},
    searchOptions = {},
  } = {}
) {
  if (caching) return null;

  const results = flattenSearchResults(
    await _randSearchUtil(search, {
      searchType: searchType,
      actor: actor,
      randomizerOptions: randomizerOptions,
      searchOptions: searchOptions,
    })
  );
  if (results.length === 0) return null;

  // Pick random image
  let randImageNum = Math.floor(Math.random() * results.length);
  if (callback) callback([results[randImageNum].path, results[randImageNum].name]);
  return [results[randImageNum].path, results[randImageNum].name];
}

/**
 * @param {string} search Text to be used as the search criteria
 * @param {object} [options={}] Options which customize the search
 * @param {SEARCH_TYPE|string} [options.searchType] Controls filters applied to the search results
 * @param {Boolean} [options.simpleResults] Results will be returned as an array of all image paths found
 * @param {Function[]} [options.callback] Function to be called with the found images
 * @param {object} [options.searchOptions] Override search settings
 * @returns {Promise<Map<string, Array<object>|Array<string>>} All images found split by original criteria and keywords
 */
export async function doImageSearch(
  search,
  {
    searchType = SEARCH_TYPE.PORTRAIT_AND_TOKEN,
    simpleResults = false,
    callback = null,
    searchOptions = {},
  } = {}
) {
  if (caching) return;

  searchOptions = mergeObject(searchOptions, getSearchOptions(), { overwrite: false });

  search = search.trim();

  if (TVA_CONFIG.debug) console.log('STARTING: Art Search', search, searchType, searchOptions);

  let searches = [search];
  let allImages = new Map();
  const keywords = parseKeywords(searchOptions.excludedKeywords);

  if (searchOptions.keywordSearch) {
    searches = searches.concat(
      search
        .split(/[_\- :,\|\(\)\[\]]/)
        .filter((word) => word.length > 2 && !keywords.includes(word.toLowerCase()))
        .reverse()
    );
  }

  let usedImages = new Set();
  for (const search of searches) {
    if (allImages.get(search) !== undefined) continue;

    let results = await findImages(search, searchType, searchOptions);
    results = results.filter((pathObj) => !usedImages.has(pathObj));

    allImages.set(search, results);
    results.forEach(usedImages.add, usedImages);
  }

  if (TVA_CONFIG.debug) console.log('ENDING: Art Search');

  if (simpleResults) {
    allImages = Array.from(usedImages).map((obj) => obj.path);
  }

  if (callback) callback(allImages);
  return allImages;
}

function twoPopupPrompt(actor, imgSrc, imgName, token) {
  if (TVA_CONFIG.popup.twoPopups && TVA_CONFIG.popup.twoPopupsNoDialog) {
    showArtSelect((token ?? actor.prototypeToken).name, {
      callback: (imgSrc, name) =>
        updateTokenImage(imgSrc, {
          actor: actor,
          imgName: name,
          token: token,
        }),
      searchType: SEARCH_TYPE.TOKEN,
      object: token ? token : actor,
      force: true,
    });
  } else if (TVA_CONFIG.popup.twoPopups) {
    let d = new Dialog({
      title: 'Portrait -> Token',
      content: `<p>${game.i18n.localize('token-variants.windows.art-select.apply-same-art')}</p>`,
      buttons: {
        one: {
          icon: '<i class="fas fa-check"></i>',
          callback: () => {
            updateTokenImage(imgSrc, {
              actor: actor,
              imgName: imgName,
              token: token,
            });
            const artSelects = Object.values(ui.windows).filter((app) => app instanceof ArtSelect);
            for (const app of artSelects) {
              app.close();
            }
          },
        },
        two: {
          icon: '<i class="fas fa-times"></i>',
          callback: () => {
            showArtSelect((token ?? actor.prototypeToken).name, {
              callback: (imgSrc, name) =>
                updateTokenImage(imgSrc, {
                  actor: actor,
                  imgName: name,
                  token: token,
                }),
              searchType: SEARCH_TYPE.TOKEN,
              object: token ? token : actor,
              force: true,
            });
          },
        },
      },
      default: 'one',
    });
    d.render(true);
  }
}

// Initialize module
Hooks.once('ready', initialize);

// Register API and Keybinds
Hooks.on('init', function () {
  registerKeybinds();

  game.modules.get('token-variants').api = {
    cacheImages,
    doImageSearch,
    doRandomSearch,
    showArtSelect,
    updateTokenImage,
    exportSettingsToJSON,
    TVA_CONFIG,
    applyHealthEffects,
  };
});

Hooks.on('canvasReady', async function () {
  for (const tkn of canvas.tokens.placeables) {
    // Once canvas is ready we need to overwrite token images if specific maps exist for the user
    checkAndDisplayUserSpecificImage(tkn);
    if (initialized) {
      updateWithEffectMapping(tkn, getTokenEffects(tkn));
      drawOverlays(tkn);
    }
  }

  // // Effect Mappings may have changed while on a different scene, re-apply them
  // const refreshMappings = () => {
  //   for (const tkn of canvas.tokens.placeables) {
  //     updateWithEffectMapping(tkn, getTokenEffects(tkn));
  //   }
  // };
  // if (initialized) {
  //   refreshMappings();
  // } else {
  //   onInit.push(refreshMappings);
  // }
});
