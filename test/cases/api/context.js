let { nollup, fs, expect, rollup } = require('../../nollup');
let path = require('path');

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
    });

});