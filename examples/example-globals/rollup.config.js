module.exports = {
    input: './src/main.js',
    output: {
        dir: 'dist',
        format: 'esm',
        globals: {
            'jquery': '$',
            'maths': 'Math'
        }
    },
    external: ['jquery', 'maths', 'underscore', 'browser-document', 'location']
}