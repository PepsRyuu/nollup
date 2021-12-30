# Supported Rollup Config Options

Nollup supports a subset of Rollup configuration options. The reason for this is because only a subset of the options make sense to be used in development, while others make more sense of production and optimising a production build. For options that Nollup doesn't understand, they are just simply ignored. Below describes what is supported.

See [Rollup](https://rollupjs.org/guide/en/) documentation for more information about each of these options.

## Options

* ```input``` - Supports ```string```, ```Object``` or ```Array<String>```.
* ```output``` - See below for support options.
* ```plugins``` - Use the same Rollup plugins.
* ```external``` - Supports ```Array<String>``` or ```Function```.
* ```acornInjectPlugins``` - Can pass array of additional Acorn plugins here.
* ```watch``` See below for notes on this option.
* ```context``` - Same as Rollup.
* ```moduleContext``` - Same as rollup.

## Output Options

* ```file``` - If using this option, the full path is the URL.
* ```dir``` - Nothing is done with it. Point it to ```dist``` or similar.
* ```entryFileNames``` - See below note.
* ```chunkFileNames``` - See below note.
* ```assetFileNames``` - See below note.
* ```format``` - Only support for ```es```, ```cjs```, ```amd``` or ```iife```. 
* ```globals``` - Remapping for window variables.

For file name pattern options, when the bundle is generated, it will serve files based on what the pattern says. The ```dir``` option is completely ignored and not part of the generated URL. 

Important to note as well that ```[hash]``` is never converted. This is intentional to make it easier to reference files during development, especially in files such as ```index.html```. For production builds with Rollup, it's recommended to use plugins such as [rollup-plugin-static-files](https://github.com/PepsRyuu/rollup-plugin-static-files) to auto-inject the hash.

## Watch Options

Nollup does not provide a ```watch()``` function like Rollup does, instead providing a web server. For compatibility, the Nollup dev server and middleware will respect this option. Both of the following options are supported:

* ```include``` - Will only listen to these directories for changes.
* ```exclude``` - Will listen to all directories but these ones for changes.

Nollup also injects the ```process.env.ROLLUP_WATCH``` environment variable. To differentiate between Rollup watch and Nollup though, there's also the ```process.env.NOLLUP``` environment variable.

## Plugin Hooks

[Rollup plugins](https://rollupjs.org/guide/en#plugins-overview) should work. 

The following lifecycle methods have been implemented:

```
buildStart,
buildEnd,
options,
outputOptions,
intro,
outro,
banner,
footer,
generateBundle,
resolveDynamicImport,
resolveId,
load,
transform,
renderChunk,
renderError,
renderStart,
resolveFileUrl,
resolveImportMeta,
moduleParsed
```

### Plugin Context

See [Rollup Plugin Context](https://rollupjs.org/guide/en#context) for more information.
Plugins can use the following methods in their lifecycle methods.

```
this.meta
this.addWatchFile(filepath)
this.emitFile(file)
this.getFileName(id)
this.parse(code, acornOptions)
this.warn(warning)
this.error(error)
this.emitAsset(assetName, source)
this.getAssetFileName(assetId)
this.emitChunk(id, options)
this.getChunkFileName(chunkId)
this.setAssetSource(assetId, source);
this.resolveId(importee, importer)
this.getCombinedSourcemap()
this.getModuleInfo(moduleId)
this.moduleIds
this.resolve(importee, importer, opts)
```