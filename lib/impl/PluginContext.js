// @ts-check
let PluginLifecycle = require('./PluginLifecycle');
let PluginMeta = require('./PluginMeta');
let { resolvePath, emitAssetToBundle } = require('./utils');
let { combineSourceMapChain, getModuleInfo } = require('./PluginUtils');
let PluginContainer = require('./PluginContainer');

function getReferenceId () {
    return '__file__' + Date.now() + '_' + Math.round(Math.random() * 10e6) + '_' + Math.round(Math.random() * 10e6);
}

module.exports = {
    /**
     * @param {PluginContainer} container 
     * @param {RollupPlugin} plugin
     * @return {RollupPluginContext} 
     */
    create (container, plugin) {
        let context = {
            meta: PluginMeta,

            /**
             * @return {IterableIterator<string>}
             */
            get moduleIds () {
                return context.getModuleIds();
            },

            /**
             * @param {string} filePath 
             */
            addWatchFile (filePath) {
                container.__onAddWatchFile(filePath, container.__currentModuleId);
            },

            /** 
             * @param {RollupEmittedFile} file 
             * @return {string}
             */
            emitFile (file) {
                if (!file.type) {
                    // @ts-ignore
                    file.type = file.source? 'asset' : 'chunk';
                }

                if (!file.name) {
                    file.name = file.type;
                }

                let referenceId = getReferenceId();
                if (file.type === 'asset') {
                    let asset = {
                        type: file.type,
                        name: file.name,
                        source: file.source,
                        fileName: file.fileName
                    };

                    container.__onEmitFile(referenceId, asset);
                }

                if (file.type === 'chunk') {
                    let chunk = {
                        type: file.type,
                        name: file.name,
                        fileName: file.fileName,
                        id: resolvePath(file.id, process.cwd() + '/__entry')
                    };

                    container.__onEmitFile(referenceId, chunk);
                }

                return referenceId;
            },

            /**
             * @return {RollupSourceMap}
             */
            getCombinedSourcemap () {
                if (!container.__currentMapChain) {
                    throw new Error('getCombinedSourcemap can only be called in transform hook');
                }

                return combineSourceMapChain(container.__currentMapChain, container.__currentOriginalCode, container.__currentModuleId);
            },

            /**
             * @param {string} id
             * @return {string} 
             */
            getFileName (id) {
                return container.__onGetFileName(id);
            },

            /**
             * @return {IterableIterator<string>}
             */
            getModuleIds () {
                return container.__onGetModuleIds();
            },

            /**
             * @param {string} id
             * @return {RollupModuleInfo} 
             */
            getModuleInfo (id) {
                return getModuleInfo(container, id);
            },

            /**
             * @param {string} importee 
             * @param {string} importer 
             * @param {{ isEntry?: boolean, custom?: import('rollup').CustomPluginOptions, skipSelf?: boolean }} options 
             * @return {Promise<RollupResolveId>}
             */
            async resolve (importee, importer, options = {}) {
                if (options.skipSelf) {
                    PluginLifecycle.resolveIdSkips.add(plugin, importer, importee);
                }
            
                try {
                    return await PluginLifecycle.resolveIdImpl(container, importee, importer, {
                        isEntry: options.isEntry,
                        custom: options.custom
                    });
                } finally {
                    if (options.skipSelf) {
                        PluginLifecycle.resolveIdSkips.remove(plugin, importer, importee);
                    }
                }
            },

            /**
             * @param {import('rollup').ResolvedId} resolvedId
             * @return {Promise<RollupModuleInfo>}
             */
            async load(resolvedId) {
                await container.__onLoad(resolvedId);
                return context.getModuleInfo(resolvedId.id);
            },

            /**
             * @param {string} code 
             * @param {Object} options 
             * @return {ESTree}
             */
            parse (code, options) {
                return container.__parser.parse(code, options);
            },

            /**
             * @param {string} e 
             */
            warn (e) {
                container.__errorHandler.warn(e);
            },

            /**
             * @param {string|Error} e 
             */
            error (e) {
                container.__errorHandler.throw(e);
            },

            /**
             * @param {string} name 
             * @param {string|Uint8Array} source 
             * @return {string}
             */
            emitAsset (name, source) {
                return context.emitFile({
                    type: 'asset',
                    name: name,
                    source: source
                });
            },

            /**
             * @param {string} id 
             * @param {Object} options 
             * @return {string}
             */
            emitChunk (id, options = {}) {
                return context.emitFile({
                    type: 'chunk',
                    id: id,
                    name: options.name
                });
            },

            /**
             * @param {string} id
             * @return {string} 
             */
            getAssetFileName (id) {
                return context.getFileName(id);
            },

            /**
             * @param {string} id
             * @return {string} 
             */
            getChunkFileName (id) {
                return context.getFileName(id);
            },

            /**
             * @param {string} id 
             * @param {string|Uint8Array} source 
             */
            setAssetSource (id, source) {
                container.__onSetAssetSource(id, source);
            },

            isExternal () {
                throw new Error('isExternal: deprecated in Rollup, not implemented');
            },

            /**
             * @param {string} importee 
             * @param {string} importer
             * @return {Promise<RollupResolveId>} 
             */
            async resolveId (importee, importer) {
                let result = await container.hooks.resolveId(importee, importer);

                if (typeof result === 'object') {
                    if (result.external) {
                        return null;
                    }

                    return result.id;
                }

                return result;
            },

            /**
             * @return {string[]}
             */
            getWatchFiles () {
                return container.__onGetWatchFiles();
            },

            cache: null
        };

        // @ts-ignore
        return context;
    }
};