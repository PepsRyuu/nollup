import typescript from '@rollup/plugin-typescript';
import { RollupOptions } from 'rollup';

let config: RollupOptions = {
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