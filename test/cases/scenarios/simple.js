let { nollup, fs, expect } = require('../../nollup');
let path = require('path');

async function createNollup (package, config) {
    config = config || {};
    config.input = path.resolve(__dirname,`../../packages/${package}/index.js`);

    if (!config.output) {
        config.output = {};
    }

    if (!config.output.format) {
        config.output.format = 'iife';
    }

    let bundle = await nollup(config);

    return {
        invalidate: function (file) {
            return bundle.invalidate(path.resolve(__dirname, `../../packages/${file}.js`));
        },

        generate: async function () {
            let { output } = await bundle.generate(config.output);
            let code = (output && output[0].code) || '';
            return eval(code);
        }
    }
}

function stubPackageFile(file, callback) {
    fs.stub(path.resolve(__dirname, `../../packages/${file}.js`), callback);
}

describe('Nollup', function () {
    afterEach (function () {
        fs.reset();
    })

    it ('should compile simple hello world app', async function () {
        let bundle = await createNollup('hello-world');
        let entry = await bundle.generate();
        expect(entry.default).to.equal('hello world');      
    });
    
    it ('should compile module with multiple imports', async function () {
        let bundle = await createNollup('multi-module');
        let entry = await bundle.generate();
        expect(entry.default.message).to.equal('hello world');
        expect(entry.default.sum).to.equal(6);       
    });

    it ('should throw error if failed to find file', async function () {
        stubPackageFile('multi-module/message/hello', () => {
            throw new Error ('File not found');
        });

        let bundle = await createNollup('multi-module');

        try {
            await bundle.generate();
            throw new Error('Should not reach here');
        } catch (e) {
            expect(e.message.indexOf('File not found') > -1).to.be.true;
        }
    });

    it ('should recompile successfully is file was missing and is found again', async function () {
        stubPackageFile('multi-module/message/hello', () => {
            throw new Error('File not found');
        });

        let failed = false;
        let bundle = await createNollup('multi-module');

        try {
            await bundle.generate();
            failed = true;
        } catch (e) {
            if (failed) {
                throw new Error('Bundle generated when it shouldnt have');
            }

            fs.reset();
            bundle.invalidate('multi-module/message/hello');
            let entry = await bundle.generate();
            expect(entry.default.message).to.equal('hello world');
        }
    });

    it ('Scenario: Module mistyped module that exists, and fixed itself afterwards', async function () {
        stubPackageFile('multi-module/message/index', () => {
            return `
                import hello from './hello';
                import world from './world_typo';
                export default hello + ' ' + world;
            `;
        });

        let failed = false;
        let bundle = await createNollup('multi-module');

        try {
            await bundle.generate();
            failed = true;
        } catch (e) {
            if (failed) {
                throw new Error('Bundle shouldnt have generated');
            }

            fs.reset();
            bundle.invalidate('multi-module/message/index');
            let entry = await bundle.generate();
            expect(entry.default.message).to.equal('hello world');
        }
    });

    it ('Scenario: Module adds a new module', async function () {
        stubPackageFile('multi-module/message/index', () => {
            return `
                import hello from './hello';
                export default hello;
            `;
        });

        let bundle = await createNollup('multi-module');
        let entry = await bundle.generate();
        expect(entry.default.message).to.equal('hello');

        fs.reset();

        bundle.invalidate('multi-module/message/index');
        entry = await bundle.generate();
        expect(entry.default.message).to.equal('hello world');
    });

    it ('Scenario: Module removes a module', async function () {
        let phase = 0;

        let bundle = await createNollup('multi-module');
        await bundle.generate();

        stubPackageFile('multi-module/message/index', () => {
            return `
                import hello from './hello';
                export default hello;
            `;
        });

        bundle.invalidate('multi-module/message/index');

        let entry = await bundle.generate();
        expect(entry.default.message).to.equal('hello');
        fs.reset();
    });

    it ('Scenario: Module adds a module that fails to transform', async function () {
        let phase = 0;
        let failed = false;

        let bundle = await createNollup('multi-module', {
             plugins: [{
                transform: (code, id) => {
                    if (phase === 0 && id.indexOf('message') > 0) {
                        throw new Error('transform fail');
                    }

                    return {
                        code
                    }
                }
            }]
        });

        try {
            await bundle.generate();
            failed = true;
        } catch (e) {
            if (failed) {
                throw new Error('should have failed');
            }

            phase++;
            let entry = await bundle.generate();
            expect(entry.default.message).to.equal('hello world');
            fs.reset();
        }
    });

    it ('Scenario: Module whose dependency fails resolveId plugin', async function () {
        let phase = 0;
        let failed = false;

        let bundle = await createNollup('multi-module', {
             plugins: [{
                resolveId: (id) => {
                    if (phase === 0 && id.indexOf('message') > 0) {
                        throw new Error('resolveId fail');
                    }

                    return null;
                }
            }]
        });

        try {
            await bundle.generate();
            failed = true;
        } catch (e) {
            if (failed) {
                throw new Error('should have failed');
            }

            phase++;
            bundle.invalidate('multi-module/message/index');

            let entry = await bundle.generate();
            expect(entry.default.message).to.equal('hello world');
            fs.reset();
        }
        
       

    });

    it ('Scenario: Check different export techniques', async function () {
        let bundle = await createNollup('export-checks');
        let entry = await bundle.generate();
        expect(entry.MyVar).to.equal('MyVar');
        expect(entry.MyVarAlias).to.equal('MyVar');
        expect(entry.MyClass.prototype.getValue()).to.equal('MyClass');
        expect(entry.MyClassAlias.prototype.getValue()).to.equal('MyClass');
        expect(entry.default).to.equal('MyVarMyVarMyVar');
    });

    it ('Scenario: Check export all', async function () {
        let bundle = await createNollup('export-all');
        let entry = await bundle.generate();
        expect(entry.message1).to.equal('hello');
        expect(entry.message2).to.equal('world');
        expect(entry.default).to.be.undefined;
    });

    it ('Scenario: Empty source map in transform', async function () {
        let bundle = await createNollup('empty-source-mapping', {
            plugins: [{
                transform (code, id) {
                    if (path.extname(id) === '.json') {
                        return {
                            code: `export default ${code}`,
                            map: { mappings: '' }
                        };
                    }
                }
            }]
        });
        let entry = await bundle.generate();
        expect(entry.default.message).to.equal('hello');
    });

    it ('Scenario: Circular Dependencies', async function () {
        let bundle = await createNollup('circular');
        let entry = await bundle.generate();
        expect(entry.default).to.equal('A2 - A3 - A1');
    });
});