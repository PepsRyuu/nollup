#!/usr/bin/env node

let fs = require('fs');
let path = require('path');
let express = require('express');
let fallback = require('express-history-api-fallback');
let proxy = require('express-http-proxy');
let nollupDevServer = require('./dev-middleware');
let app = express();

let options = {
    config: process.cwd() + '/rollup.config.js',
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
                options.config = path.resolve(process.cwd(), process.argv[i + 1]);
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

if (fs.existsSync('.nolluprc')) {
    options = Object.assign({}, options, JSON.parse(fs.readFileSync('.nolluprc')));
} else if (fs.existsSync('.nolluprc.js')) {
    options = Object.assign({}, options, require(path.resolve(process.cwd(), './.nolluprc.js')));
}

if (options.before) {
    options.before(app);
}

app.use(nollupDevServer(app, require(options.config), {
    hot: options.hot,
    verbose: options.verbose,
    hmrHost: options.hmrHost
}));

if (options.proxy) {
    Object.keys(options.proxy).forEach(route => {
        let target = options.proxy[route];
        app.use(route, proxy(target, {
            proxyReqPathResolver: req => {
                return route + require('url').parse(req.url).path;
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
