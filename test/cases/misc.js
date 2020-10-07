let { nollup, fs, expect, rollup } = require('../nollup');

describe ('Misc', () => {
    it ('should not throw error if using require with string in CJS format', async () => {
        fs.stub('./src/main.js', () => 'require("path")');

        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({ format: 'cjs' });
        expect(() => eval(output[0].code)).not.to.throw();
        fs.reset();
    });

    it ('should throw error if using require with string in CJS format and it doesn\'t exist', async () => {
        fs.stub('./src/main.js', () => 'require("fake")');

        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({ format: 'cjs' });
        expect(() => eval(output[0].code)).to.throw('Cannot find module');
        fs.reset();
    });

    it ('should throw error if using require with string in non-CJS format', async () => {
        fs.stub('./src/main.js', () => 'require("hello")');

        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({ format: 'esm' });
        expect(() => eval(output[0].code)).to.throw('Module not found: hello');
        fs.reset();
    });

    it ('should not throw error if using require on bundled id', async () => {
        let executed = false;
        fs.stub('./src/main.js', () => 'if (executed === false) {executed = true; require(0); }');

        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({ format: 'esm' });
        expect(() => eval(output[0].code)).not.to.throw();
        expect(executed).to.be.true;
        fs.reset();
    });

    it ('should not throw error if using require on bundled id in CJS format', async () => {
        let executed = false;
        fs.stub('./src/main.js', () => 'if (executed === false) {executed = true; require(0); }');

        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({ format: 'cjs' });
        expect(() => eval(output[0].code)).not.to.throw();
        expect(executed).to.be.true;
        fs.reset();
    });

    it ('should throw error if using require and passing unrecognised id', async () => {
        fs.stub('./src/main.js', () => 'require(1)');

        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({ format: 'esm' });
        expect(() => eval(output[0].code)).to.throw('Module not found: 1');
        fs.reset();
    });

    it ('should throw error if using require and passing unrecognised id in CJS format', async () => {
        fs.stub('./src/main.js', () => 'require(1)');

        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({ format: 'cjs' });
        expect(() => eval(output[0].code)).to.throw('Module not found: 1');
        fs.reset();
    });

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

    it ('should throw syntax error if there is a problem parsing the syntax', async () => {
        fs.stub('./src/main.js', () => [
            'console.log(123);',
            'var abc def = 123;'
        ].join('\n'));
        let compiled = false, thrown = false;

        let bundle = await nollup({
            input: './src/main.js'
        });

        try {
            await bundle.generate({ format: 'esm' });
            compiled = true;
        } catch (e) {
            thrown = true;
            expect(e.name).to.equal('SyntaxError');
            expect(e.message).to.equal([
                'Unexpected token (2:8)',
                '    var abc def = 123;',
                '            ^'
            ].join('\n'));
        }

        expect(compiled).to.be.false;
        expect(thrown).to.be.true;
    });

    it ('should remove null byte from sourceURL comments', async () => {
        fs.stub('./src/main.js', () => 'console.log("hello");');

        let VIRTUAL_MODULE_ID = '\0virtual-module';

        let myplugin = {
            resolveId (id) {
                if (id === VIRTUAL_MODULE_ID) {
                    return VIRTUAL_MODULE_ID;
                }
            },

            load (id) {
                if (id === VIRTUAL_MODULE_ID) {
                    return 'export default 123';
                }
            },

            transform (code, id) {
                if (id.indexOf('main.js') > -1) {
                    return `import MyNumber from '${VIRTUAL_MODULE_ID}';${code}`
                }
            }
        };

        let bundle = await nollup({
            input: './src/main.js',
            plugins: [myplugin]
        });

        let { output } = await bundle.generate({ format: 'esm' });
        expect(output[0].code.indexOf('\0')).to.equal(-1);
    });
});
