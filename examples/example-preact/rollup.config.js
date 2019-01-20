let node_resolve = require('rollup-plugin-node-resolve');
let buble = require('rollup-plugin-buble');
let hotcss = require('rollup-plugin-hot-css');
let jscc = require('rollup-plugin-jscc');
let static_files = require('rollup-plugin-static-files');

module.exports = {
    input: './src/main.js',
    output: {
        dir: 'dist',
        format: 'esm',
        entryFileNames: '[name].[hash].js',
        assetFileNames: '[name].[hash][extname]'
    },
    plugins: [
        jscc({
            values: {
                _DEBUG: (process.env.NODE_ENV !== 'production')
            }
        }),
        hotcss({
            hot: process.env.NODE_ENV !== 'production',
            filename: 'styles.css'
        }),
        buble({
            jsx: 'h'
        }),
        node_resolve(),
        process.env.NODE_ENV === 'production' && static_files({
            include: ['./public']
        })
    ]
}