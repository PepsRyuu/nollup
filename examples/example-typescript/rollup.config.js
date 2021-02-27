import typescript from '@rollup/plugin-typescript';

let config = {
    input: './src/main.ts',
    output: {
        dir: 'dist',
        format: 'esm',
        entryFileNames: '[name].[hash].js',
        assetFileNames: '[name].[hash][extname]'
    },
    plugins: [
        typescript()
    ]
}

export default config;