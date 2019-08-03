let terser = require('rollup-plugin-terser').terser;

let terser_options = {
    compress: {
        dead_code: true,
        global_defs: {
            module: false
        }
    }
};

module.exports = [{
    input: './src/entry-a.js',
    output: {
        dir: 'dist',
        format: 'esm',
        entryFileNames: '[name].js'
    },
    plugins: [
        process.env.NODE_ENV === 'production' && terser(terser_options)
    ]
}, {
    input: './src/entry-b.js',
    output: {
        dir: 'dist',
        format: 'esm',
        entryFileNames: '[name].js'
    },
    plugins: [
        process.env.NODE_ENV === 'production' && terser(terser_options)
    ]
}];