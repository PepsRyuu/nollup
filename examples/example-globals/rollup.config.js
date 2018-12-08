module.exports = {
    input: './src/main.js',
    experimentalCodeSplitting: true,
    output: {
        file: 'app._hash_.js',
        format: 'iife',
        globals: {
            'jquery': '$',
            'maths': 'Math'
        }
    },
    external: ['jquery', 'maths', 'underscore', 'browser-document', 'location']
}