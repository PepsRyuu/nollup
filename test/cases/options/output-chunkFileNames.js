let { nollup, fs, expect, rollup } = require('../../nollup');
let path = require('path');

describe ('Options: output.chunkFileNames', () => {
    let bundle;

    beforeEach(async function () {
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

        expect(output.length).to.equal(2);
        expect(output.find(o => o.fileName === 'main.js').fileName).not.to.be.undefined;
        expect(output.find(o => o.fileName.match(/^dynamic\-(.*?).js$/) !== null)).not.to.be.undefined;
    });

    it ('should allow to be overrided', async () => {
        let { output } = await bundle.generate({
            format: 'esm',
            chunkFileNames: 'lol-[format].js'
        });

        expect(output.length).to.equal(2);
        expect(output.find(o => o.fileName === 'main.js').fileName).not.to.be.undefined;
        expect(output.find(o => o.fileName.match(/^lol\-esm.js$/) !== null)).not.to.be.undefined;
    });

    it ('should be used as the import name', async () => {
        let { output } = await bundle.generate({
            format: 'esm',
            chunkFileNames: 'lol-[format].js'
        });

        let file = output.find(o => o.fileName === 'main.js');
        let importId = path.resolve(process.cwd(), './src/dynamic.js');
        expect(file.code.indexOf(`require.dynamic(\\'lol-esm.js`) > -1).to.be.true;
    });

    it ('should use "esm" as format for "es" output', async () => {
        let { output } = await bundle.generate({
            format: 'es',
            chunkFileNames: 'lol-[format].js'
        });

        expect(output.length).to.equal(2);
        expect(output.find(o => o.fileName === 'main.js').fileName).not.to.be.undefined;
        expect(output.find(o => o.fileName.match(/^lol-esm.js$/) !== null)).not.to.be.undefined;
    });
});