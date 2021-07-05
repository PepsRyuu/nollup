// @ts-check
let ImportExportResolver = require('./NollupImportExportResolver');
let ParseError = require('./ParseError');
let { getNameFromFileName, emitAssetToBundle, formatFileName, yellow } = require('./utils');
let path = require('path');
let NollupContext = require('./NollupContext');
let NollupCodeGenerator = require('./NollupCodeGenerator');
let PluginContainer = require('./PluginContainer');

/**
 * @param {RollupOutputOptions} outputOptions 
 * @param {RollupOutputFile[]} bundle
 * @param {Object<string, string>} bundleOutputTypes 
 */
function applyOutputFileNames (outputOptions, bundle, bundleOutputTypes) {
    let name_map = {};

    bundle.forEach(curr => {
        if (!name_map[curr.name]) {
            name_map[curr.name] = [];
        }

        name_map[curr.name].push(curr);
    });

    Object.keys(name_map).forEach(name => {
        let entries = name_map[name];
        entries.forEach((entry, index) => {
            let name = entry.name + (index > 0? (index + 1) : '');

            if (entry.isEntry && bundleOutputTypes[entry.facadeModuleId] === 'entry') {
                if (outputOptions.file) {
                    entry.fileName = path.basename(outputOptions.file);
                } else {
                    entry.fileName = formatFileName(outputOptions.format, name + '.js', outputOptions.entryFileNames);
                }
            }

            if (entry.isDynamicEntry || bundleOutputTypes[entry.facadeModuleId] === 'chunk') {
                entry.fileName = entry.fileName || formatFileName(outputOptions.format, name + '.js', outputOptions.chunkFileNames);
            }
        });
    });
}

const FILE_PROPS = ['ROLLUP_FILE_URL_', 'ROLLUP_ASSET_URL_', 'ROLLUP_CHUNK_URL_'];

/**
 * @param {PluginContainer} plugins 
 * @param {string} moduleId
 * @param {string} metaName 
 * @param {RollupOutputChunk} chunk 
 * @param {Object<string, RollupOutputFile>} bundleReferenceIdMap 
 * @return {string}
 */
function resolveImportMetaProperty (plugins, moduleId, metaName, chunk, bundleReferenceIdMap) {
    if (metaName) {
        for (let i = 0; i < FILE_PROPS.length; i++) {
            if (metaName.startsWith(FILE_PROPS[i])) {
                let id = metaName.replace(FILE_PROPS[i], '');
                let entry = bundleReferenceIdMap[id];
                let replacement = plugins.hooks.resolveFileUrl(
                    metaName,
                    id,
                    entry.fileName,
                    chunk.fileName,
                    moduleId
                );

                return replacement || '"' + entry.fileName + '"';
            }
        }
    }

    let replacement = plugins.hooks.resolveImportMeta(metaName, chunk.fileName, moduleId);
    if (replacement) {
        return replacement;
    }

    return 'import.meta.' + metaName;
}

/**
 * @param {NollupContext} context 
 * @param {string} filePath 
 * @param {string} parentFilePath 
 * @param {number} depth 
 * @param {Object} emitted 
 * @param {Set<string>} bundleModuleIds 
 * @param {NollupCodeGenerator} generator 
 * @param {boolean} syntheticNamedExports 
 * @param {boolean} isEntry
 * @param {NollupInternalEmittedAsset[]} bundleEmittedAssets
 * @param {string[]} circularTrace
 */
async function compileModule (context, filePath, parentFilePath, depth, emitted, bundleModuleIds, generator, syntheticNamedExports, isEntry, bundleEmittedAssets, circularTrace) {
    if (depth >= 255) {
        throw new Error('Maximum parse call stack exceeded.');
    }

    let file = context.files[filePath];

    if (emitted.modules[filePath]) {
        // Circular check
        if (circularTrace.indexOf(filePath) !== circularTrace.length - 1) {
            let trace = circularTrace.slice(circularTrace.indexOf(filePath));
            trace.forEach(t => {
                // TODO: Add type
                // TODO: Test invalidation
                context.files[t].hoist = true;
            });
            emitted.circulars.push(trace.map(t => t.replace(process.cwd(), '')).join(' -> '));
        }
        
        return;
    }

    // This module should be part of this input target
    emitted.modules[filePath] = true;
    bundleModuleIds.add(filePath);

    // If the file hasn't been encountered before, create an entry for it.
    if (!file) {
        file = {
            index: context.indexGenerator++,
            invalidate: true,
            isEntry: isEntry,
            code: '',
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
            hoisted: false
        };

        context.files[filePath] = file;
    }

    if (file.invalidate) {
        let emittedAssetsCache = /** @type Object<string, RollupEmittedAsset>} */ ({});
        let emittedChunksCache = /** @type Object<String, RollupEmittedChunk>} */ ({});
        
        context.currentModuleEmittedAssetsCache = emittedAssetsCache
        context.currentModuleEmittedChunksCache = emittedChunksCache;
        
        let loaded = await context.plugins.hooks.load(filePath, parentFilePath);
        let transformed = await context.plugins.hooks.transform( loaded.code, filePath);
        let resolved = await ImportExportResolver(context.plugins, transformed.code, filePath, generator, context.liveBindings);

        file.code = resolved.code;
        file.imports = resolved.imports;
        file.externalImports = resolved.externalImports;
        file.dynamicImports = resolved.dynamicImports;
        file.externalDynamicImports = resolved.externalDynamicImports;
        file.exports = resolved.exports;
        file.map = transformed.map;
        file.emittedAssetsCache = emittedAssetsCache;
        file.emittedChunksCache = emittedChunksCache;
        file.metaProperties = resolved.metaProperties;
        file.syntheticNamedExports = loaded.syntheticNamedExports || transformed.syntheticNamedExports || syntheticNamedExports || false;
    }

    await context.plugins.hooks.moduleParsed(filePath);

    file.dynamicImports.forEach(di => {
        if (emitted.dynamicImports.indexOf(di) === -1) {
            emitted.dynamicImports.push(di);
        } 
    });

    file.externalImports.forEach(ei => {
        let foundSource = emitted.externalImports.find(other => other.source === ei.source);
        if (!foundSource) {
            foundSource = {
                source: ei.source,
                specifiers: []
            };

            emitted.externalImports.push(foundSource);
        } 

        ei.specifiers.forEach(spec => {
            if (foundSource.specifiers.indexOf(spec.imported) === -1) {
                foundSource.specifiers.push(spec.imported);
            }
        });
    });

    Object.entries(file.emittedAssetsCache).forEach(([referenceId, asset]) => {
        bundleEmittedAssets.push({
            ...asset,
            referenceId
        });
    });

    Object.entries(file.emittedChunksCache).forEach(([referenceId, chunk]) => {
        emitted.chunks[referenceId] = chunk;
    });

    emitted.metaProperties[filePath] = file.metaProperties;

    for (let i = 0; i < file.imports.length; i++) {
        try {
            circularTrace.push(file.imports[i].source);
            await compileModule(context, file.imports[i].source, filePath, depth + 1, emitted, bundleModuleIds, generator, file.imports[i].syntheticNamedExports, false, bundleEmittedAssets, circularTrace);
            circularTrace.pop();
        } catch (e) {
            throw new ParseError(file.imports[i].source, e);
        }
    }

    if (file.invalidate) {
        file.code = generator.onGenerateModule(context.files, filePath, context.config);
        file.invalidate = false;
    }
}

/**
 * @param {NollupContext} context 
 * @param {string} filePath 
 * @param {Set} bundleModuleIds 
 * @param {NollupCodeGenerator} generator 
 * @param {NollupInternalEmittedAsset[]} bundleEmittedAssets
 * @param {boolean} isEntry
 * @return {Promise<Object>}
 */
async function compileInputTarget (context, filePath, bundleModuleIds, generator, bundleEmittedAssets, isEntry) {
    let emitted = {
        modules: {}, // modules id this input contains
        dynamicImports: [], // emitted dynamic ids
        externalImports: [],
        metaProperties: {},
        chunks: {},
        circulars: []
    };

    let parentFilePath = process.cwd() + '/__entry__'; // root parent path
    let depth = 0; // start of the input is always true
    
    await compileModule(context, filePath, parentFilePath, depth, emitted, bundleModuleIds, generator, false, isEntry, bundleEmittedAssets, [filePath]);
    return emitted;
}

module.exports = {
    /**
     * @param {NollupContext} context 
     * @param {NollupCodeGenerator} generator 
     * @return {Promise<NollupCompileOutput>}
     */
    async compile (context, generator) {
        context.plugins.start();

        let bundle = /** @type {RollupOutputFile[]} */ ([]);
        let bundleError = /** @type {Error} */ (undefined);
        let bundleStartTime = Date.now();
        let bundleEmittedChunks = /** @type {NollupInternalEmittedChunk[]} */ ([]);
        let bundleEmittedAssets = /** @type {NollupInternalEmittedAsset[]} */ ([]);
        let bundleModuleIds = new Set();
        let bundleMetaProperties = {};
        let bundleReferenceIdMap = /** @type {Object<string, RollupOutputChunk| RollupOutputAsset>} */ ({}); 
        let bundleOutputTypes = /** @type {Object<String, string>} */ ({});
        let bundleDynamicImports = /** @type {Object<string, string[]>} */ ({});
        let bundleCirculars = [];

        let invalidated = Object.keys(context.files).filter(filePath => context.files[filePath].invalidate);

        let addBundleEmittedChunks = function (dynamicImports, emittedChunks, modules) {
            
            dynamicImports.forEach(id => {
                // if the current chunk already includes the dynamic import content, then don't create a new chunk
                if (modules[id]) {
                    return;
                }

                let found = bundleEmittedChunks.find(o => o.id === id);
                if (!found) {
                    bundleEmittedChunks.push({
                        id: id,
                        name: getNameFromFileName(id),
                        isDynamicEntry: true,
                        isEntry: false
                    });
                }
            });

            Object.entries(emittedChunks).forEach(([referenceId, chunk]) => {
                let found = bundleEmittedChunks.find(o => o.id === chunk.id);
                let output = {
                    id: chunk.id,
                    name: chunk.name,
                    isDynamicEntry: false,
                    isEntry: true,
                    fileName: chunk.fileName,
                    referenceId: referenceId
                };
                
                if (!found) {
                    bundleEmittedChunks.push(output);
                } else {
                    found.referenceId = referenceId;
                }
            });
        };

        context.currentBundle = bundle;
        context.currentBundleModuleIds = bundleModuleIds;
        context.currentBundleReferenceIdMap = bundleReferenceIdMap;
        context.currentEmittedAssets = bundleEmittedAssets;

        try {
            context.currentPhase = 'pre-build';

            await context.plugins.hooks.buildStart(context.config);

            context.currentPhase = 'build';

            for (let i = 0; i < context.input.length; i++) {
                let { name, file } = context.input[i];                
                let emitted = await compileInputTarget(context, file, bundleModuleIds, generator, bundleEmittedAssets, true);

                bundle.push({
                    code: '',
                    name: name,
                    isEntry: true,
                    isDynamicEntry: false,
                    type: 'chunk',
                    map: null,
                    modules: emitted.modules,
                    fileName: '',
                    imports: emitted.externalImports.map(e => e.source),
                    importedBindings: emitted.externalImports.reduce((acc, val) => {
                        acc[val.source] = val.specifiers;
                        return acc;
                    }, {}),
                    dynamicImports: [],
                    exports: context.files[file].exports,
                    facadeModuleId: file,
                    implicitlyLoadedBefore: [],
                    referencedFiles: [],
                    isImplicitEntry: false
                }); 

                addBundleEmittedChunks(emitted.dynamicImports, emitted.chunks, emitted.modules);
                bundleMetaProperties[file] = emitted.metaProperties;
                bundleOutputTypes[file] = 'entry';
                bundleDynamicImports[file] = emitted.dynamicImports;
                bundleCirculars = bundleCirculars.concat(emitted.circulars);
            }

            for (let i = 0; i < bundleEmittedChunks.length; i++) {
                let chunk = bundleEmittedChunks[i];
                let emitted = await compileInputTarget(context, chunk.id, bundleModuleIds, generator, bundleEmittedAssets, chunk.isEntry);

                let bundleEntry = {
                    code: '',
                    name: chunk.name,
                    isEntry: chunk.isEntry,
                    isDynamicEntry: chunk.isDynamicEntry,
                    type: /** @type {'chunk'} */ ('chunk'),
                    map: null,
                    modules: emitted.modules,
                    fileName: chunk.fileName,
                    facadeModuleId: chunk.id,
                    imports: emitted.externalImports.map(e => e.source),
                    importedBindings: emitted.externalImports.reduce((acc, val) => {
                        acc[val.source] = val.specifiers;
                        return acc;
                    }, {}),
                    dynamicImports: [],
                    exports: context.files[chunk.id].exports,
                    implicitlyLoadedBefore: [], 
                    referencedFiles: [], 
                    isImplicitEntry: false
                };

                addBundleEmittedChunks(emitted.dynamicImports, emitted.chunks, emitted.modules);
                bundleMetaProperties[chunk.id] = emitted.metaProperties;
                bundleOutputTypes[chunk.id] = 'chunk';
                bundleDynamicImports[chunk.id] = emitted.dynamicImports;

                bundleReferenceIdMap[chunk.referenceId] = bundleEntry;
                bundleCirculars = bundleCirculars.concat(emitted.circulars);
                bundle.push(bundleEntry);
            }
        } catch (e) {
            bundleError = e;
            throw e;
        } finally {
            context.currentPhase = 'post-build';
            await context.plugins.hooks.buildEnd(bundleError);
        }

        if (bundleCirculars.length > 0) {
            let show = bundleCirculars.slice(0, 3);
            let hide = bundleCirculars.slice(3);

            console.warn([
                yellow('(!) Circular dependencies'),
                ...show,
                hide.length > 0? `...and ${hide.length} more` : '',
                yellow('Code may not run correctly. See https://github.com/PepsRyuu/nollup/blob/master/docs/circular.md')
            ].join('\n'));
        }

        applyOutputFileNames(context.config.output, bundle, bundleOutputTypes);

        context.currentPhase = 'generate';

        bundleEmittedAssets.forEach(asset => {
            emitAssetToBundle(context.config.output, bundle, asset, bundleReferenceIdMap);
        });

        let modules;

        try {
            await context.plugins.hooks.renderStart(context.config.output, context.config);

            // clone files and their code
            modules = Object.entries(context.files).reduce((acc, val) => {
                let [ id, file ] = val;
                acc[id] = {
                    index: file.index,
                    code: generator.onGenerateModulePreChunk(file, bundle, context.files),
                };
                return acc;
            }, {});

            // Rendering hooks
            let [ banner, intro, outro, footer ] = await Promise.all([
                context.plugins.hooks.banner(),
                context.plugins.hooks.intro(),
                context.plugins.hooks.outro(),
                context.plugins.hooks.footer()
            ]);

            for (let i = 0; i < bundle.length; i++) {
                let bundleEntry = /** @type {RollupOutputChunk} */ (bundle[i]);
                if (bundleEntry.type === 'chunk') {
                    Object.entries(bundleMetaProperties[bundleEntry.facadeModuleId]).forEach(([moduleId, metaNames]) => {
                        metaNames.forEach(metaName => {
                            let resolved = resolveImportMetaProperty(context.plugins, moduleId, metaName, bundleEntry, bundleReferenceIdMap);
                            modules[moduleId].code = modules[moduleId].code.replace(
                                metaName === null? new RegExp('import\\.meta') : new RegExp('import\\.meta\\.' + metaName, 'g'),
                                resolved
                            );
                        });
                    });
                    
                    bundleEntry.code = banner + '\n' + intro + '\n' + generator.onGenerateChunk(modules, bundleEntry, context.config.output, context.config) + '\n' + outro + '\n' + footer;

                    await context.plugins.hooks.renderChunk(bundleEntry.code, bundleEntry, context.config.output);
                }   
            }
        } catch (e) {
            await context.plugins.hooks.renderError(e);
            throw e;
        }
        
        await context.plugins.hooks.generateBundle(context.config.output, bundle);

        let removedIds = [...context.previousBundleModuleIds].filter(i => !bundleModuleIds.has(i));
        let addedIds = [...bundleModuleIds].filter(i => !context.previousBundleModuleIds.has(i));

        let changedIds = new Set(addedIds.concat(invalidated));
        context.previousBundleModuleIds = bundleModuleIds;

        let changes = removedIds.map(f => ({
            id: context.files[f].index,
            code: '',
            removed: true
        })).concat([...changedIds].map(f => ({
            id: context.files[f].index,
            code: generator.onGenerateModuleChange(modules[f]),
            removed: false
        })));

        return {
            stats: { time: Date.now() - bundleStartTime },
            changes: changes,
            output: bundle
        }
    }
}