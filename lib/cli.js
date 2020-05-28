#!/usr/bin/env node

if (!process.env.ROLLUP_WATCH) {
    process.env.ROLLUP_WATCH = 'true';
}

if (!process.env.NOLLUP) {
    process.env.NOLLUP = 'true';
}

let fs = require('fs');
let path = require('path');
let express = require('express');
let fallback = require('express-history-api-fallback');
let proxy = require('express-http-proxy');
let nollupDevServer = require('./dev-middleware');
let ConfigLoader = require('./impl/ConfigLoader');
let app = express();

let options = {
    config: path.normalize(process.cwd() + '/rollup.config.js'),
    contentBase: './',
    historyApiFallback: false,
    hot: false,
    port: 8080,
    verbose: false,
    hmrHost: undefined
};

function getValue (index) {
    let next = process.argv[index + 1];
    if (next && !next.startsWith('-')) {
        return next;
    }

    return '';
}

for (let i = 0; i < process.argv.length; i++) {
    let value;
    let key = process.argv[i];

    switch (key) {
        case '-c': case '--config': 
            value = getValue(i);
            if (value) {
                options.config = path.normalize(path.resolve(process.cwd(), process.argv[i + 1]));
            }
            break;

        case '--content-base':
            value = getValue(i);
            if (value) {
                options.contentBase = value;
            } else {
                throw new Error('Missing path for content base.');
            }
            break;

        case '--public-path': 
            value = getValue(i);
            if (value) {
                options.publicPath = value;
            } else {
                throw new Error('Missing path for public path.');
            }
            break;

        case '--history-api-fallback': 
            options.historyApiFallback = true;
            break;

        case '--hot': 
            options.hot = true;
            break;

        case '--port':
            value = getValue(i);
            if (value) {
                options.port = parseInt(value);
            } else {
                throw new Error('Missing port number.');
            }
            break;

        case '--verbose':
            options.verbose = true;
            break;

        case '--hmr-host':
            value = getValue(i);
            if (value) {
                options.hmrHost = value;
            } else {
                throw new Error('Missing host for HMR host.');
            }
            break;
    }
}

(async function () {
    if (fs.existsSync('.nolluprc')) {
        options = Object.assign({}, options, JSON.parse(fs.readFileSync('.nolluprc')));
    } else if (fs.existsSync('.nolluprc.js')) {
        options = Object.assign({}, options, require(path.resolve(process.cwd(), './.nolluprc.js')));
    }

    if (options.before) {
        options.before(app);
    }

    let config = await ConfigLoader.load(options.config);
    app.use(nollupDevServer(app, config, {
        hot: options.hot,
        verbose: options.verbose,
        hmrHost: options.hmrHost,
        contentBase: options.contentBase,
        publicPath: options.publicPath
    }));

    if (options.proxy) {
        Object.keys(options.proxy).forEach(route => {
            let target = options.proxy[route];
            app.use(route, proxy(target, {
                proxyReqPathResolver: req => {
                    let req_path = require('url').parse(req.url).path;
                    return route + (req_path === '/'? '' : req_path);
                }
            }));
        });
    }

    app.use(express.static(options.contentBase));

    if (options.after) {
        options.after(app);
    }

    if (options.historyApiFallback) {
        app.use(fallback('index.html', { root: options.contentBase }));
    }

    app.listen(options.port);

    console.log(`Listening on http://localhost:${options.port}`);
})();



// Needed for posix systems when used with npm-run-all.
process.on('SIGTERM', () => {
    process.exit(0);
});