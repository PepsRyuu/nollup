module.exports = {
    input: './src/main.js',
    output: {
        file: 'app._hash_.js',
        format: 'esm',
        globals: {
            'jquery': '$',
            'maths': 'Math'
        }
    },
    external: ['jquery', 'maths', 'underscore', 'browser-document', 'location']
}