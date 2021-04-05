import SearchPaths from "./applications/searchPaths.js";
import ArtSelect from "./applications/artSelect.js";

// Default path where the script will look for token art
const DEFAULT_TOKEN_PATHS = ["modules/caeora-maps-tokens-assets/assets/tokens/"];

// List of all accepted monster names
let monsterNameList = [];

// Controls whether found art should be filtered by 5e monster srd
let filterMSRD = true;

// Disables storing of token paths in a cache
let disableCaching = false;

// A cached map of all the found tokens
let cachedTokens = new Map();

// Tokens found with caching disabled
let foundTokens = new Array();

/**
 * Initialize the Token Variants module on Foundry VTT init
 */
function initialize() {

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
        default: [DEFAULT_TOKEN_PATHS],
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
        default: true,
        onChange: filter => { filterMSRD = filter; cacheTokens(); }
    });

    filterMSRD = game.settings.get("token-variants", "filterMSRD");
    disableCaching = game.settings.get("token-variants", "disableCaching");

    // Handle actor/token art replacement
    Hooks.on("createActor", replaceActorArtwork);
    Hooks.on("renderTokenConfig", modTokenConfig);

    // Cache tokens if not disabled
    cacheTokens();
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
            el.onclick = () => replaceTokenConfigImage(tokenConfig.object, field);
            field.parentNode.append(el);
            return;
        }
    }
}

/**
 * Search for and cache all the found token art
 */
async function cacheTokens() {
    cachedTokens.clear();

    await jQuery.getJSON("modules/token-variants/data/monster_srd_names.json", (json) => (monsterNameList = json));
    monsterNameList = monsterNameList.map(name => simplifyTokenName(name));

    if (disableCaching) return;

    let searchPaths = game.settings.get("token-variants", "searchPaths")[0];
    for (let path of searchPaths) {
        if (path) {
            walkCacheTokens(path);
        }
    }
}

/**
 * Search for tokens matching the supplied name
 */
async function findTokens(name) {
    foundTokens = [];
    const simpleName = simplifyTokenName(name);

    if (cachedTokens.has("all_paths")) {
        if (filterMSRD && !monsterNameList.includes(simpleName)) return;

        let allPaths = cachedTokens.get("all_paths");
        allPaths.forEach((tokenSrc) => {
            const simpleTokenName = simplifyTokenName(getFileName(tokenSrc));
            if (simpleTokenName.includes(simpleName)) {
                foundTokens.push(tokenSrc);
            }
        });
    } else {
        let searchPaths = game.settings.get("token-variants", "searchPaths")[0];
        for (let path of searchPaths) {
            if (path) {
                await walkFindTokens(path, simpleName);
            }
        }
    }
    return foundTokens;
}

/**
 * Walks the directory tree and caches the found token art
 */
async function walkCacheTokens(path) {
    const files = await FilePicker.browse("data", path);
    for (let token of files.files) {
        cacheToken(token);
    }
    for (let dir of files.dirs) {
        walkCacheTokens(dir);
    }
}

/**
 * Walks the directory tree and finds all the matching token art
 */
async function walkFindTokens(path, name) {
    const files = await FilePicker.browse("data", path);
    for (let token of files.files) {
        let tokenName = getFileName(token);
        const cleanTokenName = simplifyTokenName(tokenName);
        if (cleanTokenName.includes(name)) {
            foundTokens.push(token);
        }
    }
    for (let dir of files.dirs) {
        await walkFindTokens(dir, name);
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
 * Cache the given token path
 */
function cacheToken(token) {
    if (filterMSRD) {
        // Getting the filename without extension and removing
        let tokenName = getFileName(token);
        const cleanTokenName = simplifyTokenName(tokenName);
        // Place tokens in a Map where key=simplified
        for (let name of monsterNameList) {
            if (cleanTokenName.includes(name)) {
                if (cachedTokens.has(name)) {
                    cachedTokens.get(name).push(token);
                } else {
                    cachedTokens.set(name, [token]);
                }
            }
        }
    } else {
        if (cachedTokens.has("all_paths")) {
            cachedTokens.get("all_paths").push(token);
        } else {
            cachedTokens.set("all_paths", [token]);
        }
    }
}

/**
 * Returns all token art paths for the given Actor/Token name
 */
async function retrieveTokens(name) {
    const cleanName = simplifyTokenName(name);
    let tokens = [];
    if (disableCaching || cachedTokens.has("all_paths")) {
        tokens = Array.from(new Set(await findTokens(cleanName)));
        if (tokens.length == 0) return;
    } else if (cachedTokens.has(cleanName)) {
        tokens = Array.from(new Set(cachedTokens.get(cleanName)))
    }
    return tokens;
}

/**
 * Retrieves and displays all of the art found for the given token.
 * If a particular art is selected, the path to it is assigned to the html element.
 */
async function replaceTokenConfigImage(token, tokenImagePathEl) {
    let tokens = await retrieveTokens(token.data.name);
    if (!tokens) {
        Dialog.prompt({
            title: token.data.name,
            content: `<p>${game.i18n.localize("token-variants.TokenConfigPrompt")}: <b>${token.data.name}</b></p>`,
            label: "Ok",
            callback: html => { }
        });
        return;
    }

    // Display a form to select the variant art
    let buttons = [];
    tokens.forEach((tokenSrc, i) => {
        buttons.push({
            index: i,
            path: tokenSrc,
            label: getFileName(tokenSrc),
            callback: () => tokenImagePathEl.value = tokenSrc,
        });
    });

    let artSelect = new ArtSelect(buttons);
    artSelect.render(true);
}

/**
 * Replace the artwork for a NPC actor with the variant version.
 */
async function replaceActorArtwork(actor, options, userId) {
    let data = actor._data;
    if ((data.type !== "npc")) return;

    let tokens = await retrieveTokens(data.name);
    if (!tokens) return;

    // Auto-replace if only 1 variant art was found and the actor does not
    // currently have any art assigned to it.
    if (tokens.length == 1 && actor.img == DEFAULT_TOKEN) {
        setTokenImage(actor, tokens[0]);
        return;
    }

    // Display a form to select the variant art
    let buttons = [];
    tokens.forEach((tokenSrc, i) => {
        buttons.push({
            index: i,
            path: tokenSrc,
            label: getFileName(tokenSrc),
            callback: () => setTokenImage(actor, tokenSrc),
        });
    });

    let artSelect = new ArtSelect(buttons);
    artSelect.render(true);
}

/**
 * Assign new artwork to the actor
 */
function setTokenImage(actor, tokenSrc) {
    actor.update({ "_id": actor.id, "img": tokenSrc, "token.img": tokenSrc });
    actor.getActiveTokens().forEach((token) => {
        token.update({ "img": tokenSrc });
    });
}

// Initialize module
Hooks.on("init", initialize);