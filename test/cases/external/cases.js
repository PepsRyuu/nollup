let { nollup, fs, expect, rollup } = require('../../nollup');
let { executeChunkedFiles } = require('./external-runtime.js');

describe('External', () => {
    ['esm', 'cjs', 'iife'].forEach(format => {
        describe(format, () => {
            it ('should allow external array to work', async () => {
                fs.stub('./src/impl.js', () => `export default true;`)
                fs.stub('./src/main.js', () => `
                    import result from './impl';
                    import fs from "fs"; 
                    if (fs.readFileSync) { 
                        self.result = result 
                    }
                `);

                let bundle = await nollup({
                    input: './src/main.js',
                    external: ['fs']
                });

                let { output } = await bundle.generate({ format });
                let result = await executeChunkedFiles(format, 'main.js', output);
                expect(result).to.equal(true);
                fs.reset();
            });

            it ('should allow external function to work', async () => {
                fs.stub('./src/impl.js', () => `export default true;`)
                fs.stub('./src/main.js', () => `
                    import result from './impl';
                    import fs from "fs"; 
                    if (fs.readFileSync) { 
                        self.result = result 
                    }
                `);

                let bundle = await nollup({
                    input: './src/main.js',
                    external: id => id === 'fs'
                });

                let { output } = await bundle.generate({ format });
                let result = await executeChunkedFiles(format, 'main.js', output);
                expect(result).to.equal(true);
                fs.reset();
            });

            it ('should allow external from resolveId to work', async () => {
                fs.stub('./src/impl.js', () => `export default true;`)
                fs.stub('./src/main.js', () => `
                    import result from './impl';
                    import fs from "fs"; 
                    if (fs.readFileSync) { 
                        self.result = result 
                    }
                `);

                let bundle = await nollup({
                    input: './src/main.js',
                    plugins: [{
                        resolveId (id, parent) {
                            if (id === 'fs') {
                                return {
                                    id: 'fs',
                                    external: true
                                }
                            }
                        }
                    }]
                });

                let { output } = await bundle.generate({ format });
                let result = await executeChunkedFiles(format, 'main.js', output);
                expect(result).to.equal(true);
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
                let result = await executeChunkedFiles(format, 'main.js', output);
                expect(result).to.equal(true);
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
                let result = await executeChunkedFiles(format, 'main.js', output);
                expect(result).to.equal(true);
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
                let result = await executeChunkedFiles(format, 'main.js', output);
                expect(result).to.equal(true);
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
                let result = await executeChunkedFiles(format, 'main.js', output);
                expect(result).to.equal(true);
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
                let result = await executeChunkedFiles(format, 'main.js', output);
                expect(result).to.equal(true);
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
                let result = await executeChunkedFiles(format, 'main.js', output);
                expect(result).to.equal(true);
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
                let result = await executeChunkedFiles(format, 'main.js', output);
                expect(result).to.equal(true);
                fs.reset();
            });
        });
    });

    describe ('Externals in Chunks', () => {
        ['esm', 'cjs'].forEach(format => {
            it ('should allow external imports for chunks (' + format + ')', async () => {
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
                let result = await executeChunkedFiles(format, 'main.js', output, true);
                expect(result).to.equal(true);
                fs.reset();
            });
        })
    })

    describe('Default Fallback', () => {
        ['cjs', 'iife'].forEach(format => {
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
                let result = await executeChunkedFiles(format, 'main.js', output);
                expect(result).to.equal(true);
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
            let result = await executeChunkedFiles('iife', 'main.js', output);
            expect(result).to.equal(true);
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
            let result = await executeChunkedFiles('iife', 'main.js', output);
            expect(result).to.equal(true);
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
            let result = await executeChunkedFiles('esm', 'main.js', output);
            expect(result).to.equal(true);
            fs.reset();
        })
    })
    
});