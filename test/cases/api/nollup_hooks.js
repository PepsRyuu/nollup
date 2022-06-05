let { nollup, fs, expect, rollup } = require('../../nollup');
let Evaluator = require('../../utils/evaluator');

describe ('API: Nollup Hooks', () => {

    describe('nollupBundleInit', () => {
        it ('should have access to instances', async () => {
            fs.stub('./src/dep.js', () => 'export default 123');
            fs.stub('./src/main.js', () => 'import Dep from \'./dep\'; export default Dep');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    nollupBundleInit () {
                        return `
                            __exports.instances = instances;
                            if (Object.keys(instances).length !== 0) {
                                throw new Error('Failed');
                            }
                        `;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            let { globals } = await Evaluator.init('esm', 'main.js', output, { __exports: {} });
            expect(Object.keys(globals.__exports.instances).length).to.equal(2);
            expect(globals.__exports.instances[0].id).to.equal(0);
            expect(globals.__exports.instances[0].exports.default).to.equal(123);
            expect(globals.__exports.instances[0].dependencies).to.deep.equal([1]);
            expect(globals.__exports.instances[0].invalidate).to.equal(false);
            fs.reset();
        });

        it ('should have access to modules', async () => {
            fs.stub('./src/dep.js', () => 'export default 123');
            fs.stub('./src/main.js', () => 'import Dep from \'./dep\'; export default Dep');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    nollupBundleInit () {
                        return `
                            modules[1] = function (c, r, d, e) {
                                d(function () {
                                }, function () {
                                    e('default', function () { return 456 });
                                })
                            };
                            if (Object.keys(modules).length !== 2) {
                                throw new Error('Failed');
                            }
                            __exports.modules = Object.keys(modules).length;
                        `;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            let { globals, exports } = await Evaluator.init('esm', 'main.js', output, { __exports: {} });
            expect(globals.__exports.modules).to.equal(2);
            expect(exports.default).to.equal(456);
            fs.reset();
        });

        it ('should only execute before first module is required',async () => {
            fs.stub('./src/main.js', () => 'export default __testdata');
            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    nollupBundleInit () {
                        return `
                           __testdata = 'hello';
                        `;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            let { globals, exports } = await Evaluator.init('esm', 'main.js', output, { __testdata: '' });
            expect(exports.default).to.equal('hello');
            fs.reset();
        });
    });

    describe('nollupModuleInit', () => {
        it ('should have access to instances', async () => {
            fs.stub('./src/dep.js', () => 'export default 123');
            fs.stub('./src/main.js', () => 'import Dep from \'./dep\';export default Dep');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    nollupModuleInit () {
                        return `
                            function assert (condition) {
                                if (!condition) throw new Error('Assert Failed')
                            }

                            if (module.id === 0) {
                                return assert(Object.keys(instances).length === 1);
                            }
                            if (module.id === 1) {
                                return assert(Object.keys(instances).length === 2);
                            }
                            throw new Error('Failed');
                        `;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            await Evaluator.init('esm', 'main.js', output, { __exports: {} });
            fs.reset();
        });

        it ('should have access to modules', async () => {
            fs.stub('./src/dep.js', () => 'export default 123');
            fs.stub('./src/main.js', () => 'import Dep from \'./dep\'; export default Dep');
            let __exports = {}; 

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    nollupModuleInit () {
                        return `
                            modules[1] = function (c, r, d, e) {
                                d(function () {
                                }, function () {
                                    e('default', function () { return 456 });
                                })
                            };

                            if (Object.keys(modules).length !== 2) {
                                throw new Error('Failed');
                            }

                            __exports.modules = Object.keys(modules).length;
                        `;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            let { globals, exports } = await Evaluator.init('esm', 'main.js', output, { __exports: {} });
            expect(globals.__exports.modules).to.equal(2);
            expect(exports.default).to.equal(456);
            fs.reset();
        });

        it ('should have access to current module', async () => {
            fs.stub('./src/dep.js', () => 'export default 123');
            fs.stub('./src/main.js', () => 'import Dep from \'./dep\'; export default Dep');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    nollupModuleInit () {
                        return `
                            if (module.id !== 0 && module.id !== 1) {
                                throw new Error('Failed');
                            }
                        `;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            await Evaluator.init('esm', 'main.js', output);
            fs.reset();
        });
    });

    describe('nollupModuleWrap', () => {
        it ('should have access to instances', async () => {
            fs.stub('./src/dep.js', () => 'export default 123');
            fs.stub('./src/main.js', () => 'import Dep from \'./dep\';export default Dep');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    nollupModuleWrap (code) {
                        return `
                            ${code}
                            // Wrapped code executes when actually executing module
                            if (Object.keys(instances).length !== 2) {
                                throw new Error('Failed');
                            }
                        `;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            await Evaluator.init('esm', 'main.js', output);
            fs.reset();
        });

        it ('should have access to modules', async () => {
            fs.stub('./src/dep.js', () => 'export default 123');
            fs.stub('./src/main.js', () => 'import Dep from \'./dep\'; export default Dep');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    nollupModuleWrap (code) {
                        return `
                            ${code}
                            
                            if (Object.keys(modules).length !== 2) {
                                throw new Error('Failed');
                            }
                            __exports.modules = Object.keys(modules).length;
                        `;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            let { globals, exports } = await Evaluator.init('esm', 'main.js', output, { __exports: {} });
            expect(globals.__exports.modules).to.equal(2);
            expect(exports.default).to.equal(123);
            fs.reset();
        });

        it ('should have access to current module', async () => {
            fs.stub('./src/dep.js', () => 'export default 123');
            fs.stub('./src/main.js', () => 'import Dep from \'./dep\'; export default Dep');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    nollupModuleWrap (code) {
                        return `
                            ${code}
                            if (module.id !== 0 && module.id !== 1) {
                                throw new Error('Failed');
                            }
                        `;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            let { exports } = await Evaluator.init('esm', 'main.js', output);
            expect(exports.default).to.equal(123);
            fs.reset();
        });

        it ('should allow module code to be wrapped', async () => {
            fs.stub('./src/dep.js', () => 'export default 123');
            fs.stub('./src/main.js', () => 'import Dep from \'./dep\'; export default Dep');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    nollupModuleWrap (code) {
                        return `
                            counter++; 
                            ${code}
                        `;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            let { globals } = await Evaluator.init('esm', 'main.js', output, { counter: 0 });
            expect(output[0].code.match(/counter\+\+/g).length).to.equal(1);
            expect(globals.counter).to.equal(2);
            fs.reset();
        });
    });

    describe('Module Invalidate', () => {
        it ('should be able to replace and invalidate modules', async () => {

            fs.stub('./src/dep.js', () => `
                export var id = module.id;
                export default 123;
            `);
            fs.stub('./src/main.js', () => `
                import Dep, { id } from './dep'; 
                export default Dep;

                module.update = () => {
                    console.log(JSON.stringify(require(id)));
                };
            `);

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    nollupBundleInit () {
                        return `
                            globalThis.applyChange = function (change) {
                                modules[change.id] = eval(change.code);
                                instances[change.id].invalidate = true;

                                Object.keys(instances).filter(instId => {
                                    return instances[instId].dependencies.indexOf(change.id) > -1;
                                }).map(id => {
                                    instances[id].invalidate = true;
                                    return parseInt(id);
                                }).forEach(id => {
                                    if (instances[id].update) {
                                        instances[id].update();
                                    }
                                });
                            }
                        `;
                    }
                }]
            })

            let { output } = await bundle.generate({ format: 'esm' });
            let { globals } = await Evaluator.init('esm', 'main.js', output, { globalThis: {} });
            fs.stub('./src/dep.js', () => `
                export var id = module.id;
                export default 456;
            `);
            bundle.invalidate('./src/dep.js');
            let { changes } = await bundle.generate({ format: 'esm' });
            await Evaluator.call('applyChange', changes[0]);

            await new Promise(resolve => setTimeout(resolve, 1000));

            let log = await Evaluator.logs(1);
            expect(log[0]).to.equal(`{"id":1,"default":456}`);
        });
    });
});