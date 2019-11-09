let plugin = require('../../lib/plugin-hmr');
let { expect } = require('../nollup');

function createEnv (modules, options = {}) {
    modules = JSON.parse(JSON.stringify(modules));
    options.bundleId = options.bundleId || '';

    let window = { location: { host: 'example.com' } }, instances = [], stdout = [];
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

    let plugin_instance = plugin(options);
    eval(plugin_instance.nollupBundleInit());

    instances = modules.map(m => {
        let module = {
            dependencies: m.dependencies.slice(0)
        };

        eval(plugin_instance.nollupModuleInit());
        eval('(' + m.code + ')()');

        return module;
    });

    return {
        instances,
        ws: _ws,
        console,
        window,
        modules: modules.map(m => m.code),
        stdout
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

        it ('should execute accept on root module if root module updates');
        it ('should handle circular deps when finding accept');
    });

    describe('module.hot.dispose()', () => {
        it ('should only trigger dispose for the module being updated', () => {
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
            expect(env.stdout[0]).equal('mod1 dispose');
            expect(env.stdout[1]).equal('mod1 accept');

            env = createEnv(envTemplate);
            env.ws.send({
                changes: [{
                    id: 2,
                    code: 'function () {}'
                }]
            })

            expect(env.stdout.length).to.equal(1);
            expect(env.stdout[0]).equal('mod0 accept');
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
});