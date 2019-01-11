let node_resolve = require('rollup-plugin-node-resolve');
let buble = require('rollup-plugin-buble');
let hotcss = require('rollup-plugin-hot-css');
let jscc = require('rollup-plugin-jscc');

module.exports = {
    input: './src/main.js',
    output: {
        file: 'app._hash_.js',
        format: 'esm',
        assetFileNames: '[name][extname]'
    },
    plugins: [
        jscc({
            values: {
                _DEBUG: (process.env.NODE_ENV !== 'production')
            }
        }),
        hotcss({
            hot: process.env.NODE_ENV !== 'production',
            filename: 'styles._hash_.css'
        }),
        buble({
            jsx: 'h'
        }),
        node_resolve()
    ]
}