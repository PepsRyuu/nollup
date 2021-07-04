# Circular Dependencies

While Nollup does its best to resolve circular dependencies at the moment, there are still situations which have not been fully fixed yet. To ensure circular dependencies work, ESM when parsing a module, scans that module for all export bindings, and will hoist all of the declarations, but will not run any code. This behaviour has not been implemented yet. See below on how to workaround this issue, and further information on how ESM handles circular dependencies.

## How to Workaround

Usually this problem occurs with large third-party packages. Some packages, instead of bundling their code into a single module for use in ESM environments, they instead package their source code and point ```module``` inside their ```package.json``` to their source directory. However, these packages often include bundled versions of their code. You can redirect to these bundles by using a plugin such as ```@rollup/plugin-alias```, which will avoid the circular dependencies. Depending on the package, you may need to use an additional plugin such as ```@rollup/plugin-commonjs```.

```
node_modules/
    my_library/
        package.json
        dist/
            my-library.cjs.js
            my-library.umd.js
        src/
            main.js
            somefile.js
            anotherfile.js
            ...
```

```
{
    "name": "my-library",
    "main": "dist/my-library.cjs.js",
    "browser": "dist/my-library.umd.js",
    "module": "src/main.js"
}
```

```
alias({
    entries: [
        { find: 'my-library', replacement: require.resolve('my-library') }
    ]
})
```

Another option, especially if the library is rather large, is to not bundle the library at all, but instead to use a CDN or any other external storage separate from your app. Not only does it solve the problem of working around the circular dependency, but it may also significantly improve the bundling performance of your application:

```
<script src="https://example.com/cdn/my-library.umd.js"></script>
<script src="my-app.js"></script>
```

On a side note, packages that don't bundle their code for ESM environments are very inefficient. Because the files are separated, Nollup has to load and parse each file independently, which is costly in terms of compiling performance. I'd encourage all library authors to consider bundling their ESM code into an equivalent ```dist/my-library.esm.js``` file.

## How ESM Circular Works

**Example 1**

```
// A.js
import B from './B';

console.log('A');
export function print (msg) {
    console.log(msg);
}

// B.js
import { print } from './A';

console.log('B');
export default print('hello');

// Output
"B"
"hello"
"A"
```

In this example, notice how B was able to use the ```print``` function, despite ```A.js``` not being executed, as you can see due to ```A``` being printed last. This is because ```print``` is a function declaration, and when ESM parses modules, function declarations are hoisted and exported immediately.

**Example 2**

```
// A.js
import B from './B';

console.log('A');
export var print = function (msg) {
    console.log(msg);
}

// B.js
import { print } from './A';

console.log('B');
export default print('hello');

// Output
"B"
"Uncaught TypeError: print is not a function"
```

For this example, although the ```print``` variable declaration will be hoisted, the implementation of the function will not occur until the module has been executed. Therefore, if ```B``` tries to use this function, it will be trying to execute ```undefined```.

**Example 3**

```
// A.js
import B from './B';

console.log('A');
var prefix = '[INFO] ';

function print (msg) {
    console.log(prefix + msg);
}

export { print };

// B.js
import { print } from './A';

console.log('B');
export default print('hello');

// Output
"B"
"undefinedhello"
"A"
```

In this final example, although we didn't immediately export ```print```, because it was exported later in the module and is a function declaration, we can use it. However, notice that ```print``` points to a ```prefix``` variable. Because the module has not been executed, that value will be ```undefined```.