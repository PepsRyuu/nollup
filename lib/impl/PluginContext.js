let AcornParser = require('./AcornParser');
let PluginLifecycle = require('./PluginLifecycle');
let { resolvePath, combineSourceMapChain, isExternal, emitAssetToBundle } = require('./utils');
let ErrorHandling = require('./ErrorHandling');

function getReferenceId () {
    return '__file__' + Date.now() + '_' + Math.round(Math.random() * 10e6) + '_' + Math.round(Math.random() * 10e6);
}

module.exports = {
    meta: {
        rollupVersion: '2.0',
        watchMode: true
    },

    create (context, plugin) {
        return {
            meta: this.meta,

            get moduleIds () {
                return this.__currentBundleModuleIds.values();
            },

            addWatchFile (filePath) {
                context.watchFiles[resolvePath(filePath, this.__currentFilePath)] = this.__currentFilePath;
            },

            emitFile (file) {
                if (!file.type) {
                    file.type = file.source? 'asset' : 'chunk';
                }

                if (!file.name) {
                    file.name = file.type;
                }

                let referenceId = getReferenceId();
                if (file.type === 'asset') {
                    let asset = {
                        referenceId: referenceId,
                        name: file.name,
                        source: file.source,
                        fileName: file.fileName
                    };

                    if (this.__currentPhase === 'build') {
                        this.__currentFileEmittedAssetsCache.push(asset)
                    } else {
                        emitAssetToBundle(context, this.__currentBundle, asset);
                    }
                }

                if (file.type === 'chunk') {
                    if (this.__currentPhase === 'build') {
                        this.__currentFileEmittedChunksCache.push({
                            referenceId: referenceId,
                            name: file.name,
                            fileName: file.fileName,
                            id: resolvePath(file.id, process.cwd() + '/__entry')
                        });
                    } else {
                        throw new Error('Cannot emit chunks after module loading has finished.')
                    }
                }

                return referenceId;
            },

            getCombinedSourcemap () {
                if (!this.__mapChain) {
                    throw new Error('getCombinedSourcemap can only be called in transform hook');
                }

                return combineSourceMapChain(this.__mapChain, this.__originalCode, this.__currentFilePath);
            },

            getFileName (id) {
                if (this.__currentPhase === 'generate') {
                    return this.__currentBundle.find(e => e.referenceId === id).fileName;
                }

                throw new Error('File name not available yet.');
            },

            getModuleIds () {
                return this.__currentBundleModuleIds.values();
            },

            getModuleInfo (id) {
                let file = context.files[id];
                if (file) {
                    return {
                        id: id,
                        isEntry: file.isEntry,
                        isExternal: false,
                        importedIds: file.externalImports.map(i => i.source).concat(file.imports.map(i => i.source))
                    };
                } else {
                    // Probably external
                    return {
                        id: id,
                        isEntry: false,
                        isExternal: true,
                        importedIds: []
                    }
                }
            },

            async resolve (importee, importer, options = {}) {
                let plugins = context.plugins;

                if (options.skipSelf) {
                    context.plugins = context.plugins.filter(p => p !== plugin);
                }

                try {
                    let resolved = await PluginLifecycle.hooks.resolveId(context, importee, importer);
                    context.plugins = plugins;

                    if (resolved === false || isExternal(context, importee)) {
                        return {
                            id: importee,
                            external: true
                        }
                    }

                    if (typeof resolved === 'object') {
                        return resolved;
                    }
                    
                    return {
                        id: resolved,
                        external: false
                    }
                } catch (e) {
                    context.plugins = plugins;
                    throw e;
                }
                
            },

            parse (code, options) {
                return AcornParser.parse(code, options);
            },

            warn (e) {
                console.warn(e);
            },

            error (e) {
                ErrorHandling.throw(e);
            },

            emitAsset (name, source) {
                return this.emitFile({
                    type: 'asset',
                    name: name,
                    source: source
                });
            },

            emitChunk (id, options = {}) {
                return this.emitFile({
                    type: 'chunk',
                    id: id,
                    name: options.name
                });
            },

            getAssetFileName (id) {
                return this.getFileName(id);
            },

            getChunkFileName (id) {
                return this.getFileName(id);
            },

            setAssetSource (id, source) {
                let found = this.__currentBundle.find(e => e.referenceId === id);
                if (found) {
                    found.source = source;
                }
            },

            isExternal () {
                console.warn('isExternal: deprecated in Rollup, not implemented');
            },

            async resolveId (importee, importer) {
                let result = await PluginLifecycle.hooks.resolveId(context, importee, importer);

                if (!result) {
                    return result;
                }

                return result.id
            }
        }
    }
};