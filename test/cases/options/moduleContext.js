let { nollup, fs, rollup, expect } = require('../../nollup');
let path = require('path');

describe ('Options: moduleContext', () => {
    it ('should allow priortise moduleContext over context if it matches', async () => {
        fs.stub('./src/main1.js', () => 'export default this;');
        fs.stub('./src/main2.js', () => 'export default this;');
        
        let bundle = await nollup({
            input: ['./src/main1.js', './src/main2.js'],
            context: '{foo: "bar"}',
            moduleContext: (id) => {
                if (id.indexOf('main1') > -1) {
                    return '{hello: "world"}'
                }
            }
        });

        let { output } = await bundle.generate({
            dir: 'dist',
            format: 'esm'
        });

        let exs1 = eval('(function () {\n' + output[0].code.replace('export default ', 'return ') + '\n})()');
        expect(exs1.hello).to.equal('world');

        let exs2 = eval('(function () {\n' + output[1].code.replace('export default ', 'return ') + '\n})()');
        expect(exs2.foo).to.equal('bar');
        fs.reset();
    });

    it ('should allow moduleContext to be an object', async () => {
        fs.stub('./src/main1.js', () => 'export default this;');
        fs.stub('./src/main2.js', () => 'export default this;');
        
        let bundle = await nollup({
            input: ['./src/main1.js', './src/main2.js'],
            context: '{foo: "bar"}',
            moduleContext: {
                [path.resolve(process.cwd(), './src/main1.js')]: '{"hello": "world"}'
            }
        });

        let { output } = await bundle.generate({
            dir: 'dist',
            format: 'esm'
        });

        let exs1 = eval('(function () {\n' + output[0].code.replace('export default ', 'return ') + '\n})()');
        expect(exs1.hello).to.equal('world');

        let exs2 = eval('(function () {\n' + output[1].code.replace('export default ', 'return ') + '\n})()');
        expect(exs2.foo).to.equal('bar');
        fs.reset();
    });
});