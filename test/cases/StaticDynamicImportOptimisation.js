let { nollup, fs, expect, rollup } = require('../nollup');
let Evaluator = require('../utils/evaluator');

describe ('Static Dynamic Import Optimisation', () => {
    it ('should provide second argument to require.dynamic to enable local module import if statically imported as well', async () => {
        // https://github.com/PepsRyuu/nollup/issues/204
        fs.stub('./src/other.js', () => `import('./msg').then(res => res)`)
        fs.stub('./src/msg.js', () => `export default 123;`);
        fs.stub('./src/main.js', () => `
            import msg from './msg'; 
            import('./msg').then(res => res);
            import('./other').then(res => res);
        `);

        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({ format: 'esm' });
        let main = output.find(o => o.fileName === 'main.js');
        expect(main.code.indexOf('require.dynamic(\\\'other-[hash].js\\\', 2).then') > -1).to.be.true;
        expect(main.code.indexOf('require.dynamic(\\\'msg-[hash].js\\\', 1') > -1).to.be.true;

        let other = output.find(o => o.fileName === 'other-[hash].js');
        expect(other.code.indexOf('require.dynamic(\\\'msg-[hash].js\\\', 1') > -1).to.be.true;
        
        expect(output.length).to.equal(3);
    });

    it ('should not export chunk if the same dynamic import exists in the same chunk statically', async () => {
        // https://github.com/PepsRyuu/nollup/issues/204
        fs.stub('./src/msg.js', () => `export default 123;`);
        fs.stub('./src/main.js', () => `
            import msg from './msg'; 
            import('./msg').then(res => __bundle_output = res.default);
        `);

        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({ format: 'esm' });
        let main = output.find(o => o.fileName === 'main.js');
        expect(main.code.indexOf('require.dynamic(\\\'\\\', 1') > -1).to.be.true;
        expect(output.length).to.equal(1);
        let { globals } = await Evaluator.init('esm', 'main.js', output, { __bundle_output: '' });

        // imports locally
        await new Promise(resolve => setTimeout(resolve, 1000));
        expect(globals.__bundle_output).to.equal(123);
    });

    it ('should not have issue adjusting require dynamic if asset exported when chunk is optimised out', async () => {
        // https://github.com/PepsRyuu/nollup/issues/212
        let emitted;
        fs.stub('./src/msg.js', () => `export default 123;`);
        fs.stub('./src/main.js', () => `
            import './msg';
            import('./msg').then(res => __bundle_output = res.default);
        `);

        let bundle = await nollup({
            input: './src/main.js',
            plugins: [{
                transform (code, id) {
                    if (!emitted) {
                        emitted = true;
                        this.emitFile({
                            type: 'asset',
                            name: 'myasset',
                            fileName: 'myasset.css',
                            source: '.class{}'
                        })
                    }
                }
            }]
        });

        let { output } = await bundle.generate({ format: 'esm' });
        expect(output.length).to.equal(2);
        let { globals } = await Evaluator.init('esm', 'main.js', output, { __bundle_output: '' });

        // imports locally
        await new Promise(resolve => setTimeout(resolve, 1000));
        expect(globals.__bundle_output).to.equal(123);
    });
});