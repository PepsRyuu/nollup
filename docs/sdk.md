# Nollup SDK

## **Highly experimental, use at risk**

With more tooling using a similar approach of reusing Rollup plugins, there has been multiple implementations of the Rollup plugin engine implemented. To help some of these tools, Nollup has been refactored to decouple the plugin engine from the rest of the tool, to allow for reuse and consistency in plugin usage.

This is designed for other bundlers (and no-bundlers) to use, it is not intended for app developers to use at all.

As this is experimental, **there's no backwards compatibility guaranteed** and this may even be removed in the future. This is highly subject to change depending on feedback.

## APIs

**RollupConfigContainer**

This class manages the Rollup config. It will do all of the necessary defaults, normalizing and formatting, as well as calling the ```options``` and ```outputOptions``` hooks. 

```
import { RollupConfigContainer } from 'nollup/lib/sdk';

// Handles input, plugins, and external options
let config = new RollupConfigContainer(rollupOptions);

// Handles the output option
config.setOutputOptions(rollupOutputOptions);
```

**PluginContainer**

This class manages the use of the Rollup plugins. It provides the ability to call plugin hooks, and provides plugin hooks with a context. This class doesn't fully implement each context function as some are implementation specific depending on the type of bundler you're creating, so there are callbacks instead which can be implemented.

```
import { PluginContainer } from 'nollup/lib/sdk';

let container = new PluginContainer(rollupConfigContainer, acornParser);

// Call start before calling any hook.
// This is important for errors to trigger correctly.
// If an error is thrown, this needs to be called again.
container.start();

// Call hooks as you need them
container.hooks.buildStart(options);
container.hooks.resolveDynamicImport(id, parentId);
container.hooks.resolveId(id, parentId, options);
container.hooks.load(filepath, parentFilepath);
container.hooks.transform(code, id, map);
container.hooks.watchChange(id);
container.hooks.buildEnd(error);
container.hooks.renderStart(outputOptions, inputOptions);
container.hooks.banner();
container.hooks.footer();
container.hooks.intro();
container.hooks.outro();
container.hooks.resolveFileUrl(metaProperty, referenceId, fileName, chunkId, moduleId);
container.hooks.resolveImportMeta(metaProperty, chunkId, moduleId);
container.hooks.renderChunk(code, chunkInfo, outputOptions);
container.hooks.renderError(error);
container.hooks.generateBundle(outputOptions, bundle);
container.hooks.moduleParsed(id);

// Implement the callbacks for full functionality
container.onAddWatchFile((id, parentId) => {
    // Track your files to watch
});

container.onGetWatchFiles(() => {
    // return a list of files being watched
});

container.onEmitFile((referenceId, emitted) => {
    // Do something with the emitted file
});

container.onGetFileName(referenceId => {
    // return the output file name for the provided id
});

container.onSetAssetSource((referenceId, source) => {
    // Override the source of the referenced asset
});

container.onGetModuleIds(() => {
    // return an iterable list of unique module ids in this bundle
});

container.onGetModuleInfo(id => {
    // return object with the module info based on the id
})
```