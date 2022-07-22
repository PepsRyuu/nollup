// @ts-check
let SourceMap = require('source-map');
let SourceMapFast = require('source-map-fast');
let PluginContainer = require('./PluginContainer');

/**
 * @param {NollupTransformMapEntry[]} mapChain 
 * @param {string} original_code 
 * @param {string} filepath 
 * @return {NollupTransformMapEntry[]}
 */
function prepareSourceMapChain (mapChain, original_code, filepath) {
    mapChain = mapChain.filter(o => o.map && o.map.mappings).reverse();

    if (mapChain.length > 1) {
        mapChain.forEach((obj, index) => {
            obj.map.version = 3;
            obj.map.file = filepath + '_' + index;
            // Check is in place because some transforms return sources, in particular multi-file sources.
            obj.map.sources = obj.map.sources.length === 1? [filepath + '_' + (index + 1)] : obj.map.sources;
            if(obj.map.sourcesContent && obj.map.sourcesContent.length === 1) {
                obj.map.sourcesContent = [mapChain[index + 1] ? mapChain[index + 1].code : original_code]
            }
        });
    }

    return mapChain;
}

/**
 * @param {NollupTransformMapEntry[]} mapChain 
 * @param {SourceMapGenerator} mapGenerator 
 * @param {string} original_code 
 * @param {string} filepath 
 * @return {RollupSourceMap}
 */
function generateSourceMap (mapChain, mapGenerator, original_code, filepath) {
    let map;

    if (mapChain.length > 1) {
        // @ts-ignore
        map = mapGenerator.toJSON();
    } else {
        map = mapChain.length > 0? mapChain[0].map : undefined;
    }

    if (map) {
        map.file = filepath;
        map.sources = [filepath];
        map.sourcesContent = [original_code];
    }

    // @ts-ignore
    return map;
}

/**
 * @param {NollupTransformMapEntry[]} inputMapChain 
 * @param {string} original_code 
 * @param {string} filepath 
 * @return {RollupSourceMap}
 */
function combineSourceMapChain (inputMapChain, original_code, filepath) {
    let mapGenerator, mapChain = prepareSourceMapChain(inputMapChain, original_code, filepath);

    if (mapChain.length > 1) {
        // @ts-ignore
        mapGenerator = SourceMap.SourceMapGenerator.fromSourceMap(new SourceMap.SourceMapConsumer(mapChain[0].map));

        for (let i = 1; i < mapChain.length; i++) {
            // @ts-ignore
            mapGenerator.applySourceMap(new SourceMap.SourceMapConsumer(mapChain[i].map), undefined, undefined);
        }
    } 

    return generateSourceMap(mapChain, mapGenerator, original_code, filepath);
}

/**
 * @param {NollupTransformMapEntry[]} inputMapChain 
 * @param {string} original_code 
 * @param {string} filepath 
 * @return {Promise<RollupSourceMap>}
 */
async function combineSourceMapChainFast (inputMapChain, original_code, filepath) {
    let mapGenerator, mapChain = prepareSourceMapChain(inputMapChain, original_code, filepath);

    if (mapChain.length > 1) {
        mapGenerator = SourceMapFast.SourceMapGenerator.fromSourceMap(await new SourceMapFast.SourceMapConsumer(mapChain[0].map));

        for (let i = 1; i < mapChain.length; i++) {
            mapGenerator.applySourceMap(await new SourceMapFast.SourceMapConsumer(mapChain[i].map))
        }
    }
    
    return generateSourceMap(mapChain, mapGenerator, original_code, filepath);
}


/** 
 * @param {PluginContainer} container 
 * @param {string} id 
 * @return {RollupModuleInfo}
 */
function getModuleInfo (container, id) {
    let response = container.__onGetModuleInfo(id);

    return {
        id: id,
        code: response.code || null,
        isEntry: response.isEntry || false,
        isExternal: response.isExternal || false,
        importers: response.importers || [],
        importedIds: response.importedIds || [],
        importedIdResolutions: response.importedIdResolutions || [],
        meta: container.__meta[id] || {},
        dynamicImporters: response.dynamicImporters || [],
        dynamicallyImportedIds: response.dynamicallyImportedIds || [],
        dynamicallyImportedIdResolutions: response.dynamicallyImportedIdResolutions || [],
        ast: response.ast || null,
        hasModuleSideEffects: response.hasModuleSideEffects || false,
        syntheticNamedExports: response.syntheticNamedExports || false,
        implicitlyLoadedAfterOneOf: response.implicitlyLoadedAfterOneOf || [],
        implicitlyLoadedBefore: response.implicitlyLoadedBefore || [],
        hasDefaultExport: response.hasDefaultExport,
        isIncluded: response.isIncluded || false,
        moduleSideEffects: response.moduleSideEffects || true
    }
}

module.exports = { combineSourceMapChain, combineSourceMapChainFast, getModuleInfo }