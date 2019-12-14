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

        let asset = output.find(o => o.fileName.indexOf('style') > -1);
        expect(asset.isAsset).to.be.true;
        expect(!asset.isEntry).to.be.true;
        expect(asset.fileName).to.equal('assets/style-[hash].css');
        expect(asset.source).to.equal('*{color: blue}');

        let main = output.find(o => o.fileName.indexOf('main') > -1);
        expect(main.isEntry).to.be.true;
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

        let main1 = output.find(o => o.fileName === 'main1.js');
        expect(main1.isEntry).to.be.true;
        expect(!main1.isAsset).to.be.true;
        expect(main1.fileName).to.equal('main1.js');
        expect(main1.code.indexOf(`__e__(\\'default\\', 123)`) > -1).to.be.true; 
        expect(main1.code.indexOf(`__e__(\\'default\\', 456)`) > -1).to.be.false;
        expect(main1.map).to.be.null;

        let main2 = output.find(o => o.fileName === 'main2.js');
        expect(main2.isEntry).to.be.true;
        expect(!main2.isAsset).to.be.true;
        expect(main2.fileName).to.equal('main2.js');
        expect(main2.code.indexOf(`__e__(\\'default\\', 456)`) > -1).to.be.true;
        expect(main2.code.indexOf(`__e__(\\'default\\', 123)`) > -1).to.be.false;
        expect(main2.map).to.be.null;
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

        let main1 = output.find(o => o.fileName === 'main1.js');
        expect(Object.keys(main1.modules).length).to.equal(1);
        expect(main1.modules[path.resolve(process.cwd(), './src/main1.js')]).not.to.be.undefined;
        let main2 = output.find(o => o.fileName === 'main2.js');
        expect(Object.keys(main2.modules).length).to.equal(1);
        expect(main2.modules[path.resolve(process.cwd(), './src/main2.js')]).not.to.be.undefined;
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
            format: 'esm',
            chunkFileNames: 'chunk-[name]-[hash].js'
        });

        expect(output.length).to.equal(4);

        let main1 = output.find(o => o.fileName === 'main1.js');
        expect(main1.isEntry).to.be.true;
        expect(main1.fileName).to.equal('main1.js');
        expect(main1.code.indexOf('require.dynamic(\\\'./chunk-') > -1).to.be.true;
        expect(Object.keys(main1.modules).length).to.equal(1);
        expect(main1.modules[path.resolve(process.cwd(), './src/main1.js')]).not.to.be.undefined;

        let main2 = output.find(o => o.fileName === 'main2.js');
        expect(main2.isEntry).to.be.true;
        expect(main2.fileName).to.equal('main2.js');
        expect(main2.code.indexOf('require.dynamic(\\\'./chunk-') > -1).to.be.true;
        expect(Object.keys(main2.modules).length).to.equal(1);
        expect(main2.modules[path.resolve(process.cwd(), './src/main2.js')]).not.to.be.undefined;

        let dynamic = output.find(o => o.fileName === 'chunk-dynamic-[hash].js');
        expect(dynamic.isDynamicEntry).to.be.true;
        expect(dynamic.fileName.startsWith('chunk-')).to.be.true;
        expect(dynamic.code.indexOf('require.dynamic(\\\'./chunk-') > -1).to.be.true;
        expect(Object.keys(dynamic.modules).length).to.equal(1);
        expect(dynamic.modules[path.resolve(process.cwd(), './src/dynamic.js')]).not.to.be.undefined;

        let subdynamic = output.find(o => o.fileName === 'chunk-subdynamic-[hash].js');
        expect(subdynamic.isDynamicEntry).to.be.true;
        expect(subdynamic.fileName.startsWith('chunk-')).to.be.true;
        expect(subdynamic.code.indexOf('require.dynamic(\\\'./chunk-') > -1).to.be.false;
        expect(subdynamic.modules[path.resolve(process.cwd(), './src/subdynamic.js')]).not.to.be.undefined;
        expect(Object.keys(subdynamic.modules).length).to.equal(1);

        fs.reset();
    });

    it ('should return imports, exports and dynamicImports');
});