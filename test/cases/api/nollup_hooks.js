let { nollup, fs, expect, rollup } = require('../../nollup');

describe ('API: Nollup Hooks', () => {

    describe('nollupBundleInit', () => {
        it ('should have access to instances', async () => {
            fs.stub('./src/dep.js', () => 'export default 123');
            fs.stub('./src/main.js', () => 'import Dep from \'./dep\'; export default Dep');
            let __exports = {}; 

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    nollupBundleInit () {
                        return `
                            __exports.instances = instances;
                            expect(Object.keys(instances).length).to.equal(0);
                        `;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'iife' });
            eval(output[0].code);
            expect(Object.keys(__exports.instances).length).to.equal(2);
            expect(__exports.instances[0].id).to.equal(0);
            expect(__exports.instances[0].exports.default).to.equal(123);
            expect(__exports.instances[0].dependencies).to.deep.equal([1]);
            expect(__exports.instances[0].invalidate).to.equal(false);
            fs.reset();
        });

        it ('should have access to modules', async () => {
            fs.stub('./src/dep.js', () => 'export default 123');
            fs.stub('./src/main.js', () => 'import Dep from \'./dep\'; export default Dep');
            let __exports = {}; 

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    nollupBundleInit () {
                        return `
                            __exports.modules = modules;
                            modules[1] = function (c, r, d, e) {
                                d(function () {
                                }, function () {
                                    e('default', 456);
                                })
                            };
                            expect(Object.keys(modules).length).to.equal(2);
                        `;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'iife' });
            let result = eval(output[0].code);
            expect(typeof __exports.modules[0]).to.equal('function');
            expect(result.default).to.equal(456);
            fs.reset();
        });

        it ('should only execute before first module is required',async () => {
            fs.stub('./src/main.js', () => 'export default __testdata');
            let __testdata = ''; 

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

            let { output } = await bundle.generate({ format: 'iife' });
            let result = eval(output[0].code);
            expect(result.default).to.equal('hello');
            fs.reset();
        });
    });

    describe('nollupModuleInit', () => {
        it ('should have access to instances', async () => {
            fs.stub('./src/dep.js', () => 'export default 123');
            fs.stub('./src/main.js', () => 'import Dep from \'./dep\';export default Dep');
            let __exports = {}; 

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    nollupModuleInit () {
                        return `
                            if (module.id === 0) {
                                return expect(Object.keys(instances).length).to.equal(1);
                            }
                            if (module.id === 1) {
                                return expect(Object.keys(instances).length).to.equal(2);
                            }
                            throw new Error('Failed');
                        `;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'iife' });
            eval(output[0].code);
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
                            __exports.modules = modules;
                            modules[1] = function (c, r, d, e) {
                                d(function () {
                                }, function () {
                                    e('default', 456);
                                })
                            };
                            expect(Object.keys(modules).length).to.equal(2);
                        `;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'iife' });
            let result = eval(output[0].code);
            expect(typeof __exports.modules[0]).to.equal('function');
            expect(result.default).to.equal(456);
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

            let { output } = await bundle.generate({ format: 'iife' });
            eval(output[0].code);
            fs.reset();
        });
    });

    describe('nollupModuleWrap', () => {
        it ('should have access to instances', async () => {
            fs.stub('./src/dep.js', () => 'export default 123');
            fs.stub('./src/main.js', () => 'import Dep from \'./dep\';export default Dep');
            let __exports = {}; 

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    nollupModuleWrap (code) {
                        return `
                            ${code}
                            // Wrapped code executes when actually executing module
                            expect(Object.keys(instances).length).to.equal(2);
                        `;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'iife' });
            eval(output[0].code);
            fs.reset();
        });

        it ('should have access to modules', async () => {
            fs.stub('./src/dep.js', () => 'export default 123');
            fs.stub('./src/main.js', () => 'import Dep from \'./dep\'; export default Dep');
            let __exports = {}; 

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    nollupModuleWrap (code) {
                        return `
                            ${code}
                            __exports.modules = modules;
                            expect(Object.keys(modules).length).to.equal(2);
                        `;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'iife' });
            let result = eval(output[0].code);
            expect(typeof __exports.modules[0]).to.equal('function');
            expect(result.default).to.equal(123);
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

            let { output } = await bundle.generate({ format: 'iife' });
            let results = eval(output[0].code);
            expect(results.default).to.equal(123);
            fs.reset();
        });

        it ('should allow module code to be wrapped', async () => {
            fs.stub('./src/dep.js', () => 'export default 123');
            fs.stub('./src/main.js', () => 'import Dep from \'./dep\'; export default Dep');
            let counter = 0;

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

            let { output } = await bundle.generate({ format: 'iife' });
            eval(output[0].code);
            expect(output[0].code.match(/counter\+\+/g).length).to.equal(1);
            expect(counter).to.equal(2);
            fs.reset();
        });
    });

    describe('Module Invalidate', () => {
        it ('should be able to replace and invalidate modules', async () => {
            let _global = {};
            let _exports = {};

            fs.stub('./src/dep.js', () => `
                export var id = module.id;
                export default 123;
            `);
            fs.stub('./src/main.js', () => `
                import Dep, { id } from './dep'; 
                export default Dep;

                module.update = () => {
                    _exports.result = require(id);
                };
            `);

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    nollupBundleInit () {
                        return `
                            _global.apply = function (change) {
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

            let { output } = await bundle.generate({ format: 'iife' });
            eval(output[0].code);
            fs.stub('./src/dep.js', () => `
                export var id = module.id;
                export default 456;
            `);
            bundle.invalidate('./src/dep.js');
            let { changes } = await bundle.generate({ format: 'iife' });
            _global.apply(changes[0]);
            expect(_exports.result.default).to.equal(456);
        });
    });
});