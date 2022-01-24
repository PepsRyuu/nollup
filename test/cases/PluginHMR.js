let plugin = require('../../lib/plugin-hmr');
let { expect, fs, nollup } = require('../nollup');
let Evaluator = require('../utils/evaluator');
let wait = require('../utils/wait');
let WebSocket = require('ws');
let http = require('http');

function createServer (opts = {}) {
    let server = http.createServer(() => {});
    let wsServer = new WebSocket.Server({ noServer: true });
    let sockets = [];

    let urls = opts.urls || ['/__hmr'];

    server.on('upgrade', (req, socket, head) => {
        if (urls.indexOf(req.url) > -1) {
            wsServer.handleUpgrade(req, socket, head, ws => {
                sockets.push(ws);
                ws.on('close', () => {
                    sockets.splice(sockets.indexOf(ws), 1);
                });
            })
        }
    });

    return new Promise(resolve => {
        server.listen(14500, () => {
            resolve({
                location () {
                    return { protocol: 'http', host: 'localhost:14500' };
                },

                send(msg) {
                    sockets.forEach(s => s.send(JSON.stringify(msg)));
                },

                close () {
                    sockets.forEach(s => s.close());
                    return new Promise(resolve => server.close(resolve));
                }
            });
        });

    });
}

describe('plugin-hmr', () => {
    let server, bundle, globals;

    async function createBundle (opts = {}) {
        server = await createServer();
        bundle = await nollup({ input: './src/main.js', plugins: [ plugin(opts) ]});
        let generated = await bundle.generate({ format: 'esm' });
        let result = await Evaluator.init('esm', 'main.js', generated.output, { location: server.location() }, true);
        globals = result.globals;
    }

    async function invalidate (file, code) {
        fs.stub(file, () => code);
        await bundle.invalidate(file);
        let generated = await bundle.generate({ format: 'esm' });
        await Evaluator.invalidate(generated.output);
        server.send({ changes: generated.changes });
    }

    afterEach(() => {
        bundle = undefined;
        globals = undefined;
        fs.reset();

        if (server) {
            server.close();
        }
    });

    describe('module.hot.accept()', () => {
        it ('should trigger accept for single parent and child', async () => {
            fs.stub('./src/main.js', () => `
                import './dep'; 
                module.hot.accept(() => { console.log('accept') });
            `);

            fs.stub('./src/dep.js', () => `export default 123`);

            await createBundle();
            await invalidate('./src/dep.js', `export default 456`);

            let logs = await Evaluator.logs();
            expect(logs.length).to.equal(1);
            expect(logs[0]).to.equal('accept');
        })

        it ('should trigger closest accept handler', async () => {
            fs.stub('./src/main.js', () => `
                import './dep1'; 
                import './dep2'; 
                module.hot.accept(() => console.log('accept'));
            `);

            fs.stub('./src/dep1.js', () => `export default 0; module.hot.accept(() => console.log('child_accept'))`);
            fs.stub('./src/dep2.js', () => `export default 0`);

            await createBundle();
            await invalidate('./src/dep1.js', `export default 1`);

            let logs = await Evaluator.logs();
            expect(logs.length).to.equal(1);
            expect(logs[0]).to.equal('child_accept');

            await invalidate('./src/dep2.js', `export default 1`);

            logs = await Evaluator.logs();
            expect(logs.length).to.equal(1);
            expect(logs[0]).to.equal('accept');
        });

        it ('should set invalidate on instances that are on the branch to the closest accept handler', async () => {
            fs.stub('./src/main.js', () => `
                import './dep1';
                import './dep2';
                module.hot.accept(() => { console.log(JSON.stringify(globalThis.instances)); require(module.id); });
            `);

            fs.stub('./src/dep1.js', () => `
                module.hot.accept(() => { console.log(JSON.stringify(globalThis.instances));  require(module.id); })
            `);

            fs.stub('./src/dep2.js', () => ``);

            server = await createServer();
            bundle = await nollup({ input: './src/main.js', plugins: [ plugin(), { 
                nollupBundleInit () {
                    return `globalThis.instances = instances;`
                }
            } ]});
            let generated = await bundle.generate({ format: 'esm' });
            await Evaluator.init('esm', 'main.js', generated.output, { location: server.location() }, true);
            
            await invalidate('./src/dep1.js', ``);

            let logs = await Evaluator.logs(1);
            let instances = JSON.parse(logs[0]);
            expect(instances[0].invalidate).not.to.be.true;
            expect(instances[1].invalidate).to.be.true;
            expect(instances[2].invalidate).not.to.be.true;

            await invalidate('./src/dep2.js', ``);

            logs = await Evaluator.logs(1);
            instances = JSON.parse(logs[0]);
            expect(instances[0].invalidate).to.be.true;
            expect(instances[1].invalidate).not.to.be.true;
            expect(instances[2].invalidate).to.be.true;
        });

        it ('should trigger multiple branch accepts on same level', async () => {
            fs.stub('./src/main.js', () => `
                import './dep1'; 
                import './dep2'; 
                module.hot.accept(() => { console.log('mod0 accept') }); 
                module.hot.dispose(() => { console.log('mod0 dispose') });
            `)

            fs.stub('./src/dep1.js', () => `
                import './dep3';
                module.hot.accept(() => { console.log('mod1 accept') }); 
                module.hot.dispose(() => { console.log('mod1 dispose') })
            `);

            fs.stub('./src/dep2.js', () => `
                import './dep3';
                module.hot.accept(() => { console.log('mod2 accept') }); 
                module.hot.dispose(() => { console.log('mod2 dispose') })
            `);

            fs.stub('./src/dep3.js', () => `
                module.hot.dispose(() => { console.log('mod3 dispose') })
            `);

            await createBundle();
            await invalidate('./src/dep3', '');

            let logs = await Evaluator.logs(5);
            expect(logs.length).to.equal(5);
            expect(logs[0]).to.equal('mod3 dispose');
            expect(logs[1]).to.equal('mod1 dispose');
            expect(logs[2]).to.equal('mod2 dispose');
            expect(logs[3]).to.equal('mod1 accept');
            expect(logs[4]).to.equal('mod2 accept');
        });

        it ('should execute accept on root module if root module updates', async () => {
            fs.stub('./src/main.js', () => `
                module.hot.accept(() => console.log('accept'));
            `);

            await createBundle();
            await invalidate('./src/main.js', '');

            let logs = await Evaluator.logs(1);
            expect(logs[0]).to.equal('accept');
        });

        it ('should handle circular deps when finding accept', async () => {
            fs.stub('./src/main.js', () => `
                import './dep1';
                module.hot.accept(() => console.log('mod0 accept'));
            `);

            fs.stub('./src/dep1.js', () => `
                import './dep2';
                module.hot.dispose(() => console.log('mod1 dispose'));
            `);
            
            fs.stub('./src/dep2.js', () => `
                import './dep1';
                module.hot.dispose(() => console.log('mod2 dispose'));
            `);

            await createBundle();
            await invalidate('./src/dep1.js', ``);

            let log = await Evaluator.logs(2);

            expect(log.length).to.equal(4);
            expect(log[0]).to.equal('mod2 dispose');
            expect(log[1]).to.equal('mod1 dispose');
            expect(log[2]).to.equal('mod1 dispose');
            expect(log[3]).to.equal('mod0 accept');
        });

        it ('should pass disposed argument into accept containing disposed module for that branch', async () => {
            fs.stub('./src/main.js', () => `
                // id: 0
                import './dep1';
                import './dep2';
                module.hot.accept((e) => { console.log('mod0 ' + JSON.stringify(e.disposed)) }); 
                module.hot.dispose(() => { console.log('mod0 dispose') });
            `);

            fs.stub('./src/dep1.js', () => `
                // id: 1
                import './dep3';
                module.hot.accept((e) => { console.log('mod1 ' + JSON.stringify(e.disposed)) }); 
                module.hot.dispose(() => { console.log('mod1 dispose') })
            `);

            fs.stub('./src/dep2.js', () => `
                // id: 3
                import './dep3';
                module.hot.dispose(() => { console.log('mod2 dispose') })
            `);

            fs.stub('./src/dep3.js', () => `
                // id: 2
                module.hot.dispose(() => { console.log('mod3 dispose') }) 
            `);

            await createBundle();
            await invalidate('./src/dep3.js', ``);

            let log = await Evaluator.logs(6);
            expect(log.length).to.equal(6);
            expect(log[0]).to.equal('mod3 dispose');
            expect(log[1]).to.equal('mod1 dispose');
            expect(log[2]).to.equal('mod2 dispose');
            expect(log[3]).to.equal('mod0 dispose');
            expect(log[4]).to.equal('mod1 [2,1]');
            expect(log[5]).to.equal('mod0 [2,3,0]');
        })
    });

    describe('module.hot.dispose()', () => {
        it ('should only dispose the module being updated if an accept is there', async () => {
            fs.stub('./src/main.js', () => `
                import './dep1';
                import './dep2';
                module.hot.accept(() => { console.log('mod0 accept') }); 
                module.hot.dispose(() => { console.log('mod0 dispose') });
            `);

            fs.stub('./src/dep1.js', () => `
                module.hot.accept(() => { console.log('mod1 accept') }) 
                module.hot.dispose(() => { console.log('mod1 dispose') })
            `);

            fs.stub('./src/dep2.js', () => ``);

            await createBundle();
            await invalidate('./src/dep1.js', ``);

            let log = await Evaluator.logs(2);

            expect(log.length).to.equal(2);
            expect(log[0]).to.equal('mod1 dispose');
            expect(log[1]).to.equal('mod1 accept');

            await invalidate('./src/dep2.js', ``);

            log = await Evaluator.logs(2);
            expect(log.length).to.equal(2);
            expect(log[0]).to.equal('mod0 dispose');
            expect(log[1]).to.equal('mod0 accept');
        });

        it ('should dispose until it finds an accept handler', async () => {
            fs.stub('./src/main.js', () => `
                import './dep1';
                module.hot.accept(() => { console.log('mod0 accept') }); 
                module.hot.dispose(() => { console.log('mod0 dispose') });    
            `);

            fs.stub('./src/dep1.js', () => `
                import './dep2';
                module.hot.dispose(() => { console.log('mod1 dispose') })
            `);

            fs.stub('./src/dep2.js', () => `
                module.hot.dispose(() => { console.log('mod2 dispose') })
            `);

            await createBundle();
            await invalidate('./src/dep2.js', ``);

            let log = await Evaluator.logs(4);
            expect(log.length).to.equal(4);
            expect(log[0]).to.equal('mod2 dispose');
            expect(log[1]).to.equal('mod1 dispose');
            expect(log[2]).to.equal('mod0 dispose');
            expect(log[3]).to.equal('mod0 accept');
        });

        it ('should dispose on multiple branches', async () => {
            fs.stub('./src/main.js', () => `
                import './dep1';
                import './dep2';
                module.hot.accept(() => { console.log('mod0 accept') }); 
                module.hot.dispose(() => { console.log('mod0 dispose') });    
            `);

            fs.stub('./src/dep1.js', () => `
                import './dep3';
                module.hot.dispose(() => { console.log('mod1 dispose') })
            `);

            fs.stub('./src/dep2.js', () => `
                import './dep3';
                module.hot.dispose(() => { console.log('mod2 dispose') })
            `);

            fs.stub('./src/dep3.js', () => `
                module.hot.dispose(() => { console.log('mod3 dispose') })
            `);

            await createBundle();
            await invalidate('./src/dep3.js', ``);

            let log = await Evaluator.logs(5);
            expect(log.length).to.equal(5);
            expect(log[0]).to.equal('mod3 dispose');
            expect(log[1]).to.equal('mod1 dispose');
            expect(log[2]).to.equal('mod0 dispose');
            expect(log[3]).to.equal('mod2 dispose');
            expect(log[4]).to.equal('mod0 accept');
        });

        it ('should not dispose anything unless accept is found', async function () {
            this.timeout(5000);
            fs.stub('./src/main.js', () => `
                import './dep1';
                import './dep2';
                module.hot.dispose(() => { console.log('mod0 dispose') });
            `);

            fs.stub('./src/dep1.js', () => `
                import './dep3';
                module.hot.dispose(() => { console.log('mod1 dispose') })
            `);

            fs.stub('./src/dep2.js', () => `
                import './dep3';
                module.hot.dispose(() => { console.log('mod2 dispose') })
            `);

            fs.stub('./src/dep3.js', () => `
                module.hot.dispose(() => { console.log('mod3 dispose') })
            `);

            await createBundle();
            await invalidate('./src/dep3.js', ``);

            let log = await Evaluator.logs(10, 1000);
            expect(log.length).to.equal(0);
        });

        it ('should only dispose modules that have an accept handler on their branch', async () => {
            fs.stub('./src/main.js', () => `
                import './dep1';
                import './dep2';
                module.hot.dispose(() => { console.log('mod0 dispose') });
            `);

            fs.stub('./src/dep1.js', () => `
                import './dep3';
                module.hot.accept(() => { console.log('mod1 accept') }); 
                module.hot.dispose(() => { console.log('mod1 dispose') })
            `);

            fs.stub('./src/dep2.js', () => `
                import './dep3';
                module.hot.dispose(() => { console.log('mod2 dispose') })
            `);

            fs.stub('./src/dep3.js', () => `
                module.hot.dispose(() => { console.log('mod3 dispose') })
            `);

            await createBundle();
            await invalidate('./src/dep3.js', ``);

            let log = await Evaluator.logs(3);
            expect(log.length).to.equal(3);
            expect(log[0]).to.equal('mod3 dispose');
            expect(log[1]).to.equal('mod1 dispose');
            expect(log[2]).to.equal('mod1 accept');
        });
    });

    describe('module.hot.data', () => {
        it ('should be undefined on first load', async () => {
            fs.stub('./src/main.js', () => `
                console.log(typeof module.hot.data);  
            `);

            await createBundle();
            let log = await Evaluator.logs(1);
            expect(log.length).to.equal(1);
            expect(log[0]).to.equal('undefined');
        });

        it ('should be empty object on module reload, even if no dispose handlers', async () => {
            fs.stub('./src/main.js', () => `
                import './dep1';
                module.hot.accept(() => require(module.id));
                console.log('mod0 ' + typeof module.hot.data);  
            `);

            fs.stub('./src/dep1.js', () => `
                console.log('mod1 ' + typeof module.hot.data);   
            `);

            await createBundle();
            await invalidate('./src/dep1.js', `
                console.log('mod1 ' + typeof module.hot.data)
            `);

            let log = await Evaluator.logs(4);
            expect(log.length).to.equal(4);
            expect(log[0]).to.equal('mod1 undefined');
            expect(log[1]).to.equal('mod0 undefined');
            expect(log[2]).to.equal('mod1 object');
            expect(log[3]).to.equal('mod0 object');
        });

        it ('should pass empty object to hold data into dispose method', async () => {
            fs.stub('./src/main.js', () => `
                module.hot.accept(() => {});
                module.hot.dispose(data => { console.log(JSON.stringify(data)) });
            `);

            await createBundle();
            await invalidate('./src/main.js', ``);

            let log = await Evaluator.logs(1);
            expect(log.length).to.equal(1);
            expect(log[0]).to.equal('{}');
        });

        it ('should have module.hot.data containing data from original dispose method', async () => {
            fs.stub('./src/main.js', () => `
                module.hot.accept(() => require(module.id));
                module.hot.dispose(data => { 
                    data.hello = 'world';
                });
            `);

            await createBundle();
            await invalidate('./src/main.js', `
                console.log('entry ' + JSON.stringify(module.hot.data));
            `);

            let log = await Evaluator.logs(1);
            expect(log.length).to.equal(1);
            expect(log[0]).to.equal('entry {"hello":"world"}');
        });

        it ('should pass empty object regardless of modifications to hold data into dispose method', async () => {
            let code = `
                module.hot.accept(() => {});
                module.hot.dispose(data => { 
                    console.log('dispose ' + JSON.stringify(data));
                    data.hello = 'world';
                });
            `
            
            fs.stub('./src/main.js', () => code);

            await createBundle();
            await invalidate('./src/main.js', code);
            await invalidate('./src/main.js', code);

            let log = await Evaluator.logs(2);
            expect(log.length).to.equal(2);
            expect(log[0]).to.equal('dispose {}');
            expect(log[1]).to.equal('dispose {}');
        });

    });

    describe('module.hot.addStatusHandler()', () => {
        it ('should trigger callback each time status changes', async () => {
            fs.stub('./src/main.js', () => `
                import './dep1';
                module.hot.addStatusHandler(status => console.log('mod0 status ' + status));
                module.hot.accept(() => { console.log('mod0 accept') }); 
                module.hot.dispose(() => { console.log('mod0 dispose') });
            `);

            fs.stub('./src/dep1.js', () => `
                module.hot.addStatusHandler(status => console.log('mod1 status ' + status));
                module.hot.accept(() => { console.log('mod1 accept') }) 
                module.hot.dispose(() => { console.log('mod1 dispose') })
            `);

            await createBundle();
            await invalidate('./src/dep1.js', ``);

            let log = await Evaluator.logs(8);
            expect(log[0]).to.equal('mod1 status dispose');
            expect(log[1]).to.equal('mod0 status dispose');
            expect(log[2]).to.equal('mod1 dispose');
            expect(log[3]).to.equal('mod1 status apply');
            expect(log[4]).to.equal('mod0 status apply');
            expect(log[5]).to.equal('mod1 accept');
            expect(log[6]).to.equal('mod1 status idle');
            expect(log[7]).to.equal('mod0 status idle');
        });

        it ('should trigger for remote status changes from socket', async () => {
            fs.stub('./src/main.js', () => `
                module.hot.addStatusHandler(status => console.log('status ' + status));
            `);

            await createBundle();
            server.send({ status: 'remote' });
            let log = await Evaluator.logs(1);
            expect(log[0]).to.equal('status remote');
        })
    });

    describe('module.hot.status()', () => {
        it ('should return current HMR updating status', async () => {
            fs.stub('./src/main.js', () => `
                import './dep1';
                module.hot.addStatusHandler(() => 
                    console.log('status ' + module.hot.status())
                );
                module.hot.accept(() => {})
            `);

            fs.stub('./src/dep1.js', () => `
                module.hot.dispose(() => { })
            `);

            await createBundle();
            await invalidate('./src/dep1.js', ``);
            let log = await Evaluator.logs(3);
            expect(log[0]).to.equal('status dispose');
            expect(log[1]).to.equal('status apply');
            expect(log[2]).to.equal('status idle');
        });

        it ('should return remote status for HMR from socket', async () => {
            fs.stub('./src/main.js', () => `
                module.hot.addStatusHandler(() => 
                    console.log('status ' + module.hot.status())
                );
            `);

            await createBundle();
            server.send({ status: 'remote' });

            let log = await Evaluator.logs(1);
            expect(log[0]).to.equal('status remote');
        })
    });

    describe('module.hot.removeStatusHandler()', () => {
        it ('should remove a callback for listening to statuses', async () => {
            fs.stub('./src/main.js', () => `
                import './dep1';
                let cb = () => console.log('mod0 status ' + module.hot.status())
                module.hot.addStatusHandler(cb);
                module.hot.removeStatusHandler(cb);
            `);

            fs.stub('./src/dep1.js', () => `
                module.hot.addStatusHandler(() => {
                    console.log('mod1 status ' + module.hot.status());
                })
            `);

            await createBundle();
            server.send({ status: 'remote' });

            let log = await Evaluator.logs(1);
            expect(log.length).to.equal(1);
            expect(log[0]).to.equal('mod1 status remote');
        });
    });

    describe('Option: hmrHost', () => {
        it ('should use window.location.host by default for WebSocket', async () => {
            fs.stub('./src/main.js', () => ``);
            let bundle = await nollup({ input: './src/main.js', plugins: [ plugin() ]});
            let generated = await bundle.generate({ format: 'esm' });
            expect(generated.output[0].code.indexOf(`new WebSocket(protocol + __nollup__global__.location.host + '/__hmr')`) > -1).to.be.true;
        });

        it ('should use hmrHost if provided instead of window location host', async () => {
            fs.stub('./src/main.js', () => ``);
            let bundle = await nollup({ input: './src/main.js', plugins: [ plugin({ hmrHost: 'mydomain.com' }) ]});
            let generated = await bundle.generate({ format: 'esm' });
            expect(generated.output[0].code.indexOf(`new WebSocket(protocol + 'mydomain.com' + '/__hmr')`) > -1).to.be.true;
        });
    });

    describe('Option: bundleId', () => {
        it ('should postfix the bundleId for window.__hot', async () => {
            fs.stub('./src/main.js', () => ``);
            let bundle = await nollup({ input: './src/main.js', plugins: [ plugin({ bundleId: '123' }) ]});
            let generated = await bundle.generate({ format: 'esm' });
            server = await createServer({ urls: ['/__hmr123'] });
            let { globals } = await Evaluator.init('esm', 'main.js', generated.output, { location: server.location() }, true);

            expect(globals.__hot).to.be.undefined;
            expect(globals.__hot123).not.to.be.undefined;
        });

        it ('should connect to websocket with same bundleId', async () => {
            fs.stub('./src/main.js', () => ``);
            let bundle = await nollup({ input: './src/main.js', plugins: [ plugin({ bundleId: '123' }) ]});
            let generated = await bundle.generate({ format: 'esm' });
            expect(generated.output[0].code.indexOf(`new WebSocket(protocol + __nollup__global__.location.host + '/__hmr123')`) > -1).to.be.true;
        });

        it ('should not break status updates', async () => {
            fs.stub('./src/main.js', () => `
                import './dep1';
                let cb = () => console.log('mod0 status ' + module.hot.status())
                module.hot.addStatusHandler(cb);
                module.hot.removeStatusHandler(cb);
            `);

            fs.stub('./src/dep1.js', () => `
                module.hot.addStatusHandler(() => {
                    console.log('mod1 status ' + module.hot.status());
                })
            `);

            let bundle = await nollup({ input: './src/main.js', plugins: [ plugin({ bundleId: '123' }) ]});
            let generated = await bundle.generate({ format: 'esm' });
            server = await createServer({ urls: ['/__hmr123'] });
            let { globals } = await Evaluator.init('esm', 'main.js', generated.output, { location: server.location() }, true);
            server.send({ status: 'remote' });
            let log = await Evaluator.logs(1);
            expect(globals.__hot123).not.to.be.undefined;
            expect(log.length).to.equal(1);
            expect(log[0]).to.equal('mod1 status remote');
        });
    });

    describe('Option: verbose', () => {
        it ('should output Status Change HMR logs if enabled', async () => {
            fs.stub('./src/main.js', () => ``);
            await createBundle({ verbose: true });
            server.send({ status: 'remote' });

            let log = await Evaluator.logs(1);
            expect(log[0]).to.equal('[HMR] Status Change remote');
        });
    });

    describe('Message: greeting', () => {
        it ('should not output anything if verbose not enabled', async function () {
            this.timeout(5000);
            fs.stub('./src/main.js', () => ``);
            await createBundle({ verbose: false });
            server.send({ greeting: true });
            let log = await Evaluator.logs(10, 1000);
            expect(log.length).to.equal(0);
        });

        it ('should output Enabled log if greeting received over socket', async () => {
            fs.stub('./src/main.js', () => ``);
            await createBundle({ verbose: true });
            server.send({ greeting: true });
            let log = await Evaluator.logs(1);
            expect(log[0]).to.equal('[HMR] Enabled');
        });
    });

    describe ('Bindings', () => {
        it ('should update direct bindings for modules who import an updated module', async () => {
            fs.stub('./src/main.js', () => `
                import message from './message';
                globalThis.print = function () {
                    console.log(message);
                };
            `);

            fs.stub('./src/message.js', () => `
                module.hot.accept(() => {
                    require(module.id);
                });
                export default 'hello';
            `);

            await createBundle();            
            await Evaluator.call('print');

            await invalidate('./src/message.js', `
                module.hot.accept(() => {
                    require(module.id);
                });
                export default 'world';
            `);

            await Evaluator.call('print');

            let log = await Evaluator.logs(2);
            expect(log.length).to.equal(2);
            expect(log[0]).to.equal('hello');
            expect(log[1]).to.equal('world');
        });

        it ('should update binding for accepted branch only', async () => {
            fs.stub('./src/main.js', () => `
                import MessageFoo from './message-foo';
                import MessageBar from './message-bar';

                globalThis.print = function () {
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

            await createBundle();
            await Evaluator.call('print');

            await invalidate('./src/message.js', `
                export default 'world';
            `);

            await Evaluator.call('print');
            let log = await Evaluator.logs(2);
            expect(log.length).to.equal(2);
            expect(log[0]).to.equal('hello foo hello bar');
            expect(log[1]).to.equal('world foo hello bar');
        });

        it ('should update bindings for all accepted branches', async () => {
            fs.stub('./src/main.js', () => `
                import MessageFoo from './message-foo';
                import MessageBar from './message-bar';

                globalThis.print = function () {
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

            await createBundle();
            await Evaluator.call('print');

            await invalidate('./src/message.js', `
                export default 'world';
            `);

            await Evaluator.call('print');

            let log = await Evaluator.logs(2);
            expect(log.length).to.equal(2);
            expect(log[0]).to.equal('hello foo hello bar');
            expect(log[1]).to.equal('world foo world bar');
        });
    });

    describe('Module Adding/Removal', () => {
        it ('should not fail when adding a module for the first time', async () => {
            fs.stub('./src/main.js', () => `
                import MessageFoo from './message-foo';

                module.hot.accept(() => {
                    require(module.id);
                });

                globalThis.print = () => {
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

            await createBundle();
            await Evaluator.call('print');

            {
                fs.stub('./src/message-bar.js', () => `
                    import Message from './message';
                    export default Message + ' bar';
                `);

                await invalidate('./src/main.js', `
                    import MessageFoo from './message-foo';
                    import MessageBar from './message-bar';

                    module.hot.accept(() => {
                        require(module.id);
                    });

                    globalThis.print = () => {
                        console.log(typeof MessageFoo + ' ' + typeof MessageBar);
                    }
                `);

                await Evaluator.call('print');
            }
            
            let log = await Evaluator.logs(2);
            expect(log.length).to.equal(2);
            expect(log[0]).to.equal('string undefined');
            expect(log[1]).to.equal('string string');
        });

        it ('should not fail when removing and readding a module', async () => {
            fs.stub('./src/main.js', () => `
                import MessageFoo from './message-foo';
                import MessageBar from './message-bar';

                module.hot.accept(() => {
                    require(module.id);
                });

                globalThis.print = () => {
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

            await createBundle();
            await Evaluator.call('print');

            {
                await invalidate('./src/main.js', `
                    import MessageFoo from './message-foo';

                    module.hot.accept(() => {
                        require(module.id);
                    });

                    globalThis.print = () => {
                        console.log(typeof MessageFoo + ' ' + typeof MessageBar);
                    }
                `);

                await Evaluator.call('print');
            }
          
            {
                fs.stub('./src/message-bar.js', () => `
                    import Message from './message';
                    export default Message + ' bar';
                `);

                await invalidate('./src/main.js', `
                    import MessageFoo from './message-foo';
                    import MessageBar from './message-bar';

                    module.hot.accept(() => {
                        require(module.id);
                    });

                    globalThis.print = () => {
                        console.log(typeof MessageFoo + ' ' + typeof MessageBar);
                    }
                `);

                await Evaluator.call('print');
            }
            
            let log = await Evaluator.logs(3);
            expect(log.length).to.equal(3);
            expect(log[0]).to.equal('string string');
            expect(log[1]).to.equal('string undefined');
            expect(log[2]).to.equal('string string');
        });
    });

    describe('Misc', () => {
        // it ('should use wss:// instead of ws:// when on https://', async () => {
        //     let env = createEnv([{
        //         dependencies: [],
        //         code: `function () {}`
        //     }], {}, {
        //         protocol: 'https:'
        //     });
        //     expect(env.ws.url).to.equal('wss://example.com/__hmr');
        // });

        it ('should allow new dynamic imports to work via HMR after first bundle', async function () {
            this.timeout(5000);
            fs.stub('./src/main.js', () => `import './entry'; module.hot.accept(() => require(module.id));`);
            fs.stub('./src/entry.js', () => `import('./dep1');`);
            fs.stub('./src/dep1.js', () => `globalThis.print = () => console.log('dep1');`);
            fs.stub('./src/dep2.js', () => `globalThis.print = () => console.log('dep2');`);
            
            await createBundle();
            await wait(500);
            await Evaluator.call('print');

            await invalidate('./src/entry.js', `import('./dep2');`);
            await wait(500);
            await Evaluator.call('print');

            let log = await Evaluator.logs(2);
            expect(log.length).to.equal(2);
            expect(log[0]).to.equal('dep1');
            expect(log[1]).to.equal('dep2');
        });

        it ('should cache bust for dynamic imports if one of their modules have been invalidated', async function () {
            this.timeout(5000);
            let dep1value = 0;
            let dep2value = 0;
            let result;

            let entryTemplate = dep => `import('./${dep}').then(res => console.log('entry:' + res.default));`

            fs.stub('./src/main.js', () => `import './entry'; module.hot.accept(() => require(module.id));`);
            fs.stub('./src/entry.js', () => entryTemplate('dep1'));
            fs.stub('./src/dep1.js', () => `export default 'dep1:${dep1value}';`);
            fs.stub('./src/dep2.js', () => `export default 'dep2:${dep2value}';`);
            
            await createBundle();
            await wait(500);

            await invalidate('./src/entry.js', entryTemplate('dep2'));
            await wait(500);

            await invalidate('./src/dep2.js', `export default 'dep2:${++dep2value}';`);
            await wait(500);

            let log = await Evaluator.logs(3);
            expect(log.length).to.equal(3);
            expect(log[0]).to.equal('entry:dep1:0');
            expect(log[1]).to.equal('entry:dep2:0');
            expect(log[2]).to.equal('entry:dep2:1');
        });

        it ('should cache bust for dynamic imports if one of their modules have been invalidated (variant 2)', async function () {
            this.timeout(5000);
            let dep1value = 0;
            let dep2value = 0;
            let result;

            let mainTemplate = dep => `import('./${dep}').then(res => console.log('entry:' + res.default)); module.hot.accept(() => require(module.id));`

            fs.stub('./src/main.js', () => mainTemplate('dep1'));
            fs.stub('./src/dep1.js', () => `export default 'dep1:${dep1value}';`);
            fs.stub('./src/dep2.js', () => `export default 'dep2:${dep2value}';`);

            await createBundle();
            await wait(500);

            await invalidate('./src/main.js', mainTemplate('dep2'));
            await wait(500);

            await invalidate('./src/dep2.js', `export default 'dep2:${++dep2value}';`);
            await wait(500);

            await invalidate('./src/dep1.js', `export default 'dep1:${++dep1value}';`);
            await invalidate('./src/main.js', mainTemplate('dep1'));
            await wait(500);

            let log = await Evaluator.logs(4);

            expect(log.length).to.equal(4);
            expect(log[0]).to.equal('entry:dep1:0');
            expect(log[1]).to.equal('entry:dep2:0');
            expect(log[2]).to.equal('entry:dep2:1');
            expect(log[3]).to.equal('entry:dep1:1');
        });

        it ('should cache bust for dynamic imports if one of their modules have been invalidated (variant 3)', async function () {
            this.timeout(5000);
            let dep1value = 0;
            let dep2value = 0;
            let result;

            let mainTemplate = dep => `import('./${dep}').then(res => console.log('entry:' + res.default)); module.hot.accept(() => require(module.id));`

            fs.stub('./src/main.js', () => mainTemplate('dep1'));
            fs.stub('./src/dep1.js', () => `import dep1impl from './dep1impl'; export default 'dep1:' + dep1impl;`);
            fs.stub('./src/dep2.js', () => `import dep2impl from './dep2impl'; export default 'dep2:' + dep2impl;`);
            fs.stub('./src/dep1impl.js', () => `export default 0;`);
            fs.stub('./src/dep2impl.js', () => `export default 0;`);
            
            await createBundle();
            await wait(500);

            await invalidate('./src/main.js', mainTemplate('dep2'));
            await wait(500);

            await invalidate('./src/dep2impl.js', 'export default 1;');
            await wait(500);

            await invalidate('./src/dep1impl.js', 'export default 1;');
            await invalidate('./src/main.js', mainTemplate('dep1'));
            await wait(500);

            let log = await Evaluator.logs(4);
            expect(log.length).to.equal(4);
            expect(log[0]).to.equal('entry:dep1:0');
            expect(log[1]).to.equal('entry:dep2:0');
            expect(log[2]).to.equal('entry:dep2:1');
            expect(log[3]).to.equal('entry:dep1:1');
        });

        it ('should still trigger own dispose handler if removed from bundle', async () => {
            fs.stub('./src/main.js', () => `
                import "./style.css";
            `);

            fs.stub('./src/style.css', () => `
                module.hot.accept(() => console.log('mod1 accept'));
                module.hot.dispose(() => console.log('mod1 dispose'));
            `);

            await createBundle();
            await invalidate('./src/main.js', ``);

            let log = await Evaluator.logs(1);
            expect(log.length).to.equal(1);
            expect(log[0]).to.equal('mod1 dispose');
        });

        it ('should not have a circular references when updating dynamic import', async function () {
            this.timeout(5000);
            fs.stub('./src/main.js', () => `
                import('dep').then(mod => mod.print()); 
                module.hot.accept(() => require(module.id));
            `);

            fs.stub('./src/dep.js', () => `
                import './main';
                export function print () { console.log('dep') };
            `);
            
            await createBundle();
            await wait(500);

            await invalidate('./src/dep.js', `
                import './main';
                export function print () { console.log('dep-update') };
            `);

            await wait(500);

            let log = await Evaluator.logs(2);
            expect(log.length).to.equal(2);
            expect(log[0]).to.equal('dep');
            expect(log[1]).to.equal('dep-update');
        });

        it ('should not execute modules twice once changed', async () => {
            fs.stub('./src/main.js', () => `
                import message from './message';
            `);

            fs.stub('./src/message.js', () => `
                module.hot.accept(() => require(module.id));
                console.log('message 1');
            `);

            await createBundle();
            await invalidate('./src/message.js', `
                module.hot.accept(() => require(module.id));
                console.log('message 2');
            `);

            await wait(500);

            let log = await Evaluator.logs(2);
            expect(log.length).to.equal(2);
            expect(log[0]).to.equal('message 1');
            expect(log[1]).to.equal('message 2');
        });

        it ('should allow empty accept to auto-require', async () => {
            fs.stub('./src/main.js', () => `
                import message from './message';
            `);

            fs.stub('./src/message.js', () => `
                module.hot.dispose(() => console.log('dispose'));
                console.log('message 1');
                module.hot.accept();
            `);

            await createBundle();
            await invalidate('./src/message.js', `
                console.log('message 2');
                module.hot.accept();
            `);

            let log = await Evaluator.logs(3);
            expect(log.length).to.equal(3);
            expect(log[0]).to.equal('message 1');
            expect(log[1]).to.equal('dispose');
            expect(log[2]).to.equal('message 2');
        });

        it ('should not auto-require for accept if handler is given', async function () {
            this.timeout(5000);
            // Note: This is not compatible with other bundlers.
            // Ideally Nollup should auto-require to be inline with other bundlers,
            // but there are projects which rely on the fact that it doesn't and use the accept
            // handler to dispose, require and accept at once in the one callback.
            fs.stub('./src/main.js', () => `
                import message from './message';
                console.log('message 1');
            `);

            fs.stub('./src/message.js', () => `
                module.hot.dispose(() => console.log('dispose'));
                module.hot.accept(() => {});
            `);

            await createBundle();
            await invalidate('./src/message.js', `
                console.log('message 2');
                module.hot.accept(() => {});
            `);

            let log = await Evaluator.logs(3, 1000);
            expect(log.length).to.equal(2);
            expect(log[0]).to.equal('message 1');
            expect(log[1]).to.equal('dispose');
        });

        it ('should allow new import meta to work via HMR after first bundle');

        it ('should allow new external imports to work via HMR after first bundle');

        it ('should allow new external imports in dynamic imports to work via HMR after first bundle');
    })
});