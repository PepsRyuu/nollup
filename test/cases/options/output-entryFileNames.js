let { nollup, fs, expect, rollup } = require('../../nollup');

describe ('Options: output.entryFileNames', () => {
    it ('should default to [name].js', async () => {
        fs.stub('./src/main.js', () => 'export default 123');
        
        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({
            format: 'esm'
        });

        expect(output[0].fileName).to.equal('main.js');
        fs.reset();
    });

    it ('should allow static characters in name', async () => {
        fs.stub('./src/main.js', () => 'export default 123');
        
        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({
            entryFileNames: 'entry-[name].js',
            format: 'esm'
        });

        expect(output[0].fileName).to.equal('entry-main.js');
        fs.reset();
    });

    it ('should be allowed in subdirectories', async () => {
        fs.stub('./src/main.js', () => 'export default 123');
        
        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({
            entryFileNames: 'entries/entry-[name].js',
            format: 'esm'
        });

        expect(output[0].fileName).to.equal('entries/entry-main.js');
        fs.reset();
    });

    it ('should allow [format]', async () => {
        fs.stub('./src/main.js', () => 'export default 123');
        
        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({
            entryFileNames: '[name].[format].js',
            format: 'esm'
        });

        expect(output[0].fileName).to.equal('main.esm.js');
        fs.reset();
    });

    it ('should allow [hash]', async () => {
        fs.stub('./src/main.js', () => 'export default 123');
        
        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({
            entryFileNames: '[name].[hash].js',
            format: 'esm'
        });

        expect(output[0].fileName).to.equal('main._hash_.js');
        fs.reset();
    })
});