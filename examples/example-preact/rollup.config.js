let node_resolve = require('rollup-plugin-node-resolve');
let buble = require('rollup-plugin-buble');
let style_link = require('../plugins/rollup-plugin-style-link');
let jscc = require('rollup-plugin-jscc');

module.exports = {
    input: './src/main.js',
    experimentalCodeSplitting: true, // needed for asset emission
    output: {
        file: 'app._hash_.js',
        format: 'iife',
        assetFileNames: '[name][extname]'
    },
    plugins: [
        jscc({
            values: {
                _DEBUG: (process.env.NODE_ENV !== 'production')
            }
        }),
        style_link(),
        buble({
            jsx: 'h'
        }),
        node_resolve()
    ]
}