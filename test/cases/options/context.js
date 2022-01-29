let { nollup, fs, rollup, expect } = require('../../nollup');
let Evaluator = require('../../utils/evaluator');

describe ('Options: context', () => {
    it ('should have default value for this keyword in modules', async () => {
        fs.stub('./src/main.js', () => 'var value = this; export default \'\' + value;');

        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({
            file: 'output.js',
            format: 'esm'
        });

        let { exports } = await Evaluator.init('esm', 'output.js', output);
        expect(exports.default).to.equal('undefined');
        fs.reset();
    });

    it ('should have default value for this keyword when exported as default export directly', async () => {
        fs.stub('./src/main.js', () => 'export default \'\' + this;');
        
        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({
            file: 'output.js',
            format: 'esm'
        });

        let { exports } = await Evaluator.init('esm', 'output.js', output);
        expect(exports.default).to.equal('undefined');
        fs.reset();
    });

    it ('should allow to override the value of this keyword using context option', async () => {
        fs.stub('./src/main.js', () => 'export default this;');
        
        let bundle = await nollup({
            input: './src/main.js',
            context: '{hello: "world"}'
        });

        let { output } = await bundle.generate({
            file: 'output.js',
            format: 'esm'
        });

        let { exports } = await Evaluator.init('esm', 'output.js', output);
        expect(exports.default.hello).to.equal('world');
        fs.reset();
    });

    it ('should allow to override the value of this keyword using context option - scenario 2', async () => {
        fs.stub('./src/main.js', () => 'export default (this).toString();');
        
        let bundle = await nollup({
            input: './src/main.js',
            context: 'Promise'
        });

        let { output } = await bundle.generate({
            file: 'output.js',
            format: 'esm'
        });

        let { exports } = await Evaluator.init('esm', 'output.js', output);
        expect(exports.default).to.equal('function Promise() { [native code] }');
        fs.reset();
    });
});