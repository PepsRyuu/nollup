let plugin = require('../../lib/plugin-hmr');
let { expect, fs, nollup } = require('../nollup');

function createGlobals (env_options = {}) {
    let window = { 
        location: { 
            host: 'example.com',
            protocol: env_options.protocol || 'http:'
        } 
    }, stdout = [];

    let console = {
        log: function (...args) {
            stdout.push(args.join(' '));
        } 
    };

    let _ws = {
        onmessage: null,
        url: null,
        send: function (data) {
            this.onmessage({ data: JSON.stringify(data) });
        }
    }

    let WebSocket = function (url) {
        _ws.url = url;
        return _ws;
    };

    return { window, console, stdout, ws: _ws, WebSocket, __nollup__global__: window };
}

async function createNollupEnv () {
    let globals = createGlobals();
    let { window, console, WebSocket, __nollup__global__ } = globals;

    let bundle = await nollup({
        input: './src/main.js',
        plugins: [plugin()]
    });

    let { output } = await bundle.generate({ format: 'esm' });
    eval(output[0].code);
    fs.reset();
    return { window, console, ws: globals.ws, stdout: globals.stdout, bundle, __nollup__global__ };
}

function createEnv (input, options = {}, env_options = {}) {
    input = JSON.parse(JSON.stringify(input));
    options.bundleId = options.bundleId || '';

    let modules = input.map(m => m.code);
    let globals = createGlobals(env_options);
    let { window, console, WebSocket, __nollup__global__ } = globals;

    let plugin_instance = plugin(options);
    eval(plugin_instance.nollupBundleInit());

    function executeModule (id, deps, code) {
        let module = {
            id: id,
            dependencies: deps.slice(0)
        };

        eval(plugin_instance.nollupModuleInit());
        eval('(' + code + ')()');

        return module;
    }

    instances = input.map((m, i) => {
        return executeModule(i, m.dependencies, m.code);
    });

    return {
        instances,
        ws: globals.ws,
        console,
        window,
        modules,
        stdout: globals.stdout,
        executeModule: function (index) {
            instances[index] = executeModule(index, input[index].dependencies, modules[index])
        }
    };
}

describe('plugin-hmr', () => {
    describe('module.hot.accept()', () => {
        it ('should trigger accept for single parent and child', () => {
            let env = createEnv([{
                dependencies: [1],
                code: `
                    function () { module.hot.accept(() => { console.log('accept') }); }
                `
            }, {
                dependencies: [],
                code: 'function () {}'
            }]);

            env.ws.send({
                changes: [{
                    id: 1,
                    code: 'function () {}'
                }]
            });
            
            expect(env.stdout[0]).to.equal('accept');
        });

        it ('should trigger closest accept handler', () => {
            let env = createEnv([{
                dependencies: [1, 2],
                code: `
                    function () { module.hot.accept(() => { console.log('accept') }); }
                `
            }, {
                dependencies: [],
                code: `function () { module.hot.accept(() => { console.log('child_accept') }) }`
           }, {
                dependencies: [],
                code: 'function () {}'
           }]);

            env.ws.send({
                changes: [{
                    id: 1,
                    code: 'function () {}'
                }]
            });
            
            expect(env.stdout.length).to.equal(1);
            expect(env.stdout[0]).to.equal('child_accept');

            env.ws.send({
                changes: [{
                    id: 2,
                    code: 'function () {}'
                }]
            })

            expect(env.stdout.length).to.equal(2);
            expect(env.stdout[0]).to.equal('child_accept');
            expect(env.stdout[1]).to.equal('accept');
        });

        it ('should set invalidate on instances that are on the branch to the closest accept handler', () => {
            let envTemplate = [{
                dependencies: [1, 2],
                code: `
                    function () { module.hot.accept(() => { console.log('accept') }); }
                `
            }, {
                dependencies: [],
                code: `function () { module.hot.accept(() => { console.log('child_accept') }) }`
           }, {
                dependencies: [],
                code: 'function () {}'
            }]

            let env = createEnv(envTemplate);
            env.ws.send({
                changes: [{
                    id: 1,
                    code: 'function () {}'
                }]
            });
            
            expect(env.instances[0].invalidate).not.to.be.true;
            expect(env.instances[1].invalidate).to.be.true;
            expect(env.instances[2].invalidate).not.to.be.true;
            env = createEnv(envTemplate);
            env.ws.send({
                changes: [{
                    id: 2,
                    code: 'function () {}'
                }]
            })

            expect(env.instances[0].invalidate).to.be.true;
            expect(env.instances[1].invalidate).not.to.be.true;
            expect(env.instances[2].invalidate).to.be.true;
        });

        it ('should trigger multiple branch accepts on same level', () => {
            let envTemplate = [{
                dependencies: [1, 2],
                code: `
                    function () { 
                        module.hot.accept(() => { console.log('mod0 accept') }); 
                        module.hot.dispose(() => { console.log('mod0 dispose') });
                    }
                `
            }, {
                dependencies: [3],
                code: `function () { 
                    module.hot.accept(() => { console.log('mod1 accept') }); 
                    module.hot.dispose(() => { console.log('mod1 dispose') })
                }`
           }, {
                dependencies: [3],
                code: `function () { 
                    module.hot.accept(() => { console.log('mod2 accept') }); 
                    module.hot.dispose(() => { console.log('mod2 dispose') })
                }`
            }, {
                dependencies: [],
                code: `function () { 
                    module.hot.dispose(() => { console.log('mod3 dispose') })
                }`
            }]

            let env = createEnv(envTemplate);
            env.ws.send({
                changes: [{
                    id: 3,
                    code: 'function () {}'
                }]
            });
            
            expect(env.stdout.length).to.equal(5);
            expect(env.stdout[0]).to.equal('mod3 dispose');
            expect(env.stdout[1]).to.equal('mod1 dispose');
            expect(env.stdout[2]).to.equal('mod2 dispose');
            expect(env.stdout[3]).to.equal('mod1 accept');
            expect(env.stdout[4]).to.equal('mod2 accept');
        })

        it ('should execute accept on root module if root module updates', () => {
            let env = createEnv([{
                dependencies: [],
                code: `
                    function () { module.hot.accept(() => { console.log('accept') }); }
                `
            }]);

            env.ws.send({
                changes: [{
                    id: 0,
                    code: 'function () {}'
                }]
            });
            
            expect(env.stdout[0]).to.equal('accept');
        });

        it ('should handle circular deps when finding accept', () => {
            let envTemplate = [{
                dependencies: [1],
                code: `
                    function () { module.hot.accept(() => { console.log('mod0 accept') }); }
                `
            }, {
                dependencies: [2],
                code: `function () { module.hot.dispose(() => { console.log('mod1 dispose') }) }`
           }, {
                dependencies: [1],
                code: `function () { module.hot.dispose(() => { console.log('mod2 dispose') }) }`
            }]

            let env = createEnv(envTemplate);
            env.ws.send({
                changes: [{
                    id: 1,
                    code: 'function () {}'
                }]
            });

            expect(env.stdout.length).to.equal(2);
            expect(env.stdout[0]).to.equal('mod1 dispose');
            expect(env.stdout[1]).to.equal('mod0 accept');
        });

        it ('should pass disposed argument into accept containing disposed module for that branch', () => {
            let envTemplate = [{
                dependencies: [1, 2],
                code: `
                    function () { 
                        module.hot.accept((e) => { console.log('mod0 ' + JSON.stringify(e.disposed)) }); 
                        module.hot.dispose(() => { console.log('mod0 dispose') });
                    }
                `
            }, {
                dependencies: [3],
                code: `function () { 
                    module.hot.accept((e) => { console.log('mod1 ' + JSON.stringify(e.disposed)) }); 
                    module.hot.dispose(() => { console.log('mod1 dispose') })
                }`
           }, {
                dependencies: [3],
                code: `function () { 
                    module.hot.dispose(() => { console.log('mod2 dispose') })
                }`
            }, {
                dependencies: [],
                code: `function () { 
                    module.hot.dispose(() => { console.log('mod3 dispose') })
                }`
            }]

            let env = createEnv(envTemplate);
            env.ws.send({
                changes: [{
                    id: 3,
                    code: 'function () {}'
                }]
            });
            
            expect(env.stdout.length).to.equal(6);
            expect(env.stdout[0]).to.equal('mod3 dispose');
            expect(env.stdout[1]).to.equal('mod1 dispose');
            expect(env.stdout[2]).to.equal('mod2 dispose');
            expect(env.stdout[3]).to.equal('mod0 dispose');
            expect(env.stdout[4]).to.equal('mod1 [3,1]');
            expect(env.stdout[5]).to.equal('mod0 [3,2,0]');
        })
    });

    describe('module.hot.dispose()', () => {
        it ('should only dispose the module being updated if an accept is there', () => {
            let envTemplate = [{
                dependencies: [1, 2],
                code: `
                    function () { 
                        module.hot.accept(() => { console.log('mod0 accept') }); 
                        module.hot.dispose(() => { console.log('mod0 dispose') });
                    }
                `
            }, {
                dependencies: [],
                code: `function () { 
                    module.hot.accept(() => { console.log('mod1 accept') }) 
                    module.hot.dispose(() => { console.log('mod1 dispose') })
                }`
           }, {
                dependencies: [],
                code: `function () {}`
            }]

            let env = createEnv(envTemplate);
            env.ws.send({
                changes: [{
                    id: 1,
                    code: 'function () {}'
                }]
            });
            
            expect(env.stdout.length).to.equal(2);
            expect(env.stdout[0]).to.equal('mod1 dispose');
            expect(env.stdout[1]).to.equal('mod1 accept');

            env = createEnv(envTemplate);
            env.ws.send({
                changes: [{
                    id: 2,
                    code: 'function () {}'
                }]
            })

            expect(env.stdout.length).to.equal(2);
            expect(env.stdout[0]).to.equal('mod0 dispose');
            expect(env.stdout[1]).to.equal('mod0 accept');
        });

        it ('should dispose until it finds an accept handler', () => {
            let envTemplate = [{
                dependencies: [1],
                code: `
                    function () { 
                        module.hot.accept(() => { console.log('mod0 accept') }); 
                        module.hot.dispose(() => { console.log('mod0 dispose') });
                    }
                `
            }, {
                dependencies: [2],
                code: `function () { 
                    module.hot.dispose(() => { console.log('mod1 dispose') })
                }`
           }, {
                dependencies: [],
                code: `function () { 
                    module.hot.dispose(() => { console.log('mod2 dispose') })
                }`
            }]

            let env = createEnv(envTemplate);
            env.ws.send({
                changes: [{
                    id: 2,
                    code: 'function () {}'
                }]
            });
            
            expect(env.stdout.length).to.equal(4);
            expect(env.stdout[0]).to.equal('mod2 dispose');
            expect(env.stdout[1]).to.equal('mod1 dispose');
            expect(env.stdout[2]).to.equal('mod0 dispose');
            expect(env.stdout[3]).to.equal('mod0 accept');
        });

        it ('should dispose on multiple branches', () => {
            let envTemplate = [{
                dependencies: [1, 2],
                code: `
                    function () { 
                        module.hot.accept(() => { console.log('mod0 accept') }); 
                        module.hot.dispose(() => { console.log('mod0 dispose') });
                    }
                `
            }, {
                dependencies: [3],
                code: `function () { 
                    module.hot.dispose(() => { console.log('mod1 dispose') })
                }`
           }, {
                dependencies: [3],
                code: `function () { 
                    module.hot.dispose(() => { console.log('mod2 dispose') })
                }`
            }, {
                dependencies: [],
                code: `function () { 
                    module.hot.dispose(() => { console.log('mod3 dispose') })
                }`
            }]

            let env = createEnv(envTemplate);
            env.ws.send({
                changes: [{
                    id: 3,
                    code: 'function () {}'
                }]
            });
            
            expect(env.stdout.length).to.equal(5);
            expect(env.stdout[0]).to.equal('mod3 dispose');
            expect(env.stdout[1]).to.equal('mod1 dispose');
            expect(env.stdout[2]).to.equal('mod0 dispose');
            expect(env.stdout[3]).to.equal('mod2 dispose');
            expect(env.stdout[4]).to.equal('mod0 accept');
        });

        it ('should not dispose anything unless accept is found', () => {
            let envTemplate = [{
                dependencies: [1, 2],
                code: `
                    function () { 
                        module.hot.dispose(() => { console.log('mod0 dispose') });
                    }
                `
            }, {
                dependencies: [3],
                code: `function () { 
                    module.hot.dispose(() => { console.log('mod1 dispose') })
                }`
           }, {
                dependencies: [3],
                code: `function () { 
                    module.hot.dispose(() => { console.log('mod2 dispose') })
                }`
            }, {
                dependencies: [],
                code: `function () { 
                    module.hot.dispose(() => { console.log('mod3 dispose') })
                }`
            }]

            let env = createEnv(envTemplate);
            env.ws.send({
                changes: [{
                    id: 3,
                    code: 'function () {}'
                }]
            });
            
            expect(env.stdout.length).to.equal(0);
        });

        it ('should only dispose modules that have an accept handler on their branch', () => {
            let envTemplate = [{
                dependencies: [1, 2],
                code: `
                    function () { 
                        module.hot.dispose(() => { console.log('mod0 dispose') });
                    }
                `
            }, {
                dependencies: [3],
                code: `function () { 
                    module.hot.accept(() => { console.log('mod1 accept') }); 
                    module.hot.dispose(() => { console.log('mod1 dispose') })
                }`
           }, {
                dependencies: [3],
                code: `function () { 
                    module.hot.dispose(() => { console.log('mod2 dispose') })
                }`
            }, {
                dependencies: [],
                code: `function () { 
                    module.hot.dispose(() => { console.log('mod3 dispose') })
                }`
            }]

            let env = createEnv(envTemplate);
            env.ws.send({
                changes: [{
                    id: 3,
                    code: 'function () {}'
                }]
            });
            
            expect(env.stdout.length).to.equal(3);
            expect(env.stdout[0]).to.equal('mod3 dispose');
            expect(env.stdout[1]).to.equal('mod1 dispose');
            expect(env.stdout[2]).to.equal('mod1 accept');
        });
    });

    describe('module.hot.data', () => {
        it ('should be undefined on first load', () => {
            let envTemplate = [{
                dependencies: [],
                code: `
                    function () { 
                        console.log(typeof module.hot.data);    
                    }
                `
            }];

            let env = createEnv(envTemplate);
            expect(env.stdout.length).to.equal(1);
            expect(env.stdout[0]).to.equal('undefined');
        });

        it ('should be empty object on module reload, even if no dispose handlers', () => {
            let envTemplate = [{
                dependencies: [1],
                code: `
                    function () { 
                        module.hot.accept(() => {});
                        console.log('mod0 ' + typeof module.hot.data);    
                    }
                `
            }, {
                dependencies: [],
                code: `
                    function () { 
                        console.log('mod1 ' + typeof module.hot.data);    
                    }
                `
            }];

            let env = createEnv(envTemplate);

            env.ws.send({
                changes: [{
                    id: 1,
                    code: `
                        function () {
                            console.log('mod1 ' + typeof module.hot.data)
                        }
                    `
                }]
            });

            env.executeModule(0);
            env.executeModule(1);
            expect(env.stdout.length).to.equal(4);
            expect(env.stdout[0]).to.equal('mod0 undefined');
            expect(env.stdout[1]).to.equal('mod1 undefined');
            expect(env.stdout[2]).to.equal('mod0 object');
            expect(env.stdout[3]).to.equal('mod1 object');
        });

        it ('should pass empty object to hold data into dispose method', () => {
            let envTemplate = [{
                dependencies: [],
                code: `
                    function () { 
                        module.hot.accept(() => {});
                        module.hot.dispose(data => { console.log(JSON.stringify(data)) });
                    }
                `
            }];

            let env = createEnv(envTemplate);
            env.ws.send({
                changes: [{
                    id: 0,
                    code: 'function () {}'
                }]
            });

            expect(env.stdout.length).to.equal(1);
            expect(env.stdout[0]).to.equal('{}');
        });

        it ('should have module.hot.data containing data from original dispose method', () => {
            let envTemplate = [{
                dependencies: [],
                code: `
                    function () { 
                        module.hot.accept(() => {});
                        module.hot.dispose(data => { 
                            data.hello = 'world';
                        });
                    }
                `
            }];

            let env = createEnv(envTemplate);
            env.ws.send({
                changes: [{
                    id: 0,
                    code: `function () {
                        console.log('entry ' + JSON.stringify(module.hot.data));
                    }`
                }]
            });

            env.executeModule(0);
            expect(env.stdout.length).to.equal(1);
            expect(env.stdout[0]).to.equal('entry {"hello":"world"}');
        });

        it ('should pass empty object regardless of modifications to hold data into dispose method', () => {
            let envTemplate = [{
                dependencies: [],
                code: `
                    function () { 
                        module.hot.accept(() => {});
                        module.hot.dispose(data => { 
                            console.log('dispose ' + JSON.stringify(data));
                            data.hello = 'world';
                        });
                    }
                `
            }];

            let env = createEnv(envTemplate);
            env.ws.send({
                changes: [{
                    id: 0,
                    code: envTemplate[0].code
                }]
            });

            env.executeModule(0);

            env.ws.send({
                changes: [{
                    id: 0,
                    code: envTemplate[0].code
                }]
            });

            expect(env.stdout.length).to.equal(2);
            expect(env.stdout[0]).to.equal('dispose {}');
            expect(env.stdout[1]).to.equal('dispose {}');
        });

    });

    describe('module.hot.addStatusHandler()', () => {
        it ('should trigger callback each time status changes', () => {
            let envTemplate = [{
                dependencies: [1],
                code: `
                    function () { 
                        module.hot.addStatusHandler(status => console.log('mod0 status ' + status));
                        module.hot.accept(() => { console.log('mod0 accept') }); 
                        module.hot.dispose(() => { console.log('mod0 dispose') });
                    }
                `
            }, {
                dependencies: [],
                code: `function () { 
                    module.hot.addStatusHandler(status => console.log('mod1 status ' + status));
                    module.hot.accept(() => { console.log('mod1 accept') }) 
                    module.hot.dispose(() => { console.log('mod1 dispose') })
                }`
            }];

            let env = createEnv(envTemplate);
            env.ws.send({
                changes: [{
                    id: 1,
                    code: 'function () {}'
                }]
            });

            expect(env.stdout[0]).to.equal('mod0 status dispose');
            expect(env.stdout[1]).to.equal('mod1 status dispose');
            expect(env.stdout[2]).to.equal('mod1 dispose');
            expect(env.stdout[3]).to.equal('mod0 status apply');
            expect(env.stdout[4]).to.equal('mod1 status apply');
            expect(env.stdout[5]).to.equal('mod1 accept');
            expect(env.stdout[6]).to.equal('mod0 status idle');
            expect(env.stdout[7]).to.equal('mod1 status idle');
        });

        it ('should trigger for remote status changes from socket', () => {
            let envTemplate = [{
                dependencies: [],
                code: `
                    function () { 
                        module.hot.addStatusHandler(status => console.log('status ' + status));
                    }
                `
            }];

            let env = createEnv(envTemplate);
            env.ws.send({
                status: 'remote'
            });

            expect(env.stdout[0]).to.equal('status remote');
        })
    });

    describe('module.hot.status()', () => {
        it ('should return current HMR updating status', () => {
            let envTemplate = [{
                dependencies: [1],
                code: `
                    function () { 
                        module.hot.addStatusHandler(() => 
                            console.log('status ' + module.hot.status())
                        );
                        module.hot.accept(() => {})
                    }
                `
            }, {
                dependencies: [],
                code: `function () { 
                    module.hot.dispose(() => { })
                }`
            }];

            let env = createEnv(envTemplate);
            env.ws.send({
                changes: [{
                    id: 1,
                    code: 'function () {}'
                }]
            });

            expect(env.stdout[0]).to.equal('status dispose');
            expect(env.stdout[1]).to.equal('status apply');
            expect(env.stdout[2]).to.equal('status idle');
        });

        it ('should return remote status for HMR from socket', () => {
            let envTemplate = [{
                dependencies: [],
                code: `
                    function () { 
                        module.hot.addStatusHandler(() => 
                            console.log('status ' + module.hot.status())
                        );
                    }
                `
            }];

            let env = createEnv(envTemplate);
            env.ws.send({
                status: 'remote'
            });

            expect(env.stdout[0]).to.equal('status remote');
        })
    });

    describe('module.hot.removeStatusHandler()', () => {
        it ('should remove a callback for listening to statuses', () => {
            let envTemplate = [{
                dependencies: [1],
                code: `
                    function () { 
                        let cb = () => console.log('mod0 status ' + module.hot.status())
                        module.hot.addStatusHandler(cb);
                        module.hot.removeStatusHandler(cb);
                    }
                `
            }, {
                dependencies: [],
                code: `
                    function () {
                        module.hot.addStatusHandler(() => {
                            console.log('mod1 status ' + module.hot.status());
                        })
                    }
                `
            }];

            let env = createEnv(envTemplate);
            env.ws.send({
                status: 'remote'
            });

            expect(env.stdout.length).to.equal(1);
            expect(env.stdout[0]).to.equal('mod1 status remote');
        });
    });

    describe('Option: hmrHost', () => {
        it ('should use window.location.host by default for WebSocket', () => {
            let env = createEnv([{
                dependencies: [],
                code: `function () {}`
            }]);

            expect(env.ws.url).to.equal('ws://example.com/__hmr');
        });

        it ('should use hmrHost if provided instead of window location host', () => {
            let env = createEnv([{
                dependencies: [],
                code: `function () {}`
            }], { hmrHost: 'mydomain.com' });

            expect(env.ws.url).to.equal('ws://mydomain.com/__hmr');
        });
    });

    describe('Option: bundleId', () => {
        it ('should postfix the bundleId for window.__hot', () => {
            let env = createEnv([{
                dependencies: [],
                code: `function () {}`
            }], { bundleId: '123' });

            expect(env.window.__hot).to.be.undefined;
            expect(env.window.__hot123).not.to.be.undefined;
        });

        it ('should connect to websocket with same bundleId', () => {
            let env = createEnv([{
                dependencies: [],
                code: `function () {}`
            }], { bundleId: '123' });

            expect(env.ws.url).to.equal('ws://example.com/__hmr123');
        });

        it ('should not break status updates', () => {
            let envTemplate = [{
                dependencies: [1],
                code: `
                    function () { 
                        let cb = () => console.log('mod0 status ' + module.hot.status())
                        module.hot.addStatusHandler(cb);
                        module.hot.removeStatusHandler(cb);
                    }
                `
            }, {
                dependencies: [],
                code: `
                    function () {
                        module.hot.addStatusHandler(() => {
                            console.log('mod1 status ' + module.hot.status());
                        })
                    }
                `
            }];

            let env = createEnv(envTemplate, { bundleId: '123' });
            env.ws.send({
                status: 'remote'
            });

            expect(env.window.__hot123).not.to.be.undefined;
            expect(env.stdout.length).to.equal(1);
            expect(env.stdout[0]).to.equal('mod1 status remote');
        });
    });

    describe('Option: verbose', () => {
        it ('should output Status Change HMR logs if enabled', () => {
            let envTemplate = [{
                dependencies: [],
                code: `function () {}`
            }];

            let env = createEnv(envTemplate, { verbose: true });
            env.ws.send({
                status: 'remote'
            });

            expect(env.stdout[0]).to.equal('[HMR] Status Change remote');
        });
    });

    describe('Message: greeting', () => {
        it ('should not output anything if verbose not enabled', () => {
             let envTemplate = [{
                dependencies: [],
                code: `function () {}`
            }];

            let env = createEnv(envTemplate, { verbose: false });
            env.ws.send({
                greeting: true
            });

            expect(env.stdout.length).to.equal(0);
        });

        it ('should output Enabled log if greeting received over socket', () => {
            let envTemplate = [{
                dependencies: [],
                code: `function () {}`
            }];

            let env = createEnv(envTemplate, { verbose: true });
            env.ws.send({
                greeting: true
            });

            expect(env.stdout[0]).to.equal('[HMR] Enabled');
        });
    });

    describe ('Bindings', () => {
        it ('should update direct bindings for modules who import an updated module', async () => {
            fs.stub('./src/main.js', () => `
                import message from './message';

                window.print = function () {
                    console.log(message);
                };
            `);

            fs.stub('./src/message.js', () => `
                module.hot.accept(() => {
                    require(module.id);
                });
                export default 'hello';
            `);

            let env = await createNollupEnv();
            env.window.print();

            fs.stub('./src/message.js', () => `
                module.hot.accept(() => {
                    require(module.id);
                });
                export default 'world';
            `);

            env.bundle.invalidate('./src/message.js');
            let { changes } = await env.bundle.generate({ format: 'esm' });
            env.ws.send({ changes });
            env.window.print();

            expect(env.stdout.length).to.equal(2);
            expect(env.stdout[0]).to.equal('hello');
            expect(env.stdout[1]).to.equal('world');
        });

        it ('should update binding for accepted branch only', async () => {
            fs.stub('./src/main.js', () => `
                import MessageFoo from './message-foo';
                import MessageBar from './message-bar';

                window.print = function () {
                    console.log(MessageFoo + ' ' + MessageBar);
                };
            `);

            fs.stub('./src/message-foo.js', () => `
                import Message from './message';

                module.hot.accept(() => {
                    require(module.id);
                });
                export default Message + ' foo';
            `);

            fs.stub('./src/message-bar.js', () => `
                import Message from './message';
                export default Message + ' bar';
            `);

            fs.stub('./src/message.js', () => `
                export default 'hello';
            `);

            let env = await createNollupEnv();
            env.window.print();

            fs.stub('./src/message.js', () => `
                export default 'world';
            `);

            env.bundle.invalidate('./src/message.js');
            let { changes } = await env.bundle.generate({ format: 'esm' });

            env.ws.send({ changes });
            env.window.print();

            expect(env.stdout.length).to.equal(2);
            expect(env.stdout[0]).to.equal('hello foo hello bar');
            expect(env.stdout[1]).to.equal('world foo hello bar');
        });

         it ('should update bindings for all accepted branches', async () => {
            fs.stub('./src/main.js', () => `
                import MessageFoo from './message-foo';
                import MessageBar from './message-bar';

                window.print = function () {
                    console.log(MessageFoo + ' ' + MessageBar);
                };
            `);

            fs.stub('./src/message-foo.js', () => `
                import Message from './message';

                module.hot.accept(() => {
                    require(module.id);
                });
                export default Message + ' foo';
            `);

            fs.stub('./src/message-bar.js', () => `
                import Message from './message';
                module.hot.accept(() => {
                    require(module.id);
                });
                export default Message + ' bar';
            `);

            fs.stub('./src/message.js', () => `
                export default 'hello';
            `);

            let env = await createNollupEnv();
            env.window.print();

            fs.stub('./src/message.js', () => `
                export default 'world';
            `);

            env.bundle.invalidate('./src/message.js');
            let { changes } = await env.bundle.generate({ format: 'esm' });

            env.ws.send({ changes });
            env.window.print();

            expect(env.stdout.length).to.equal(2);
            expect(env.stdout[0]).to.equal('hello foo hello bar');
            expect(env.stdout[1]).to.equal('world foo world bar');
        });
    });

    describe('Module Adding/Removal', () => {
        it ('should not fail when adding a module for the first time', async () => {
            fs.stub('./src/main.js', () => `
                import MessageFoo from './message-foo';

                module.hot.accept(() => {
                    require(module.id);
                });

                window.print = () => {
                    console.log(typeof MessageFoo + ' ' + typeof MessageBar);
                }
            `);

            fs.stub('./src/message-foo.js', () => `
                import Message from './message';
                export default Message + ' foo';
            `);

            fs.stub('./src/message.js', () => `
                export default 'hello';
            `);

            let env = await createNollupEnv();
            env.window.print();

            {
                fs.stub('./src/message-bar.js', () => `
                    import Message from './message';
                    export default Message + ' bar';
                `);

                fs.stub('./src/main.js', () => `
                    import MessageFoo from './message-foo';
                    import MessageBar from './message-bar';

                    module.hot.accept(() => {
                        require(module.id);
                    });

                    window.print = () => {
                        console.log(typeof MessageFoo + ' ' + typeof MessageBar);
                    }
                `);

                env.bundle.invalidate('./src/main.js');
                let { changes } = await env.bundle.generate({ format: 'esm' });
                env.ws.send({ changes });
                env.window.print(); 
            }
            
            expect(env.stdout.length).to.equal(2);
            expect(env.stdout[0]).to.equal('string undefined');
            expect(env.stdout[1]).to.equal('string string');
        });

        it ('should not fail when removing and readding a module', async () => {
            fs.stub('./src/main.js', () => `
                import MessageFoo from './message-foo';
                import MessageBar from './message-bar';

                module.hot.accept(() => {
                    require(module.id);
                });

                window.print = () => {
                    console.log(typeof MessageFoo + ' ' + typeof MessageBar);
                }
            `);

            fs.stub('./src/message-foo.js', () => `
                import Message from './message';
                export default Message + ' foo';
            `);

            fs.stub('./src/message-bar.js', () => `
                import Message from './message';
                export default Message + ' bar';
            `);

            fs.stub('./src/message.js', () => `
                export default 'hello';
            `);

            let env = await createNollupEnv();
            env.window.print();

            {
                fs.stub('./src/main.js', () => `
                    import MessageFoo from './message-foo';

                    module.hot.accept(() => {
                        require(module.id);
                    });

                    window.print = () => {
                        console.log(typeof MessageFoo + ' ' + typeof MessageBar);
                    }
                `);

                env.bundle.invalidate('./src/main.js');
                let { changes } = await env.bundle.generate({ format: 'esm' });
                env.ws.send({ changes });
                env.window.print(); 
            }
          
            {
                fs.stub('./src/main.js', () => `
                    import MessageFoo from './message-foo';
                    import MessageBar from './message-bar';

                    module.hot.accept(() => {
                        require(module.id);
                    });

                    window.print = () => {
                        console.log(typeof MessageFoo + ' ' + typeof MessageBar);
                    }
                `);

                fs.stub('./src/message-bar.js', () => `
                    import Message from './message';
                    export default Message + ' bar';
                `);

                env.bundle.invalidate('./src/main.js');
                let { changes } = await env.bundle.generate({ format: 'esm' });
                env.ws.send({ changes });
                env.window.print();
            }
            
            expect(env.stdout.length).to.equal(3);
            expect(env.stdout[0]).to.equal('string string');
            expect(env.stdout[1]).to.equal('string undefined');
            expect(env.stdout[2]).to.equal('string string');
        });
    });

    describe('Misc', () => {
        it ('should use wss:// instead of ws:// when on https://', async () => {
            let env = createEnv([{
                dependencies: [],
                code: `function () {}`
            }], {}, {
                protocol: 'https:'
            });

            expect(env.ws.url).to.equal('wss://example.com/__hmr');
        });
    })
});