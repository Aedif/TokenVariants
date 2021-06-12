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
    return tokenName.replace(/\W/g, '').toLowerCase();
}

/**
 * Parses the searchPaths setting into a Map, distinguishing s3 buckets from local paths
 */
export async function parseSearchPaths() {

    const regexpBucket = /s3:(.*):(.*)/;
    const regexpForge = /.*assets\.forge\-vtt\.com\/\w*\/.*/;
    let searchPathList = game.settings.get("token-variants", "searchPaths").flat();
    let searchPaths = new Map();
    searchPaths.set("data", []);
    searchPaths.set("s3", new Map());

    let allForgePaths = [];
    async function walkForgePaths(path, currDir) {
        allForgePaths.push(`${path}${currDir}/*`);
        let files;
        try {
            files = await FilePicker.browse("", path + currDir);
        } catch (err) {
            return;
        }

        if (files.target == ".") return;

        for (let dir of files.dirs) {
            if (dir !== currDir)
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
        } else {
            const match = path.match(regexpForge);
            if (match) {
                await walkForgePaths(path, "");
            } else {
                searchPaths.get("data").push(path);
            }
        }
    }

    let forgePathsSetting = game.settings.get("token-variants", "forgevttPaths").flat();
    searchPaths.set("forge", [...new Set(forgePathsSetting.concat(allForgePaths))]);
    if (game.user.can("SETTINGS_MODIFY"))
        game.settings.set("token-variants", "forgevttPaths", searchPaths.get("forge"));

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