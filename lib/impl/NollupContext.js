// @ts-check
let AcornParser = require('./AcornParser');
let PluginContainer = require('./PluginContainer');
let { resolvePath, getNameFromFileName, emitAssetToBundle } = require('./utils');
let RollupConfigContainer = require('./RollupConfigContainer');
let ImportExportResolver = require('./NollupImportExportResolver');
let NollupCodeGenerator = require('./NollupCodeGenerator');


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
                    code: file.transformedCode || null,
                    isEntry: file.isEntry,
                    isExternal: false,
                    importedIds: file.externalImports.map(i => i.source).concat(file.imports.map(i => i.source)),
                    importedIdResolutions:  file.externalImports.map(i => ({ 
                        id: i.source, 
                        external: true, 
                        meta: this.plugins.__meta[i.source] || {}, 
                        syntheticNamedExports: false,
                        moduleSideEffects: true 
                    })).concat(file.imports.map(i => ({ 
                        id: i.source, 
                        external: false,
                        meta: this.plugins.__meta[i.source] || {},
                        syntheticNamedExports: Boolean(file[i.source] && file[i.source].syntheticNamedExports),
                        moduleSideEffects: true
                    }))),
                    dynamicallyImportedIds: file.externalDynamicImports.concat(file.dynamicImports),
                    dynamicallyImportedIdResolutions: file.externalDynamicImports.map(i => ({ 
                        id: i, 
                        external: true, 
                        meta: this.plugins.__meta[i] || {}, 
                        syntheticNamedExports: false,
                        moduleSideEffects: true 
                    })).concat(file.dynamicImports.map(i => ({ 
                        id: i, 
                        external: false,
                        meta: this.plugins.__meta[i] || {},
                        syntheticNamedExports: Boolean(file[i] && file[i].syntheticNamedExports),
                        moduleSideEffects: true
                    }))),
                    syntheticNamedExports: file.syntheticNamedExports,
                    hasDefaultExport: !file.rawAst? null : Boolean(file.rawAst.exports.find(e => e.type === 'default'))
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

        this.plugins.onLoad(async ({ id, syntheticNamedExports, resolveDependencies, meta}) => {
            if (meta) {
                this.plugins.__meta[id] = meta;
            }
            await this.load(id, null, false, syntheticNamedExports, resolveDependencies);
        });

        this.liveBindings = /** @type {Boolean|String} */(false); 
        this.generator = new NollupCodeGenerator(this);
        this.indexGenerator = 0;
        this.previousBundleModuleIds = new Set();
        this.resolvedInputs = undefined;

        if (!this.config.input) {
            throw new Error('Input option not defined');
        }

        this.input = async () => {
            if (!this.resolvedInputs) {
                this.resolvedInputs = await getInputEntries(this, this.config.input);
            }

            return this.resolvedInputs;
        } 

    }

    /**
     * @param {string} filePath 
     */
    invalidate (filePath) {
        filePath = resolvePath(filePath, process.cwd() + '/__entry__');
        if (this.files[filePath]) {
            this.files[filePath].invalidate = true;
            this.files[filePath].preloaded = false;
            this.files[filePath].resolved = false;
            this.plugins.hooks.watchChange(filePath);
        }

        if (this.watchFiles[filePath]) {
            this.files[this.watchFiles[filePath]].invalidate = true;
            this.files[this.watchFiles[filePath]].preloaded = false;
            this.files[this.watchFiles[filePath]].resolved = false;
            this.plugins.hooks.watchChange(filePath);
        }
    }

    /**
     * @param {RollupOutputOptions} outputOptions 
     */
    setOutputOptions (outputOptions) {
        this.config.setOutputOptions(outputOptions);
    }

    async load (filePath, parentFilePath, isEntry, syntheticNamedExports, resolveDependencies) {
        let file = this.files[filePath];

        if (!file) {
            file = {
                id: filePath,
                index: this.indexGenerator++,
                invalidate: true,
                isEntry: isEntry,
                rawAst: null,
                rawCode: '',
                transformedCode: '',
                esmTransformedCode: '',
                generatedCode: '',
                map: null,
                imports: [],
                externalImports: [],
                dynamicImports: [],
                externalDynamicImports: [],
                exports: [],
                emittedAssetsCache: {},
                emittedChunksCache: {},
                metaProperties: [],
                syntheticNamedExports: false,
                hoist: false,
                preloaded: false,
                resolved: false,
            };
    
            this.files[filePath] = file;
        }

        if (!file.preloaded) {
            let emittedAssetsCache = /** @type Object<string, RollupEmittedAsset>} */ ({});
            let emittedChunksCache = /** @type Object<String, RollupEmittedChunk>} */ ({});
            
            this.currentModuleEmittedAssetsCache = emittedAssetsCache
            this.currentModuleEmittedChunksCache = emittedChunksCache;
            
            let loaded = await this.plugins.hooks.load(filePath, parentFilePath);
            let transformed = await this.plugins.hooks.transform( loaded.code, filePath, loaded.map);        
    
            file.rawCode = loaded.code;
            file.transformedCode = transformed.code;
            file.map = transformed.map;
            file.emittedAssetsCache = emittedAssetsCache;
            file.emittedChunksCache = emittedChunksCache;
            file.syntheticNamedExports = loaded.syntheticNamedExports || transformed.syntheticNamedExports || syntheticNamedExports || false;
            file.rawAst = ImportExportResolver.getBindings(transformed.code)

            file.preloaded = true;
        }
    
        if (resolveDependencies && !file.resolved) {
            this.currentModuleEmittedAssetsCache = file.emittedAssetsCache
            this.currentModuleEmittedChunksCache = file.emittedChunksCache;

            await this.plugins.hooks.moduleParsed(filePath);

            let resolved = await ImportExportResolver.transformBindings(this.plugins, file.transformedCode, file.rawAst, filePath, this.generator, this.liveBindings);
            file.esmTransformedCode = resolved.code;
            file.imports = resolved.imports;
            file.externalImports = resolved.externalImports;
            file.dynamicImports = resolved.dynamicImports;
            file.externalDynamicImports = resolved.externalDynamicImports;
            file.exports = resolved.exports;
            file.metaProperties = resolved.metaProperties;
            file.resolved = true;
        }

        return file;
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