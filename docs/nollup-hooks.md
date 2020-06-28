# Nollup Plugin Hooks

Nollup provides additional plugin hooks for plugins. This allows features like HMR to be implemented. 

***String* nollupBundleInit()**

Injected into the bundle before the first module in the bundle is required.
It has access to ```instances``` and ```modules```.

```instances``` is an array of instantiated modules. Each module has the following properties:

* ```Number id``` - The ID of the module that it was instantiated from.
* ```Object exports``` - Export code from the module.
* ```Array<Number> dependencies``` - Module IDs this module depends on.
* ```Array<Number> dynamicDependencies``` - Dependencies imported by ```import()```.
* ```Boolean invalidate``` - If set to true, the module will be invalidated and executed again when required.

```modules``` is an object of module IDs with their code.

***String* nollupModuleInit()**

Injected into the bundle before a module is instantiated.  
It has access to ```instances```, ```modules``` and ```module``` which is the module being instantiated.

***String* nollupModuleWrap()**

Wrap a module instantiation code with additional code. 
Useful for libraries providing Hot Module Replacement and need to add commonly functionality to all modules.
It has access to ```instances```, ```modules``` and ```module``` which is the module being wrapped.