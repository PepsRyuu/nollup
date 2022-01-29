let { nollup, fs, rollup, expect } = require('../../nollup');

describe ('Options: output.file', () => {
    it ('should allow output.file to be defined', async () => {
        fs.stub('./src/main.js', () => 'export default 123');
        
        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({
            file: 'output.js',
            format: 'esm'
        });

        expect(output[0].fileName).to.equal('output.js');
        expect(output[0].isEntry).to.be.true;

        fs.reset();
    });

    it ('should strip out directory from file as per Rollup API', async () => {
        fs.stub('./src/main.js', () => 'export default 123');
        
        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({
            file: 'dist/output.js',
            format: 'esm'
        });

        expect(output[0].fileName).to.equal('output.js');
        expect(output[0].isEntry).to.be.true;

        fs.reset();
    });


    it ('should throw error if multiple entries are defined');
});