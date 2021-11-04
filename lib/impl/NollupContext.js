// @ts-check
let AcornParser = require('./AcornParser');
let PluginContainer = require('./PluginContainer');
let { resolvePath, getNameFromFileName, emitAssetToBundle } = require('./utils');
let RollupConfigContainer = require('./RollupConfigContainer');

/**
 * @param {NollupContext} context 
 * @param {string} id 
 * @return {Promise<string>}
 */
async function resolveInputId (context, id) {
    let resolved = await context.plugins.hooks.resolveId(id, undefined, { isEntry: true });
    if ((typeof resolved === 'object' && resolved.external)) {
        throw new Error('Input cannot be external');
    } 

    return typeof resolved === 'object' && resolved.id;
}

/**
 * @param {NollupContext} context 
 * @param {string|string[]|Object<string, string>} input 
 * @return {Promise<{name: string, file: string}[]>}
 */
async function getInputEntries (context, input) {
    if (!input) {
        throw new Error('Input option not defined');
    }

    if (typeof input === 'string') {
        input = await resolveInputId(context, input); 
        return [{ 
            name: getNameFromFileName(input),
            file: input
        }];
    }

    if (Array.isArray(input)) {
        return await Promise.all(input.map(async file => {
            file = await resolveInputId(context, file);
            return {
                name: getNameFromFileName(file),
                file: file
            };
        }));
    }

    if (typeof input === 'object') {
        return await Promise.all(Object.keys(input).map(async key => {
            let file = await resolveInputId(context, input[key]);
            return {
                name: key,
                file: file
            };
        }));
    }
}

class NollupContext {

    /**
     * @param {RollupOptions} options 
     * @return {Promise<void>}
     */
    async initialize (options) {
        this.config = new RollupConfigContainer(options);

        if (this.config.acornInjectPlugins) {
            AcornParser.inject(this.config.acornInjectPlugins);
        }

        this.files = /** @type {Object<string, NollupInternalModule>} */ ({}); 
        this.rawWatchFiles = /** @type {Object<string, string[]>} */ ({});
        this.watchFiles = /** @type {Object<string, string>} */ ({});
        this.currentBundle = /** @type {RollupOutputFile[]} */ (null);
        this.currentBundleModuleIds = /** @type {Set<string>}*/ (null);
        this.currentPhase = /** @type {string} */ (null);
        this.currentModuleEmittedAssetsCache = /** @type {Object<string, RollupEmittedAsset>} */ (null);
        this.currentModuleEmittedChunksCache = /** @type {Object<string, RollupEmittedChunk>} */ (null);
        this.currentEmittedAssets = /** @type {NollupInternalEmittedAsset[]} */ (null);
        this.currentBundleReferenceIdMap = /** @type {Object<String, RollupOutputFile>} */ (null);

        this.plugins = new PluginContainer(this.config, AcornParser); 
        this.plugins.start();

        this.plugins.onAddWatchFile((source, parent) => {
            if (!this.rawWatchFiles[parent]) {
                this.rawWatchFiles[parent] = [];
            }
            this.rawWatchFiles[parent].push(source);
            this.watchFiles[resolvePath(source, process.cwd() + '/__entry__')] = parent;
        });

        this.plugins.onGetWatchFiles(() => {
            let result = Object.keys(this.files);
            Object.entries(this.rawWatchFiles).forEach(([parent, watchFiles]) => {
                let parentIndex = result.indexOf(parent);
                let start = result.slice(0, parentIndex + 1);
                let end = result.slice(parentIndex + 1);
                result = start.concat(watchFiles).concat(end);
            });
            return result;
        });

        this.plugins.onEmitFile((referenceId, emitted) => {
            if (this.currentPhase === 'build') {
                if (emitted.type === 'asset') {
                    this.currentModuleEmittedAssetsCache[referenceId] = emitted;
                }

                if (emitted.type === 'chunk') {
                    this.currentModuleEmittedChunksCache[referenceId] = emitted;
                }
            } else if (this.currentPhase === 'generate') {
                if (emitted.type === 'asset') {
                    let asset = {
                        ...emitted,
                        referenceId: referenceId
                    };
                    
                    emitAssetToBundle(this.config.output, /** @type {RollupOutputAsset[]} */ (this.currentBundle), asset, this.currentBundleReferenceIdMap);
                }

                if (emitted.type === 'chunk') {
                    throw new Error('Cannot emit chunks after module loading has finished.');
                }
            }
        });

        this.plugins.onGetFileName(referenceId => {
            if (this.currentPhase === 'generate') {
                return this.currentBundleReferenceIdMap[referenceId].fileName;
            }

            throw new Error('File name not available yet.');
        });

        this.plugins.onSetAssetSource((referenceId, source) => {
            let found = this.currentBundleReferenceIdMap[referenceId] || 
                this.currentEmittedAssets.find(a => a.referenceId === referenceId) ||
                this.currentModuleEmittedAssetsCache[referenceId];

            if (found) {
                found.source = source;
            }
        });

        this.plugins.onGetModuleIds(() => {
            return this.currentBundleModuleIds.values();
        });

        this.plugins.onGetModuleInfo(id => {
            let file = this.files[id];

            if (file) {
                return {
                    id: id,
                    code: file.code || null,
                    isEntry: file.isEntry,
                    isExternal: false,
                    importedIds: file.externalImports.map(i => i.source).concat(file.imports.map(i => i.source)),
                    syntheticNamedExports: file.syntheticNamedExports
                };
            } else {
                // Probably external
                return {
                    id: id,
                    code: null,
                    isEntry: false,
                    isExternal: true,
                };
            }
        });

        this.input = await getInputEntries(this, this.config.input);
        this.indexGenerator = 0;
        this.liveBindings = /** @type {Boolean|String} */(false); 
        this.previousBundleModuleIds = new Set();
    }

    /**
     * @param {string} filePath 
     */
    invalidate (filePath) {
        filePath = resolvePath(filePath, process.cwd() + '/__entry__');
        if (this.files[filePath]) {
            this.files[filePath].invalidate = true;
            this.plugins.hooks.watchChange(filePath);
        }

        if (this.watchFiles[filePath]) {
            this.files[this.watchFiles[filePath]].invalidate = true;
            this.plugins.hooks.watchChange(filePath);
        }
    }

    /**
     * @param {RollupOutputOptions} outputOptions 
     */
    setOutputOptions (outputOptions) {
        this.config.setOutputOptions(outputOptions);
    }

    /**
     * @param {RollupOptions} options 
     */
    static async create (options) {
        let ctx = new NollupContext();
        await ctx.initialize(options);
        return ctx;
    }
}

module.exports = NollupContext;