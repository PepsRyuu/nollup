let fs = require('fs');
let path = require('path');
let { resolvePath, combineSourceMapChainFast } = require('./utils');
let ErrorHandling = require('./ErrorHandling');

async function _callAsyncHook (self, plugin, hook, args) {
    if (typeof plugin[hook] === 'string') {
        return plugin[hook];
    }

    if (plugin[hook]) { 
        let hr = plugin[hook].apply(self, args);
        
        if (hr instanceof Promise) {
            return (await ErrorHandling.wrapAsync(hr));
        }

        return hr;
    }
}

function _callSyncHook (self, plugin, hook, args) {
    if (plugin[hook]) { 
        return plugin[hook].apply(self, args);
    }
}

async function callAsyncFirstHook (context, hook, args) {
    // hook may return a promise.
    // waits for hook to return value other than null or undefined.
    let { plugins, pluginsContext } = context;

    for (let i = 0; i < plugins.length; i++) {
        let hr = await _callAsyncHook(pluginsContext[i], plugins[i], hook, args);

        if (hr !== null && hr !== undefined) {
            return hr;
        }
    } 
}

async function callAsyncSequentialHook (context, hook, toArgs, fromResult, start) {
    // hook may return a promise.
    // all plugins that implement this hook will run, passing data onwards
    let { plugins, pluginsContext } = context;
    let output = start;

    for (let i = 0; i < plugins.length; i++) {
        let args = toArgs(output);
        let hr = await _callAsyncHook(pluginsContext[i], plugins[i], hook, args);

        if (hr !== null && hr !== undefined) {
            output = fromResult(hr);
        }
    }

    return output;
}

async function callAsyncParallelHook (context, hook, args) {
    // hooks may return promises.
    // all hooks are executed at the same time without waiting
    // will wait for all hooks to complete before returning
    let { plugins, pluginsContext } = context;
    let hookResults = [];

    for (let i = 0; i < plugins.length; i++) {
        hookResults.push(_callAsyncHook(pluginsContext[i], plugins[i], hook, args));
    }

    return Promise.all(hookResults);
}

function callSyncFirstHook (context, hook, args) {
    // waits for hook to return value other than null of undefined
    let { plugins, pluginsContext } = context;

    for (let i = 0; i < plugins.length; i++) {
        let hr = _callSyncHook(pluginsContext[i], plugins[i], hook, args);

        if (hr !== null && hr !== undefined) {
            return hr;
        }
    } 
}

function callSyncSequentialHook (context, hook, args) {
    // all plugins that implement this hook will run, passing data onwards
    let { plugins, pluginsContext } = context;

    for (let i = 0; i < plugins.length; i++) {
        _callSyncHook(pluginsContext[i], plugins[i], hook, args);
    };
}

module.exports = {
    hooks: {
        // options hooks

        async buildStart (context, options) {            
            await callAsyncParallelHook(context, 'buildStart', [options]);
        },

        async resolveDynamicImport (context, id, parentFilePath) {
            let hr = await callAsyncFirstHook(context, 'resolveDynamicImport', [id, parentFilePath]);

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

            return this.resolveId(context, id, parentFilePath);
        },

        async resolveId (context, id, parentFilePath) {
            let hr = await callAsyncFirstHook(context, 'resolveId', [id, parentFilePath]);

            if (hr === false) {
                return false;
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

            if (hr.syntheticNamedExports) {
                context.syntheticNamedExports[hr.id] = hr.syntheticNamedExports;
            }

            return hr;
        },

        async load (context, filePath, parentFilePath) {
            let hr = await callAsyncFirstHook(context, 'load', [filePath, parentFilePath]);

            if (typeof hr === 'string') {
                return { code: hr };
            }

            if (typeof hr === 'object' && hr.code) {
                if (hr.syntheticNamedExports) {
                    context.syntheticNamedExports[filePath] = hr.syntheticNamedExports;
                }
                return hr;
            }

            if (!hr || !hr.code) {
                filePath = path.isAbsolute(filePath)? filePath : path.resolve(process.cwd(), filePath);

                return {
                    code: fs.readFileSync(filePath, 'utf8')
                };
            }
        },

        async transform (context, code, filePath) {
            let map, originalCode = code, mapChain = [];

            for (let i = 0; i < context.pluginsContext.length; i++) {
                context.pluginsContext[i].__mapChain = mapChain;
                context.pluginsContext[i].__originalCode = originalCode;
            }

            let hr = await callAsyncSequentialHook(context, 'transform', (input) => {                
                return [ input.code, input.filePath ]; 
            }, (result) => {
                if (typeof result === 'string') {
                    result = { code: result };
                }

                if (result.map !== null && typeof result.map === 'object' && !result.map.mappings) {
                    delete result.map;
                }

                if (result.syntheticNamedExports) {
                    context.syntheticNamedExports[filePath] = result.syntheticNamedExports;
                }

                mapChain.push({
                    code: result.code,
                    map: result.map
                });

                return { code: result.code, filePath: filePath, map: result.map };
            }, { code, filePath, map: null });

            map = await combineSourceMapChainFast(mapChain, originalCode, filePath);

            for (let i = 0; i < context.pluginsContext.length; i++) {
                delete context.pluginsContext[i].__mapChain;
                delete context.pluginsContext[i].__originalCode;
            }

            return { 
                code: hr.code,
                map: map
            };
        },

        watchChange (context, filePath) {
            callSyncSequentialHook(context, 'watchChange', [filePath]);
        },

        async buildEnd (context, error) {            
            await callAsyncParallelHook(context, 'buildEnd', [error]);
        },  

        // outputOptions hook

        async renderStart (context, outputOptions, inputOptions) {
            await callAsyncParallelHook(context, 'renderStart', [outputOptions, inputOptions]);
        },

        async banner (context) {
            let results = await callAsyncParallelHook(context, 'banner', []);
            return results.join('\n');
        },

        async footer (context) {
            let results = await callAsyncParallelHook(context, 'footer', []);
            return results.join('\n');
        },

        async intro (context) {
            let results = await callAsyncParallelHook(context, 'intro', []);
            return results.join('\n');
        },

        async outro (context) {
            let results = await callAsyncParallelHook(context, 'outro', []);
            return results.join('\n');
        },

        renderDynamicImport () {

        },

        augmentChunkHash () {

        },

        resolveFileUrl (context, prop, id, fileName, type, moduleId, chunkId) {
            return callSyncFirstHook(context, 'resolveFileUrl', [{
                chunkId: chunkId,
                fileName: fileName,
                format: context.output.format,
                moduleId: moduleId,
                relativePath: fileName,
                referenceId: id,
                assetReferenceId: prop.startsWith('ROLLUP_ASSET_URL_')? id : null,
                chunkReferenceId: prop.startsWith('ROLLUP_CHUNK_URL_')? id : null,
            }]);
        },

        resolveImportMeta (context, metaProperty, chunkId, moduleId) {
            return callSyncFirstHook(context, 'resolveImportMeta', [metaProperty, {
                chunkId: chunkId,
                format: context.output.format,
                moduleId: moduleId
            }]);
        },

        async renderChunk (context, code, chunkInfo, outputOptions) {
            await callAsyncSequentialHook(context, 'renderChunk', () => {
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
            });
        },

        async renderError (context, e) {
            await callAsyncParallelHook(context, 'renderError', [e]);
        },

        async generateBundle (context, outputOptions, bundle) {
            // Generate bundle expects an object, but to avoid having
            // to synchronize both an array and an object, we use a proxy
            // to simulate the object. Plugins shouldn't notice the difference.
            let bundleObj = new Proxy({}, {
                get (target, prop) {
                    return bundle.find(e => e.fileName === prop);
                },

                set (target, prop, value) {
                    bundle.push(value);
                },

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

            await callAsyncSequentialHook(context, 'generateBundle', () => {
                return [ outputOptions, bundleObj ]; 
            }, (result) => {
                // Do nothing...
            });
        },


        writeBundle () {
            // not implemented
        }
    },

    setCurrentBundle (context, bundle, prebundleAssets, moduleIds) {
        context.pluginsContext.forEach(ctx => {
            ctx.__currentBundle = bundle;
            ctx.__currentBundleModuleIds = moduleIds;
        });
    },

    setCurrentPhase (context, phase) {
        context.pluginsContext.forEach(ctx => {
            ctx.__currentPhase = phase;
        });
    },

    setCurrentFile (context, filePath) {
        context.pluginsContext.forEach(ctx => {
            ctx.__currentFilePath = filePath;
        });
    },

    setCurrentFileEmittedCache (context, assetCache, chunkCache) {
        context.pluginsContext.forEach(ctx => {
            ctx.__currentFileEmittedAssetsCache = assetCache;
            ctx.__currentFileEmittedChunksCache = chunkCache;
        });
    }
}