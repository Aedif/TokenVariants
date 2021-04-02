import SearchPaths from "./applications/searchPaths.js";

// Default path where the script will look for token art
const DEFAULT_TOKEN_PATHS = ["modules/caeora-maps-tokens-assets/assets/tokens/"];

// List of all accepted monster names
const MONSTER_LIST = ['aboleth', 'acolyte', 'adult black dragon', 'adult blue dragon', 'adult brass dragon', 'adult bronze dragon', 'adult copper dragon', 'adult gold dragon', 'adult green dragon', 'adult red dragon', 'adult silver dragon', 'adult white dragon', 'air elemental', 'allosaurus', 'ancient black dragon', 'ancient blue dragon', 'ancient brass dragon', 'ancient bronze dragon', 'ancient copper dragon', 'ancient gold dragon', 'ancient green dragon', 'ancient red dragon', 'ancient silver dragon', 'ancient white dragon', 'androsphinx', 'animated armor', 'ankheg', 'ankylosaurus', 'ape', 'archmage', 'assassin', 'awakened shrub', 'awakened tree', 'axe beak', 'azer', 'baboon', 'badger', 'balor', 'bandit', 'bandit captain', 'banshee', 'barbed devil', 'basilisk', 'bat', 'bearded devil', 'behir', 'berserker', 'black bear', 'black dragon wyrmling', 'black pudding', 'blink dog', 'blood hawk', 'blue dragon wyrmling', 'boar', 'bone devil', 'brass dragon wyrmling', 'bronze dragon wyrmling', 'brown bear', 'bugbear', 'bulette', 'camel', 'cat', 'centaur', 'chain devil', 'chimera', 'chuul', 'clay golem', 'cloaker', 'cloud giant', 'cockatrice', 'commoner', 'constrictor snake', 'copper dragon wyrmling', 'couatl', 'crab', 'crocodile', 'cult fanatic', 'cultist', 'cyclops', 'darkmantle', 'death dog', 'deep gnome (svirfneblin)', 'deep gnome', 'svirfneblin', 'deer', 'deva', 'dire wolf', 'djinni', 'doppelganger', 'draft horse', 'dragon turtle', 'dretch', 'drider', 'drow', 'druid', 'dryad', 'duergar', 'dust mephit', 'eagle', 'earth elemental', 'efreeti', 'elephant', 'elk', 'erinyes', 'ettercap', 'ettin', 'fire elemental', 'fire giant', 'flameskull', 'flesh golem', 'flying snake', 'flying sword', 'frog', 'frost giant', 'gargoyle', 'gelatinous cube', 'ghast', 'ghost', 'ghoul', 'giant ape', 'giant badger', 'giant bat', 'giant boar', 'giant centipede', 'giant constrictor snake', 'giant crab', 'giant crocodile', 'giant eagle', 'giant elk', 'giant fire beetle', 'giant frog', 'giant goat', 'giant hyena', 'giant lizard', 'giant octopus', 'giant owl', 'giant poisonous snake', 'giant rat', 'giant scorpion', 'giant sea horse', 'giant shark', 'giant spider', 'giant toad', 'giant vulture', 'giant wasp', 'giant weasel', 'giant wolf spider', 'gibbering mouther', 'glabrezu', 'gladiator', 'gnoll', 'goat', 'goblin', 'gold dragon wyrmling', 'gorgon', 'gray ooze', 'green dragon wyrmling', 'green hag', 'grick', 'griffon', 'grimlock', 'guard', 'guardian naga', 'gynosphinx', 'half-red dragon veteran', 'half red dragon veteran', 'harpy', 'hawk', 'hell hound', 'hezrou', 'hill giant', 'hippogriff', 'hobgoblin', 'homunculus', 'horned devil', 'hunter shark', 'hydra', 'hyena', 'ice devil', 'ice mephit', 'imp', 'invisible stalker', 'iron golem', 'jackal', 'killer whale', 'knight', 'kobold', 'kraken', 'lamia', 'lemure', 'lich', 'lion', 'lizard', 'lizardfolk', 'mage', 'magma mephit', 'magmin', 'mammoth', 'manticore', 'marilith', 'mastiff', 'medusa', 'merfolk', 'merrow', 'mimic', 'minotaur', 'minotaur skeleton', 'mule', 'mummy', 'mummy lord', 'nalfeshnee', 'night hag', 'nightmare', 'noble', 'nothic', 'ochre jelly', 'octopus', 'ogre', 'ogre zombie', 'oni', 'orc', 'otyugh', 'owl', 'owlbear', 'panther', 'pegasus', 'phase spider', 'pit fiend', 'planetar', 'plesiosaurus', 'poisonous snake', 'polar bear', 'pony', 'priest', 'pseudodragon', 'pteranodon', 'purple worm', 'quasit', 'quipper', 'rakshasa', 'rat', 'raven', 'red dragon wyrmling', 'reef shark', 'remorhaz', 'rhinoceros', 'riding horse', 'roc', 'roper', 'rug of smothering', 'rust monster', 'saber-toothed tiger', 'saber toothed tiger', 'sahuagin', 'salamander', 'satyr', 'scorpion', 'scout', 'sea hag', 'sea horse', 'shadow', 'shambling mound', 'shield guardian', 'shrieker', 'silver dragon wyrmling', 'skeleton', 'solar', 'spectator', 'specter', 'spider', 'spirit naga', 'sprite', 'spy', 'steam mephit', 'stirge', 'stone giant', 'stone golem', 'storm giant', 'succubus/incubus', 'succubus', 'incubus', 'swarm of bats', 'swarm of insects', 'swarm of poisonous snakes', 'swarm of quippers', 'swarm of rats', 'swarm of ravens', 'tarrasque', 'thug', 'tiger', 'treant', 'tribal warrior', 'triceratops', 'troll', 'twig blight', 'tyrannosaurus rex', 'unicorn', 'vampire', 'vampire spawn', 'veteran', 'violet fungus', 'vrock', 'vulture', 'warhorse', 'warhorse skeleton', 'water elemental', 'weasel', 'werebear', 'wereboar', 'wererat', 'weretiger', 'werewolf', 'white dragon wyrmling', 'wight', "will-o'-wisp", "will o' wisp", 'winter wolf', 'wolf', 'worg', 'wraith', 'wyvern', 'xorn', 'yeti', 'young black dragon', 'young blue dragon', 'young brass dragon', 'young bronze dragon', 'young copper dragon', 'young gold dragon', 'young green dragon', 'young red dragon', 'young silver dragon', 'young white dragon', 'zombie'];

// A cached list of available tokens
let availableTokens = new Map();

let searchPaths = new Array();

/**
 * Initialize the Caeora module on Foundry VTT init
 */
function initialize() {

    // Only support the dnd5e system for this functionality
    if (game.system.id !== "dnd5e") return;

    game.settings.registerMenu("token-variants", "searchPaths", {
        name: game.i18n.localize("token-variants.searchPathsTitle"),
        label: game.i18n.localize("token-variants.searchPathsLabel"),
        hint: game.i18n.localize("token-variants.SearchPathsHint"),
        icon: "fas fa-exchange-alt",
        type: SearchPaths,
        restricted: true
    });
    game.settings.register("token-variants", "searchPaths", {
        scope: "world",
        config: false,
        type: Array,
        default: DEFAULT_TOKEN_PATHS,
    });

    searchPaths = game.settings.get("token-variants", "searchPaths")[0];

    // Handle actor replacement, if the setting is enabled
    Hooks.on("createActor", replaceActorArtwork);

    // Cache available tokens
    cacheAvailableTokens();
}

/**
 * Search for and cache all the found token art
 */
async function cacheAvailableTokens() {
    availableTokens.clear();
    for (let path of searchPaths) {
        if (path) {
            walkCacheTokens(path);
        }
    }
}

/**
 * Walks the directory tree and caches the found token art
 */
async function walkCacheTokens(path) {
    const files = await FilePicker.browse("data", path);
    for (let token of files.files) {
        cache_token(token);
    }
    for (let dir of files.dirs) {
        walkCacheTokens(dir);
    }
}

/**
 * Simplifies token and monster names
 */
function simplifyTokenName(tokenName) {
    return tokenName.replace(/ |-|_/g, "").toLowerCase();
}

/**
 * Cache the given token name
 */
function cache_token(token) {
    // Getting the filename without extension and removing
    let tokenName = token.split('\\').pop().split('/').pop().split('.')[0];
    const cleanTokenName = simplifyTokenName(tokenName);

    // Place tokens in a Map where key=simplified
    for (let name of MONSTER_LIST) {
        const cleanName = simplifyTokenName(name);
        if (cleanTokenName.includes(cleanName)) {
            if (availableTokens.has(cleanName)) {
                availableTokens.get(cleanName).push(token);
            } else {
                availableTokens.set(cleanName, [token]);
            }
        }
    }
}

/**
 * Replace the artwork for a NPC actor with the variant version.
 */
function replaceActorArtwork(actor, options, userId) {
    let data = actor._data;

    if ((data.type !== "npc") || !hasProperty(data, "data.details.cr")) return;

    const cleanName = simplifyTokenName(data.name);

    if (!availableTokens.has(cleanName)) return;

    const tokens = availableTokens.get(cleanName);

    if (tokens.length == 1) {
        setTokenImage(actor, tokens[0]);
        return;
    }

    let buttons = {};
    tokens.forEach((tokenSrc, index) => {
        buttons[index] = {
            icon: `<img src="${tokenSrc}"/>`,
            label: tokenSrc.split('\\').pop().split('/').pop().split('.')[0],
            callback: () => setTokenImage(actor, tokenSrc),
        };
    });

    let d = new Dialog({
        title: "Variant Select",
        content: "<p>Choose the art for the token.</p>",
        buttons: buttons,
        default: 1,
        render: html => console.log("Register interactivity in the rendered dialog"),
        close: html => console.log("This always is logged no matter which option is chosen"),
    }, { width: 400, height: 250, resizable: true });
    d.render(true);
}

/**
 * Assign new artwork to the actor
 */
function setTokenImage(actor, tokenSrc) {
    actor.update({ "_id": actor.id, "img": tokenSrc });
    actor.getActiveTokens().forEach((token) => {
        token.update({ "img": tokenSrc });
    });
}

// Initialize module
Hooks.on("init", initialize);