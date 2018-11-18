let node_resolve = require('rollup-plugin-node-resolve');
let babel = require('rollup-plugin-babel');
let style_link = require('../plugins/rollup-plugin-style-link');
let commonjs = require('../plugins/rollup-plugin-commonjs');
let replace = require('rollup-plugin-replace');
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
        replace({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        }),
        style_link(),
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