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
        expect(main1.code.indexOf(`require.dynamic(\\'${
            path.resolve(process.cwd(), './src/dynamic.js').replace(/\\/g, '\\\\\\\\')}`
        ) > -1).to.be.true;
        expect(main1.code.indexOf(`'${path.resolve(process.cwd(), './src/dynamic.js').replace(/\\/g, '\\\\')}': getRelativePath('.', 'chunk-dynamic-[hash].js')`) > -1).to.be.true;
        expect(Object.keys(main1.modules).length).to.equal(1);
        expect(main1.modules[path.resolve(process.cwd(), './src/main1.js')]).not.to.be.undefined;

        let main2 = output.find(o => o.fileName === 'main2.js');
        expect(main2.isEntry).to.be.true;
        expect(main2.fileName).to.equal('main2.js');
        expect(main2.code.indexOf(`require.dynamic(\\'${
            path.resolve(process.cwd(), './src/dynamic.js').replace(/\\/g, '\\\\\\\\')}`
        ) > -1).to.be.true;
        expect(main2.code.indexOf(`'${path.resolve(process.cwd(), './src/dynamic.js').replace(/\\/g, '\\\\')}': getRelativePath('.', 'chunk-dynamic-[hash].js')`) > -1).to.be.true;
        expect(Object.keys(main2.modules).length).to.equal(1);
        expect(main2.modules[path.resolve(process.cwd(), './src/main2.js')]).not.to.be.undefined;

        let dynamic = output.find(o => o.fileName === 'chunk-dynamic-[hash].js');
        expect(dynamic.isDynamicEntry).to.be.true;
        expect(dynamic.fileName.startsWith('chunk-')).to.be.true;
        expect(dynamic.code.indexOf(`require.dynamic(\\'${
            path.resolve(process.cwd(), './src/subdynamic.js').replace(/\\/g, '\\\\\\\\')}`
        ) > -1).to.be.true;
        expect(main1.code.indexOf(`'${path.resolve(process.cwd(), './src/subdynamic.js').replace(/\\/g, '\\\\')}': getRelativePath('.', 'chunk-subdynamic-[hash].js')`) > -1).to.be.true;
        expect(main2.code.indexOf(`'${path.resolve(process.cwd(), './src/subdynamic.js').replace(/\\/g, '\\\\')}': getRelativePath('.', 'chunk-subdynamic-[hash].js')`) > -1).to.be.true;      
        expect(dynamic.code.indexOf(`'${path.resolve(process.cwd(), './src/subdynamic.js').replace(/\\/g, '\\\\')}': getRelativePath('.', 'chunk-subdynamic-[hash].js')`) === -1).to.be.true;        
        expect(Object.keys(dynamic.modules).length).to.equal(1);
        expect(dynamic.modules[path.resolve(process.cwd(), './src/dynamic.js')]).not.to.be.undefined;

        let subdynamic = output.find(o => o.fileName === 'chunk-subdynamic-[hash].js');
        expect(subdynamic.isDynamicEntry).to.be.true;
        expect(subdynamic.fileName.startsWith('chunk-')).to.be.true;
        expect(subdynamic.code.indexOf('require.dynamic(') > -1).to.be.false;
        expect(subdynamic.modules[path.resolve(process.cwd(), './src/subdynamic.js')]).not.to.be.undefined;
        expect(Object.keys(subdynamic.modules).length).to.equal(1);

        fs.reset();
    });

    it ('should fix naming collision for multiple inputs', async () => {
        fs.stub('./src/a/main.js', () => 'export default 123;');
        fs.stub('./src/b/main.js', () => 'export default 456;');
        
        let bundle = await nollup({
            input: ['./src/a/main.js', './src/b/main.js']
        });

        let { output } = await bundle.generate({
            format: 'esm',
            entryFileNames: '[name].[hash].js'
        });

        expect(output.length).to.equal(2);
        expect(output[0].name).to.equal('main');
        expect(output[0].fileName).to.equal('main.[hash].js');
        expect(output[1].name).to.equal('main');
        expect(output[1].fileName).to.equal('main2.[hash].js');
        
        fs.reset();
    });

    it ('should fix naming collision for input and dynamic with same names', async () => {
        fs.stub('./src/a/main.js', () => 'import("./dynamic/main.js"); export default 123;');
        fs.stub('./src/b/main.js', () => 'import("./dynamic/main.js"); export default 456;');
        fs.stub('./src/a/dynamic/main.js', () => 'export default 123;');
        fs.stub('./src/b/dynamic/main.js', () => 'export default 456;');
        
        let bundle = await nollup({
            input: ['./src/a/main.js', './src/b/main.js']
        });

        let { output } = await bundle.generate({
            format: 'esm',
            entryFileNames: '[name].[hash].js',
            chunkFileNames: '[name].[hash].js'
        });

        // Names don't deconflict --> main, main, nested, nested
        // Only fileName deconflicts
        expect(output.length).to.equal(4);
        expect(output[0].name).to.equal('main');
        expect(output[0].fileName).to.equal('main.[hash].js');
        expect(output[1].name).to.equal('main');
        expect(output[1].fileName).to.equal('main2.[hash].js');
        expect(output[2].name).to.equal('main');
        expect(output[2].fileName).to.equal('main3.[hash].js');
        expect(output[3].name).to.equal('main');
        expect(output[3].fileName).to.equal('main4.[hash].js');
        

        fs.reset();
    });

    it ('should fix naming collisions for emitted assets', async () => {
        fs.stub('./src/main.js', () => 'import "./a/style.css"; import "./b/style.css"; export default 123');
        fs.stub('./src/a/style.css', () => '*{color: blue}');
        fs.stub('./src/b/style.css', () => '*{color: red}');

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

        let { output } = await bundle.generate({ format: 'esm', assetFileNames: 'lol-[name][extname]' });
        expect(output.length).to.equal(3);

        expect(output[1].type).to.equal('asset');
        expect(output[1].fileName).to.equal('lol-style.css');
        expect(output[1].source).to.equal('*{color: blue}');
        expect(output[2].type).to.equal('asset');
        expect(output[2].fileName).to.equal('lol-style2.css');
        expect(output[2].source).to.equal('*{color: red}');

        fs.reset();
    });

    it ('should fix naming collisions for emitted chunks', async () => {
        fs.stub('./src/main.js', () => 'export default 123');
        fs.stub('./src/a/chunk.js', () => 'export default 456');
        fs.stub('./src/b/chunk.js', () => 'export default 789');

        let bundle = await nollup({
            input: './src/main.js',
            plugins: [{
                transform (code, id) {
                    if (id.indexOf('main') > -1) {
                        this.emitChunk('./src/a/chunk.js');
                        this.emitChunk('./src/b/chunk.js');
                        return '';
                    }
                }
            }]
        });

        let { output } = await bundle.generate({ format: 'esm', chunkFileNames: 'lol-[name].js' });
        expect(output.length).to.equal(3);

        expect(output[1].type).to.equal('chunk');
        expect(output[1].fileName).to.equal('lol-chunk.js');
        expect(output[2].type).to.equal('chunk');
        expect(output[2].fileName).to.equal('lol-chunk2.js');

        fs.reset();
    });

    it ('should fix naming collisions for emitted chunks that collide with inputs', async () => {
        fs.stub('./src/main.js', () => 'export default 123');
        fs.stub('./src/a/chunk.js', () => 'export default 456');
        fs.stub('./src/b/chunk.js', () => 'export default 789');

        let bundle = await nollup({
            input: './src/main.js',
            plugins: [{
                transform (code, id) {
                    if (id.indexOf('main') > -1) {
                        this.emitChunk('./src/a/chunk.js', { name: 'main' });
                        this.emitChunk('./src/b/chunk.js', { name: 'main' });
                        return '';
                    }
                }
            }]
        });

        let { output } = await bundle.generate({ format: 'esm', chunkFileNames: '[name].js' });

        expect(output.length).to.equal(3);
        expect(output[0].fileName).to.equal('main.js');
        expect(output[1].fileName).to.equal('main2.js');
        expect(output[2].fileName).to.equal('main3.js');

        fs.reset();
    });

    it ('should fix naming collisions for emitted chunks that collide with dynamic imports', async () => {
        fs.stub('./src/main.js', () => 'import("./a/main"); export default 123');
        fs.stub('./src/a/main.js', () => 'export default 456');
        fs.stub('./src/b/main.js', () => 'export default 789');

        let bundle = await nollup({
            input: './src/main.js',
            plugins: [{
                transform (code, id) {
                    if (id.indexOf(path.normalize('src/main')) > -1) {
                        this.emitChunk('./src/b/main.js', { name: 'main' });
                        return 'import("./a/main");';
                    }
                }
            }]
        });

        let { output } = await bundle.generate({ format: 'esm', chunkFileNames: '[name].js' });

        expect(output.length).to.equal(3);
        expect(output[0].fileName).to.equal('main.js');
        expect(output[1].fileName).to.equal('main2.js');
        expect(output[2].fileName).to.equal('main3.js');

        fs.reset();
    });

    it ('should fix naming collisions for dynamic import that dynamically imports a module with same name', async () => {
        fs.stub('./src/main.js', () => 'import("./a/main"); ');
        fs.stub('./src/a/main.js', () => 'import("../b/main");');
        fs.stub('./src/b/main.js', () => 'export default 123');

        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({ format: 'esm', chunkFileNames: '[name].js' });

        expect(output.length).to.equal(3);
        expect(output[0].fileName).to.equal('main.js');
        expect(output[1].fileName).to.equal('main2.js');
        expect(output[2].fileName).to.equal('main3.js');

        fs.reset();
    });

    it ('should ensure dynamic chunks have their own copies of modules already imported', async () => {
        fs.stub('./src/main.js', () => 'import("./a/main"); import("./b/main"); ');
        fs.stub('./src/a/main.js', () => 'import "../dep";');
        fs.stub('./src/b/main.js', () => 'import "../dep";');
        fs.stub('./src/dep.js', () => 'export default 123');

        let bundle = await nollup({
            input: './src/main.js'
        });

        let { output } = await bundle.generate({ format: 'esm', chunkFileNames: '[name].js' });

        expect(output.length).to.equal(3);

        expect(Object.keys(output[0].modules).length).to.equal(1);
        expect(Object.keys(output[1].modules).length).to.equal(2);
        expect(Object.keys(output[2].modules).length).to.equal(2);


        let getModuleId = id => path.resolve(process.cwd(), id);
        expect(output[1].modules[getModuleId('./src/a/main.js')]).to.be.true;
        expect(output[1].modules[getModuleId('./src/dep.js')]).to.be.true;
        expect(output[2].modules[getModuleId('./src/b/main.js')]).to.be.true;
        expect(output[2].modules[getModuleId('./src/dep.js')]).to.be.true;

        fs.reset();
    });

});