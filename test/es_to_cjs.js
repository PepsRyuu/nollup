let es_to_cjs = require('../src/es_to_cjs');

let tests = [{
    input: 'import Hello from \'./world\';',
    output: 'var _i0 = require(__nollup__0); var Hello = _i0.default;'
}, {
    input: 'import \'./styles.css\';',
    output: 'var _i0 = require(__nollup__0);'
}, {
    input: 'import {member} from "./file";',
    output: 'var _i0 = require(__nollup__0); var member = _i0.member;'
}, {
    input: 'import { member } from "./file";',
    output: 'var _i0 = require(__nollup__0); var member = _i0.member;'
}, {
    input: 'import {mem1, mem2} from "./file";',
    output: 'var _i0 = require(__nollup__0); var mem1 = _i0.mem1, mem2 = _i0.mem2;'
}, {
    input: 'import {member as lol} from "./file";',
    output: 'var _i0 = require(__nollup__0); var lol = _i0.member;'
}, {
    input: 'import * as lol from "./file";',
    output: 'var _i0 = require(__nollup__0); var lol = _i0;'
}, {
    input: 'import Hello, * as World from "./file";',
    output: 'var _i0 = require(__nollup__0); var Hello = _i0.default, World = _i0;'
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
    output: 'module.exports.name1 = name1, module.exports.name2 = name2;'
}, {
    input: 'export {hello as world, name};',
    output: 'module.exports.world = hello, module.exports.name = name;'
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