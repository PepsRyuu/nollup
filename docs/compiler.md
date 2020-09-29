# Nollup Compiler API

The compiler API is the lowest level available for working with Nollup. It is modelled after the Rollup API and can be swapped directly with each other. This API is intended for plugin authors to test their plugins in both Rollup and Nollup easily, and also for those who wish to create their own middleware.

The compiler API does not start any web server, and does not provide HMR functionality. That's up the developer to implement.

You can import the Nollup compiler using the following:

```
let Nollup = require('nollup');
```

Then you can use Nollup in the same way you would use Rollup's API:

```
async function build () {
    // Prepare instance of nollup
    let bundle = await nollup(inputOptions);

    // Generate code
    let { output } = await bundle.generate(outputOptions);

    // Unlike Rollup, there's no write method.
    // Code should be served from memory.
}

build();
```

There's no ```bundle.write()``` function because development servers should not be writing to disk.

## API

***Object* nollup(*Object* rollupConfig)**

Receives a standard Rollup configuration with ```input``` and ```plugins```.
It returns a bundle object from which you can call the methods below.

***Promise<Object>* bundle.generate(*Object* outputOptions)**

The ```bundle.generate()``` function returns the following properties:

* ```Object stats``` - Contains timing for bundle generation.
* ```Array<Object> changes``` - Contained changed modules.
* ```Array<Object> output``` - Same as Rollup, contains all generated files.

***void* bundle.invalidate(*String* filePath)**

Invalidating marks the module that matches the provided filepath, so when ```generate()``` is called again, it will only compile that one module and rely on the cache for all other modules.

```watchChange``` plugin hook will also be triggered passing the module id.

***void* bundle.configure(*Object* options)**

Configure Nollup compiler options. Pass an object with any of the below options:

* ```Boolean liveBindings``` - Enable live-bindings in the compiled code.

