# Hot Module Replacement

To generate development bundles, Nollup wraps each module into its own function scope. This allows Nollup to compile modules independently of the rest of the bundle, and allows updated code snippets to be sent over a websocket. While using the built-in dev middleware (server or CLI), Nollup will set up the websocket server for you, and will send the code changes to the browser. However, it is up to the developer to listen for those changes and react to them.

Each module has access to ```require``` and ```module```. Many HMR frameworks usually assume these exist because they support Webpack or Parcel. Nollup follows this convention and implements them as well. Note, these are not to be used as replacements for ES ```import``` and ```export```. Their functionality is restricted to supporting HMR only.

## API

* ```Object require(Number moduleId)``` - Import a module with the specified ID. This ID is auto-generated during bundling.
* ```Object module``` - Contains information about the current module.
    * ```Number id``` - The ID of this module inside the bundle.
    * ```Array<Number> dependencies``` - The dependencies for this module.
    * ```Array<Number> dynamicDependencies``` - Dependencies imported with ```import()```.
    * ```Object exports``` - Contains named exports and default export.
    * ```Boolean invalidate``` - If module is to be reloaded when required, set this to true.

## Hot API

When ```--hot``` is enabled, ```module.hot``` will be available. It provides the following properties:

***void* accept(*Function* callback)**

Executes when the current module, or a dependency has been replaced.
Passes ```e``` argument which an object containing information about the accept.
The object contains the following:

* ```disposed``` - Contains list of module ids disposed when bubbling to this accept handler.

Note that in order for the module to be resolved, you must call ```require(module.id)``` inside the callback.
This is slightly different from the way that other bundlers operates, which auto-requires before calling the accept handler.
Due to backwards compatibility, this cannot be changed at the moment.

However, if you call this function without passing a callback, it will auto-require the module.

***void* dispose(*Function* callback)**

Executes when the module is about to be replaced.
Callback receives ```data``` object. When the module is reloaded,
this data can be read using ```module.hot.data```.

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

In your build configuration, if your code includes ```module```, it may be necessary to explicitly inform Rollup to remove all references to ```module```, otherwise your application may break when compiled with Rollup. This can be done using a plugin such as ```rollup-plugin-terser```. If your HMR is provided by a Rollup plugin, this probably isn't necessary.

```
terser({
    compress: {
        global_defs: {
            module: false
        }
    }
});
```