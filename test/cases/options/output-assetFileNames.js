let { nollup, fs, expect, rollup } = require('../../nollup');

describe ('Options: output.assetFileNames', () => {
    let bundle;

    beforeEach(async () => {
        fs.stub('./src/main.js', () => 'import "./style.css"; export default 123');
        fs.stub('./src/style.css', () => '*{color: blue}');

        bundle = await nollup({
            input: './src/main.js',
            plugins: [{
                transform (code, id) {
                    if (id.endsWith('.css')) {
                        this.emitAsset('style.css', code)
                        return '';
                    }
                }
            }]
        });
    })

    afterEach(() => {
        fs.reset();
    });

    it ('should default to assets/[name]-[hash][extname]', async () => {
        let { output } = await bundle.generate({ 
            format: 'esm'
        });

        let file = output.find(o => o.fileName.indexOf('style') > -1);
        expect(/assets\/style-(.*?)\.css/.test(file.fileName)).to.be.true;
    });

    it ('should support [ext]', async () => {
        let { output } = await bundle.generate({ 
            format: 'esm',
            assetFileNames: 'custom/[name].[ext]'
        });

        let file = output.find(o => o.fileName.indexOf('style') > -1);
        expect(/custom\/style\.css/.test(file.fileName)).to.be.true;
    });

    it ('assets emitted during generateBuild have proper hashed name', async () => {
            fs.stub('./src/main.js', () => 'export default 123');

            let bundle = await nollup({
                input: './src/main.js',
                plugins: [{
                    generateBundle (output, bundle) {
                        this.emitAsset('style.css', 'lol');
                    }
                }]
            });

            let { output } = await bundle.generate({ 
                format: 'esm',
                assetFileNames: 'assets/[name]-hello[extname]' 
            });

            expect(output.length).to.equal(2);
            expect(output[1].fileName).to.equal('assets/style-hello.css');

            fs.reset();
        });
});