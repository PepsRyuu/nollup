let nollup = require('../index');
let path = require('path');

/**
 * @class ConfigLoader
 */
module.exports = {
    /**
     * Uses compiler to compile rollup.config.js file.
     * This allows config file to use ESM, but compiles to CJS
     * so that import statements change to require statements.
     *
     * @method load
     * @param {String} filepath
     * @return Promise<Object>
     */
    async load (filepath) {
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

        // When function, resolve
        return (typeof config === 'function')
            ? await config()
            : config;
    }
};
