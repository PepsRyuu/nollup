# Example Project

An example project that demonstrates the usage of Nollup.

Features the following:

* Uses Preact for components.
* Has a few basic components with CSS.
* Uses Express to serve content along with Nollup Dev Server.
* Build script that uses Rollup with the same configuration.
* Custom Rollup plugin for loading styles from a link tag.
* Styles supports Hot Module Replacement (HMR).
* A rough version of how to support Hot Module Replacement for JavaScript is demonstrated.

See ```package.json``` on how to run and build.

## Rough performance information

On an early 2013 15" Macbook Pro:

First compile time: ~220ms
Hot reload compile time: ~12ms