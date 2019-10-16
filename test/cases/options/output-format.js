let { nollup, fs, expect, rollup } = require('../../nollup');
let path = require('path');

function requireString (code) {
    let module = { exports : {} };
    eval(code);
    return module.exports;
}


describe ('Options: output.format', () => {
    describe('esm', () => {
        it ('should use externals from window', async () => {
            fs.stub('./src/main.js', () => 'import $ from "jquery";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery']
            });

            let { output } = await bundle.generate({
                format: 'esm'
            });

            expect(output[0].code.indexOf('var _e$ = __nollup__global__.$') > -1).to.be.true;
            fs.reset();
        });

        it ('should allow export default', async () => {
            fs.stub('./src/main.js', () => 'export default 123;');
        
            let bundle = await nollup({
                input: './src/main.js'
            });

            let { output } = await bundle.generate({
                format: 'esm'
            });

            expect(output[0].code.indexOf('export default ') > -1).to.be.true;
           
            let code = output[0].code.replace('export default', 'module.exports.default=');
            let exports = requireString(code);
            expect(exports.default).to.equal(123);
            fs.reset();
        });

        it ('should allow named exports', async () => {
            fs.stub('./src/main.js', () => 'export default 123; export var hello = 456;');
        
            let bundle = await nollup({
                input: './src/main.js'
            });

            let { output } = await bundle.generate({
                format: 'esm'
            });

            expect(output[0].code.indexOf('export default ') > -1).to.be.true;
            expect(output[0].code.indexOf('export var hello ') > -1).to.be.true;
           
            let code = output[0].code.replace('export default', 'module.exports.default=');
            code = code.replace('export var hello', 'module.exports.hello');

            let exports = requireString(code);
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
                format: 'esm'
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
                format: 'esm'
            });

            let main = output.find(o => o.fileName.indexOf('main') > -1);
            expect(main.code.indexOf(' import(') > -1).to.be.true;
            expect(main.code.indexOf('export default ') > -1).to.be.true;
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

            console.log(output[0].code);
            expect(output[0].code.indexOf('var _e$ = require("jquery")') > -1).to.be.true;
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
            let exports = requireString(output[0].code);
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
           
            let exports = requireString(output[0].code);
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
            fs.stub('./src/main.js', () => 'let fs = require("fs"); export default fs;');
        
            let bundle = await nollup({
                input: './src/main.js'
            });

            let { output } = await bundle.generate({
                format: 'cjs'
            });

            let exports = requireString(output[0].code);
            expect(typeof exports.readFileSync).to.equal('function');
            fs.reset();
        });

        it ('should allow require properties to be accessed', async () => {
            fs.stub('./src/main.js', () => 'export default require;');
            let bundle = await nollup({
                input: './src/main.js'
            });

            let { output } = await bundle.generate({
                format: 'cjs'
            });

            let exports = requireString(output[0].code);
            expect(typeof exports.resolve).to.equal('function');
            expect(typeof exports.extensions).to.equal('object');
            expect(typeof exports.cache).to.equal('object');
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

            let exports = requireString(output[0].code);
            expect(exports).to.equal(123);
            fs.reset();
        });
    });

    describe('iife', () => {
        it ('should use externals from window', async () => {
            fs.stub('./src/main.js', () => 'import $ from "jquery";');
        
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery']
            });

            let { output } = await bundle.generate({
                format: 'iife'
            });

            expect(output[0].code.indexOf('var _e$ = __nollup__global__.$') > -1).to.be.true;
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
            let exports = requireString(output[0].code);
            expect(exports).to.deep.equal({});
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
    });
});