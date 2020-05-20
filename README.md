# Nollup

[![Build Status](https://travis-ci.com/PepsRyuu/nollup.svg?branch=master)](https://travis-ci.com/PepsRyuu/nollup)
[![NPM Version](https://img.shields.io/npm/v/nollup.svg)](https://www.npmjs.com/package/nollup)
[![License](https://badgen.net/github/license/pepsryuu/nollup)](./LICENSE)
[![Downloads](https://img.shields.io/npm/dm/nollup)](https://www.npmjs.com/package/nollup)
[![Contributors](https://img.shields.io/github/contributors/PepsRyuu/nollup)](https://github.com/PepsRyuu/nollup/graphs/contributors)
[![Twitter](https://img.shields.io/twitter/follow/PepsRyuu?style=social)](https://twitter.com/PepsRyuu)

***No(t) Rollup → Nollup***

[Rollup](https://rollupjs.org/guide/en) compatible bundler, ***designed to be used in development***. Using the same Rollup plugins and configuration, it provides a dev server that performs quick builds and rebuilds, and other dev features such as **Hot Module Replacement**. Use Rollup to generate production bundles.

## Why Nollup?

Rollup is an incredible tool, producing very efficient and minimal bundles. Many developers use it already to build libraries, but I wanted to use it to **build apps**. However, **Rollup focuses mostly on the production** side of things, with almost no developer experience other than basic file watching. Using Rollup in development can be incredibly slow with rebuilds taking seconds because of all of the optimisations Rollup does for you (ie. tree-shaking, scope-hoisting).

Nollup aims to fill in that gap. Using the same Rollup plugins and configuration, **you can use Nollup to run a development server that generates a development bundle**. It does no optimisations, making it really quick at rebuilding, also allowing for Hot Module Replacement using existing ```module.hot``` conventions for **compatibility with existing libraries**.

Read further about why I prefer using Rollup to build apps [here](https://medium.com/@PepsRyuu/why-i-use-rollup-and-not-webpack-e3ab163f4fd3).

## Getting Started

Nollup can be used with the CLI in ```package.json``` scripts:

```
"scripts": {
    "start": "nollup -c"
}
```

Examples can be found in the [examples](./examples) directory.

## Configuration 


You can use a configuration file as alternative to CLI flags or to complement them.

Configuration files are read using [cosmiconfig](https://github.com/davidtheclark/cosmiconfig).

This means configuration will be looked for in the following places in the order listed:

1. A `nollup` property in a `package.json` file.
2. A `.nolluprc` file with `JSON` or `YAML` syntax.
3. A `.nolluprc.json` file.
4. A `.nolluprc.yaml`, `.nolluprc.yml`, or `.nolluprc.js` file.
5. A `nollup.config.js` JS file exporting the object.

`.nolluprc`
```json
{
    "hot": true,
    "contentBase": "./public"
}
```

`.nolluprc.js`
```javascript
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

### Additional Build Configuration for HMR

In your build configuration, if your code includes ```module```, it may be necessary to explicitly inform Rollup to remove all references to ```module```, otherwise your application may break when compiled with Rollup. This can be done using a plugin such as ```rollup-plugin-terser```.

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
* [@prefresh/nollup](https://github.com/JoviDeCroock/prefresh) - HMR for Preact apps.

## Caveats

* Not all Rollup configuration options are supported yet, but most relevant ones are.
* Not all Rollup plugin hooks are implemented yet, but most relevant ones are.
* Sourcemaps aren't perfect yet, depends on plugin usage, please write an issue.
* Does not attempt to parse "require" calls anywhere, that's for CommonJS plugins.
* No support for live-bindings, but circular dependencies are supported.