let { nollup, fs, expect, rollup } = require('../nollup');
let Evaluator = require('../utils/evaluator');

describe ('Virtual Modules', () => {

    it ('should allow virtual module example to work', async () => {
        fs.stub('./src/main.js', () => 'export { default } from "virtual-module";');

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
        let { exports } = await Evaluator.init('esm', 'main.js', output);
        expect(exports.default).to.equal('Virtual Module');      
    });

    it ('should allow null byte in the resolved id', async () => {
        fs.stub('./src/main.js', () => 'export { default } from "virtual-module";');

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
        let { exports } = await Evaluator.init('esm', 'main.js', output);
        expect(exports.default).to.equal('Virtual Module'); 
    });

    it ('should allow prefix in the resolved id', async () => {
        fs.stub('./src/main.js', () => 'export { default } from "virtual-module";');

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
        let { exports } = await Evaluator.init('esm', 'main.js', output);
        expect(exports.default).to.equal('Virtual Module'); 
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

        let { exports } = await Evaluator.init('esm', 'virtual-module.js', output);
        expect(exports.default).to.equal('Virtual Module'); 
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

        let { exports } = await Evaluator.init('esm', '_virtual-module.js', output);
        expect(exports.default).to.equal('Virtual Module'); 
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
        let { exports } = await Evaluator.init('esm', '_prefix:virtual-module.js', output);
        expect(exports.default).to.equal('Virtual Module'); 
    });
});
