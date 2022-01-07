// @ts-check
let fs = require('fs');
let path = require('path');
let { resolvePath } = require('./utils');
let { combineSourceMapChainFast, getModuleInfo } = require('./PluginUtils');
let PluginContainer = require('./PluginContainer');
const RollupConfigContainer = require('./RollupConfigContainer');


/**
 * @param {NollupInternalPluginWrapper} plugin 
 * @param {string} hook 
 * @param {any[]} args
 * @return {Promise<any>} 
 */
async function _callAsyncHook (plugin, hook, args) {
    if (typeof plugin.execute[hook] === 'string') {
        return plugin.execute[hook];
    }

    if (plugin.execute[hook]) { 
        let hr = plugin.execute[hook].apply(plugin.context, args);
        
        if (hr instanceof Promise) {
            return (await plugin.error.wrapAsync(hr));
        }

        return hr;
    }
}

/**
 * @param {NollupInternalPluginWrapper} plugin 
 * @param {string} hook 
 * @param {any[]} args 
 * @return {any}
 */
function _callSyncHook (plugin, hook, args) {
    if (plugin.execute[hook]) { 
        return plugin.execute[hook].apply(plugin.context, args);
    }
}

/**
 * @param {PluginContainer} container 
 * @param {string} hook 
 * @param {any[]} args 
 * @return {Promise<any>}
 */
async function callAsyncFirstHook (container, hook, args) {
    // hook may return a promise.
    // waits for hook to return value other than null or undefined.
    for (let i = 0; i < container.__plugins.length; i++) {
        let hr = await _callAsyncHook(container.__plugins[i], hook, args);

        if (hr !== null && hr !== undefined) {
            return hr;
        }
    } 
}

/**
 * @param {PluginContainer} container 
 * @param {string} hook 
 * @param {function} toArgs 
 * @param {function} fromResult 
 * @param {any} start 
 * @return {Promise}
 */
async function callAsyncSequentialHook (container, hook, toArgs, fromResult, start) {
    // hook may return a promise.
    // all plugins that implement this hook will run, passing data onwards
    let output = start;

    for (let i = 0; i < container.__plugins.length; i++) {
        let args = toArgs(output);
        let hr = await _callAsyncHook(container.__plugins[i], hook, args);

        if (hr !== null && hr !== undefined) {
            output = fromResult(hr, output);
        }
    }

    return output;
}

/**
 * @param {PluginContainer} container 
 * @param {string} hook 
 * @param {any[]} args 
 * @return {Promise}
 */
async function callAsyncParallelHook (container, hook, args) {
    // hooks may return promises.
    // all hooks are executed at the same time without waiting
    // will wait for all hooks to complete before returning
    let hookResults = [];

    for (let i = 0; i < container.__plugins.length; i++) {
        hookResults.push(_callAsyncHook(container.__plugins[i], hook, args));
    }

    return Promise.all(hookResults);
}

/**
 * @param {PluginContainer} container 
 * @param {string} hook 
 * @param {any[]} args 
 * @return {any}
 */
function callSyncFirstHook (container, hook, args) {
    // waits for hook to return value other than null of undefined
    for (let i = 0; i < container.__plugins.length; i++) {
        let hr = _callSyncHook(container.__plugins[i], hook, args);

        if (hr !== null && hr !== undefined) {
            return hr;
        }
    } 
}

/**
 * @param {PluginContainer} container 
 * @param {string} hook 
 * @param {any[]} args
 * @return {any} 
 */
function callSyncSequentialHook (container, hook, args) {
    // all plugins that implement this hook will run, passing data onwards
    let output = args[0];

    for (let i = 0; i < container.__plugins.length; i++) {
        let hr = _callSyncHook(container.__plugins[i], hook, [output]);
        if (hr !== null && hr !== undefined) {
            output = hr;
        }
    }

    return output;
}

/**
 * @param {PluginContainer} container 
 * @param {string} filePath 
 * @param {Object} meta 
 */
function handleMetaProperty (container, filePath, meta) {
    if (meta) {
        let fileMeta = container.__meta[filePath];
        if (!fileMeta) {
            fileMeta = {};
            container.__meta[filePath] = fileMeta;
        }
        

        for (let prop in meta) {
            fileMeta[prop] = meta[prop];
        }
    }
}

/**
 * @param {string} name 
 * @param {any[]} args 
 */
function triggerNotImplemented(name, args) {
    let error = `"${name}" not implemented`;
    console.error(error, args);
    throw new Error(error);
}

/**
 * @param {RollupConfigContainer} config 
 * @param {string} name 
 * @return {boolean}
 */
function isExternal (config, name) {
    if (config && config.external) {
        let external = config.external;
        if (Array.isArray(external)) {
            return external.indexOf(name) > -1;
        }

        if (typeof external === 'function') {
            return external(name, undefined, undefined);
        }
    }

    return false;
}

const PluginLifecycle = {
    /**
     * @param {PluginContainer} container 
     * @param {string} id 
     * @param {string} parentFilePath 
     * @return {Promise<RollupResolveIdResult>}
     */
    async resolveIdImpl (container, id, parentFilePath, options = {}) {
        options.isEntry = options.isEntry || false;
        options.custom = options.hasOwnProperty('custom')? options.custom : {};

        let __plugins = container.__plugins.filter(p => !this.resolveIdSkips.contains(p.execute, parentFilePath, id));
        let hr = await callAsyncFirstHook(/** @type {PluginContainer} */ ({ __plugins, __config: container.__config }), 'resolveId', [id, parentFilePath, options]);

        if (hr === false || isExternal(container.__config, id)) {
            return {
                id,
                external: true
            };
        }

        if (typeof hr === 'string') {
            hr = {
                id: path.isAbsolute(hr)? path.normalize(hr) : hr,
                external: false
            };
        }

        if (!hr) {
            let parent = parentFilePath || path.resolve(process.cwd(), '__entry');
            hr = {
                id: path.normalize(resolvePath(id, parent)),
                external: false
            };
        }

        handleMetaProperty(container, hr.id, hr.meta);

        return hr;
    },

    resolveIdSkips: {
        reset () {
            this.storage = new Map();
        },

        add (plugin, importer, importee) {
            let key = importer + '\n' + importee;
            let keys = this.storage.get(plugin) || [];
            if (keys.indexOf(key) === -1) {
                keys.push(key);
            }
            this.storage.set(plugin, keys);
        },

        contains (plugin, importer, importee) {
            let keys = this.storage.get(plugin) || [];
            return keys.indexOf(importer + '\n' + importee) > -1;
        },

        remove (plugin, importer, importee) {
            let keys = this.storage.get(plugin);
            keys = keys.filter(k => k !== importer + '\n' + importee);
            this.storage.set(plugin, keys);
        }
    },

    /**
     * @param {PluginContainer} container 
     * @return {PluginLifecycleHooks} 
     */
    create (container) {
        return {
            async buildStart (options) {            
                await callAsyncParallelHook(container, 'buildStart', [options]);
            },

            async resolveDynamicImport (id, parentFilePath) {
                let hr = await callAsyncFirstHook(container, 'resolveDynamicImport', [id, parentFilePath]);

                // Explicitly checked for so that modules can be excluded.
                if (hr === false || (typeof hr === 'object' && hr.external)) {
                    return false;
                }

                if (typeof hr === 'string') {
                    return { id: hr };
                }

                if (typeof hr === 'object') {
                    return hr;
                }

                // If we have an ESNode, and it hasn't been resolved, ignore it.
                if (typeof id === 'object') {
                    return false;
                }

                return await PluginLifecycle.resolveIdImpl(container, id, parentFilePath);
            },

            async resolveId (id, parentFilePath, options) {
                return await PluginLifecycle.resolveIdImpl(container, id, parentFilePath, options);
            },

            async load ( filePath, parentFilePath) {
                let hr = await callAsyncFirstHook(container, 'load', [filePath, parentFilePath]);

                if (typeof hr === 'string') {
                    return { code: hr };
                }

                if (typeof hr === 'object' && hr.code) {
                    handleMetaProperty(container, filePath, hr.meta);
                    return hr;
                }

                if (!hr || !hr.code) {
                    filePath = path.isAbsolute(filePath)? filePath : path.resolve(process.cwd(), filePath);

                    return {
                        code: fs.readFileSync(filePath, 'utf8')
                    };
                }
            },

            async transform (code, id, map) {
                let originalCode = code, mapChain = [];

                if (map) {
                    // The load step can contain a map, as well as transform code from original code.
                    // TypeScript plugin uses the load step to transform from TS to ES.
                    map = typeof map === 'string'? JSON.parse(map) : map;
                    originalCode = map.sourcesContent? map.sourcesContent[0] : code;
                    mapChain.push({ code: originalCode, map });
                }

                container.__currentMapChain = mapChain;
                container.__currentOriginalCode = originalCode;
                container.__currentModuleId = id;

                let syntheticNamedExports;

                let hr = await callAsyncSequentialHook(container, 'transform', (input) => {                
                    return [ input.code, input.id ]; 
                }, (result, input) => {
                    if (typeof result === 'string') {
                        result = { code: result };
                    }

                    if (result.map !== null && typeof result.map === 'object' && !result.map.mappings) {
                        delete result.map;
                    }

                    handleMetaProperty(container, id, result.meta);

                    if (result.syntheticNamedExports && syntheticNamedExports === undefined) {
                        syntheticNamedExports = result.syntheticNamedExports;
                    }

                    if (result.code !== undefined) {
                        mapChain.push({
                            code: result.code,
                            map: result.map
                        });

                        return { code: result.code, id: id, map: result.map };
                    } else {
                        return input;
                    }

                }, { code, id, map: null, syntheticNamedExports: false });

                container.__currentMapChain = null;
                container.__currentOriginalCode = null;
                container.__currentModuleId = null;

                return { 
                    code: hr.code,
                    map: await combineSourceMapChainFast(mapChain, originalCode, id),
                    syntheticNamedExports
                };
            },

            watchChange (filePath) {
                callSyncSequentialHook(container, 'watchChange', [filePath]);
            },

            async buildEnd (error) {            
                await callAsyncParallelHook(container, 'buildEnd', [error]);
            },  

            async renderStart (outputOptions, inputOptions) {
                await callAsyncParallelHook(container, 'renderStart', [outputOptions, inputOptions]);
            },

            async banner () {
                let results = await callAsyncParallelHook(container, 'banner', []);
                return results.join('\n');
            },

            async footer () {
                let results = await callAsyncParallelHook(container, 'footer', []);
                return results.join('\n');
            },

            async intro () {
                let results = await callAsyncParallelHook(container, 'intro', []);
                return results.join('\n');
            },

            async outro () {
                let results = await callAsyncParallelHook(container, 'outro', []);
                return results.join('\n');
            },

            renderDynamicImport (...args) {
                triggerNotImplemented('renderDynamicImport', args);
            },

            augmentChunkHash (...args) {
                triggerNotImplemented('augmentChunkHash', args);
            },

            resolveFileUrl (metaProperty, referenceId, fileName, chunkId, moduleId) {
                return callSyncFirstHook(container, 'resolveFileUrl', [{
                    chunkId: chunkId,
                    fileName: fileName,
                    format: container.__config.output.format,
                    moduleId: moduleId,
                    relativePath: fileName,
                    referenceId: referenceId,
                    assetReferenceId: metaProperty.startsWith('ROLLUP_ASSET_URL_')? referenceId : null,
                    chunkReferenceId: metaProperty.startsWith('ROLLUP_CHUNK_URL_')? referenceId : null,
                }]);
            },

            resolveImportMeta (metaProperty, chunkId, moduleId) {
                return callSyncFirstHook(container, 'resolveImportMeta', [metaProperty, {
                    chunkId: chunkId,
                    format: container.__config.output.format,
                    moduleId: moduleId
                }]);
            },

            async renderChunk (code, chunkInfo, outputOptions) {
                await callAsyncSequentialHook(container, 'renderChunk', () => {
                    return [ chunkInfo.code, chunkInfo, outputOptions ]; 
                }, (result) => {
                    if (typeof result === 'string') {
                        result = { code: result };
                    }

                    if (result.code) {
                        chunkInfo.code = result.code;
                    }

                    if (result.map) {
                        chunkInfo.map = result.map;
                    }
                }, {});
            },

            async renderError (e) {
                await callAsyncParallelHook(container, 'renderError', [e]);
            },

            async generateBundle (outputOptions, bundle) {
                // Generate bundle expects an object, but to avoid having
                // to synchronize both an array and an object, we use a proxy
                // to simulate the object. Plugins shouldn't notice the difference.
                let bundleObj = new Proxy({}, {
                    get (target, prop) {
                        return bundle.find(e => e.fileName === prop);
                    },

                    set (target, prop, value) {
                        bundle.push(value);
                        return true;
                    },

                    // @ts-ignore
                    enumerate (target) {
                        return bundle.map(e => e.fileName);
                    },

                    ownKeys (target) {
                        return bundle.map(e => e.fileName);
                    },

                    getOwnPropertyDescriptor (key) {
                        return {
                            enumerable: true,
                            configurable: true,
                        };
                    }
                });

                await callAsyncSequentialHook(container, 'generateBundle', () => {
                    return [ outputOptions, bundleObj ]; 
                }, (result) => {
                    // Do nothing...
                }, {});
            },

            writeBundle (...args) {
                triggerNotImplemented('writeBundle', args);
            },

            async moduleParsed (filePath) {
                await callAsyncParallelHook(container, 'moduleParsed', [getModuleInfo(container, filePath)]);
            }
        }
    }
    
}

module.exports = PluginLifecycle;