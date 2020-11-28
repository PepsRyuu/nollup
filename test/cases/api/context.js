let { nollup, fs, expect, rollup } = require('../../nollup');
let path = require('path');
let MagicString = require('magic-string');

describe ('API: Plugin Context', () => {
    describe('emitAsset', () => {
        it ('should accept assetName and source', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        this.emitAsset('pre-style.css', 'lol');
                    },
                    generateBundle (output, bundle) {
                        expect(Object.keys(bundle).length).to.equal(2);
                        this.emitAsset('style.css', 'lol');
                        expect(Object.keys(bundle).length).to.equal(3);
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output.length).to.equal(3);
            fs.reset();
        });

        it ('should return an assetId', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    generateBundle (output, bundle) {
                        let id = this.emitAsset('style.css', 'lol');
                        expect(typeof id).to.equal('string');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            fs.reset();
        });

        // it ('should not emit same named asset twice', async () => {
        //     fs.stub('./src/main.js', () => 'export default 123');

        //     let bundle = await nollup({
        //         input: './src/main.js',
        //         plugins: [{
        //             generateBundle (output, bundle) {
        //                 this.emitAsset('style.css', 'lol');
        //                 this.emitAsset('style.css', 'lol');
        //             }
        //         }]
        //     });

        //     let { output } = await bundle.generate({ format: 'esm' });
        //     expect(output.length).to.equal(2);
        //     fs.reset();
        // });

        // it ('should emit same named asset if content is different', async () => {
        //     fs.stub('./src/main.js', () => 'export default 123');

        //     let bundle = await nollup({
        //         input: './src/main.js',
        //         plugins: [{
        //             generateBundle (output, bundle) {
        //                 this.emitAsset('style.css', 'lol');
        //                 this.emitAsset('style.css', 'lolrofl');
        //             }
        //         }]
        //     });

        //     let { output } = await bundle.generate({ format: 'esm', assetFileNames: '[name][extname]' });
        //     expect(output.length).to.equal(3);
        //     expect(output[1].fileName).to.equal('style.css');
        //     expect(output[1].source).to.equal('lol');
        //     expect(output[2].fileName).to.equal('style2.css');
        //     expect(output[2].source).to.equal('lolrofl');
        //     fs.reset();
        // });

        it ('should not emit same named asset multiple times if content is changed on rebuild', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let phase = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    generateBundle (output, bundle) {
                        if (phase === 0) {
                            this.emitAsset('style.css', 'lol');
                        } else if (phase === 1) {
                            this.emitAsset('style.css', 'lolrofl');
                        } 
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output.length).to.equal(2);
            phase = 1;
            let rebuild = await bundle.generate({ format: 'esm' });
            expect(rebuild.output.length).to.equal(2);
            expect(rebuild.output[1].source).to.equal('lolrofl');

            fs.reset();
        });

        it ('should have deconflicted asset in generateBundle bundle object if emitted during build step', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        this.emitAsset('style.css', 'lol');
                        this.emitAsset('style.css', 'lolrofl');
                    },

                    generateBundle (output, bundle) {
                        expect(bundle['style.css'].source).to.equal('lol');
                        expect(bundle['style2.css'].source).to.equal('lolrofl');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', assetFileNames: '[name][extname]' });
            expect(output.length).to.equal(3);
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should still emit asset emitted on rebuild on a rebuild even if module is cached', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;
            let phase = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        this.emitAsset('style.css', 'lol');
                    },

                    generateBundle (output, bundle) {
                        if (phase === 1) {
                            expect(bundle['style.css'].source).to.equal('lol');
                            passed = true;
                        }  
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', assetFileNames: '[name][extname]' });
            expect(output.length).to.equal(2);
            phase = 1;
            let rebuild = await bundle.generate({ format: 'esm', assetFileNames: '[name][extname]' });
            expect(rebuild.output.length).to.equal(2);
            expect(rebuild.output[1].source).to.equal('lol');

            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should not emit asset again if on rebuild the cached module no longer emits that asset', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed = false;
            let phase = 0;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        if (phase === 0) {
                            this.emitAsset('style.css', 'lol');
                        }
                    },

                    generateBundle (output, bundle) {
                        if (phase === 1) {
                            expect(bundle['style.css']).to.be.undefined;
                            passed = true;
                        }  
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', assetFileNames: '[name][extname]' });
            expect(output.length).to.equal(2);
            phase = 1;
            bundle.invalidate('./src/main.js');

            let rebuild = await bundle.generate({ format: 'esm' });
            expect(rebuild.output.length).to.equal(1);
            expect(passed).to.be.true;
            fs.reset();
        });
    });

    describe('emitChunk', () => {
        it ('should accept chunkModuleId', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/chunk.js', () => 'export default 456');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        this.emitChunk('./src/chunk.js');
                    },
                    generateBundle (output, bundle) {
                        expect(Object.keys(bundle).length).to.equal(2);
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output.length).to.equal(2);
        
            let main = output.find(o => o.fileName === 'main.js');
            let chunk = output.find(o => o.fileName.startsWith('chunk'));
            expect(main.code.indexOf('123') > -1).to.be.true;
            expect(main.isDynamicEntry).to.be.false;
            expect(main.isEntry).to.be.true;
            expect(main.type).to.equal('chunk');
            expect(main.modules[path.resolve(process.cwd(), './src/main.js')]).not.to.be.undefined;
            expect(main.imports).to.deep.equal([]);
            expect(main.exports).to.deep.equal(['default']);

            expect(chunk.code.indexOf('456') > -1).to.be.true;
            expect(chunk.isDynamicEntry).to.be.false;
            expect(chunk.isEntry).to.be.true;
            expect(chunk.type).to.equal('chunk');
            expect(chunk.modules[path.resolve(process.cwd(), './src/chunk.js')]).not.to.be.undefined;
            expect(chunk.imports).to.deep.equal([]);
            expect(chunk.exports).to.deep.equal(['default']);
            expect(chunk.fileName.match(/^chunk-([^-]+).js/g).length).to.equal(1);

            fs.reset();
        });

        it ('should accept optional name for chunk', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/chunk.js', () => 'export default 456');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        this.emitChunk('./src/chunk.js', { name: 'mychunk' });
                    },
                    generateBundle (output, bundle) {
                        expect(Object.keys(bundle).length).to.equal(2);
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output.length).to.equal(2);
        
            let chunk = output.find(o => o.fileName.startsWith('mychunk'));
            expect(chunk.modules[path.resolve(process.cwd(), './src/chunk.js')]).not.to.be.undefined;
            expect(chunk.fileName.match(/^mychunk-([^-]+).js/g).length).to.equal(1);

            fs.reset();
        });

        it ('should return a chunkId', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/chunk.js', () => 'export default 456');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        let id = this.emitChunk('./src/chunk.js', { name: 'mychunk' });
                        expect(typeof id).to.equal('string');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should throw error emitting chunk after build steps', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/chunk.js', () => 'export default 456');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    renderStart () {
                        expect(() => this.emitChunk('./src/chunk.js', { name: 'mychunk' })).to.throw('Cannot emit chunks after module loading has finished.');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });
    });

    describe ('getAssetFileName', () => {
        it ('should accept assetId as a string and return assetFileNames name', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    generateBundle (output, bundle) {
                        let id = this.emitAsset('style.css', 'lol');
                        expect(this.getAssetFileName(id)).to.equal('asset-style.css');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', assetFileNames: 'asset-[name][extname]' });
            fs.reset();
        });

        it ('should not be able to get file name during build step', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code) {
                        let id = this.emitAsset('style.css', 'lol');
                        expect(() => this.getAssetFileName(id)).to.throw();
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', assetFileNames: 'asset-[name][extname]' });
            fs.reset();
        });
    });

    describe ('getChunkFileName', () => {
        it ('should accept chunkId as a string and return chunkFileNames name', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/chunk.js', () => 'export default 456');

            let id;
            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        // This will get called twice. Latest ID should be used.
                        id = this.emitChunk('./src/chunk.js', { name: 'mychunk' });
                    },

                    generateBundle (output, bundle) {
                        expect(this.getChunkFileName(id)).to.equal('lol-mychunk-[hash].js');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', chunkFileNames: 'lol-[name]-[hash].js' });
            fs.reset();
        });
    });

    describe ('setAssetSource', () => {
        it ('should accept assetId and source and override source', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    generateBundle (output, bundle) {
                        let id = this.emitAsset('style.css');
                        this.setAssetSource(id, 'newlol');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', assetFileNames: 'asset-[name][extname]' });
            expect(output[1].source).to.equal('newlol');
            fs.reset();
        });
    });

    describe ('parse', () => {
        it ('should accept code', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code) {
                        let ast = this.parse(code);
                        expect(ast.body[0].type).to.equal('ExportDefaultDeclaration');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', assetFileNames: 'asset-[name][extname]' });
            fs.reset();
        });

        it ('should accept acornOptions');
        it ('should have support for dynamic import', async () => {
            fs.stub('./src/main.js', () => 'import("./lol")');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code) {
                        let ast = this.parse(code);
                        expect(ast.body[0].expression.type).to.equal('ImportExpression');
                        return '';
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', assetFileNames: 'asset-[name][extname]' });
            fs.reset();
        });

        it ('should throw an error if invalid syntax', async () => {
            fs.stub('./src/main.css', () => '.hello { color: blue}')
            fs.stub('./src/main.js', () => 'import "./main.css";');
            let failedError;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        try {
                            this.parse(code);
                        } catch (e) {
                            failedError = e;
                            return '';
                        }
                    }
                }]
            });

            await bundle.generate({ format: 'esm' });

            expect(failedError.name).to.equal('SyntaxError');
            expect(failedError.message).to.equal([
                'Unexpected token (1:0)',
                '    .hello { color: blue}',
                '    ^'
            ].join('\n'));
        });
    })

    describe ('resolveId', () => {
        it ('should accept importee and importer', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            // TODO: Fails in rollup
            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        return new Promise(resolve => { 
                            this.resolveId('./lol', path.resolve(process.cwd(), './src/main.js')).then(resolved => {
                                expect(resolved).to.equal(path.resolve(process.cwd(), './src/lol.js'));
                                resolve();
                            });
                        });
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            fs.reset();
        });
    });

    describe ('warn', () => {
        it ('should output warning message');
    });

    describe ('error', () => {
        it ('should accept a string', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        this.error('my error');
                    }
                }]
            });

            try {
                await bundle.generate({ format: 'esm' });
            } catch (e) {
                expect(e instanceof Error).to.be.true;
                expect(e.message).to.equal('my error');
                passed = true;
            }

            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should accept an error object', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        this.error(new Error('my error'));
                    }
                }]
            });

            try {
                await bundle.generate({ format: 'esm' });
            } catch (e) {
                expect(e instanceof Error).to.be.true;
                expect(e.message).to.equal('my error');
                passed = true;
            }

            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should accept an error-like object', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        this.error({ message: 'my error' });
                    }
                }]
            });

            try {
                await bundle.generate({ format: 'esm' });
            } catch (e) {
                expect(e.message).to.equal('my error');
                passed = true;
            }

            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should support async plugin hook', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    async transform () {
                        this.error('my error');
                    }
                }]
            });

            try {
                await bundle.generate({ format: 'esm' });
            } catch (e) {
                expect(e instanceof Error).to.be.true;
                expect(e.message).to.equal('my error');
                passed = true;
            }

            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should support disconnected async plugin hook', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                this.error('my error');
                            }, 10)
                        });
                    }
                }]
            });

            try {
                await bundle.generate({ format: 'esm' });
            } catch (e) {
                expect(e instanceof Error).to.be.true;
                expect(e.message).to.equal('my error');
                passed = true;
            }

            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should support disconnected async plugin hook (Error object)', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                this.error(new Error('my error'));
                            }, 10)
                        });
                    }
                }]
            });

            try {
                await bundle.generate({ format: 'esm' });
            } catch (e) {
                expect(e instanceof Error).to.be.true;
                expect(e.message).to.equal('my error');
                passed = true;
            }

            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should be able to rebuild after error (sync)', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed, phase = 1;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code) {
                        if (phase === 1) {
                            this.error('my error');
                        }

                        if (phase === 2) {
                            return code;
                        }
                    }
                }]
            });

            try {
                await bundle.generate({ format: 'esm' });
            } catch (e) {
                expect(e.message).to.equal('my error');
                phase++;
                let { output } = await bundle.generate({ format: 'esm' });
                expect(output[0].code.indexOf('123') > -1).to.be.true;
                passed = true;
            }

            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should be able to rebuild after error (async)', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed, phase = 1;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    async transform (code) {
                        if (phase === 1) {
                            this.error('my error');
                        }

                        if (phase === 2) {
                            return code;
                        }
                    }
                }]
            });

            try {
                await bundle.generate({ format: 'esm' });
            } catch (e) {
                expect(e.message).to.equal('my error');
                phase++;
                let { output } = await bundle.generate({ format: 'esm' });
                expect(output[0].code.indexOf('123') > -1).to.be.true;
                passed = true;
            }

            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should be able to rebuild after error (disconnected async)', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed, phase = 1;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    async transform (code) {
                        if (phase === 1) {
                            return new Promise(resolve => {
                                setTimeout(() => {
                                    this.error('my error');
                                }, 10)
                            });
                        }

                        if (phase === 2) {
                            return code;
                        }
                    }
                }]
            });

            try {
                await bundle.generate({ format: 'esm' });
            } catch (e) {
                expect(e.message).to.equal('my error');
                phase++;
                let { output } = await bundle.generate({ format: 'esm' });
                expect(output[0].code.indexOf('123') > -1).to.be.true;
                passed = true;
            }

            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should not trigger twice in a single build in async', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            let passed;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                this.error('my error');

                                setTimeout(() => {
                                    try {
                                        this.error('other error');
                                    } catch (e) {
                                        // should never get here
                                        passed = false;
                                    }
                                }, 10);
                            }, 10)
                        });
                    }
                }]
            });

            try {
                await bundle.generate({ format: 'esm' });
            } catch (e) {
                expect(e instanceof Error).to.be.true;
                expect(e.message).to.equal('my error');
                passed = true;
            }

            await new Promise(resolve => {
                setTimeout(resolve, 1000);
            });

            expect(passed).to.be.true;
            passed = false;

            try {
                await bundle.generate({ format: 'esm' });
            } catch (e) {
                expect(e instanceof Error).to.be.true;
                expect(e.message).to.equal('my error');
                passed = true;
            }

            expect(passed).to.be.true;

            fs.reset();
        });
    });

    describe('emitFile', () => {
        it ('should output asset using default name', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        this.emitFile({
                            type: 'asset',
                            source: 'lol'
                        });
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });

            let asset = output.find(o => o.isAsset);
            expect(asset.source).to.equal('lol');
            expect(asset.fileName).to.equal('assets/asset-[hash]');
            fs.reset();
        });

        it ('should return a reference id for asset', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    generateBundle (output, bundle) {
                        let id = this.emitFile({
                            type: 'asset',
                            source: 'lol'
                        });
                        expect(typeof id).to.equal('string');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            fs.reset();
        });

        it ('should use the specified name with the assetFileName pattern', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    generateBundle (output, bundle) {
                        this.emitFile({
                            type: 'asset',
                            source: 'lol',
                            name: 'myasset'
                        });
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });

            let asset = output.find(o => o.isAsset);
            expect(asset.source).to.equal('lol');
            expect(asset.fileName).to.equal('assets/myasset-[hash]');
            fs.reset();
        });

        it ('should use the specified fileName for assets unmodified', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    generateBundle (output, bundle) {
                        this.emitFile({
                            type: 'asset',
                            source: 'lol',
                            fileName: 'myasset.txt'
                        });
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            let asset = output.find(o => o.isAsset);
            expect(asset.source).to.equal('lol');
            expect(asset.fileName).to.equal('myasset.txt');
            fs.reset();
        });

        it ('should accept buffer for asset source', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        this.emitFile({
                            type: 'asset',
                            source: Buffer.from('lol')
                        });
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            let asset = output.find(o => o.isAsset);
            expect(asset.source[0]).to.equal(108);
            fs.reset();
        });

        it ('should output type of chunk starting with the specified module id', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/chunk.js', () => 'export default 456');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        this.emitFile({
                            type: 'chunk',
                            id: './src/chunk.js'
                        });
                    },
                    generateBundle (output, bundle) {
                        expect(Object.keys(bundle).length).to.equal(2);
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output.length).to.equal(2);
        
            let chunk = output.find(o => o.fileName.startsWith('chunk'));
            expect(chunk.fileName.match(/^chunk-([^-]+).js/g).length).to.equal(1);

            fs.reset();
        });

        it ('should output chunk using name', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/chunk.js', () => 'export default 456');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        this.emitFile({
                            type: 'chunk',
                            id: './src/chunk.js',
                            name: 'mychunk'
                        });
                    },
                    generateBundle (output, bundle) {
                        expect(Object.keys(bundle).length).to.equal(2);
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output.length).to.equal(2);
        
            let chunk = output.find(o => o.fileName.startsWith('mychunk'));
            expect(chunk.fileName.match(/^mychunk-([^-]+).js/g).length).to.equal(1);

            fs.reset();
        });

        it ('should output chunk using fileName', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/chunk.js', () => 'export default 456');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        this.emitFile({
                            type: 'chunk',
                            id: './src/chunk.js',
                            fileName: 'lol.js'
                        });
                    },
                    generateBundle (output, bundle) {
                        expect(Object.keys(bundle).length).to.equal(2);
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output.length).to.equal(2);
        
            let chunk = output.find(o => o.fileName.startsWith('lol'));
            expect(chunk.fileName.match(/^lol.js/g).length).to.equal(1);

            fs.reset();
        });

        it ('should throw error emitting chunk after build steps', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/chunk.js', () => 'export default 456');
            let passed = false;

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    renderStart () {
                        expect(() => this.emitFile({
                            type: 'chunk',
                            id: './src/chunk.js'
                        })).to.throw('Cannot emit chunks after module loading has finished.');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });
    });

    describe ('getFileName', () => {
        it ('should return asset file name (default)', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    generateBundle (output, bundle) {
                        let id = this.emitFile({
                            type: 'asset',
                            source: 'lol'
                        });
                        expect(this.getFileName(id)).to.equal('assets/asset-[hash]');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            fs.reset();
        });

        it ('should return asset file name (name)', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    generateBundle (output, bundle) {
                        let id = this.emitFile({
                            name: 'style.css',
                            source: 'lol'
                        });
                        expect(this.getFileName(id)).to.equal('asset-style.css');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', assetFileNames: 'asset-[name][extname]' });
            fs.reset();
        });

        it ('should return asset file name (fileName)', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    generateBundle (output, bundle) {
                        let id = this.emitFile({
                            fileName: 'style.css',
                            source: 'lol'
                        });
                        expect(this.getFileName(id)).to.equal('style.css');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', assetFileNames: 'asset-[name][extname]' });
            fs.reset();
        });

        it ('should return chunk file name (default)', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/lol.js', () => 'export default 456');

            let id, passed;
            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (output, bundle) {
                        id = this.emitFile({
                            type: 'chunk',
                            id: './src/lol.js'
                        });
                    },

                    generateBundle () {
                        expect(this.getFileName(id)).to.equal('chunk-[hash].js');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should return chunk file name (name)', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/lol.js', () => 'export default 456');

            let id, passed;
            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (output, bundle) {
                        id = this.emitFile({
                            type: 'chunk',
                            name: 'extra',
                            id: './src/lol.js'
                        });
                    },

                    generateBundle () {
                        expect(this.getFileName(id)).to.equal('extra-[hash].js');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should return chunk file name (fileName)', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/lol.js', () => 'export default 456');

            let id, passed;
            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (output, bundle) {
                        id = this.emitFile({
                            id: './src/lol.js',
                            fileName: 'vendor.js'
                        });
                    },

                    generateBundle () {
                        expect(this.getFileName(id)).to.equal('vendor.js');
                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });
    });

    describe ('meta', () => {
        it ('should have rollupVersion', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        expect(this.meta.rollupVersion).to.equal('2.0');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            fs.reset();
        });
    });

    describe ('addWatchFile', () => {
        it ('should allow relative paths', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/other.js', () => 'export default 456');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        this.addWatchFile('./other.js');
                    }
                }]
            });

            await bundle.generate({ format: 'esm' });
            fs.stub('./src/main.js', () => 'export default 321');
            bundle.invalidate('src/other.js');

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf('321') > -1).to.be.true;
            fs.reset();
        });

        it ('should allow absolute paths', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/other.js', () => 'export default 456');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        this.addWatchFile(path.resolve(process.cwd(), './src/other.js'));
                    }
                }]
            });

            await bundle.generate({ format: 'esm' });
            fs.stub('./src/main.js', () => 'export default 321');
            bundle.invalidate('src/other.js');

            let { output } = await bundle.generate({ format: 'esm' });
            expect(output[0].code.indexOf('321') > -1).to.be.true;
            fs.reset();
        });
    });

    describe ('import.meta.ROLLUP', () => {
        it ('should convert ROLLUP_FILE_URL to string', async () => {
            fs.stub('./src/main.js', () => `
                import logo from './logo.svg';
                export default logo;
            `);

            let refId;
            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    load(id) {
                        if (id.endsWith('.svg')) {
                            refId = this.emitFile({
                                type: 'asset',
                                name: 'logo.svg',
                                source: '<svg></svg>'
                            });
                            return `export default import.meta.ROLLUP_FILE_URL_${refId};`;
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', assetFileNames: 'asset-[name][extname]' });
            let main = output.find(o => o.fileName === 'main.js');
            expect(eval(main.code.replace('export default ', ''))).to.equal('asset-logo.svg');
            fs.reset();
        });

        it ('should convert ROLLUP_ASSET_URL to string', async () => {
            fs.stub('./src/main.js', () => `
                import logo from './logo.svg';
                export default logo;
            `);

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    load(id) {
                        if (id.endsWith('.svg')) {
                            let id = this.emitAsset('logo-logo.svg', '<svg></svg>');
                            return `export default import.meta.ROLLUP_ASSET_URL_${id};`;
                        }
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm', assetFileNames: 'assets/[name][hash][extname]' });
            let main = output.find(o => o.fileName === 'main.js');
            expect(eval(main.code.replace('export default ', ''))).to.equal('assets/logo-logo[hash].svg');
            fs.reset();
        });

        it ('should convert ROLLUP_CHUNK_URL to string');
    });

    describe ('resolve', () => {
        it ('should return a promise', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        const result = this.resolve('./foo', '/bar')
                        expect(result).to.be.an.instanceof(Promise)
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            fs.reset();
        })

        it ('should resolve imports to module ids', async function () {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/lol.js', () => 'export default 456');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        return new Promise(resolve => { 
                            this.resolve('./lol', path.resolve(process.cwd(), './src/main.js')).then(resolved => {
                                expect(resolved.id).to.equal(path.resolve(process.cwd(), './src/lol.js'));
                                expect(resolved.external).to.be.false;
                                resolve();
                            });
                        });
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            fs.reset();
        });

        it ('should be marked as external if it is external', async function () {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/lol.js', () => 'export default 456');

            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery'],
                plugins: [{
                    transform () {
                        return new Promise(resolve => { 
                            this.resolve('jquery', path.resolve(process.cwd(), './src/main.js')).then(resolved => {
                                expect(resolved.id).to.equal('jquery');
                                expect(resolved.external).to.be.true;
                                resolve();
                            });
                        });
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            fs.reset();
        });

        it ('should be marked as external if plugin resolveId returns false', async function () {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/lol.js', () => 'export default 456');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveId (id) {
                        if (id === 'jquery') {
                            return false;
                        }

                        return id;
                    },
                    transform () {
                        return new Promise(resolve => { 
                            this.resolve('jquery', path.resolve(process.cwd(), './src/main.js')).then(resolved => {
                                expect(resolved.id).to.equal('jquery');
                                expect(resolved.external).to.be.true;
                                resolve();
                            });
                        });
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            fs.reset();
        });

        it ('should be marked as external if plugin resolveId returns false in object', async function () {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/lol.js', () => 'export default 456');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveId (id) {
                        if (id === 'jquery') {
                            return {
                                id,
                                external: true
                            }
                        }

                        return id;
                    },
                    transform () {
                        return new Promise(resolve => { 
                            this.resolve('jquery', path.resolve(process.cwd(), './src/main.js')).then(resolved => {
                                expect(resolved.id).to.equal('jquery');
                                expect(resolved.external).to.be.true;
                                resolve();
                            });
                        });
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            fs.reset();
        });

        it ('should allow skipSelf in options to ignore the resolveId hook of the same plugin which called this function', async function () {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/lol.js', () => 'export default 456');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    resolveId (id) {
                        if (id === 'jquery') {
                            throw new Error('Should not reach here');
                        }
                    },
                    transform () {
                        return new Promise(resolve => { 
                            this.resolve('jquery', path.resolve(process.cwd(), './src/main.js'), { skipSelf: true }).then(resolved => {
                                resolve();
                            });
                        });
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            fs.reset();
        });

        it ('should return null if module cannot be resolved by anyone and isn\'t external');

    });

    describe ('getCombinedSourcemap', () => {
        it ('should provide source map of all previous plugins so far', async function () {
            fs.stub('./src/main.js', () => 'array.forEach(i => console.log(i));\nvar { a, b } = getItem();\nconsole.log(a,b);');

            let passed = false;
            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        let s = new MagicString(code);
                        s.overwrite(0, 36, `for (var i = 0; i < array.length; i++) {\nconsole.log(array[i]);\n}\n`);
                        return {
                            code: s.toString(),
                            map: s.generateMap({
                                hires: true,
                                source: id
                            })
                        }
                    }
                }, {
                    transform (code, id) {
                        let s = new MagicString(code);
                        s.overwrite(66, 91, `var tmp = getItem();\nvar a = tmp.a;\nvar b = tmp.b;`)
                        return {
                            code: s.toString(),
                            map: s.generateMap({
                                hires: true,
                                source: id
                            })
                        }
                    }
                }, {
                    transform (code) {
                        let { SourceMapConsumer } = require('source-map');
                        let sourcemap = this.getCombinedSourcemap();
                        let consumer = new SourceMapConsumer(sourcemap);
                        
                        expect(consumer.generatedPositionFor({
                            source: sourcemap.sources[0],
                            line: 1,
                            column: 0
                        })).to.deep.equal({ 
                            line: 1, 
                            column: 0, 
                            lastColumn: null 
                        });

                        expect(consumer.generatedPositionFor({
                            source: sourcemap.sources[0],
                            line: 2,
                            column: 0
                        })).to.deep.equal({ 
                            line: 4, 
                            column: 0, 
                            lastColumn: null 
                        });

                        expect(consumer.generatedPositionFor({
                            source: sourcemap.sources[0],
                            line: 3,
                            column: 0
                        })).to.deep.equal({ 
                            line: 7, 
                            column: 0, 
                            lastColumn: null 
                        });

                        passed = true;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });

        it ('should only be usable in transform hook', async function () {
            fs.stub('./src/main.js', () => 'array.forEach(i => console.log(i));\nvar { a, b } = getItem();\nconsole.log(a,b);');

            let passed = false;
            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    load (id) {
                        try {
                            this.getCombinedSourcemap();
                        } catch (e) {
                            expect(e.message.indexOf('transform hook') > -1).to.be.true;
                            passed = true;
                        }

                        return null;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(passed).to.be.true;
            fs.reset();
        });
    })

    describe ('moduleIds', () => {
        it ('should be an iteratable support "for of", listing all module ids in graph', async function () {
            fs.stub('./src/main.js', () => 'import "./lol"; import "./rofl";');
            fs.stub('./src/lol.js', () => 'export default 123');
            fs.stub('./src/rofl.js', () => 'export default 456');

            let ids;
            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        ids = this.moduleIds;
                        return null;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(ids.next).not.to.be.undefined;
            ids = Array.from(ids);
            expect(ids[0]).to.equal(path.resolve(process.cwd(), './src/main.js'));
            expect(ids[1]).to.equal(path.resolve(process.cwd(), './src/lol.js'));
            expect(ids[2]).to.equal(path.resolve(process.cwd(), './src/rofl.js'));
            fs.reset();
        });

        it ('should contain all moduleIds in bundle regardless of chunk', async () => {
            fs.stub('./src/main.js', () => 'import "./lol"; import("./rofl");');
            fs.stub('./src/lol.js', () => 'export default 123');
            fs.stub('./src/rofl.js', () => 'export default 456');

            let mainIds, chunkIds;
            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (code, id) {
                        if (id.indexOf('rofl') === -1) {
                            mainIds = this.moduleIds;
                        } else {
                            chunkIds = this.moduleIds;
                        }
                        return null;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(mainIds.next).not.to.be.undefined;
            mainIds = Array.from(mainIds);
            expect(mainIds.length).to.equal(3);
            expect(mainIds[0]).to.equal(path.resolve(process.cwd(), './src/main.js'));
            expect(mainIds[1]).to.equal(path.resolve(process.cwd(), './src/lol.js'));
            expect(mainIds[2]).to.equal(path.resolve(process.cwd(), './src/rofl.js'));

            chunkIds = Array.from(chunkIds);
            expect(chunkIds.length).to.equal(3);
            expect(chunkIds[0]).to.equal(path.resolve(process.cwd(), './src/main.js'));
            expect(chunkIds[1]).to.equal(path.resolve(process.cwd(), './src/lol.js'));
            expect(chunkIds[2]).to.equal(path.resolve(process.cwd(), './src/rofl.js'));
            fs.reset();
        });
    })

    describe ('getModuleIds', () => {
        it ('should be an iteratable support "for of", listing all module ids in graph', async function () {
            fs.stub('./src/main.js', () => 'import "./lol"; import "./rofl";');
            fs.stub('./src/lol.js', () => 'export default 123');
            fs.stub('./src/rofl.js', () => 'export default 456');

            let ids;
            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform () {
                        ids = this.getModuleIds();
                        return null;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            expect(ids.next).not.to.be.undefined;
            ids = Array.from(ids);
            expect(ids[0]).to.equal(path.resolve(process.cwd(), './src/main.js'));
            expect(ids[1]).to.equal(path.resolve(process.cwd(), './src/lol.js'));
            expect(ids[2]).to.equal(path.resolve(process.cwd(), './src/rofl.js'));
            fs.reset();
        });
    });


    describe ('getModuleInfo', () => {
        it ('should provide information about module using the provided module id', async function () {
            let mainCode = 'import "jquery"; import "underscore"; import "./lol"; import("backbone"); import("./rofl");';
            let lolCode = 'export default 123';
            let roflCode = 'export default 456'
            fs.stub('./src/main.js', () => mainCode);
            fs.stub('./src/lol.js', () => lolCode);
            fs.stub('./src/rofl.js', () => roflCode);
            
            let fn;
            let bundle = await nollup({
                input: './src/main.js',
                external: ['jquery'],
                plugins: [{
                    resolveId (id) {
                        if (id === 'underscore' || id === 'backbone') {
                            return { 
                                id, external: true
                            }
                        }
                    },

                    transform (code, id) {
                        fn = id => this.getModuleInfo(id);
                        return 'console.log(123);' + code;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });

            // local module
            let local_info = fn(path.resolve(process.cwd(), './src/main.js'));
            expect(local_info.id).to.equal(path.resolve(process.cwd(), './src/main.js'));
            expect(local_info.code.indexOf('console.log(123);') > -1).to.be.true;
            expect(local_info.isEntry).to.be.true;
            expect(local_info.isExternal).to.be.false;
            expect(local_info.importedIds).to.deep.equal(['jquery', 'underscore', path.resolve(process.cwd(), './src/lol.js')])
            expect(local_info.meta).to.deep.equal({});

            let local_info_dep = fn(path.resolve(process.cwd(), './src/lol.js'));
            expect(local_info_dep.id).to.equal(path.resolve(process.cwd(), './src/lol.js'));
            expect(local_info_dep.code.indexOf('console.log(123);') > -1).to.be.true;
            expect(local_info_dep.isEntry).to.be.false;
            expect(local_info_dep.isExternal).to.be.false;
            expect(local_info_dep.importedIds).to.deep.equal([]);
            expect(local_info_dep.meta).to.deep.equal({});

            let external_info = fn('jquery');
            expect(external_info.id).to.equal('jquery');
            expect(external_info.code).to.equal(null);
            expect(external_info.isEntry).to.be.false;
            expect(external_info.isExternal).to.be.true;
            expect(external_info.importedIds).to.deep.equal([]);
            expect(external_info.meta).to.deep.equal({});

            let external_resolve_info = fn('underscore');
            expect(external_resolve_info.id).to.equal('underscore');
            expect(external_resolve_info.code).to.equal(null);
            expect(external_resolve_info.isEntry).to.be.false;
            expect(external_resolve_info.isExternal).to.be.true;
            expect(external_resolve_info.importedIds).to.deep.equal([]);
            expect(external_resolve_info.meta).to.deep.equal({});

            let dynamic_external_resolve_info = fn('backbone');
            expect(dynamic_external_resolve_info.id).to.equal('backbone');
            expect(dynamic_external_resolve_info.code).to.equal(null);
            expect(dynamic_external_resolve_info.isEntry).to.be.false;
            expect(dynamic_external_resolve_info.isExternal).to.be.true;
            expect(dynamic_external_resolve_info.importedIds).to.deep.equal([]);
            expect(dynamic_external_resolve_info.meta).to.deep.equal({});

            let dynamic_import_info = fn(path.resolve(process.cwd(), './src/rofl.js'));
            expect(dynamic_import_info.id).to.equal(path.resolve(process.cwd(), './src/rofl.js'));
            expect(dynamic_import_info.code.indexOf('console.log(123);') > -1).to.be.true;
            expect(dynamic_import_info.isEntry).to.be.false;
            expect(dynamic_import_info.isExternal).to.be.false;
            expect(dynamic_import_info.importedIds).to.deep.equal([]);
            expect(dynamic_import_info.meta).to.deep.equal({});

            fs.reset();
        });
    });

    

   

});
