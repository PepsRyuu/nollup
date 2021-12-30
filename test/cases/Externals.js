let { nollup, fs, expect, rollup } = require('../nollup');
let Evaluator = require('../utils/evaluator');

let EXTERNAL_MODULES = {
    esm: {
        'readline': `
            function clearLine() {}; 
            export default { clearLine }
        `,
        'DefaultModule': `
            export default { prop: true };
        `,
        'NamedModule': `
            export var NamedExport1 = 123;
            export var NamedExport2 = 456;
        `,
        'BareModule': `
            self.BareModule = { prop: true };
        `
    },
    cjs: {
        'DefaultModule': `
            module.exports.default = { prop: true }
        `,
        'NamedModule': `
            module.exports.NamedExport1 = 123;
            module.exports.NamedExport2 = 456;
        `,
        'BareModule': `
            self.BareModule = { prop: true };
        `,
        'DefaultFallbackModule': `
            module.exports = { prop: true };
        `
    },
    amd: {
        'readline': `
            define('readline', function () {
                return { clearLine() {} }
            });
        `,
        'DefaultModule': `
            define('DefaultModule', function () {
                return { default: { prop: true } }
            });
        `,
        'NamedModule': `
            define('NamedModule', function () {
                return {
                    NamedExport1: 123,
                    NamedExport2: 456
                }
            });
        `,
        'BareModule': `
            define('BareModule', function () {
                self.BareModule = { prop: true };
            });
        `,
        'DefaultFallbackModule': `
            define('DefaultFallbackModule', function () {
                return { prop: true }
            });
        `
    },
    iife: {
        'readline': {
            clearLine: true
        },
        'DefaultModule': {
            default: { 
                prop: true
            }
        },
        'NamedModule': {
            NamedExport1: 123,
            NamedExport2: 456
        },
        'BareModule': {
            prop: true
        },
        'DefaultFallbackModule': {
            prop: true
        },
        '_IIFE_Special_Characters_': {
            NamedExport1: 123,
            NamedExport2: 456
        },
        '__globalModule': {
            NamedExport1: 123,
            NamedExport2: 456
        }
    }
};

function getModules (output, format) {
    if (format === 'iife') {
        return output;
    }

    let result = [
        ...output,
        ...Object.entries(EXTERNAL_MODULES[format]).map(entry => ({
            code: entry[1],
            fileName: entry[0],
            external: true
        }))
    ];

    return result;
}

function getGlobalScope (globals, format) {
    if (format !== 'iife') {
        return globals;
    }
    
    return {
        ...globals,
        ...EXTERNAL_MODULES.iife
    }
}

describe('External', () => {
    ['esm', 'cjs', 'iife', 'amd'].forEach(format => {
        describe(format, () => {
            it ('should allow external array to work', async () => {
                fs.stub('./src/impl.js', () => `export default true;`)
                fs.stub('./src/main.js', () => `
                    import result from './impl';
                    import readline from "readline"; 
                    console.debug(readline);
                    if (readline.clearLine) { 
                        self.result = result 
                    }
                `);

                let bundle = await nollup({
                    input: './src/main.js',
                    external: ['readline']
                });

                let { output } = await bundle.generate({ format });
                let { globals } = await Evaluator.init(format, 'main.js', getModules(output, format), getGlobalScope({}, format));
                expect(globals.result).to.equal(true);
                fs.reset();
            });

            it ('should allow external function to work', async () => {
                fs.stub('./src/impl.js', () => `export default true;`)
                fs.stub('./src/main.js', () => `
                    import result from './impl';
                    import readline from "readline"; 
                    if (readline.clearLine) { 
                        self.result = result 
                    }
                `);

                let bundle = await nollup({
                    input: './src/main.js',
                    external: id => id === 'readline'
                });

                let { output } = await bundle.generate({ format });
                let { globals } = await Evaluator.init(format, 'main.js', getModules(output, format), getGlobalScope({ }, format));
                expect(globals.result).to.equal(true);
                fs.reset();
            });

            it ('should allow external from resolveId to work', async () => {
                fs.stub('./src/impl.js', () => `export default true;`)
                fs.stub('./src/main.js', () => `
                    import result from './impl';
                    import readline from "readline"; 
                    if (readline.clearLine) { 
                        self.result = result 
                    }
                `);

                let bundle = await nollup({
                    input: './src/main.js',
                    plugins: [{
                        resolveId (id, parent) {
                            if (id === 'readline') {
                                return {
                                    id: 'readline',
                                    external: true
                                }
                            }
                        }
                    }]
                });

                let { output } = await bundle.generate({ format });
                let { globals } = await Evaluator.init(format, 'main.js', getModules(output, format), getGlobalScope({ }, format));
                expect(globals.result).to.equal(true);
                fs.reset();
            });

            it ('should allow default import for external', async () => {
                fs.stub('./src/main.js', () => `
                    import Default from "DefaultModule"; 
                    if (Default.prop) { 
                        self.result = true; 
                    }
                `);

                let bundle = await nollup({
                    input: './src/main.js',
                    external: ['DefaultModule']
                });

                let { output } = await bundle.generate({ format });
                let { globals } = await Evaluator.init(format, 'main.js', getModules(output, format), getGlobalScope({ }, format));
                expect(globals.result).to.equal(true);
                fs.reset();
            });

            it ('should allow named import for external', async () => {
                fs.stub('./src/main.js', () => `
                    import { NamedExport1, NamedExport2 } from "NamedModule"; 
                    if (NamedExport1 === 123 && NamedExport2 === 456) { 
                        self.result = true; 
                    }
                `);

                let bundle = await nollup({
                    input: './src/main.js',
                    external: ['NamedModule']
                });

                let { output } = await bundle.generate({ format });
                let { globals } = await Evaluator.init(format, 'main.js', getModules(output, format), getGlobalScope({ }, format));
                expect(globals.result).to.equal(true);
                fs.reset();
            });

            it ('should allow namespace import for external', async () => {
                fs.stub('./src/main.js', () => `
                    import * as Namespace from "NamedModule"; 
                    if (Namespace.NamedExport1 === 123 && Namespace.NamedExport2 === 456) { 
                        self.result = true; 
                    }
                `);

                let bundle = await nollup({
                    input: './src/main.js',
                    external: ['NamedModule']
                });

                let { output } = await bundle.generate({ format });
                let { globals } = await Evaluator.init(format, 'main.js', getModules(output, format), getGlobalScope({ }, format));
                expect(globals.result).to.equal(true);
                fs.reset();
            });

            it ('should allow bare import for external', async () => {
                fs.stub('./src/main.js', () => `
                    import 'BareModule'; 
                    if (self.BareModule.prop) { 
                        self.result = true; 
                    }
                `);

                let bundle = await nollup({
                    input: './src/main.js',
                    external: ['BareModule']
                });

                let { output } = await bundle.generate({ format });
                let { globals } = await Evaluator.init(format, 'main.js', getModules(output, format), getGlobalScope({ }, format));
                expect(globals.result).to.equal(true);
                fs.reset();
            });

            it ('should allow export from for default for external', async () => {
                fs.stub('./src/impl.js', () => `export { default } from 'DefaultModule';`)
                fs.stub('./src/main.js', () => `
                    import Default from './impl';
                    if (Default.prop) { 
                        self.result = true; 
                    }
                `);

                let bundle = await nollup({
                    input: './src/main.js',
                    external: ['DefaultModule']
                });

                let { output } = await bundle.generate({ format });
                let { globals } = await Evaluator.init(format, 'main.js', getModules(output, format), getGlobalScope({ }, format));
                expect(globals.result).to.equal(true);
                fs.reset();
            });

            it ('should allow export from for named for external', async () => {
                fs.stub('./src/impl.js', () => `export { NamedExport1, NamedExport2 as Other } from 'NamedModule';`)
                fs.stub('./src/main.js', () => `
                    import { NamedExport1, Other } from './impl';
                    if (NamedExport1 === 123 && Other === 456) { 
                        self.result = true; 
                    }
                `);

                let bundle = await nollup({
                    input: './src/main.js',
                    external: ['NamedModule']
                });

                let { output } = await bundle.generate({ format });
                let { globals } = await Evaluator.init(format, 'main.js', getModules(output, format), getGlobalScope({ }, format));
                expect(globals.result).to.equal(true);
                fs.reset();
            });

            it ('should allow export from for namespace for external', async () => {
                fs.stub('./src/impl.js', () => `export * from 'NamedModule';`)
                fs.stub('./src/main.js', () => `
                    import { NamedExport1, NamedExport2 } from './impl';
                    if (NamedExport1 === 123 && NamedExport2 === 456) { 
                        self.result = true; 
                    }
                `);

                let bundle = await nollup({
                    input: './src/main.js',
                    external: ['NamedModule']
                });

                let { output } = await bundle.generate({ format });
                let { globals } = await Evaluator.init(format, 'main.js', getModules(output, format), getGlobalScope({ }, format));
                expect(globals.result).to.equal(true);
                fs.reset();
            });
        });
    });

    describe ('Externals in Chunks', () => {
        ['esm', 'cjs', 'amd'].forEach(format => {
            it ('should allow external imports for chunks (' + format + ')', async function () {
                this.timeout(10000);
                fs.stub('./src/chunk.js', () => `export { NamedExport1, NamedExport2 } from 'NamedModule';`)
                fs.stub('./src/main.js', () => `
                    import('./chunk').then(mod => {
                        if (mod.NamedExport1 === 123 && mod.NamedExport2 === 456) { 
                            self.result = true; 
                        }
                    });
                `);

                let bundle = await nollup({
                    input: './src/main.js',
                    external: ['NamedModule']
                });

                let { output } = await bundle.generate({ format, chunkFileNames: '[name].js' });
                let { globals } = await Evaluator.init(format, 'main.js', getModules(output, format), { }, true);
                expect(globals.result).to.equal(true);
                fs.reset();
            });
        })
    })

    describe('Default Fallback', () => {
        ['cjs', 'iife', 'amd'].forEach(format => {
            it ('should fallback if default import not found for external (' + format + ')', async () => {
                fs.stub('./src/main.js', () => `
                    import Default from "DefaultFallbackModule"; 
                    if (Default.prop) { 
                        self.result = true; 
                    }
                `);

                let bundle = await nollup({
                    input: './src/main.js',
                    external: ['DefaultFallbackModule']
                });

                let { output } = await bundle.generate({ format });
                let { globals } = await Evaluator.init(format, 'main.js', getModules(output, format), getGlobalScope({ }, format));
                expect(globals.result).to.equal(true);
                fs.reset();
            });
        })
    });

    describe('IIFE Name Conversion', () => {
        it ('should convert special characters to underscore', async () => {
            fs.stub('./src/main.js', () => `
                import { NamedExport1, NamedExport2 } from "+IIFE-Special-Characters$"; 
                if (NamedExport1 === 123 && NamedExport2 === 456) { 
                    self.result = true; 
                }
            `);

            let bundle = await nollup({
                input: './src/main.js',
                external: ['+IIFE-Special-Characters$']
            });

            let { output } = await bundle.generate({ format: 'iife' });
            let { globals } = await Evaluator.init('iife', 'main.js', output, getGlobalScope({ }, 'iife'));
            expect(globals.result).to.equal(true);
            fs.reset();
        });

        it ('should use global object to determine variable name', async () => {
            fs.stub('./src/main.js', () => `
                import { NamedExport1, NamedExport2 } from "+IIFE-Special-Characters$"; 
                if (NamedExport1 === 123 && NamedExport2 === 456) { 
                    self.result = true; 
                }
            `);

            let bundle = await nollup({
                input: './src/main.js',
                external: ['+IIFE-Special-Characters$'],
                output: {
                    globals: {
                        '+IIFE-Special-Characters$': '__globalModule'
                    }
                }
            });

            let { output } = await bundle.generate({ format: 'iife' });
            let { globals } = await Evaluator.init('iife', 'main.js', output, getGlobalScope({ }, 'iife'));
            expect(globals.result).to.equal(true);
            fs.reset();
        });
    });

    describe ('Misc', () => {
        it ('should use the resolved id for dependency source, rather than the raw value', async () => {
            fs.stub('./src/main.js', () => `
                import Default from "MySpecialModule?key=value"; 
                if (Default.prop) { 
                    self.result = true; 
                }
            `);

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveId (id) {
                        if (id.indexOf('MySpecialModule') > -1) {
                            return {
                                id: 'DefaultModule',
                                external: true
                            };
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            let { globals } = await Evaluator.init('esm', 'main.js', getModules(output, 'esm'), { });
            expect(globals.result).to.equal(true);
            fs.reset();
        })
    })
    
});