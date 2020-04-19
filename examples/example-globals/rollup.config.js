export default {
    input: './src/main.js',
    output: {
        dir: 'dist',
        format: 'iife',
        globals: {
            'jquery': '$',
            'maths': 'Math'
        }
    },
    external: ['jquery', 'maths', 'underscore', 'browser-document', 'location']
}