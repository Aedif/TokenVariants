const simplifyRegex = new RegExp(/[^A-Za-z0-9/]/g);

/**
 * Retrieves a custom token configuration if one exists for the given image
 */
export function getTokenConfig(imgSrc, name){
    const tokenConfigs = game.settings.get("token-variants", "tokenConfigs");
    return tokenConfigs.find(config => config.imgSrc == imgSrc && config.name == name);
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

/**
 * Parses the searchPaths setting into a Map, distinguishing s3 buckets from local paths
 */
export async function parseSearchPaths(debug = false) {

    if (debug) console.log("STARTING: Search Path Parse");

    const regexpBucket = /s3:(.*):(.*)/;
    const regexpRollTable = /rolltable:(.*)/;
    const regexpForge = /(.*assets\.forge\-vtt\.com\/)(\w+)\/(.*)/;

    let searchPathList = game.settings.get("token-variants", "searchPaths");

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
    async function walkForgePaths(path, currDir, cache) {
        let files;
        try {
            files = await FilePicker.browse(path, currDir, {});
            if (!currDir.endsWith('/')) currDir += "/";
            allForgePaths.push({text: `${path}${currDir}*`, cache: cache});
        } catch (err) {
            return;
        }

        if (files.target == ".") return;

        for (let dir of files.dirs) {
            await walkForgePaths(path, dir, cache);
        }
    }

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
        }else if (path.text.startsWith("rolltable:")) {
            const match = path.text.match(regexpRollTable);
            if (match[0]) {
                let tableId = match[0].split(":")[1];
                searchPaths.get("rolltable").push({text: tableId, cache: path.cache});
            }
        } else {
            const match = path.text.match(regexpForge);
            if (match) {
                const forgeURL = match[1];
                const userId = match[2];
                const fPath = match[3];
                if (typeof ForgeAPI !== 'undefined') {
                    if (userId == await ForgeAPI.getUserId()) {
                        await walkForgePaths(forgeURL + userId + "/", fPath, path.cache);
                    } else {
                        allForgePaths.push({text: path.text + "/*", cache: path.cache});
                    }
                }
            } else {
                searchPaths.get("data").push({text: path.text, cache: path.cache});
            }
        }
    }

    let forgePathsSetting = (game.settings.get("token-variants", "forgevttPaths")).flat();

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
            forgePathsSetting.push(path.text);
        }
    })

    searchPaths.set("forge", forgePathsSetting);
    if (game.user.can("SETTINGS_MODIFY"))
        game.settings.set("token-variants", "forgevttPaths", forgePathsSetting);

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
