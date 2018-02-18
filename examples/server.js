let express = require('express');
let path = require('path');
let nollup = require('../src');
let app = express();

let output;
let options = require(__dirname + '/' + process.argv[2] + '/config.js');

if (!process.argv[2]) {
    console.log('ERROR: Missing example to load.');
    process.exit(1);
}

options.input = path.resolve(path.resolve(__dirname, process.argv[2]), options.input);

nollup(options, (result, stats, err) => {
    if (err) {
        return console.log(err.stack);
    }

    console.log('Compiled in ' + stats.time + 'ms');
    output = result.code
});

app.use((req, res, next) => {
    if (req.url === '/bundle.js') {
        res.writeHead(200, {
            'Content-Type': req.url.indexOf('.js') > 0? 'application/javascript' : 'text/css'
        });

        res.write(output);
        res.end();
    } else {
        next();
    }
});

app.use(express.static(__dirname));
app.listen(9001);
console.log('Listening on http://localhost:9001');
