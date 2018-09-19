let express = require('express');
let fallback = require('express-history-api-fallback');
let config = require('./config');
let nollupDevServer = require('../../lib/dev-middleware');
let app = express();

app.use(nollupDevServer(app, config, {
    watch: process.cwd() + '/src',
    hot: true
}));

app.use(express.static('./'));
app.use(express.static('./public'));
app.use(fallback('index.html', { root: './public' }));
app.listen(9001);

console.log('Listening on http://localhost:9001');