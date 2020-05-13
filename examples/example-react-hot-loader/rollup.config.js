import node_resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import hotcss from 'rollup-plugin-hot-css';
import commonjs from 'rollup-plugin-commonjs-alternate';
import replace from 'rollup-plugin-replace';
import static_files from 'rollup-plugin-static-files';
import { terser } from 'rollup-plugin-terser';

let config = {
    input: './src/main.js',
    output: {
        dir: 'dist',
        format: 'esm',
        entryFileNames: '[name].[hash].js',
        assetFileNames: '[name].[hash][extname]'
    },
    plugins: [
        replace({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        }),
        hotcss({
            hot: process.env.NODE_ENV === 'development',
            file: 'styles.css'
        }),
        babel(),
        node_resolve(),
        commonjs()
    ]
}

if (process.env.NODE_ENV === 'production') {
    config.plugins = config.plugins.concat([
        static_files({
            include: ['./public']
        }),
        terser({
            compress: {
                global_defs: {
                    module: false
                }
            }
        })
    ]);
}

export default config;