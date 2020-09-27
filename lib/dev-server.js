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

async function devServer(options) {
    if (fs.existsSync('.nolluprc')) {
        options = Object.assign({}, options, JSON.parse(fs.readFileSync('.nolluprc')));
    } else if (fs.existsSync('.nolluprc.js')) {
        options = Object.assign({}, options, require(path.resolve(process.cwd(), './.nolluprc.js')));
    }

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
        publicPath: options.publicPath
    }, server)

    app.use(nollup);

    if (options.proxy) {
        Object.keys(options.proxy).forEach(route => {
            let target = options.proxy[route];
            app.use(route, proxy(target, {
                proxyReqPathResolver: req => {
                    let req_path = require('url').parse(req.url).path;
                    return route + (req_path === '/' ? '' : req_path);
                }
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

    server.listen(options.port);

    console.log(`[Nollup] Listening on ${options.https ? 'https' : 'http'}://localhost:${options.port}`);
}

module.exports = devServer
