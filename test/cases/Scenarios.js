let { expect, fs, nollup, rollup } = require('../nollup');
let Evaluator = require('../utils/evaluator');
let path = require('path');

describe('Scenarios', function () {

    function getPackageMain (name) {
        return path.resolve(__dirname,`../packages/${name}/index.js`);
    }

    function stubPackageFile(file, callback) {
        fs.stub(getPackageFile(file), callback);
    }

    function getPackageFile (file) {
        return path.resolve(__dirname, `../packages/${file}.js`);
    }

    afterEach (function () {
        fs.reset();
    })

    it ('should compile simple hello world app', async function () {
        let bundle = await nollup({ input: getPackageMain('hello-world') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        expect(exports.default).to.equal('hello world');   
    });
    
    it ('should compile module with multiple imports', async function () {
        let bundle = await nollup({ input: getPackageMain('multi-module') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        expect(exports.default.message).to.equal('hello world');
        expect(exports.default.sum).to.equal(6);       
    });

    it ('should throw error if failed to find file', async function () {
        stubPackageFile('multi-module/message/hello', () => {
            throw new Error ('File not found');
        });

        let bundle = await nollup({ input: getPackageMain('multi-module') });

        try {
            await bundle.generate({ format: 'esm' });
            throw new Error('Should not reach here');
        } catch (e) {
            expect(e.message.indexOf('File not found') > -1).to.be.true;
        }
    });

    it ('should recompile successfully is file was missing and is found again', async function () {
        stubPackageFile('multi-module/message/hello', () => {
            throw new Error('File not found');
        });

        let failed = false;
        let bundle = await nollup({ input: getPackageMain('multi-module') });

        try {
            await bundle.generate({ format: 'esm' });
            failed = true;
        } catch (e) {
            if (failed) {
                throw new Error('Bundle generated when it shouldnt have');
            }

            fs.reset();
            await bundle.invalidate(getPackageFile('multi-module/message/hello'));
            let { output } = await bundle.generate({ format: 'esm' });
            let { exports } = await Evaluator.init('esm', 'index.js', output);
            expect(exports.default.message).to.equal('hello world');
        }
    });

    it ('Scenario: Module mistyped module that exists, and fixed itself afterwards', async function () {
        stubPackageFile('multi-module/message/index', () => {
            return `
                import hello from './hello';
                import world from './world_typo';
                export default hello + ' ' + world;
            `;
        });

        let failed = false;
        let bundle = await nollup({ input: getPackageMain('multi-module') });

        try {
            await bundle.generate({ format: 'esm' });
            failed = true;
        } catch (e) {
            if (failed) {
                throw new Error('Bundle shouldnt have generated');
            }

            fs.reset();
            await bundle.invalidate(getPackageFile('multi-module/message/index'));
            let { output } = await bundle.generate({ format: 'esm' });
            let { exports } = await Evaluator.init('esm', 'index.js', output);
            expect(exports.default.message).to.equal('hello world');
        }
    });

    it ('Scenario: Module adds a new module', async function () {
        stubPackageFile('multi-module/message/index', () => {
            return `
                import hello from './hello';
                export default hello;
            `;
        });

        let bundle = await nollup({ input: getPackageMain('multi-module') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        expect(exports.default.message).to.equal('hello');

        fs.reset();

        await bundle.invalidate(getPackageFile('multi-module/message/index'));
        {
            let { output } = await bundle.generate({ format: 'esm' });
            let { exports } = await Evaluator.init('esm', 'index.js', output);
            expect(exports.default.message).to.equal('hello world');
        }
    });

    it ('Scenario: Module removes a module', async function () {
        let bundle = await nollup({ input: getPackageMain('multi-module') });
        await bundle.generate({ format: 'esm' });

        stubPackageFile('multi-module/message/index', () => {
            return `
                import hello from './hello';
                export default hello;
            `;
        });

        await bundle.invalidate(getPackageFile('multi-module/message/index'));

        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        expect(exports.default.message).to.equal('hello');
        fs.reset();
    });

    it ('Scenario: Module adds a module that fails to transform', async function () {
        let phase = 0;
        let failed = false;

        let bundle = await nollup({
            input: getPackageMain('multi-module'),
            plugins: [{
                transform: (code, id) => {
                    if (phase === 0 && id.indexOf('message') > 0) {
                        throw new Error('transform fail');
                    }

                    return {
                        code
                    }
                }
            }]
        });

        try {
            await bundle.generate({ format: 'esm' });
            failed = true;
        } catch (e) {
            if (failed) {
                throw new Error('should have failed');
            }

            phase++;
            let { output } = await bundle.generate({ format: 'esm' });
            let { exports } = await Evaluator.init('esm', 'index.js', output);
            expect(exports.default.message).to.equal('hello world');
            fs.reset();
        }
    });

    it ('Scenario: Module whose dependency fails resolveId plugin', async function () {
        let phase = 0;
        let failed = false;

        let bundle = await nollup({
            input: getPackageMain('multi-module'),
            plugins: [{
                resolveId: (id) => {
                    if (phase === 0 && id.indexOf('message') > 0) {
                        throw new Error('resolveId fail');
                    }

                    return null;
                }
            }]
        });

        try {
            await bundle.generate({ format: 'esm' });
            failed = true;
        } catch (e) {
            if (failed) {
                throw new Error('should have failed');
            }

            phase++;
            await bundle.invalidate(getPackageFile('multi-module/message/index'));

            let { output } = await bundle.generate({ format: 'esm' });
            let { exports } = await Evaluator.init('esm', 'index.js', output);
            expect(exports.default.message).to.equal('hello world');
            fs.reset();
        }
    });

    it ('Scenario: Check different export techniques', async function () {
        let bundle = await nollup({ input: getPackageMain('export-checks') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        expect(exports.MyVar).to.equal('MyVar');
        expect(exports.MyVarAlias).to.equal('MyVar');
        // expect(exports.MyClass.prototype.getValue()).to.equal('MyClass');
        // expect(exports.MyClassAlias.prototype.getValue()).to.equal('MyClass');
        expect(exports.default).to.equal('MyVarMyVarMyVar');
        expect(exports.DepFrom).to.equal('dep-from');
        expect(exports.AliasDepFromProxy).to.equal('alias-dep-from');
        expect(exports.DefaultDepFrom).to.equal('default-dep-from');
    });

    it ('Scenario: Check export default from file', async function () {
        let bundle = await nollup({ input: getPackageMain('export-default-from') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        expect(exports.default).to.equal(123);
    });

    it ('Scenario: Check overlapping same name export froms', async function () {
        let bundle = await nollup({ input: getPackageMain('export-same-export-as-from') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        expect(exports.hello).to.equal('hello');
        expect(exports.world).to.equal('world');
    });

    it ('Scenario: Check export all', async function () {
        let bundle = await nollup({ input: getPackageMain('export-all') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        // TODO: Fix issue where we can't access export * directly
        expect(exports.message1).to.equal('hello');
        expect(exports.message2).to.equal('world');
        expect(exports.default).to.be.undefined;
    });

    it ('Scenario: Empty source map in transform', async function () {
        let bundle = await nollup({
            input: getPackageMain('empty-source-mapping'),
            plugins: [{
                transform (code, id) {
                    if (path.extname(id) === '.json') {
                        return {
                            code: `export default ${code}`,
                            map: { mappings: '' }
                        };
                    }
                }
            }]
        });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        expect(exports.default.message).to.equal('hello');
    });

    it ('Scenario: Circular Dependencies', async function () {
        let bundle = await nollup({ input: getPackageMain('circular') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        expect(exports.default).to.equal('A2 - A3 - A1');
    });

    it ('Scenario: Circular Dependencies Deep', async function () {
        let bundle = await nollup({ input: getPackageMain('circular-deep') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        expect(exports.default).to.equal('hello world');
    });

    it ('Scenario: Circular Dependencies Export Function As', async function () {
        let bundle = await nollup({ input: getPackageMain('circular-export-fn-as') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        let log = await Evaluator.logs(1);
        expect(log.length).to.equal(1);
        expect(log[0]).to.equal('hello');
    });

    it ('Scenario: Circular Dependencies Hoist Var Patterns', async function () {
        let bundle = await nollup({ input: getPackageMain('circular-hoist-var-patterns') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        let log = await Evaluator.logs(1);
        expect(log.length).to.equal(1);
        expect(log[0]).to.equal('world-bar-ipsum-multi');
    });

    it ('Scenario: Circular Dependencies Hoist Var Patterns Extra', async function () {
        let bundle = await nollup({ input: getPackageMain('circular-hoist-var-patterns-extra') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        let log = await Evaluator.logs(1);
        expect(log.length).to.equal(1);
        expect(log[0]).to.equal('hello-world-foo-bar-lorem');
    });

    it ('Scenario: Circular Dependencies Hoist Class', async function () {
        let bundle = await nollup({ input: getPackageMain('circular-hoist-class') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        let log = await Evaluator.logs(1);
        expect(log.length).to.equal(1);
        expect(log[0]).to.equal('hello');
    });

    it ('Scenario: Circular Dependencies Function Using Require', async function () {
        let bundle = await nollup({ input: getPackageMain('circular-hoist-fn-require') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        await new Promise(resolve => setTimeout(resolve, 1000));
        let log = await Evaluator.logs(1);
        expect(log.length).to.equal(1);
        expect(log[0]).to.equal('hello-dynamic');
    });

    it ('Scenario: Circular Dependencies Shared Timing', async function () {
        let bundle = await nollup({ input: getPackageMain('circular-shared-import-timing') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        let log = await Evaluator.logs(3);
        expect(log[0]).to.equal('shared import');
        expect(log[1]).to.equal('log above and log below');
        expect(log[2]).to.equal('shared import');
        expect(log.length).to.equal(3);
    });

    it ('Scenario: Circular Dependencies for Export FROM', async function () {
        let bundle = await nollup({ input: getPackageMain('circular-export-from') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        expect(exports.default).to.equal('A');
    });

    it ('Scenario: Circular Dependencies for Export all FROM', async function () {
        let bundle = await nollup({ input: getPackageMain('circular-export-all-from') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        expect(exports.default).to.equal('A');
    });

    it ('Scenario: Circular Dependencies for Export from infinite loop', async function () {
        let bundle = await nollup({ input: getPackageMain('circular-export-from-infinite-loop') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        expect(exports.default).to.equal('A');
    });

    it ('Scenario: Export Declaration Late Binding', async function () {
        let bundle = await nollup({ input: getPackageMain('export-declaration-late-binding') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        expect(exports.default).to.equal('hello world');
    });

    it ('Scenario: Export Import Delayed', async function () {
        let bundle = await nollup({ input: getPackageMain('export-import-delayed') });
        let { output } = await bundle.generate({ format: 'esm' });
        let { exports } = await Evaluator.init('esm', 'index.js', output);
        expect(exports.message).to.equal('hello');
    });

    describe ('Live Bindings', () => {
        // Note that we're generating as CJS instead of ESM to allow 
        // for with-scope to function without error.
        [true, 'reference', 'with-scope'].forEach(liveBindings => {
            it ('Scenario: Full Live Binding (' + liveBindings + ')', async function () {
                let bundle = await nollup({ input: getPackageMain('export-full-live-bindings') });
                bundle.configure({ liveBindings });
                let { output } = await bundle.generate({ format: 'cjs' });
                let { exports } = await Evaluator.init('cjs', 'index.js', output);
                expect(exports).to.equal('Counter: 3');
            });
    
            it ('Scenario: Circular Dependencies (' + liveBindings + ')', async function () {
                let bundle = await nollup({ input: getPackageMain('circular') });
                bundle.configure({ liveBindings });
                let { output } = await bundle.generate({ format: 'cjs' });
                let { exports } = await Evaluator.init('cjs', 'index.js', output);
                expect(exports).to.equal('A2 - A3 - A1');
            });
    
            it ('Scenario: Circular Dependencies for Export FROM (' + liveBindings + ')', async function () {
                let bundle = await nollup({ input: getPackageMain('circular-export-from') });
                bundle.configure({ liveBindings });
                let { output } = await bundle.generate({ format: 'cjs' });
                let { exports } = await Evaluator.init('cjs', 'index.js', output);
                expect(exports).to.equal('A');
            });
    
            it ('Scenario: Circular Dependencies for Export all FROM (' + liveBindings + ')', async function () {
                let bundle = await nollup({ input: getPackageMain('circular-export-all-from') });
                bundle.configure({ liveBindings });
                let { output } = await bundle.generate({ format: 'cjs' });
                let { exports } = await Evaluator.init('cjs', 'index.js', output);
                expect(exports).to.equal('A');
            });
    
            it ('Scenario: Circular Dependencies for Export from infinite loop (' + liveBindings + ')', async function () {
                let bundle = await nollup({ input: getPackageMain('circular-export-from-infinite-loop') });
                bundle.configure({ liveBindings });
                let { output } = await bundle.generate({ format: 'cjs' });
                let { exports } = await Evaluator.init('cjs', 'index.js', output);
                expect(exports).to.equal('A');
            });
    
            it ('Scenario: Export Declaration Late Binding (' + liveBindings + ')', async function () {
                let bundle = await nollup({ input: getPackageMain('export-declaration-late-binding') });
                bundle.configure({ liveBindings });
                let { output } = await bundle.generate({ format: 'cjs' });
                let { exports } = await Evaluator.init('cjs', 'index.js', output);
                expect(exports).to.equal('hello world');
            });
    
            it ('Scenario: Check different export techniques (' + liveBindings + ')', async function () {
                let bundle = await nollup({ input: getPackageMain('export-checks') });
                bundle.configure({ liveBindings });
                let { output } = await bundle.generate({ format: 'cjs' });
                let { exports } = await Evaluator.init('cjs', 'index.js', output);
                expect(exports.MyVar).to.equal('MyVar');
                expect(exports.MyVarAlias).to.equal('MyVar');
                // expect(exports.MyClass.prototype.getValue()).to.equal('MyClass');
                // expect(exports.MyClassAlias.prototype.getValue()).to.equal('MyClass');
                expect(exports.default).to.equal('MyVarMyVarMyVar');
                expect(exports.DepFrom).to.equal('dep-from');
                expect(exports.AliasDepFromProxy).to.equal('alias-dep-from');
                expect(exports.DefaultDepFrom).to.equal('default-dep-from');
            });
    
            it ('Scenario: Check export default from file (' + liveBindings + ')', async function () {
                let bundle = await nollup({ input: getPackageMain('export-default-from') });
                bundle.configure({ liveBindings });
                let { output } = await bundle.generate({ format: 'cjs' });
                let { exports } = await Evaluator.init('cjs', 'index.js', output);
                expect(exports).to.equal(123);
            });
    
            it ('Scenario: Check export all (' + liveBindings + ')', async function () {
                let bundle = await nollup({ input: getPackageMain('export-all') });
                bundle.configure({ liveBindings });
                let { output } = await bundle.generate({ format: 'cjs' });
                let { exports } = await Evaluator.init('cjs', 'index.js', output);
                expect(exports.message1).to.equal('hello');
                expect(exports.message2).to.equal('world');
                expect(exports.default).to.be.undefined;
            });
    
            it ('Scenario: Check synthetic export all (' + liveBindings + ')', async function () {
                let bundle = await nollup({
                    input: getPackageMain('export-synthetic-all-from'), 
                    plugins: [{
                        transform (code, id) {
                            if (id.indexOf('impl') > -1) {
                                return {
                                    code,
                                    syntheticNamedExports: true
                                }
                            }
                        }
                    }]
                });
                bundle.configure({ liveBindings });
                let { output } = await bundle.generate({ format: 'cjs' });
                let { exports } = await Evaluator.init('cjs', 'index.js', output);
                expect(exports.message1).to.equal('hello');
                expect(exports.message2).to.equal('world');
                expect(exports.default).to.be.undefined;
            });

            it ('Scenario: Export Import Delayed (' + liveBindings + ')', async function () {
                let bundle = await nollup({ input: getPackageMain('export-import-delayed') });
                bundle.configure({ liveBindings });
                let { output } = await bundle.generate({ format: 'cjs' });
                let { exports } = await Evaluator.init('cjs', 'index.js', output);
                expect(exports.message).to.equal('hello');
            });
    
        })
        
    })

    
});