export default {
    input: './src/main.js',
    output: {
        dir: 'dist',
        format: 'iife',
        globals: {
            'jquery': '$',
            'maths': 'Math',
            'underscore': '_'
        }
    },
    external: ['jquery', 'maths', 'underscore', 'document', 'location']
}