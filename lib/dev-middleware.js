let nollup = require('./index');
let chokidar = require('chokidar');
let expressws = require('express-ws');
let fs = require('fs');
let url = require('url');
let hmr = require('./plugin-hmr');
let mime = require('mime-types');

module.exports = function (app, config, options) {
    expressws(app);
    let files = {};
    let sockets = [];
    let file_listeners = [];

    if (options.hot) {
        config.plugins = config.plugins || [];

        config.plugins.push(hmr({
            verbose: options.verbose,
            hmrHost: options.hmrHost
        }));

        app.ws('/__hmr', (ws, req) => {
            sockets.push(ws);

            // greeting -- see: https://github.com/PepsRyuu/nollup/issues/35
            ws.send(JSON.stringify({ greeting: true }))

            ws.on('close', () => {
                sockets.splice(sockets.indexOf(ws), 1);
            });
        });
    }

    function messageAllSocketsInHotMode (message) {
        if (!options.hot) {
            return;
        }

        sockets.forEach(socket => {
            socket.send(JSON.stringify(message));
        });
    }

    function handleGeneratedBundle (response) {
        let output = response.output;
        output.forEach(obj => {
            files[obj.fileName] = obj.isAsset? obj.source : obj.code;
        });

        messageAllSocketsInHotMode({ changes: response.changes });

        file_listeners.forEach(fn => fn());
        file_listeners = [];
        console.log('\x1b[32m%s\x1b[0m', `Compiled in ${response.stats.time}ms.`);
    }

    async function compiler () {
        let bundle = await nollup(config);
        let watcher = chokidar.watch(options.watch || process.cwd(), {
            ignored:  ['**/node_modules/**/*', '**/.git/**/*'],
        });

        let watcherTimeout;

        const onChange = async (path) => {
            messageAllSocketsInHotMode({ status: 'check' });

            if (fs.lstatSync(path).isFile()) {
                files = {};
                bundle.invalidate(path);

                if (watcherTimeout) {
                    clearTimeout(watcherTimeout);
                }

                watcherTimeout = setTimeout(async () => {
                    messageAllSocketsInHotMode({ status: 'prepare' });
                    try {
                        let update = await bundle.generate();
                        messageAllSocketsInHotMode({ status: 'ready' });
                        handleGeneratedBundle(update);
                    } catch (e) {
                        console.log('\x1b[91m%s\x1b[0m', e.stack);
                    }
                }, 100);
            }
        };

        watcher.on('add', onChange);
        watcher.on('change', onChange);

        try {
            handleGeneratedBundle(await bundle.generate());
        } catch (e) {
            console.log('\x1b[91m%s\x1b[0m', e);
        }

    };

    compiler();

    return function (req, res, next) {
        let impl = () => {
            if (Object.keys(files).length === 0) {
                file_listeners.push(impl);
                return;
            }

            let filename = url.parse(req.url).pathname.replace('/', '');
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
