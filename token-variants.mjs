import SearchPaths from "./applications/searchPaths.js";
import ArtSelect from "./applications/artSelect.js";
import TokenHUDSettings from "./applications/tokenHUDSettings.js";
import FilterSettings from "./applications/searchFilters.js";
import RandomizerSettings from "./applications/randomizerSettings.js";
import PopUpSettings from "./applications/popupSettings.js";
import { getFileName, getFileNameWithExt, simplifyTokenName, simplifyPath, parseSearchPaths, parseKeywords, isImage, isVideo, getTokenConfig, SEARCH_TYPE} from "./scripts/utils.js"
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

async function registerWorldSettings() {

    game.settings.register("token-variants", "debug", {
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        onChange: val => debug = val
    });

    game.settings.registerMenu("token-variants", "searchPaths", {
        name: game.i18n.localize("token-variants.searchPathsTitle"),
        hint: game.i18n.localize("token-variants.SearchPathsHint"),
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
            await parseSearchPaths(debug);
            cacheTokens();
        }
    });

    game.settings.register("token-variants", "enableTokenHUDButtonForAll", {
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
        name: game.i18n.localize("token-variants.KeywordSearchName"),
        hint: game.i18n.localize("token-variants.KeywordSearchHint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        onChange: kSearch => keywordSearch = kSearch
    });

    game.settings.register("token-variants", "excludedKeywords", {
        name: game.i18n.localize("token-variants.ExcludedKeywordsName"),
        hint: game.i18n.localize("token-variants.ExcludedKeywordsHint"),
        scope: "world",
        config: true,
        type: String,
        default: "and,for",
        onChange: keywords => excludedKeywords = parseKeywords(keywords)
    });

    game.settings.register("token-variants", "actorDirectoryKey", {
        name: game.i18n.localize("token-variants.ActorDirectoryKeyName"),
        hint: game.i18n.localize("token-variants.ActorDirectoryKeyHint"),
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
        name: game.i18n.localize("token-variants.runSearchOnPathName"),
        hint: game.i18n.localize("token-variants.runSearchOnPathHint"),
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
        name: game.i18n.localize("token-variants.searchFilterMenuName"),
        hint: game.i18n.localize("token-variants.searchFilterMenuHint"),
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
        name: game.i18n.localize("token-variants.randomizerMenuName"),
        hint: game.i18n.localize("token-variants.randomizerMenuHint"),
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
            pcDisable: true,
            npcDisable: false,
            vehicleDisable: false,
            popupOnDisable: false
        },
    });

    game.settings.registerMenu("token-variants", "popupMenu", {
        name: game.i18n.localize("token-variants.popupMenuName"),
        hint: game.i18n.localize("token-variants.popupMenuHint"),
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
            pcDisable: true,
            npcDisable: false,
            vehicleDisable: false
        },
        onChange: settings => {
            twoPopups = settings.twoPopups;
            noTwoPopupsPrompt = settings.twoPopupsNoDialog;
            disableActorPortraitListener = settings.disableActorPortraitArtSelect;
        }
    });

    const popupSettings = game.settings.get("token-variants", "popupSettings");
    twoPopups = popupSettings.twoPopups;
    noTwoPopupsPrompt = popupSettings.twoPopupsNoDialog;
    disableActorPortraitListener = popupSettings.disableActorPortraitArtSelect;

    keywordSearch = game.settings.get("token-variants", "keywordSearch");
    actorDirKey = game.settings.get("token-variants", "actorDirectoryKey");
    debug = game.settings.get("token-variants", "debug");
    runSearchOnPath = game.settings.get("token-variants", "runSearchOnPath");
}

function registerHUD() {
    game.settings.registerMenu("token-variants", "tokenHUDSettings", {
        name: "Token HUD Settings",
        hint: "Settings for the Token HUD button.",
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
            updateActorImage: false
        },
    });
    
    async function renderHudButton(hud, html, token, searchText){
        renderHud(hud, html, token, searchText, doImageSearch, updateTokenImage, setActorImage);
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

    await registerWorldSettings();

    if (game.user && game.user.can("FILES_BROWSE") && game.user.can("TOKEN_CONFIGURE")) {

        const disableRandomSearchForType = (randSettings, actor) => {
            if(!actor) return false;
            if(actor.type == "character") return randSettings.pcDisable;
            if(actor.type == "npc") return randSettings.npcDisable;
            if(actor.type == "vehicle") return randSettings.vehicleDisable;
        }

        const disablePopupForType = (actor) => {
            const popupSettings = game.settings.get("token-variants", "popupSettings");
            if(!actor) return false;
            if(actor.type == "character") return popupSettings.pcDisable;
            if(actor.type == "npc") return popupSettings.npcDisable;
            if(actor.type == "vehicle") return popupSettings.vehicleDisable;
        }

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
                            callback: (imgSrc, name) => setActorImage(actor, imgSrc, name)
                        });
                    return;
                }
                if(!randSettings.popupOnDisable){
                    return;
                }
            }

            // Check if pop-up is enabled and if so open it
            const popupSettings = game.settings.get("token-variants", "popupSettings");
            if(popupSettings.disableAutoPopupOnActorCreate && !keyboard.isDown(actorDirKey)){
                return;
            } else if (disablePopupForType(actor)){
                return;
            }

            showArtSelect(actor.data.name, {
                callback: (imgSrc, name) => setActorImage(actor, imgSrc, name, {updateActorOnly: false}),
                searchType: twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.BOTH,
                tokenConfig: actor.data.token
            }); 
        });
        Hooks.on("createToken", async (tokenDoc, options, userId, op4) => {
            if (userId && game.user.id != userId)
                return;

            // op4 check to support both 0.7.x and 0.8.x
            let token = op4 ? canvas.tokens.get(options._id) : tokenDoc._object;

            const callback = (imgSrc, name) => updateTokenImage(token.actor, token, imgSrc, name);


            // Check if random search is enabled and if so perform it 

            const randSettings = game.settings.get("token-variants", "randomizerSettings");
            if((keyboard.isDown("v") && randSettings.tokenCopyPaste) || (!keyboard.isDown("v") && randSettings.tokenCreate)){
                let performRandomSearch = true;
                if(randSettings.representedActorDisable && token.actor) performRandomSearch = false;
                if(randSettings.linkedActorDisable && token.data.actorLink) performRandomSearch = false;
                if(disableRandomSearchForType(randSettings, token.actor)) performRandomSearch = false;

                if(performRandomSearch){
                    doRandomSearch(op4 ? options.name : token.name, {
                        searchType: SEARCH_TYPE.TOKEN,
                        actor: token.actor,
                        callback: callback
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

            if(keyboard.isDown("v") && popupSettings.disableAutoPopupOnTokenCopyPaste){
                return;
            } else if(popupSettings.disableAutoPopupOnTokenCreate && !keyboard.isDown(actorDirKey)){
                return;
            } else if (disablePopupForType(token.actor)){
                return;
            }

            showArtSelect(op4 ? options.name : token.name, {
                callback: callback, 
                searchType: twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.BOTH, 
                tokenConfig: token.data
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
            el.title = game.i18n.localize('token-variants.TokenConfigButtonTitle');
            el.innerHTML = '<i class="fas fa-images"></i>';
            el.tabIndex = -1;
            el.onclick = async () => {
                showArtSelect(tokenConfig.object.data.name, {
                    callback: (imgSrc, name) => {
                        field.value = imgSrc;
                        const tokenConfig = getTokenConfig(imgSrc, name);
                        if(tokenConfig){
                            const tokenConfigHTML = $(html[0]).find('.tab[data-tab="image"]')[0];
                            $(tokenConfigHTML).find('[name="width"]').val(tokenConfig.width);
                            $(tokenConfigHTML).find('[name="height"]').val(tokenConfig.height);
                            $(tokenConfigHTML).find('[name="scale"]').val(tokenConfig.scale).trigger( 'change' );
                            $(tokenConfigHTML).find('[name="mirrorX"]').prop('checked', tokenConfig.mirrorX);
                            $(tokenConfigHTML).find('[name="mirrorY"]').prop('checked', tokenConfig.mirrorY);
                            $(tokenConfigHTML).find('[data-edit="tint"]').val(tokenConfig.tint).trigger( 'change' );
                            $(tokenConfigHTML).find('[name="alpha"]').val(tokenConfig.alpha).trigger( 'change' );
                        }
                    },
                    searchType: SEARCH_TYPE.TOKEN,
                    tokenConfig: tokenConfig.object.data
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
        console.log(game.i18n.localize("token-variants.ProfileListenerError"));
        return;
    }

    profile.addEventListener('contextmenu', function (ev) {
        showArtSelect(actorSheet.object.name, {
            callback: (imgSrc, name) => setActorImage(actorSheet.object, imgSrc, name),
            searchType: SEARCH_TYPE.PORTRAIT,
            tokenConfig: actorSheet.object.data.token
        })
    }, false);
}

/**
 * Search for and cache all the found token art
 */
async function cacheTokens() {
    if (caching) return;
    caching = true;
    ui.notifications.info(game.i18n.format("token-variants.notifications.info.cachingStarted"));

    if (debug) console.log("STARTING: Token Caching");
    cachedTokens.clear();

    await findTokens("", "");
    cachedTokens = foundTokens;
    foundTokens = new Map();
    if (debug) console.log("ENDING: Token Caching");

    caching = false;
    ui.notifications.info(game.i18n.format("token-variants.notifications.info.cachingFinished", {imageCount: cachedTokens.size}));
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

    let searchPaths = await parseSearchPaths(debug);

    for (let path of searchPaths.get("data")) {
        if((path.cache && caching) || (!path.cache && !caching))
            await walkFindTokens(path.text, simpleName, "", filters, false, "");
    }
    for (let [bucket, paths] of searchPaths.get("s3")) {
        for (let path of paths) {
            if((path.cache && caching) || (!path.cache && !caching))
                await walkFindTokens(path.text, simpleName, bucket, filters, false, "");
        }
    }
    for (let path of searchPaths.get("forge")) {
        if((path.cache && caching) || (!path.cache && !caching))
            await walkFindTokens(path.text, simpleName, "", filters, true, "");
    }
    for (let path of searchPaths.get("rolltable")) {
        if((path.cache && caching) || (!path.cache && !caching))
            await walkFindTokens(path.text, simpleName, "", filters, false, path.text);
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
async function walkFindTokens(path, name = "", bucket = "", filters = null, forge = false, rollTableName = "") {
    if (!bucket && !path) return;

    let files = [];
    try {
        if (bucket) {
            files = await FilePicker.browse("s3", path, { bucket: bucket });
        } else if (forge) {
            files = await FilePicker.browse("", path, { wildcard: true });
        } else if (rollTableName) {
            const table = game.tables.contents.find((t) => t.name === rollTableName);
            if (!table){
              ui.notifications.warn(game.i18n.format("token-variants.notifications.warn.invalidTable", { tableId }));
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
        console.log(`${game.i18n.localize("token-variants.PathNotFoundError")} ${path}`);
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
    for (let dir of files.dirs) {
        await walkFindTokens(dir, name, bucket, filters, forge, "");
    }
}

/**
 * Performs searches and displays the Art Select pop-up with the results
 * @param {string} search The text to be used as the search criteria
 * @param {object} [options={}] Options which customize the search
 * @param {Function[]} [options.callback] Function to be called with the user selected image path
 * @param {string} [options.searchType] (token|portrait|both) Controls filters applied to the search results
 * @param {Token|object} [options.tokenConfig] Used to source default token image config from such as (width, height, scale, etc.)
*/
async function showArtSelect(search, {callback = null, searchType = SEARCH_TYPE.BOTH, tokenConfig = {}}={}){
    if (caching) return;

    // Set Art Select screen title
    let title = game.i18n.localize("token-variants.SelectScreenTitle");
    if (searchType == SEARCH_TYPE.TOKEN)
        title = game.i18n.localize("token-variants.SelectScreenTitleToken");
    else if (searchType == SEARCH_TYPE.PORTRAIT)
        title = game.i18n.localize("token-variants.SelectScreenTitlePortrait");

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
        showArtSelect(search, {callback: callback, searchType: searchType, tokenConfig: tokenConfig});
    });

    if (artFound) {
        let artSelect = new ArtSelect(title, search, allButtons, callback, searchAndDisplay, tokenConfig);
        artSelect.render(true);
    } else {
        let artSelect = new ArtSelect(title, search, null, callback, searchAndDisplay, tokenConfig);
        artSelect.render(true);
    }
}

// Deprecated
async function displayArtSelect(search, callback, searchType = SEARCH_TYPE.BOTH, tokenConfig = {}) {
    showArtSelect(search, {callback: callback, searchType: searchType, tokenConfig: tokenConfig})
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

async function updateTokenImage(actor, token, imgSrc, imgName){
    if(!(token || actor)) return;

    let tokenActor = null;
    if(actor){tokenActor = actor}
    else if(token && token.actor){tokenActor = game.actors.get(token.actor.id)}

    const extractConfig = (data) => {
        return {
            alpha: data.alpha,
            height: data.height,
            width: data.width,
            scale: data.scale,
            tint: data.tint ? data.tint : "",
            mirrorX: data.mirrorX,
            mirrorY: data.mirrorY
        }
    }

    let tokenUpdateObj = { img: imgSrc };

    if(token && tokenActor){
        const usingCustomConfig = token.getFlag('token-variants', 'usingCustomConfig') || false;
        const tokenCustomConfig = getTokenConfig(imgSrc, imgName);

        if(tokenCustomConfig){
            delete tokenCustomConfig.imgSrc;
            delete tokenCustomConfig.name;
            tokenUpdateObj = mergeObject(tokenUpdateObj, tokenCustomConfig);
            await token.setFlag('token-variants', 'usingCustomConfig', true);
        } else if(usingCustomConfig) {
            const protoToken = tokenActor.data.token;
            tokenUpdateObj = mergeObject(tokenUpdateObj, extractConfig(protoToken));
            await token.setFlag('token-variants', 'usingCustomConfig', false);
        }
    } else if(actor && !token){
        const tokenCustomConfig = getTokenConfig(imgSrc, imgName);
        if(tokenCustomConfig){
            delete tokenCustomConfig.imgSrc;
            delete tokenCustomConfig.name;
            tokenUpdateObj = mergeObject(tokenUpdateObj, tokenCustomConfig);
            tokenUpdateObj.flags = {"token-variants": {"usingCustomConfig": true}};
        }
    } else if (token) {
        const usingCustomConfig = token.getFlag('token-variants', 'usingCustomConfig') || false;
        const tokenCustomConfig = getTokenConfig(imgSrc, imgName);
        const defaultConfig = token.getFlag('token-variants', 'defaultConfig') || [];

        if(tokenCustomConfig){
            delete tokenCustomConfig.imgSrc;
            delete tokenCustomConfig.name;
            tokenUpdateObj = mergeObject(tokenUpdateObj, tokenCustomConfig);

            if(!usingCustomConfig) {
                const data = token.data;
                await token.unsetFlag('token-variants', 'defaultConfig');
                await token.setFlag('token-variants', 'defaultConfig', Object.entries(extractConfig(data)));
            }
            token.setFlag('token-variants', 'usingCustomConfig', true);
        } else if(usingCustomConfig) {
            if(defaultConfig.length != 0){
                tokenUpdateObj = mergeObject(tokenUpdateObj, Object.fromEntries(defaultConfig));
            }
            await token.setFlag('token-variants', 'usingCustomConfig', false);
        }
    }

    if(actor) {
        await (actor.document ? actor.document : actor).update({ "token.img": imgSrc });
    }

    if(actor && !token){
        tokenUpdateObj.flags = {"token-variants": {"name": imgName}};
        await actor.data.token.update(tokenUpdateObj);
    }

    if (token) {
        const obj = token.document ? token.document : token;
        await obj.update(tokenUpdateObj);
        await obj.setFlag("token-variants", "name", imgName);
    } 
}

/**
 * Assign new artwork to the actor
 */
async function setActorImage(actor, image, imageName, {updateActorOnly = true}={}) {
    let updateDoc = (obj, data) => obj.document ? obj.document.update(data) : obj.update(data);
    updateDoc(actor, { img: image });
    if (updateActorOnly)
        return;

    if (twoPopups && noTwoPopupsPrompt) {
        showArtSelect(actor.name, {
            callback: (imgSrc, name) => updateTokenImage(actor, null, imgSrc, name),
            searchType: SEARCH_TYPE.TOKEN,
            tokenConfig: token ? token.data : actor.data.token
        });
    } else if (twoPopups) {
        let d = new Dialog({
            title: "Portrait -> Token",
            content: `<p>${game.i18n.localize("token-variants.TwoPopupsDialogQuestion")}</p>`,
            buttons: {
                one: {
                    icon: '<i class="fas fa-check"></i>',
                    callback: () => updateTokenImage(actor, null, image, imageName),
                },
                two: {
                    icon: '<i class="fas fa-times"></i>',
                    callback: () => {
                        showArtSelect(actor.name, {
                            callback: (imgSrc, name) => updateTokenImage(actor, null, imgSrc, name),
                            searchType: SEARCH_TYPE.TOKEN,
                            tokenConfig: token ? token.data : actor.data.token
                        });
                    }
                }
            },
            default: "one",
        });
        d.render(true);
    } else {
        updateTokenImage(actor, token, tokenSrc, imageName);
    }
}

// Initialize module
Hooks.once("ready", initialize);

// Make displayArtSelect function accessible through 'game'
Hooks.on("init", function () {
    game.TokenVariants = {
        displayArtSelect, //deprecated 
        cacheTokens, 
        doImageSearch, 
        doRandomSearch, 
        showArtSelect
    };
});
