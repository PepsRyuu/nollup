let PluginLifecycle = require('./PluginLifecycle');
let ImportExportResolver = require('./ImportExportResolver');
let CodeGenerator = require('./CodeGenerator');
let ParseError = require('./ParseError');
let { applyOutputFileNames, getNameFromFileName, emitAssetToBundle } = require('./utils');
let path = require('path');
let ErrorHandling = require('./ErrorHandling');

async function compileModule (context, filePath, parentFilePath, depth, isEntry, emitted, bundleModuleIds) {
    if (depth >= 255) {
        throw new Error('Maximum parse call stack exceeded.');
    }

    if (filePath === false) {
        // Module is not included is set to false (External)
        return;
    }

    let file = context.files[filePath];

    if (emitted.modules[filePath]) {
        // Circular check
        return;
    }

    // This module should be part of this input target
    emitted.modules[filePath] = true;
    bundleModuleIds.add(filePath);

    // If the file hasn't been encountered before, create an entry for it.
    if (!file) {
        file = {
            moduleId: context.moduleIdGenerator++,
            references: 0,
            code: '',
            map: null,
            imports: [],
            externalImports: [],
            dynamicImports: [],
            externalDynamicImports: [],
            exports: [],
            invalidate: true,
            isEntry: isEntry,
            emittedCache: null
        };

        context.files[filePath] = file;
    }

    if (file.invalidate) {
        let emittedAssetsCache = [];
        let emittedChunksCache = [];

        PluginLifecycle.setCurrentFile(context, filePath);
        PluginLifecycle.setCurrentFileEmittedCache(context, emittedAssetsCache, emittedChunksCache);

        let loaded = await PluginLifecycle.hooks.load(context, filePath, parentFilePath);
        let transformed = await PluginLifecycle.hooks.transform(context, loaded.code, filePath);
        let resolved = await ImportExportResolver(context, transformed.code, filePath);

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
    }

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

    file.emittedAssetsCache.forEach(asset => {
        emitted.assets.push(asset);
    });

    file.emittedChunksCache.forEach(chunk => {
        emitted.chunks.push(chunk);
    });

    file.metaProperties.forEach(prop => {
        emitted.metaProperties.push({
            moduleId: filePath,
            name: prop
        });
    });

    for (let i = 0; i < file.imports.length; i++) {
        try {
            await compileModule(context, file.imports[i].source, filePath, depth + 1, false, emitted, bundleModuleIds);
        } catch (e) {
            throw new ParseError(file.imports[i].source, e);
        }
    }

    if (file.invalidate) {
        file.generated = CodeGenerator.generateFile(context, filePath);
        file.invalidate = false;
    }
}

async function compileInputTarget (context, filePath, isEntry, bundleModuleIds) {
    let emitted = {
        modules: {}, // modules id this input contains
        dynamicImports: [], // emitted dynamic ids
        externalImports: [],
        metaProperties: [],
        assets: [],
        chunks: []
    };

    let parentFilePath = process.cwd() + '/__entry__'; // root parent path
    let depth = 0; // start of the input is always true
    await compileModule(context, filePath, parentFilePath, depth, isEntry, emitted, bundleModuleIds);
    return emitted;
}

module.exports = {
    async compile (context) {
        ErrorHandling.reset();

        let bundle = [];
        let bundleError;
        let bundleStartTime = Date.now();
        let bundleEmittedChunks = [];
        let bundleExternalImports = [];
        let bundleEmittedAssets = [];
        let bundleModuleIds = new Set();

        let currentEntryId;
        let oldFileCount = Object.keys(context.files).length;
        let invalidated = Object.keys(context.files).filter(filePath => context.files[filePath].invalidate);

        let addBundleEmittedChunks = function (dynamicImports, chunks) {
            dynamicImports.forEach(id => {
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

            chunks.forEach(c => {
                let found = bundleEmittedChunks.find(o => o.id === c.id);
                if (found) {
                    found.referenceId = c.referenceId;
                    bundle.forEach(e => {
                        if (e.__entryModule === c.id) {
                            e.referenceId = c.referenceId;
                        }
                    });
                } else {
                    bundleEmittedChunks.push({
                        id: c.id,
                        name: c.name,
                        isDynamicEntry: false,
                        isEntry: true,
                        fileName: c.fileName,
                        referenceId: c.referenceId
                    });
                }
            });
        };

        let addBundleEmittedAssets = function (assets) {
            assets.forEach(asset => {
                bundleEmittedAssets.push(asset);
            });
        };

        PluginLifecycle.setCurrentBundle(context, bundle, bundleEmittedAssets, bundleModuleIds);

        try {
            PluginLifecycle.setCurrentPhase(context, 'pre-build');

            await PluginLifecycle.hooks.buildStart(context, context.options);

            PluginLifecycle.setCurrentPhase(context, 'build');

            for (let i = 0; i < context.input.length; i++) {
                let { name, file } = context.input[i];
                currentEntryId = file;
                let emitted = await compileInputTarget(context, file, true, bundleModuleIds);

                bundle.push({
                    name: name,
                    isEntry: true,
                    isDynamicEntry: false,
                    type: 'chunk',
                    map: null,
                    modules: emitted.modules,
                    imports: [],
                    exports: context.files[file].exports,
                    __entryModuleId: context.files[file].moduleId,
                    __dynamicImports: emitted.dynamicImports,
                    __externalImports: emitted.externalImports,
                    __metaProperties: emitted.metaProperties,
                }); 

                addBundleEmittedChunks(emitted.dynamicImports, emitted.chunks);
                addBundleEmittedAssets(emitted.assets);
            }

            for (let i = 0; i < bundleEmittedChunks.length; i++) {
                let chunk = bundleEmittedChunks[i];
                currentEntryId = chunk.id;
                let emitted = await compileInputTarget(context, chunk.id, false, bundleModuleIds);

                bundle.push({
                    name: chunk.name,
                    isEntry: chunk.isEntry,
                    isDynamicEntry: chunk.isDynamicEntry,
                    type: 'chunk',
                    map: null,
                    modules: emitted.modules,
                    imports: [],
                    exports: context.files[chunk.id].exports,
                    referenceId: chunk.referenceId,
                    fileName: chunk.fileName,
                    __entryModule: chunk.id,
                    __entryModuleId: context.files[chunk.id].moduleId,
                    __dynamicImports: emitted.dynamicImports,
                    __externalImports: emitted.externalImports,
                    __metaProperties: emitted.metaProperties,
                });

                addBundleEmittedChunks(emitted.dynamicImports, emitted.chunks);
                addBundleEmittedAssets(emitted.assets);
            }
        } catch (e) {
            bundleError = e;
            throw e;
        } finally {
            PluginLifecycle.setCurrentPhase(context, 'post-build');
            await PluginLifecycle.hooks.buildEnd(context, bundleError);
        }

        applyOutputFileNames(context, bundle);

        PluginLifecycle.setCurrentPhase(context, 'generate');

        bundleEmittedAssets.forEach(asset => {
            emitAssetToBundle(context, bundle, asset);
        });

        // Rendering hooks
        try {
            await PluginLifecycle.hooks.renderStart(context, context.output, context.options);

            for (let i = 0; i < bundle.length; i++) {
                if (bundle[i].type === 'chunk') {
                    bundle[i].code = await CodeGenerator.generateChunk(context, bundle[i], bundle);
                    await PluginLifecycle.hooks.renderChunk(context, bundle[i].code, bundle[i], context.output);
                }   
            }
        } catch (e) {
            await PluginLifecycle.hooks.renderError(context, e);
            throw e;
        }
        
        await PluginLifecycle.hooks.generateBundle(context, context.output, bundle);

        let removedIds = [...context.previousBundleModuleIds].filter(i => !bundleModuleIds.has(i));
        let addedIds = [...bundleModuleIds].filter(i => !context.previousBundleModuleIds.has(i));

        let changedIds = new Set(addedIds.concat(invalidated));
        context.previousBundleModuleIds = bundleModuleIds;

        let changes = removedIds.map(f => ({
            id: context.files[f].moduleId,
            removed: true
        })).concat([...changedIds].map(f => ({
            id: context.files[f].moduleId,
            code: CodeGenerator.generateDelta(context, bundle, context.files[f])
        })));

        return {
            stats: { time: Date.now() - bundleStartTime },
            changes: changes,
            output: bundle
        }
    }
}