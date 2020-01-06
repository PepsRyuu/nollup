let fs = require('fs');
let path = require('path');
let PluginContext = require('./PluginContext');
let { resolvePath, combineSourceMapChain } = require('./utils');

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
async function callPluginCompileMethod (context, current_filepath, method, ...args) {
    let { plugins } = context;

    for (let i = 0; i < plugins.length; i++) {
        // TODO: Transform doesn't have the null check
        let thisValue = plugins[i].__context;
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
    let result = await callPluginCompileMethod(context, current, 'resolveId', target, current);

    // Explicitly checked for so that modules can be excluded.
    if (result === false) {
        return false;
    }

    if (typeof result === 'string') {
        result = {
            id: path.normalize(result),
            external: false
        };
    }

    if (!result) {
        result = {
            id: path.normalize(resolvePath(target, current)),
            external: false
        };
    }

    return handleCommonLifecycleOptions(context, result);
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
    let result = await callPluginCompileMethod(context, current, 'resolveDynamicImport', target, current);

    // Explicitly checked for so that modules can be excluded.
    if (result === false || (typeof result === 'object' && result.external)) {
        return false;
    }

    if (typeof result === 'string') {
        return { id: result };
    }

    if (typeof result === 'object') {
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
    let hr = await callPluginCompileMethod(context, current, 'load', target);

    if (typeof hr === 'string') {
        return { code: hr };
    }

    if (typeof hr === 'object' && hr.code) {
        return handleCommonLifecycleOptions(context, hr);
    }

    if (!hr || hr.code) {
        return {
            code: fs.readFileSync(target, 'utf8')
        };
    }
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
    let map, transpiled_code = original_code, mapChain = [], syntheticNamedExports;

    for (let i = 0; i < plugins.length; i++) {
        let thisValue = plugins[i].__context;
        thisValue.__mapChain = mapChain;
        thisValue.__original_code = original_code
        let result = await callPluginMethod(thisValue, plugins[i], 'transform', transpiled_code, filepath);
        
        if (result !== undefined && result !== null) {
            transpiled_code = typeof result === 'object'? result.code : result;

            mapChain.push({ 
                code: transpiled_code, 
                map: result.map 
            });
        }


        if (result && result.syntheticNamedExports) {
            syntheticNamedExports = true;
        }

        delete thisValue.__mapChain;
    }

    map = combineSourceMapChain(mapChain, original_code, filepath);
    
    return handleCommonLifecycleOptions(context, { code: transpiled_code, map, syntheticNamedExports });
}

function resolveFileUrl (context, prop, id, fileName) {
    let { plugins } = context;

    for (let i = 0; i < plugins.length; i++) {
        let plugin = plugins[i];
        let thisValue = plugin.__context;
        if (plugin.resolveFileUrl) {
            let result = plugin.resolveFileUrl({
                assetReferenceId: prop === 'ROLLUP_ASSET_URL_'? id : null,
                chunkId: thisValue.__current_chunk,
                chunkReferenceId: prop === 'ROLLUP_CHUNK_URL_'? id : null,
                fileName: fileName,
                format: context.output.format,
                moduleId: thisValue.__current_filepath,
                referenceId: id,
                relativePath: fileName

            });
            if (result) {
                return result;
            }
        }
    }
}

function resolveImportMeta (context, prop) {
    let { plugins } = context;

    for (let i = 0; i < plugins.length; i++) {
        let plugin = plugins[i];
        let thisValue = plugin.__context;
        if (plugin.resolveImportMeta) {
            let result = plugin.resolveImportMeta(prop, {
                chunkId: thisValue.__current_chunk,
                format: context.output.format,
                moduleId: thisValue.__current_filepath
            });
            if (result) {
                return result;
            }
        }
    }
}

function setCurrentChunk (context, chunk) {
    context.plugins.forEach(p => {
        p.__context.__current_chunk = chunk;
    });
}

function getCurrentChunk (context) {
    if (context.plugins.length > 0) {
        return context.plugins[0].__context.__current_chunk;
    }

    return '';
}

function setCurrentFile (context, file) {
    context.plugins.forEach(p => {
        p.__context.__current_filepath = file;
    });
}

function getCurrentFile (context) {
    if (context.plugins.length > 0) {
        return context.plugins[0].__context.__current_filepath;
    }

    return '';
}

function handleCommonLifecycleOptions (context, result) {
    let filepath = getCurrentFile(context);
    if (result.syntheticNamedExports) {
        context.files[filepath].syntheticNamedExports = true;
    }

    return result;
}

module.exports = {
    callPluginMethod,
    callPluginTextMethod,
    callPluginCompileMethod,
    resolveId,
    resolveDynamicImport,
    resolveFileUrl,
    resolveImportMeta,
    load,
    transform,
    setCurrentFile,
    getCurrentFile,
    setCurrentChunk,
    getCurrentChunk
}