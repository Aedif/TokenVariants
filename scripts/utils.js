const simplifyRegex = new RegExp(/[^A-Za-z0-9/]/g);

// Types of searches
export const SEARCH_TYPE = {
    PORTRAIT: "portrait",
    TOKEN: "token",
    BOTH: "both"
}

/**
 * Retrieves a custom token configuration if one exists for the given image
 */
export function getTokenConfig(imgSrc, imgName){
    const tokenConfigs = (game.settings.get("token-variants", "tokenConfigs") || []).flat();
    return tokenConfigs.find(config => config.tvImgSrc == imgSrc && config.tvImgName == imgName);
}

/**
 * Retrieves a custom token configuration if one exists for the given image and removes control keys
 * returning a clean config that can be used in token update.
 */
export function getTokenConfigForUpdate(imgSrc, imgName){
    const tokenConfig = getTokenConfig(imgSrc, imgName);
    if(tokenConfig){
        delete tokenConfig.tvImgSrc;
        delete tokenConfig.tvImgName;
        for (var key in tokenConfig){
            if(key.startsWith('tvTab_')){
                delete tokenConfig[key]
            }
        }
    }
    return tokenConfig;
}

/**
 * Adds or removes a custom token configuration
 */
export function setTokenConfig(imgSrc, imgName, tokenConfig){
    const tokenConfigs = (game.settings.get("token-variants", "tokenConfigs") || []).flat();
    const tcIndex = tokenConfigs.findIndex(config => config.tvImgSrc == imgSrc && config.tvImgName == imgName);

    let deleteConfig = !tokenConfig || Object.keys(tokenConfig).length === 0;
    if(!deleteConfig){
        tokenConfig['tvImgSrc'] = imgSrc;
        tokenConfig['tvImgName'] = imgName;
    }

    if(tcIndex != -1 && !deleteConfig){
        tokenConfigs[tcIndex] = tokenConfig;
    } else if(tcIndex != -1 && deleteConfig) {
        tokenConfigs.splice(tcIndex, 1);
    } else if(!deleteConfig){
        tokenConfigs.push(tokenConfig);
    }
    game.settings.set("token-variants", "tokenConfigs", tokenConfigs);
}


/**
 * Extracts the file name from the given path.
 */
export function getFileName(path) {
    return decodeURI(path).split('\\').pop().split('/').pop().split('.')[0]
}

/**
 * Extracts the file name including the extension from the given path.
 */
export function getFileNameWithExt(path) {
    return decodeURI(path).split('\\').pop().split('/').pop();
}

/**
 * Simplifies token and monster names.
 */
export function simplifyTokenName(tokenName) {
    return tokenName.replace(simplifyRegex, '').toLowerCase();
}

export function simplifyPath(path) {
    return path.replace(simplifyRegex, '').toLowerCase();
}

async function _parseForgeAssetPaths(){
    const forgePaths = game.settings.get("token-variants", "forgeSearchPaths") || {};
    const userId = typeof ForgeAPI !== 'undefined' ? await ForgeAPI.getUserId() : "";
    const searchPaths = [];

    for (let uid in forgePaths) {
        if(uid === userId){
            forgePaths[uid].paths.forEach(path => {
                searchPaths.push(path);
            });
        } else if(forgePaths[uid].apiKey){
            forgePaths[uid].paths.forEach(path => {
                if(path.share){
                    path.apiKey = forgePaths[uid].apiKey;
                    searchPaths.push(path);
                }
            });
        }
    }

    return searchPaths;
}

/**
 * Parses the searchPaths setting into a Map, distinguishing s3 buckets from local paths
 */
export async function parseSearchPaths(debug = false) {

    if (debug) console.log("STARTING: Search Path Parse");

    const regexpBucket = /s3:(.*):(.*)/;
    const regexpForge = /(.*assets\.forge\-vtt\.com\/)(\w+)\/(.*)/;
    const FORGE_ASSETS_LIBRARY_URL_PREFIX = "https://assets.forge-vtt.com/";

    const searchPathList = (game.settings.get("token-variants", "searchPaths") || []).flat();

    // To maintain compatibility with previous versions
    const defaultCaching = !game.settings.get("token-variants", "disableCaching");
    if(searchPathList.length > 0 && !(searchPathList[0] instanceof Object)){
        searchPathList.forEach((path, i) => {
            searchPathList[i] = {text: path, cache: defaultCaching};
        });
    }
    // end of compatibility code

    let searchPaths = new Map();
    searchPaths.set("data", []);
    searchPaths.set("s3", new Map());
    searchPaths.set("rolltable", []);

    let allForgePaths = [];

    for (const path of searchPathList) {
        if (path.text.startsWith("s3:")) {
            const match = path.text.match(regexpBucket);
            if (match[1]) {
                let bucket = match[1];
                let bPath = match[2];
                let buckets = searchPaths.get("s3");

                if (buckets.has(bucket)) {
                    buckets.get(bucket).push({text: bPath, cache: path.cache});
                } else {
                    buckets.set(bucket, [{text: bPath, cache: path.cache}]);
                }
            }
        } else if (path.text.startsWith("rolltable:")) {
            searchPaths.get("rolltable").push({text: path.text.split(':')[1], cache: path.cache});
        } else if (path.text.startsWith("forgevtt:") || path.text.startsWith(FORGE_ASSETS_LIBRARY_URL_PREFIX)) {
            let url = "";
            if(path.text.startsWith(FORGE_ASSETS_LIBRARY_URL_PREFIX)){
                url = path.text;
            } else if (typeof ForgeAPI !== 'undefined'){
                const status = ForgeAPI.lastStatus || await ForgeAPI.status().catch(console.error) || {};
                if(status.isAdmin){
                    url = FORGE_ASSETS_LIBRARY_URL_PREFIX + await ForgeAPI.getUserId() + "/" + path.text.split(":")[1];
                }
            }

            const match = url.match(regexpForge);
            if (match) {
                const userId = match[2];
                const fPath = match[3];
                if (typeof ForgeAPI !== 'undefined') {
                    if (userId == await ForgeAPI.getUserId()) {
                        try {
                            let files = await FilePicker.browse("forgevtt", `${FORGE_ASSETS_LIBRARY_URL_PREFIX}${userId}/${fPath}`, { recursive: true });
                            files.dirs.push(fPath);
                            allForgePaths = allForgePaths.concat(
                                files.dirs.map(p => {
                                    if (!p.endsWith('/')) p += "/";
                                    return {text: `${FORGE_ASSETS_LIBRARY_URL_PREFIX}${userId}/${p}*`, cache: path.cache}
                                })
                            );
                        } catch (err) {console.log(err)}
                    } else {
                        if (!url.endsWith('/')) url += "/";
                        allForgePaths.push({text: url + "*", cache: path.cache});
                    }
                }
            }
        } else {
            searchPaths.get("data").push({text: path.text, cache: path.cache});
        }
    }

    let forgePathsSetting = (game.settings.get("token-variants", "forgevttPaths") || []).flat();

    // To maintain compatibility with previous versions
    if(forgePathsSetting.length > 0 && !(forgePathsSetting[0] instanceof Object)){
        forgePathsSetting.forEach((path, i) => {
            forgePathsSetting[i] = {text: path, cache: defaultCaching};
        });
    }
    // end of compatibility code

    let uniqueForgePaths = new Set();
    forgePathsSetting.forEach(path => {
        uniqueForgePaths.add(path.text);
    })
    allForgePaths.forEach(path => {
        if(!uniqueForgePaths.has(path.text)){
            forgePathsSetting.push(path);
        }
    });

    searchPaths.set("forge", forgePathsSetting);
    if (game.user.can("SETTINGS_MODIFY"))
        game.settings.set("token-variants", "forgevttPaths", forgePathsSetting);

    searchPaths.set("forgevtt", await _parseForgeAssetPaths());

    if (debug) console.log("ENDING: Search Path Parse", searchPaths);

    return searchPaths;
}

/**
 * Parses the 'excludedKeyword' setting (a comma separated string) into a Set
 */
export function parseKeywords(keywords) {
    return keywords.split(/\W/).map(word => simplifyTokenName(word)).filter(word => word != "")
}

/**
 * Returns true of provided path points to an image
 */
export function isImage(path) {
    var extension = path.split('.')
    extension = extension[extension.length - 1]
    return ['jpg', 'jpeg', 'png', 'svg', 'webp'].includes(extension)
}

/**
 * Returns true of provided path points to a video
 */
export function isVideo(path) {
    var extension = path.split('.')
    extension = extension[extension.length - 1]
    return ['webm', 'mp4', 'm4v'].includes(extension)
}

export async function callForgeVTT(endpoint, formData, apiKey) {
    return new Promise(async (resolve, reject) => {
        if (typeof ForgeVTT === 'undefined' || (!ForgeVTT.usingTheForge && !endpoint))
            return resolve({});

        const url = `${ForgeVTT.FORGE_URL}/api/${endpoint}`;
        const xhr = new XMLHttpRequest();
        xhr.withCredentials = true;
        xhr.open('POST', url);
        xhr.setRequestHeader('Access-Key', apiKey);
        xhr.setRequestHeader('X-XSRF-TOKEN', await ForgeAPI.getXSRFToken());
        xhr.responseType = 'json';

        xhr.onreadystatechange = () => {
            if (xhr.readyState !== 4) return;
            resolve(xhr.response);
        };
        xhr.onerror = (err) => {
            resolve({ code: 500, error: err.message });
        };
        if (!(formData instanceof FormData)) {
            xhr.setRequestHeader('Content-type', 'application/json; charset=utf-8');
            formData = JSON.stringify(formData);
        }
        xhr.send(formData);
    });
}