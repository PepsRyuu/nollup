import html from '@rollup/plugin-html';
import hotcss from 'rollup-plugin-hot-css';

export default {
    input: './src/main.js',
    output: {
        dir: 'dist',
        format: 'esm',
        entryFileNames: '[name].[hash].js',
        assetFileNames: '[name].[hash][extname]'
    },
    plugins: [
        hotcss({
            fileName: 'style.css'
        }),
        html({
            publicPath: '/client/'
        })
    ]
}