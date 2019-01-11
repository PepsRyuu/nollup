let { nollup, fs, expect, rollup } = require('../../nollup');

describe ('Options: output.chunkFileNames', () => {
    let bundle;

    beforeEach(async () => {
        fs.stub('./src/main.js', () => 'import("./dynamic.js"); export default 123');
        fs.stub('./src/dynamic.js', () => 'export default 456');
        
        bundle = await nollup({
            input: './src/main.js'
        });
    });

    afterEach(() => {
        fs.reset();
    });

    it ('should default to chunk-[hash].js', async () => {
        let { output } = await bundle.generate({
            format: 'esm'
        });

        expect(output[0].fileName).to.equal('main.js');
        expect(/^chunk\-(.*?).js$/.test(output[1].fileName)).to.be.true;
    });

    it ('should allow to be overrided', async () => {
        let { output } = await bundle.generate({
            format: 'esm',
            chunkFileNames: 'lol-[format].js'
        });

        expect(output[0].fileName).to.equal('main.js');
        expect(/^lol\-esm.js$/.test(output[1].fileName)).to.be.true;
    });

    it ('should be used as the import name', async () => {
        let { output } = await bundle.generate({
            format: 'esm',
            chunkFileNames: 'lol-[format].js'
        });

        expect(output[0].code.indexOf('require.dynamic(\\\'./lol-esm.js\\\')') > -1).to.be.true;
    });
});