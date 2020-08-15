let proxyquire = require('proxyquire');
let { expect, fs, nollup } = require('../nollup');
let path = require('path');

let chokidar = {
    _callbacks: [],
    watch: function (basedir, options) {
        this.basedir = basedir;
        this.options = options;

        return {
            on: (event, callback) => {
                this._callbacks.push({ event, callback });
            }
        }
    },

    trigger: function (event, file) {
        this._callbacks.forEach(handle => {
            if (handle.event === event) {
                handle.callback(path.resolve(file));
            }
        })
    },

    clear: function () {
        this._callbacks = [];
        this.basedir = undefined;
        this.options = undefined;
    }
}

let expressWs = {
    _callbacks: []
};

let WebSocket = function (url) {
    let inst = {
        _received: [],
        _callbacks: [],
        send: function (data) {
            this._received.push(data);
        },

        on: function (event, callback) {
            this._callbacks.push({ event, callback });
        },

        close: function () {
            this._callbacks.forEach(handle => {
                if (handle.event === 'close') {
                    handle.callback();
                }
            })
        }
    };

    expressWs._callbacks.forEach(handle => {
        if (handle.path === url) {
            handle.callback(inst);
        }
    });

    return inst;
};

let middleware = proxyquire('../../lib/dev-middleware', { 
    './index': nollup,
    'chokidar': chokidar,
    'fs': fs,
    'express-ws': (app) => {
        app.ws = function (path, callback) {
            expressWs._callbacks.push({ path, callback });
        }
    }
}); 

function createRequest (url) {
    return { url };
}

function createResponse (callback) {
    return {
        status: 0,
        headers: {},
        body: '',
        writeHead: function (status, headers) {
            this.status = status;
            this.headers = headers;
        },
        write: function (body) {
            this.body = body;
        },
        end: function () {
            // Give console log a chance to print
            setTimeout(() => {
                callback(this);
            }, 5)
        }
    }
}

function createNext (next) {
    return next || (() => {});
}

function mwFetch (mw, url, next) {
    return new Promise((resolve, reject) => {
        mw(
            createRequest(url),
            createResponse(res => {
                resolve(res);
            }),
            createNext(() => reject('file not found'))
        )
    })
}

describe('Dev Middleware', () => {
    let _log;
    let logs = [];

    beforeEach(() => {
        _log = console.log;
        logs = [];
        console.log = function (...args) {
            logs.push(args.join(' '));
        };
        fs.reset();
        chokidar.clear();
        expressWs._callbacks = [];
    });

    afterEach(() => {
        console.log = _log;
        fs.reset();
        chokidar.clear();
        expressWs._callbacks = [];
    });

    it ('should output simple bundle for response', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            }
        };

        middleware({}, config, {})(
            createRequest('/bundle.js'), 
            createResponse(res => {
                expect(res.status).to.equal(200);
                expect(res.headers['Content-Type']).to.equal('application/javascript');
                expect(res.body.indexOf('123') > -1).to.be.true;
                expect(logs[0].match(/Compiled in \d+ms./g).length > 0).to.be.true;
                done();
            }), 
            createNext()
        );
    });

    it ('should provide content type header for other file types', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                dir: 'dist',
                assetFileNames: '[name][extname]',
                entryFileNames: '[name].js',
                format: 'esm'
            },
            plugins: [{
                transform (code) {
                    this.emitAsset('style.css', '.hello{}');
                }
            }]
        };

        middleware({}, config, {})(
            createRequest('/style.css'), 
            createResponse(res => {
                expect(res.status).to.equal(200);
                expect(res.headers['Content-Type']).to.equal('text/css');
                expect(res.body.indexOf('.hello{}') > -1).to.be.true;
                done();
            }), 
            createNext()
        );
    });

    it ('should use full path for bundle if file option is used', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                file: 'public/dist/bundle.js',
                format: 'esm'
            }
        };

        middleware({}, config, {})(
            createRequest('/public/dist/bundle.js'), 
            createResponse(res => {
                expect(res.status).to.equal(200);
                expect(res.headers['Content-Type']).to.equal('application/javascript');
                expect(res.body.indexOf('123') > -1).to.be.true;
                done();
            }), 
            createNext()
        );
    });

    it ('should remove contentBase from file if file options outputs to contentBase', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                file: 'public/dist/bundle.js',
                format: 'esm'
            }
        };

        middleware({}, config, {
            contentBase: 'public'
        })(
            createRequest('/dist/bundle.js'), 
            createResponse(res => {
                expect(res.status).to.equal(200);
                expect(res.headers['Content-Type']).to.equal('application/javascript');
                expect(res.body.indexOf('123') > -1).to.be.true;
                done();
            }), 
            createNext()
        );
    });

    it ('should accept array of configurations for multiple bundles', function (done) {
        this.timeout(5000);

        fs.stub('./src/main-a.js', () => 'export default 123');
        fs.stub('./src/main-b.js', () => 'export default 456');

        let config = [{
            input: './src/main-a.js',
            output: {
                file: 'bundle-a.js',
                format: 'esm'
            }
        }, {
            input: './src/main-b.js',
            output: {
                file: 'bundle-b.js',
                format: 'esm'
            }
        }];

        let mw = middleware({}, config, {});

        Promise.all([
            mwFetch(mw, '/bundle-a.js'),
            mwFetch(mw, '/bundle-b.js')
        ]).then(responses => {
            expect(responses[0].status).to.equal(200);
            expect(responses[0].headers['Content-Type']).to.equal('application/javascript');
            expect(responses[0].body.indexOf('123') > -1).to.be.true;

            expect(responses[1].status).to.equal(200);
            expect(responses[1].headers['Content-Type']).to.equal('application/javascript');
            expect(responses[1].body.indexOf('456') > -1).to.be.true;
            done();
        });
    });

    it ('should accept array for output', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: [{
                file: 'bundle.esm.js',
                format: 'esm'
            }, {
                file: 'bundle.cjs.js',
                format: 'cjs'
            }]
        }

        let mw = middleware({}, config, {});

        Promise.all([
            mwFetch(mw, '/bundle.esm.js'),
            mwFetch(mw, '/bundle.cjs.js')
        ]).then(responses => {
            expect(responses[0].body.indexOf('123') > -1).to.be.true;
            expect(responses[0].body.indexOf('export default') > -1).to.be.true;

            expect(responses[1].body.indexOf('123') > -1).to.be.true;
            expect(responses[1].body.indexOf('module.exports = result.default') > -1).to.be.true;
            done();
        });
    });

    it ('should accept array of configs with array of outputs', function (done) {
        this.timeout(5000);

        fs.stub('./src/main-a.js', () => 'export default 123');
        fs.stub('./src/main-b.js', () => 'export default 456');

        let config = [{
            input: './src/main-a.js',
            output: [{
                file: 'bundle-a.esm.js',
                format: 'esm'
            }, {
                file: 'bundle-a.cjs.js',
                format: 'cjs'
            }, {
                file: 'bundle-a.iife.js',
                format: 'iife'
            }]
        }, {
            input: './src/main-b.js',
            output: [{
                file: 'bundle-b.esm.js',
                format: 'esm'
            }, {
                file: 'bundle-b.cjs.js',
                format: 'cjs'
            }, {
                file: 'bundle-b.iife.js',
                format: 'iife'
            }]
        }];

        let mw = middleware({}, config, {});

        Promise.all([
            mwFetch(mw, '/bundle-a.esm.js'),
            mwFetch(mw, '/bundle-a.cjs.js'),
            mwFetch(mw, '/bundle-a.iife.js'),
            mwFetch(mw, '/bundle-b.esm.js'),
            mwFetch(mw, '/bundle-b.cjs.js'),
            mwFetch(mw, '/bundle-b.iife.js')
        ]).then(responses => {
            expect(responses[0].status).to.equal(200);
            expect(responses[1].status).to.equal(200);
            expect(responses[2].status).to.equal(200);
            expect(responses[3].status).to.equal(200);
            expect(responses[4].status).to.equal(200);
            expect(responses[5].status).to.equal(200); 

            expect(responses[0].body.indexOf('export default') > -1).to.be.true;
            expect(responses[1].body.indexOf('module.exports = result') > -1).to.be.true;
            expect(responses[2].body.indexOf('export default') === -1).to.be.true;
            expect(responses[3].body.indexOf('export default') > -1).to.be.true;
            expect(responses[4].body.indexOf('module.exports = result') > -1).to.be.true;
            expect(responses[5].body.indexOf('export default') === -1).to.be.true;

            expect(responses[0].body.indexOf('123') > -1).to.be.true;
            expect(responses[1].body.indexOf('123') > -1).to.be.true;
            expect(responses[2].body.indexOf('123') > -1).to.be.true;
            expect(responses[3].body.indexOf('456') > -1).to.be.true;
            expect(responses[4].body.indexOf('456') > -1).to.be.true;
            expect(responses[5].body.indexOf('456') > -1).to.be.true;
            done();
        });
    });

    it ('should not serve any files if bundling is in progress', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let queue = [];
        let continueBuild = function () {
            queue.forEach(r => r());
        };

        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            },
            plugins: [{
                transform (code) {
                    return new Promise(resolve => {
                        queue.push(resolve);
                    });
                }
            }]
        };

        let mw = middleware({}, config, {});

        mwFetch(mw, '/bundle.js').then(res => {
            expect(res.status).to.equal(200);
            done();
        });

        setTimeout(() => {
            continueBuild();
        }, 2000);
    });

    it ('should call next if no file is found', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            }
        };

        middleware({}, config, {})(
            createRequest('/file.js'), 
            createResponse(res => {
                throw new Error('should not be here');
            }), 
            done
        );
    }); 

    it ('should capture bundling errors and print them', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            },
            plugins: [{
                transform (code) {
                    throw new Error('Transform Error');
                }
            }]
        };

        middleware({}, config, {})(
            createRequest('/bundle.js'), 
            createResponse(res => {
                throw new Error('should not be here');
            }), 
            createNext()
        );

        setTimeout(() => {
            expect(logs.length > 0).to.be.true;
            expect(logs[0].indexOf('Transform Error') > -1).to.be.true;
            done();
        }, 2000);
    });

    it ('should watch for file changes and trigger rebundle on change', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            }
        }

        let mw = middleware({}, config, {});

        mwFetch(mw, '/bundle.js').then(res => {
            fs.stub('./src/main.js', () => 'export default 456');
            chokidar.trigger('change', './src/main.js');
            mwFetch(mw, '/bundle.js').then(res => {
                expect(res.body.indexOf('456') > -1).to.be.true;
                done();
            });
        });
    });

    it ('should serve bundle after fixing build errors', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let phase = 0;
        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            },
            plugins: [{
                transform (code) {
                    if (phase === 0) {
                        throw new Error('transform error');
                    }

                    return code;
                }
            }]
        }

        let mw = middleware({}, config, {});

        mwFetch(mw, '/bundle.js').then(res => {
            expect(res.body.indexOf('456') > -1).to.be.true;
            done();
        });

        setTimeout(() => {
            phase++;
            fs.stub('./src/main.js', () => 'export default 456');
            chokidar.trigger('change', './src/main.js');
        }, 2000);
    });


    it ('should not serve any files while rebundling is in progress', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let queue = [];
        let continueBuild = function () {
            queue.forEach(r => r());
        };

        let phase = 0;
        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            },
            plugins: [{
                transform (code) {
                    if (phase === 1) {
                        phase = 2;
                        return new Promise(resolve => {
                            queue.push(resolve);
                        });
                    }
                }
            }]
        };

        let mw = middleware({}, config, {});

        mwFetch(mw, '/bundle.js').then(res => {
            expect(res.status).to.equal(200);
            phase++;
            fs.stub('./src/main.js', () => 'export default 456');
            chokidar.trigger('change', './src/main.js');

            mwFetch(mw, '/bundle.js').then(res => {
                expect(res.body.indexOf('456') > -1).to.be.true;
                expect(phase).to.equal(2);
                done();
            });

            setTimeout(() => {
                continueBuild();
            }, 2000);
        });
    });

    it ('should watch process.cwd() if watch directory not specified', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            }
        };

        let mw = middleware({}, config, {});
        mwFetch(mw, '/bundle.js').then(res => {
            expect(chokidar.basedir).to.equal(process.cwd());
            done();
        });
    });

    it ('should watch specified directory with options.watch', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            }
        };

        let mw = middleware({}, config, {
            watch: '/lol'
        });
        mwFetch(mw, '/bundle.js').then(res => {
            expect(chokidar.basedir).to.equal('/lol');
            done();
        });
    });

    it ('should not watch node_modules or .git directories', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            }
        };

        let mw = middleware({}, config, {});
        mwFetch(mw, '/bundle.js').then(res => {
            expect(chokidar.options.ignored('/code/my_project/node_modules/test')).to.be.true;
            expect(chokidar.options.ignored('/code/my_project/.git/test')).to.be.true;
            expect(chokidar.options.ignored('/code/my_project/test')).to.be.false;
            done();
        });
    }); 

    it ('should only watch modules specified by watch.include', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            },
            watch: {
                include: 'src/**'
            }
        };

        let mw = middleware({}, config, {});
        mwFetch(mw, '/bundle.js').then(res => {
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './src/myfile'))).to.be.false;
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './test/myfile'))).to.be.true;
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './node_modules/myfile'))).to.be.true;
            done();
        });
    });

    it ('should only watch modules specified by watch.include (multi-config)', function (done) {
        this.timeout(5000);

        fs.stub('./src-a/main-a.js', () => 'export default 123');
        fs.stub('./src-b/main-b.js', () => 'export default 123');

        let config = [{
            input: './src-a/main-a.js',
            output: {
                file: 'bundle-a.js',
                format: 'esm'
            },
            watch: {
                include: 'src-a/**'
            }
        }, {
            input: './src-b/main-b.js',
            output: {
                file: 'bundle-b.js',
                format: 'esm'
            },
            watch: {
                include: 'src-b/**'
            }
        }];

        let mw = middleware({}, config, {});
        mwFetch(mw, '/bundle-a.js').then(res => {
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './src-a/myfile'))).to.be.false;
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './src-b/myfile'))).to.be.false;
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './test/myfile'))).to.be.true;
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './node_modules/myfile'))).to.be.true;
            done();
        });
    });

    it ('should only watch modules specified by watch.include as array', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            },
            watch: {
                include: ['src/**', 'test/**']
            }
        };

        let mw = middleware({}, config, {});
        mwFetch(mw, '/bundle.js').then(res => {
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './src/myfile'))).to.be.false;
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './test/myfile'))).to.be.false;
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './node_modules/myfile'))).to.be.true;
            done();
        });
    });

    it ('should not watch modules specified by watch.exclude', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            },
            watch: {
                exclude: 'node_modules/**'
            }
        };

        let mw = middleware({}, config, {});
        mwFetch(mw, '/bundle.js').then(res => {
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './src/myfile'))).to.be.false;
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './test/myfile'))).to.be.false;
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './node_modules/myfile'))).to.be.true;
            done();
        });
    }); 

    it ('should not watch modules specified by watch.exclude as array', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            },
            watch: {
                exclude: ['node_modules/**', 'test/**']
            }
        };

        let mw = middleware({}, config, {});
        mwFetch(mw, '/bundle.js').then(res => {
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './src/myfile'))).to.be.false;
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './test/myfile'))).to.be.true;
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './node_modules/myfile'))).to.be.true;
            done();
        });
    }); 

    it ('should not watch modules specified by watch.exclude (multi-config)', function (done) {
        this.timeout(5000);

        fs.stub('./src-a/main-a.js', () => 'export default 123');
        fs.stub('./src-b/main-b.js', () => 'export default 123');

        let config = [{
            input: './src-a/main-a.js',
            output: {
                file: 'bundle-a.js',
                format: 'esm'
            },
            watch: {
                exclude: 'src-a/**'
            }
        }, {
            input: './src-b/main-b.js',
            output: {
                file: 'bundle-b.js',
                format: 'esm'
            },
            watch: {
                exclude: 'src-b/**'
            }
        }];

        let mw = middleware({}, config, {});
        mwFetch(mw, '/bundle-a.js').then(res => {
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './src-a/myfile'))).to.be.true;
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './src-b/myfile'))).to.be.true;
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './test/myfile'))).to.be.false;
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './node_modules/myfile'))).to.be.false;
            done();
        });
    });

    it ('should be able to combine watch.include and watch.exclude', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            },
            watch: {
                include: 'src/**',
                exclude: 'src/test/**'
            }
        };

        let mw = middleware({}, config, {});
        mwFetch(mw, '/bundle.js').then(res => {
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './src/myfile'))).to.be.false;
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './src/test/myfile'))).to.be.true;
            expect(chokidar.options.ignored(path.resolve(process.cwd(), './node_modules/myfile'))).to.be.true;
            done();
        });
    });  

    it ('should only trigger once in response to several file watch events', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            }
        }

        let mw = middleware({}, config, {});

        mwFetch(mw, '/bundle.js').then(res => {
            fs.stub('./src/main.js', () => 'export default 456');
            chokidar.trigger('change', './src/main.js');
            chokidar.trigger('change', './src/main.js');
            chokidar.trigger('change', './src/main.js');
            chokidar.trigger('change', './src/main.js');
            chokidar.trigger('change', './src/main.js');
            expect(logs.length).to.equal(1);
            mwFetch(mw, '/bundle.js').then(res => {
                expect(res.body.indexOf('456') > -1).to.be.true;
                expect(logs.length).to.equal(2);
                done();
            });
        });
    });

    it ('should not create HMR endpoints if hot not enabled', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            }
        }

        let mw = middleware({}, config, {});

        mwFetch(mw, '/bundle.js').then(res => {
            expect(expressWs._callbacks.length).to.equal(0);
            done();
        });
    });

    it ('should create a HMR endpoint for each bundle if hot enabled', function (done) {
        this.timeout(5000);

        fs.stub('./src/main-a.js', () => 'export default 123');
        fs.stub('./src/main-b.js', () => 'export default 456');

        let config = [{
            input: './src/main-a.js',
            output: [{
                file: 'bundle-a.esm.js',
                format: 'esm'
            }, {
                file: 'bundle-a.cjs.js',
                format: 'cjs'
            }]
        }, {
            input: './src/main-b.js',
            output: [{
                file: 'bundle-b.esm.js',
                format: 'esm'
            }, {
                file: 'bundle-b.cjs.js',
                format: 'cjs'
            }]
        }];

        let mw = middleware({}, config, {
            hot: true
        });

        Promise.all([
            mwFetch(mw, '/bundle-a.esm.js'),
            mwFetch(mw, '/bundle-a.cjs.js'),
            mwFetch(mw, '/bundle-b.esm.js'),
            mwFetch(mw, '/bundle-b.cjs.js'),
        ]).then(responses => {
            expect(expressWs._callbacks.length).to.equal(4);
            expect(expressWs._callbacks[0].path).to.equal('/__hmr')
            expect(expressWs._callbacks[1].path).to.equal('/__hmr1')
            expect(expressWs._callbacks[2].path).to.equal('/__hmr2')
            expect(expressWs._callbacks[3].path).to.equal('/__hmr3')
            done();
        });
    });

    it ('should send HMR greeting for new connections', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            }
        };

        let mw = middleware({}, config, {
            hot: true
        });

        mwFetch(mw, '/bundle.js').then(res => {
            let ws = new WebSocket('/__hmr');
            expect(ws._received[0]).to.equal('{"greeting":true}');
            done();
        });
    });

    it ('should send HMR statuses and changes', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            }
        };

        let mw = middleware({}, config, {
            hot: true
        });

        mwFetch(mw, '/bundle.js').then(res => {
            let ws = new WebSocket('/__hmr');
            fs.stub('./src/main.js', () => 'export default 456');
            chokidar.trigger('change', './src/main.js');
            expect(ws._received.length).to.equal(2);
            expect(ws._received[1]).to.equal('{"status":"check"}');

            mwFetch(mw, '/bundle.js').then(res => {
                expect(ws._received.length).to.equal(5);
                expect(ws._received[2]).to.equal('{"status":"prepare"}');
                expect(ws._received[3]).to.equal('{"status":"ready"}');
                expect(ws._received[4].startsWith('{"changes":')).to.be.true;
                expect(ws._received[4].indexOf('456') > 1).to.be.true;
                done();
            });
        });
    });

    it ('should not send HMR updates to closed connections', function (done) {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                file: 'bundle.js',
                format: 'esm'
            }
        };

        let mw = middleware({}, config, {
            hot: true
        });

        mwFetch(mw, '/bundle.js').then(res => {
            let ws = new WebSocket('/__hmr');
            fs.stub('./src/main.js', () => 'export default 456');
            chokidar.trigger('change', './src/main.js');
            expect(ws._received.length).to.equal(2);

            mwFetch(mw, '/bundle.js').then(res => {
                expect(ws._received.length).to.equal(5);
                ws.close();
                mwFetch(mw, '/bundle.js').then(res => {
                    expect(ws._received.length).to.equal(5);
                    done();
                });
            });
        });
    });    

    it ('should allow publicPath to be prefixed to all assets and chunks', async function () {
        this.timeout(5000);

        fs.stub('./src/other.js', () => 'export default 456')
        fs.stub('./src/main.js', () => 'import("./other");export default 123');

        let config = {
            input: './src/main.js',
            output: {
                dir: 'dist',
                assetFileNames: '[name][extname]',
                entryFileNames: '[name].js',
                chunkFileNames: 'chunk-[name].js',
                format: 'esm'
            },
            plugins: [{
                transform (code) {
                    this.emitAsset('style.css', '.hello{}');
                }
            }]
        };

        let mw = middleware({}, config, {
            publicPath: 'client'
        });

        let bundleRes = await mwFetch(mw, '/client/main.js');
        expect(bundleRes.status).to.equal(200);
        expect(bundleRes.body.indexOf('123') > -1).to.be.true;

        let assetRes = await mwFetch(mw, '/client/style.css');
        expect(assetRes.status).to.equal(200);
        expect(assetRes.body.indexOf('.hello{}') > -1).to.be.true;

        let dynRes = await mwFetch(mw, '/client/chunk-other.js');
        expect(dynRes.status).to.equal(200);
        expect(dynRes.body.indexOf('456') > -1).to.be.true;

        let passed = false;
        try {
            let badRes = await mwFetch(mw, '/main.css');
        } catch (e) {
            expect(e.indexOf('file not found') > -1).to.be.true;
            passed = true;
        }
        
        expect(passed).to.be.true;
    });

    it ('should allow publicPath to have slash at start of url', async function () {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                dir: 'dist',
                entryFileNames: '[name].js',
                format: 'esm'
            }
        };

        let mw = middleware({}, config, {
            publicPath: '/client'
        });

        let bundleRes = await mwFetch(mw, '/client/main.js');
        expect(bundleRes.status).to.equal(200);
        expect(bundleRes.body.indexOf('123') > -1).to.be.true;
    });

    it ('should allow publicPath to have slash at end of url', async function () {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                dir: 'dist',
                entryFileNames: '[name].js',
                format: 'esm'
            }
        };

        let mw = middleware({}, config, {
            publicPath: 'client/'
        });

        let bundleRes = await mwFetch(mw, '/client/main.js');
        expect(bundleRes.status).to.equal(200);
        expect(bundleRes.body.indexOf('123') > -1).to.be.true;
    });
    it ('should add headers provided', async function () {
        this.timeout(5000);

        fs.stub('./src/main.js', () => 'export default 123');

        let config = {
            input: './src/main.js',
            output: {
                dir: 'dist',
                entryFileNames: '[name].js',
                format: 'esm'
            }
        };

        let mw = middleware({}, config, {
            publicPath: 'client/',
            headers: {"Access-Control-Allow-Origin": "*"}
        });

        let bundleRes = await mwFetch(mw, '/client/main.js');
        expect(bundleRes.status).to.equal(200);
        expect(bundleRes.headers['Access-Control-Allow-Origin']).to.equal("*");
    });
});