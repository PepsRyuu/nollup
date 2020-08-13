#!/usr/bin/env node

if (!process.env.ROLLUP_WATCH) {
    process.env.ROLLUP_WATCH = 'true';
}

if (!process.env.NOLLUP) {
    process.env.NOLLUP = 'true';
}

let path = require('path');
const devServer = require('./dev-server')

let options = {
    config: path.normalize(process.cwd() + '/rollup.config.js'),
    contentBase: './',
    historyApiFallback: false,
    hot: false,
    port: 8080,
    verbose: false,
    hmrHost: undefined,
    https: false,
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

        case '--environment':
            value = getValue(i);
            if (value) {
                value.split(',').forEach(variable => {
                    let delimiterIndex = variable.indexOf(':');

                    if (delimiterIndex > -1) {
                        let key = variable.substring(0, delimiterIndex);
                        let value = variable.substring(delimiterIndex + 1);
                        process.env[key] = value;
                    } else {
                        process.env[variable] = 'true';
                    }
                });
            } else {
                throw new Error('Missing value for environment.');
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
            value = getValue(i);
            options.historyApiFallback = value || true;
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

        case '--https': 
            options.https = true;
            break;

        case '--key': 
            value = getValue(i);
            if (value) {
                options.key = value;
            } else {
                throw new Error('Missing path for private key to use with https.');
            }
            break;

        case '--cert': 
            value = getValue(i);
            if (value) {
                options.cert = value;
            } else {
                throw new Error('Missing path for cert to use with https.');
            }
            break;
    }
}

devServer(options).catch(e => {
    console.error(e.message);
    process.exit(1);
});

// Needed for posix systems when used with npm-run-all.
process.on('SIGTERM', () => {
    process.exit(0);
});