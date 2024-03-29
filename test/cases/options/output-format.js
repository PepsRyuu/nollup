let { nollup, fs, expect, rollup } = require('../../nollup');
let Evaluator = require('../../utils/evaluator');

describe ('Options: output.format', () => {
    describe('Misc', () => {
        it ('should throw an error for a non-supported format', async () => {
            fs.stub('./src/main.js', () => 'console.log(123)');
        
            let bundle = await nollup({
                input: './src/main.js',
                plugins: []
            });

            let passed;

            try {
                await bundle.generate({
                    format: 'umd'
                });
            } catch (e) {
                expect(e.message.indexOf('Invalid format "umd". Only es, cjs, iife, amd supported.') > -1).to.be.true;
                passed = true;
            }

            expect(passed).to.be.true;
            fs.reset();
        });
    })

    describe('es', () => {
        it ('should use externals from import', async () => {
            fs.stub('./src/main.js', () => 'import $ from "jquery";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery']
            });

            let { output } = await bundle.generate({
                format: 'es'
            });

            expect(output[0].code.indexOf(`import __nollup__external__jquery__default__ from 'jquery';`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var $ = __nollup__external__jquery__default__;`) > -1).to.be.true;
            fs.reset();
        });

        it ('should use externals from import for multiple files and duplicate imports', async () => {
            fs.stub('./src/other.js', () => `import { query } from "jquery"; import _ from 'lodash';`)
            fs.stub('./src/main.js', () => 'import "./other"; import { ajax } from "jquery";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery', 'lodash']
            });

            let { output } = await bundle.generate({
                format: 'es'
            });

            expect(output[0].code.indexOf(`import { ajax as __nollup__external__jquery__ajax__ } from 'jquery';`) > -1).to.be.true;
            expect(output[0].code.indexOf(`import { query as __nollup__external__jquery__query__ } from 'jquery';`) > -1).to.be.true;
            expect(output[0].code.indexOf(`import __nollup__external__lodash__default__ from 'lodash';`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var ajax = __nollup__external__jquery__ajax__;`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var query = __nollup__external__jquery__query__;`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var _ = __nollup__external__lodash__default__;`) > -1).to.be.true;
            fs.reset();
        });

        it ('should use complex externals from import', async () => {
            fs.stub('./src/main.js', () => 'import $ from "some/nested/dep";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['some/nested/dep']
            });

            let { output } = await bundle.generate({
                format: 'es'
            });

            expect(output[0].code.indexOf(`import __nollup__external__some_nested_dep__default__ from 'some/nested/dep';`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var $ = __nollup__external__some_nested_dep__default__;`) > -1).to.be.true;

            fs.reset();
        });

        it ('should use named specifiers externals from import', async () => {
            fs.stub('./src/main.js', () => 'import { ajax } from "jquery";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery']
            });

            let { output } = await bundle.generate({
                format: 'es'
            });

            expect(output[0].code.indexOf(`import { ajax as __nollup__external__jquery__ajax__ } from 'jquery';`) > -1).to.be.true;
            expect(output[0].code.indexOf('var ajax = __nollup__external__jquery__ajax__;') > -1).to.be.true;
            fs.reset();
        });

        it ('should use renamed specifiers externals from import', async () => {
            fs.stub('./src/main.js', () => 'import { ajax as myajax } from "jquery";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery']
            });

            let { output } = await bundle.generate({
                format: 'es'
            });

            expect(output[0].code.indexOf(`import { ajax as __nollup__external__jquery__ajax__ } from 'jquery';`) > -1).to.be.true;
            expect(output[0].code.indexOf('var myajax = __nollup__external__jquery__ajax__;') > -1).to.be.true;
            fs.reset();
        });

        it ('should use default and namespace from import', async () => {
            fs.stub('./src/main.js', () => 'import $, * as rest from "jquery";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery']
            });

            let { output } = await bundle.generate({
                format: 'es'
            });

            expect(output[0].code.indexOf(`import __nollup__external__jquery__default__ from 'jquery';`) > -1).to.be.true;
            expect(output[0].code.indexOf(`import * as __nollup__external__jquery__ from 'jquery';`) > -1).to.be.true;
            expect(output[0].code.indexOf('var $ = __nollup__external__jquery__default__;') > -1).to.be.true;
            expect(output[0].code.indexOf('var rest = __nollup__external__jquery__;') > -1).to.be.true;
            fs.reset();
        });

        it ('should allow export default', async () => {
            fs.stub('./src/main.js', () => 'export default 123;');
        
            let bundle = await nollup({
                input: './src/main.js'
            });

            let { output } = await bundle.generate({
                format: 'es'
            });

            expect(output[0].code.indexOf('export default ') > -1).to.be.true;
           
            let { exports } = await Evaluator.init('esm', 'main.js', output);
            expect(exports.default).to.equal(123);
            fs.reset();
        });

        it ('should allow named exports', async () => {
            fs.stub('./src/main.js', () => 'export default 123; export var hello = 456;');
        
            let bundle = await nollup({
                input: './src/main.js'
            });

            let { output } = await bundle.generate({
                format: 'es'
            });

            expect(output[0].code.indexOf('export default ') > -1).to.be.true;
            expect(output[0].code.indexOf('export var hello ') > -1).to.be.true;
           
            let { exports } = await Evaluator.init('esm', 'main.js', output);
            expect(exports.default).to.equal(123);
            expect(exports.hello).to.equal(456);
            fs.reset();
        });

        it ('should load chunks with dynamic import', async () => {
            fs.stub('./src/dep.js', () => 'export default 123;')
            fs.stub('./src/main.js', () => 'import("./dep")');
        
            let bundle = await nollup({
                input: './src/main.js'
            });

            let { output } = await bundle.generate({
                format: 'es'
            });

            let main = output.find(o => o.fileName.indexOf('main') > -1);
            expect(main.code.indexOf(' import(') > -1).to.be.true;
            fs.reset();
        });

        it ('should be default format', async () => {
            fs.stub('./src/dep.js', () => 'export default 123;')
            fs.stub('./src/main.js', () => 'import("./dep"); export default 456;');
        
            let bundle = await nollup({
                input: './src/main.js'
            });

            let { output } = await bundle.generate({
                format: 'es'
            });

            let main = output.find(o => o.fileName.indexOf('main') > -1);
            expect(main.code.indexOf(' import(') > -1).to.be.true;
            expect(main.code.indexOf('export default ') > -1).to.be.true;
            fs.reset();
        });

        it ('should import external bare imports', async () => {
            fs.stub('./src/main.js', () => 'import "jquery";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery']
            });

            let { output } = await bundle.generate({
                format: 'es'
            });

            expect(output[0].code.indexOf(`import 'jquery';`) > -1).to.be.true;
            fs.reset();
        });

        it ('should normalize the format alias esm to es', async () => {
            fs.stub('./src/main.js', () => 'import "jquery";');
            let passed = false;
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery'],
                plugins: [
                    {
                        generateBundle (outputOpts) {
                            expect(outputOpts.format).to.equal('es');
                            passed = true;
                        }
                    }
                ]
            });

            let { output } = await bundle.generate({
                format: 'esm'
            });

            expect(output[0].code.indexOf(`import 'jquery';`) > -1).to.be.true;
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should normalize the format alias module to es', async () => {
            fs.stub('./src/main.js', () => 'import "jquery";');
            let passed = false;
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery'],
                plugins: [
                    {
                        generateBundle (outputOpts) {
                            expect(outputOpts.format).to.equal('es');
                            passed = true;
                        }
                    }
                ]
            });

            let { output } = await bundle.generate({
                format: 'module'
            });

            expect(output[0].code.indexOf(`import 'jquery';`) > -1).to.be.true;
            expect(passed).to.be.true;
            fs.reset();
        });
    });

    describe('cjs', () => {
        it ('should use externals using require', async () => {
            fs.stub('./src/main.js', () => 'import $ from "jquery";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery']
            });

            let { output } = await bundle.generate({
                format: 'cjs'
            });

            expect(output[0].code.match(/import (.*?) from 'jquery'/)).to.be.null;
            expect(output[0].code.indexOf(`var __nollup__external__jquery__default__ = require('jquery').hasOwnProperty('default')? require('jquery').default : require('jquery');`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var $ = __nollup__external__jquery__default__;`) > -1).to.be.true;
            fs.reset();
        });

        it ('should use externals from import for multiple files and duplicate imports', async () => {
            fs.stub('./src/other.js', () => `import { query } from "jquery"; import _ from 'lodash';`)
            fs.stub('./src/main.js', () => 'import "./other"; import { ajax } from "jquery";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery', 'lodash']
            });

            let { output } = await bundle.generate({
                format: 'cjs'
            });

            expect(output[0].code.indexOf(`var __nollup__external__jquery__ajax__ = require('jquery').ajax;`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var __nollup__external__jquery__query__ = require('jquery').query;`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var __nollup__external__lodash__default__ = require('lodash').hasOwnProperty('default')? require('lodash').default : require('lodash');`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var ajax = __nollup__external__jquery__ajax__;`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var query = __nollup__external__jquery__query__;`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var _ = __nollup__external__lodash__default__;`) > -1).to.be.true;
            fs.reset();
        });

        it ('should use renamed specifiers externals from import', async () => {
            fs.stub('./src/main.js', () => 'import { ajax as myajax } from "jquery";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery']
            });

            let { output } = await bundle.generate({
                format: 'cjs'
            });

            expect(output[0].code.indexOf(`var __nollup__external__jquery__ajax__ = require('jquery').ajax;`) > -1).to.be.true;
            expect(output[0].code.indexOf('var myajax = __nollup__external__jquery__ajax__;') > -1).to.be.true;
            fs.reset();
        });

        it ('should use default and namespace from import', async () => {
            fs.stub('./src/main.js', () => 'import $, * as rest from "jquery";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery']
            });

            let { output } = await bundle.generate({
                format: 'cjs'
            });

            expect(output[0].code.indexOf(`var __nollup__external__jquery__default__ = require('jquery').hasOwnProperty('default')? require('jquery').default : require('jquery');`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var __nollup__external__jquery__ = require('jquery');`) > -1).to.be.true;
            expect(output[0].code.indexOf('var $ = __nollup__external__jquery__default__;') > -1).to.be.true;
            expect(output[0].code.indexOf('var rest = __nollup__external__jquery__;') > -1).to.be.true;
            fs.reset();
        });


        it ('should set default to module.exports if only export', async () => {
            fs.stub('./src/main.js', () => 'export default 123;');
        
            let bundle = await nollup({
                input: './src/main.js'
            });

            let { output } = await bundle.generate({
                format: 'cjs'
            });

            expect(output[0].code.indexOf('export default ') === -1).to.be.true;
            let { exports } = await Evaluator.init('cjs', 'main.js', output);
            expect(exports).to.equal(123);
            fs.reset();
        });

        it ('should set default to key and named exports if together', async () => {
            fs.stub('./src/main.js', () => 'export default 123; export var hello = 456;');
        
            let bundle = await nollup({
                input: './src/main.js'
            });

            let { output } = await bundle.generate({
                format: 'cjs'
            });

            expect(output[0].code.indexOf('export default ') === -1).to.be.true;
            expect(output[0].code.indexOf('export var hello ') === -1).to.be.true;
           
            let { exports } = await Evaluator.init('cjs', 'main.js', output);
            expect(exports.default).to.equal(123);
            expect(exports.hello).to.equal(456);
            fs.reset();
        });

        it ('should load chunks with Promise require', async () => {
            fs.stub('./src/dep.js', () => 'export default 123;')
            fs.stub('./src/main.js', () => 'import("./dep")');
        
            let bundle = await nollup({
                input: './src/main.js'
            });

            let { output } = await bundle.generate({
                format: 'cjs'
            });

            let main = output.find(o => o.fileName.indexOf('main') > -1);
            expect(main.code.indexOf(' import(') === -1).to.be.true;
            expect(main.code.indexOf('Promise.resolve(require(') > -1).to.be.true;
            fs.reset();
        });

        it ('should not conflict with local require', async () => {
            fs.stub('./src/main.js', () => 'let fs = require("fs"); export default fs.readFileSync.toString();');
        
            let bundle = await nollup({
                input: './src/main.js'
            });

            let { output } = await bundle.generate({
                format: 'cjs'
            });

            let { exports } = await Evaluator.init('cjs', 'main.js', output);
            expect(exports.startsWith('function readFileSync')).to.be.true;
            fs.reset();
        });

        it ('should allow require properties to be accessed', async () => {
            fs.stub('./src/main.js', () => `
                export default {
                    resolve: typeof require.resolve,
                    extensions: typeof require.extensions,
                    cache: typeof require.cache
                }
            `);
            let bundle = await nollup({
                input: './src/main.js'
            });

            let { output } = await bundle.generate({
                format: 'cjs'
            });

            let { exports } = await Evaluator.init('cjs', 'main.js', output);
            expect(exports.resolve).to.equal('function');
            expect(exports.extensions).to.equal('object');
            expect(exports.cache).to.equal('object');
            fs.reset();
        });

        it ('should allow module.exports to work', async () => {
            fs.stub('./src/main.js', () => 'module.exports = 123;');
            let bundle = await nollup({
                input: './src/main.js'
            });

            let { output } = await bundle.generate({
                format: 'cjs'
            });

            let { exports } = await Evaluator.init('cjs', 'main.js', output);
            expect(exports).to.equal(123);
            fs.reset();
        });

        it ('should require external bare imports', async () => {
            fs.stub('./src/main.js', () => 'import "jquery";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery']
            });

            let { output } = await bundle.generate({
                format: 'cjs'
            });

            expect(output[0].code.indexOf(`require('jquery');`) > -1).to.be.true;
            expect(output[0].code.indexOf(` = require('jquery');`) === -1).to.be.true;
            fs.reset();
        });

        it ('should normalize the format alias commonjs to cjs', async () => {
            fs.stub('./src/main.js', () => 'import "jquery";');
            let passed = false;
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery'],
                plugins: [
                    {
                        generateBundle (outputOpts) {
                            expect(outputOpts.format).to.equal('cjs');
                            passed = true;
                        }
                    }
                ]
            });

            let { output } = await bundle.generate({
                format: 'commonjs'
            });

            expect(output[0].code.indexOf(`require('jquery');`) > -1).to.be.true;
            expect(passed).to.be.true;
            fs.reset();
        });
    });

    describe('iife', () => {
        it ('should use externals from window', async () => {
            fs.stub('./src/main.js', () => 'import jquery from "jquery";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery']
            });

            let { output } = await bundle.generate({
                format: 'iife'
            });

            expect(output[0].code.match(/import (.*?) from 'jquery'/)).to.be.null;
            expect(output[0].code.indexOf(`var __nollup__external__jquery__default__ = self.jquery && self.jquery.hasOwnProperty('default')? self.jquery.default : self.jquery;`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var jquery = __nollup__external__jquery__default__;`) > -1).to.be.true;
            fs.reset();
        });

        it ('should use externals from window using global name', async () => {
            fs.stub('./src/main.js', () => 'import $ from "jquery";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery']
            });

            let { output } = await bundle.generate({
                format: 'iife',
                globals: {
                    'jquery': '$'
                }
            });

            expect(output[0].code.match(/import (.*?) from 'jquery'/)).to.be.null;
            expect(output[0].code.indexOf(`var __nollup__external__jquery__default__ = self.$ && self.$.hasOwnProperty('default')? self.$.default : self.$;`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var $ = __nollup__external__jquery__default__;`) > -1).to.be.true;

            fs.reset();
        });

        it ('should use externals from import for multiple files and duplicate imports', async () => {
            fs.stub('./src/other.js', () => `import { query } from "jquery"; import lodash from 'lodash';`)
            fs.stub('./src/main.js', () => 'import "./other"; import { ajax } from "jquery";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery', 'lodash']
            });

            let { output } = await bundle.generate({
                format: 'iife'
            });

            expect(output[0].code.indexOf(`var __nollup__external__jquery__ajax__ = self.jquery.ajax;`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var __nollup__external__jquery__query__ = self.jquery.query;`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var __nollup__external__lodash__default__ = self.lodash && self.lodash.hasOwnProperty('default')? self.lodash.default : self.lodash;`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var ajax = __nollup__external__jquery__ajax__;`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var query = __nollup__external__jquery__query__;`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var lodash = __nollup__external__lodash__default__;`) > -1).to.be.true;
            fs.reset();
        });

        it ('should use renamed specifiers externals from import', async () => {
            fs.stub('./src/main.js', () => 'import { ajax as myajax } from "jquery";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery']
            });

            let { output } = await bundle.generate({
                format: 'iife'
            });

            expect(output[0].code.indexOf(`var __nollup__external__jquery__ajax__ = self.jquery.ajax;`) > -1).to.be.true;
            expect(output[0].code.indexOf('var myajax = __nollup__external__jquery__ajax__;') > -1).to.be.true;
            fs.reset();
        });

        it ('should use default and namespace from import', async () => {
            fs.stub('./src/main.js', () => 'import $, * as rest from "jquery";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery']
            });

            let { output } = await bundle.generate({
                format: 'iife'
            });

            expect(output[0].code.indexOf(`var __nollup__external__jquery__default__ = self.$ && self.$.hasOwnProperty('default')? self.$.default : self.$;`) > -1).to.be.true;
            expect(output[0].code.indexOf(`var __nollup__external__jquery__ = self.$;`) > -1).to.be.true;
            expect(output[0].code.indexOf('var $ = __nollup__external__jquery__default__;') > -1).to.be.true;
            expect(output[0].code.indexOf('var rest = __nollup__external__jquery__;') > -1).to.be.true;
            fs.reset();
        });


        it ('should not have any export statements', async () => {
            fs.stub('./src/main.js', () => 'export default 123;');
        
            let bundle = await nollup({
                input: './src/main.js'
            });

            let { output } = await bundle.generate({
                format: 'iife'
            });

            expect(output[0].code.indexOf('export default ') === -1).to.be.true;
            let result = await Evaluator.init('iife', 'main.js', output);
            expect(result.exports).to.be.undefined;
            fs.reset();
        });

         it ('should not support dynamic import', async () => {
            fs.stub('./src/dep.js', () => 'export default 123;')
            fs.stub('./src/main.js', () => 'import("./dep")');
        
            let bundle = await nollup({
                input: './src/main.js'
            });

            let { output } = await bundle.generate({
                format: 'iife'
            });

            let main = output.find(o => o.fileName.indexOf('main') > -1);
            expect(main.code.indexOf(' import(') === -1).to.be.true;
            expect(main.code.indexOf(' Promise.resolve(require(') === -1).to.be.true;
            fs.reset();
        });

        it ('should do nothing with external bare imports', async () => {
            fs.stub('./src/main.js', () => 'import "jquery";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery']
            });

            let { output } = await bundle.generate({
                format: 'iife'
            });

            expect(output[0].code.indexOf(`require('jquery');`) === -1).to.be.true;
            expect(output[0].code.indexOf(` = require('jquery');`) === -1).to.be.true;
            expect(output[0].code.indexOf(`import 'jquery';`) === -1).to.be.true;
            fs.reset();
        });

    });
});