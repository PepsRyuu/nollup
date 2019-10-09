let { nollup, fs, expect, rollup } = require('../../nollup');
let path = require('path');

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

        it ('should be allowed to return an object with code and map');

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
            expect(output[0].code.indexOf('import "haha"') > -1).to.be.true;
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

        it ('should accept an object with code and map returned');
        it ('should accept a string with code, map, and ast returned');

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

    describe ('renderChunk', () => {
        it ('should receive code, chunkinfo, and output options');
        it ('should return a string with transformed code');
        it ('should return an object with code and map of transformed code');
        it ('should return null for no operation');
        it ('should be allowed to return a promise');
    });

    describe ('renderError', () => {
        it ('should receive an error when a chunk has failed to render');
        it ('should be allowed to wait on a promise');
    });

    describe ('renderStart', () => {
        it ('should be called each time generate is called');
        it ('should be allowed to wait on a promise');
    });

    describe ('watchChange', () => {
        it ('should receive id of changed module');
    })
});