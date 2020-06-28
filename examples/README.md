# Examples

## Getting Started

* ```npm install``` to install all of the dependencies.
* ```npm start``` will run the Nollup dev server.
* ```npm run build``` will use Rollup to generate a production bundle.

## example-preact

* Uses Preact as the base framework.
* Supports HMR using ```prefresh```.
* Supports HMR for CSS styles.
* Config shows how to use different plugins for dev and prod.
* Note that plugins never write to disk during dev.

## example-react-refresh

* Uses React as the base framework.
* Supports HMR using ```react-refresh```.
* Supports HMR for CSS styles.
* Uses CommonJS plugins that supports HMR by not parsing out dynamic ```require``` calls.
* The alternative CJS plugin also allows for ```require``` inside ES modules.
* Uses replace plugin because of ```process.env.NODE_ENV``` not existing in browsers.

## example-react-hot-loader

* Uses React as the base framework.
* Supports HMR using the old ```react-hot-loader```.
* Supports HMR for CSS styles.
* See above about CJS plugin.

## example-dynamic-import

* Uses React as the base framework.
* Uses dynamic import to generate separate file.
* Demonstrates HMR working across multiple generated JavaScript chunks.

## example-multi-bundle

* Demonstrates Nollup CLI supporting multiple bundles to be generated.
* Both bundles are able to use HMR.

## example-emit-chunk

* Demonstrates the ```emitFile``` API to emit a custom chunk.
* Custom chunk is created using a custom plugin to emit web workers as separate files.

## example-globals

* Demonstrates ```external``` option to access global variables in ```iife``` format.

## example-circular

* Demonstrates big libraries with circular dependencies (```moment```) working in Nollup.

## example-public-path

* Demonstrates how to use ```publicPath``` for enabling single page applications to work in a subdirectory.

## example-single-file-bundle

* Although not recommended, Nollup works with the old Rollup style projects that emit to the ```public``` directory.