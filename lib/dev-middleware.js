let nollup = require('./index');
let chokidar = require('chokidar');
let expressws = require('express-ws');
let fs = require('fs');
let url = require('url');
let hmr = require('./plugin-hmr');
let mime = require('mime-types');
let path = require('path');
let { createFilter } = require('@rollup/pluginutils');

module.exports = function (app, config, options, server) {
    expressws(app, server);
    let bundles = [];
    let isBundling = true;
    let files = {};
    let sockets = {};
    let file_listeners = [];

    let configs = Array.isArray(config)? config : [config];

    // Output as an array, convert to multiple configs
    for (let i = 0; i < configs.length; i++) {
        let c = configs[i];
        if (Array.isArray(c.output)) {
            let output = c.output;
            c.output = output[0];

            for (let j = 1; j < output.length; j++) {
                let clone = Object.assign({}, c);
                clone.output = output[j];
                configs.splice(i + 1, 0, clone);
                i++;
            }
        }
    }

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
                const { output } = configs[i]
                let update = await bundles[i].generate(output);
                messageAllSocketsInBundle({ status: 'ready' }, i);
                update.output.forEach(obj => {
                    let fileName = obj.fileName;
                    if (output.file) {
                        if (fileName === path.basename(output.file)) {
                            let contentBase = path.posix.resolve(options.contentBase || './');
                            let targetPath = path.posix.resolve(output.file);
                            fileName = targetPath.replace(contentBase, '').substring(1);
                        }
                    }

                    files[fileName] = obj.isAsset? obj.source : obj.code;
                });

                messageAllSocketsInBundle({ changes: update.changes }, i);

                if (compilation_time < update.stats.time) {
                    compilation_time = update.stats.time;
                }
            }

            isBundling = false;
            file_listeners.forEach(fn => fn());
            file_listeners = [];
            console.log('\x1b[32m%s\x1b[0m', `[Nollup] Compiled in ${compilation_time}ms.`);
        } catch (e) {
            console.log('\x1b[91m%s\x1b[0m', (e.stack || e.message));
        }
    }

    (async function () {
        for (let i = 0; i < configs.length; i++) {
            bundles.push(await nollup(configs[i]));
        }

        // Exclude these directories
        let watchExclude = configs.reduce((acc, config) => {
            if (config.watch && config.watch.exclude) {
                if (Array.isArray(config.watch.exclude)) {
                    acc = acc.concat(config.watch.exclude);
                } else {
                    acc.push(config.watch.exclude);
                }
            }
            return acc;
        }, []);

        // Limit to these directories only
        let watchInclude = configs.reduce((acc, config) => {
            if (config.watch && config.watch.include) {
                if (Array.isArray(config.watch.include)) {
                    acc = acc.concat(config.watch.include);
                } else {
                    acc.push(config.watch.include);
                }
            }
            return acc;
        }, []);

        let filter = createFilter(watchInclude, watchExclude);

        let watcher = chokidar.watch(options.watch || process.cwd(), {
            ignoreInitial: true,
            // Using a function improves performance when using symlink package managers - Issue #63
            ignored: path => {
                if (watchExclude.length > 0 || watchInclude.length > 0) {
                    return !filter(path);
                } else {
                    return path.includes('/node_modules/') || path.includes('/.git/');
                }
            }
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

    let publicPath = options.publicPath || '/';
    if (!publicPath.startsWith('/')) {
        publicPath = '/' + publicPath;
    }

    if (!publicPath.endsWith('/')) {
        publicPath = publicPath + '/';
    }

    return function (req, res, next) {
        let impl = () => {
            let fullPath = url.parse(req.url).pathname;

            if (!fullPath.startsWith(publicPath)) {
                return next();
            }

            let filename = fullPath.replace(publicPath, '');

            if (isBundling) {
                file_listeners.push(impl);
                return;
            }

            if (filename === '') {
                filename = 'index.html';
            }

            if (files[filename]) {
                const type = mime.lookup(filename);
                if (type) {
                    res.writeHead(200, Object.assign({ 'Content-Type': type }, options.headers));
                } else {
                    res.writeHead(200, options.headers);
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
