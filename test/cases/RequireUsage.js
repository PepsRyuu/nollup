let { nollup, fs, expect, rollup } = require('../nollup');
let Evaluator = require('../utils/evaluator');

describe('Require Usage', () => {
    it ('should not throw error if using require with string in CJS format', async () => {
        fs.stub('./src/main.js', () => 'module.exports = require("path").resolve.toString()');

        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({ format: 'cjs' });
        let { exports } = await Evaluator.init('cjs', 'main.js', output);
        expect(exports).not.to.be.undefined;
        fs.reset();
    });

    it ('should throw error if using require with string in CJS format and it doesn\'t exist', async () => {
        fs.stub('./src/main.js', () => 'require("fake")');

        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({ format: 'cjs' });
        let passed;

        try {
            await Evaluator.init('cjs', 'main.js', output);
            passed = false;
        } catch (e) {
            passed = true;
            expect(e.indexOf('Cannot find module') > -1).to.be.true;
        } finally {
            fs.reset();
            expect(passed).to.be.true;
        }
    });

    it ('should throw error if using require with string in non-CJS format', async () => {
        fs.stub('./src/main.js', () => 'require("hello")');

        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({ format: 'esm' });

        let passed;
        try {
            await Evaluator.init('esm', 'main.js', output);
            passed = false;
        } catch (e) {
            passed = true;
            expect(e.indexOf('Module not found: hello') > -1).to.be.true;
        } finally {
            fs.reset();
            expect(passed).to.be.true;
        }
    });

    it ('should not throw error if using require on bundled id', async () => {
        fs.stub('./src/main.js', () => 'if (executed === false) {executed = true; require(0); }');

        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({ format: 'esm' });
        let passed;

        try {
            let { globals } = await Evaluator.init('esm', 'main.js', output, { executed: false });
            expect(globals.executed).to.be.true;
            passed = true;
        } catch (e) {
            passed = false;
        } finally {
            fs.reset();
            expect(passed).to.be.true;
        }
    });

    it ('should not throw error if using require on bundled id in CJS format', async () => {
        let executed = false;
        fs.stub('./src/main.js', () => 'if (executed === false) {executed = true; require(0); }');

        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({ format: 'cjs' });
        let passed;

        try {
            let { globals } = await Evaluator.init('cjs', 'main.js', output, { executed: false });
            passed = true;
            expect(globals.executed).to.be.true;
        } catch (e) {
            passed = false;
        } finally {
            fs.reset();
            expect(passed).to.be.true;
        }
    });

    it ('should throw error if using require and passing unrecognised id', async () => {
        fs.stub('./src/main.js', () => 'require(1)');

        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({ format: 'esm' });
        let passed;
        try {
            await Evaluator.init('esm', 'main.js', output);
        } catch (e) {
            passed = true;
            expect(e.indexOf('Module not found: 1') > -1).to.be.true;
        } finally {
            fs.reset();
            expect(passed).to.be.true;
        }
    });

    it ('should throw error if using require and passing unrecognised id in CJS format', async () => {
        fs.stub('./src/main.js', () => 'require(1)');

        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({ format: 'cjs' });
        let passed;

        try {
            await Evaluator.init('cjs', 'main.js', output);
        } catch (e) {
            passed = true;
            expect(e.indexOf('Module not found: 1') > -1).to.be.true;
        } finally {
            fs.reset();
            expect(passed).to.be.true;
        }
    });
});