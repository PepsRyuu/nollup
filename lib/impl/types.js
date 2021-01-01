/** 
 * @typedef ESTree 
 * @property {string} type
 * @property {string} name
 * @property {number} start
 * @property {number} end
 * @property {ESTree.Declaration} declaration
 * @property {ESTree.Source} source
 * @property {ESTree.Specifiers} specifiers
 * @property {ESTree.MetaProperty} meta_property
 * @property {ESTree} left
 * @property {ESTree} object
 * @property {ESTree} property
 */

/**
 * @typedef ESTree.MetaProperty
 * @property {string} name
 */

/**
 * @typedef ESTree.Source
 * @property {number} start
 * @property {number} end
 * @property {string} type
 * @property {string} value
 * @property {Array<any>} expressions
 * @property {Array<any>} quasis
 */

/**
 * @typedef {import('rollup').Plugin} RollupPlugin
 * @typedef {import('rollup').ExternalOption} RollupExternalOption
 * @typedef {import('rollup').InputOption} RollupInputOption
 * @typedef {import('rollup').InputOptions} RollupInputOptions
 * @typedef {import('rollup').ModuleFormat} RollupModuleFormat
 * @typedef {import('rollup').PreRenderedAsset} RollupPreRenderedAsset
 * @typedef {import('rollup').PreRenderedChunk} RollupPreRenderedChunk
 * @typedef {import('rollup').PreRenderedAsset | import('rollup').PreRenderedChunk} RollupPreRenderedFile
 * @typedef {import('rollup').ModuleInfo} RollupModuleInfo
 * @typedef {import('rollup').OutputChunk} RollupOutputChunk
 * @typedef {import('rollup').OutputAsset} RollupOutputAsset
 * @typedef {import('rollup').OutputOptions} RollupOutputOptions 
 * @typedef {import('rollup').RollupOptions} RollupOptions
 * @typedef {import('rollup').PluginContext & import('rollup').TransformPluginContext} RollupPluginContext
 * @typedef {import('rollup').OutputChunk | import('rollup').OutputAsset} RollupOutputFile
 * @typedef {import('rollup').EmittedAsset} RollupEmittedAsset
 * @typedef {import('rollup').EmittedChunk} RollupEmittedChunk
 * @typedef {import('rollup').EmittedFile} RollupEmittedFile
 * @typedef {import('rollup').SourceMap} RollupSourceMap
 * @typedef {import('rollup').RenderedChunk} RollupRenderedChunk
 * @typedef {import('rollup').ResolveIdResult} RollupResolveIdResult
 * @typedef {import('rollup').ResolveId} RollupResolveId
 * @typedef {import('rollup').SourceDescription} RollupSourceDescription
 */

/**
 * @typedef {import('source-map').SourceMapGenerator | import('source-map-fast').SourceMapGenerator} SourceMapGenerator
 */

/**
 * @typedef NollupTransformMapEntry
 * @property {string} code
 * @property {RollupSourceMap} map
 */

/**
 * @typedef NollupPluginImpl
 * @property {function(): string} nollupModuleInit
 * @property {function(): string} nollupBundleInit
 * @property {function(string): string} nollupModuleWrap
 * 
 * @typedef { import('rollup').Plugin & NollupPluginImpl} NollupPlugin
 */

 /**
 * @typedef NollupOutputModule
 * @property {number} index
 * @property {string} code
 */

/**
 * @typedef NollupInternalModuleImport
 * @property {string} source
 * @property {boolean} syntheticNamedExports
 * @property {boolean?} export
 * @property {NollupInternalModuleImportSpecifier[]} specifiers
 */

 /**
 * @typedef NollupInternalModuleImportSpecifier
 * @property {string} local
 * @property {string} imported
 */

 /**
  * @typedef NollupInternalModule
  * @property {number} index
  * @property {boolean} invalidate
  * @property {boolean} isEntry
  * @property {string} code
  * @property {SourceMap} map
  * @property {NollupInternalModuleImport[]} imports
  * @property {NollupInternalModuleImport[]} externalImports
  * @property {string[]} dynamicImports
  * @property {string[]} externalDynamicImports
  * @property {string[]} exports
  * @property {Object<string, RollupEmittedAsset>} emittedAssetsCache
  * @property {Object<stirng, RollupEmittedChunk>} emittedChunksCache
  * @property {string[]} metaProperties
  * @property {boolean} syntheticNamedExports
  */

/**
 * @typedef NollupInternalPluginWrapper
 * @property {RollupPlugin} execute
 * @property {RollupPluginContext} context
 * @property {PluginErrorHandler} error
 */


/**
 * @typedef NollupInternalEmittedChunk
 * @property {string} id
 * @property {string} name
 * @property {boolean} isEntry
 * @property {boolean} isDynamicEntry
 * @property {string} [fileName]
 * @property {string} [referenceId]
 */

 /**
 * @typedef NollupInternalEmittedAsset
 * @property {string} type
 * @property {string} [name]
 * @property {string|Uint8Array} [source]
 * @property {string} [fileName]
 * @property {string} referenceId
 */

/**
 * @typedef NollupCompileChange
 * @property {number} id
 * @property {string} [code]
 * @property {boolean} [removed]
 */

/**
 * @typedef NollupCompileOutput
 * @property {{ time: number }} stats
 * @property {NollupCompileChange[]} changes
 * @property {RollupOutputFile[]} output
 */