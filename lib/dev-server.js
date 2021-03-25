let fs = require('fs');
let path = require('path');
let http = require('http');
let https = require('https');
let express = require('express');
let fallback = require('express-history-api-fallback');
let proxy = require('express-http-proxy');
let NollupDevMiddleware = require('./dev-middleware');
let ConfigLoader = require('./impl/ConfigLoader');
let app = express();

const loadConfig = (file) => ConfigLoader.load(path.resolve(process.cwd(), file));
const parseConfigJson = (file) => JSON.parse(fs.readFileSync(file));

const mergeOptions = (options) => {
    let nollupRc;

    if (fs.existsSync(options.rcFile)) {
        let file = options.rcFile;
        delete options.rcFile;

        if (options.rcFile.endsWith('.js')) {
            nollupRc = await loadConfig(file);
        } else {
            nollupRc = parseConfigJson(file);
        }

        return Object.assign({}, options, nollupRc);
    }

    if (fs.existsSync('.nolluprc')) {
        nollupRc = parseConfigJson('.nolluprc');
    }

    if (fs.existsSync('.nolluprc.js')) {
        nollupRc = await loadConfig('.nolluprc.js');
    }

    return Object.assign({}, options, nollupRc);
}

async function devServer(options) {
    options = mergeOptions(options);

    if (options.before) {
        options.before(app);
    }

    let server
    if (options.https) {
        if (!(options.key && options.cert)) {
            throw new Error('Usage of https requires cert and key to be set.')
        }
        const key = fs.readFileSync(options.key)
        const cert = fs.readFileSync(options.cert)
        server = https.createServer({ key, cert }, app)
    } else {
        server = http.createServer(app)
    }

    if (options.headers) {
        app.all('*', (req, res, next) => {
            for (let prop in options.headers) {
                res.setHeader(prop, options.headers[prop]);
            }

            next();
        });
    }

    let config = typeof options.config === 'string' ? await ConfigLoader.load(options.config) : options.config;
    let nollup = NollupDevMiddleware(app, config, {
        hot: options.hot,
        verbose: options.verbose,
        headers: options.headers,
        hmrHost: options.hmrHost,
        contentBase: options.contentBase,
        publicPath: options.publicPath,
        liveBindings: options.liveBindings
    }, server)

    app.use(nollup);

    if (options.proxy) {
        Object.keys(options.proxy).forEach(route => {
            let opts = options.proxy[route];

            if (typeof opts === 'string') {
                opts = { host: opts };
            }

            let { host, ...routeOptions } = opts;
            
            app.use(route, proxy(host, {
                proxyReqPathResolver: req => {
                    return require('url').parse(req.originalUrl).path;
                },
                ...routeOptions
            }));
        });
    }

    app.use(express.static(options.contentBase, {
        index: options.historyApiFallback? false : 'index.html'
    }));

    if (options.after) {
        options.after(app);
    }

    if (options.historyApiFallback) {
        let entryPoint = typeof options.historyApiFallback === 'string'? options.historyApiFallback : 'index.html';

        let publicPath = options.publicPath || '/';
        if (!publicPath.startsWith('/')) {
            publicPath = '/' + publicPath;
        }

        if (!publicPath.endsWith('/')) {
            publicPath = publicPath + '/';
        }

        app.use((req, res, next) => {
            req.url = publicPath + entryPoint;
            nollup(req, res, next);
        });

        app.use(fallback(entryPoint, { root: options.contentBase }));
    }

    server.listen(options.port, options.host || 'localhost');

    console.log(`[Nollup] Listening on ${options.https ? 'https' : 'http'}://${options.host || 'localhost'}:${options.port}`);
}

module.exports = devServer
