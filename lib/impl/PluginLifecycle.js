let fs = require('fs');
let path = require('path');
let SourceMap = require('source-map');
let PluginContext = require('./PluginContext');
let { resolvePath } = require('./utils');

/**
 * Calls the specified method on the plugin 
 * returning it's output when resolved.
 *
 * @method callPluginMethod
 * @param {Plugin} plugin
 * @param {String} method
 * @param {...} args
 * @return {Promise}
 */
async function callPluginMethod (thisValue, plugin, method, ...args) {
    if (plugin[method]) {
        let value;

        if (typeof plugin[method] === 'string') {
            value = plugin[method];
        } else {
            let hr = plugin[method].call(thisValue, ...args);
            if (hr instanceof Promise) {
                value = await hr;
            } else {
                value = hr;
            }
        }

        return value;
    }
}

/**
 * For 'intro', 'outro', 'banner', and 'footer' hooks.
 * Calls them, and when resolved contains a string.
 *
 * @method callPluginTextMethod
 * @param {Context} context
 * @param {String} method
 * @return {Promise}
 */
async function callPluginTextMethod (context, method) {
    let { plugins } = context;
    let output = '';

    for (let i = 0; i < plugins.length; i++) {
        let value = await callPluginMethod(null, plugins[i], method);

        if (value) {
            output += '\n' + value;
        }
    }

    return output;
}

/**
 * For 'load', and 'resolveId' hooks.
 * Calls them, and when resolved contains their output.
 *
 * @method callPluginCompileMethod
 * @param {Context} context,
 * @param {String} method
 * @param {...} args
 * @return {Promise}
 */
async function callPluginCompileMethod (context, thisValue, method, ...args) {
    let { plugins } = context;

    for (let i = 0; i < plugins.length; i++) {
        // TODO: Transform doesn't have the null check
        let value = await callPluginMethod(thisValue, plugins[i], method, ...args);
        
        if (value !== null && value !== undefined) {
            return value;
        }
    }
}

/**
 * Resolve the target dependency path relative to the current file.
 * If a hook provides a result, that result is returned instead.
 *
 * @method resolveId
 * @param {Context} context
 * @param {String} target
 * @param {String} current
 * @return {Promise}
 */
async function resolveId (context, target, current) {
    let result = await callPluginCompileMethod(context, PluginContext.create(context, current), 'resolveId', target, current);

    // Explicitly checked for so that modules can be excluded.
    if (result === false) {
        return false;
    }

    if (typeof result === 'object') {
        result = result.id;
    }

    result = result || resolvePath(target, current);
    return path.normalize(result);
}

/**
 * Resolve the target dependency path relative to the current file.
 * If a hook provides a result, that result is returned instead.
 *
 * @method resolveId
 * @param {Context} context
 * @param {String} target
 * @param {String} current
 * @return {Promise}
 */
async function resolveDynamicImport (context, target, current) {
    let result = await callPluginCompileMethod(context, PluginContext.create(context, current), 'resolveDynamicImport', target, current);

    // Explicitly checked for so that modules can be excluded.
    if (result === false) {
        return false;
    }

    if (result) {
        return result;
    }

    return resolveId(context, target, current);
}

/**
 * Load the target file from disk. 
 * If a hook provides a result, that's returned instead.
 *
 * @method load
 * @param {Context} context,
 * @param {String} target
 * @param {String} current
 * @return {Promise}
 */
async function load (context, target, current) {
    let hr = await callPluginCompileMethod(context, PluginContext.create(context, current), 'load', target);

    // TODO: Support load maps
    if (hr && hr.code) {
        hr = hr.code;
    }

    return hr || fs.readFileSync(target, 'utf8');
}

/**
 * If a hook has a transform method, the code is transformed using that hook.
 * If there isn't any, the code is returned wrapped in an object.
 *
 * @method transform
 * @param {Context} context
 * @param {String} code
 * @param {String} filepath
 * @return {Promise}
 */
async function transform (context, original_code, filepath) {
    let { plugins } = context;
    let map, transpiled_code = original_code, mapChain = [];

    for (let i = 0; i < plugins.length; i++) {
        let result = await callPluginMethod(PluginContext.create(context, filepath), plugins[i], 'transform', transpiled_code, filepath);
        
        if (result !== undefined && result !== null) {
            transpiled_code = typeof result === 'object'? result.code : result;

            mapChain.push({ 
                code: transpiled_code, 
                map: result.map 
            });
        }
    }

    // TODO: Proper handling of null maps.
    mapChain = mapChain.filter(o => o.map && o.map.mappings).reverse();

    if (mapChain.length > 1) {
        // TODO: This routine is quite slow. Need to figure out how to speed it up.
        mapChain.forEach((obj, index) => {
            obj.version = 3;
            obj.map.file = filepath + '_' + index;
            obj.map.sources = [filepath + '_' + (index + 1)]
            obj.map.sourcesContent = [mapChain[index + 1]? mapChain[index + 1].code : original_code];
        });

        let mapGenerator = SourceMap.SourceMapGenerator.fromSourceMap(new SourceMap.SourceMapConsumer(mapChain[0].map));

        for (let i = 1; i < mapChain.length; i++) {
            mapGenerator.applySourceMap(new SourceMap.SourceMapConsumer(mapChain[i].map))
        }

        map = mapGenerator.toJSON();

        // Remove irrelevant maps.
        map.sources = map.sources.map((s, i) => i !== map.sources.length - 1? '' : s);
        map.sourcesContent = map.sourcesContent.map((s, i) => i !== map.sourcesContent.length - 1? '' : s);
    } else {
        map = mapChain.length > 0? mapChain[0].map : undefined;
    }   

    
    return { code: transpiled_code, map };
}

module.exports = {
    callPluginMethod,
    callPluginTextMethod,
    callPluginCompileMethod,
    resolveId,
    resolveDynamicImport,
    load,
    transform
}