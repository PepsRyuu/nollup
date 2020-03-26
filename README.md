# Nollup

[![Build Status](https://travis-ci.com/PepsRyuu/nollup.svg?branch=master)](https://travis-ci.com/PepsRyuu/nollup)
[![NPM Version](https://img.shields.io/npm/v/nollup.svg)](https://img.shields.io/npm/v/nollup.svg)
[![License](https://badgen.net/github/license/pepsryuu/nollup)](https://badgen.net/github/license/pepsryuu/nollup)

[Rollup](https://rollupjs.org/guide/en) compatible bundler, designed to be used in development, while Rollup is used to generate a production build.

## Motivation

* Rollup is excellent, but during development it can be a bit slow as it's performing unnecessary build steps (tree-shaking).
* When making changes to files, Rollup has to recompile the entire bundle due to the tree-shaking optimisations. This can lead to slow rebuild times.
* Wanted something similar to Webpack development flow, but with the simplicity of the Rollup configuration and plugin ecosystem.
* To give developers a foundation for implementing Hot Module Replacement when using Rollup.
* While Rollup does have watching functionality, it writes to disk and isn't intended to be used in-memory.

## What does this do?

* Nollup doesn't attempt to do any optimisations, it simple concatenates all of the modules together with simple function wrappers.
* ES6 import and export statements are detected and replaced with an internal module loader.
* Each module is wrapped in an eval call with source maps. 
* Compatible with Rollup plugins, so you can use one single Rollup configuration for both development and production. Make sure the plugin uses ```emitAsset``` instead of writing to disk.
* Detects changed files, and performs a rebuild and has support for Hot Module Replacement.

## Examples

See ```examples``` directory on how to use.

## CLI

Nollup provides a dev server which can be used as a CLI command.

```
    "scripts": {
        "start": "nollup -c"
    }
```

See "Nollup Options" for list of available flags.

## .nolluprc

Configuration file that can be used to pass configuration instead of as flags through the CLI. 

```
{
    "hot": true,
    "contentBase": "./public"
}
```

A JavaScript file called ```.nolluprc.js``` can be used instead.

```
module.exports = {
    hot: true,
    contentBase: './public'
};
```

See "Nollup Options" for list of available options.

## Nollup Options

* ***String* config | -c | --config [file]** - Pass a configuration file. By default it will look for ```rollup.config.js``` but can be specified otherwise.
* ***String* contentBase | --content-base [folder]** - Folder to serve static content from. By default it will be looking in ```'./```.
* ***Boolean* historyApiFallback | --history-api-fallback** - If set, it will fallback to ```index.html``` if accessing a route that doesn't exist.
* ***Boolean* hot | --hot** - Enable Hot Module Replacement.
* ***Number* port | --port [value]** - Port number to run server on. Default is ```8080```.
* ***Boolean* verbose | --verbose** - If set, there's verbose logging.
* ***Object* proxy** - Object keys are paths to match. Value is domain to redirect to. ```"/api": "http://localhost:8080"``` will have a request such as ```/api/todos``` redirect to ```http://localhost:8080/api/todos``` 
* ***String* hmrHost | --hmr-host [host]** - Host to connect to for HMR. Default is ```window.location.host```.
* ***Function* before** - Receives Express app as argument. Allows for middleware before internally used middleware.
* ***Function* after** - Receives Express app as argument. Allows for middleware after internally used middleware.

## Adding Hot Support to App

Out of the box, Nollup won't do anything to enable any hot functionality for your app.
This has to be manually added by the developer using ```module.hot.accept``` callback.
When a file is saved, Nollup will check the dependency tree for that file, and if any of its parents have defined a ```module.hot.accept``` callback, it will execute that callback. Developers can run whatever code they want in the callback to update their application.

Usually there's two different approaches that are taken for the callback: 

### Hot Reload

When a file is saved, the browser will reload the page. Frameworks don't need to support this, and it can be added to any project easily.

```
if (module) {
    module.hot.accept(() => {
        window.location.reload();
    });
}
```

### Hot Module Replacement

When a file is saved, only the changed module is replaced, the page is not refreshed. This is very powerful as it allows you to update your app while preserving as much state as possible. This has to be supported by the framework or plugin you are using. Plugins such as ```rollup-plugin-hot-css``` allow you to update your CSS without refreshing the page. Please refer to the framework's documentation on how to add HMR support to your app.

You can also use a combination of HMR with Hot Reload. For example you can use the CSS plugin, but use a fallback accept callback that will refresh the page instead as described above.

### Build Configuration for HMR

In your build configuration, make sure to tell your bundler to remove all references to ```module```, otherwise your application will break when compiled with Rollup. This can be done using a plugin such as ```rollup-plugin-terser```.

```
terser({
    compress: {
        global_defs: {
            module: false
        }
    }
});
```

## API

See [API](API.md) for information on how to use the JavaScript API.

## Rollup Plugins with Nollup Enhancements

* [rollup-plugin-hot-css](https://github.com/PepsRyuu/rollup-plugin-hot-css) - Load CSS files with HMR support.
* [rollup-plugin-react-refresh](https://github.com/PepsRyuu/rollup-plugin-react-refresh) - Nollup plugin for HMR in React apps.
* [rollup-plugin-commonjs-alternate](https://github.com/PepsRyuu/rollup-plugin-commonjs-alternate) - CommonJS loader that supports React Hot Loader.

## Caveats

* Not all Rollup configuration options are supported yet.
* Not all Rollup plugin hooks are implemented yet.
* Sourcemaps aren't perfect yet, depends on plugin usage.
* Does not attempt to parse "require" calls anywhere.
* No support for live-bindings, but circular dependencies are supported.

Contributions are welcome.

