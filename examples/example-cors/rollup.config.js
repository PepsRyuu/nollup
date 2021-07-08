export default {
    input: './src/main.js',
    output: {
        dir: 'dist',
        format: 'esm',
        entryFileNames: '[name].js',
        assetFileNames: '[name][extname]'
    },
}