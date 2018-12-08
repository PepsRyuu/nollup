let nollup = require('./index');
let chokidar = require('chokidar');
let expressws = require('express-ws');
let fs = require('fs');
let url = require('url');
let hmr = require('./plugin-hmr');

const MIME_TYPES = {
    'mjs': 'application/javascript',
    'js': 'application/javascript',
    'css': 'text/css'
};

module.exports = function (app, config, options) {
    expressws(app);
    let files = {};
    let sockets = [];

    if (options.hot) {
        config.plugins = config.plugins || [];

        config.plugins.push(hmr({
            verbose: options.verbose
        }));

        app.ws('/__hmr', (ws, req) => {
            sockets.push(ws);

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
        if (config.experimentalCodeSplitting) {
            let output = response.output;
            Object.keys(output).forEach(file => {
                files[file] = typeof output[file] === 'string' ? output[file] : output[file].code;
            });
        } else {
            files[config.output.file] = response.code;
        }

        messageAllSocketsInHotMode({ changes: response.changes });

        console.log('\x1b[32m%s\x1b[0m', `Compiled in ${response.stats.time}ms.`);
    }

    async function compiler () {
        let bundle = await nollup(config);
        let watcher = chokidar.watch(options.watch);
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
                    let update = await bundle.generate();
                    messageAllSocketsInHotMode({ status: 'ready' });
                    handleGeneratedBundle(update);
                }, 100);
            }
        };

        watcher.on('add', onChange);
        watcher.on('change', onChange);

        handleGeneratedBundle(await bundle.generate());
    };

    compiler();

    return function (req, res, next) {
        let impl = () => {
            if (Object.keys(files).length === 0) {
                return setTimeout(impl, 1000);
            }

            let filename = url.parse(req.url).pathname.replace('/', '');
            if (files[filename]) {
                res.writeHead(200, {
                    'Content-Type': MIME_TYPES[filename.substring(filename.lastIndexOf('.') + 1)]
                });

                res.write(files[filename]);
                res.end();
            } else {
                next();
            }
        }

        impl();
    }
};
