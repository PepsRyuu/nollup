let node_resolve = require('rollup-plugin-node-resolve');

module.exports = {
    input: './src/main.js',
    output: {
        dir: 'dist',
        format: 'esm',
        entryFileNames: '[name].js'
    },
    plugins: [
        node_resolve({
            jsnext: true
        })
    ]
}