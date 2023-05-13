import { isInitialized } from '../token-variants.mjs';
import { Fuse } from './fuse/fuse.js';
import { getSearchOptions, TVA_CONFIG } from './settings.js';
import {
  callForgeVTT,
  flattenSearchResults,
  getFileName,
  getFileNameWithExt,
  getFilePath,
  getFilters,
  isImage,
  isVideo,
  parseKeywords,
  simplifyName,
  simplifyPath,
} from './utils.js';

// True if in the middle of caching image paths
let caching = false;
export function isCaching() {
  return caching;
}

// Cached images
let CACHED_IMAGES = {};

/**
 * @param {string} search Text to be used as the search criteria
 * @param {object} [options={}] Options which customize the search
 * @param {SEARCH_TYPE|string} [options.searchType] Controls filters applied to the search results
 * @param {Boolean} [options.simpleResults] Results will be returned as an array of all image paths found
 * @param {Function[]} [options.callback] Function to be called with the found images
 * @param {object} [options.searchOptions] Override search settings
 * @returns {Promise<Map<string, Array<object>|Array<string>>} All images found split by original criteria and keywords
 */
export async function doImageSearch(
  search,
  { searchType = SEARCH_TYPE.PORTRAIT_AND_TOKEN, simpleResults = false, callback = null, searchOptions = {} } = {}
) {
  if (caching) return;

  searchOptions = mergeObject(searchOptions, getSearchOptions(), { overwrite: false });

  search = search.trim();

  if (TVA_CONFIG.debug) console.log('STARTING: Art Search', search, searchType, searchOptions);

  let searches = [search];
  let allImages = new Map();
  const keywords = parseKeywords(searchOptions.excludedKeywords);

  if (searchOptions.keywordSearch) {
    searches = searches.concat(
      search
        .split(/[_\- :,\|\(\)\[\]]/)
        .filter((word) => word.length > 2 && !keywords.includes(word.toLowerCase()))
        .reverse()
    );
  }

  let usedImages = new Set();
  for (const search of searches) {
    if (allImages.get(search) !== undefined) continue;

    let results = await findImages(search, searchType, searchOptions);
    results = results.filter((pathObj) => !usedImages.has(pathObj));

    allImages.set(search, results);
    results.forEach(usedImages.add, usedImages);
  }

  if (TVA_CONFIG.debug) console.log('ENDING: Art Search');

  if (simpleResults) {
    allImages = Array.from(usedImages).map((obj) => obj.path);
  }

  if (callback) callback(allImages);
  return allImages;
}

/**
 * @param {*} search Text to be used as the search criteria
 * @param {object} [options={}] Options which customize the search
 * @param {SEARCH_TYPE|string} [options.searchType] Controls filters applied to the search results
 * @param {Actor} [options.actor] Used to retrieve 'shared' images from if enabled in the Randomizer Settings
 * @param {Function[]} [options.callback] Function to be called with the random image
 * @param {object} [options.searchOptions] Override search settings
 * @param {object} [options.randomizerOptions] Override randomizer settings. These take precedence over searchOptions
 * @returns Array<string>|null} Image path and name
 */
export async function doRandomSearch(
  search,
  {
    searchType = SEARCH_TYPE.PORTRAIT_AND_TOKEN,
    actor = null,
    callback = null,
    randomizerOptions = {},
    searchOptions = {},
  } = {}
) {
  if (caching) return null;

  const results = flattenSearchResults(
    await _randSearchUtil(search, {
      searchType: searchType,
      actor: actor,
      randomizerOptions: randomizerOptions,
      searchOptions: searchOptions,
    })
  );
  if (results.length === 0) return null;

  // Pick random image
  let randImageNum = Math.floor(Math.random() * results.length);
  if (callback) callback([results[randImageNum].path, results[randImageNum].name]);
  return [results[randImageNum].path, results[randImageNum].name];
}

export async function doSyncSearch(
  search,
  target,
  { searchType = SEARCH_TYPE.TOKEN, actor = null, randomizerOptions = {} } = {}
) {
  if (caching) return null;

  const results = flattenSearchResults(await _randSearchUtil(search, { searchType, actor, randomizerOptions }));

  // Find the image with the most similar name
  const fuse = new Fuse(results, {
    keys: ['name'],
    minMatchCharLength: 1,
    ignoreLocation: true,
    threshold: 0.4,
  });

  const fResults = fuse.search(target);

  if (fResults && fResults.length !== 0) {
    return [fResults[0].item.path, fResults[0].item.name];
  } else {
    return null;
  }
}

async function _randSearchUtil(
  search,
  { searchType = SEARCH_TYPE.PORTRAIT_AND_TOKEN, actor = null, randomizerOptions = {}, searchOptions = {} } = {}
) {
  const randSettings = mergeObject(randomizerOptions, TVA_CONFIG.randomizer, { overwrite: false });
  if (
    !(
      randSettings.tokenName ||
      randSettings.actorName ||
      randSettings.keywords ||
      randSettings.shared ||
      randSettings.wildcard
    )
  )
    return null;

  // Randomizer settings take precedence
  searchOptions.keywordSearch = randSettings.keywords;

  // Swap search to the actor name if need be
  if (randSettings.actorName && actor) {
    search = actor.name;
  }

  // Gather all images
  let results =
    randSettings.actorName || randSettings.tokenName || randSettings.keywords
      ? await doImageSearch(search, {
          searchType: searchType,
          searchOptions: searchOptions,
        })
      : new Map();

  if (!randSettings.tokenName && !randSettings.actorName) {
    results.delete(search);
  }
  if (randSettings.shared && actor) {
    let sharedVariants = actor.getFlag('token-variants', 'variants') || [];
    if (sharedVariants.length != 0) {
      const sv = [];
      sharedVariants.forEach((variant) => {
        variant.names.forEach((name) => {
          sv.push({ path: variant.imgSrc, name: name });
        });
      });
      results.set('variants95436723', sv);
    }
  }
  if (randSettings.wildcard && actor) {
    let protoImg = actor.prototypeToken.texture.src;
    if (protoImg.includes('*') || (protoImg.includes('{') && protoImg.includes('}'))) {
      // Modified version of Actor.getTokenImages()
      const getTokenImages = async (actor) => {
        if (actor._tokenImages) return actor._tokenImages;
        let source = 'data';
        const browseOptions = { wildcard: true };

        // Support non-user sources
        if (/\.s3\./.test(protoImg)) {
          source = 's3';
          const { bucket, keyPrefix } = FilePicker.parseS3URL(protoImg);
          if (bucket) {
            browseOptions.bucket = bucket;
            protoImg = keyPrefix;
          }
        } else if (protoImg.startsWith('icons/')) source = 'public';

        // Retrieve wildcard content
        try {
          const content = await FilePicker.browse(source, protoImg, browseOptions);
          return content.files;
        } catch (err) {
          return [];
        }
      };

      const wildcardImages = (await getTokenImages(actor))
        .filter((img) => !img.includes('*') && (isImage(img) || isVideo(img)))
        .map((variant) => {
          return { path: variant, name: getFileName(variant) };
        });
      results.set('variants95436623', wildcardImages);
    }
  }

  return results;
}

/**
 * Recursive image search through a directory
 * @param {*} path starting path
 * @param {*} options.apiKey ForgeVTT AssetLibrary API key
 * @param {*} found_images all the images found
 * @returns void
 */
async function walkFindImages(path, { apiKey = '' } = {}, found_images) {
  let files = {};
  if (!path.source) {
    path.source = 'data';
  }
  const typeKey = path.types.sort().join(',');
  try {
    if (path.source.startsWith('s3:')) {
      files = await FilePicker.browse('s3', path.text, {
        bucket: path.source.replace('s3:', ''),
      });
    } else if (path.source.startsWith('forgevtt')) {
      if (apiKey) {
        const response = await callForgeVTT(path.text, apiKey);
        files.files = response.files.map((f) => f.url);
      } else {
        files = await FilePicker.browse('forgevtt', path.text, { recursive: true });
      }
    } else if (path.source.startsWith('forge-bazaar')) {
      files = await FilePicker.browse('forge-bazaar', path.text, { recursive: true });
    } else if (path.source.startsWith('imgur')) {
      await fetch('https://api.imgur.com/3/gallery/album/' + path.text, {
        headers: {
          Authorization: 'Client-ID ' + (TVA_CONFIG.imgurClientId ? TVA_CONFIG.imgurClientId : 'df9d991443bb222'),
          Accept: 'application/json',
        },
      })
        .then((response) => response.json())
        .then(async function (result) {
          if (!result.success) {
            return;
          }
          result.data.images.forEach((img) => {
            const rtName = img.title ?? img.description ?? getFileName(img.link);
            _addToFound({ path: decodeURI(img.link), name: rtName }, typeKey, found_images);
          });
        })
        .catch((error) => console.log('Token Variant Art: ', error));
      return;
    } else if (path.source.startsWith('rolltable')) {
      const table = game.tables.contents.find((t) => t.name === path.text);
      if (!table) {
        const rollTableName = path.text;
        ui.notifications.warn(
          game.i18n.format('token-variants.notifications.warn.invalid-table', {
            rollTableName,
          })
        );
      } else {
        for (let baseTableData of table.results) {
          const rtPath = baseTableData.img;
          const rtName = baseTableData.text || getFileName(rtPath);
          _addToFound({ path: decodeURI(rtPath), name: rtName }, typeKey, found_images);
        }
      }
      return;
    } else if (path.source.startsWith('json')) {
      await fetch(path.text, {
        headers: {
          Accept: 'application/json',
        },
      })
        .then((response) => response.json())
        .then(async function (result) {
          if (!result.length > 0) {
            return;
          }
          result.forEach((img) => {
            const rtName = img.name ?? getFileName(img.path);
            _addToFound({ path: decodeURI(img.path), name: rtName, tags: img.tags }, typeKey, found_images);
          });
        })
        .catch((error) => console.log('Token Variant Art: ', error));
      return;
    } else {
      files = await FilePicker.browse(path.source, path.text);
    }
  } catch (err) {
    console.log(
      `Token Variant Art | ${game.i18n.localize('token-variants.notifications.warn.path-not-found')} ${path.source}:${
        path.text
      }`
    );
    return;
  }

  if (files.target == '.') return;

  if (files.files) {
    files.files.forEach((tokenSrc) => {
      _addToFound({ path: decodeURI(tokenSrc), name: getFileName(tokenSrc) }, typeKey, found_images);
    });
  }

  // ForgeVTT requires special treatment
  // Bazaar paths fail recursive search if one level above root
  if (path.source.startsWith('forgevtt')) return;
  else if (
    path.source.startsWith('forge-bazaar') &&
    !['modules', 'systems', 'worlds', 'assets'].includes(path.text.replaceAll(/[\/\\]/g, ''))
  ) {
    return;
  }

  for (let f_dir of files.dirs) {
    await walkFindImages({ text: f_dir, source: path.source, types: path.types }, { apiKey: apiKey }, found_images);
  }
}

function _addToFound(img, typeKey, found_images) {
  if (isImage(img.path) || isVideo(img.path)) {
    if (found_images[typeKey] == null) {
      found_images[typeKey] = [img];
    } else {
      found_images[typeKey].push(img);
    }
  }
}

/**
 * Recursive walks through all paths exposed to the module and caches them
 * @param {*} searchType
 * @returns
 */
async function walkAllPaths(searchType) {
  const found_images = {};
  const paths = _filterPathsByType(TVA_CONFIG.searchPaths, searchType);

  for (const path of paths) {
    if ((path.cache && caching) || (!path.cache && !caching)) await walkFindImages(path, {}, found_images);
  }

  // ForgeVTT specific path handling
  const userId = typeof ForgeAPI !== 'undefined' ? await ForgeAPI.getUserId() : '';
  for (const uid in TVA_CONFIG.forgeSearchPaths) {
    const apiKey = TVA_CONFIG.forgeSearchPaths[uid].apiKey;
    const paths = _filterPathsByType(TVA_CONFIG.forgeSearchPaths[uid].paths, searchType);
    if (uid === userId) {
      for (const path of paths) {
        if ((path.cache && caching) || (!path.cache && !caching)) await walkFindImages(path, {}, found_images);
      }
    } else if (apiKey) {
      for (const path of paths) {
        if ((path.cache && caching) || (!path.cache && !caching)) {
          if (path.share) await walkFindImages(path, { apiKey: apiKey }, found_images);
        }
      }
    }
  }

  return found_images;
}

function _filterPathsByType(paths, searchType) {
  if (!searchType) return paths;
  return paths.filter((p) => p.types.includes(searchType));
}

export async function findImagesFuzzy(name, searchType, searchOptions, forceSearchName = false) {
  if (TVA_CONFIG.debug) console.log('STARTING: Fuzzy Image Search', name, searchType, searchOptions, forceSearchName);

  const filters = getFilters(searchType, searchOptions.searchFilters);

  const fuse = new Fuse([], {
    keys: [!forceSearchName && searchOptions.runSearchOnPath ? 'path' : 'name', 'tags'],
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 1,
    ignoreLocation: true,
    threshold: searchOptions.algorithm.fuzzyThreshold,
  });

  const found_images = await walkAllPaths(searchType);

  for (const container of [CACHED_IMAGES, found_images]) {
    for (const typeKey in container) {
      const types = typeKey.split(',');
      if (types.includes(searchType)) {
        for (const imgObj of container[typeKey]) {
          if (_imagePassesFilter(imgObj.name, imgObj.path, filters, searchOptions.runSearchOnPath)) {
            fuse.add(imgObj);
          }
        }
      }
    }
  }

  let results;
  if (name === '') {
    results = fuse.getIndex().docs.slice(0, searchOptions.algorithm.fuzzyLimit);
  } else {
    results = fuse.search(name).slice(0, searchOptions.algorithm.fuzzyLimit);
    results = results.map((r) => {
      r.item.indices = r.matches[0].indices;
      r.item.score = r.score;
      return r.item;
    });
  }

  if (TVA_CONFIG.debug) console.log('ENDING: Fuzzy Image Search', results);

  return results;
}

async function findImagesExact(name, searchType, searchOptions) {
  if (TVA_CONFIG.debug) console.log('STARTING: Exact Image Search', name, searchType, searchOptions);

  const found_images = await walkAllPaths(searchType);

  const simpleName = simplifyName(name);
  const filters = getFilters(searchType, searchOptions.searchFilters);

  const matchedImages = [];

  for (const container of [CACHED_IMAGES, found_images]) {
    for (const typeKey in container) {
      const types = typeKey.split(',');
      if (types.includes(searchType)) {
        for (const imgOBj of container[typeKey]) {
          if (_exactSearchMatchesImage(simpleName, imgOBj.path, imgOBj.name, filters, searchOptions.runSearchOnPath)) {
            matchedImages.push(imgOBj);
          }
        }
      }
    }
  }

  if (TVA_CONFIG.debug) console.log('ENDING: Exact Image Search', matchedImages);
  return matchedImages;
}

async function findImages(name, searchType = '', searchOptions = {}) {
  const sOptions = mergeObject(searchOptions, getSearchOptions(), { overwrite: false });
  if (sOptions.algorithm.exact) {
    return await findImagesExact(name, searchType, sOptions);
  } else {
    return await findImagesFuzzy(name, searchType, sOptions);
  }
}

/**
 * Checks if image path and name match the provided search text and filters
 * @param imagePath image path
 * @param imageName image name
 * @param filters filters to be applied
 * @returns true|false
 */
function _exactSearchMatchesImage(simplifiedSearch, imagePath, imageName, filters, runSearchOnPath) {
  // Is the search text contained in the name/path
  const simplified = runSearchOnPath ? simplifyPath(imagePath) : simplifyName(imageName);
  if (!simplified.includes(simplifiedSearch)) {
    return false;
  }

  if (!filters) return true;
  return _imagePassesFilter(imageName, imagePath, filters, runSearchOnPath);
}

function _imagePassesFilter(imageName, imagePath, filters, runSearchOnPath) {
  // Filters are applied to path depending on the 'runSearchOnPath' setting, and actual or custom rolltable name
  let text;
  if (runSearchOnPath) {
    text = decodeURIComponent(imagePath);
  } else if (getFileName(imagePath) === imageName) {
    text = getFileNameWithExt(imagePath);
  } else {
    text = imageName;
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

// ===================================
// ==== CACHING RELATED FUNCTIONS ====
// ===================================

export async function saveCache(cacheFile) {
  const data = {};

  const caches = Object.keys(CACHED_IMAGES);
  for (const c of caches) {
    if (!(c in data)) data[c] = [];
    for (const img of CACHED_IMAGES[c]) {
      if (img.tags) {
        data[c].push([img.path, img.name, img.tags]);
      } else if (getFileName(img.path) === img.name) {
        data[c].push(img.path);
      } else {
        data[c].push([img.path, img.name]);
      }
    }
  }

  let file = new File([JSON.stringify(data)], getFileNameWithExt(cacheFile), {
    type: 'text/plain',
  });
  FilePicker.upload('data', getFilePath(cacheFile), file);
}

/**
 * Search for and cache all the found token art
 */
export async function cacheImages({
  staticCache = TVA_CONFIG.staticCache,
  staticCacheFile = TVA_CONFIG.staticCacheFile,
} = {}) {
  if (caching) return;
  caching = true;

  if (!isInitialized() && staticCache) {
    if (await _readCacheFromFile(staticCacheFile)) {
      caching = false;
      return;
    }
  }

  if (!TVA_CONFIG.disableNotifs)
    ui.notifications.info(game.i18n.format('token-variants.notifications.info.caching-started'));

  if (TVA_CONFIG.debug) console.log('STARTING: Token Caching');
  const found_images = await walkAllPaths();
  CACHED_IMAGES = found_images;

  if (TVA_CONFIG.debug) console.log('ENDING: Token Caching');

  caching = false;
  if (!TVA_CONFIG.disableNotifs)
    ui.notifications.info(
      game.i18n.format('token-variants.notifications.info.caching-finished', {
        imageCount: Object.keys(CACHED_IMAGES).reduce((count, types) => count + CACHED_IMAGES[types].length, 0),
      })
    );

  if (staticCache && game.user.isGM) {
    saveCache(staticCacheFile);
  }
}

async function _readCacheFromFile(fileName) {
  CACHED_IMAGES = {};
  try {
    await jQuery.getJSON(fileName, (json) => {
      for (let category in json) {
        CACHED_IMAGES[category] = [];

        for (const img of json[category]) {
          if (Array.isArray(img)) {
            if (img.length === 3) {
              CACHED_IMAGES[category].push({ path: img[0], name: img[1], tags: img[2] });
            } else {
              CACHED_IMAGES[category].push({ path: img[0], name: img[1] });
            }
          } else {
            CACHED_IMAGES[category].push({ path: img, name: getFileName(img) });
          }
        }
      }
      if (!TVA_CONFIG.disableNotifs)
        ui.notifications.info(
          `Token Variant Art: Using Static Cache (${Object.keys(CACHED_IMAGES).reduce(
            (count, c) => count + CACHED_IMAGES[c].length,
            0
          )} images)`
        );
    });
  } catch (error) {
    ui.notifications.warn(`Token Variant Art: Static Cache not found`);
    CACHED_IMAGES = {};
    return false;
  }
  return true;
}
