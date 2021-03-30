import node_resolve from '@rollup/plugin-node-resolve';

export default {
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