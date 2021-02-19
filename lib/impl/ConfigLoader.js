// @ts-check
let nollup = require('../index');
let path = require('path');
let url = require('url');

module.exports = class ConfigLoader {
    /**
     * Uses compiler to compile rollup.config.js
     * or dynamic import to directly load rollup.config.mjs
     * 
     * @param {string} filepath
     * @return {Promise<object>}
     */
    static async load(filepath) {
        let config = filepath.endsWith('.mjs') ?
            await ConfigLoader.loadESM(filepath) :
            await ConfigLoader.loadCJS(filepath);

        // When function, resolve
        return (typeof config === 'function')
            ? config()
            : config;
    }

    /**
     * Uses compiler to compile rollup.config.js file.
     * This allows config file to use ESM, but compiles to CJS
     * so that import statements change to require statements.
     *
     * @param {string} filepath
     * @return {Promise<object>}
     */
    static async loadCJS(filepath) {
        // If it isn't relative, it's probably a NodeJS import
        // so mark it as external so the require call persists.
        let bundle = await nollup({
            external: id => (id[0] !== '.' && !path.isAbsolute(id)) || id.slice(-5, id.length) === '.json',
            input: filepath
        });

        let { output } = await bundle.generate({ format: 'cjs' });

        // Once transpiled, we temporarily modify the require function
        // so that when it loads the config file, it will load the transpiled
        // version instead, and all of the require calls inside that will still work.
        let defaultLoader = require.extensions['.js'];
        require.extensions['.js'] = (module, filename) => {
            if (filename === filepath) {
                // @ts-ignore
                module._compile(output[0].code, filename);
            } else {
                defaultLoader(module, filename);
            }
        };

        delete require.cache[filepath];

        // Load the config file. If it uses ESM export, it will
        // be exported with a default key, so get that. Otherwise
        // if it was written in CJS, use the root instead.
        let config = require(filepath);
        config = config.default || config;
        require.extensions['.js'] = defaultLoader;

        return config;
    }

    /**
     * Directly imports rollup.config.mjs
     *
     * @param {string} filepath
     * @return {Promise<object>}
     */
    static async loadESM(filepath) {
        if(!filepath.startsWith('/') && !filepath.startsWith('./') && !filepath.startsWith('file://')) {
            // import needs a URL, not a path. (mainly for Windows)
            filepath = url.pathToFileURL(filepath).toString();
        }
        
        return (await import(filepath)).default;
    }
};
