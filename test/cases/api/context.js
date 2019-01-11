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
                        expect(ast.body[0].expression.callee.type).to.equal('Import');
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
    })
});