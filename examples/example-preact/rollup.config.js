let node_resolve = require('rollup-plugin-node-resolve');
let babel = require('rollup-plugin-babel');
let hotcss = require('rollup-plugin-hot-css');
let static_files = require('rollup-plugin-static-files');
let terser = require('rollup-plugin-terser').terser;

let config = {
    input: './src/main.js',
    output: {
        dir: 'dist',
        format: 'esm',
        entryFileNames: '[name].[hash].js',
        assetFileNames: '[name].[hash][extname]'
    },
    plugins: [
        hotcss({
            hot: process.env.NODE_ENV === 'development',
            filename: 'styles.css'
        }),
        babel(),
        node_resolve()
    ]
}

if (process.env.NODE_ENV === 'production') {
    config.plugins = config.plugins.concat([
        static_files({
            include: ['./public']
        }),
        terser({
            compress: {
                global_defs: {
                    module: false
                }
            }
        })
    ]);
}

module.exports = config;