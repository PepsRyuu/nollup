let AcornParser = require('./AcornParser');
let { formatFileName, resolvePath, isExternal, combineSourceMapChain } = require('./utils');

const FILE_ID_REGEX = /[\W]/g;

function getIdForFile (name) {
    return '__file__' + name.replace(FILE_ID_REGEX, '_');
}

module.exports = {
    meta: {
        rollupVersion: '2.0'
    },

    create: function (context, plugin) {
        return {
            meta: this.meta,

            get moduleIds () {
                let moduleIds = new Set(Object.keys(context.files));
                return moduleIds.values();
            },

            addWatchFile (filepath) {
                context.watchFiles[resolvePath(filepath, this.__current_filepath)] = this.__current_filepath;
            },

            emitFile (file) {
                if (file.type === 'chunk') {
                    return console.warn('emitFile: type "chunk": not implemented');
                }

                if (!file.name && !file.fileName) {
                    file.name = file.type;
                }

                let fileName = file.name? formatFileName(context, file.name, context.output.assetFileNames) : file.fileName;
                let id = getIdForFile(fileName);
                context.bundle[fileName] = {
                    name: file.name || file.fileName,
                    isAsset: true,
                    source: file.source,
                    fileName: fileName
                };
                context.assets[id] = context.bundle[fileName];
                return id;
            },

            getCombinedSourcemap () {
                if (!this.__mapChain) {
                    throw new Error('getCombinedSourcemap can only be called in transform hook');
                }

                return combineSourceMapChain(this.__mapChain, this.__original_code, this.__current_filepath);
            },

            getFileName (id) {
                return context.assets[id].fileName;
            },

            getModuleInfo (id) {
                let file = context.files[id];
                if (file) {
                    return {
                        id: id,
                        isEntry: file.isEntry,
                        isExternal: false,
                        importedIds: file.externalDependencies.concat(file.dependencies)
                    };
                }

                let externalFile = context.externalFiles[id];
                if (externalFile) {
                    return {
                        id: id,
                        isEntry: false,
                        isExternal: true,
                        importedIds: []
                    };
                }
            },

            async resolve (importee, importer, options = {}) {
                let plugins = context.plugins;

                if (options.skipSelf) {
                    context.plugins = context.plugins.filter(p => p !== plugin);
                }

                try {
                    let resolved = await require('./PluginLifecycle').resolveId(context, importee, importer);
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
                throw e;
            },

            emitAsset (assetName, source) {
                let id = getIdForFile(assetName);
                context.bundle[assetName] = {
                    name: assetName,
                    isAsset: true,
                    source: source,
                    fileName: formatFileName(context, assetName, context.output.assetFileNames)
                };
                context.assets[id] = context.bundle[assetName];
                return id;
            },

            emitChunk () {
                console.warn('emitChunk: deprecated in Rollup, not implemented');
            },

            getAssetFileName (id) {
                return context.assets[id].fileName;
            },

            getChunkFileName () {
                console.warn('getChunkFileName: deprecated in Rollup, not implemented');
            },

            setAssetSource (id, source) {
                return context.assets[id].source = source;
            },

            isExternal () {
                console.warn('isExternal: deprecated in Rollup, not implemented');
            },

            async resolveId (importee, importer) {
                let result = await require('./PluginLifecycle').resolveId(context, importee, importer);

                if (!result) {
                    return result;
                }

                return result.id
            }

        }
    }
}
