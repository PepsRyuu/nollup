let es_to_cjs = require('../../lib/impl/NollupImportExportResolver');
let CodeGenerator = require('../../lib/impl/NollupCodeGenerator');
let PluginContainer = require('../../lib/impl/PluginContainer');
let RollupConfigContainer = require('../../lib/impl/RollupConfigContainer');
let { expect } = require('../nollup');
let path = require('path');

let tests = [{
    input: 'import Hello from \'./world\';',
    output: {
        code: '',
        imports: [{
            source: './world',
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
            specifiers: []
        }]
    }
}, {
    input: 'import {member} from "./file";',
    output: {
        imports: [{
            source: './file',
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
        exports: [{ local: '', exported: 'default' }],
        code: `var __ex_default__ = Hello; __e__('default', function () { return __ex_default__ });;`
    }
}, {
    input: 'export default Hello',
    output: {
        exports: [{ local: '', exported: 'default' }],
        code: `var __ex_default__ = Hello; __e__('default', function () { return __ex_default__ });`
    }
}, {
    input: 'export default 123;',
    output: {
        exports: [{ local: '', exported: 'default' }],
        code: `var __ex_default__ = 123; __e__('default', function () { return __ex_default__ });;`
    }
}, {
    input: 'export default () => {};',
    output: {
        exports: [{ local: '', exported: 'default' }],
        code: `var __ex_default__ = () => {}; __e__('default', function () { return __ex_default__ });;`
    }
}, {
    input: 'export default () => {}',
    output: {
        exports: [{ local: '', exported: 'default' }],
        code: `var __ex_default__ = () => {}; __e__('default', function () { return __ex_default__ });`
    }
}, {
    input: 'export default (() => {});',
    output: {
        exports: [{ local: '', exported: 'default' }],
        code: `var __ex_default__ = (() => {}); __e__('default', function () { return __ex_default__ });;`
    }
}, {
    input: 'export default(() => {});',
    output: {
        exports: [{ local: '', exported: 'default' }],
        code: `var __ex_default__ = (() => {}); __e__('default', function () { return __ex_default__ });;`
    }
}, {
    input: 'export default(() => {})',
    output: {
        exports: [{ local: '', exported: 'default' }],
        code: `var __ex_default__ = (() => {}); __e__('default', function () { return __ex_default__ });`
    }
}, {
    input: 'let hello = 123;export default function () {}export { hello }',
    output: {
        exports: [{
            local: '',
            exported: 'default'
        }, {
            local: 'hello',
            exported: 'hello'
        }],
        code: `let hello = 123;var __ex_default__ = function () {}; __e__('default', function () { return __ex_default__ });__e__( { hello: function () { return hello } });`
    }
}, {
    input: 'export default(() => {});export let hello = 123;',
    output: {
        exports: [{
            local: '',
            exported: 'default'
        }, {
            local: 'hello',
            exported: 'hello'
        }],
        code: `var __ex_default__ = (() => {}); __e__('default', function () { return __ex_default__ });;let hello = 123;; __e__('hello', function () { return hello });`
    }
}, {
    input: 'export default function(){}export let hello = 123;',
    output: {
        exports: [{
            local: '',
            exported: 'default'
        }, {
            local: 'hello',
            exported: 'hello'
        }],
        code: `var __ex_default__ = function(){}; __e__('default', function () { return __ex_default__ });let hello = 123;; __e__('hello', function () { return hello });`
    }
}, {
    input: 'export let hello = 123;export let world = 456;',
    output: {
        exports: [{
            local: 'hello',
            exported: 'hello'
        }, {
            local: 'world',
            exported: 'world'
        }],
        code: `let hello = 123;; __e__('hello', function () { return hello });let world = 456;; __e__('world', function () { return world });`
    }
},  {
    input: 'export default class Hello {};',
    output: {
        exports: [{ local: '', exported: 'default' }],
        code: `class Hello {}; __e__('default', function () { return Hello });;`
    }
}, {
    input: 'export default class Hello {}',
    output: {
        exports: [{ local: '', exported: 'default' }],
        code: `class Hello {}; __e__('default', function () { return Hello });`
    }
}, {
    input: 'export class Hello {};',
    output: {
        exports: [{ local: 'Hello', exported: 'Hello' }],
        code: `class Hello {}; __e__('Hello', function () { return Hello });;`
    }
}, {
    input: 'export class Hello {}',
    output: {
        exports: [{ local: 'Hello', exported: 'Hello' }],
        code: `class Hello {}; __e__('Hello', function () { return Hello });`
    }
}, {
    input: 'export function Hello () {};',
    output: {
        exports: [{ local: 'Hello', exported: 'Hello' }],
        code: `function Hello () {}; __e__('Hello', function () { return Hello });;`
    }
}, {
    input: 'let name1 = 123, name2 = 456; export {name1, name2};',
    output: {
        exports: [{
            local: 'name1',
            exported: 'name1'
        }, {
            local: 'name2',
            exported: 'name2'
        }],
        code: `let name1 = 123, name2 = 456; __e__( {name1: function () { return name1 }, name2: function () { return name2 }});`
    }
}, {
    input: 'let hello = 123, name = 456; export {hello as world, name};',
    output: {
        exports: [{
            local: 'hello',
            exported: 'world'
        }, {
            local: 'name',
            exported: 'name'
        }],
        code: `let hello = 123, name = 456; __e__( {world: function () { return hello }, name: function () { return name }});`
    }
}, {
    input: 'export var MyVar1 = 123;',
    output: {
        exports: [{
            local: 'MyVar1',
            exported: 'MyVar1'
        }],
        code: `var MyVar1 = 123;; __e__('MyVar1', function () { return MyVar1 });`
    }
}, {
    input: 'export var MyVar1 = () => {}, MyVar2 = 456;',
    output: {
        exports: [{
            local: 'MyVar1',
            exported: 'MyVar1'
        }, {
            local: 'MyVar2',
            exported: 'MyVar2'
        }],
        code: `var MyVar1 = () => {}, MyVar2 = 456;; __e__('MyVar1', function () { return MyVar1 });__e__('MyVar2', function () { return MyVar2 });`
    }
}, {
    input: 'export var MyVar1 = () => {}, MyVar2 = 456',
    output: {
        exports: [{
            local: 'MyVar1',
            exported: 'MyVar1'
        }, {
            local: 'MyVar2',
            exported: 'MyVar2'
        }],
        code: `var MyVar1 = () => {}, MyVar2 = 456; __e__('MyVar1', function () { return MyVar1 });__e__('MyVar2', function () { return MyVar2 });`
    }
}, {
    input: 'export const MyVar1 = () => {}, MyVar2 = 456;',
    output: {
        exports: [{
            local: 'MyVar1',
            exported: 'MyVar1'
        }, {
            local: 'MyVar2',
            exported: 'MyVar2'
        }],
        code: `const MyVar1 = () => {}, MyVar2 = 456;; __e__('MyVar1', function () { return MyVar1 });__e__('MyVar2', function () { return MyVar2 });`
    }
}, {
    input: 'export { MyVar } from "./file"',
    output: {
        imports: [{
            source: './file',
            specifiers: [{
                local: 'MyVar',
                imported: 'MyVar'
            }],
            export: true
        }],
        exports: [{
            local: 'MyVar',
            exported: 'MyVar'
        }],
        code: ``
    }
}, {
    input: 'export { hello as world } from "./file"',
    output: {
        imports: [{
            source: './file',
            specifiers: [{
                local: 'world',
                imported: 'hello'
            }],
            export: true
        }],
        exports: [{
            local: 'world',
            exported: 'world'
        }],
        code: ``
    }
}, {
    input: 'export { default } from "./file";',
    output: {
        imports: [{
            source: './file',
            specifiers: [{
                local: 'default',
                imported: 'default'
            }],
            export: true
        }],
        exports: [{ 
            local: 'default',
            exported: 'default' 
        }],
        code: ``
    }
}, {
    input: 'export * from "./file"',
    output: {
        imports: [{
            source: './file',
            specifiers: [{
                imported: '*'
            }],
            export: true
        }],
        exports: [],
        code: ``
    }
}, {
    input: 'import Hello from "hello";import World from "world";',
    output: {
        imports: [{
            source: 'hello',
            specifiers: [{
                local: 'Hello',
                imported: 'default'
            }]
        }, {
            source: 'world',
            specifiers: [{
                local: 'World',
                imported: 'default'
            }]
        }]
    }
}, {
    input: 'export const { foo, bar } = myvar;',
    output: {
        exports: [{
            local: 'foo',
            exported: 'foo'
        }, {
            local: 'bar',
            exported: 'bar'
        }],
        code: `const { foo, bar } = myvar;; __e__('foo', function () { return foo });__e__('bar', function () { return bar });`
    }
}, {
    input: 'export const { foo: hello, bar: world } = myvar;',
    output: {
        exports: [{
            local: 'hello',
            exported: 'hello'
        }, {
            local: 'world',
            exported: 'world'
        }],
        code: `const { foo: hello, bar: world } = myvar;; __e__('hello', function () { return hello });__e__('world', function () { return world });`
    }
}, {
    input: 'export const { foo, bar } = myvar, hello = 123;',
    output: {
        exports: [{
            local: 'foo',
            exported: 'foo'
        }, {
            local: 'bar',
            exported: 'bar'
        }, {
            local: 'hello',
            exported: 'hello'
        }],
        code: `const { foo, bar } = myvar, hello = 123;; __e__('foo', function () { return foo });__e__('bar', function () { return bar });__e__('hello', function () { return hello });`
    }
}, {
    input: 'export {};',
    output: {
        exports: [],
        code: `__e__( {});`
    }
}, {
    input: 'import { hello } from "file"; export { hello };',
    output: {
        imports: [{
            source: 'file',
            specifiers: [{
                local: 'hello',
                imported: 'hello'
            }]
        }],
        exports: [{
            local: 'hello',
            exported: 'hello'
        }],
        code: `__e__( { hello: function () { return hello } });`
    }
}, {
    input: 'import { hello as world } from "file"; export { world }',
    output: {
        imports: [{
            source: 'file',
            specifiers: [{
                local: 'world',
                imported: 'hello'
            }]
        }],
        exports: [{
            local: 'world',
            exported: 'world'
        }],
        code: `__e__( { world: function () { return world } });`
    }
}, {
    input: 'import { hello as world } from "file"; export { world as foo }',
    output: {
        imports: [{
            source: 'file',
            specifiers: [{
                local: 'world',
                imported: 'hello'
            }]
        }],
        exports: [{
            local: 'world',
            exported: 'foo'
        }],
        code: `__e__( { foo: function () { return world } });`
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

            let config = new RollupConfigContainer({ input: '', plugins: [] });
            let plugins = new PluginContainer(config, {});
            plugins.start(); 
            plugins.start();

            let res = await es_to_cjs(plugins, test.input, process.cwd() + '/__entry', new CodeGenerator());
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
                    Actual: ${JSON.stringify(to_check)}
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
            specifiers: [{
                local: 'jQuery',
                imported: 'default'
            }],
            external: true
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
            specifiers: [{
                local: '$',
                imported: 'default'
            }],
            external: true
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
            specifiers: [{
                local: 'jquery',
                imported: 'default'
            }],
            external: true
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
            specifiers: [{
                local: 'max',
                imported: 'max'
            }],
            external: true
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
            specifiers: [{
                local: 'max',
                imported: 'max'
            }, {
                local: 'min',
                imported: 'min'
            }],
            external: true
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
            specifiers: [{
                local: '$',
                imported: 'default'
            }, {
                local: 'ajax',
                imported: 'ajax'
            }],
            external: true
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
            specifiers: [{
                local: 'net',
                imported: 'ajax'
            }],
            external: true
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
        exports: [{
            local: 'ajax',
            exported: 'ajax'
        }],
        externalImports: [{
            source: 'jquery',
            specifiers: [{
                local: 'ajax',
                imported: 'ajax'
            }],
            export: true,
            external: true
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
        exports: [{
            local: 'ajax',
            exported: 'ajax'
        }],
        externalImports: [{
            source: 'jquery',
            specifiers: [{
                local: 'ajax',
                imported: 'ajax'
            }],
            export: true,
            external: true
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
        exports: [{
            local: 'net',
            exported: 'net'
        }],
        externalImports: [{
            source: 'jquery',
            specifiers: [{
                local: 'net',
                imported: 'ajax'
            }],
            export: true,
            external: true
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
            specifiers: [{
                imported: '*'
            }],
            export: true,
            external: true
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
            specifiers: [{
                imported: '*'
            }],
            export: true,
            external: true
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
            specifiers: [{
                local: 'ajax',
                imported: 'ajax'
            }],
            external: true
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
            specifiers: [{
                local: 'ajax',
                imported: 'ajax'
            }],
            external: true
        }]
    },
    config: {
        external: id => /some\/other\/dep/.test(id)
    }
}]



describe('es_to_cs_externals (ESM)', () => {
    external_tests.forEach(test => {
        it(test.input, async () => {
            let config = new RollupConfigContainer({
                ...test.config, 
                plugins: []
            });

            config.setOutputOptions({
                ...test.config.output, 
                format: 'esm'
            });

            let plugins = new PluginContainer(config, {});
            plugins.start(); 
            plugins.start();

            let res = await es_to_cjs(plugins, test.input, process.cwd() + '/__entry', new CodeGenerator());
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
        let config = new RollupConfigContainer({ plugins: [] });
        let plugins = new PluginContainer(config, {});
        plugins.start();

        let res = await es_to_cjs(plugins, `
            import Hello from './World';
            let a = [1, 2, , 4];
        `,  process.cwd() + '/__entry', new CodeGenerator());
        expect(res.code.indexOf('[1, 2, , 4]') > -1).to.be.true;
    });

    it ('should properly blank two imports without semi-colons', async () => {
        let config = new RollupConfigContainer({ plugins: [] });
        let plugins = new PluginContainer(config, {});
        plugins.start();

        let res = await es_to_cjs(plugins, [
            'import Hello from "hello"',
            'import World from "world"',
            'console.log(Hello, World)'
        ].join('\n'), process.cwd() + '/_entry', new CodeGenerator());
        expect(res.code).to.equal([
            '                         ',
            '                         ',
            'console.log(Hello, World)'
        ].join('\n'));
    });

    it ('should properly blank two imports on the same line', async () => {
        let config = new RollupConfigContainer({ plugins: [] });
        let plugins = new PluginContainer(config, {});
        plugins.start();

        let res = await es_to_cjs(plugins, [
            'import Hello from "hello";import World from "world"',
            'console.log(Hello, World)'
        ].join('\n'), process.cwd() + '/_entry', new CodeGenerator());
        expect(res.code).to.equal([
            '                                                   ',
            'console.log(Hello, World)'
        ].join('\n'));
    });


    it ('should properly blank imports that span multiple lines', async () => {
        let config = new RollupConfigContainer({ plugins: [] });
        let plugins = new PluginContainer(config, {});
        plugins.start();

        let res = await es_to_cjs(plugins, [
            'import {',
            '   Hello',
            '} from "hello";',
            'import {',
            '   World',
            '} from "world";',
            'console.log(Hello, World)'
        ].join('\n'), process.cwd() + '/_entry', new CodeGenerator());
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
        let config = new RollupConfigContainer({ plugins: [] });
        let plugins = new PluginContainer(config, {});
        plugins.start();

        let res = await es_to_cjs(plugins, [
            'var Hello, World, Foo, Bar;',
            'export { Hello, World }',
            'export { Foo, Bar };',
            'console.log(Hello, World)'
        ].join('\n'), process.cwd() + '/_entry', new CodeGenerator());
        expect(res.code).to.equal([
            'var Hello, World, Foo, Bar;',
            '__e__( { Hello: function () { return Hello }, World: function () { return World } });',
            '__e__( { Foo: function () { return Foo }, Bar: function () { return Bar } });',
            'console.log(Hello, World)'
        ].join('\n'));
    });

    it ('should properly blank export {} blocks over multiple lines with padding', async () => {
        let config = new RollupConfigContainer({ plugins: [] });
        let plugins = new PluginContainer(config, {});
        plugins.start();

        let res = await es_to_cjs(plugins, [
            'var Hello, World, Foo, Bar;',
            'export {                   ',
            '    Hello,                 ',
            '    World                  ',
            '}                          ',
            'console.log(Hello, World)'
        ].join('\n'), process.cwd() + '/_entry', new CodeGenerator());
        expect(res.code).to.equal([
            'var Hello, World, Foo, Bar;',
            '__e__( {                   ',
            '    Hello: function () { return Hello },                 ',
            '    World: function () { return World }                  ',
            '});                          ',
            'console.log(Hello, World)'
        ].join('\n'));
    });
});

describe ('Export Late Init Live Bindings', () => {
    it ('should only export when export is assigned for declarations', async () => {
        let config = new RollupConfigContainer({ plugins: [] });
        let plugins = new PluginContainer(config, {});
        plugins.start();

        let res = await es_to_cjs(plugins, [
            'export let hello;',
            'hello = 123;'
        ].join('\n'), process.cwd() + '/_entry', new CodeGenerator());
        expect(res.code).to.equal([
            'let hello;; ',
            'hello = 123;;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });'
        ].join('\n'));
    });

    it ('should work for multiple exports', async () => {
        let config = new RollupConfigContainer({ plugins: [] });
        let plugins = new PluginContainer(config, {});
        plugins.start();

        let res = await es_to_cjs(plugins, [
            'export let hello;',
            'hello = 123;',
            'export let world;',
            'world = 456;'
        ].join('\n'), process.cwd() + '/_entry', new CodeGenerator());
        expect(res.code).to.equal([
            'let hello;; ',
            'hello = 123;;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });',
            'let world;; ',
            'world = 456;;__e__(\'world\', function () { return typeof world !== \'undefined\' && world });'
        ].join('\n'));
    });

    it ('should support inline assignments', async () => {
        let config = new RollupConfigContainer({ plugins: [] });
        let plugins = new PluginContainer(config, {});
        plugins.start();

        let res = await es_to_cjs(plugins, [
            'export let hello;',
            '(function () {})(hello || (hello = 123))'
        ].join('\n'), process.cwd() + '/_entry', new CodeGenerator());
        expect(res.code).to.equal([
            'let hello;; ',
            '(function () {})(hello || (hello = 123));__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });'
        ].join('\n'));
    });

    it ('should support inline assignments 2', async () => {
        let config = new RollupConfigContainer({ plugins: [] });
        let plugins = new PluginContainer(config, {});
        plugins.start();

        let res = await es_to_cjs(plugins, [
            'export let hello;',
            '(function () {})(hello || (hello = 123));'
        ].join('\n'), process.cwd() + '/_entry', new CodeGenerator());
        expect(res.code).to.equal([
            'let hello;; ',
            '(function () {})(hello || (hello = 123));;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });'
        ].join('\n'));
    });

    it ('should not fail when found inside shadowing function expression', async () => {
        let config = new RollupConfigContainer({ plugins: [] });
        let plugins = new PluginContainer(config, {});
        plugins.start();

        let res = await es_to_cjs(plugins, [
            'export let hello;',
            '(function (hello) { hello = 123 })();',
            'hello = 123'
        ].join('\n'), process.cwd() + '/_entry', new CodeGenerator());
        expect(res.code).to.equal([
            'let hello;; ',
            '(function (hello) { hello = 123 })();;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });',
            'hello = 123;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });'
        ].join('\n'));
    });

    it ('should not fail when found inside shadowing function expression for multiple exports', async () => {
        let config = new RollupConfigContainer({ plugins: [] });
        let plugins = new PluginContainer(config, {});
        plugins.start();

        let res = await es_to_cjs(plugins, [
            'export let hello;',
            'export let world;',
            '(function (hello) { hello = 123 })();',
            '(function (world) { world = 123 })();',
            'hello = 123',
            'world = 456'
        ].join('\n'), process.cwd() + '/_entry', new CodeGenerator());
        expect(res.code).to.equal([
            'let hello;; ',
            'let world;; ',
            '(function (hello) { hello = 123 })();;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });',
            '(function (world) { world = 123 })();;__e__(\'world\', function () { return typeof world !== \'undefined\' && world });',
            'hello = 123;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });',
            'world = 456;__e__(\'world\', function () { return typeof world !== \'undefined\' && world });'
        ].join('\n'));
    });

    it ('should not fail when exported after shadowed function statement', async () => {
        let config = new RollupConfigContainer({ plugins: [] });
        let plugins = new PluginContainer(config, {});
        plugins.start();

        let res = await es_to_cjs(plugins, [
            'function print (hello) { hello = 123 }',
            'export let hello;',
            'hello = 123'
        ].join('\n'), process.cwd() + '/_entry', new CodeGenerator());
        expect(res.code).to.equal([
            'function print (hello) { hello = 123 };__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });',
            'let hello;; ',
            'hello = 123;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });'
        ].join('\n'));
    });

    it ('should not fail when exported after shadowed arrow expression', async () => {
        let config = new RollupConfigContainer({ plugins: [] });
        let plugins = new PluginContainer(config, {});
        plugins.start();

        let res = await es_to_cjs(plugins, [
            '(hello => { hello = 123 })();',
            'export let hello;',
            'hello = 123'
        ].join('\n'), process.cwd() + '/_entry', new CodeGenerator());
        expect(res.code).to.equal([
            '(hello => { hello = 123 })();;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });',
            'let hello;; ',
            'hello = 123;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });'
        ].join('\n'));
    });

    it ('should not fail when shadowed in nested functions', async () => {
        let config = new RollupConfigContainer({ plugins: [] });
        let plugins = new PluginContainer(config, {});
        plugins.start();

        let res = await es_to_cjs(plugins, [
            'function parent (hello) {',
            '   function nested (hello) {',
            '       hello = 123;',
            '   }',
            '}',
            'export let hello;',
            'hello = 123'
        ].join('\n'), process.cwd() + '/_entry', new CodeGenerator());
        expect(res.code).to.equal([
            'function parent (hello) {',
            '   function nested (hello) {',
            '       hello = 123;',
            '   }',
            '};__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });',
            'let hello;; ',
            'hello = 123;__e__(\'hello\', function () { return typeof hello !== \'undefined\' && hello });'
        ].join('\n'));
    });
});

describe ('Import Live Bindings (reference)', () => {
    async function resolve (code) {
        let config = new RollupConfigContainer({ plugins: [] });
        let plugins = new PluginContainer(config, {});
        plugins.start();
        let curr = process.cwd() + '/_entry';
        let res = await es_to_cjs(plugins, code.join('\n'), curr, new CodeGenerator({ liveBindings: 'reference' }), 'reference');
        return res.code;
    }

    it ('should change import usage to binding variable', async () => {
        let res = await resolve([
            'import MyVar1 from "./myfile";',
            'console.log(MyVar1);'
        ]);
        expect(res).to.equal([
            '                              ',
            'console.log(__i__.MyVar1);'
        ].join('\n'));
    });

    it ('should change import usage to binding variable for named', async () => {
        let res = await resolve([
            'import MyDefault, { MyVar1, MyVar2 } from "./myfile";',
            'console.log(MyDefault, MyVar1, MyVar2);'
        ]);
        expect(res).to.equal([
            '                                                     ',
            'console.log(__i__.MyDefault, __i__.MyVar1, __i__.MyVar2);'
        ].join('\n'));
    });

    it ('should change import usage to binding variable for object member expressions', async () => {
        let res = await resolve([
            'import MyVar1 from "./myfile";',
            'console.log(MyVar1.abc);'
        ]);
        expect(res).to.equal([
            '                              ',
            'console.log(__i__.MyVar1.abc);'
        ].join('\n'));
    });

    it ('should change import usage to binding variable for dynamic object member expressions', async () => {
        let res = await resolve([
            'import MyVar1 from "./myfile";',
            'console.log(MyVar1["abc"]);'
        ]);
        expect(res).to.equal([
            '                              ',
            'console.log(__i__.MyVar1["abc"]);'
        ].join('\n'));
    });

    it ('should change import when assigned to a new variable', async () => {
        let res = await resolve([
            'import MyVar1 from "./myfile";',
            'let abc = MyVar1;',
            'let [ def ] = MyVar1;'
        ]);
        expect(res).to.equal([
            '                              ',
            'let abc = __i__.MyVar1;',
            'let [ def ] = __i__.MyVar1;'
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
            '    console.log(MyDefault, __i__.MyVar);',
            '}',
            'console.log(__i__.MyDefault);'
        ].join('\n'));
    });

    it ('should allow shadowing by function names', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function MyFunction () {',
            '    console.log(MyDefault);',
            '    function MyDefault() {}',
            '}',
            'console.log(MyDefault);'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function MyFunction () {',
            '    console.log(MyDefault);',
            '    function MyDefault() {}',
            '}',
            'console.log(__i__.MyDefault);'
        ].join('\n'));
    });

    it ('should allow shadowing by function expression names', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function MyFunction () {',
            '    console.log(MyDefault);',
            '    var Lol = function MyDefault() {',
            '        console.log(MyDefault);',
            '    }',
            '}',
            'console.log(MyDefault);'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function MyFunction () {',
            '    console.log(__i__.MyDefault);',
            '    var Lol = function MyDefault() {',
            '        console.log(MyDefault);',
            '    }',
            '}',
            'console.log(__i__.MyDefault);'
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
            '    console.log(__i__.MyDefault);',
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
            '    console.log(MyDefault, __i__.MyVar);',
            '}',
            'console.log(__i__.MyDefault);'
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
            '    console.log(MyDefault, __i__.MyVar);',
            '}',
            'console.log(__i__.MyDefault);'
        ].join('\n'));
    });

    it ('should allow shadowing by let declaration in a block', async () => {
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
            'console.log(__i__.MyDefault);',
            '{',
            '    console.log(__i__.MyDefault);',
            '    {',
            '       let MyDefault;',
            '       console.log(MyDefault)',
            '    }',
            '    console.log(__i__.MyDefault);',
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
            'console.log(__i__.MyDefault);',
            'function MyFunction () {',
            '    var MyDefault',
            '    console.log(MyDefault);',
            '}',
            'console.log(__i__.MyDefault)'
        ].join('\n'));
    });

    it ('should allow shadowing by local variable in function if var nested in block', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function MyFunction () {',
            '    console.log(MyDefault)',
            '    {',
            '        var MyDefault',
            '        console.log(MyDefault);',
            '    }',
            '}'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function MyFunction () {',
            '    console.log(MyDefault)',
            '    {',
            '        var MyDefault',
            '        console.log(MyDefault);',
            '    }',
            '}'
        ].join('\n'));
    });

    it ('should allow not shadowing by local variable in function if let nested in block', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function MyFunction () {',
            '    console.log(MyDefault)',
            '    {',
            '        let MyDefault',
            '        console.log(MyDefault);',
            '    }',
            '}'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function MyFunction () {',
            '    console.log(__i__.MyDefault)',
            '    {',
            '        let MyDefault',
            '        console.log(MyDefault);',
            '    }',
            '}'
        ].join('\n'));
    });

    it ('should allow not shadowing by local variable in function if const nested in block', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function MyFunction () {',
            '    console.log(MyDefault)',
            '    {',
            '        const MyDefault = 123;',
            '        console.log(MyDefault);',
            '    }',
            '}'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function MyFunction () {',
            '    console.log(__i__.MyDefault)',
            '    {',
            '        const MyDefault = 123;',
            '        console.log(MyDefault);',
            '    }',
            '}'
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
            'var obj1 = { MyDefault: __i__.MyDefault }',
            'var obj2 = { Other: __i__.MyDefault }',
            'var obj3 = { MyDefault: __i__.MyDefault }',
            'var obj4 = { MyDefault: Other }'
        ].join('\n'));
    });

    it ('should support export statement with a binding', async () => {
        let res = await resolve([
            'import MyDefault, { Other, Another } from "./myfile";',
            'export { MyDefault as MyDefault, Other, Another as Something }',
            'export{ Other as OtherExport }'
        ]);
        expect(res).to.equal([
            '                                                     ',
            '__e__( { MyDefault: function () { return __i__.MyDefault }, Other: function () { return __i__.Other }, Something: function () { return __i__.Another } });',
            '__e__({ OtherExport: function () { return __i__.Other } });'
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

    it ('should transform identifier on dynamic object keys', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'var obj = { [MyDefault]: 123 }',
        ]);
        expect(res).to.equal([
            '                                 ',
            'var obj = { [__i__.MyDefault]: 123 }',
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
            'console.log(__i__.MyDefault)'
        ].join('\n'));
    });

    it ('should support shadowing by array variable declarations regardless of position', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function MyFunction () {',
            '    var A, [ MyDefault, Other ] = someFn();',
            '    console.log(MyDefault);',
            '}',
            'console.log(MyDefault)'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function MyFunction () {',
            '    var A, [ MyDefault, Other ] = someFn();',
            '    console.log(MyDefault);',
            '}',
            'console.log(__i__.MyDefault)'
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
            'console.log(__i__.MyDefault)'
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
            'console.log(__i__.MyDefault)'
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
            'console.log(__i__.MyDefault)'
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
            '    console.log(MyDefault, __i__.MyVar);',
            '}',
            'console.log(__i__.MyDefault, __i__.MyVar)'
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
            'console.log(__i__.MyDefault)'
        ].join('\n'));
    });

    it ('should modify implicit arrow function expressions', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'let fn = () => MyDefault(123);'
        ]);
        expect(res).to.equal([
            '                                 ',
            'let fn = () => __i__.MyDefault(123);'
        ].join('\n'));
    });

    it ('should support shadowing by for loop declarations', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function MyFunction () {',
            '    for (var MyDefault = 0; MyDefault < 10; MyDefault++) {',
            '        console.log(MyDefault);',
            '    }', 
            '}',
            'console.log(MyDefault)'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function MyFunction () {',
            '    for (var MyDefault = 0; MyDefault < 10; MyDefault++) {',
            '        console.log(MyDefault);',
            '    }',
            '}',
            'console.log(__i__.MyDefault)'
        ].join('\n'));
    });

    it ('should support shadowing by for nested loop declarations', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function MyFunction () {',
            '    for (var i = 0; i < 10; i++) {',
            '        for (var MyDefault = 0; MyDefault < 10; MyDefault++) {',
            '            console.log(MyDefault);',
            '        }', 
            '    }',
            '}',
            'console.log(MyDefault)'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function MyFunction () {',
            '    for (var i = 0; i < 10; i++) {',
            '        for (var MyDefault = 0; MyDefault < 10; MyDefault++) {',
            '            console.log(MyDefault);',
            '        }', 
            '    }',
            '}',
            'console.log(__i__.MyDefault)'
        ].join('\n'));
    });

    it ('should support not shadowing by for loop declaration using let', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function MyFunction () {',
            '    console.log(MyDefault);',
            '    for (let MyDefault = 0; MyDefault < 10; MyDefault++) {',
            '        console.log(MyDefault);',
            '    }', 
            '}',
            'console.log(MyDefault)'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function MyFunction () {',
            '    console.log(__i__.MyDefault);',
            '    for (let MyDefault = 0; MyDefault < 10; MyDefault++) {',
            '        console.log(MyDefault);',
            '    }', 
            '}',
            'console.log(__i__.MyDefault)'
        ].join('\n'));
    });

    it ('should allow import to be used inside a for loop', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function MyFunction () {',
            '    console.log(MyDefault);',
            '    for (MyDefault = 0; MyDefault < 10; MyDefault++) {',
            '        console.log(MyDefault);',
            '    }', 
            '}',
            'console.log(MyDefault)'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function MyFunction () {',
            '    console.log(__i__.MyDefault);',
            '    for (__i__.MyDefault = 0; __i__.MyDefault < 10; __i__.MyDefault++) {',
            '        console.log(__i__.MyDefault);',
            '    }', 
            '}',
            'console.log(__i__.MyDefault)'
        ].join('\n'));
    });

    it ('should allow import to be used inside as default value for functions', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function MyFunction (abc = MyDefault) {',
            '    console.log(MyDefault);',
            '}',
            'console.log(MyDefault)'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function MyFunction (abc = __i__.MyDefault) {',
            '    console.log(__i__.MyDefault);',
            '}',
            'console.log(__i__.MyDefault)'
        ].join('\n'));
    });

    it ('should support shadowing by if conditional using var', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function MyFunction () {',
            '    console.log(MyDefault);',
            '    if (true) {',
            '        var MyDefault = 123;',
            '    }',
            '}',
            'console.log(MyDefault)'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function MyFunction () {',
            '    console.log(MyDefault);',
            '    if (true) {',
            '        var MyDefault = 123;',
            '    }',
            '}',
            'console.log(__i__.MyDefault)'
        ].join('\n'));
    });

    it ('should support not shadowing by if conditional using let', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function MyFunction () {',
            '    console.log(MyDefault);',
            '    if (true) {',
            '        let MyDefault = 123;',
            '    }',
            '}',
            'console.log(MyDefault)'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function MyFunction () {',
            '    console.log(__i__.MyDefault);',
            '    if (true) {',
            '        let MyDefault = 123;',
            '    }',
            '}',
            'console.log(__i__.MyDefault)'
        ].join('\n'));
    });

    it ('should allow import to be used for spread operators', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'var obj = { ...MyDefault };',
            'var arr = [ ...MyDefault ];'
        ]);
        expect(res).to.equal([
            '                                 ',
            'var obj = { ...__i__.MyDefault };',
            'var arr = [ ...__i__.MyDefault ];'
        ].join('\n'));
    });

    it ('should be shadowed by rest parameters', async () => {
        let res = await resolve([
            'import MyDefault from "./myfile";',
            'function Hello (...MyDefault) {',
            '    console.log(MyDefault);',
            '}'
        ]);
        expect(res).to.equal([
            '                                 ',
            'function Hello (...MyDefault) {',
            '    console.log(MyDefault);',
            '}'
        ].join('\n'));
    });

    it ('should be shadowed by class methods', async () => {
        let res = await resolve([
            'import MyDefault, { MyVar } from "./myfile";',
            'class Hello {',
            '    SomeFunction (MyDefault) {',
            '        console.log(MyDefault, MyVar);',
            '    }',
            '}'
        ]);
        expect(res).to.equal([
            '                                            ',
            'class Hello {',
            '    SomeFunction (MyDefault) {',
            '        console.log(MyDefault, __i__.MyVar);',
            '    }',
            '}'
        ].join('\n'));
    });

    it ('should not be shadowed by class method names', async () => {
        let res = await resolve([
            'import MyDefault, { MyVar } from "./myfile";',
            'class Hello {',
            '    MyDefault () {',
            '        console.log(MyDefault, MyVar);',
            '    }',
            '}'
        ]);
        expect(res).to.equal([
            '                                            ',
            'class Hello {',
            '    MyDefault () {',
            '        console.log(__i__.MyDefault, __i__.MyVar);',
            '    }',
            '}'
        ].join('\n'));
    });

    it ('should allow import to be used as computed class method', async () => {
        let res = await resolve([
            'import MyDefault, { MyVar } from "./myfile";',
            'class Hello {',
            '    [MyDefault] () {',
            '        console.log(MyDefault, MyVar);',
            '    }',
            '}'
        ]);
        expect(res).to.equal([
            '                                            ',
            'class Hello {',
            '    [__i__.MyDefault] () {',
            '        console.log(__i__.MyDefault, __i__.MyVar);',
            '    }',
            '}'
        ].join('\n'));
    });

    it ('should not be shadowed by object method shorthand names', async () => {
        let res = await resolve([
            'import MyDefault, { MyVar } from "./myfile";',
            'var Hello = {',
            '    MyDefault () {',
            '        console.log(MyDefault, MyVar);',
            '    }',
            '}'
        ]);
        expect(res).to.equal([
            '                                            ',
            'var Hello = {',
            '    MyDefault () {',
            '        console.log(__i__.MyDefault, __i__.MyVar);',
            '    }',
            '}'
        ].join('\n'));
    });
});