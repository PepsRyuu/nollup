let { nollup, fs, expect, rollup } = require('../../nollup');
let path = require('path');
let MagicString = require('magic-string');
let Evaluator = require('../../utils/evaluator');

describe ('API: Plugin Hooks', () => {
    async function generate (plugins) {
        fs.stub('./src/main.js', () => 'export default 123');

        let bundle = await nollup({
            input: './src/main.js',
            plugins
        });

        let { output } = await bundle.generate({ format: 'esm' });
        output[0].code = output[0].code.trim().replace(/\n\n/g, '\n'); // intro double line
        fs.reset();
        return output;
    }

    describe('Miscellaneous Issues', () => {
        it ('should ignore falsy plugins', async () => {
            // Intentional comma at the beginning
            let output = await generate([,false, null, undefined,,]);
            expect(output[0].code).not.to.be.undefined;
        });

        it ('should allow syntheticNamedExports for function exports', async () => {
            fs.stub('./src/main.js', () => `
                import Default, { hello as hello_impl } from "./lol";  
                export default Default();
                export var hello = typeof hello_impl === 'function'? hello_impl() : undefined;
            `);
            fs.stub('./src/lol.js', () => `
                function hello () { 
                    return "world";
                }

                hello.hello = hello;

                export default hello;
            `);

            let phase = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    load (id) {
                        if (id.indexOf('lol') > -1) {
                            return { 
                                code: fs.readFileSync(id, 'utf8'),
                                syntheticNamedExports: phase === 1
                            }
                        }
                        
                    }
                }]
            });

            let output = (await bundle.generate({ format: 'esm' })).output;
            let result = await Evaluator.init('esm', 'main.js', output);
            expect(result.exports.default).to.equal('world');
            expect(result.exports.hello).to.be.undefined;

            phase = 1;
            bundle.invalidate('./src/lol.js');
            output = (await bundle.generate({ format: 'esm' })).output;
            result = await Evaluator.init('esm', 'main.js', output);
            expect(result.exports.default).to.equal('world');
            expect(result.exports.hello).to.equal('world');

            fs.reset();
        });

        it ('should not crash for syntheticNamedExports for number exports', async () => {
            fs.stub('./src/main.js', () => 'import Default from "./lol";  export { Default as default };');
            fs.stub('./src/lol.js', () => `
                export default 123;
            `);

            let phase = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    load (id) {
                        if (id.indexOf('lol') > -1) {
                            return { 
                                code: fs.readFileSync(id, 'utf8'),
                                syntheticNamedExports: phase === 1
                            }
                        }
                        
                    }
                }]
            });

            let output = (await bundle.generate({ format: 'esm' })).output;
            let result = await Evaluator.init('esm', 'main.js', output);
            expect(result.exports.default).to.equal(123);

            phase = 1;
            bundle.invalidate('./src/lol.js');
            output = (await bundle.generate({ format: 'esm' })).output;
            result = await Evaluator.init('esm', 'main.js', output);
            expect(result.exports.default).to.equal(123);

            fs.reset();
        });

        it ('should export default if using custom string for syntheticNamedExports (issue with axios)', async () => {
            fs.stub('./src/main.js', () => `
                export { default } from './lol'
            `);

            fs.stub('./src/lol.js', () => `
                var lib = { default: 'hello', impl: true };
                export default lib;
                export var __moduleExports = lib;
            `);

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        if (id.indexOf('lol') > -1) {
                            return { 
                                code,
                                syntheticNamedExports: '__moduleExports'
                            }
                        }
                        
                    }
                }]
            });

            let output = (await bundle.generate({ format: 'esm' })).output;
            let result = await Evaluator.init('esm', 'main.js', output);
            expect(result.exports.default).to.deep.equal({ default: 'hello', impl: true });

            fs.reset();
        });

        it ('should export default if using custom string for syntheticNamedExports when using live bindings (issue with axios)', async () => {
            fs.stub('./src/main.js', () => `
                export { default } from './lol'
            `);
            fs.stub('./src/lol.js', () => `
                var lib = { default: 'hello', impl: true };
                export default lib;
                export var __moduleExports = lib;
            `);

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        if (id.indexOf('lol') > -1) {
                            return { 
                                code,
                                syntheticNamedExports: '__moduleExports'
                            }
                        }
                        
                    }
                }]
            });

            bundle.configure({ liveBindings: true });
            let output = (await bundle.generate({ format: 'esm' })).output;
            let result = await Evaluator.init('esm', 'main.js', output);
            expect(result.exports.default).to.deep.equal({ default: 'hello', impl: true });

            fs.reset();
        });
    });

    describe('banner', () => {
        it ('should accept string', async () => {
            let output = await generate([{
                banner: '/*banner*/'
            }]);
        
            expect(output[0].code.trim().startsWith('/*banner*/')).to.be.true;
        });

        it ('should allow multiple calls', async () => {
            let output = await generate([{
                banner: '/*banner*/'
            }, {
                banner: '/*twice*/'
            }]);

            expect(output[0].code.trim().startsWith('/*banner*/\n/*twice*/')).to.be.true;
        });

        it ('should accept function returning a string', async () => {
            let output = await generate([{
                banner: () => '/*banner*/'
            }, {
                banner: () => '/*twice*/'
            }]);

            expect(output[0].code.trim().startsWith('/*banner*/\n/*twice*/')).to.be.true;
        });

        it ('should accept function returning a promise returning a string', async () => {
            let output = await generate([{
                banner: () => new Promise(resolve => resolve('/*banner*/'))
            }, {
                banner: '/*twice*/'
            }]);

            expect(output[0].code.trim().startsWith('/*banner*/\n/*twice*/')).to.be.true;
        });
    });

    describe('intro', () => {
        it ('should accept string', async () => {
            let output = await generate([{
                intro: '/*intro*/'
            }]);
        
            expect(output[0].code.trim().startsWith('/*intro*/')).to.be.true;
        });

        it ('should allow multiple calls', async () => {
            let output = await generate([{
                intro: '/*intro*/'
            }, {
                intro: '/*twice*/'
            }]);

            expect(output[0].code.trim().startsWith('/*intro*/\n/*twice*/')).to.be.true;
        });

        it ('should accept function returning a string', async () => {
            let output = await generate([{
                intro: () => '/*intro*/'
            }, {
                intro: () => '/*twice*/'
            }]);

            expect(output[0].code.trim().startsWith('/*intro*/\n/*twice*/')).to.be.true;
        });

        it ('should accept function returning a promise returning a string', async () => {
            let output = await generate([{
                intro: () => new Promise(resolve => resolve('/*intro*/'))
            }, {
                intro: '/*twice*/'
            }]);

            expect(output[0].code.trim().startsWith('/*intro*/\n/*twice*/')).to.be.true;
        });
    });

    describe('footer', () => {
        it ('should accept string', async () => {
            let output = await generate([{
                footer: '/*footer*/'
            }]);

            expect(output[0].code.endsWith('/*footer*/')).to.be.true;
        });

        it ('should allow multiple calls', async () => {
            let output = await generate([{
                footer: '/*footer*/'
            }, {
                footer: '/*twice*/'
            }]);

            expect(output[0].code.endsWith('/*footer*/\n/*twice*/')).to.be.true;
        });

        it ('should accept function returning a string', async () => {
            let output = await generate([{
                footer: () => '/*footer*/'
            }, {
                footer: () => '/*twice*/'
            }]);

            expect(output[0].code.endsWith('/*footer*/\n/*twice*/')).to.be.true;
        });

        it ('should accept function returning a promise returning a string', async () => {
            let output = await generate([{
                footer: () => new Promise(resolve => resolve('/*footer*/'))
            }, {
                footer: '/*twice*/'
            }]);

            expect(output[0].code.endsWith('/*footer*/\n/*twice*/')).to.be.true;
        });
    });

    describe('outro', () => {
        it ('should accept string', async () => {
            let output = await generate([{
                outro: '/*outro*/'
            }]);

            expect(output[0].code.endsWith('/*outro*/')).to.be.true;
        });

        it ('should allow multiple calls', async () => {
            let output = await generate([{
                outro: '/*outro*/'
            }, {
                outro: '/*twice*/'
            }]);

            expect(output[0].code.endsWith('/*outro*/\n/*twice*/')).to.be.true;
        });

        it ('should accept function returning a string', async () => {
            let output = await generate([{
                outro: () => '/*outro*/'
            }, {
                outro: () => '/*twice*/'
            }]);

            expect(output[0].code.endsWith('/*outro*/\n/*twice*/')).to.be.true;
        });

        it ('should accept function returning a promise returning a string', async () => {
            let output = await generate([{
                outro: () => new Promise(resolve => resolve('/*outro*/'))
            }, {
                outro: '/*twice*/'
            }]);

            expect(output[0].code.endsWith('/*outro*/\n/*twice*/')).to.be.true;
        });
    });

    describe('generateBundle', () => {
        it ('should receive output options, and bundle metadata', async () => {
            fs.stub('./src/main.js', () => 'import("./dynamic.js"); export default 123');
            fs.stub('./src/dynamic.js', () => 'export default 456');
            
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    generateBundle (outputOptions, bundle) {
                        expect(outputOptions).not.to.be.undefined;
                        expect(outputOptions.entryFileNames).to.equal('[name].js');
                        expect(bundle['main.js'].fileName).to.equal('main.js');
                        expect(bundle['lol.js'].fileName).to.equal('lol.js');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({
                format: 'esm',
                entryFileNames: '[name].js',
                chunkFileNames: 'lol.js'
            });

            expect(passed).to.be.true;

            fs.reset();
        });

        it ('should be possible to return a promise and wait on that promise', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    generateBundle (outputOptions, bundle) {
                        return new Promise(resolve => {
                            passed = true;
                            resolve();
                        });
                    }
                }]
            });

            let { output } = await bundle.generate({
                format: 'esm'
            });

            expect(passed).to.be.true;

            fs.reset();
        });

        it ('should be called multiple times', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            
            let passed1 = false;
            let passed2 = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    generateBundle () {
                        return new Promise(resolve => {
                            passed1 = true;
                            resolve();
                        });
                    }
                }, {
                    generateBundle () {
                        return new Promise(resolve => {
                            passed2 = true;
                            resolve();
                        })
                    }
                }]
            });

            let { output } = await bundle.generate({
                format: 'esm'
            });

            expect(passed1).to.be.true;
            expect(passed2).to.be.true;

            fs.reset();
        })
    });

    describe ('load', () => {
        it ('should receive an id string for the module being loaded', async () => {
            fs.stub('./src/lol.js', () => 'export default 123;');
            fs.stub('./src/main.js', () => 'import "./lol.js";');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    load (id) {
                        if (id.indexOf('lol.js') > -1) {
                            let target = path.resolve(process.cwd(), './src/lol.js');
                            expect(id).to.equal(target);
                            passed = true;
                            return 'lol';
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should return a string with code', async () => {
            fs.stub('./src/lol.js', () => 'export default 123;');
            fs.stub('./src/main.js', () => 'import "./lol.js";');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    load (id) {
                        if (id.indexOf('lol.js') > -1) {
                            return 'export default 999;';
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf(`var __ex_default__ = 999; __e__(\\'default\\', function () { return __ex_default__ })`) > -1).to.be.true;
            fs.reset();
        });

        it ('should return null implying to defer to another loader', async () => {
            fs.stub('./src/lol.js', () => 'export default 123;');
            fs.stub('./src/main.js', () => 'import "./lol.js";');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    load (id) {
                        return null;
                    }
                }, {
                    load (id) {
                        if (id.indexOf('lol.js') > -1) {
                            return 'export default 999;';
                        }
                    }
                }, {
                    load (id) {
                        if (id.indexOf('lol.js') > -1) {
                            return 'export default 111;';
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf(`var __ex_default__ = 999; __e__(\\'default\\', function () { return __ex_default__ })`) > -1).to.be.true;
            fs.reset();
        });


        it ('should be allowed to return a promise following any return', async () => {
            fs.stub('./src/lol.js', () => 'export default 123;');
            fs.stub('./src/main.js', () => 'import "./lol.js";');

            // TODO: Doesn't work in Rollup
            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    load (id) {
                        if (id.indexOf('lol.js') > -1) {
                            return new Promise(resolve => {
                                resolve('export default 999;');
                            })
                        } 

                        return null;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf(`var __ex_default__ = 999; __e__(\\'default\\', function () { return __ex_default__ })`) > -1).to.be.true;
            fs.reset();
        });

        it ('should be allowed to return an object with code and map', async () => {
            fs.stub('./src/lol.js', () => 'export default 123;');
            fs.stub('./src/main.js', () => 'import "./lol.js";');

            // TODO: Doesn't work in Rollup
            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    load (id) {
                        if (id.indexOf('lol.js') > -1) {
                            return { code: 'export default 999', map: '' };
                        } 

                        return null;
                    },

                    transform (code) {
                        expect(typeof code).to.equal('string');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf(`var __ex_default__ = 999; __e__(\\'default\\', function () { return __ex_default__ })`) > -1).to.be.true;
            fs.reset();
        });

        it ('should allow loaded module to be marked syntheticNamedExports', async () => {
            fs.stub('./src/main.js', () => 'import Default, { hello } from "./lol";  export { Default as default, hello };');
            fs.stub('./src/lol.js', () => 'export default { hello: "world" };')
            let phase = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    load (id) {
                        if (id.indexOf('lol') > -1) {
                            return { 
                                code: fs.readFileSync(id, 'utf8'),
                                syntheticNamedExports: phase === 1
                            }
                        }
                        
                    }
                }]
            });

            let output = (await bundle.generate({ format: 'esm' })).output;
            let result = await Evaluator.init('esm', 'main.js', output);
            expect(result.exports.default.hello).to.equal('world');
            expect(result.exports.hello).to.be.undefined;

            phase = 1;
            bundle.invalidate('./src/lol.js');
            output = (await bundle.generate({ format: 'esm' })).output;
            result = await Evaluator.init('esm', 'main.js', output);
            expect(result.exports.default.hello).to.equal('world');
            expect(result.exports.hello).to.equal('world');

            fs.reset();
        });

        it ('should should accept a string for syntheticNamedExports', async () => {
            fs.stub('./src/main.js', () => 'export { hello } from "./lol";');
            fs.stub('./src/lol.js', () => 'export var __moduleExports = { hello: "world" };')
            let phase = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    load (id) {
                        if (id.indexOf('lol') > -1) {
                            return { 
                                code: fs.readFileSync(id, 'utf8'),
                                syntheticNamedExports: phase === 0? false : '__moduleExports'
                            }
                        }
                        
                    }
                }]
            });

            let output = (await bundle.generate({ format: 'esm' })).output;
            let result = await Evaluator.init('esm', 'main.js', output);
            expect(result.exports.hello).to.be.undefined;

            phase = 1;
            bundle.invalidate('./src/lol.js');
            output = (await bundle.generate({ format: 'esm' })).output;
            result = await Evaluator.init('esm', 'main.js', output);
            expect(result.exports.hello).to.equal('world');

            fs.reset();
        });

        it ('should be allowed to return an AST');
        it ('should be allowed to return an AST as a string');

        it ('should allow meta option to be returned', async () => {
            fs.stub('./src/main.js', () => `
                import Value from "lol";
                console.log(Value);
            `);
            
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveId (id) {
                        return path.resolve(process.cwd(), id);
                    },
                    load (id) {
                        if (id.indexOf('lol') > -1) {
                            return {
                                code: 'export default 999;',
                                meta: {
                                    prop: 123
                                }
                            }
                        }
                    },
                    buildEnd () {
                        let [ mainId, lolId ] = Array.from(this.getModuleIds());
                        expect(this.getModuleInfo(mainId).meta.prop).to.be.undefined;
                        expect(this.getModuleInfo(lolId).meta.prop).to.equal(123);
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
        });
    });


    describe ('resolveId', () => {
        it ('should pass importee and importer as string values', async () => {
            fs.stub('./src/main.js', () => 'import "./lol.js";');
            fs.stub('./src/lol.js', () => '');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveId (importee, importer) {
                        if (importee === './lol.js') {
                            if (importer === path.resolve(process.cwd(), './src/main.js')) {
                                passed = true;
                            }
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should accept string as a return value to a file', async () => {
            fs.stub('./src/main.js', () => 'import "haha";');
            fs.stub('./src/lol.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveId (importee, importer) {
                        if (importee === 'haha') {
                            return path.resolve(process.cwd(), './src/lol.js');
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf(`var __ex_default__ = 123; __e__(\\'default\\', function () { return __ex_default__ })`) > -1).to.be.true;
            fs.reset();
        });

        it ('should accept null to defer to next hook', async () => {
            fs.stub('./src/main.js', () => 'import "haha";');
            fs.stub('./src/lol.js', () => 'export default 123');
            let passed1 = false, passed2 = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveId () {
                        passed1 = true;
                        return null;
                    }
                }, {
                    resolveId (importee, importer) {
                        if (importee === 'haha') {
                            passed2 = true;
                            return path.resolve(process.cwd(), './src/lol.js');
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf(`var __ex_default__ = 123; __e__(\\'default\\', function () { return __ex_default__ })`) > -1).to.be.true;
            expect(passed1).to.be.true;
            expect(passed2).to.be.true;
            fs.reset();
        });

        it ('should accept false to treat as external module', async () => {
            fs.stub('./src/main.js', () => 'import "haha";');
            fs.stub('./src/lol.js', () => 'export default 123;');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveId (importee, importer) {
                        if (importee === 'haha') {
                            return false;
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf('import \'haha\';') > -1).to.be.true;
            expect(output[0].code.indexOf(`var __ex_default__ = 123; __e__(\\'default\\', function () { return __ex_default__ })`) === -1).to.be.true;
            fs.reset();
        });

        it ('should accept promises', async () => {
            fs.stub('./src/main.js', () => 'import "haha";');
            fs.stub('./src/lol.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveId (importee, importer) {
                        return new Promise(resolve => {
                            if (importee === 'haha') {
                                resolve(path.resolve(process.cwd(), './src/lol.js'));
                            } else {
                                resolve(null);
                            }
                        });
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf(`var __ex_default__ = 123; __e__(\\'default\\', function () { return __ex_default__ })`) > -1).to.be.true;
            fs.reset();
        });

        it ('should accept objects with id', async () => {
            fs.stub('./src/main.js', () => 'import "haha";');
            fs.stub('./src/lol.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveId (importee, importer) {
                        if (importee === 'haha') {
                            return { id: path.resolve(process.cwd(), './src/lol.js') }
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf(`var __ex_default__ = 123; __e__(\\'default\\', function () { return __ex_default__ })`) > -1).to.be.true;
            fs.reset();
        });

        it ('should accept object as a return value with external and id', async () => {
            fs.stub('./src/main.js', () => 'import "haha";');
            fs.stub('./src/lol.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveId (importee, importer) {
                        if (importee === 'haha') {
                            return { id: importee, external: true }
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf(`var __ex_default__ = 123; __e__(\\'default\\', function () { return __ex_default__ })`) > -1).to.be.false;
            fs.reset();
        });

        it ('should allowed resolved module to be marked with syntheticNamedExports', async () => {
            fs.stub('./src/main.js', () => 'import Default, { hello } from "./lol";  export { Default as default, hello };');
            fs.stub('./src/lol.js', () => 'export default { hello: "world" };')
            let phase = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveId (id) {
                        if (id.indexOf('lol') > -1) {
                            return { 
                                id: path.resolve(process.cwd(), './src/lol.js'),
                                syntheticNamedExports: phase === 1
                            }
                        }
                        
                    }
                }]
            });

            let output = (await bundle.generate({ format: 'esm' })).output;
            let result = await Evaluator.init('esm', 'main.js', output);
            expect(result.exports.default.hello).to.equal('world');
            expect(result.exports.hello).to.be.undefined;

            phase = 1;
            bundle.invalidate('./src/lol.js');
            bundle.invalidate('./src/main.js');
            output = (await bundle.generate({ format: 'esm' })).output;
            result = await Evaluator.init('esm', 'main.js', output);
            expect(result.exports.default.hello).to.equal('world');
            expect(result.exports.hello).to.equal('world');

            fs.reset();
        });

        it ('should allow string for syntheticNamedExports', async () => {
            fs.stub('./src/main.js', () => 'export { hello } from "./lol";');
            fs.stub('./src/lol.js', () => 'export var __moduleExports = { hello: "world" };')
            let phase = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveId (id) {
                        if (id.indexOf('lol') > -1) {
                            return { 
                                id: path.resolve(process.cwd(), './src/lol.js'),
                                syntheticNamedExports: phase === 0? false : '__moduleExports'
                            }
                        }
                        
                    }
                }]
            });

            let output = (await bundle.generate({ format: 'esm' })).output;
            let result = await Evaluator.init('esm', 'main.js', output);
            expect(result.exports.hello).to.be.undefined;

            phase = 1;
            bundle.invalidate('./src/lol.js');
            bundle.invalidate('./src/main.js');
            output = (await bundle.generate({ format: 'esm' })).output;
            result = await Evaluator.init('esm', 'main.js', output);
            expect(result.exports.hello).to.equal('world');

            fs.reset();
        });

        it ('should trigger for input file', async () => {
            fs.stub('./src/main.js', () => 'console.log(123)');

            let bundle = await nollup({
                input: 'start',
                plugins: [{
                    resolveId (importee, importer) {
                        if (importee === 'start') {
                            expect(importee).to.equal('start');
                            expect(importer).to.be.undefined;
                            return path.resolve(process.cwd(), './src/main.js');
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf('console.log(123)') > -1).to.be.true;
            fs.reset();
        });

        it ('should trigger for input file array', async () => {
            fs.stub('./src/main1.js', () => 'console.log(123)');
            fs.stub('./src/main2.js', () => 'console.log(456)');

            let bundle = await nollup({
                input: ['start1', 'start2'],
                plugins: [{
                    resolveId (importee, importer) {
                        if (importee === 'start1') {
                            return path.resolve(process.cwd(), './src/main1.js');
                        } 

                        if (importee === 'start2') {
                            return path.resolve(process.cwd(), './src/main2.js');
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf('console.log(123)') > -1).to.be.true;
            expect(output[1].code.indexOf('console.log(456)') > -1).to.be.true;
            fs.reset();
        });

        it ('should trigger for input object', async () => {
            fs.stub('./src/main1.js', () => 'console.log(123)');
            fs.stub('./src/main2.js', () => 'console.log(456)');

            let bundle = await nollup({
                input: {
                    'lol1': 'start1',
                    'lol2': 'start2'
                },
                plugins: [{
                    resolveId (importee, importer) {
                        if (importee === 'start1') {
                            return path.resolve(process.cwd(), './src/main1.js');
                        } 

                        if (importee === 'start2') {
                            return path.resolve(process.cwd(), './src/main2.js');
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf('console.log(123)') > -1).to.be.true;
            expect(output[1].code.indexOf('console.log(456)') > -1).to.be.true;
            fs.reset();
        })

        it ('should allow meta option to be returned', async () => {
            fs.stub('./src/main.js', () => `
                import Value from "./lol";
                console.log(Value);
            `);
            
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveId (source, importer) {
                        if (source.indexOf('lol') > -1) {
                            return {
                                id: path.resolve(process.cwd(), './src/lol.js'),
                                meta: {
                                    prop: 123
                                }
                            }
                        }
                    },
                    load (id) {
                        if (id.indexOf('lol') > -1) {
                            return {
                                code: 'export default 999',
                                meta: {
                                    prop2: 456
                                }
                            }
                        }
                    },
                    buildEnd () {
                        let [ mainId, lolId ] = Array.from(this.getModuleIds());
                        expect(this.getModuleInfo(mainId).meta.prop).to.be.undefined;
                        expect(this.getModuleInfo(lolId).meta.prop).to.equal(123);
                        expect(this.getModuleInfo(lolId).meta.prop2).to.equal(456);
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should allow options as third parameter with isEntry and default custom', async () => {
            fs.stub('./src/main.js', () => 'import "./lol";');
            fs.stub('./src/lol.js', () => 'export default 123');
            let passed1 = false;
            let passed2 = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveId (importee, importer, options) {
                        if (importee.indexOf('main.js') > -1) {
                            expect(options.isEntry).to.be.true;
                            expect(options.custom).to.deep.equal({});
                            passed1 = true;
                        } 

                        if (importee.indexOf('lol') > -1) {
                            expect(options.isEntry).to.be.false;
                            expect(options.custom).to.deep.equal({});
                            passed2 = true;
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed1 && passed2).to.be.true;
            fs.reset();
        });
    });

    describe ('resolveDynamicImport', () => {
        it ('should pass specifier as a string if it is a string', async () => {
            fs.stub('./src/main.js', () => 'import("./lol")');
            fs.stub('./src/lol.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveDynamicImport (specifier, importer) {
                        expect(specifier).to.equal('./lol');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should pass specifier as a string if it is a string in template literal', async () => {
            fs.stub('./src/main.js', () => 'import(`./lol`)');
            fs.stub('./src/lol.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveDynamicImport (specifier, importer) {
                        expect(specifier).to.equal('./lol');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should pass the importer as a string', async () => {
            fs.stub('./src/main.js', () => 'import("./lol")');
            fs.stub('./src/lol.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveDynamicImport (specifier, importer) {
                        expect(importer).to.equal(path.resolve(process.cwd(), './src/main.js'));
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should pass specifier as an ESNode if it is more complex template literal', async () => {
            fs.stub('./src/main.js', () => 'import(tag`./lol.js`)');
            fs.stub('./src/lol.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveDynamicImport (specifier, importer) {
                        expect(specifier.type).to.equal('TaggedTemplateExpression');
                        passed = true;
                        return path.resolve(process.cwd(), './src/lol.js');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should pass specifier as an ESNode if it is more complex template literal II', async () => {
            fs.stub('./src/main.js', () => 'import(`./lol${extension}`)');
            fs.stub('./src/lol.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveDynamicImport (specifier, importer) {
                        expect(specifier.type).to.equal('TemplateLiteral');
                        passed = true;
                        return path.resolve(process.cwd(), './src/lol.js');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should pass specifier as an ESNode if it is more complex', async () => {
            fs.stub('./src/main.js', () => 'import(specialvariable)');
            fs.stub('./src/lol.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveDynamicImport (specifier, importer) {
                        expect(specifier.type).to.equal('Identifier');
                        expect(specifier.name).to.equal('specialvariable');
                        passed = true;
                        return path.resolve(process.cwd(), './src/lol.js');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });
        
        it ('should accept null to defer to resolveDynamicImport', async () => {
            fs.stub('./src/main.js', () => 'import(specialvariable)');
            fs.stub('./src/lol.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveDynamicImport () {
                        return null;
                    }
                }, {
                    resolveDynamicImport (specifier, importer) {
                        passed = true;
                        return path.resolve(process.cwd(), './src/lol.js');
                    }
                }, {
                    resolveDynamicImport () {
                        passed = false;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should accept false to treat module as external', async () => {
            fs.stub('./src/main.js', () => 'import("haha");');
            fs.stub('./src/lol.js', () => 'export default 123;');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveDynamicImport (importee, importer) {
                        if (importee === 'haha') {
                            return false;
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output.length).to.equal(1);
            expect(output[0].code.indexOf('import("haha")') > -1).to.be.true;
            expect(output[0].code.indexOf('module.exports.default = 123') === -1).to.be.true;
            fs.reset();
        });

        it ('should defer to resolveId if no hook return value is found', async () => {
            fs.stub('./src/main.js', () => 'import("haha")');
            fs.stub('./src/lol.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveDynamicImport () {
                        return null;
                    },
                    resolveId () {
                        passed = true;
                        return path.resolve(process.cwd(), './src/lol.js');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        }); 

        it ('should allow promises', async () => {
            fs.stub('./src/main.js', () => 'import("haha")');
            fs.stub('./src/lol.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveDynamicImport () {
                        return new Promise(resolve => {
                            resolve(path.resolve(process.cwd(), './src/lol.js'))
                        });
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            fs.reset();
        });

        it ('should accept object as a return value with external and id', async () => {
            fs.stub('./src/main.js', () => 'import("haha")');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveDynamicImport (importee) {
                        if (importee === 'haha') {
                            return { id: importee, external: true };
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            fs.reset();
        });

        it ('should ignore unresolved ESNode specifier and treat as external', async () => {
            fs.stub('./src/main.js', () => 'import(specialvariable)');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: []
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf('import(specialvariable)') > -1).to.be.true;
            fs.reset();
        });

        it ('should have options if it fallbacks to resolveId', async () => {
            fs.stub('./src/main.js', () => 'import("./lol")');
            fs.stub('./src/lol.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveDynamicImport () {
                        return null;
                    },
                    resolveId (importee, importer, options) {
                        if (importee.indexOf('lol') > -1) {
                            expect(options.isEntry).to.be.false;
                            expect(options.custom).to.deep.equal({});
                            passed = true;
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        })
    });

    describe ('transform', () => {
        it ('should pass code and id of current module', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        expect(code).to.equal('export default 123');
                        expect(id).to.equal(path.resolve(process.cwd(), './src/main.js'));
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should accept a string returned', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        return 'export default 456';
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf('456') > -1).to.be.true;
            fs.reset();
        });

        it ('should accept an object with code returned', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        return {
                            code: 'export default 456'
                        };
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf('456') > -1).to.be.true;
            fs.reset();
        });

        it ('should accept null to defer', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        return null;
                    }
                }, {
                    transform (code, id) {
                        return 'export default 456';
                    }
                }, {
                    transform (code, id) {
                        return 'export default 999';
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf('999') > -1).to.be.true;
            fs.reset();
        });

        it ('should accept promises', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        return new Promise(resolve => {
                            resolve('export default 456');
                        });
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf('456') > -1).to.be.true;
            fs.reset();
        });

        it ('should allow transformed module to be marked with syntheticNamedExports', async () => {
            fs.stub('./src/main.js', () => `
                import Default, { hello } from "./lol";  
                var exports = { default: Default, hello }; 
                export default exports;
            `);
            fs.stub('./src/lol.js', () => 'export default { hello: "world" };')
            let phase = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        if (id.indexOf('lol') > -1) {
                            return { 
                                code,
                                syntheticNamedExports: phase === 1
                            }
                        }
                        
                    }
                }]
            });

            let output = (await bundle.generate({ format: 'esm' })).output;
            let result = await Evaluator.init('esm', 'main.js', output);
            expect(result.exports.default.default.hello).to.equal('world');
            expect(result.exports.default.hello).to.be.undefined;

            phase = 1;
            bundle.invalidate('./src/lol.js');
            output = (await bundle.generate({ format: 'esm' })).output;
            result = await Evaluator.init('esm', 'main.js', output);
            expect(result.exports.default.default.hello).to.equal('world');
            expect(result.exports.default.hello).to.equal('world');

            fs.reset();
        });

        it ('should not lose syntheticNamedExports info if last transform does not mention it', async () => {
            fs.stub('./src/main.js', () => `
                export default { hello: "world" };
            `);

            let passed = true;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        if (id.indexOf('main') > -1) {
                            return { 
                                code,
                                syntheticNamedExports: true
                            };
                        }
                        
                    }
                }, {
                    transform (code, id) {
                        if (id.indexOf('main') > -1) {
                            passed = true;
                            return {
                                code
                            };
                        }
                    }
                }]
            });

            let output = (await bundle.generate({ format: 'cjs' })).output;
            let result = await Evaluator.init('cjs', 'main.js', output);
            expect(passed).to.be.true;
            expect(result.exports.default.hello).to.equal('world');
            expect(result.exports.hello).to.equal('world');

            fs.reset();
        });

        it ('should not lose syntheticNamedExports info if last transform tries to change truthy value', async () => {
            fs.stub('./src/main.js', () => `
                export default { hello: "world" };
            `);

            let passed = true;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        if (id.indexOf('main') > -1) {
                            return { 
                                code,
                                syntheticNamedExports: false
                            };
                        }
                        
                    }
                },{
                    transform (code, id) {
                        if (id.indexOf('main') > -1) {
                            return { 
                                code,
                                syntheticNamedExports: true
                            };
                        }
                        
                    }
                }, {
                    transform (code, id) {
                        if (id.indexOf('main') > -1) {
                            passed = true;
                            return {
                                code,
                                syntheticNamedExports: '__moduleExports'
                            };
                        }
                    }
                }]
            });

            let output = (await bundle.generate({ format: 'cjs' })).output;
            let result = await Evaluator.init('cjs', 'main.js', output);
            expect(passed).to.be.true;
            expect(result.exports.default.hello).to.equal('world');
            expect(result.exports.hello).to.equal('world');

            fs.reset();
        });

        it ('should allow strings for syntheticNamedExports', async () => {
            fs.stub('./src/main.js', () => `
                export { hello } from './lol'
            `);
            fs.stub('./src/lol.js', () => 'export var __moduleExports = { hello: "world" };')
            let phase = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        if (id.indexOf('lol') > -1) {
                            return { 
                                code,
                                syntheticNamedExports: phase === 0? false : '__moduleExports'
                            }
                        }
                        
                    }
                }]
            });

            let output = (await bundle.generate({ format: 'esm' })).output;
            let result = await Evaluator.init('esm', 'main.js', output);
            expect(result.exports.hello).to.be.undefined;

            phase = 1;
            bundle.invalidate('./src/lol.js');
            output = (await bundle.generate({ format: 'esm' })).output;
            result = await Evaluator.init('esm', 'main.js', output);
            expect(result.exports.hello).to.equal('world');

            fs.reset();
        });

        it ('should not fail if passing null sourcemap');

        it ('should accept an object with code and map returned');
        it ('should accept a string with code, map, and ast returned');

        it ('should allow meta option to be returned', async () => {
            fs.stub('./src/lol.js', () => `export default 999`)
            fs.stub('./src/main.js', () => `
                import Value from "./lol";
                console.log(Value);
            `);
            
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        if (id.indexOf('lol') > -1) {
                            return {
                                code,
                                meta: {
                                    prop1: 123
                                }
                            }
                        }
                    }
                }, {
                    transform (code, id) {
                        if (id.indexOf('lol') > -1) {
                            return {
                                code,
                                meta: {
                                    prop2: 456
                                }
                            }
                        }
                    },
                    buildEnd () {
                        let [ mainId, lolId ] = Array.from(this.getModuleIds());
                        expect(this.getModuleInfo(mainId).meta.prop).to.be.undefined;
                        expect(this.getModuleInfo(lolId).meta.prop1).to.equal(123);
                        expect(this.getModuleInfo(lolId).meta.prop2).to.equal(456);
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should not fail if object returned without code', async () => {
            fs.stub('./src/other.css', () => '.Other { color: blue; }');
            fs.stub('./src/other.js', () => 'import "./other.css"; export default 123;');
            fs.stub('./src/main.js', () => 'import value from "./other"; console.log(value);');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        if (id.indexOf('.css') > -1) {
                            return {
                                code: ''
                            };
                        }
                    }
                }, {
                    transform (code, id) {
                        return { code: undefined };
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf('123') > -1).to.be.true;
            expect(output[0].code.indexOf('color: blue') > -1).to.be.false;
            fs.reset();
        });
    });

    describe('options', () => {
        it ('should accept input options', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    options (opts) {
                        expect(opts.input).to.equal('./src/main.js');
                        opts.hello = 'world';
                    }
                }, {
                    options (opts) {
                        expect(opts.hello).to.equal('world');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should allow access to meta property with version', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    options (opts) {
                        expect(this.meta.rollupVersion).to.equal('2.70');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should replace input options with returned object', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    options (opts) {
                        expect(opts.input).to.equal('./src/main.js');
                        return {
                            ...opts,
                            hello: 'world'
                        }
                    }
                }, {
                    options (opts) {
                        expect(opts.hello).to.equal('world');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should modify options for rest of hooks', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/main2.js', () => 'export default 456');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    options (opts) {
                        expect(opts.input).to.equal('./src/main.js');
                        return {
                            ...opts,
                            input: './src/main2.js'
                        }
                    }
                }, {
                    buildStart (opts) {
                        expect(opts.input).to.deep.equal(['./src/main2.js']);
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf('456') > -1).to.be.true;
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should not fail if plugins are removed entirely', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = true;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    options (opts) {
                        return {
                            input: './src/main.js'
                        };
                    }
                }, {
                    buildStart (opts) {
                        passed = false;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should not do anything if null is returned', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    options (opts) {
                        expect(opts.input).to.equal('./src/main.js');
                        return null;
                    }
                }, {
                    options (opts) {
                        expect(opts.input).to.equal('./src/main.js');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });
    });

    describe ('outputOptions', () => {
        it ('should receive output option as an argument', async function () {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    outputOptions (opts) {
                        expect(opts.format).to.equal('esm'); // do not normalize
                        expect(opts.dir).to.equal('dist');
                        opts.dir = 'dist2';
                    }
                }, {
                    outputOptions (opts) {
                        expect(opts.dir).to.equal('dist2');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ 
                format: 'esm',
                dir: 'dist'
            });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should not do anything if null is returned', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    outputOptions (opts) {
                        return null;
                    }
                }, {
                    outputOptions (opts) {
                        expect(opts.dir).to.equal('dist');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ 
                format: 'esm',
                dir: 'dist'
            });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should allow returning new output options', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    outputOptions (opts) {
                        return {
                            ...opts,
                            hello: 'world'
                        };
                    }
                }, {
                    outputOptions (opts) {
                        expect(opts.hello).to.equal('world');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ 
                format: 'esm'
            });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should modify outputOptions for rest of hooks', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    outputOptions (opts) {
                        return {
                            ...opts,
                            hello: 'world'
                        };
                    }
                }, {
                    generateBundle (opts) {
                        expect(opts.hello).to.equal('world');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });
    });

    describe('buildStart', () => {
        it ('should receive input options', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    buildStart (opts) {
                        expect(this.resolve).not.to.be.undefined;
                        expect(opts.input).to.deep.equal(['./src/main.js']);
                    }
                }, {
                    buildStart (opts) {
                        passed = true;
                    }
                }]
            });

            await bundle.generate();

            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should run after all options hooks have ran', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/main2.js', () => 'export default 456');
            fs.stub('./src/main3.js', () => 'export default 789');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    options (opts) {
                        opts.input = './src/main2.js';
                    }, 

                    buildStart (opts) {
                        expect(opts.input).to.deep.equal(['./src/main3.js']);
                        passed = true;
                    }
                }, {
                    options (opts) {
                        opts.input = './src/main3.js';
                    }
                }]
            });

            await bundle.generate();

            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should be able to return a promise', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    async buildStart (opts) {
                        expect(this.resolve).not.to.be.undefined;
                        expect(opts.input).to.deep.equal(['./src/main.js']);
                    }
                }, {
                    async buildStart (opts) {
                        passed = true;
                    }
                }]
            });

            await bundle.generate();

            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should re-run on rebuild', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;
            let count = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    async buildStart (opts) {
                        count++;
                    }
                }]
            });

            await bundle.generate({ format: 'esm' });
            await bundle.generate({ format: 'esm' });
            expect(count).to.equal(2);
            fs.reset();
        });

        it ('should trigger before renderStart', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;
            let count = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    buildStart (opts) {
                        count++;
                    },

                    renderStart () {
                        expect(count).to.equal(1);
                        count++;
                    }
                }]
            });

            await bundle.generate({ format: 'esm' });
            expect(count).to.equal(2);
            fs.reset();
        });
    });

    describe('buildEnd', () => {
        it ('should run before generate is called', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    buildEnd (opts) {
                        expect(this.resolve).not.to.be.undefined;
                        expect(opts).to.be.undefined;
                    }
                }, {
                    buildEnd () {
                        passed = true;
                    }
                }]
            });

            await bundle.generate();

            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should be able to return a promise', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    async buildEnd (opts) {
                        expect(this.resolve).not.to.be.undefined;
                        expect(opts).to.be.undefined;
                    }
                }, {
                    async buildEnd () {
                        passed = true;
                    }
                }]
            });

            await bundle.generate();

            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should trigger before renderStart', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let count = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    buildEnd () {
                        count++;
                    },

                    renderStart () {
                        expect(count).to.equal(1);
                        count++;
                    }
                }]
            });

            await bundle.generate({ format: 'esm' });
            expect(count).to.equal(2);
            fs.reset();
        });

        it ('should receive err object if build fails', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            try {
                let bundle = await nollup({
                    input: './src/main.js',
                    plugins: [{
                        transform () {
                            throw new Error('lol');
                        },

                        buildEnd (e) {
                            expect(e.message.indexOf('lol') > -1).to.be.true;
                            passed = true;
                        }
                    }]
                });

                await bundle.generate({ format: 'esm' });
            } catch (e) {
                expect(e.message.indexOf('lol') > -1).to.be.true;
            }
            
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should not trigger renderError if error occurs', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;
            let failed = false;

            try {
                let bundle = await nollup({
                    input: './src/main.js',
                    plugins: [{
                        transform () {
                            throw new Error('lol');
                        },

                        buildEnd (e) {
                            expect(e.message.indexOf('lol') > -1).to.be.true;
                            passed = true;
                        },

                        renderError () {
                            failed = true;
                        }
                    }]
                });

                await bundle.generate({ format: 'esm' });
            } catch (e) {
                expect(e.message.indexOf('lol') > -1).to.be.true;
            }
            
            expect(passed).to.be.true;
            expect(failed).to.be.false;
            fs.reset();
        });

        it ('should trigger if error in buildStart', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            try {
                let bundle = await nollup({
                    input: './src/main.js',
                    plugins: [{
                        buildStart () {
                            throw new Error('lol');
                        },

                        buildEnd (e) {
                            expect(e.message.indexOf('lol') > -1).to.be.true;
                            passed = true;
                        }
                    }]
                });

                await bundle.generate({ format: 'esm' });
            } catch (e) {
                expect(e.message.indexOf('lol') > -1).to.be.true;
            }
            
            expect(passed).to.be.true;
            fs.reset();
        });
    });

    describe ('renderStart', () => {
        it ('should receive output and input options', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    renderStart (output, input) {
                        expect(output.dir).to.equal('dist');
                        expect(input.input).to.deep.equal(['./src/main.js']);
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', dir: 'dist' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should be called each time generate is called', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let count = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    renderStart (output, input) {
                        count++;
                    }
                }]
            });

            await bundle.generate({ format: 'esm', dir: 'dist' });
            await bundle.generate({ format: 'esm', dir: 'dist' });
            expect(count).to.equal(2);
            fs.reset();
        });

        it ('should call multiple plugins', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    renderStart (output, input) {
                    }
                }, {
                    renderStart () {
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should be called after outputOptions', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    outputOptions (opts) {
                        opts.hello = 'world';
                    },
                    renderStart (output, input) {
                        expect(output.hello).to.equal('world');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should be allowed to wait on a promise', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    async renderStart (output, input) {
                    }
                }, {
                    async renderStart () {
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });
    });

    describe ('renderError', () => {
        it ('should receive an error when a chunk has failed to render', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            try {
                let bundle = await nollup({
                    input: './src/main.js',
                    plugins: [{
                        renderStart () {
                            throw new Error('lol');
                        },
                        renderError (err) {
                            expect(err.message.indexOf('lol') > -1).to.be.true; 
                            passed = true;
                        }
                    }]
                });

                let { output } = await bundle.generate({ format: 'esm', dir: 'dist' });
                throw new Error('should not hit here');
            } catch (e) {
                expect(passed).to.be.true;
                fs.reset();
            }
        });

        it ('should be allowed to wait on a promise', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            try {
                let bundle = await nollup({
                    input: './src/main.js',
                    plugins: [{
                        renderStart () {
                            throw new Error('lol');
                        },
                        async renderError (err) {
                            expect(err.message.indexOf('lol') > -1).to.be.true; 
                            passed = true;
                        }
                    }]
                });

                let { output } = await bundle.generate({ format: 'esm', dir: 'dist' });
                throw new Error('should not hit here');
            } catch (e) {
                expect(passed).to.be.true;
                fs.reset();
            }
        });

        it ('should call multiple plugins', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            try {
                let bundle = await nollup({
                    input: './src/main.js',
                    plugins: [{
                        renderStart () {
                            throw new Error('lol');
                        },
                        renderError (err) {
                            expect(err.message.indexOf('lol') > -1).to.be.true; 
                        }
                    }, {
                        renderError () {
                            passed = true;
                        }
                    }]
                });

                let { output } = await bundle.generate({ format: 'esm', dir: 'dist' });
                throw new Error('should not hit here');
            } catch (e) {
                expect(passed).to.be.true;
                fs.reset();
            }
        })

        it ('should not trigger if error thrown in build hook', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let failed = false;

            try {
                let bundle = await nollup({
                    input: './src/main.js',
                    plugins: [{
                        transform () {
                            throw new Error('lol');
                        },
                        renderError (err) {
                            failed = true;
                        }
                    }]
                });

                let { output } = await bundle.generate({ format: 'esm', dir: 'dist' });
                throw new Error('should not hit here');
            } catch (e) {
                expect(e.message.indexOf('lol') > -1).to.be.true; 
                expect(failed).to.be.false;
                fs.reset();
            }
        })
    });

    describe ('renderChunk', () => {
        it ('should receive code, chunkinfo, and output options', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    renderChunk (code, chunk, options) {
                        expect(code.indexOf('123') > -1).to.be.true;
                        expect(chunk.fileName).to.equal('main.js');
                        expect(options.dir).to.equal('dist');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', dir: 'dist' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should not be called for assets', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        this.emitAsset('lol', 'lol');
                    },
                    renderChunk (code, chunk, options) {
                        expect(code.indexOf('123') > -1).to.be.true;
                        expect(chunk.fileName).to.equal('main.js');
                        expect(options.dir).to.equal('dist');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', dir: 'dist' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should be called before generateBundle', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    renderChunk (code, chunk, options) {
                        expect(code.indexOf('123') > -1).to.be.true;
                        expect(chunk.fileName).to.equal('main.js');
                        expect(options.dir).to.equal('dist');
                        passed = true;
                    },
                    generateBundle () {
                        expect(passed).to.be.true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', dir: 'dist' });
            fs.reset();
        });

        it ('should run for every chunk', async () => {
            fs.stub('./src/main.js', () => 'import("./lol")');
            fs.stub('./src/lol.js', () => 'export default 123');
            let count = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    renderChunk (code, chunk, options) {
                        count++;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', dir: 'dist' });
            expect(count).to.equal(2);
            fs.reset();
        });

        it ('should return a string with transformed code', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    renderChunk (code, chunk, options) {
                        return code.replace('123', '456');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', dir: 'dist' });
            expect(output[0].code.indexOf('456') > -1).to.be.true;
            fs.reset();
        });

        it ('should return an object with code and map of transformed code', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    renderChunk (code, chunk, options) {
                        let s = new MagicString(code);
                        let i = code.indexOf('123');
                        s.overwrite(i, i +3, '456');
                        return {
                            code: s.toString(),
                            map: s.generateMap({ source: 'lol' })
                        };
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', dir: 'dist' });
            expect(output[0].code.indexOf('456') > -1).to.be.true;
            // TODO: Rollup says map is null
            fs.reset();
        });

        it ('should return null for no operation', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    renderChunk (code, chunk, options) {
                        return null
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', dir: 'dist' });
            expect(output[0].code.indexOf('123') > -1).to.be.true;
            fs.reset();
        });

        it ('should allow chain of transformations', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    renderChunk (code, chunk, options) {
                        return code.replace('123', '456');
                    }                    
                }, {
                    renderChunk (code) {
                        return code.replace('456', '45678');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', dir: 'dist' });
            expect(output[0].code.indexOf('45678') > -1).to.be.true;
            fs.reset();
        });

        it ('should be allowed to return a promise', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    async renderChunk (code, chunk, options) {
                        return code.replace('123', '456');
                    }                    
                }, {
                    async renderChunk (code) {
                        return code.replace('456', '45678');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', dir: 'dist' });
            expect(output[0].code.indexOf('45678') > -1).to.be.true;
            fs.reset();
        });
    });

    describe('resolveFileUrl', () => {
        it ('should receive fileName, chunkId, format, moduleId, assetReferenceId, chunkReferenceId, relativePath for ROLLUP_ASSET_URL', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;
            let ref;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        ref = this.emitAsset('style.css', 'body {}');

                        return {
                            code: `
                                console.log(import.meta.ROLLUP_ASSET_URL_${ref});
                                export default 123;
                            `
                        }
                    },
                    resolveFileUrl (details) {
                        expect(details.assetReferenceId).to.equal(ref);
                        expect(details.chunkId).to.equal('main.js');
                        expect(details.chunkReferenceId).to.be.null;
                        expect(details.fileName).to.equal('style.lol.css');
                        expect(details.format.startsWith('es')).to.be.true;
                        expect(details.moduleId).to.equal(path.resolve(process.cwd(), './src/main.js'));
                        expect(details.referenceId).to.equal(ref);
                        expect(details.relativePath).to.equal('style.lol.css');
                        passed = true;
                    }                    
                }]
            });

            let { output } = await bundle.generate({ 
                format: 'esm',
                assetFileNames: '[name].lol.[ext]'
            });
            let main = output.find(o => o.fileName === 'main.js');
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should receive fileName, chunkId, format, moduleId, assetReferenceId, chunkReferenceId, relativePath for ROLLUP_FILE_URL', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;
            let ref;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        ref = this.emitFile({
                            type: 'asset',
                            name: 'style.css'
                        });

                        return {
                            code: `
                                console.log(import.meta.ROLLUP_FILE_URL_${ref});
                                export default 123;
                            `
                        }
                    },
                    resolveFileUrl (details) {
                        expect(details.assetReferenceId).to.be.null;
                        expect(details.chunkId).to.equal('main.js');
                        expect(details.chunkReferenceId).to.be.null;
                        expect(details.fileName).to.equal('style.lol.css');
                        expect(details.format.startsWith('es')).to.be.true;
                        expect(details.moduleId).to.equal(path.resolve(process.cwd(), './src/main.js'));
                        expect(details.referenceId).to.equal(ref);
                        expect(details.relativePath).to.equal('style.lol.css');
                        passed = true;
                    }                    
                }]
            });

            let { output } = await bundle.generate({ 
                format: 'esm',
                assetFileNames: '[name].lol.[ext]'
            });
            let main = output.find(o => o.fileName === 'main.js');
            expect(passed).to.be.true;
            fs.reset();
        });
        
        it ('should replace import.meta.ROLLUP_FILE_URL_ref with returned code', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let ref;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        ref = this.emitFile({
                            type: 'asset',
                            name: 'style.css',
                            source: 'body {}'
                        });

                        return {
                            code: `
                                console.log(import.meta.ROLLUP_FILE_URL_${ref});
                                export default 123;
                            `
                        }
                    },
                    resolveFileUrl (details) {
                        passed = true;
                        return `(function () { return "${details.fileName}"})()`;
                    }                    
                }]
            });

            let { output } = await bundle.generate({ 
                format: 'esm',
                assetFileNames: '[name].lol.[ext]'
            });
            let main = output.find(o => o.fileName === 'main.js');
            expect(main.code.indexOf('(function () { return "style.lol.css"})()') > -1).to.be.true;
            fs.reset();
        });

        it ('should not call following hooks once a string is returned', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let ref;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        ref = this.emitFile({
                            type: 'asset',
                            name: 'style.css',
                            source: 'body {}'
                        });

                        return {
                            code: `
                                console.log(import.meta.ROLLUP_FILE_URL_${ref});
                                export default 123;
                            `
                        }
                    },
                    resolveFileUrl (details) {
                        return null;
                    }                    
                }, {
                    resolveFileUrl (details) {
                        passed = true;
                        return `(function () { return "${details.fileName}"})()`;

                    }
                }, {
                    resolveFileUrl (details) {
                        throw new Error('should not reach here');
                    }
                }]
            });

            let { output } = await bundle.generate({ 
                format: 'esm',
                assetFileNames: '[name].lol.[ext]'
            });
            let main = output.find(o => o.fileName === 'main.js');
            expect(main.code.indexOf('(function () { return "style.lol.css"})()') > -1).to.be.true;
            fs.reset();
        });

        it ('should change chunkId if inside a dynamic import chunk', async () => {
            fs.stub('./src/main.js', () => 'import("./dynamic")');
            fs.stub('./src/dynamic.js', () => 'export default 123');
            let passed = false;
            let ref;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        if (id.indexOf('dynamic.js') > -1) {
                            ref = this.emitFile({
                                type: 'asset',
                                name: 'style.css',
                                source: 'body {}'
                            });

                            return {
                                code: `
                                    console.log(import.meta.ROLLUP_FILE_URL_${ref});
                                    export default 123;
                                `
                            }
                        }
                    },
                    resolveFileUrl (details) {
                        expect(details.chunkId).to.equal('dynamic.lol.js');
                        passed = true;
                    }                    
                }]
            });

            let { output } = await bundle.generate({ 
                format: 'esm',
                assetFileNames: '[name].lol.[ext]',
                chunkFileNames: 'dynamic.lol.js'
            });

            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should receive fileName, chunkId, format, moduleId, assetReferenceId, chunkReferenceId, relativePath for ROLLUP_CHUNK_URL', async () => {
            fs.stub('./src/other.js', () => 'export default 456');
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;
            let ref;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        if (id.indexOf('main') > -1) {
                            ref = this.emitFile({
                                type: 'chunk',
                                name: 'mychunk',
                                id: './src/other.js'
                            });

                            return {
                                code: `
                                    console.log(import.meta.ROLLUP_CHUNK_URL_${ref});
                                    export default 123;
                                `
                            }
                        }
                    },
                    resolveFileUrl (details) {
                        expect(details.assetReferenceId).to.be.null;
                        expect(details.chunkId).to.equal('main.js');
                        expect(details.chunkReferenceId).equal(ref);
                        expect(details.fileName).to.equal('lol-mychunk.js');
                        expect(details.format.startsWith('es')).to.be.true;
                        expect(details.moduleId).to.equal(path.resolve(process.cwd(), './src/main.js'));
                        expect(details.referenceId).to.equal(ref);
                        expect(details.relativePath).to.equal('lol-mychunk.js');
                        passed = true;
                    }                    
                }]
            });

            let { output } = await bundle.generate({ 
                format: 'esm',
                chunkFileNames: 'lol-[name].js'
            });
            let main = output.find(o => o.fileName === 'main.js');
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should receive fileName, chunkId, format, moduleId, assetReferenceId, chunkReferenceId, relativePath for ROLLUP_FILE_URL for chunks', async () => {
            fs.stub('./src/other.js', () => 'export default 456');
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;
            let ref;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        if (id.indexOf('main') > -1) {
                            ref = this.emitFile({
                                type: 'chunk',
                                name: 'mychunk',
                                id: './src/other.js'
                            });

                            return {
                                code: `
                                    console.log(import.meta.ROLLUP_FILE_URL_${ref});
                                    export default 123;
                                `
                            }
                        }
                    },
                    resolveFileUrl (details) {
                        expect(details.assetReferenceId).to.be.null;
                        expect(details.chunkId).to.equal('main.js');
                        expect(details.chunkReferenceId).to.be.null;
                        expect(details.fileName).to.equal('lol-mychunk.js');
                        expect(details.format.startsWith('es')).to.be.true;
                        expect(details.moduleId).to.equal(path.resolve(process.cwd(), './src/main.js'));
                        expect(details.referenceId).to.equal(ref);
                        expect(details.relativePath).to.equal('lol-mychunk.js');
                        passed = true;
                    }                    
                }]
            });

            let { output } = await bundle.generate({ 
                format: 'esm',
                chunkFileNames: 'lol-[name].js'
            });
            let main = output.find(o => o.fileName === 'main.js');
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should change chunkId if inside an emitted chunk', async () => {
            fs.stub('./src/sub.js', () => 'export default 789');
            fs.stub('./src/other.js', () => 'export default 456');
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;
            let ref;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        if (id.indexOf('main') > -1) {
                            ref = this.emitFile({
                                type: 'chunk',
                                name: 'otherchunk',
                                id: './src/other.js'
                            });

                            return {
                                code: `
                                    console.log(import.meta.ROLLUP_FILE_URL_${ref});
                                    export default 123;
                                `
                            }
                        }

                        if (id.indexOf('other') > -1) {
                            ref = this.emitFile({
                                type: 'chunk',
                                name: 'subchunk',
                                id: './src/sub.js'
                            });

                            return {
                                code: `
                                    console.log(import.meta.ROLLUP_FILE_URL_${ref});
                                    export default 456;
                                `
                            }
                        }
                    },
                    resolveFileUrl (details) {
                        if (details.fileName === 'lol-subchunk.js') {
                            expect(details.assetReferenceId).to.be.null;
                            expect(details.chunkId).to.equal('lol-otherchunk.js');
                            expect(details.chunkReferenceId).to.be.null;
                            expect(details.fileName).to.equal('lol-subchunk.js');
                            expect(details.format.startsWith('es')).to.be.true;
                            expect(details.moduleId).to.equal(path.resolve(process.cwd(), './src/other.js'));
                            expect(details.referenceId).to.equal(ref);
                            expect(details.relativePath).to.equal('lol-subchunk.js');
                            passed = true;
                        }
                        
                    }                    
                }]
            });

            let { output } = await bundle.generate({ 
                format: 'esm',
                chunkFileNames: 'lol-[name].js'
            });
            let main = output.find(o => o.fileName === 'main.js');
            expect(passed).to.be.true;
            fs.reset();
        });
    });

    describe('resolveImportMeta', () => {
        it ('should pass the import meta property being resolved, and chunkId/moduleId/format', async () => {
            fs.stub('./src/main.js', () => 'console.log(import.meta.url)');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveImportMeta (prop, details) {
                        expect(prop).to.equal('url');
                        expect(details.chunkId).to.equal('main.js');
                        expect(details.format.startsWith('es')).to.be.true;
                        expect(details.moduleId).to.equal(path.resolve(process.cwd(), './src/main.js'));
                        passed = true;
                    }                    
                }]
            });

            let { output } = await bundle.generate({ 
                format: 'esm'
            });

            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should replace import.meta.<property> with the returned string', async () => {
            fs.stub('./src/main.js', () => 'console.log(import.meta.url)');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveImportMeta (prop, details) {
                        return '123';
                    }                    
                }]
            });

            let { output } = await bundle.generate({ 
                format: 'esm'
            });

            expect(output[0].code.indexOf('console.log(123)') > -1).to.be.true;
            fs.reset();
        });

        it ('should not call following hooks once a string is returned', async () => {
            fs.stub('./src/main.js', () => 'console.log(import.meta.url)');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveImportMeta () {
                        return null;
                    }
                },{
                    resolveImportMeta (prop, details) {
                        passed = true;
                        return '123';
                    }                    
                }, {
                    resolveImportMeta () {
                        throw new Error('should not reach here');
                    }
                }]
            });

            let { output } = await bundle.generate({ 
                format: 'esm'
            });

            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should pass null if accessing import.meta directly with no property', async () => {
            fs.stub('./src/main.js', () => 'console.log(import.meta)');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveImportMeta (prop, details) {
                        expect(prop).to.be.null;
                        passed = true;
                        return '123';
                    }                    
                }]
            });

            let { output } = await bundle.generate({ 
                format: 'esm'
            });

            expect(output[0].code.indexOf('console.log(123)') > -1).to.be.true;
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should be called after resolveFileUrl', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        let ref = this.emitFile({
                            type: 'asset',
                            name: 'style.css',
                            source: 'body {}'
                        });

                        return {
                            code: `
                                console.log(import.meta.ROLLUP_FILE_URL_${ref});
                                export default 123;
                            `
                        }
                    },
                    resolveFileUrl (details) {
                        passed = true;
                        return `"${details.fileName}"`;
                    },

                    resolveImportMeta () {
                        throw new Error('failed');
                    }                    
                }]
            });

            let { output } = await bundle.generate({ 
                format: 'esm'
            });

            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should deconflict chunkId if there\'s a conflict in naming', async () => {
            fs.stub('./src/b/main.js', () => 'console.log(import.meta.prop2);');
            fs.stub('./src/a/main.js', () => 'import("../b/main"); console.log(import.meta.prop1)');
            let passed1, passed2;

            let bundle = await nollup({
                input: './src/a/main.js',
                plugins: [{
                    resolveImportMeta (prop, details) {
                        if (prop === 'prop1') {
                            expect(details.moduleId).to.equal(path.resolve(process.cwd(), './src/a/main.js'));
                            expect(details.chunkId).to.equal('lol-main.js');
                            passed1 = true;
                        }

                        if (prop === 'prop2') {
                            expect(details.moduleId).to.equal(path.resolve(process.cwd(), './src/b/main.js'));
                            expect(details.chunkId).to.equal('lol-main2.js');
                            passed2 = true;
                        }
                    }                    
                }]
            });

            let { output } = await bundle.generate({ 
                format: 'esm',
                entryFileNames: 'lol-[name].js',
                chunkFileNames: 'lol-[name].js'
            });

            expect(passed1).to.be.true;
            expect(passed2).to.be.true;
            fs.reset();
        });
    });

    describe('augmentChunkHash', () => {
        it ('should receive a chunkInfo object');
        it ('should override hash of chunk with returned value');
        it ('should not change anything if falsy is returned');
    });

    describe ('watchChange', () => {
        it ('should not trigger initially', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let watchChangeCnt = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    watchChange (id) {
                        watchChangeCnt++;
                    }
                }]
            });
            
            await bundle.generate();
            expect(watchChangeCnt).to.be.equal(0);
            fs.reset();
        });

        it ('should trigger on invalidate', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let watchChangeCnt = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    watchChange (id) {
                        let target = path.resolve(process.cwd(), './src/main.js');
                        expect(id).to.equal(target);
                        watchChangeCnt++;
                    }
                }]
            });

            await bundle.generate();
            bundle.invalidate('./src/main.js');

            await bundle.generate();
            expect(watchChangeCnt).to.be.equal(1);
            fs.reset();
        });

        it ('should trigger on added watch files invalidated', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/other.js', () => 'export default 456');

            let watchChangeCnt = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        this.addWatchFile('./src/other.js');
                    },

                    watchChange (id) {
                        let target = path.resolve(process.cwd(), './src/other.js');
                        expect(id).to.equal(target);
                        watchChangeCnt++;
                    }
                }]
            });

            await bundle.generate({ format: 'esm' });
            bundle.invalidate('src/other.js');

            await bundle.generate({ format: 'esm' });
            expect(watchChangeCnt).to.be.equal(1);
            fs.reset();
        });
    });

    describe ('moduleParsed', () => {
        function normalizeDelimiter (id) {
            return id.replace(/\\/g, '/');
        }

        it ('should receive module info', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    moduleParsed (moduleInfo) {
                        expect(normalizeDelimiter(moduleInfo.id).indexOf('src/main') > -1).to.be.true;
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should execute multiple in parallel', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed1 = false;
            let passed2 = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    moduleParsed (moduleInfo) {
                        expect(normalizeDelimiter(moduleInfo.id).indexOf('src/main') > -1).to.be.true;
                        passed1 = true;
                    }    
                }, {
                    moduleParsed (moduleInfo) {
                        expect(normalizeDelimiter(moduleInfo.id).indexOf('src/main') > -1).to.be.true;
                        passed2 = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed1).to.be.true;
            expect(passed2).to.be.true;
            fs.reset();
        });

        it ('should not execute again if module has not changed', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let mcount = 0;
            let tcount = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        tcount++;
                    },
                    moduleParsed (moduleInfo) {
                        expect(normalizeDelimiter(moduleInfo.id).indexOf('src/main') > -1).to.be.true;
                        mcount++;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(tcount).to.equal(1);
            expect(mcount).to.equal(1);

            await bundle.generate({ format: 'esm' });

            expect(tcount).to.equal(1);
            expect(mcount).to.equal(1);

            fs.reset();
        });
    });
});