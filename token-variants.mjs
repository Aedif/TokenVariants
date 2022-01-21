import {SearchPaths, ForgeSearchPaths} from "./applications/searchPaths.js";
import ArtSelect from "./applications/artSelect.js";
import TokenHUDSettings from "./applications/tokenHUDSettings.js";
import FilterSettings from "./applications/searchFilters.js";
import RandomizerSettings from "./applications/randomizerSettings.js";
import PopUpSettings from "./applications/popupSettings.js";
import { getFileName, getFileNameWithExt, simplifyTokenName, simplifyPath, parseSearchPaths, parseKeywords, isImage, isVideo, getTokenConfigForUpdate, SEARCH_TYPE, callForgeVTT} from "./scripts/utils.js"
import { renderHud } from "./applications/tokenHUD.js"

// Default path where the script will look for token art
const DEFAULT_TOKEN_PATHS = [{text: "modules/caeora-maps-tokens-assets/assets/tokens/", cache: true}];

// Controls whether a keyword search is to be performed in addition to full-name search
let keywordSearch = false;
let excludedKeywords = [];

// True if in the middle of caching image paths
let caching = false;

// A cached map of all the found tokens
let cachedTokens = new Map();

// Tokens found with caching disabled
let foundTokens = new Map();

// Tracks if module has been initialized
let initialized = false;

// Keyboard key controlling the pop-up when dragging in a token from the Actor Directory
let actorDirKey = "";

// Controls whether separate popups are displayed for portrait and token art
let twoPopups = false;
let noTwoPopupsPrompt = false;

// Prevent registering of right-click listener on the character sheet
let disableActorPortraitListener = false;

let debug = false;

let runSearchOnPath = false;

// Search paths parsed into a format usable in search functions
let parsedSearchPaths;

async function registerWorldSettings() {

    game.settings.register("token-variants", "debug", {
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        onChange: val => debug = val
    });

    game.settings.registerMenu("token-variants", "searchPaths", {
        name: game.i18n.localize('token-variants.settings.search-paths.Name'),
        hint: game.i18n.localize('token-variants.settings.search-paths.Hint'),
        icon: "fas fa-exchange-alt",
        type: SearchPaths,
        restricted: true,
    });

    game.settings.register("token-variants", "searchPaths", {
        scope: "world",
        config: false,
        type: Array,
        default: DEFAULT_TOKEN_PATHS,
        onChange: async function (_) {
            if (game.user.can("SETTINGS_MODIFY"))
                await game.settings.set("token-variants", "forgevttPaths", []);
            parsedSearchPaths = await parseSearchPaths(debug);
            cacheTokens();
        }
    });

    game.settings.register("token-variants", "forgeSearchPaths", {
        scope: "world",
        config: false,
        type: Object,
        default: {},
        onChange: async function (_) {
            if (game.user.can("SETTINGS_MODIFY"))
                await game.settings.set("token-variants", "forgevttPaths", []);
            parsedSearchPaths = await parseSearchPaths(debug);
            cacheTokens();
        }
    });

    // World level Token HUD setting
    game.settings.register("token-variants", "enableTokenHUDButtonForAll", {
        scope: "world",
        type: Boolean,
        default: false,
    });

    // World level Token HUD setting
    game.settings.register("token-variants", "displayOnlySharedImages", {
        scope: "world",
        type: Boolean,
        default: false,
    });

    // World level Token HUD setting
    game.settings.register("token-variants", "disableSideMenuIfTHW", {
        scope: "world",
        type: Boolean,
        default: false,
    });

    // Deprecated, caching is now controlled on per image source basis
    game.settings.register("token-variants", "disableCaching", {
        scope: "world",
        type: Boolean,
        default: false,
    });

    // Deprecated
    game.settings.register("token-variants", "disableAutomaticPopup", {
        scope: "world",
        type: Boolean,
        default: false,
    });

    // Deprecated
    game.settings.register("token-variants", "filterMSRD", {
        scope: "world",
        type: Boolean,
    });

    game.settings.register("token-variants", "keywordSearch", {
        name: game.i18n.localize("token-variants.settings.keywords-search.Name"),
        hint: game.i18n.localize("token-variants.settings.keywords-search.Hint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        onChange: kSearch => keywordSearch = kSearch
    });

    game.settings.register("token-variants", "excludedKeywords", {
        name: game.i18n.localize("token-variants.settings.excluded-keywords.Name"),
        hint: game.i18n.localize("token-variants.settings.excluded-keywords.Hint"),
        scope: "world",
        config: true,
        type: String,
        default: "and,for",
        onChange: keywords => excludedKeywords = parseKeywords(keywords)
    });

    game.settings.register("token-variants", "actorDirectoryKey", {
        name: game.i18n.localize("token-variants.settings.actor-directory-key.Name"),
        hint: game.i18n.localize("token-variants.settings.actor-directory-key.Hint"),
        scope: "world",
        config: true,
        type: String,
        choices: {
            "Control": "Ctrl",
            "Shift": "Shift",
            "Alt": "Alt"
        },
        default: "Control",
        onChange: key => actorDirKey = key
    });

    // Deprecated
    game.settings.register("token-variants", "twoPopups", {
        scope: "world",
        type: Boolean,
        default: false,
    });

    // Deprecated
    game.settings.register("token-variants", "twoPopupsNoDialog", {
        scope: "world",
        type: Boolean,
        default: false,
    });

    game.settings.register("token-variants", "runSearchOnPath", {
        name: game.i18n.localize("token-variants.settings.run-search-on-path.Name"),
        hint: game.i18n.localize("token-variants.settings.run-search-on-path.Hint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: val => runSearchOnPath = val
    });

    // Legacy filter setting, retained in case some users have used this setting
    game.settings.register("token-variants", "portraitFilter", {
        scope: "world",
        config: false,
        type: String,
        default: "",
    });

    // Legacy filter setting, retained in case some users have used this setting
    game.settings.register("token-variants", "tokenFilter", {
        scope: "world",
        config: false,
        type: String,
        default: "",
    });

    game.settings.registerMenu("token-variants", "searchFilterMenu", {
        name: game.i18n.localize("token-variants.settings.search-filters.Name"),
        hint: game.i18n.localize("token-variants.settings.search-filters.Hint"),
        scope: "world",
        icon: "fas fa-exchange-alt",
        type: FilterSettings,
        restricted: true,
    });

    game.settings.register('token-variants', 'searchFilterSettings', {
        scope: 'world',
        config: false,
        type: Object,
        default: {
            portraitFilterInclude: game.settings.get("token-variants", "portraitFilter"),
            portraitFilterExclude: "",
            portraitFilterRegex: "",
            tokenFilterInclude: game.settings.get("token-variants", "tokenFilter"),
            tokenFilterExclude: "",
            tokenFilterRegex: "",
            generalFilterInclude: "",
            generalFilterExclude: "",
            generalFilterRegex: "",
        },
    });

    game.settings.register("token-variants", "forgevttPaths", {
        scope: "world",
        config: false,
        type: Array,
        default: [],
    });

    game.settings.register("token-variants", "tokenConfigs", {
        scope: "world",
        config: false,
        type: Array,
        default: [],
    });

    // Deprecated
    game.settings.register("token-variants", "disableActorPortraitArtSelect", {
        scope: "world",
        type: Boolean,
        default: false,
    });

    game.settings.registerMenu("token-variants", "randomizerMenu", {
        name: game.i18n.localize("token-variants.settings.randomizer.Name"),
        hint: game.i18n.localize("token-variants.settings.randomizer.Hint"),
        scope: "world",
        icon: "fas fa-exchange-alt",
        type: RandomizerSettings,
        restricted: true,
    });

    game.settings.register('token-variants', 'randomizerSettings', {
        scope: 'world',
        config: false,
        type: Object,
        default: {
            actorCreate: false,
            tokenCreate: false,
            tokenCopyPaste: false,
            tokenName: true,
            keywords: false,
            shared: false,
            representedActorDisable: false,
            linkedActorDisable: true,
            popupOnDisable: false
        },
    });

    game.settings.registerMenu("token-variants", "popupMenu", {
        name: game.i18n.localize("token-variants.settings.pop-up.Name"),
        hint: game.i18n.localize("token-variants.settings.pop-up.Hint"),
        scope: "world",
        icon: "fas fa-exchange-alt",
        type: PopUpSettings,
        restricted: true,
    });

    game.settings.register('token-variants', 'popupSettings', {
        scope: 'world',
        config: false,
        type: Object,
        default: {
            disableAutoPopupOnActorCreate: game.settings.get("token-variants", "disableAutomaticPopup"),
            disableAutoPopupOnTokenCreate: game.settings.get("token-variants", "disableAutomaticPopup"),
            disableAutoPopupOnTokenCopyPaste: game.settings.get("token-variants", "disableAutomaticPopup"),
            twoPopups: game.settings.get("token-variants", "twoPopups"),
            twoPopupsNoDialog: game.settings.get("token-variants", "twoPopupsNoDialog"),
            disableActorPortraitArtSelect: game.settings.get("token-variants", "disableActorPortraitArtSelect"),
        },
        onChange: settings => {
            twoPopups = settings.twoPopups;
            noTwoPopupsPrompt = settings.twoPopupsNoDialog;
            disableActorPortraitListener = settings.disableActorPortraitArtSelect;
        }
    });

    // Backwards compatibility for setting format used in versions <=1.18.2
    const tokenConfigs = (game.settings.get("token-variants", "tokenConfigs") || []).flat();
    tokenConfigs.forEach((config) => {
        if(!config.hasOwnProperty('tvImgSrc')){
            config['tvImgSrc'] = config.imgSrc;
            config['tvImgName'] = config.name;
            config['tvTab_image'] = true;
            delete config.imgSrc;
            delete config.name;
        }
    });
    game.settings.set("token-variants", "tokenConfigs", tokenConfigs);
    // end of compatibility code

    const popupSettings = game.settings.get("token-variants", "popupSettings");
    twoPopups = popupSettings.twoPopups;
    noTwoPopupsPrompt = popupSettings.twoPopupsNoDialog;
    disableActorPortraitListener = popupSettings.disableActorPortraitArtSelect;

    keywordSearch = game.settings.get("token-variants", "keywordSearch");
    actorDirKey = game.settings.get("token-variants", "actorDirectoryKey");
    debug = game.settings.get("token-variants", "debug");
    runSearchOnPath = game.settings.get("token-variants", "runSearchOnPath");
    parsedSearchPaths = await parseSearchPaths(debug);
}

function registerHUD() {
    game.settings.registerMenu("token-variants", "tokenHUDSettings", {
        name: game.i18n.localize("token-variants.settings.token-hud.Name"),
        hint: game.i18n.localize("token-variants.settings.token-hud.Hint"),
        scope: "client",
        icon: "fas fa-exchange-alt",
        type: TokenHUDSettings,
        restricted: false,
    });

    // Deprecated
    game.settings.register("token-variants", "enableTokenHUD", {
        scope: "client",
        config: false,
        type: Boolean,
        default: true,
    });

    // Deprecated
    game.settings.register("token-variants", "alwaysShowHUD", {
        scope: "client",
        config: false,
        type: Boolean,
        default: false,
    });

    // Deprecated
    game.settings.register("token-variants", "HUDDisplayImage", {
        scope: "client",
        config: false,
        type: Boolean,
        default: true,
    });

    // Deprecated
    game.settings.register("token-variants", "HUDImageOpacity", {
        scope: "client",
        config: false,
        range: { min: 0, max: 100, step: 1 },
        type: Number,
        default: 50
    });

    game.settings.register('token-variants', 'hudSettings', {
        scope: 'client',
        config: false,
        type: Object,
        default: {
            enableSideMenu: game.settings.get("token-variants", "enableTokenHUD"),
            displayAsImage: game.settings.get("token-variants", "HUDDisplayImage"),
            imageOpacity: game.settings.get("token-variants", "HUDImageOpacity"),
            alwaysShowButton: game.settings.get("token-variants", "alwaysShowHUD"),
            updateActorImage: false,
        },
    });
    
    async function renderHudButton(hud, html, token){
        renderHud(hud, html, token, "", doImageSearch, updateTokenImage, updateActorImage);
    }

    // Incorporating 'FVTT-TokenHUDWildcard' token hud button 
    Hooks.on('renderTokenHUD', renderHudButton);
}

/**
 * Initialize the Token Variants module on Foundry VTT init
 */
async function initialize() {

    // Initialization should only be performed once
    if (initialized) {
        return;
    }

    if(typeof ForgeAPI !== 'undefined') {
        game.settings.registerMenu("token-variants", "forgeSearchPaths", {
            name: game.i18n.localize('token-variants.settings.forge-search-paths.Name'),
            hint: game.i18n.localize('token-variants.settings.forge-search-paths.Hint'),
            icon: "fas fa-exchange-alt",
            type: ForgeSearchPaths,
            scope: "client",
            restricted: false,
        });
    }

    await registerWorldSettings();

    if (game.user && game.user.can("FILES_BROWSE") && game.user.can("TOKEN_CONFIGURE")) {

        const disableRandomSearchForType = (randSettings, actor) => {
            if(!actor) return false;
            return randSettings[`${actor.type}Disable`] ?? false;
        }

        const disablePopupForType = (actor) => {
            const popupSettings = game.settings.get("token-variants", "popupSettings");
            if(!actor) return false;
            return popupSettings[`${actor.type}Disable`] ?? false;
        }
        
        // Workaround for forgeSearchPaths setting to be updated by non-GM clients
        game.socket?.on(`module.token-variants`, message => {
            if(message.handlerName === "forgeSearchPaths" && message.type === "UPDATE") {
                if (!game.user.isGM) return;
                const isResponsibleGM = !game.users
                  .filter(user => user.isGM && (user.active || user.isActive))
                  .some(other => other.data._id < game.user.data._id);
                if (!isResponsibleGM) return;
                game.settings.set("token-variants", "forgeSearchPaths", message.args);
            }
        });

        // Handle actor/token art replacement
        Hooks.on("createActor", async (actor, options, userId) => {
            if (userId && game.user.id != userId)
                return;

            // Check if random search is enabled and if so perform it 
            
            const randSettings = game.settings.get("token-variants", "randomizerSettings");
            if(randSettings.actorCreate){
                let performRandomSearch = true;
                if(randSettings.linkedActorDisable && actor.data.token.actorLink) performRandomSearch = false;
                if(disableRandomSearchForType(randSettings, actor)) performRandomSearch = false;

                if(performRandomSearch){
                    doRandomSearch(actor.data.name, {
                            searchType: SEARCH_TYPE.PORTRAIT, 
                            actor: actor, 
                            callback: (imgSrc, name) => updateActorImage(actor, imgSrc, {imgName: name})
                        });
                    return;
                }
                if(!randSettings.popupOnDisable){
                    return;
                }
            }

            // Check if pop-up is enabled and if so open it
            const popupSettings = game.settings.get("token-variants", "popupSettings");
            let dirKeyDown;
            if(isNewerVersion(game.version ?? game.data.version, "0.8.9")){
                dirKeyDown = game.keyboard.downKeys.has(`${actorDirKey}Left`) || game.keyboard.downKeys.has(`${actorDirKey}Right`);
            } else {
                dirKeyDown = keyboard.isDown(actorDirKey);
            }

            if(popupSettings.disableAutoPopupOnActorCreate && !dirKeyDown){
                return;
            } else if (disablePopupForType(actor)){
                return;
            }

            showArtSelect(actor.data.name, {
                callback: (imgSrc, name) => {
                    const actTokens = actor.getActiveTokens();
                    const token = actTokens.length === 1 ? actTokens[0] : null;
                    updateActorImage(actor, imgSrc, {updateActorOnly: false, imgName: name, token: token})
                },
                searchType: twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.BOTH,
                object: actor
            }); 
        });
        Hooks.on("createToken", async (op1, op2, op3, op4) => {
            let tokenDoc = op1;
            let options = op2;
            let userId = op3;

            // Compatability for 0.7.x
            if(op4) userId = op4;

            if (userId && game.user.id != userId)
                return;

            let token;
            if(isNewerVersion(game.version ?? game.data.version, "0.7.10")){
                token = tokenDoc;
            } else {
                token = canvas.tokens.get(options._id);
            }

            const updateTokenCallback = (imgSrc, name) => updateTokenImage(imgSrc, {token: token, actor: token.actor, imgName: name});
            const updateActorCallback = (imgSrc, name) => updateActorImage(token.actor, imgSrc, {updateActorOnly: false, imgName: name, token: token});


            // Check if random search is enabled and if so perform it 

            const randSettings = game.settings.get("token-variants", "randomizerSettings");
            let vDown;
            if(isNewerVersion(game.version ?? game.data.version, "0.8.9")){
                vDown = game.keyboard.downKeys.has("v");
            } else {
                vDown = keyboard.isDown("v");
            }

            if((vDown && randSettings.tokenCopyPaste) || (!vDown && randSettings.tokenCreate)){
                let performRandomSearch = true;
                if(randSettings.representedActorDisable && token.actor) performRandomSearch = false;
                if(randSettings.linkedActorDisable && token.data.actorLink) performRandomSearch = false;
                if(disableRandomSearchForType(randSettings, token.actor)) performRandomSearch = false;

                if(performRandomSearch){
                    doRandomSearch(token.data.name, {
                        searchType: SEARCH_TYPE.TOKEN,
                        actor: token.actor,
                        callback: updateTokenCallback
                    });
                    return;
                }
                if(!randSettings.popupOnDisable){
                    return;
                }
            } else if (randSettings.tokenCreate || randSettings.tokenCopyPaste){
                return;
            }

            // Check if pop-up is enabled and if so open it
            const popupSettings = game.settings.get("token-variants", "popupSettings");
            let dirKeyDown;
            if(isNewerVersion(game.version ?? game.data.version, "0.8.9")){
                dirKeyDown = game.keyboard.downKeys.has(`${actorDirKey}Left`) || game.keyboard.downKeys.has(`${actorDirKey}Right`);
            } else {
                dirKeyDown = keyboard.isDown(actorDirKey);
            }

            if(vDown && popupSettings.disableAutoPopupOnTokenCopyPaste){
                return;
            }

            if(!dirKeyDown){
                if(popupSettings.disableAutoPopupOnTokenCreate){
                    return;
                } else if (disablePopupForType(token.actor)){
                    return;
                }
            }

            showArtSelect(token.data.name, {
                callback: twoPopups ? updateActorCallback : updateTokenCallback, 
                searchType: twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.BOTH, 
                object: token
            });
        });
        Hooks.on("renderTokenConfig", modTokenConfig);
        Hooks.on("renderActorSheet", modActorSheet);
        await cacheTokens();
    } else if (game.settings.get("token-variants", "enableTokenHUDButtonForAll")) {
        await cacheTokens();
    }
    registerHUD();

    initialized = true;
}

/**
 * Adds a button to 'Token Configuration' window's 'Image' tab which opens
 * ArtSelect using the token's name.
 */
function modTokenConfig(tokenConfig, html, _) {
    let fields = html[0].getElementsByClassName('image');
    for (let field of fields) {
        if (field.getAttribute('name') == 'img') {
            let el = document.createElement('button');
            el.type = "button";
            el.title = game.i18n.localize('token-variants.windows.art-select.select-variant');
            el.className = "token-variants-image-select-button"; 
            el.innerHTML = '<i class="fas fa-images"></i>';
            el.tabIndex = -1;
            el.setAttribute('data-type', 'imagevideo');
            el.setAttribute('data-target', 'img');
            el.onclick = async () => {
                showArtSelect(tokenConfig.object.data.name, {
                    callback: (imgSrc, name) => {
                        field.value = imgSrc;
                        const tokenConfig = getTokenConfigForUpdate(imgSrc, name);
                        if(tokenConfig){
                            for (var key in tokenConfig) {   
                                $(html).find(`[name="${key}"]`).val(tokenConfig[key]);
                            }
                        }
                    },
                    searchType: SEARCH_TYPE.TOKEN,
                    object: tokenConfig.object
                });
            };
            field.parentNode.append(el);
            return;
        }
    }
}

/**
 * Adds right-click listener to Actor Sheet profile image to open up
 * the 'Art Select' screen.
 */
function modActorSheet(actorSheet, html, options) {
    if (!options.editable || disableActorPortraitListener) return;

    let profile = null;
    let profileQueries = {
        all: [".profile", ".profile-img", ".profile-image"],
        pf2e: [".player-image", ".actor-icon", ".sheet-header img", ".actor-image"]
    }

    for (let query of profileQueries.all) {
        profile = html[0].querySelector(query);
        if (profile) break;
    }

    if(!profile && game.system.id in profileQueries){
        for (let query of profileQueries[game.system.id]) {
            profile = html[0].querySelector(query);
            if (profile) break;
        }
    }

    if (!profile) {
        console.log(game.i18n.localize("token-variants.notifications.warn.profile-image-not-found"));
        return;
    }

    profile.addEventListener('contextmenu', function (ev) {
        showArtSelect(actorSheet.object.name, {
            callback: (imgSrc, name) => updateActorImage(actorSheet.object, imgSrc, {imgName: name}),
            searchType: SEARCH_TYPE.PORTRAIT,
            object: actorSheet.object
        })
    }, false);
}

/**
 * Search for and cache all the found token art
 */
async function cacheTokens() {
    if (caching) return;
    caching = true;
    ui.notifications.info(game.i18n.format("token-variants.notifications.info.caching-started"));

    if (debug) console.log("STARTING: Token Caching");
    cachedTokens.clear();

    await findTokens("", "");
    cachedTokens = foundTokens;
    foundTokens = new Map();
    if (debug) console.log("ENDING: Token Caching");

    caching = false;
    ui.notifications.info(game.i18n.format("token-variants.notifications.info.caching-finished", {imageCount: cachedTokens.size}));
}

/**
 * Checks if token image path and name match the provided search text and filters
 * @param search search text
 * @param tokenSrc token image path
 * @param name name of the token
 * @param filters filters to be applied
 * @returns true|false
 */
function searchMatchesToken(search, tokenSrc, name, filters) {

    // Is the search text contained in name/path
    const simplified = runSearchOnPath ? simplifyPath(tokenSrc) : simplifyTokenName(name);
    if (!simplified.includes(search)) return false;
    
    if (!filters) return true;

    // Filters are applied to path depending on the 'runSearchOnPath' setting, and actual or custom rolltable name
    let text;
    if(runSearchOnPath){
        text = decodeURIComponent(tokenSrc);
    } else if (getFileName(tokenSrc) === name){
        text = getFileNameWithExt(tokenSrc);
    } else {
        text = name;
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

/**
 * Search for tokens matching the supplied name
 */
async function findTokens(name, searchType = "") {
    if (debug) console.log("STARTING: Token Search", name, searchType, caching);

    // Select filters based on type of search
    let filters = game.settings.get("token-variants", "searchFilterSettings");
    switch (searchType) {
        case SEARCH_TYPE.BOTH:
            filters = {
                include: filters.generalFilterInclude,
                exclude: filters.generalFilterExclude,
                regex: filters.generalFilterRegex
            }
            break;
        case SEARCH_TYPE.PORTRAIT:
            filters = {
                include: filters.portraitFilterInclude,
                exclude: filters.portraitFilterExclude,
                regex: filters.portraitFilterRegex
            }
            break;
        case SEARCH_TYPE.TOKEN:
            filters = {
                include: filters.tokenFilterInclude,
                exclude: filters.tokenFilterExclude,
                regex: filters.tokenFilterRegex
            }
            break;
        default:
            filters = {
                include: "",
                exclude: "",
                regex: ""
            }
    }
    if (filters.regex) filters.regex = new RegExp(filters.regex);

    foundTokens = new Map();
    const simpleName = simplifyTokenName(name);

    cachedTokens.forEach((names,tokenSrc)=>{
        for(let n of names){
            if(searchMatchesToken(simpleName, tokenSrc, n, filters)){
                addTokenToFound(tokenSrc, n);
            }
        }
    });

    let searchPaths = parsedSearchPaths;

    for (let path of searchPaths.get("data")) {
        if((path.cache && caching) || (!path.cache && !caching))
            await walkFindTokens(path.text, {name: simpleName, filters: filters});
    }
    for (let [bucket, paths] of searchPaths.get("s3")) {
        for (let path of paths) {
            if((path.cache && caching) || (!path.cache && !caching))
                await walkFindTokens(path.text, {name: simpleName, bucket: bucket, filters: filters});
        }
    }
    for (let path of searchPaths.get("forge")) {
        if((path.cache && caching) || (!path.cache && !caching))
            await walkFindTokens(path.text, {name: simpleName, filters: filters, forge: true});
    }
    for (let path of searchPaths.get("rolltable")) {
        if((path.cache && caching) || (!path.cache && !caching))
            await walkFindTokens(path.text, {name: simpleName, filters: filters, rollTableName: path.text});
    }
    for (let path of searchPaths.get("forgevtt")) {
        if((path.cache && caching) || (!path.cache && !caching))
            await walkFindTokens(path.text, {name: simpleName, filters: filters, forgevtt: true, apiKey: path.apiKey});
    }

    if (debug) console.log("ENDING: Token Search", foundTokens);
    return foundTokens;
}

function addTokenToFound(tokenSrc, name){
    if(foundTokens.has(tokenSrc)){
        if (!foundTokens.get(tokenSrc).includes(name)){
            foundTokens.get(tokenSrc).push(name);
        }
    } else {
        foundTokens.set(tokenSrc, [name]);
    }
}

/**
 * Walks the directory tree and finds all the matching token art
 */
async function walkFindTokens(path, { name = "", bucket = "", filters = null, forge = false, rollTableName = "", forgevtt = false, apiKey = ""} = {}) {
    if (!bucket && !path) return;

    let files = {};
    try {
        if (bucket) {
            files = await FilePicker.browse("s3", path, { bucket: bucket });
        } else if (forge) {
            files = await FilePicker.browse("", path, { wildcard: true });
        } else if (forgevtt) {
            if(apiKey){
                const response = await callForgeVTT('assets/browse', {path: path, options: { recursive: true }}, apiKey);
                files.files = response.files.map(f => f.url);
            } else {
                files = await FilePicker.browse("forgevtt", path, { recursive: true });
            }
        } else if (rollTableName) {
            const table = game.tables.contents.find((t) => t.name === rollTableName);
            if (!table){
              ui.notifications.warn(game.i18n.format("token-variants.notifications.warn.invalid-table", { rollTableName }));
            } else {
                for (let baseTableData of table.data.results) {
                    const path = baseTableData.data.img;
                    const rtName = baseTableData.data.text;
                    if (!name) {
                        addTokenToFound(path, rtName);
                    } else {
                        if(searchMatchesToken(simplifyTokenName(name), path, rtName, filters)){
                            addTokenToFound(path, rtName);
                        }
                    }
                }
            }
            return;
        } else {
            files = await FilePicker.browse("data", path);
        }
    } catch (err) {
        console.log(`${game.i18n.localize("token-variants.notifications.warn.path-not-found")} ${path}`);
        return;
    }

    if (files.target == ".") return;

    for (let tokenSrc of files.files) {
        const tName = getFileName(tokenSrc);
        if (!name) {
            addTokenToFound(tokenSrc, tName);
        } else {
            if(searchMatchesToken(simplifyTokenName(name), tokenSrc, tName, filters)){
                addTokenToFound(tokenSrc, tName);
            }
        }
    }

    if(forgevtt) return;

    for (let dir of files.dirs) {
        await walkFindTokens(dir, {name: name, bucket: bucket, filters: filters, forge: forge});
    }
}

/**
 * Performs searches and displays the Art Select pop-up with the results
 * @param {string} search The text to be used as the search criteria
 * @param {object} [options={}] Options which customize the search
 * @param {Function[]} [options.callback] Function to be called with the user selected image path
 * @param {string} [options.searchType] (token|portrait|both) Controls filters applied to the search results
 * @param {Token|Actor} [options.object] Token/Actor used when displaying Custom Token Config prompt
*/
async function showArtSelect(search, {callback = null, searchType = SEARCH_TYPE.BOTH, object = null}={}){
    if (caching) return;

    // Allow only one instance of ArtSelect to be open at any given time
    if(Object.values(ui.windows).filter(app => app instanceof ArtSelect).length !== 0){
        return;
    }

    // Set Art Select screen title
    let title = game.i18n.localize("token-variants.windows.art-select.select-variant");
    if (searchType == SEARCH_TYPE.TOKEN)
        title = game.i18n.localize("token-variants.windows.art-select.select-token-art");
    else if (searchType == SEARCH_TYPE.PORTRAIT)
        title = game.i18n.localize("token-variants.windows.art-select.select-portrait-art");

    let allImages = await doImageSearch(search, {searchType: searchType});

    let artFound = false;
    let allButtons = new Map();
    allImages.forEach((tokens, search) => {
        let buttons = [];
        tokens.forEach((names,tokenSrc) => {
            artFound = true;
            const vid = isVideo(tokenSrc);
            const img = isImage(tokenSrc);
            for(let name of names){
                buttons.push({
                    path: tokenSrc,
                    img: img,
                    vid: vid,
                    type: vid || img,
                    label: name,
                })
            }
        })
        allButtons.set(search, buttons);
    });

    let searchAndDisplay = ((search) => {
        showArtSelect(search, {callback: callback, searchType: searchType, object: object});
    });

    if (artFound) {
        new ArtSelect(title, search, allButtons, callback, searchAndDisplay, object).render(true);
    } else {
        new ArtSelect(title, search, null, callback, searchAndDisplay, object).render(true);
    }
}

// Deprecated
async function displayArtSelect(search, callback, searchType = SEARCH_TYPE.BOTH, object = {}) {
    showArtSelect(search, {callback: callback, searchType: searchType, object: object})
}

/**
 * @param {*} search Text to be used as the search criteria
 * @param {object} [options={}] Options which customize the search
 * @param {SEARCH_TYPE|string} [options.searchType] Controls filters applied to the search results
 * @param {Actor} [options.actor] Used to retrieve 'shared' images from if enabled in the Randomizer Settings
 * @param {Function[]} [options.callback] Function to be called with the random image
 * @returns Array<string>|null} Image path and name
 */
async function doRandomSearch(search, { searchType = SEARCH_TYPE.BOTH, actor = null, callback = null } = {}){
    if (caching) return null;

    const randSettings = game.settings.get("token-variants", "randomizerSettings");
    if(!(randSettings.tokenName || randSettings.keywords || randSettings.shared)) return null;

    // Gather all images
    let results = randSettings.tokenName || randSettings.keywords ? await doImageSearch(search, {searchType: searchType, ignoreKeywords: !randSettings.keywords}) : new Map();

    if(!randSettings.tokenName){
        results.delete(search);
    }
    if(randSettings.shared && actor){
        let sharedVariants = actor.getFlag('token-variants', 'variants') || [];
        if(sharedVariants.length != 0){
            results.set("variants95436723", new Map(sharedVariants.map(v => [v.imgSrc, v.names])));
        }
    }

    // Pick random image
    let total = 0;
    results.forEach(v=> total+=v.size);
    let randImageNum = Math.floor(Math.random() * total);
    for (const [_, images] of results.entries()) {
        if(randImageNum < images.size){
            for (let src of images.keys()) {
                if (randImageNum == 0) {
                    const names = images.get(src);
                    const result = [src, names[Math.floor(Math.random()*names.length)]];
                    if(callback)
                        callback(result[0], result[1]);
                    return result;
                }
                randImageNum--;
            }
        } else {
            randImageNum -= images.size;
        }
    }
    return null;
}

/**
 * @param {*} search Text to be used as the search criteria
 * @param {object} [options={}] Options which customize the search
 * @param {SEARCH_TYPE|string} [options.searchType] Controls filters applied to the search results
 * @param {Boolean} [options.ignoreKeywords] Ignores keywords search setting
 * @param {Boolean} [options.simpleResults] Results will be returned as an array of all image paths found
 * @param {Function[]} [options.callback] Function to be called with the found images
 * @returns {Map<string, Map<string, Map<string, Array<string>>>>|Array<String>|null} All images found split by original criteria and keywords
 */
async function doImageSearch(search, {searchType = SEARCH_TYPE.BOTH, ignoreKeywords = false, simpleResults = false, callback = null}={}) {
    if (caching) return;
    if (debug) console.log("STARTING: Art Search", search, searchType);

    let searches = [search];
    let allImages = new Map();
    let usedTokens = new Set();

    if (keywordSearch && !ignoreKeywords) {
        excludedKeywords = parseKeywords(game.settings.get("token-variants", "excludedKeywords"));
        searches = searches.concat(search.split(/\W/).filter(word => word.length > 2 && !excludedKeywords.includes(word.toLowerCase())).reverse());
    }

    for (let search of searches) {
        if (allImages.get(search) !== undefined) continue;
        let map = await findTokens(search, searchType);
        let tokens = new Map();   
        for (let tokenSrc of map.keys()) {
            if(!usedTokens.has(tokenSrc)){
                usedTokens.add(tokenSrc);
                tokens.set(tokenSrc, map.get(tokenSrc));
            }
        }
        allImages.set(search, tokens);
    }

    if (debug) console.log("ENDING: Art Search");

    if(simpleResults){
        allImages = Array.from(usedTokens);
    }

    if(callback) callback(allImages)
    return allImages;
}

/**
 * Updates Token and/or Poro Token  with the new image and custom configuration if one exists.
 * @param {string} imgSrc Image source path/url
 * @param {object} [options={}] Update options
 * @param {Token[]} [options.token] Token to be updated with the new image
 * @param {Actor} [options.actor] Actor with Proto Token to be updated with the new image
 * @param {string} [options.imgName] Image name if it differs from the file name. Relevant for rolltable sourced images.
 */
async function updateTokenImage(imgSrc, {token = null, actor = null, imgName = null} = {}){
    if(!(token || actor)) {
        console.warn(game.i18n.localize("token-variants.notifications.warn.update-image-no-token-actor"));
        return;
    }

    if(!imgName) imgName = getFileName(imgSrc);
    if(!actor && token.actor) { actor = game.actors.get(token.actor.id); }

    const getDefaultConfig = (token, actor) => {
        let configEntries = [];
        if(token)
            configEntries = (token.document ? token.document : token).getFlag('token-variants', 'defaultConfig') || [];
        else if(actor){
            const tokenData = actor.data.token;
            if('token-variants' in tokenData.flags && 'defaultConfig' in tokenData['token-variants'])
                configEntries = tokenData['token-variants']['defaultConfig'];
        }
        return expandObject(Object.fromEntries(configEntries));
    }

    const constructDefaultConfig = (origData, customConfig) => {
        return Object.entries(flattenObject(filterObject(origData, customConfig)));
    }

    let tokenUpdateObj = { img: imgSrc };
    const tokenCustomConfig = getTokenConfigForUpdate(imgSrc, imgName);
    const usingCustomConfig = token && (token.document ? token.document : token).getFlag('token-variants', 'usingCustomConfig');
    const defaultConfig = getDefaultConfig(token);

    if(tokenCustomConfig || usingCustomConfig){
        tokenUpdateObj = mergeObject(tokenUpdateObj, defaultConfig);
    }
    
    if(tokenCustomConfig){
        if(token){
            await token.setFlag('token-variants', 'usingCustomConfig', true);
            const tokenData = token.data instanceof Object ? token.data : token.data.toObject();
            const defConf = constructDefaultConfig(mergeObject(tokenData, defaultConfig), tokenCustomConfig);
            await token.setFlag('token-variants', 'defaultConfig', defConf);
        } else if(actor && !token){
            tokenUpdateObj.flags = {"token-variants": {"usingCustomConfig": true}};
            const tokenData = actor.data.token instanceof Object ? actor.data.token : actor.data.token.toObject();
            const defConf = constructDefaultConfig(tokenData, tokenCustomConfig);
            tokenUpdateObj.flags = {"token-variants": {"defaultConfig": defConf}};
        }

        tokenUpdateObj = mergeObject(tokenUpdateObj, tokenCustomConfig);
    } else if (usingCustomConfig){
        if(token){
            await token.setFlag('token-variants', 'usingCustomConfig', false);
            await token.unsetFlag('token-variants', 'defaultConfig');
        } else if(actor && !token){
            tokenUpdateObj.flags = {"token-variants": {"usingCustomConfig": false, 'defaultConfig': []}};
        }
    }

    if(actor && !token){
        await (actor.document ?? actor).update({ "token.img": imgSrc });
        tokenUpdateObj = mergeObject(tokenUpdateObj, {flags: {"token-variants": {name: imgName}}})
        if(isNewerVersion(game.version ?? game.data.version, "0.7.10"))
            await actor.data.token.update(tokenUpdateObj);
        else {
            for (const [key, value] of Object.entries(tokenUpdateObj)) {
                tokenUpdateObj[`token.${key}`] = value;
                delete tokenUpdateObj[key];
            }
            await actor.update(tokenUpdateObj);
        }
    }

    if (token) {
        const obj = token.document ?? token;
        await obj.setFlag("token-variants", "name", imgName);
        await obj.update(tokenUpdateObj);
    } 
}

/**
 * Assign new artwork to the actor
 */
async function updateActorImage(actor, imgSrc, {updateActorOnly = true, imgName = null, token = null}={}) {

    await (actor.document ?? actor).update({ img: imgSrc });

    if (updateActorOnly)
        return;

    if(!imgName) imgName = getFileName(imgSrc);

    if (twoPopups && noTwoPopupsPrompt) {
        showArtSelect(actor.name, {
            callback: (imgSrc, name) => updateTokenImage(imgSrc, {actor: actor, imgName: name, token: token}),
            searchType: SEARCH_TYPE.TOKEN,
            object: token ? token : actor
        });
    } else if (twoPopups) {
        let d = new Dialog({
            title: "Portrait -> Token",
            content: `<p>${game.i18n.localize("token-variants.windows.art-select.apply-same-art")}</p>`,
            buttons: {
                one: {
                    icon: '<i class="fas fa-check"></i>',
                    callback: () => updateTokenImage(imgSrc, {actor: actor, imgName: imgName, token: token}),
                },
                two: {
                    icon: '<i class="fas fa-times"></i>',
                    callback: () => {
                        showArtSelect(actor.name, {
                            callback: (imgSrc, name) => updateTokenImage(imgSrc, {actor: actor, imgName: name, token: token}),
                            searchType: SEARCH_TYPE.TOKEN,
                            object: token ? token : actor
                        });
                    }
                }
            },
            default: "one",
        });
        d.render(true);
    } else {
        updateTokenImage(imgSrc, {actor: actor, imgName: imgName, token: token});
    }
}

// Initialize module
Hooks.once("ready", initialize);

// Register API
Hooks.on("init", function () {
    game.modules.get('token-variants').api = {
        cacheTokens, 
        doImageSearch, 
        doRandomSearch, 
        showArtSelect,
        updateTokenImage,
    };

    // Deprecated api access
    const deprecatedWarn = () => console.warn("game.TokenVariants has been deprecated since 1.20.3, use game.modules.get('token-variants')?.api instead.");
    game.TokenVariants = {
        displayArtSelect: async (...args) => {
            deprecatedWarn();
            console.warn("displayArtSelect has been deprecated in favour of showArtSelect.");
            await displayArtSelect(...args);
        },
        cacheTokens: async () => { deprecatedWarn(); await cacheTokens(); }, 
        doImageSearch: (...args) => { deprecatedWarn(); doImageSearch(...args); }, 
        doRandomSearch: async (...args) => { deprecatedWarn(); await doRandomSearch(...args); }, 
        showArtSelect: async (...args) => { deprecatedWarn(); await showArtSelect(...args); }
    };
});
