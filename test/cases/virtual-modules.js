let { nollup, fs, expect, rollup } = require('../nollup');

describe ('Virtual Modules', () => {

    it ('should allow virtual module example to work', async () => {
        fs.stub('./src/main.js', () => 'import message from "virtual-module";console.log(123);');

        let virtualModulePlugin = {
            resolveId ( source ) {
                if (source === 'virtual-module') {
                    return source; 
                }
                return null;
            },
            load ( id ) {
                if (id === 'virtual-module') {
                    return 'export default "Virtual Module"'; 
                }
                return null;
            }
        };

        let bundle = await nollup({
            input: './src/main.js',
            plugins: [virtualModulePlugin]
        });

        let { output } = await bundle.generate({ format: 'esm' });
        expect(output[0].code.indexOf(`__e__(\\'default\\', function () { return "Virtual Module" })`) > -1).to.be.true;
    });

    it ('should allow null byte in the resolved id', async () => {
        fs.stub('./src/main.js', () => 'import message from "virtual-module";console.log(123);');

        let virtualModulePlugin = {
            resolveId ( source ) {
                if (source === 'virtual-module') {
                    return '\0' + source; 
                }
                return null;
            },
            load ( id ) {
                if (id === '\0virtual-module') {
                    return 'export default "Virtual Module"'; 
                }
                return null;
            }
        };

        let bundle = await nollup({
            input: './src/main.js',
            plugins: [virtualModulePlugin]
        });

        let { output } = await bundle.generate({ format: 'esm' });
        expect(output[0].code.indexOf(`__e__(\\'default\\', function () { return "Virtual Module" })`) > -1).to.be.true;
    });

    it ('should allow prefix in the resolved id', async () => {
        fs.stub('./src/main.js', () => 'import message from "virtual-module";console.log(123);');

        let virtualModulePlugin = {
            resolveId ( source ) {
                if (source === 'virtual-module') {
                    return '\0prefix:' + source; 
                }
                return null;
            },
            load ( id ) {
                if (id === '\0prefix:virtual-module') {
                    return 'export default "Virtual Module"'; 
                }
                return null;
            }
        };

        let bundle = await nollup({
            input: './src/main.js',
            plugins: [virtualModulePlugin]
        });

        let { output } = await bundle.generate({ format: 'esm' });
        expect(output[0].code.indexOf(`__e__(\\'default\\', function () { return "Virtual Module" })`) > -1).to.be.true;
    });

    it ('should allow virtual module example to work for entry module', async () => {
        let virtualModulePlugin = {
            resolveId ( source ) {
                if (source === 'virtual-module') {
                    return source; 
                }
                return null;
            },
            load ( id ) {
                if (id === 'virtual-module') {
                    return 'export default "Virtual Module"'; 
                }
                return null;
            }
        };

        let bundle = await nollup({
            input: 'virtual-module',
            plugins: [virtualModulePlugin]
        });

        let { output } = await bundle.generate({ format: 'esm' });
        expect(output[0].fileName).to.equal('virtual-module.js');
        expect(output[0].code.indexOf(`__e__(\\'default\\', function () { return "Virtual Module" })`) > -1).to.be.true;
    });

    it ('should allow null byte in the resolved id for entry module', async () => {
        let virtualModulePlugin = {
            resolveId ( source ) {
                if (source === 'virtual-module') {
                    return '\0' + source; 
                }
                return null;
            },
            load ( id ) {
                if (id === '\0virtual-module') {
                    return 'export default "Virtual Module"'; 
                }
                return null;
            }
        };

        let bundle = await nollup({
            input: 'virtual-module',
            plugins: [virtualModulePlugin]
        });

        let { output } = await bundle.generate({ format: 'esm' });
        expect(output[0].fileName).to.equal('_virtual-module.js');
        expect(output[0].code.indexOf(`__e__(\\'default\\', function () { return "Virtual Module" })`) > -1).to.be.true;
    });

    it ('should allow prefix in the resolved id for entry module', async () => {
        let virtualModulePlugin = {
            resolveId ( source ) {
                if (source === 'virtual-module') {
                    return '\0prefix:' + source; 
                }
                return null;
            },
            load ( id ) {
                if (id === '\0prefix:virtual-module') {
                    return 'export default "Virtual Module"'; 
                }
                return null;
            }
        };

        let bundle = await nollup({
            input: 'virtual-module',
            plugins: [virtualModulePlugin]
        });

        let { output } = await bundle.generate({ format: 'esm' });
        expect(output[0].fileName).to.equal('_prefix:virtual-module.js');
        expect(output[0].code.indexOf(`__e__(\\'default\\', function () { return "Virtual Module" })`) > -1).to.be.true;
    });
});
