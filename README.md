# Nollup

[Rollup](https://rollupjs.org/guide/en) compatible bundler, designed to be used in development, while Rollup is used to generate a production build.

## Motivation

* Rollup is excellent, but during development it can be a bit slow as it's performing unnecessary build steps (tree-shaking).
* When making changes to files, Rollup has to recompile the entire bundle due to the tree-shaking optimisations. This can lead to slow rebuild times.
* Wanted something similar to Webpack development flow, but with the simplicity of the Rollup configuration and plugin ecosystem.
* To give developers a foundation for implementing Hot Module Replacement when using Rollup.
* While Rollup does have watching functionality, it requires a file output to be defined.

## What does this do?

* Nollup doesn't attempt to do any optimisations, it simple bundles all of the modules together.
* ES6 import and export statements are detected and replaced with an internal module loader.
* Each module is wrapped in an eval call with source maps. 
* Compatible with Rollup plugins, so you can use one single Rollup configuration for both development and production.
* Detects changed files, and performs a rebuild.

## Running examples

```
node examples/server.js [example]
```

Example:

```
node examples/server.js with-plugins
```