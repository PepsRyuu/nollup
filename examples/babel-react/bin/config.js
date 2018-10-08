let node_resolve = require('rollup-plugin-node-resolve');
let buble = require('rollup-plugin-buble');
let style_link = require('./rollup-plugin-style-link');
let jscc = require('rollup-plugin-jscc');
let alias = require('rollup-plugin-alias');
let replace = require('rollup-plugin-replace');
let babel = require('rollup-plugin-babel');
let commonjs = require('rollup-plugin-commonjs');
let path = require('path')


module.exports = {
    input: './src/main.js',
    experimentalCodeSplitting: true, // needed for asset emission
    output: {
        file: 'app._hash_.js',
        format: 'iife',
        assetFileNames: '[name][extname]'
    },
    plugins: [
        babel({
            exclude: 'node_modules/**'
        }),
        commonjs(),
        alias({
            react: path.resolve(
                process.cwd(),
                'node_modules/react/cjs/react.development.js',
            ),
            "react-dom": path.resolve(
                process.cwd(),
                'node_modules/react-dom/cjs/react-dom.development.js',
            ),
        }),
        jscc({
            values: {
                _DEBUG: (process.env.NODE_ENV !== 'production')
            }
        }),
        replace({
          'process.env.NODE_ENV': JSON.stringify('development'),
          'commonjsHelpers.commonjsRequire': 'require',
        }),
        style_link(),
        node_resolve()
    ]
}