let es_to_cjs = require('../lib/__es2cjs');

let tests = [{
    input: 'import Hello from \'./world\';',
    output: 'var _i0 = require(__nollup__0);var Hello = _i0.default;'
}, {
    input: 'import \'./styles.css\';',
    output: 'var _i0 = require(__nollup__0);'
}, {
    input: 'import {member} from "./file";',
    output: 'var _i0 = require(__nollup__0);var member = _i0.member;'
}, {
    input: 'import { member } from "./file";',
    output: 'var _i0 = require(__nollup__0);var member = _i0.member;'
}, {
    input: 'import {mem1, mem2} from "./file";',
    output: 'var _i0 = require(__nollup__0);var mem1 = _i0.mem1;var mem2 = _i0.mem2;'
}, {
    input: 'import {member as lol} from "./file";',
    output: 'var _i0 = require(__nollup__0);var lol = _i0.member;'
}, {
    input: 'import * as lol from "./file";',
    output: 'var _i0 = require(__nollup__0);var lol = _i0;'
}, {
    input: 'import Hello, * as World from "./file";',
    output: 'var _i0 = require(__nollup__0);var Hello = _i0.default;var World = _i0;'
}, {
    input: 'export default Hello;',
    output: 'module.exports.default = Hello;'
}, {
    input: 'export default 123;',
    output: 'module.exports.default = 123;'
}, {
    input: 'export default class Hello {};',
    output: 'class Hello {}; module.exports.default = Hello;;'
}, {
    input: 'export default class Hello {}',
    output: 'class Hello {}; module.exports.default = Hello;'
}, {
    input: 'export class Hello {};',
    output: 'class Hello {}; module.exports.Hello = Hello;;'
}, {
    input: 'export class Hello {}',
    output: 'class Hello {}; module.exports.Hello = Hello;'
}, {
    input: 'export function Hello () {};',
    output: 'function Hello () {}; module.exports.Hello = Hello;;'
}, {
    input: 'export {name1, name2};',
    output: 'module.exports.name1 = name1;module.exports.name2 = name2;'
}, {
    input: 'export {hello as world, name};',
    output: 'module.exports.world = hello;module.exports.name = name;'
}, {
    input: 'export var MyVar1 = 123;',
    output: 'var MyVar1 = 123;; module.exports.MyVar1 = MyVar1;'
}, {
    input: 'export var MyVar1 = () => {}, MyVar2 = 456;',
    output: 'var MyVar1 = () => {}, MyVar2 = 456;; module.exports.MyVar1 = MyVar1, module.exports.MyVar2 = MyVar2;'
}, {
    input: 'export var MyVar1 = () => {}, MyVar2 = 456',
    output: 'var MyVar1 = () => {}, MyVar2 = 456; module.exports.MyVar1 = MyVar1, module.exports.MyVar2 = MyVar2;'
}, {
    input: 'export const MyVar1 = () => {}, MyVar2 = 456;',
    output: 'const MyVar1 = () => {}, MyVar2 = 456;; module.exports.MyVar1 = MyVar1, module.exports.MyVar2 = MyVar2;'
}, {
    input: 'export { MyVar } from "./file"',
    output: 'var _i0 = require(__nollup__0);module.exports.MyVar = _i0.MyVar;'
}, {
    input: 'export { default } from "./file";',
    output: 'var _i0 = require(__nollup__0);module.exports.default = _i0.default;'
}, {
    input: 'export * from "./file"',
    output: 'var _i0 = require(__nollup__0);for(var k in _i0){k !== "default" && (module.exports[k] = _i0[k])}'
}];

describe ('es_to_cjs', () => {
    tests.forEach(test => {
        it(test.input, () => {
            let { output } = es_to_cjs(test.input);
            if (output !== test.output) {
                throw new Error(`
                    Expected: ${test.output}
                    Actual: ${output}
                `)
            }
        });
    })
});

let external_tests = [{
    input: 'import jQuery from "jquery";',
    output: 'var _ejQuery = window.jQuery;var jQuery = _ejQuery && _ejQuery.hasOwnProperty("default")? _ejQuery.default : _ejQuery;',
    config: {
        external: ['jquery']
    }
}, {
    input: 'import $ from "jquery";',
    output: 'var _e$ = window.$;var $ = _e$ && _e$.hasOwnProperty("default")? _e$.default : _e$;',
    config: {
        external: ['jquery']
    }
}, {
    input: 'import jquery from "jquery";',
    output: 'var _e$ = window.$;var jquery = _e$ && _e$.hasOwnProperty("default")? _e$.default : _e$;',
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
    output: 'var _eMath = window.Math;var max = _eMath.max;',
    config: {
        external: ['Math']
    }
},{
    input: 'import { max, min } from "Math";',
    output: 'var _eMath = window.Math;var max = _eMath.max;var min = _eMath.min;',
    config: {
        external: ['Math']
    }
}, {
    input: 'import $, { ajax } from "jquery";',
    output: 'var _e$ = window.$;var $ = _e$ && _e$.hasOwnProperty("default")? _e$.default : _e$;var ajax = _e$.ajax;',
    config: {
        external: ['jquery']
    }
}, {
    input: 'import { ajax as net } from "jquery";',
    output: 'var _e$ = window.$;var net = _e$.ajax;',
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
    output: 'var _ejquery = window.jquery;module.exports.ajax = _ejquery.ajax;',
    config: {
        external: ['jquery']
    }
}, {
    input: 'export { ajax } from "jquery";',
    output: 'var _e$ = window.$;module.exports.ajax = _e$.ajax;',
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
    output: 'var _e$ = window.$;module.exports.net = _e$.ajax;',
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
    output: 'var _e$ = window.$;for(var k in _e$){k !== "default" && (module.exports[k] = _e$[k])}',
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
    output: 'var _ejquery = window.jquery;var ajax = _ejquery.ajax;',
    config: {
        external: id => /jquery/.test(id)
    }
}]

describe('es_to_cs_externals', () => {
    external_tests.forEach(test => {
        it(test.input, () => {
            let { output } = es_to_cjs(test.input, {
                options: test.config
            });
            if (output !== test.output) {
                throw new Error(`
                    Expected: ${test.output}
                    Actual: ${output}
                `)
            }
        });
    })
});