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

        expect(/assets\/style-(.*?)\.css/.test(output[1].fileName)).to.be.true;
    });

    it ('should support [ext]', async () => {
        let { output } = await bundle.generate({ 
            format: 'esm',
            assetFileNames: 'custom/[name].[ext]'
        });

        expect(/custom\/style\.css/.test(output[1].fileName)).to.be.true;
    });
});