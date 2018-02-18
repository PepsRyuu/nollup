let babel = require('rollup-plugin-babel');
let node_resolve = require('rollup-plugin-node-resolve');
let commonjs = require('rollup-plugin-commonjs');
let less = require('rollup-plugin-less');

module.exports = {
    input: './src/main.js',
    plugins: [
        less({
            insert: true,
            output: css => css
        }),
        node_resolve(),
        commonjs(),
        babel()
    ]
};