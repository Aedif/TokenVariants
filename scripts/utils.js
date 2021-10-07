const simplifyRegex = new RegExp(/[^A-Za-z0-9/]/g);

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
    const regexpRollTable = /rolltable:(.*):(.*)/;
    const regexpForge = /(.*assets\.forge\-vtt\.com\/)(\w+)\/(.*)/;
    let searchPathList = game.settings.get("token-variants", "searchPaths").flat();
    let searchPaths = new Map();
    searchPaths.set("data", []);
    searchPaths.set("s3", new Map());
    searchPaths.set("rolltable", new Map());
    let allForgePaths = [];
    async function walkForgePaths(path, currDir) {
        let files;
        try {
            files = await FilePicker.browse(path, currDir, {});
            if (!currDir.endsWith('/')) currDir += "/";
            allForgePaths.push(`${path}${currDir}*`);
        } catch (err) {
            return;
        }

        if (files.target == ".") return;

        for (let dir of files.dirs) {
            await walkForgePaths(path, dir);
        }
    }

    for (const path of searchPathList) {
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
        }else if (path.startsWith("rolltable:")) {
            const match = path.match(regexpRollTable);
            if (match[1]) {
                let tableId = match[1];
                let tables = searchPaths.get("rolltable");
                const table = game.tables.get(tableId);
                if (!table){
                  ui.notifications.warn(game.i18n.format("token-variants.notifications.warn.invalidTable", { tableId }));
                } else {
                  // TODO ADD A RANDOMIZER ?
                  //const roll = await table.draw({
                  //	displayChat: "Here the roll text"
                  //});
                  // const result = roll.results[0];
                  for (let baseTableData of table.data) {
                    const path = baseTableData.data.img;
                    const name = baseTableData.data.text;
                    if (tables.has(name)) {
                      // DO NOTHING CAN't HAPPENED
                    } else {
                      tables.set(name, path);
                    }
                  }
                }
            }
        } else {
            const match = path.match(regexpForge);
            if (match) {
                const forgeURL = match[1];
                const userId = match[2];
                const fPath = match[3];
                if (typeof ForgeAPI !== 'undefined') {
                    if (userId == await ForgeAPI.getUserId()) {
                        await walkForgePaths(forgeURL + userId + "/", fPath);
                    } else {
                        allForgePaths.push(path + "/*");
                    }
                }
            } else {
                searchPaths.get("data").push(path);
            }
        }
    }

    let forgePathsSetting = (game.settings.get("token-variants", "forgevttPaths")).flat();
    for (let path of allForgePaths) {
        if (!forgePathsSetting.includes(path)) {
            forgePathsSetting.push(path);
        }
    }
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
