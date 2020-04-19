let es_to_cjs = require('../../lib/impl/ImportExportResolver');
let { expect } = require('../nollup');
let path = require('path');

let tests = [{
    input: 'import Hello from \'./world\';',
    output: {
        transpiled: '',
        dependencies: ['./world'],
        imports: [{
            imported: 'default',
            importee: '_i0',
            local: 'Hello'
        }]
    }
}, {
    input: 'import \'./styles.css\';',
    output: {
        dependencies: ['./styles.css'],
        imports: [{
            importee: '_i0'
        }]
    }
}, {
    input: 'import {member} from "./file";',
    output: {
        dependencies: ['./file'],
        imports: [{
            imported: 'member',
            importee: '_i0',
            local: 'member'
        }]
    }
}, {
    input: 'import { member } from "./file";',
    output: {
        dependencies: ['./file'],
        imports: [{
            imported: 'member',
            importee: '_i0',
            local: 'member'
        }]
    }
}, {
    input: 'import {mem1, mem2} from "./file";',
    output: {
        dependencies: ['./file'],
        imports: [{
            imported: 'mem1',
            importee: '_i0',
            local: 'mem1'
        }, {
            imported: 'mem2',
            importee: '_i0',
            local: 'mem2'
        }]
    }
}, {
    input: 'import {member as lol} from "./file";',
    output: {
        dependencies: ['./file'],
        imports: [{
            imported: 'member',
            importee: '_i0',
            local: 'lol'
        }]
    }
}, {
    input: 'import * as lol from "./file";',
    output: {
        dependencies: ['./file'],
        imports: [{
            imported: '*',
            importee: '_i0',
            local: 'lol'
        }]
    }
}, {
    input: 'import Hello, * as World from "./file";',
    output: {
        dependencies: ['./file'],
        imports: [{
            imported: 'default',
            importee: '_i0',
            local: 'Hello'
        }, {
            imported: '*',
            importee: '_i0',
            local: 'World'
        }]
    }
}, {
    input: 'export default Hello;',
    output: {
        exports: ['default'],
        transpiled: `__e__('default', Hello);`
    }
}, {
    input: 'export default 123;',
    output: {
        exports: ['default'],
        transpiled: `__e__('default', 123);`
    }
}, {
    input: 'export default () => {};',
    output: {
        exports: ['default'],
        transpiled: `__e__('default', () => {});`
    }
}, {
    input: 'export default (() => {});',
    output: {
        exports: ['default'],
        transpiled: `__e__('default', (() => {}));`
    }
}, /* {
    input: 'export default(() => {});',
    output: 'module.exports.default = (() => {});'
},*/ {
    input: 'export default class Hello {};',
    output: {
        exports: ['default'],
        transpiled: `class Hello {}; __e__('default', Hello);;`
    }
}, {
    input: 'export default class Hello {}',
    output: {
        exports: ['default'],
        transpiled: `class Hello {}; __e__('default', Hello);`
    }
}, {
    input: 'export class Hello {};',
    output: {
        exports: ['Hello'],
        transpiled: `class Hello {}; __e__('Hello', Hello);;`
    }
}, {
    input: 'export class Hello {}',
    output: {
        exports: ['Hello'],
        transpiled: `class Hello {}; __e__('Hello', Hello);`
    }
}, {
    input: 'export function Hello () {};',
    output: {
        exports: ['Hello'],
        transpiled: `function Hello () {}; __e__('Hello', Hello);;`
    }
}, {
    input: 'let name1 = 123, name2 = 456; export {name1, name2};',
    output: {
        exports: ['name1', 'name2'],
        transpiled: `let name1 = 123, name2 = 456; __e__('name1', name1);__e__('name2', name2);`
    }
}, {
    input: 'let hello = 123, name = 456; export {hello as world, name};',
    output: {
        exports: ['world', 'name'],
        transpiled: `let hello = 123, name = 456; __e__('world', hello);__e__('name', name);`
    }
}, {
    input: 'export var MyVar1 = 123;',
    output: {
        exports: ['MyVar1'],
        transpiled: `var MyVar1 = 123;; __e__('MyVar1', MyVar1);`
    }
}, {
    input: 'export var MyVar1 = () => {}, MyVar2 = 456;',
    output: {
        exports: ['MyVar1', 'MyVar2'],
        transpiled: `var MyVar1 = () => {}, MyVar2 = 456;; __e__('MyVar1', MyVar1), __e__('MyVar2', MyVar2);`
    }
}, {
    input: 'export var MyVar1 = () => {}, MyVar2 = 456',
    output: {
        exports: ['MyVar1', 'MyVar2'],
        transpiled: `var MyVar1 = () => {}, MyVar2 = 456; __e__('MyVar1', MyVar1), __e__('MyVar2', MyVar2);`
    }
}, {
    input: 'export const MyVar1 = () => {}, MyVar2 = 456;',
    output: {
        exports: ['MyVar1', 'MyVar2'],
        transpiled: `const MyVar1 = () => {}, MyVar2 = 456;; __e__('MyVar1', MyVar1), __e__('MyVar2', MyVar2);`
    }
}, {
    input: 'export { MyVar } from "./file"',
    output: {
        dependencies: ['./file'],
        imports: [{
            imported: 'MyVar',
            importee: '_i0',
            local: 'ex_MyVar'
        }],
        exports: ['MyVar'],
        transpiled: `__e__('MyVar', ex_MyVar);`
    }
}, {
    input: 'export { default } from "./file";',
    output: {
        dependencies: ['./file'],
        imports: [{
            imported: 'default',
            importee: '_i0',
            local: 'ex_default'
        }],
        exports: ['default'],
        transpiled: `__e__('default', ex_default);`
    }
}, {
    input: 'export * from "./file"',
    output: {
        dependencies: ['./file'],
        imports: [{
            imported: '*',
            importee: '_i0'
        }],
        exports: [],
        transpiled: `for(var __k__ in ex_i0){__k__ !== "default" && (__e__(__k__, ex_i0[__k__]))}`
    }
}, {
    input: 'import Hello from "hello";import World from "world";',
    output: {
        dependencies: ['hello', 'world'],
        imports: [{
            imported: 'default',
            importee: '_i0',
            local: 'Hello'
        }, {
            imported: 'default',
            importee: '_i1',
            local: 'World'
        }]
    }
}];

describe ('es_to_cjs', () => {
    tests.forEach(test => {
        it(test.input, async () => {
             test.output = {
                transpiled: '',
                imports: [],
                exports: [],
                dependencies: [],
                dynamicDependencies: [],
                ...test.output
            };


            let res = await es_to_cjs(test.input, { plugins: [] }, process.cwd() + '/__entry');
            let to_check = {};
            for (let key in test.output) {
                to_check[key] = res[key];
            }

            test.output.dependencies = test.output.dependencies.map(dep => {
                return path.resolve(process.cwd(), dep + (!path.extname(dep)? '.js' : ''));
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
        imports: []
    },
    transpiled: {
        esm: 'var jQuery = __nollup__external__jquery__default__;',
        cjs: 'var _ejQuery = require("jquery");var jQuery = _ejQuery && _ejQuery.hasOwnProperty("default")? _ejQuery.default : _ejQuery;',
        iife: 'var _ejQuery = __nollup__global__.jQuery;var jQuery = _ejQuery && _ejQuery.hasOwnProperty("default")? _ejQuery.default : _ejQuery;',
    },
    config: {
        external: ['jquery']
    }
}, {
    input: 'import $ from "jquery";',
    output: {
        imports: [],
    },
    transpiled: {
        esm: 'var $ = __nollup__external__jquery__default__;',
        cjs: 'var _e$ = require("jquery");var $ = _e$ && _e$.hasOwnProperty("default")? _e$.default : _e$;',
        iife: 'var _e$ = __nollup__global__.$;var $ = _e$ && _e$.hasOwnProperty("default")? _e$.default : _e$;',
    },
    config: {
        external: ['jquery']
    }
}, {
    input: 'import jquery from "jquery";',
    output: {
        imports: [],
    },
    transpiled: {
        esm: 'var jquery = __nollup__external__jquery__default__;',
        cjs: 'var _e$ = require("jquery");var jquery = _e$ && _e$.hasOwnProperty("default")? _e$.default : _e$;',
        iife: 'var _e$ = __nollup__global__.$;var jquery = _e$ && _e$.hasOwnProperty("default")? _e$.default : _e$;',
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
        imports: [],
    },
    transpiled: {
        esm: 'var max = __nollup__external__Math__max__;',
        iife: 'var _eMath = __nollup__global__.Math;var max = _eMath.max;',
        cjs: 'var _eMath = require("Math");var max = _eMath.max;'
    },
    config: {
        external: ['Math']
    }
},{
    input: 'import { max, min } from "Math";',
    output: {
        imports: [],
    },
    transpiled: {
        esm: 'var max = __nollup__external__Math__max__;var min = __nollup__external__Math__min__;',
        iife: 'var _eMath = __nollup__global__.Math;var max = _eMath.max;var min = _eMath.min;',
        cjs: 'var _eMath = require("Math");var max = _eMath.max;var min = _eMath.min;'
    },
    config: {
        external: ['Math']
    }
}, {
    input: 'import $, { ajax } from "jquery";',
    output: {
        imports: [],
    },
    transpiled: {
        esm: 'var $ = __nollup__external__jquery__default__;var ajax = __nollup__external__jquery__ajax__;',
        iife: 'var _e$ = __nollup__global__.$;var $ = _e$ && _e$.hasOwnProperty("default")? _e$.default : _e$;var ajax = _e$.ajax;',
        cjs: 'var _e$ = require("jquery");var $ = _e$ && _e$.hasOwnProperty("default")? _e$.default : _e$;var ajax = _e$.ajax;'
    },
    config: {
        external: ['jquery']
    }
}, {
    input: 'import { ajax as net } from "jquery";',
    output: {
        imports: [],
    },
    transpiled: {
        esm: 'var net = __nollup__external__jquery__ajax__;',
        iife: 'var _e$ = __nollup__global__.$;var net = _e$.ajax;',
        cjs: 'var _e$ = require("jquery");var net = _e$.ajax;'
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
        imports: [],
        exports: ['ajax'],
    },
    transpiled: {
        esm: `var ex_ajax = __nollup__external__jquery__ajax__;__e__('ajax', ex_ajax);`,
        iife: `var _ejquery = __nollup__global__.jquery;var ex_ajax = _ejquery.ajax;__e__('ajax', ex_ajax);`,
        cjs: `var _ejquery = require("jquery");var ex_ajax = _ejquery.ajax;__e__('ajax', ex_ajax);`
    },
    config: {
        external: ['jquery']
    }
}, {
    input: 'export { ajax } from "jquery";',
    output: {
        imports: [],
        exports: ['ajax'],
    },
    transpiled: {
        esm: `var ex_ajax = __nollup__external__jquery__ajax__;__e__('ajax', ex_ajax);`,
        iife: `var _e$ = __nollup__global__.$;var ex_ajax = _e$.ajax;__e__('ajax', ex_ajax);`,
        cjs: `var _e$ = require("jquery");var ex_ajax = _e$.ajax;__e__('ajax', ex_ajax);`
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
        imports: [],
        exports: ['net'],
    },
    transpiled: {
        esm: `var ex_net = __nollup__external__jquery__ajax__;__e__('net', ex_net);`,
        iife: `var _e$ = __nollup__global__.$;var ex_net = _e$.ajax;__e__('net', ex_net);`,
        cjs: `var _e$ = require("jquery");var ex_net = _e$.ajax;__e__('net', ex_net);`
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
        imports: [{
            imported: '*',
            importee: '_ejquery'
        }],
        exports: [],
    },
    transpiled: {
        esm: `var _ejquery = __nollup__external__jquery__;for(var __k__ in ex_ejquery){__k__ !== "default" && (__e__(__k__, ex_ejquery[__k__]))}`,
        iife: `var _ejquery = __nollup__global__.jquery;for(var __k__ in ex_ejquery){__k__ !== "default" && (__e__(__k__, ex_ejquery[__k__]))}`,
        cjs: `var _ejquery = require("jquery");for(var __k__ in ex_ejquery){__k__ !== "default" && (__e__(__k__, ex_ejquery[__k__]))}`
    },
    config: {
        external: ['jquery']
    }
}, {
    input: 'export * from "jquery";',
    output: {
        imports: [{
            imported: '*',
            importee: '_e$'
        }],
        exports: [],
    },
    transpiled: {
        esm: `var _e$ = __nollup__external__jquery__;for(var __k__ in ex_e$){__k__ !== "default" && (__e__(__k__, ex_e$[__k__]))}`,
        iife: `var _e$ = __nollup__global__.$;for(var __k__ in ex_e$){__k__ !== "default" && (__e__(__k__, ex_e$[__k__]))}`,
        cjs: `var _e$ = require("jquery");for(var __k__ in ex_e$){__k__ !== "default" && (__e__(__k__, ex_e$[__k__]))}`
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
        imports: [],
    },
    transpiled: {
        esm: `var ajax = __nollup__external__jquery__ajax__;`,
        iife: `var _ejquery = __nollup__global__.jquery;var ajax = _ejquery.ajax;`,
        cjs: `var _ejquery = require("jquery");var ajax = _ejquery.ajax;`
    },
    config: {
        external: id => /jquery/.test(id)
    }
}, {
    input: 'import { ajax } from "some/other/dep";',
    output: {
        imports: [],
    },
    transpiled: {
        esm: `var ajax = __nollup__external__some_other_dep__ajax__;`,
        iife: `var _esome_other_dep = __nollup__global__.some_other_dep;var ajax = _esome_other_dep.ajax;`,
        cjs: `var _esome_other_dep = require("some/other/dep");var ajax = _esome_other_dep.ajax;`
    },
    config: {
        external: id => /some\/other\/dep/.test(id)
    }
}]

describe('es_to_cs_externals (ESM)', () => {
    external_tests.forEach(test => {
        it(test.input, async () => {
            let res = await es_to_cjs(test.input, {
                ...test.config, 
                output: { ...test.config.output, format: 'esm' }
            });
            let to_check = {};

            test.output.transpiled = test.transpiled.esm;

            for (let key in test.output) {
                to_check[key] = res[key];
            }


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

describe('es_to_cs_externals (CJS)', () => {
    external_tests.forEach(test => {
        it(test.input, async () => {
            let res = await es_to_cjs(test.input, {
                ...test.config, 
                output: { ...test.config.output, format: 'cjs' }
            });
            let to_check = {};
            test.output.transpiled = test.transpiled.cjs;

            for (let key in test.output) {
                to_check[key] = res[key];
            }

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

describe('es_to_cs_externals (IIFE)', () => {
    external_tests.forEach(test => {
        it(test.input, async () => {
            let res = await es_to_cjs(test.input, {
                ...test.config, 
                output: { ...test.config.output, format: 'iife' }
            });
            let to_check = {};
            test.output.transpiled = test.transpiled.iife;

            for (let key in test.output) {
                to_check[key] = res[key];
            }

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
        let res = await es_to_cjs(`
            import Hello from './World';
            let a = [1, 2, , 4];
        `, { plugins: [] }, process.cwd() + '/__entry');
        expect(res.transpiled.indexOf('[1, 2, , 4]') > -1).to.be.true;
    });
});