import babel from '@rollup/plugin-babel';
import hotcss from 'rollup-plugin-hot-css';
import static_files from 'rollup-plugin-static-files';
import { terser } from 'rollup-plugin-terser';
import refresh from 'rollup-plugin-react-refresh';

// Simple plugin that pre-compiles web dependencies into
// ESM compatible modules that can be easily imported without the need for additional plugins.
// This will increase initial compilation time, but subsequent restarts will be faster.
// This also compiles based on NODE_ENV as the end result may be different.
function esinstall (mods) {
    let fs = require('fs');
    let es = require('esinstall');
   
    return {
        buildStart () {
            for (let i = 0; i < mods.length; i++) {
                if (!fs.existsSync('web_modules/' + process.env.NODE_ENV + '/' + mods[i] + '.js')) {
                    console.log('[esinstall] Pre-compiling web modules...');
                    return es.install(mods, { dest: 'web_modules/' + process.env.NODE_ENV });
                }
            }
        },

        resolveId (id) {
            if (!id.startsWith('.')) {
                let parts = id.split('/');
                if (mods.indexOf(parts[0]) > -1) {
                    return {
                        id: process.cwd() + '/web_modules/' + process.env.NODE_ENV + '/' + id + '.js'
                    }
                }
            }
        }
    }
}

// Implements a caching layer over the babel code
// Unfortunately it's not really possible for Nollup to implement a cold cache.
// This is because the plugins are unpredictable and can have their own local state.
// A lot of the performance loss is a result of babel however. So we can implement
// a local cache layer here to reuse existing transformations.
function babel_cache (opts) {
    let babel_plugin = babel(opts);
    let crypto = require('crypto');
    let fs = require('fs');
    let cache = {};
    
    if (fs.existsSync('.babel_cache')) {
        cache = JSON.parse(fs.readFileSync('.babel_cache', 'utf8'));
    }

    process.on('SIGINT', () => {
        fs.writeFileSync('.babel_cache', JSON.stringify(cache));
        process.exit();
    });

    return {
        ...babel_plugin,
        transform: async (code, id) => {
            // Transformations can change between dev/test/prod
            if (process.env.NODE_ENV !== 'development') {
                return babel_plugin.transform(code, id);
            }
            
            if (id.indexOf('node_modules') > -1 || id.indexOf('web_modules') > -1) {
                return null;
            }

            let key = id + '-' + crypto.createHash('md5').update(code).digest("hex");
            if (cache[key]) {
                return JSON.parse(cache[key]);
            }

            let result = await babel_plugin.transform(code, id);
            cache[key] = JSON.stringify(result);
            return result;
        }
    }
}

let config = {
    input: './src/main.js',
    output: {
        dir: 'dist',
        format: 'esm',
        entryFileNames: '[name].[hash].js',
        assetFileNames: '[name].[hash][extname]'
    },
    plugins: [
        hotcss({
            hot: process.env.NODE_ENV === 'development',
            filename: 'styles.css'
        }),
        babel_cache({
            babelHelpers: 'bundled',
            exclude: ['node_modules/**', 'web_modules/**']
        }),
        esinstall(['react', 'react-dom']),
        process.env.NODE_ENV === 'development' && refresh()
    ]
}

if (process.env.NODE_ENV === 'production') {
    config.plugins = config.plugins.concat([
        static_files({
            include: ['./public']
        }),
        terser()
    ]);
}

export default config;