let { nollup, fs, expect, rollup } = require('../../nollup');
let path = require('path');

describe ('Options: Input', () => {
    it ('should throw error if not defined', async () => {
        let passed = false;

        try {
            await nollup({});
            passed = true;
        } catch (e) {
            expect(e.message).to.equal('Input option not defined');
        }

        expect(passed).to.be.false;
    })

    it ('should accept single input entry with filename as entry name', async () => {
        fs.stub('./src/main.js', () => 'export default 123');
        
        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({
            format: 'esm'
        });

        expect(output[0].fileName).to.equal('main.js');
        expect(output[0].isEntry).to.be.true;

        fs.reset();
    });

    it ('should accept object as input with key as entry name', async () => {
        fs.stub('./src/main1.js', () => 'export default 123');
        fs.stub('./src/main2.js', () => 'export default 456');
        
        let bundle = await nollup({
            input: {
                a: './src/main1.js',
                b: './src/main2.js'
            }
        });

        let { output } = await bundle.generate({
            format: 'esm'
        });

        let file_a = output.find(o => o.fileName === 'a.js');
        expect(file_a.fileName).to.equal('a.js');
        expect(file_a.isEntry).to.be.true;

        let file_b = output.find(o => o.fileName === 'b.js');
        expect(file_b.fileName).to.equal('b.js');
        expect(file_b.isEntry).to.be.true;

        fs.reset();
    });

    it ('should support an array of inputs with filename as entry name', async () => {
        fs.stub('./src/main1.js', () => 'export default 123');
        fs.stub('./src/main2.js', () => 'export default 456');
        
        let bundle = await nollup({
            input: ['./src/main1.js', './src/main2.js']
        });

        let { output } = await bundle.generate({
            format: 'esm'
        });

        let main1 = output.find(o => o.fileName === 'main1.js');
        expect(main1.fileName).to.equal('main1.js');
        expect(main1.isEntry).to.be.true;

        let main2 = output.find(o => o.fileName === 'main2.js');
        expect(main2.fileName).to.equal('main2.js');
        expect(main2.isEntry).to.be.true;

        fs.reset();
    })
});