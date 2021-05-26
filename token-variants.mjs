import SearchPaths from "./applications/searchPaths.js";
import ArtSelect from "./applications/artSelect.js";

// Default path where the script will look for token art
const DEFAULT_TOKEN_PATHS = ["modules/caeora-maps-tokens-assets/assets/tokens/"];

// List of all accepted monster names
let monsterNameList = [];

// Controls whether found art should be filtered by 5e monster srd
let filterMSRD = true;

// Controls whether a keyword search is to be performed in addition to full-name search
let keywordSearch = false;
let excludedKeywords = [];

// Disables storing of token paths in a cache
let disableCaching = false;

// A cached map of all the found tokens
let cachedTokens = new Set();

// Tokens found with caching disabled
let foundTokens = new Set();

// Tracks if module has been initialized
let initialized = false;

// Keyboard key controlling the pop-up when dragging in a token from the Actor Directory
let actorDirKey = "";

// Controls whether separate popups are displayed for portrait and token art
let twoPopups = false;

// Strings used to filter portrait and token art
let portraitFilter = "";
let tokenFilter = "";

// Obj used for indicating what title and filter should be used in the Art Select screen
let SEARCH_TYPE = {
    PORTRAIT: "portrait",
    TOKEN: "token",
    BOTH: "both"
}

/**
 * Initialize the Token Variants module on Foundry VTT init
 */
function initialize() {

    // Initialization should only be performed once
    if (initialized) {
        return;
    }

    // Perform initialization only if the user is a GM
    if (!game.user.isGM) {
        return;
    }

    // Settings 
    game.settings.registerMenu("token-variants", "searchPaths", {
        name: game.i18n.localize("token-variants.searchPathsTitle"),
        label: game.i18n.localize("token-variants.searchPathsLabel"),
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
        onChange: _ => disableCaching || cacheTokens()
    });

    game.settings.register("token-variants", "disableCaching", {
        name: game.i18n.localize("token-variants.DisableCachingName"),
        hint: game.i18n.localize("token-variants.DisableCachingHint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: disable => { disableCaching = disable; cacheTokens(); }
    });

    game.settings.register("token-variants", "filterMSRD", {
        name: game.i18n.localize("token-variants.FilterMSRDName"),
        hint: game.i18n.localize("token-variants.FilterMSRDHint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: filter => { filterMSRD = filter; cacheTokens(); }
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

    game.settings.register("token-variants", "twoPopups", {
        name: game.i18n.localize("token-variants.TwoPopupsName"),
        hint: game.i18n.localize("token-variants.TwoPopupsHint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: val => twoPopups = val
    });

    game.settings.register("token-variants", "portraitFilter", {
        name: game.i18n.localize("token-variants.PortraitFilterName"),
        hint: game.i18n.localize("token-variants.PortraitFilterHint"),
        scope: "world",
        config: true,
        type: String,
        default: "",
        onChange: val => portraitFilter = val
    });

    game.settings.register("token-variants", "tokenFilter", {
        name: game.i18n.localize("token-variants.TokenFilterName"),
        hint: game.i18n.localize("token-variants.TokenFilterHint"),
        scope: "world",
        config: true,
        type: String,
        default: "",
        onChange: val => tokenFilter = val
    });

    filterMSRD = game.settings.get("token-variants", "filterMSRD");
    disableCaching = game.settings.get("token-variants", "disableCaching");
    keywordSearch = game.settings.get("token-variants", "keywordSearch");
    actorDirKey = game.settings.get("token-variants", "actorDirectoryKey");
    twoPopups = game.settings.get("token-variants", "twoPopups");
    portraitFilter = game.settings.get("token-variants", "portraitFilter");
    tokenFilter = game.settings.get("token-variants", "tokenFilter");

    // Handle actor/token art replacement
    Hooks.on("createActor", async (actor, options, userId) => {
        if (userId && game.user.id != userId)
            return;
        let searchType = twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.BOTH;
        displayArtSelect(actor._data.name, (imgSrc) => setActorImage(actor, imgSrc), searchType);
    });
    Hooks.on("createToken", async (op1, tokenData, op3, op4) => {
        if (!keyboard.isDown(actorDirKey)) return;
        let token = canvas.tokens.get(tokenData._id);
        let searchType = twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.BOTH;
        displayArtSelect(tokenData.name, (imgSrc) => setActorImage(token.actor, imgSrc, false, token), searchType);
    });
    Hooks.on("renderTokenConfig", modTokenConfig);
    Hooks.on("renderActorSheet", modActorSheet);

    // Cache tokens if not disabled
    cacheTokens();

    initialized = true;
}

function parseKeywords(keywords) {
    return keywords.split(/\W/).map(word => simplifyTokenName(word)).filter(word => word != "")
}

/**
 * Adds a button to 'Token Configuration' window's 'Image' tab which opens
 * ArtSelect using the token's name.
 */
function modTokenConfig(tokenConfig, html, _) {
    let fields = html[0].getElementsByClassName("image");
    for (let field of fields) {
        if (field.getAttribute("name") == "img") {
            let el = document.createElement("button");
            el.type = "button";
            el.title = game.i18n.localize("token-variants.TokenConfigButtonTitle");
            el.innerHTML = '<i class="fas fa-images"></i>';
            el.tabIndex = -1;
            el.onclick = async () => displayArtSelect(tokenConfig.object.data.name, (imgSrc) => field.value = imgSrc, SEARCH_TYPE.TOKEN);
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
    if (!options.editable) return;

    let profile = null;
    let profileClassNames = ["profile", "profile-img", "profile-image"];

    for (let className of profileClassNames) {
        profile = html[0].getElementsByClassName(className)[0];
        if (profile) break;
    }

    if (!profile) {
        console.log(game.i18n.localize("token-variants.ProfileListenerError"));
        return;
    }

    profile.addEventListener('contextmenu', function (ev) {
        displayArtSelect(actorSheet.object.name, (imgSrc) => setActorImage(actorSheet.object, imgSrc, true), SEARCH_TYPE.PORTRAIT);
    }, false);
}

/**
 * Parses the searchPaths setting into a Map, distinguishing s3 buckets from local paths
 * @returns 
 */
function getSearchPaths() {
    const regexpBucket = /s3:(.*):(.*)/;
    let searchPathList = game.settings.get("token-variants", "searchPaths")[0];
    searchPathList = searchPathList.flat(); // To fix the problem seen in https://github.com/Aedif/TokenVariants/issues/2 for users still using DEFAULT search path
    let searchPaths = new Map();
    searchPaths.set("data", []);
    searchPaths.set("s3", new Map());

    searchPathList.forEach((path) => {
        if (path.startsWith("s3:")) {
            const match = path.match(regexpBucket);
            if (match[1]) {
                let bucket = match[1];
                let bPath = match[2];
                let buckets = searchPaths.get("s3");

                if (buckets.has(bucket)) {
                    buckets.get(bucket).push(bPath);
                } else {
                    buckets.set(bucket, [bPath]);
                }
            }
        } else {
            searchPaths.get("data").push(path);
        }
    });
    return searchPaths;
}

/**
 * Search for and cache all the found token art
 */
async function cacheTokens() {
    cachedTokens.clear();

    if (filterMSRD) {
        await jQuery.getJSON("modules/token-variants/data/monster_srd_names.json", (json) => (monsterNameList = json));
        monsterNameList = monsterNameList.map(name => simplifyTokenName(name));
    }

    if (disableCaching) return;

    await findTokens("");
    cachedTokens = foundTokens;
    foundTokens = new Set();
}

/**
 * Search for tokens matching the supplied name
 */
async function findTokens(name, mustContain = "") {
    foundTokens = new Set();
    const simpleName = simplifyTokenName(name);

    if (cachedTokens.size != 0) {
        cachedTokens.forEach((tokenSrc) => {
            const simpleTokenName = simplifyTokenName(getFileName(tokenSrc));
            if (simpleTokenName.includes(simpleName)) {
                if (!mustContain || getFileNameWithExt(tokenSrc).includes(mustContain)) {
                    foundTokens.add(tokenSrc);
                }
            }
        });
    } else {
        let searchPaths = getSearchPaths();
        for (let path of searchPaths.get("data")) {
            await walkFindTokens(path, simpleName, "", mustContain);
        }
        for (let [bucket, paths] of searchPaths.get("s3")) {
            for (let path of paths) {
                await walkFindTokens(path, simpleName, bucket, mustContain);
            }
        }
    }
    return Array.from(foundTokens);
}

/**
 * Walks the directory tree and finds all the matching token art
 */
async function walkFindTokens(path, name = "", bucket = "", mustContain = "") {
    if (!bucket && !path) return;

    let files = [];
    if (bucket) {
        files = await FilePicker.browse("s3", path, { bucket: bucket });
    } else {
        files = await FilePicker.browse("data", path);
    }

    if (files.target == ".") return;

    for (let token of files.files) {
        let tokenName = getFileName(token);
        const cleanTokenName = simplifyTokenName(tokenName);

        if (name && !cleanTokenName.includes(name)) continue;

        if (!mustContain || getFileNameWithExt(path).includes(mustContain)) {
            foundTokens.add(token);
        }
    }
    for (let dir of files.dirs) {
        await walkFindTokens(dir, name, bucket, mustContain);
    }
}

/**
 * Simplifies token and monster names.
 */
function simplifyTokenName(tokenName) {
    return tokenName.replace(/\W/g, '').toLowerCase();
}

/**
 * Extracts the file name from the given path.
 */
function getFileName(path) {
    return decodeURI(path).split('\\').pop().split('/').pop().split('.')[0]
}

/**
 * Extracts the file name including the extension from the given path.
 */
function getFileNameWithExt(path) {
    return decodeURI(path).split('\\').pop().split('/').pop();
}

/**
 * Performs searches and displays the Art Select screen with the results.
 * @param name The name to be used as the search criteria
 * @param callback function that will be called with the user selected image path as argument
 * @param ignoreFilterMSRD boolean that if set to true will ignore the filterMSRD setting
 */
async function displayArtSelect(name, callback, searchType = SEARCH_TYPE.BOTH, ignoreFilterMSRD = false) {
    if (filterMSRD && !ignoreFilterMSRD && !monsterNameList.includes(simplifyTokenName(name))) {
        console.log(`${game.i18n.localize("token-variants.FilterMSRDError")} <b>${name}</b>`);
        return;
    }

    // Set Art Select screen title
    let title = game.i18n.localize("token-variants.SelectScreenTitle");
    let fileMustContain = "";
    switch (searchType) {
        case SEARCH_TYPE.TOKEN:
            title = game.i18n.localize("token-variants.SelectScreenTitleToken");
            fileMustContain = tokenFilter;
            break;
        case SEARCH_TYPE.PORTRAIT:
            title = game.i18n.localize("token-variants.SelectScreenTitlePortrait");
            fileMustContain = portraitFilter;
            break;
    }

    let searches = [name];
    let allButtons = {};
    let usedTokens = new Set();

    if (keywordSearch) {
        excludedKeywords = parseKeywords(game.settings.get("token-variants", "excludedKeywords"));
        searches = searches.concat(name.split(/\W/).filter(word => word.length > 2 && !excludedKeywords.includes(word.toLowerCase())).reverse());
    }

    let buttonId = 0;
    let artFound = false;
    for (let search of searches) {
        if (allButtons[search] !== undefined) continue;
        let tokens = await findTokens(search, fileMustContain);
        if (!tokens) continue;

        // Generate buttons for each token art
        let buttons = [];
        tokens.forEach((tokenSrc) => {
            if (!usedTokens.has(tokenSrc)) {
                usedTokens.add(tokenSrc);
                buttons.push({
                    id: ++buttonId,
                    path: tokenSrc,
                    label: getFileName(tokenSrc),
                    callback: () => callback(tokenSrc),
                });
            }
        });
        if (buttons.length > 0) {
            artFound = true;
        }
        allButtons[search] = buttons;
    }

    let searchAndDisplay = ((search) => {
        displayArtSelect(search, callback, searchType, true);
    });

    if (artFound) {
        let artSelect = new ArtSelect(allButtons, name, searchAndDisplay, title);
        artSelect.render(true);
    } else {
        let artSelect = new ArtSelect(null, name, searchAndDisplay, title);
        artSelect.render(true);
    }
}

/**
 * Assign new artwork to the actor
 */
function setActorImage(actor, tokenSrc, updateActorOnly = false, token = null) {
    actor.update({ "img": tokenSrc });

    if (updateActorOnly)
        return;

    function updateToken(actorToUpdate, tokenToUpdate, imgSrc) {
        actorToUpdate.update({ "token.img": imgSrc });
        if (tokenToUpdate)
            tokenToUpdate.update({ "img": imgSrc });
        else if (actorToUpdate.getActiveTokens().length == 1)
            actorToUpdate.getActiveTokens()[0].update({ "img": imgSrc });
    }

    if (twoPopups) {
        let d = new Dialog({
            title: "Portrait -> Token",
            content: `<p>${game.i18n.localize("token-variants.TwoPopupsDialogQuestion")}</p>`,
            buttons: {
                one: {
                    icon: '<i class="fas fa-check"></i>',
                    callback: () => updateToken(actor, token, tokenSrc),
                },
                two: {
                    icon: '<i class="fas fa-times"></i>',
                    callback: () => {
                        displayArtSelect(actor.name, (imgSrc) => updateToken(actor, token, imgSrc), SEARCH_TYPE.TOKEN);
                    }
                }
            },
            default: "one",
        });
        d.render(true);
    } else {
        updateToken(actor, token, tokenSrc)
    }
}

// Initialize module
Hooks.on("canvasInit", initialize);

