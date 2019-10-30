let nollup = require('./index');
let chokidar = require('chokidar');
let expressws = require('express-ws');
let fs = require('fs');
let url = require('url');
let hmr = require('./plugin-hmr');
let mime = require('mime-types');

module.exports = function (app, config, options) {
    expressws(app);
    let bundles = [];
    let isBundling = true;
    let files = {};
    let sockets = {};
    let file_listeners = [];
    
    let configs = Array.isArray(config)? config : [config];

    if (options.hot) {
        configs.forEach((c, i) => {
            c.plugins = c.plugins || [];
            c.plugins.push(hmr({
                verbose: options.verbose,
                hmrHost: options.hmrHost,
                bundleId: (i || '')
            }));

            sockets[i] = [];

            app.ws('/__hmr' + (i || ''), (ws, req) => {
                sockets[i].push(ws);

                // greeting -- see: https://github.com/PepsRyuu/nollup/issues/35
                ws.send(JSON.stringify({ greeting: true }))

                ws.on('close', () => {
                    sockets[i].splice(sockets[i].indexOf(ws), 1);
                });
            });
        });
    }

    function messageAllSocketsInBundle (message, bundleId) {
        if (!options.hot) {
            return;
        }

        sockets[bundleId].forEach(socket => {
            socket.send(JSON.stringify(message));
        });
    }

    function messageAllSockets (message) {
        Object.keys(sockets).forEach(bundleId => {
            messageAllSocketsInBundle(message, bundleId);
        });
    }

    async function generateBundles () {
        try {
            let compilation_time = 0;

            for (let i = 0; i < bundles.length; i++) {
                let update = await bundles[i].generate();
                messageAllSocketsInBundle({ status: 'ready' }, i);
                update.output.forEach(obj => {
                    files[obj.fileName] = obj.isAsset? obj.source : obj.code;
                });

                messageAllSocketsInBundle({ changes: update.changes }, i);

                if (compilation_time < update.stats.time) {
                    compilation_time = update.stats.time;
                }
            }

            isBundling = false;
            file_listeners.forEach(fn => fn());
            file_listeners = [];
            console.log('\x1b[32m%s\x1b[0m', `Compiled in ${compilation_time}ms.`);
        } catch (e) {
            console.log('\x1b[91m%s\x1b[0m', e.stack);
        }
    }

    (async function () {
        for (let i = 0; i < configs.length; i++) {
            bundles.push(await nollup(configs[i]));
        }
       
        let watcher = chokidar.watch(options.watch || process.cwd(), {
            ignored:  ['**/node_modules/**/*', '**/.git/**/*'],
        });

        let watcherTimeout;

        const onChange = async (path) => {
            messageAllSockets({ status: 'check' });

            if (fs.lstatSync(path).isFile()) {
                files = {};
                isBundling = true;
                bundles.forEach(b => b.invalidate(path));

                if (watcherTimeout) {
                    clearTimeout(watcherTimeout);
                }

                watcherTimeout = setTimeout(async () => {
                    messageAllSockets({ status: 'prepare' });
                    generateBundles();
                }, 100);
            }
        };

        watcher.on('add', onChange);
        watcher.on('change', onChange);
        generateBundles();
    })();

    return function (req, res, next) {
        let impl = () => {
            let filename = url.parse(req.url).pathname.replace('/', '');

            if (isBundling) {
                file_listeners.push(impl);
                return;
            }

            if (files[filename]) {
                const type = mime.lookup(filename);
                if (type) {
                    res.writeHead(200, { 'Content-Type': type });
                } else {
                    res.writeHead(200);
                }

                res.write(files[filename]);
                res.end();
            } else {
                next();
            }
        }

        impl();
    }
};
