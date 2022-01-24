let { nollup, fs, expect, rollup } = require('../nollup');

describe ('Misc', () => {
    it ('should not add any private properties to plugins', async () => {
        fs.stub('./src/main.js', () => 'console.log("hello");');

        let myplugin = {
            transform: (code) => {
                return code.replace('hello', 'world');
            }
        };

        let bundle = await nollup({
            input: './src/main.js',
            plugins: [myplugin]
        });

        let { output } = await bundle.generate({ format: 'esm' });
        expect(output[0].code.indexOf('hello')).to.equal(-1);
        expect(output[0].code.indexOf('world') > -1).to.be.true;
        expect(Object.keys(myplugin).length).to.equal(1);
    });
});