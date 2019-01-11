let node_resolve = require('rollup-plugin-node-resolve');
let babel = require('rollup-plugin-babel');
let hotcss = require('rollup-plugin-hot-css');
let commonjs = require('rollup-plugin-commonjs-alternate');
let replace = require('rollup-plugin-replace');
let jscc = require('rollup-plugin-jscc');

module.exports = {
    input: './src/main.js',
    output: {
        dir: 'dist',
        format: 'esm',
        assetFileNames: '[name][extname]'
    },
    plugins: [
        jscc({
            values: {
                _DEBUG: (process.env.NODE_ENV !== 'production')
            }
        }),
        replace({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        }),
        hotcss({
            hot: process.env.NODE_ENV !== 'production',
            filename: 'styles._hash_.css'
        }),
        babel(),
        node_resolve(),
        commonjs({
            namedExports: {
                'node_modules/react/index.js': [
                    'Component'
                ]
            }
        })
    ]
}