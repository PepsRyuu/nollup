export default {
    input: './src/main.js',
    output: {
        // You shouldn't really be putting your bundles
        // into "public" because that's considered a source
        // directory. But because Rollup template projects insist
        // on doing this, Nollup has compatibility. Always
        // put your build output into a separate "dist" directory.
        file: 'public/build/bundle.js',
        format: 'esm'
    }
}