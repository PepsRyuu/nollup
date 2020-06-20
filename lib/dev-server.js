let fs = require('fs');
let path = require('path');
let express = require('express');
let fallback = require('express-history-api-fallback');
let proxy = require('express-http-proxy');
let nollupDevServer = require('./dev-middleware');
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
                    return route + (req_path === '/' ? '' : req_path);
                }
            }));
        });
    }

    app.use(express.static(options.contentBase));

    if (options.after) {
        options.after(app);
    }

    if (options.historyApiFallback) {
        const entryPoint = typeof options.historyApiFallback === 'string'
            ? options.historyApiFallback
            : 'index.html'
        app.use(fallback(entryPoint, { root: options.contentBase }));
    }

    app.listen(options.port);

    console.log(`[Nollup] Listening on http://localhost:${options.port}`);
}

module.exports = devServer