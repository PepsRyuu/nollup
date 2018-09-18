let proxyquire = require('proxyquire');
let path = require('path');
let expect = require('chai').expect;
let fs_impl = require('fs');

let chokidar = {
    watch: function () {
        return {
            on: (event, callback) => {
                this.callback = callback;
            }
        }
    },

    trigger: function (file) {
        let fullPath = path.resolve(__dirname, `./packages/${file}.js`);
        this.callback(fullPath);
    }
};

let fs = {
    _stubs: {},

    readFileSync: function (file) {
        if (this._stubs[file]) {
            return this._stubs[file]();
        }

        return fs_impl.readFileSync(file, 'utf8');
    },

    reset: function () {
        this._stubs = {};
    },

    stub: function (file, callback) {
        let fullPath = path.resolve(__dirname, `./packages/${file}.js`);
        this._stubs[fullPath] = callback;
    }
}

let nollup = proxyquire('../src/index', { fs, chokidar });

function bundle (package, callback, config) {
    config = config || {};
    config.input = path.resolve(__dirname,`./packages/${package}/index.js`);

    nollup(config, (output, stats, err) => {
        callback(eval(output && output.code), err);
    });
}

let asyncErrorCallback;

function setErrorCallback (fn) {
    asyncErrorCallback = fn;
}

function asyncExpect(fn) {
    try {
        fn();
    } catch (e) {
        asyncErrorCallback(e);
        throw e;
    }
}

describe('Nollup', function () {
    afterEach (function () {
        fs.reset();
    })

    it ('should compile simple hello world app', function (done) {
        setErrorCallback(done);
        bundle('hello-world', (entry) => {
            asyncExpect(() => expect(entry.default).to.equal('hello world'));
            done();
        })        
    });

    it ('should compile module with multiple imports', function (done) {
        setErrorCallback(done);

        bundle('multi-module', (entry) => {
            asyncExpect(() => expect(entry.default.message).to.equal('hello world'));
            asyncExpect(() => expect(entry.default.sum).to.equal(6));
            done();
        });        
    });

    it ('should throw error if failed to find file', function (done) {
        setErrorCallback(done);

        fs.stub('multi-module/message/hello', () => {
            throw new Error ('File not found');
        });

        bundle('multi-module', (entry, err) => {
            asyncExpect(() => expect(err.message.indexOf('File not found') > -1).to.be.true);
            done();
        });
    });

    it ('should recompile successfully is file was missing and is found again', function (done) {
        setErrorCallback(done);

        fs.stub('multi-module/message/hello', () => {
            throw new Error('File not found');
        });

        let phase = 0;

        bundle('multi-module', (entry, err) => {
            if (phase === 0) {
                phase++;
                asyncExpect(() => expect(err).not.to.be.undefined);
                fs.reset();
                chokidar.trigger('multi-module/message/hello');
            } else if (phase === 1) {
                asyncExpect(() => expect(entry.default.message).to.equal('hello world'));
                done();
            }
        });
    });

    it ('Scenario: Module mistyped module that exists, and fixed itself afterwards', function (done) {
        setErrorCallback(done);

        fs.stub('multi-module/message/index', () => {
            return `
                import hello from './hello';
                import world from './world_typo';
                export default hello + ' ' + world;
            `;
        });

        let phase = 0;

        bundle('multi-module', (entry, err) => {
            if (phase === 0) {
                phase++;
                asyncExpect(() => expect(err).not.to.be.undefined);
                fs.reset();
                chokidar.trigger('multi-module/message/index');
            } else if (phase === 1) {
                asyncExpect(() => expect(entry.default.message).to.equal('hello world'));
                done();
            }
        })
    });

    it ('Scenario: Module adds a new module', function (done) {
        setErrorCallback(done);

        fs.stub('multi-module/message/index', () => {
            return `
                import hello from './hello';
                export default hello;
            `;
        });

        let phase = 0;

        bundle('multi-module', (entry, err) => {
            if (phase === 0) {
                phase++;
                asyncExpect(() => expect(err).to.be.undefined);
                fs.reset();
                chokidar.trigger('multi-module/message/index');
            } else if (phase === 1) {
                asyncExpect(() => expect(entry.default.message).to.equal('hello world'));
                done();
            }
        });
    });

    it ('Scenario: Module removes a module', function (done) {
        setErrorCallback(done);
        let phase = 0;

        bundle('multi-module', (entry, err) => {
            if (phase === 0) {
                phase++;
                asyncExpect(() => expect(err).to.be.undefined);
                fs.stub('multi-module/message/index', () => {
                    return `
                        import hello from './hello';
                        export default hello;
                    `;
                });                
                chokidar.trigger('multi-module/message/index');
            } else if (phase === 1) {
                asyncExpect(() => expect(entry.default.message).to.equal('hello'));
                fs.reset();
                done();
            }
        });
    });

    it ('Scenario: Module adds a module that fails to transform', function (done) {
        setErrorCallback(done);

        let phase = 0;

        bundle('multi-module', (entry, err) => {
            if (phase === 0) {
                phase++;
                asyncExpect(() => expect(err).not.to.be.undefined);
                chokidar.trigger('multi-module/message/index');
            } else if (phase === 1) {
                asyncExpect(() => expect(entry.default.message).to.equal('hello world'));
                fs.reset();
                done();
            }
        }, {
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
        })
    });

    it ('Scenario: Module whose dependency fails resolveId plugin', function (done) {
        setErrorCallback(done);

        let phase = 0;

        bundle('multi-module', (entry, err) => {
            if (phase === 0) {
                phase++;
                asyncExpect(() => expect(err).not.to.be.undefined);
                chokidar.trigger('multi-module/message/index');
            } else if (phase === 1) {
                asyncExpect(() => expect(entry.default.message).to.equal('hello world'));
                fs.reset();
                done();
            }
        }, {
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
        })
    });

    it ('Scenario: Check different export techniques', function (done) {
        setErrorCallback(done);

        bundle('export-checks', (entry) => {
            asyncExpect(() => expect(entry.MyVar).to.equal('MyVar'));
            asyncExpect(() => expect(entry.MyVarAlias).to.equal('MyVar'));
            asyncExpect(() => expect(entry.MyClass.prototype.getValue()).to.equal('MyClass'));
            asyncExpect(() => expect(entry.MyClassAlias.prototype.getValue()).to.equal('MyClass'));
            asyncExpect(() => expect(entry.default).to.equal('MyVarMyVarMyVar'));
            done();
        }) 
    });
});