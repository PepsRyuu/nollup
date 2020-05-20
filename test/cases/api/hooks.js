let { nollup, fs, expect, rollup } = require('../../nollup');
let path = require('path');
let MagicString = require('magic-string');

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
            fs.stub('./src/main.js', () => 'import Default, { hello } from "./lol";  export { Default as default, hello };');
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

            let output = (await bundle.generate({ format: 'iife' })).output;
            let result = eval(output[0].code);
            expect(result.default.hello()).to.equal('world');
            expect(result.hello).to.be.undefined;

            phase = 1;
            bundle.invalidate('./src/lol.js');
            output = (await bundle.generate({ format: 'iife' })).output;
            result = eval(output[0].code);
            expect(result.default.hello()).to.equal('world');
            expect(result.hello()).to.equal('world');

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

            let output = (await bundle.generate({ format: 'iife' })).output;
            let result = eval(output[0].code);
            expect(result.default).to.equal(123);

            phase = 1;
            bundle.invalidate('./src/lol.js');
            output = (await bundle.generate({ format: 'iife' })).output;
            result = eval(output[0].code);
            expect(result.default).to.equal(123);

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
            expect(output[0].code.indexOf(`__e__(\\'default\\', 999)`) > -1).to.be.true;
            fs.reset();
        });

        it ('should return null implying to defer to another loader', async () => {
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
            expect(output[0].code.indexOf(`__e__(\\'default\\', 999)`) > -1).to.be.true;
            fs.reset();
        });


        it ('should be allowed to return a promise following any return', async () => {
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
            expect(output[0].code.indexOf(`__e__(\\'default\\', 999)`) > -1).to.be.true;
            fs.reset();
        });

        it ('should be allowed to return an object with code and map', async () => {
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
            expect(output[0].code.indexOf(`__e__(\\'default\\', 999)`) > -1).to.be.true;
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

            let output = (await bundle.generate({ format: 'iife' })).output;
            let result = eval(output[0].code);
            expect(result.default.hello).to.equal('world');
            expect(result.hello).to.be.undefined;

            phase = 1;
            bundle.invalidate('./src/lol.js');
            output = (await bundle.generate({ format: 'iife' })).output;
            result = eval(output[0].code);
            expect(result.default.hello).to.equal('world');
            expect(result.hello).to.equal('world');

            fs.reset();
        });

        it ('should be allowed to return an AST');
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
            fs.stub('./src/lol.js', () => '');

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
            fs.reset();
        });

        it ('should accept null to defer to next hook', async () => {
            fs.stub('./src/main.js', () => 'import "haha";');
            fs.stub('./src/lol.js', () => '');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveId () {
                        return null;
                    }
                }, {
                    resolveId (importee, importer) {
                        if (importee === 'haha') {
                            return path.resolve(process.cwd(), './src/lol.js');
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
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
            expect(output[0].code.indexOf('module.exports.default = 123') === -1).to.be.true;
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
            expect(output[0].code.indexOf(`__e__(\\'default\\', 123)`) > -1).to.be.true;
            fs.reset();
        });

        it ('should accept objects with id', async () => {
            fs.stub('./src/main.js', () => 'import "haha";');
            fs.stub('./src/lol.js', () => '');

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
            fs.reset();
        });

        it ('should accept object as a return value with external and id', async () => {
            fs.stub('./src/main.js', () => 'import "haha";');
            fs.stub('./src/lol.js', () => '');

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

            let output = (await bundle.generate({ format: 'iife' })).output;
            let result = eval(output[0].code);
            expect(result.default.hello).to.equal('world');
            expect(result.hello).to.be.undefined;

            phase = 1;
            bundle.invalidate('./src/lol.js');
            bundle.invalidate('./src/main.js');
            output = (await bundle.generate({ format: 'iife' })).output;
            result = eval(output[0].code);
            expect(result.default.hello).to.equal('world');
            expect(result.hello).to.equal('world');

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

            let output = (await bundle.generate({ format: 'iife' })).output;
            let result = eval(output[0].code);
            expect(result.default.default.hello).to.equal('world');
            expect(result.default.hello).to.be.undefined;

            phase = 1;
            bundle.invalidate('./src/lol.js');
            output = (await bundle.generate({ format: 'iife' })).output;
            result = eval(output[0].code);
            expect(result.default.default.hello).to.equal('world');
            expect(result.default.hello).to.equal('world');

            fs.reset();
        });

        it ('should accept an object with code and map returned');
        it ('should accept a string with code, map, and ast returned');
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
                        expect(this.meta.rollupVersion).to.equal('2.0');
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
                        expect(opts.dir).to.equal('dist');
                        opts.hello = 'world';
                    }
                }, {
                    outputOptions (opts) {
                        expect(opts.hello).to.equal('world');
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
                        expect(opts.input).to.equal('./src/main.js');
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
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    options (opts) {
                        opts.hello = 'world';
                    }, 

                    buildStart (opts) {
                        expect(opts.hello).to.equal('world');
                        expect(opts.foo).to.equal('bar');
                        passed = true;
                    }
                }, {
                    options (opts) {
                        opts.foo = 'bar';
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
                        expect(opts.input).to.equal('./src/main.js');
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
                        expect(input.input).to.equal('./src/main.js');
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

        it ('should receive fileName, chunkId, format, moduleId, assetReferenceId, chunkReferenceId, relativePath for ROLLUP_CHUNK_URL');
        it ('should change chunkId if inside an emitted chunk');
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
                    }                    
                }]
            });

            let { output } = await bundle.generate({ 
                format: 'esm'
            });

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
    });

    describe('augmentChunkHash', () => {
        it ('should receive a chunkInfo object');
        it ('should override hash of chunk with returned value');
        it ('should not change anything if falsy is returned');
    });

    describe ('watchChange', () => {
        it ('should receive id of changed module');
    });
});