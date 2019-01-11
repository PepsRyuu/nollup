let { nollup, fs, expect, rollup } = require('../../nollup');
let path = require('path');

describe ('API: generate', () => {
    it ('should return an object with output', async () => {
        fs.stub('./src/main.js', () => 'export default 123');
        
        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({
            format: 'esm'
        });

        expect(output).not.to.be.undefined;
        fs.reset();
    });

    it ('should return array of exported files', async () => {
        fs.stub('./src/main1.js', () => 'export default 123');
        fs.stub('./src/main2.js', () => 'export default 456');
        
        let bundle = await nollup({
            input: ['./src/main1.js', './src/main2.js']
        });

        let { output } = await bundle.generate({
            format: 'esm'
        });

        expect(output.length).to.equal(2);
        fs.reset();
    });

    it ('should return isAsset, fileName, source for assets', async () => {
        fs.stub('./src/main.js', () => 'import "./style.css"; export default 123');
        fs.stub('./src/style.css', () => '*{color: blue}');

        let bundle = await nollup({
            input: './src/main.js',
            plugins: [{
                transform (code, id) {
                    if (id.endsWith('.css')) {
                        this.emitAsset('style.css', code)
                        return '';
                    }
                }
            }]
        });

        let { output } = await bundle.generate({ format: 'esm' });
        expect(output.length).to.equal(2);
        expect(output[1].isAsset).to.be.true;
        expect(!output[1].isEntry).to.be.true;
        expect(output[1].fileName).to.equal('assets/style-_hash_.css');
        expect(output[1].source).to.equal('*{color: blue}');
        expect(output[0].isEntry).to.be.true;
        fs.reset();
    });

    it ('should return isEntry, fileName, code, map for chunks', async () => {
        fs.stub('./src/main1.js', () => 'export default 123');
        fs.stub('./src/main2.js', () => 'export default 456');
        
        let bundle = await nollup({
            input: ['./src/main1.js', './src/main2.js']
        });

        let { output } = await bundle.generate({
            format: 'esm'
        });

        expect(output.length).to.equal(2);
        expect(output[0].isEntry).to.be.true;
        expect(!output[0].isAsset).to.be.true;
        expect(output[0].fileName).to.equal('main1.js');
        expect(output[0].code.indexOf('module.exports.default = 123') > -1).to.be.true;
        expect(output[0].code.indexOf('module.exports.default = 456') > -1).to.be.false;
        expect(output[0].map).to.be.null;

        expect(output[1].isEntry).to.be.true;
        expect(!output[1].isAsset).to.be.true;
        expect(output[1].fileName).to.equal('main2.js');
        expect(output[1].code.indexOf('module.exports.default = 456') > -1).to.be.true;
        expect(output[1].code.indexOf('module.exports.default = 123') > -1).to.be.false;
        expect(output[1].map).to.be.null;
        fs.reset();
    });

    it ('should return modules object with keys of modules included', async () => {
        fs.stub('./src/main1.js', () => 'export default 123');
        fs.stub('./src/main2.js', () => 'export default 456');
        
        let bundle = await nollup({
            input: ['./src/main1.js', './src/main2.js']
        });

        let { output } = await bundle.generate({
            format: 'esm'
        });

        expect(Object.keys(output[0].modules).length).to.equal(1);
        expect(output[0].modules[path.resolve(process.cwd(), './src/main1.js')]).not.to.be.undefined;
        expect(Object.keys(output[1].modules).length).to.equal(1);
        expect(output[1].modules[path.resolve(process.cwd(), './src/main2.js')]).not.to.be.undefined;
        fs.reset();
    });

    it ('should return isDynamicEntry for dynamically imported modules', async () => {
        fs.stub('./src/main1.js', () => 'import("./dynamic.js"); export default 123');
        fs.stub('./src/main2.js', () => 'import("./dynamic.js"); export default 456');
        fs.stub('./src/dynamic.js', () => 'import("./subdynamic.js"); export default 789');
        fs.stub('./src/subdynamic.js', () => 'export default 999');
        
        let bundle = await nollup({
            input: ['./src/main1.js', './src/main2.js']
        });

        let { output } = await bundle.generate({
            format: 'esm'
        });

        expect(output.length).to.equal(4);

        expect(output[0].isEntry).to.be.true;
        expect(output[0].fileName).to.equal('main1.js');
        expect(output[0].code.indexOf('require.dynamic(\\\'./chunk-') > -1).to.be.true;
        expect(Object.keys(output[0].modules).length).to.equal(1);
        expect(output[0].modules[path.resolve(process.cwd(), './src/main1.js')]).not.to.be.undefined;

        expect(output[1].isEntry).to.be.true;
        expect(output[1].fileName).to.equal('main2.js');
        expect(output[1].code.indexOf('require.dynamic(\\\'./chunk-') > -1).to.be.true;
        expect(Object.keys(output[1].modules).length).to.equal(1);
        expect(output[1].modules[path.resolve(process.cwd(), './src/main2.js')]).not.to.be.undefined;


        expect(output[2].isDynamicEntry).to.be.true;
        expect(output[2].fileName.startsWith('chunk-')).to.be.true;
        expect(output[2].code.indexOf('require.dynamic(\\\'./chunk-') > -1).to.be.true;
        expect(Object.keys(output[2].modules).length).to.equal(1);
        expect(output[2].modules[path.resolve(process.cwd(), './src/dynamic.js')]).not.to.be.undefined;

        expect(output[3].isDynamicEntry).to.be.true;
        expect(output[3].fileName.startsWith('chunk-')).to.be.true;
        expect(output[3].code.indexOf('require.dynamic(\\\'./chunk-') > -1).to.be.false;
        expect(output[3].modules[path.resolve(process.cwd(), './src/subdynamic.js')]).not.to.be.undefined;
        expect(Object.keys(output[3].modules).length).to.equal(1);

        fs.reset();
    });

    it ('should return imports, exports and dynamicImports');
});