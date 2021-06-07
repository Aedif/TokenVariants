import SearchPaths from "./applications/searchPaths.js";
import ArtSelect from "./applications/artSelect.js";
import { getFileName, getFileNameWithExt, simplifyTokenName, parseSearchPaths, parseKeywords, isImage, isVideo } from "./scripts/utils.js"

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

function registerSettings() {
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

    registerSettings();

    // Handle actor/token art replacement
    Hooks.on("createActor", async (actor, options, userId) => {
        if (userId && game.user.id != userId)
            return;
        let searchType = twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.BOTH;
        displayArtSelect(actor.data.name, (imgSrc) => setActorImage(actor, imgSrc), searchType);
    });
    Hooks.on("createToken", async (tokenDoc, options, userId, op4) => {
        if (!keyboard.isDown(actorDirKey)) return;
        let searchType = twoPopups ? SEARCH_TYPE.PORTRAIT : SEARCH_TYPE.BOTH;
        // Check to support both 0.7.x and 0.8.x
        if (op4) {
            let token = canvas.tokens.get(options._id);
            displayArtSelect(options.name, (imgSrc) => setActorImage(token.actor, imgSrc, false, token), searchType);
        } else {
            let token = tokenDoc._object;
            displayArtSelect(token.name, (imgSrc) => setActorImage(tokenDoc._actor, imgSrc, false, token), searchType);
        }
    });
    Hooks.on("renderTokenConfig", modTokenConfig);
    Hooks.on("renderActorSheet", modActorSheet);

    // Cache tokens if not disabled
    cacheTokens();

    initialized = true;
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
        let searchPaths = parseSearchPaths();
        for (let path of searchPaths.get("data")) {
            await walkFindTokens(path, simpleName, "", mustContain);
        }
        for (let [bucket, paths] of searchPaths.get("s3")) {
            for (let path of paths) {
                await walkFindTokens(path, simpleName, bucket, mustContain);
            }
        }
    }
    return foundTokens;
}

/**
 * Walks the directory tree and finds all the matching token art
 */
async function walkFindTokens(path, name = "", bucket = "", mustContain = "") {
    if (!bucket && !path) return;

    let files = [];
    try {
        if (bucket) {
            files = await FilePicker.browse("s3", path, { bucket: bucket });
        } else {
            files = await FilePicker.browse("data", path);
        }
    } catch (err) {
        console.log(`${game.i18n.localize("token-variant.PathNotFoundError")} ${path}`);
        return;
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
 * Performs searches and displays the Art Select screen with the results.
 * @param name The name to be used as the search criteria
 * @param callback function that will be called with the user selected image path as argument
 * @param searchType (token|portrait|both) indicates whether the window is being displayed for a token search or portrait search or both
 * @param ignoreFilterMSRD boolean that if set to true will ignore the filterMSRD setting
 */
async function displayArtSelect(name, callback, searchType = SEARCH_TYPE.BOTH, ignoreFilterMSRD = false) {

    if (filterMSRD && !ignoreFilterMSRD && !monsterNameList.includes(simplifyTokenName(name))) {
        console.log(`${game.i18n.localize("token-variants.FilterMSRDError")} <b>${name}</b>`);
        return;
    }

    // Set Art Select screen title
    let title = game.i18n.localize("token-variants.SelectScreenTitle");
    if (searchType == SEARCH_TYPE.TOKEN)
        title = game.i18n.localize("token-variants.SelectScreenTitleToken");
    else if (searchType == SEARCH_TYPE.PORTRAIT)
        title = game.i18n.localize("token-variants.SelectScreenTitlePortrait");

    let allImages = await doArtSearch(name, searchType, ignoreFilterMSRD);
    if (!allImages) return;

    let artFound = false;
    let allButtons = new Map();
    allImages.forEach((tokens, search) => {
        let buttons = [];
        tokens.forEach(token => {
            artFound = true;
            const vid = isVideo(token);
            const img = isImage(token);
            buttons.push({
                path: token,
                img: img,
                vid: vid,
                type: vid || img,
                label: getFileName(token),
            })
        })
        allButtons.set(search, buttons);
    });

    let searchAndDisplay = ((search) => {
        displayArtSelect(search, callback, searchType, true);
    });

    if (artFound) {
        let artSelect = new ArtSelect(title, name, allButtons, callback, searchAndDisplay);
        artSelect.render(true);
    } else {
        let artSelect = new ArtSelect(title, name, null, callback, searchAndDisplay);
        artSelect.render(true);
    }

}

async function doArtSearch(name, searchType = SEARCH_TYPE.BOTH, ignoreFilterMSRD = false, ignoreKeywords = false) {

    if (filterMSRD && !ignoreFilterMSRD && !monsterNameList.includes(simplifyTokenName(name))) {
        console.log(`${game.i18n.localize("token-variants.FilterMSRDError")} <b>${name}</b>`);
        return null;
    }

    let fileMustContain = "";
    if (searchType == SEARCH_TYPE.TOKEN)
        fileMustContain = tokenFilter;
    else if (searchType == SEARCH_TYPE.PORTRAIT)
        fileMustContain = portraitFilter;

    let searches = [name];
    let allImages = new Map();
    let usedTokens = new Set();

    if (keywordSearch && !ignoreKeywords) {
        excludedKeywords = parseKeywords(game.settings.get("token-variants", "excludedKeywords"));
        searches = searches.concat(name.split(/\W/).filter(word => word.length > 2 && !excludedKeywords.includes(word.toLowerCase())).reverse());
    }

    for (let search of searches) {
        if (allImages.get(search) !== undefined) continue;
        let tokens = await findTokens(search, fileMustContain);
        tokens = Array.from(tokens).filter(token => !usedTokens.has(token))
        tokens.forEach(token => usedTokens.add(token));
        allImages.set(search, tokens);
    }

    return allImages;
}

/**
 * Assign new artwork to the actor
 */
function setActorImage(actor, tokenSrc, updateActorOnly = false, token = null) {

    let updateDoc = (obj, data) => obj.document ? obj.document.update(data) : obj.update(data);
    updateDoc(actor, { img: tokenSrc });

    if (updateActorOnly)
        return;

    function updateToken(actorToUpdate, tokenToUpdate, imgSrc) {
        updateDoc(actorToUpdate, { "token.img": imgSrc });
        if (tokenToUpdate) {
            updateDoc(tokenToUpdate, { img: imgSrc });
        } else if (actorToUpdate.getActiveTokens().length == 1)
            updateDoc(actorToUpdate.getActiveTokens()[0], { img: imgSrc });
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

// Make displayArtSelect function accessible through 'game'
Hooks.on("init", function () {
    game.TokenVariants = {
        displayArtSelect: displayArtSelect
    };
});

// Incorporating 'FVTT-TokenHUDWildcard' token hud button 
Hooks.on('renderTokenHUD', async (hud, html, token) => {

    let images = await doArtSearch(token.name, SEARCH_TYPE.TOKEN, false, true);
    images = images.get(token.name);

    if (images.length < 2) return;

    let imagesParsed = images.map(path => {
        const img = isImage(path);
        const vid = isVideo(path);
        return { route: path, name: getFileName(path), used: path === token.img, img, vid, type: img || vid }
    });

    const imageDisplay = true;
    const opacity = 1.0;

    const wildcardDisplay = await renderTemplate('modules/token-variants/templates/sideSelect.html', { imagesParsed, imageDisplay, opacity })

    html.find('div.right')
        .append(wildcardDisplay)
        .click((event) => {
            const buttonFind = html.find('.control-icon.token-variants-side-selector')
            const cList = event.target.parentElement.classList
            const correctButton = cList.contains('token-variants-side-selector')
            const active = cList.contains('active')

            if (correctButton && !active) {
                buttonFind[0].classList.add('active')
                html.find('.token-variants-wrap')[0].classList.add('active')

                html.find('.control-icon.effects')[0].classList.remove('active')
                html.find('.status-effects')[0].classList.remove('active')
            } else {
                buttonFind[0].classList.remove('active')
                html.find('.token-variants-wrap')[0].classList.remove('active')
            }
        });

    const buttons = html.find('.token-variants-button-select')

    buttons.map((button) => {
        buttons[button].addEventListener('click', function (event) {
            event.preventDefault()
            event.stopPropagation()
            const controlled = canvas.tokens.controlled
            const index = controlled.findIndex(x => x.data._id === token._id)
            const tokenToChange = controlled[index]
            tokenToChange.update({ img: event.target.dataset.name })
        })
    })
});