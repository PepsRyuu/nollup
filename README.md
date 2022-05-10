# Nollup

![CI](https://github.com/PepsRyuu/nollup/actions/workflows/main.yml/badge.svg)
[![NPM Version](https://img.shields.io/npm/v/nollup.svg)](https://www.npmjs.com/package/nollup)
[![License](https://badgen.net/github/license/pepsryuu/nollup)](./LICENSE)
[![Downloads](https://img.shields.io/npm/dm/nollup)](https://www.npmjs.com/package/nollup)
[![Contributors](https://img.shields.io/github/contributors/PepsRyuu/nollup)](https://github.com/PepsRyuu/nollup/graphs/contributors)
[![Twitter](https://img.shields.io/twitter/follow/PepsRyuu?style=social)](https://twitter.com/PepsRyuu)

***No(t) Rollup → Nollup***

[Rollup](https://rollupjs.org/guide/en) compatible bundler, ***designed to be used in development***. Using the same Rollup plugins and configuration, it provides a dev server that performs **quick builds and rebuilds**, and other dev features such as **Hot Module Replacement**.

## Why Nollup?

Rollup is an incredible tool, producing very efficient and minimal bundles. Many developers use it already to build libraries, but I wanted to use it to **build apps**. However, **Rollup focuses mostly on the production** side of things, with almost no developer experience other than basic file watching. Using Rollup in development can be incredibly slow with rebuilds taking seconds because of all of the optimisations Rollup does for you (ie. tree-shaking, scope-hoisting).

Nollup aims to fill in that gap. Using the same Rollup plugins and configuration, **you can use Nollup to run a development server that generates a development bundle**. It does no optimisations, making it really **quick at rebuilding**, also allowing for Hot Module Replacement using existing ```module.hot``` conventions for **compatibility with existing libraries**.

Read further about why I prefer using Rollup to build apps [here](https://medium.com/@PepsRyuu/why-i-use-rollup-and-not-webpack-e3ab163f4fd3).

## How to Use

Nollup provides four ways to use it:

* [Nollup CLI](./docs/cli.md) 
* [Dev Server API](./docs/dev-server.md)
* [Dev Middleware API](./docs/dev-middleware.md)
* [Compiler API](./docs/compiler.md)
* [SDK 🧪](./docs/sdk.md)

For the majority of projects, it is recommended to use the CLI approach.

## Quick Start

[create-nollup-app](https://github.com/PepsRyuu/create-nollup-app) is a CLI that will generate a Nollup project for you.

```
// npm 6 and below
npm init nollup-app --name <project-name> --template <template>

// npm 7+ which requires extra dashes
npm init nollup-app -- --name <project-name> --template <template>

// any npm version
npx create-nollup-app --name <project-name> --template <template>
```

<img src="https://user-images.githubusercontent.com/6637882/111074224-f0f09380-84d9-11eb-9f9e-8a7b2c3d5bb4.gif" width="500">

## Examples

The examples show different features of Nollup, including examples for React and Preact based projects with HMR. They also demonstrate how to use Nollup in development and Rollup to build production builds.
Highly recommended to check them out [here](./examples).

## Hot Module Replacement

See documentation about Hot Module Replacement [here](./docs/hmr.md).

## Supported Rollup Config Options

See documentation about supported Rollup config options [here](./docs/rollup-config.md).

## Nollup Plugins

Some Rollup plugins provide additional support for Nollup projects. 
You can find the list [here](./docs/plugins.md).

## Nollup Plugin Hooks

Nollup provides additional plugin hooks for plugin authors to implement features such as HMR. See more information [here](./docs/nollup-hooks.md).

## Live Bindings

For performance reasons, by default Nollup does not enable ESM live-bindings (but still supports circular dependencies). If you require live-bindings or are running into an issue where something imported is undefined, you can enable live-bindings. See more information [here](./docs/live-bindings.md).

## Caveats

* Only Rollup configurations that make sense in development are implemented.
* Might be some inconsistencies with Rollup, but should be fine for majority of projects.
* May be issues with circular dependencies. See [here](./docs/circular.md) for more information.
