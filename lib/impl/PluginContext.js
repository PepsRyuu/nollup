let AcornParser = require('./AcornParser');
let { formatFileName, resolvePath, isExternal, combineSourceMapChain } = require('./utils');
let path = require('path');

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
                let isAsset = file.type === 'asset' || file.source;
                let isChunk = file.type === 'chunk' || file.id;

                file.type = isAsset? 'asset' : 'chunk';

                if (!file.name && !file.fileName) {
                    file.name = file.type + (Object.keys(context.emitted).length || '');
                }

                let fileNamePattern = isAsset? context.output.assetFileNames : context.output.chunkFileNames;
                let fileName = file.name? formatFileName(context, file.name, fileNamePattern) : file.fileName;
                let id = getIdForFile(fileName);
                let name = file.name || file.fileName;

                if (isAsset) {
                    context.bundle[fileName] = {
                        name: name,
                        isAsset: true,
                        source: file.source,
                        fileName: fileName
                    };
                    context.emitted[id] = context.bundle[fileName];
                } else if (isChunk) {
                    // check for moduleId instead of id
                    let moduleId = path.resolve(process.cwd(), file.id);

                    for (let id in context.emitted) {
                        let emitted = context.emitted[id];
                        if (emitted.moduleId === moduleId) {
                            return id;
                        }
                    }

                    context.emitted[id] = {
                        moduleId,
                        name,
                        fileName,
                        parentId: this.__current_filepath
                    }
                }
                
                return id;
            },

            getCombinedSourcemap () {
                if (!this.__mapChain) {
                    throw new Error('getCombinedSourcemap can only be called in transform hook');
                }

                return combineSourceMapChain(this.__mapChain, this.__original_code, this.__current_filepath);
            },

            getFileName (id) {
                return context.emitted[id].fileName;
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
                }

                let externalFile = context.externalFiles[id] || context.externalDynamicFiles[id];
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
                return this.emitFile({
                    type: 'asset',
                    name: assetName,
                    source: source
                });
            },

            emitChunk (id, options = {}) {
                return this.emitFile({
                    type: 'chunk',
                    id,
                    name: options.name
                });
            },

            getAssetFileName (id) {
                return context.emitted[id].fileName;
            },

            getChunkFileName (id) {
                return context.emitted[id].fileName;
            },

            setAssetSource (id, source) {
                return context.emitted[id].source = source;
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
