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

The following flags can be passed into Nollup:

* **-c | --config [file]** - Pass a configuration file. By default it will look for ```rollup.config.js``` but can be specified otherwise.
* **--content-base [folder]** - Folder to serve static content from. By default it will be looking in ```'./```.
* **--history-api-fallback** - If set, it will fallback to ```index.html``` if accessing a route that doesn't exist.
* **--hot** - Enable Hot Module Replacement.
* **--port [value]** - Port number to run server on. Default is ```8080```.
* **--verbose** - If set, there's verbose logging.

## API

See [API](API.md) for information on how to use the JavaScript API.

## Rollup Plugins with Nollup Enhancements

* [rollup-plugin-hot-css](https://github.com/PepsRyuu/rollup-plugin-hot-css) - Load CSS files with HMR support.
* [rollup-plugin-commonjs-alternate](https://github.com/PepsRyuu/rollup-plugin-commonjs-alternate) - CommonJS loader that supports React Hot Loader.

## Caveats

* Not all Rollup configuration options are supported yet.
* Not all Rollup plugin hooks are implemented yet.
* Sourcemaps aren't perfect yet, depends on plugin usage.
* Does not attempt to parse "require" calls anywhere.
* No support for live-bindings. Not sure if I want to sacrifice debugging capabilities for a feature not used often.
* No support for circular imports.

Contributions are welcome.

