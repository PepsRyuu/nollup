module.exports = {
    input: `../${process.env.APP_TARGET}/src/main.js`,
    output: {
        dir: 'dist',
        format: 'esm',
        entryFileNames: '[name].js'
    }
}