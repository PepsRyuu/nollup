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

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    generateBundle (output, bundle) {
                        let id = this.emitChunk('./src/chunk.js', { name: 'mychunk' });
                        expect(typeof id).to.equal('string');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
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
    });

    describe ('getChunkFileName', () => {
        it ('should accept chunkId as a string and return chunkFileNames name', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/chunk.js', () => 'export default 456');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    generateBundle (output, bundle) {
                        let id = this.emitChunk('./src/chunk.js', { name: 'mychunk' });
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
        })
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
        it ('should accept a string or Error object');
        it ('should abort the build');
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

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (output, bundle) {
                        let id = this.emitFile({
                            type: 'chunk',
                            id: './src/lol.js'
                        });
                        expect(this.getFileName(id)).to.equal('chunk-[hash].js');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            fs.reset();
        });

        it ('should return chunk file name (name)', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/lol.js', () => 'export default 456');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (output, bundle) {
                        let id = this.emitFile({
                            type: 'chunk',
                            name: 'extra',
                            id: './src/lol.js'
                        });
                        expect(this.getFileName(id)).to.equal('extra-[hash].js');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
            fs.reset();
        });

        it ('should return chunk file name (fileName)', async () => {
            fs.stub('./src/main.js', () => 'export default 123');
            fs.stub('./src/lol.js', () => 'export default 456');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    transform (output, bundle) {
                        let id = this.emitFile({
                            id: './src/lol.js',
                            fileName: 'vendor.js'
                        });
                        expect(this.getFileName(id)).to.equal('vendor.js');
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });
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

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    load(id) {
                        if (id.endsWith('.svg')) {
                            let id = this.emitFile({
                                type: 'asset',
                                name: 'logo.svg',
                                source: '<svg></svg>'
                            });
                            return `export default import.meta.ROLLUP_FILE_URL_${id};`;
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

        it ('should be marked as external if it is external asdasdasdasdasdas', async function () {
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
    })

    describe ('getModuleInfo', () => {
        it ('should provide information about module using the provided module id', async function () {
            fs.stub('./src/main.js', () => 'import "jquery"; import "underscore"; import "./lol"; import("backbone"); import("./rofl");');
            fs.stub('./src/lol.js', () => 'export default 123');
            fs.stub('./src/rofl.js', () => 'export default 456');
            
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
                        return null;
                    }
                }]
            });

            let { output } = await bundle.generate({ format: 'esm' });

            // local module
            let local_info = fn(path.resolve(process.cwd(), './src/main.js'));
            expect(local_info).to.deep.equal({
                id: path.resolve(process.cwd(), './src/main.js'),
                isEntry: true,
                isExternal: false,
                importedIds: ['jquery', 'underscore', path.resolve(process.cwd(), './src/lol.js')],
                // hasModuleSideEffects: true
            });

            let local_info_dep = fn(path.resolve(process.cwd(), './src/lol.js'));
            expect(local_info_dep).to.deep.equal({
                id: path.resolve(process.cwd(), './src/lol.js'),
                isEntry: false,
                isExternal: false,
                importedIds: [],
                // hasModuleSideEffects: true
            });

            let external_info = fn('jquery');
            expect(external_info).to.deep.equal({
                id: 'jquery',
                isEntry: false,
                isExternal: true,
                importedIds: [],
                // hasModuleSideEffects: true
            });

            let external_resolve_info = fn('underscore');
            expect(external_resolve_info).to.deep.equal({
                id: 'underscore',
                isEntry: false,
                isExternal: true,
                importedIds: [],
                // hasModuleSideEffects: true
            });

            let dynamic_external_resolve_info = fn('backbone');
            expect(dynamic_external_resolve_info).to.deep.equal({
                id: 'backbone',
                isEntry: false,
                isExternal: true,
                importedIds: [],
                // hasModuleSideEffects: true
            });


            let dynamic_import_info = fn(path.resolve(process.cwd(), './src/rofl.js'));
            expect(dynamic_import_info).to.deep.equal({
                id: path.resolve(process.cwd(), './src/rofl.js'),
                isEntry: false,
                isExternal: false,
                importedIds: [],
                // hasModuleSideEffects: true
            });

            fs.reset();
        })
    });

    

   

});
