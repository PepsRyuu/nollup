# Live Bindings

ES Modules provides a feature called live bindings. When you import from a module, you're not importing a copy or a reference to that export, you're importing a "binding". If the exporter changes the value of an export, that change will be reflected in the imported version. This feature primarily exists as a means to solve circular dependencies with ES modules.

**counter.js**
```
export var count = 0;

export function increment () {
    count++;
}
```

**main.js**
```
import { count, increment } from './counter.js';

console.log(count); // 0
increment();
console.log(count); // 1
```

Unfortunately, when bundling modules together, we lose this ability and have to simulate it. Rollup simulates this feature by using Scope Hoisting. In other words, Rollup combines the modules together into a single module, so all references to an export are pointing to the same declaration, therefore simulating live-bindings.

Scope Hoisting is an expensive process, and typically only done during production compilation. Nollup like other development bundlers, wraps each module into its own function scope, and concatenates those function scopes together into a single bundle. This is very fast to do, but it means that live-bindings are gone, so another way of simulating them needs to be achieved.

By default, for performance reasons, Nollup doesn't enable live-bindings. It's a rarely used feature, and circular dependencies can be solved without the need for live-bindings. However, there may be times when you do need it. To help with those cases, Nollup provides the ```liveBindings``` flag.

**.nolluprc.js**
```
liveBindings: true | "with-scope" | "reference"
```

**CLI**

```
nollup -c --live-bindings
```

## Reference

This is the default mode if using ```liveBindings: true```, or if set to ```reference```.

This mode will traverse the abstract syntax tree for each file, scanning for usages of an import. This is more complicated than it sounds, because there may be other variables that conflict with the import, and the import identifier may be used in different contexts that don't actually reference the import. 

Below is how Nollup will convert live-bindings in this mode:

```
// inside module
var count = 0; __e__('count', () => count);

// What the export is doing
Object.defineProperty(module.exports, 'count', {
    get: () => count,
    enumerable: true
});
```

```
// defined outside module code
var __i__ = {};
Object.defineProperty(__i__, 'count', {
    get() { return _i0().count; }
});

// inside module code
console.log(__i__.count); // 0
__i__.increment();
console.log(__i__.count); // 1
```

**Pros:**

* Closest to simulating ES modules live-bindings.
* Native dynamic import() can be used to import chunks.
* Supports bundles that export something at the very end.
* Can be used with type="module" script tags.

**Cons:**

* Breaks debugging symbols. Hovering over "count" in the source map won't show anything.
* It can be costly to scan the AST for usages of the bindings.
* May not be compatible with latest JavaScript syntax. 

## With Scope

This is enabled by setting ```liveBindings: "with-scope"```.

This option is very much experimental, but it's another solution to implementing live-bindings. If you're not familiar with ```with``` blocks, it's a very old feature of JavaScript that's not used for very good reason, it creates confusing code. ```with``` blocks make all properties on an object accessible as if they were normal variables. This can lead to some very ambiguous situations.

```
function f(x, o) {
    with (o) {
        console.log(x); // is this o.x, or the x param?
    }
}
```

However, it can be possible to use this to simulate live-bindings. Below is how Nollup converts live-bindings using ```with``` scope:

```
// inside module
var count = 0; __e__('count', () => count);

// What the export is doing
Object.defineProperty(module.exports, 'count', {
    get: () => count,
    enumerable: true
});
```

```
// defined outside module code
var __i__ = {};
Object.defineProperty(__i__, 'count', {
    get() { return _i0().count; }
});

// inside module code
with (__i__) {
    console.log(count);
    increment();
    console.log(count);
}
```

**Pros:**

* Very fast, no need to traverse the AST and do conversions of symbols.
* Keeps debugging symbols intact.
* Will always work with latest JavaScript standards.

**Cons:**

* Cannot be used in strict mode. 
* Needs to use fetch and eval for dynamic import() as that will try to evaluate as strict.
* May incur runtime performance penalty as each variable used has to be checked as an object property.
* Cannot have the bundle export anything.
* Cannot use type="module" when importing the bundle.
* Cannot have external imports.
