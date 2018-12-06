# API Documentation

Nollup follows closely to the API defined by Rollup so that it can be easily swapped.

```
async function build () {
    // Prepare instance of nollup
    let bundle = await nollup(inputOptions);

    // Generate code
    let { code } = await bundle.generate(outputOptions);

    // Unlike Rollup, there's no write method.
    // Code should be served from memory.
}

build();
```

### Supported Input Options 

```
input,
plugins,
external,

// For asset emission only, code splitting not yet available.
experimentalCodeSplitting
```

### Supported Output Options

```
file, // This is what the entry point will be called when generating.
format, // Format is always 'iife'. No support for other formats.
globals, // Remap global inputs to their window variables.
```

### Methods

***void* invalidate(*String* file)**

Sets a flag in memory for the specified file. When ```generate``` is called again
it will see the file has been invalidated and it will re-compile that file.

***Promise&lt;Object&gt;* generate()**

Generates the bundle. Returns a promise which contains an object. The object will
have the following:

```
{ 
    code, 
    fileName, 
    isEntry, 
    modules 
}
``` 

### Plugin Hooks

[Rollup plugins](https://rollupjs.org/guide/en#plugins-overview) should work. 

The following lifecycle methods have been implemented:

```
intro,
outro,
banner,
footer,
generateBundle,
resolveId,
load,
transform
```

### Plugin Context

See [Rollup Plugin Context](https://rollupjs.org/guide/en#context) for more information.
Plugins can use the following methods in their lifecycle methods.

```
this.error(error)
```

```
this.parse(code, acornOptions)
```

```
this.warn(warning)
```

```
this.emitAsset(assetName, source)
```

### Custom Plugin Hooks

To enable functionality such as HMR, custom nollup plugin hooks have been implemented 

***String* nollupBundleInit()**

Injected into the bundle before the first module in the bundle is required.
It has access to ```instances``` and ```modules```.

```instances``` is an array of instantiated modules. Each module has the following properties:

* ***Number* id -** The ID of the module that it was instantiated from.
* ***Object* exports -** Export code from the module.
* ***Array<Number>* dependencies -** Module IDs this module depends on.
* ***Boolean* invalidate -** If set to true, the module will be invalidated and refreshed locally.

```modules``` is an object of module IDs with their code.

***String* nollupModuleInit()**

Injected into the bundle before a module is instantiated.  
It has access to ```instances```, ```modules``` and ```module``` which is the module being instantiated.

## Dev Middleware

The dev middleware wraps Nollup bundling, and provides Hot Module Replacement, for ExpressJS servers. It watches for changes to the directory, and on any change, it will invalidate and regenerate the bundle.

```
let nollupDevServer = require('nollup/lib/dev-middleware');
let config = require('./rollup.config.js');

// Your express code

app.use(nollupDevServer(app, config, {
    watch: './src',
    hot: true,
    verbose: false
}));

```

### Dev Middleware Options

* ***String* watch -** Directory to watch for changes in order to rebuild.
* ***Boolean* hot -** If true, Hot Module Replacement will be enabled and injected into the bundle.
* ***Boolean* verbose -** If true, will print status of HMR to developer console.

## Hot Module Replacement

When HMR is enabled, JS files in the project can access ```module.hot```. 
It provides the following methods:

***void* accept(*Function* callback)**

Executes when the current module, or a dependency has been replaced.

***void* dispose(*Function* callback)**

Executes when the module is about to be replaced.

***String* status()**

Provides the current status of HMR. It will be one of the following:

* ```'idle'``` - Waiting for changes.
* ```'check'``` - Bundler checking for updates.
* ```'prepare'``` - Bundler getting ready to update.
* ```'ready'``` - Bundler prepared updated.
* ```'dispose'``` - ```dispose``` handler on module is being executed.
* ```'apply'``` - ```accept``` handler on module is being executed.

***void* addStatusHandler(*Function* callback)**

Executes when the status of HMR changes.

***void* removeStatusHandler(*Function* callback)**

Removes the listener that matches the callback function.