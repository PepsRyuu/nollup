import node_resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import static_files from 'rollup-plugin-static-files';

let config = {
    input: ['./src/single-export-main.js', './src/multiple-export-main.js', './src/dynamic-import-main.js'],
    external: ['my-external-module', 'my-external-module-dynamic'],
    output: {
        dir: 'dist',
        format: 'amd',
        entryFileNames: '[name].js',
        assetFileNames: '[name][extname]'
    },
    plugins: [ 
        {
            generateBundle() {
                let fs = require('fs');

                this.emitFile({
                    type: 'asset',
                    fileName: 'require.js',
                    source: fs.readFileSync('node_modules/requirejs/require.js')
                });
            }
        },
        babel({
            exclude: 'node_modules/**'
        }),
        node_resolve()
    ]
}

if (process.env.NODE_ENV === 'production') {
    config.plugins = config.plugins.concat([
        static_files({
            include: ['./public']
        })
    ]);
}

export default config;
