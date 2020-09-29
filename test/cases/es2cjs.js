let es_to_cjs = require('../../lib/impl/ImportExportResolver');
let live_bindings_resolver = require('../../lib/impl/LiveBindingsResolver');
let { expect } = require('../nollup');
let path = require('path');

let tests = [{
    input: 'import Hello from \'./world\';',
    output: {
        code: '',
        imports: [{
            source: './world',
            importee: '_i0',
            specifiers: [{
                local: 'Hello',
                imported: 'default'
            }]
        }]
    }
}, {
    input: 'import \'./styles.css\';',
    output: {
        imports: [{
            source: './styles.css',
            importee: '_i0',
            specifiers: []
        }]
    }
}, {
    input: 'import {member} from "./file";',
    output: {
        imports: [{
            source: './file',
            importee: '_i0',
            specifiers: [{
                local: 'member',
                imported: 'member'
            }]
        }]
    }
}, {
    input: 'import { member } from "./file";',
    output: {
        imports: [{
            source: './file',
            importee: '_i0',
            specifiers: [{
                local: 'member',
                imported: 'member'
            }]
        }]
    }
}, {
    input: 'import {mem1, mem2} from "./file";',
    output: {
        imports: [{
            source: './file',
            importee: '_i0',
            specifiers: [{
                local: 'mem1',
                imported: 'mem1'
            }, {
                local: 'mem2',
                imported: 'mem2'
            }]
        }]
    }
}, {
    input: 'import {member as lol} from "./file";',
    output: {
        imports: [{
            source: './file',
            importee: '_i0',
            specifiers: [{
                local: 'lol',
                imported: 'member'
            }]
        }]
    }
}, {
    input: 'import * as lol from "./file";',
    output: {
        imports: [{
            source: './file',
            importee: '_i0',
            specifiers: [{
                local: 'lol',
                imported: '*'
            }]
        }]
    }
}, {
    input: 'import Hello, * as World from "./file";',
    output: {
        imports: [{
            source: './file',
            importee: '_i0',
            specifiers: [{
                local: 'Hello',
                imported: 'default'
            }, {
                local: 'World',
                imported: '*'
            }]
        }]
    }
}, {
    input: 'export default Hello;',
    output: {
        exports: ['default'],
        code: `__e__('default', function () { return Hello });;`
    }
}, {
    input: 'export default Hello',
    output: {
        exports: ['default'],
        code: `__e__('default', function () { return Hello });`
    }
}, {
    input: 'export default 123;',
    output: {
        exports: ['default'],
        code: `__e__('default', function () { return 123 });;`
    }
}, {
    input: 'export default () => {};',
    output: {
        exports: ['default'],
        code: `__e__('default', function () { return () => {} });;`
    }
}, {
    input: 'export default () => {}',
    output: {
        exports: ['default'],
        code: `__e__('default', function () { return () => {} });`
    }
}, {
    input: 'export default (() => {});',
    output: {
        exports: ['default'],
        code: `__e__('default', function () { return (() => {}) });;`
    }
}, {
    input: 'export default(() => {});',
    output: {
        exports: ['default'],
        code: `__e__('default', function () { return (() => {}) });;`
    }
}, {
    input: 'export default(() => {})',
    output: {
        exports: ['default'],
        code: `__e__('default', function () { return (() => {}) });`
    }
}, {
    input: 'let hello = 123;export default function () {}export { hello }',
    output: {
        exports: ['default', 'hello'],
        code: `let hello = 123;__e__('default', function () { return function () {} }); __e__('hello', function () { return hello });`
    }
}, {
    input: 'export default(() => {});export let hello = 123;',
    output: {
        exports: ['default', 'hello'],
        code: `__e__('default', function () { return (() => {}) });;let hello = 123;; __e__('hello', function () { return hello });`
    }
}, {
    input: 'export default function(){}export let hello = 123;',
    output: {
        exports: ['default', 'hello'],
        code: `__e__('default', function () { return function(){} });let hello = 123;; __e__('hello', function () { return hello });`
    }
}, {
    input: 'export let hello = 123;export let world = 456;',
    output: {
        exports: ['hello', 'world'],
        code: `let hello = 123;; __e__('hello', function () { return hello });let world = 456;; __e__('world', function () { return world });`
    }
},  {
    input: 'export default class Hello {};',
    output: {
        exports: ['default'],
        code: `class Hello {}; __e__('default', function () { return Hello });;`
    }
}, {
    input: 'export default class Hello {}',
    output: {
        exports: ['default'],
        code: `class Hello {}; __e__('default', function () { return Hello });`
    }
}, {
    input: 'export class Hello {};',
    output: {
        exports: ['Hello'],
        code: `class Hello {}; __e__('Hello', function () { return Hello });;`
    }
}, {
    input: 'export class Hello {}',
    output: {
        exports: ['Hello'],
        code: `class Hello {}; __e__('Hello', function () { return Hello });`
    }
}, {
    input: 'export function Hello () {};',
    output: {
        exports: ['Hello'],
        code: `function Hello () {}; __e__('Hello', function () { return Hello });;`
    }
}, {
    input: 'let name1 = 123, name2 = 456; export {name1, name2};',
    output: {
        exports: ['name1', 'name2'],
        code: `let name1 = 123, name2 = 456; __e__('name1', function () { return name1 });__e__('name2', function () { return name2 });`
    }
}, {
    input: 'let hello = 123, name = 456; export {hello as world, name};',
    output: {
        exports: ['world', 'name'],
        code: `let hello = 123, name = 456; __e__('world', function () { return hello });__e__('name', function () { return name });`
    }
}, {
    input: 'export var MyVar1 = 123;',
    output: {
        exports: ['MyVar1'],
        code: `var MyVar1 = 123;; __e__('MyVar1', function () { return MyVar1 });`
    }
}, {
    input: 'export var MyVar1 = () => {}, MyVar2 = 456;',
    output: {
        exports: ['MyVar1', 'MyVar2'],
        code: `var MyVar1 = () => {}, MyVar2 = 456;; __e__('MyVar1', function () { return MyVar1 }), __e__('MyVar2', function () { return MyVar2 });`
    }
}, {
    input: 'export var MyVar1 = () => {}, MyVar2 = 456',
    output: {
        exports: ['MyVar1', 'MyVar2'],
        code: `var MyVar1 = () => {}, MyVar2 = 456; __e__('MyVar1', function () { return MyVar1 }), __e__('MyVar2', function () { return MyVar2 });`
    }
}, {
    input: 'export const MyVar1 = () => {}, MyVar2 = 456;',
    output: {
        exports: ['MyVar1', 'MyVar2'],
        code: `const MyVar1 = () => {}, MyVar2 = 456;; __e__('MyVar1', function () { return MyVar1 }), __e__('MyVar2', function () { return MyVar2 });`
    }
}, {
    input: 'export { MyVar } from "./file"',
    output: {
        imports: [{
            source: './file',
            importee: '_i0',
            specifiers: [{
                local: 'ex_MyVar',
                imported: 'MyVar',
                exportFrom: true
            }]
        }],
        exports: ['MyVar'],
        code: ``
    }
}, {
    input: 'export { default } from "./file";',
    output: {
        imports: [{
            source: './file',
            importee: '_i0',
            specifiers: [{
                local: 'ex_default',
                imported: 'default',
                exportFrom: true
            }]
        }],
        exports: ['default'],
        code: ``
    }
}, {
    input: 'export * from "./file"',
    output: {
        imports: [{
            source: './file',
            importee: '_i0',
            specifiers: [{
                local: 'ex_i0',
                imported: '*',
                exportFrom: true
            }]
        }],
        exports: [],
        code: ``
    }
}, {
    input: 'import Hello from "hello";import World from "world";',
    output: {
        imports: [{
            source: 'hello',
            importee: '_i0',
            specifiers: [{
                local: 'Hello',
                imported: 'default'
            }]
        }, {
            source: 'world',
            importee: '_i1',
            specifiers: [{
                local: 'World',
                imported: 'default'
            }]
        }]
    }
}, {
    input: 'export const { foo, bar } = myvar;',
    output: {
        exports: ['foo', 'bar'],
        code: `const { foo, bar } = myvar;; __e__('foo', function () { return foo }), __e__('bar', function () { return bar });`
    }
}, {
    input: 'export const { foo: hello, bar: world } = myvar;',
    output: {
        exports: ['hello', 'world'],
        code: `const { foo: hello, bar: world } = myvar;; __e__('hello', function () { return hello }), __e__('world', function () { return world });`
    }
}, {
    input: 'export const { foo, bar } = myvar, hello = 123;',
    output: {
        exports: ['foo', 'bar', 'hello'],
        code: `const { foo, bar } = myvar, hello = 123;; __e__('foo', function () { return foo }), __e__('bar', function () { return bar }), __e__('hello', function () { return hello });`
    }
}, {
    input: 'export {};',
    output: {
        exports: [],
        code: ``
    }
}];

describe ('es_to_cjs', () => {
    tests.forEach(test => {
        it(test.input, async () => {
             test.output = {
                code: '',
                imports: [],
                exports: [],
                dynamicImports: [],
                externalDynamicImports: [],
                ...test.output
            };

            let res = await es_to_cjs({ plugins: [] }, test.input, process.cwd() + '/__entry');
            let to_check = {};
            for (let key in test.output) {
                to_check[key] = res[key];
            }

            to_check.code = to_check.code.trim().replace(/\s+/g, ' ');

            test.output.imports = test.output.imports.map(dep => {
                dep.source = path.resolve(process.cwd(), dep.source + (!path.extname(dep.source)? '.js' : ''));
                return dep;
            });

            try {
                expect(to_check).to.deep.equal(test.output);
            } catch (e) {
                throw new Error(`
                    Expected: ${JSON.stringify(test.output)}
                    Actual: ${JSON.stringify(res)}
                `)
            }
        });
    })
});

let external_tests = [{
    input: 'import jQuery from "jquery";',
    output: {
        code: '',
        imports: [],
        externalImports: [{
            source: 'jquery',
            importee: '__nollup__external__jquery__',
            specifiers: [{
                local: 'jQuery',
                imported: 'default'
            }]
        }]
    },
    config: {
        external: ['jquery']
    }
}, {
    input: 'import $ from "jquery";',
    output: {
        code: '',
        imports: [],
        externalImports: [{
            source: 'jquery',
            importee: '__nollup__external__jquery__',
            specifiers: [{
                local: '$',
                imported: 'default'
            }]
        }]
    },
    config: {
        external: ['jquery']
    }
}, {
    input: 'import jquery from "jquery";',
    output: {
        code: '',
        imports: [],
        externalImports: [{
            source: 'jquery',
            importee: '__nollup__external__jquery__',
            specifiers: [{
                local: 'jquery',
                imported: 'default'
            }]
        }]
    },
    config: {
        external: ['jquery'],
        output: {
            globals: {
                'jquery': '$'
            }
        }
    }
}, {
    input: 'import { max } from "Math";',
    output: {
        code: '',
        imports: [],
        externalImports: [{
            source: 'Math',
            importee: '__nollup__external__Math__',
            specifiers: [{
                local: 'max',
                imported: 'max'
            }]
        }]
    },
    config: {
        external: ['Math']
    }
},{
    input: 'import { max, min } from "Math";',
    output: {
        code: '',
        imports: [],
        externalImports: [{
            source: 'Math',
            importee: '__nollup__external__Math__',
            specifiers: [{
                local: 'max',
                imported: 'max'
            }, {
                local: 'min',
                imported: 'min'
            }]
        }]
    },
    config: {
        external: ['Math']
    }
}, {
    input: 'import $, { ajax } from "jquery";',
    output: {
        code: '',
        imports: [],
        externalImports: [{
            source: 'jquery',
            importee: '__nollup__external__jquery__',
            specifiers: [{
                local: '$',
                imported: 'default'
            }, {
                local: 'ajax',
                imported: 'ajax'
            }]
        }]
    },
    config: {
        external: ['jquery']
    }
}, {
    input: 'import { ajax as net } from "jquery";',
    output: {
        code: '',
        imports: [],
        externalImports: [{
            source: 'jquery',
            importee: '__nollup__external__jquery__',
            specifiers: [{
                local: 'net',
                imported: 'ajax'
            }]
        }]
    },
    config: {
        external: ['jquery'],
        output: {
            globals: {
                'jquery': '$'
            }
        }
    }
}, {
    input: 'export { ajax } from "jquery";',
    output: {
        code: ``,
        imports: [],
        exports: ['ajax'],
        externalImports: [{
            source: 'jquery',
            importee: '__nollup__external__jquery__',
            specifiers: [{
                local: 'ex_ajax',
                imported: 'ajax',
                exportFrom: true
            }]
        }]
    },
    config: {
        external: ['jquery']
    }
}, {
    input: 'export { ajax } from "jquery";',
    output: {
        code: ``,
        imports: [],
        exports: ['ajax'],
        externalImports: [{
            source: 'jquery',
            importee: '__nollup__external__jquery__',
            specifiers: [{
                local: 'ex_ajax',
                imported: 'ajax',
                exportFrom: true
            }]
        }]
    },
    config: {
        external: ['jquery'],
        output: {
            globals: {
                'jquery': '$'
            }
        }
    }
}, {
    input: 'export { ajax as net} from "jquery";',
    output: {
        code: ``,
        imports: [],
        exports: ['net'],
        externalImports: [{
            source: 'jquery',
            importee: '__nollup__external__jquery__',
            specifiers: [{
                local: 'ex_net',
                imported: 'ajax',
                exportFrom: true
            }]
        }]
    },
    config: {
        external: ['jquery'],
        output: {
            globals: {
                'jquery': '$'
            }
        }
    }
}, {
    input: 'export * from "jquery";',
    output: {
        code: ``,
        imports: [],
        exports: [],
        externalImports: [{
            source: 'jquery',
            importee: '__nollup__external__jquery__',
            specifiers: [{
                local: 'ex__nollup__external__jquery__',
                imported: '*',
                exportFrom: true
            }]
        }]
    },
    config: {
        external: ['jquery']
    }
}, {
    input: 'export * from "jquery";',
    output: {
        code: ``,
        imports: [],
        exports: [],
        externalImports: [{
            source: 'jquery',
            importee: '__nollup__external__jquery__',
            specifiers: [{
                local: 'ex__nollup__external__jquery__',
                imported: '*',
                exportFrom: true
            }]
        }]
    },
    config: {
        external: ['jquery'],
        output: {
            globals: {
                'jquery': '$'
            }
        }
    }
}, {
    input: 'import { ajax } from "jquery";',
    output: {
        code: ``,
        imports: [],
        externalImports: [{
            source: 'jquery',
            importee: '__nollup__external__jquery__',
            specifiers: [{
                local: 'ajax',
                imported: 'ajax'
            }]
        }]
    },
    config: {
        external: id => /jquery/.test(id)
    }
}, {
    input: 'import { ajax } from "some/other/dep";',
    output: {
        code: ``,
        imports: [],
        externalImports: [{
            source: 'some/other/dep',
            importee: '__nollup__external__some_other_dep__',
            specifiers: [{
                local: 'ajax',
                imported: 'ajax'
            }]
        }]
    },
    config: {
        external: id => /some\/other\/dep/.test(id)
    }
}]



describe('es_to_cs_externals (ESM)', () => {
    external_tests.forEach(test => {
        it(test.input, async () => {
            let res = await es_to_cjs({
                ...test.config, 
                plugins: [],
                output: { ...test.config.output, format: 'esm' }
            }, test.input, process.cwd() + '/__entry');
            let to_check = {}; 

            for (let key in test.output) {
                to_check[key] = res[key];
            }

            to_check.code = to_check.code.trim().replace(/\s+/g, ' ');

            try {
                expect(to_check).to.deep.equal(test.output);
            } catch (e) {
                throw new Error(`
                    Expected: ${JSON.stringify(test.output)}
                    Actual: ${JSON.stringify(res)}
                `)
            }
        });
    })
});

describe('misc transform issues', () => {
    it ('should not fail on null nodes', async () => {
        let res = await es_to_cjs({ plugins: [] }, `
            import Hello from './World';
            let a = [1, 2, , 4];
        `,  process.cwd() + '/__entry');
        expect(res.code.indexOf('[1, 2, , 4]') > -1).to.be.true;
    });

    it ('should properly blank two imports without semi-colons', async () => {
        let res = await es_to_cjs({ plugins: [] }, [
            'import Hello from "hello"',
            'import World from "world"',
            'console.log(Hello, World)'
        ].join('\n'), process.cwd() + '/_entry');
        expect(res.code).to.equal([
            '                         ',
            '                         ',
            'console.log(Hello, World)'
        ].join('\n'));
    });

    it ('should properly blank two imports on the same line', async () => {
        let res = await es_to_cjs({ plugins: [] }, [
            'import Hello from "hello";import World from "world"',
            'console.log(Hello, World)'
        ].join('\n'), process.cwd() + '/_entry');
        expect(res.code).to.equal([
            '                                                   ',
            'console.log(Hello, World)'
        ].join('\n'));
    });


    it ('should properly blank imports that span multiple lines', async () => {
        let res = await es_to_cjs({ plugins: [] }, [
            'import {',
            '   Hello',
            '} from "hello";',
            'import {',
            '   World',
            '} from "world";',
            'console.log(Hello, World)'
        ].join('\n'), process.cwd() + '/_entry');
        expect(res.code).to.equal([
            '        ',
            '        ',
            '               ',
            '        ',
            '        ',
            '               ',
            'console.log(Hello, World)'
        ].join('\n'));
    });

    it ('should properly blank export {} blocks', async () => {
        let res = await es_to_cjs({ plugins: [] }, [
            'var Hello, World, Foo, Bar;',
            'export { Hello, World }',
            'export { Foo, Bar };',
            'console.log(Hello, World)'
        ].join('\n'), process.cwd() + '/_entry');
        expect(res.code).to.equal([
            'var Hello, World, Foo, Bar;',
            '                       __e__(\'Hello\', function () { return Hello });__e__(\'World\', function () { return World });',
            '                    __e__(\'Foo\', function () { return Foo });__e__(\'Bar\', function () { return Bar });',
            'console.log(Hello, World)'
        ].join('\n'));
    });

    it ('should properly blank export {} blocks over multiple lines with padding', async () => {
        let res = await es_to_cjs({ plugins: [] }, [
            'var Hello, World, Foo, Bar;',
            'export {                   ',
            '    Hello,                 ',
            '    World                  ',
            '}                          ',
            'console.log(Hello, World)'
        ].join('\n'), process.cwd() + '/_entry');
        expect(res.code).to.equal([
            'var Hello, World, Foo, Bar;',
            '                           ',
            '                           ',
            '                           ',
            ' __e__(\'Hello\', function () { return Hello });__e__(\'World\', function () { return World });                          ',
            'console.log(Hello, World)'
        ].join('\n'));
    });
});

describe ('Export Live Bindings', () => {
    it ('should only export when export is assigned for declarations', async () => {
        let res = await es_to_cjs({ plugins: [] }, [
            'export let hello;',
            'hello = 123;'
        ].join('\n'), process.cwd() + '/_entry');
        expect(res.code).to.equal([
            'let hello;; ;',
            'hello = 123;;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });'
        ].join('\n'));
    });

    it ('should work for multiple exports', async () => {
        let res = await es_to_cjs({ plugins: [] }, [
            'export let hello;',
            'hello = 123;',
            'export let world;',
            'world = 456;'
        ].join('\n'), process.cwd() + '/_entry');
        expect(res.code).to.equal([
            'let hello;; ;',
            'hello = 123;;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });',
            'let world;; ;',
            'world = 456;;__e__(\'world\', function () { return typeof world !== \'undefined\' && world });'
        ].join('\n'));
    });

    it ('should support inline assignments', async () => {
        let res = await es_to_cjs({ plugins: [] }, [
            'export let hello;',
            '(function () {})(hello || (hello = 123))'
        ].join('\n'), process.cwd() + '/_entry');
        expect(res.code).to.equal([
            'let hello;; ;',
            '(function () {})(hello || (hello = 123));__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });'
        ].join('\n'));
    });

    it ('should support inline assignments 2', async () => {
        let res = await es_to_cjs({ plugins: [] }, [
            'export let hello;',
            '(function () {})(hello || (hello = 123));'
        ].join('\n'), process.cwd() + '/_entry');
        expect(res.code).to.equal([
            'let hello;; ;',
            '(function () {})(hello || (hello = 123));;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });'
        ].join('\n'));
    });

    it ('should not fail when found inside shadowing function expression', async () => {
        let res = await es_to_cjs({ plugins: [] }, [
            'export let hello;',
            '(function (hello) { hello = 123 })();',
            'hello = 123'
        ].join('\n'), process.cwd() + '/_entry');
        expect(res.code).to.equal([
            'let hello;; ;',
            '(function (hello) { hello = 123 })();;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });',
            'hello = 123;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });'
        ].join('\n'));
    });

    it ('should not fail when found inside shadowing function expression for multiple exports', async () => {
        let res = await es_to_cjs({ plugins: [] }, [
            'export let hello;',
            'export let world;',
            '(function (hello) { hello = 123 })();',
            '(function (world) { world = 123 })();',
            'hello = 123',
            'world = 456'
        ].join('\n'), process.cwd() + '/_entry');
        expect(res.code).to.equal([
            'let hello;; ;',
            'let world;; ;',
            '(function (hello) { hello = 123 })();;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });',
            '(function (world) { world = 123 })();;__e__(\'world\', function () { return typeof world !== \'undefined\' && world });',
            'hello = 123;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });',
            'world = 456;__e__(\'world\', function () { return typeof world !== \'undefined\' && world });'
        ].join('\n'));
    });

    it ('should not fail when exported after shadowed function statement', async () => {
        let res = await es_to_cjs({ plugins: [] }, [
            'function print (hello) { hello = 123 }',
            'export let hello;',
            'hello = 123'
        ].join('\n'), process.cwd() + '/_entry');
        expect(res.code).to.equal([
            'function print (hello) { hello = 123 };__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });',
            'let hello;; ;',
            'hello = 123;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });'
        ].join('\n'));
    });

    it ('should not fail when exported after shadowed arrow expression', async () => {
        let res = await es_to_cjs({ plugins: [] }, [
            '(hello => { hello = 123 })();',
            'export let hello;',
            'hello = 123'
        ].join('\n'), process.cwd() + '/_entry');
        expect(res.code).to.equal([
            '(hello => { hello = 123 })();;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });',
            'let hello;; ;',
            'hello = 123;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });'
        ].join('\n'));
    });

    it ('should not fail when shadowed in nested functions', async () => {
        let res = await es_to_cjs({ plugins: [] }, [
            'function parent (hello) {',
            '   function nested (hello) {',
            '       hello = 123;',
            '   }',
            '}',
            'export let hello;',
            'hello = 123'
        ].join('\n'), process.cwd() + '/_entry');
        expect(res.code).to.equal([
            'function parent (hello) {',
            '   function nested (hello) {',
            '       hello = 123;',
            '   }',
            '};__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });',
            'let hello;; ;',
            'hello = 123;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });'
        ].join('\n'));
    });
});

describe ('Import Live Bindings', () => {
    async function resolve (code) {
        let ctx = { plugins: [], liveBindings: true };
        let curr = process.cwd() + '/_entry';
        let res1 = await es_to_cjs(ctx, code.join('\n'), curr);
        let res2 = live_bindings_resolver(ctx, res1.code, curr, res1.imports);
        return res2.code;
    }

    it ('should change import usage to binding variable', async () => {
        let res = await resolve([
            'import MyVar1 from "./myfile";',
            'console.log(MyVar1);'
        ]);
        expect(res).to.equal([
            '                              ',
            'console.log(__i__["MyVar1"]);'
        ].join('\n'));
    });

    it ('should change import usage to binding variable for named', async () => {
        let res = await resolve([
            'import MyDefault, { MyVar1, MyVar2 } from "./myfile";',
            'console.log(MyDefault, MyVar1, MyVar2);'
        ]);
        expect(res).to.equal([
            '                                                     ',
            'console.log(__i__["MyDefault"], __i__["MyVar1"], __i__["MyVar2"]);'
        ].join('\n'));
    });

    it ('should allow shadowing by function declaration params', async () => {
        let res = await resolve([
            'import MyDefault, { MyVar } from "./myfile";',
            'function MyFunction (MyDefault) {',
            '    console.log(MyDefault, MyVar);',
            '}',
            'console.log(MyDefault);'
        ]);
        expect(res).to.equal([
            '                                            ',
            'function MyFunction (MyDefault) {',
            '    console.log(MyDefault, __i__["MyVar"]);',
            '}',
            'console.log(__i__["MyDefault"]);'
        ].join('\n'));
    });

    it ('should allow nested function shadowing', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function MyFunction () {',
            '    console.log(MyDefault);',
            '    function MyNestedFunction (MyDefault) {',
            '       console.log(MyDefault);',
            '    }',
            '}'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function MyFunction () {',
            '    console.log(__i__["MyDefault"]);',
            '    function MyNestedFunction (MyDefault) {',
            '       console.log(MyDefault);',
            '    }',
            '}'
        ].join('\n'));
    });

    it ('should allow shadowing by function expression params', async () => {
        let res = await resolve([
            'import MyDefault, { MyVar } from "./myfile";',
            'var MyFunction = function (MyDefault) {',
            '    console.log(MyDefault, MyVar);',
            '}',
            'console.log(MyDefault);'
        ]);
        expect(res).to.equal([
            '                                            ',
            'var MyFunction = function (MyDefault) {',
            '    console.log(MyDefault, __i__["MyVar"]);',
            '}',
            'console.log(__i__["MyDefault"]);'
        ].join('\n'));
    });

    it ('should allow shadowing by arrow function expression params', async () => {
        let res = await resolve([
            'import MyDefault, { MyVar } from "./myfile";',
            'var MyFunction = (MyDefault) => {',
            '    console.log(MyDefault, MyVar);',
            '}',
            'console.log(MyDefault);'
        ]);
        expect(res).to.equal([
            '                                            ',
            'var MyFunction = (MyDefault) => {',
            '    console.log(MyDefault, __i__["MyVar"]);',
            '}',
            'console.log(__i__["MyDefault"]);'
        ].join('\n'));
    });

    it ('should allow shadowing by var declaration in a block', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'console.log(MyDefault);',
            '{',
            '    console.log(MyDefault);',
            '    {',
            '       let MyDefault;',
            '       console.log(MyDefault)',
            '    }',
            '    console.log(MyDefault);',
            '}' 
        ]);
        expect(res).to.equal([
            '                                 ',
            'console.log(__i__["MyDefault"]);',
            '{',
            '    console.log(__i__["MyDefault"]);',
            '    {',
            '       let MyDefault;',
            '       console.log(MyDefault)',
            '    }',
            '    console.log(__i__["MyDefault"]);',
            '}' 
        ].join('\n'));
    });

    it ('should allow shadowing by local variable in function', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'console.log(MyDefault);',
            'function MyFunction () {',
            '    var MyDefault',
            '    console.log(MyDefault);',
            '}',
            'console.log(MyDefault)'
        ]);
        expect(res).to.equal([
            '                                 ',
            'console.log(__i__["MyDefault"]);',
            'function MyFunction () {',
            '    var MyDefault',
            '    console.log(MyDefault);',
            '}',
            'console.log(__i__["MyDefault"])'
        ].join('\n'));
    });

     it ('should support object declarations using a binding', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'var obj1 = { MyDefault }',
            'var obj2 = { Other: MyDefault }',
            'var obj3 = { MyDefault: MyDefault }',
            'var obj4 = { MyDefault: Other }'
        ]);
        expect(res).to.equal([
            '                                 ',
            'var obj1 = { MyDefault: __i__["MyDefault"] }',
            'var obj2 = { Other: __i__["MyDefault"] }',
            'var obj3 = { MyDefault: __i__["MyDefault"] }',
            'var obj4 = { MyDefault: Other }'
        ].join('\n'));
    });

    it ('should support export statement with a binding', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'export { MyDefault as MyDefault }'
        ]);
        expect(res).to.equal([
            '                                 ',
            '                                 __e__(\'MyDefault\', function () { return __i__["MyDefault"] });',
        ].join('\n'));
    });

    it ('should not transform identifier on object keys', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'var obj = { MyDefault: 123 }',
            'console.log(obj.MyDefault)'
        ]);
        expect(res).to.equal([
            '                                 ',
            'var obj = { MyDefault: 123 }',
            'console.log(obj.MyDefault)'
        ].join('\n'));
    });

    it ('should support shadowing by array variable declarations', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function MyFunction () {',
            '    var [ MyDefault, Other ] = someFn();',
            '    console.log(MyDefault);',
            '}',
            'console.log(MyDefault)'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function MyFunction () {',
            '    var [ MyDefault, Other ] = someFn();',
            '    console.log(MyDefault);',
            '}',
            'console.log(__i__["MyDefault"])'
        ].join('\n'));
    });

    it ('should support shadowing by nested array variable declarations', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function MyFunction () {',
            '    var [ A, [ MyDefault, B ]] = someFn();',
            '    console.log(MyDefault);',
            '}',
            'console.log(MyDefault)'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function MyFunction () {',
            '    var [ A, [ MyDefault, B ]] = someFn();',
            '    console.log(MyDefault);',
            '}',
            'console.log(__i__["MyDefault"])'
        ].join('\n'));
    });

    it ('should support shadowing by nested array variable declarations with omitted', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function MyFunction () {',
            '    var [, [, MyDefault ]] = someFn();',
            '    console.log(MyDefault);',
            '}',
            'console.log(MyDefault)'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function MyFunction () {',
            '    var [, [, MyDefault ]] = someFn();',
            '    console.log(MyDefault);',
            '}',
            'console.log(__i__["MyDefault"])'
        ].join('\n'));
    });

    it ('should support shadowing by destructured variable declarations', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function MyFunction () {',
            '    var { MyDefault, Other } = someFn();',
            '    console.log(MyDefault);',
            '}',
            'console.log(MyDefault)'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function MyFunction () {',
            '    var { MyDefault, Other } = someFn();',
            '    console.log(MyDefault);',
            '}',
            'console.log(__i__["MyDefault"])'
        ].join('\n'));
    });

    it ('should support shadowing by renamed destructured variable declarations', async () => {
        let res = await resolve([
            'import MyDefault, { MyVar } from "./myfile";',
            'function MyFunction () {',
            '    var { Other: MyDefault, MyVar: Something } = someFn();',
            '    console.log(MyDefault, MyVar);',
            '}',
            'console.log(MyDefault, MyVar)'
        ]);
        expect(res).to.equal([
            '                                            ',
            'function MyFunction () {',
            '    var { Other: MyDefault, MyVar: Something } = someFn();',
            '    console.log(MyDefault, __i__["MyVar"]);',
            '}',
            'console.log(__i__["MyDefault"], __i__["MyVar"])'
        ].join('\n'));
    });

    it ('should support shadowing by nested destructured variable declarations', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function MyFunction () {',
            '    var { A, Other: { MyDefault, B } } = someFn();',
            '    console.log(MyDefault);',
            '}',
            'console.log(MyDefault)'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function MyFunction () {',
            '    var { A, Other: { MyDefault, B } } = someFn();',
            '    console.log(MyDefault);',
            '}',
            'console.log(__i__["MyDefault"])'
        ].join('\n'));
    });

    it ('should modify implicit arrow function expressions', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'let fn = () => MyDefault(123);'
        ]);
        expect(res).to.equal([
            '                                 ',
            'let fn = () => __i__["MyDefault"](123);'
        ].join('\n'));
    });
});