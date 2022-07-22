// @ts-check
let nollup = require('../index');
let path = require('path');

const RollupPluginPrefixes = ['rollup-plugin-', '@rollup/plugin-'];

function getPlugins(values) {
    return values.map(moduleName => {
        if (!moduleName.startsWith('.') && !RollupPluginPrefixes.find(p => moduleName.startsWith(p))) {
            for (let i = 0; i < RollupPluginPrefixes.length; i++) {
                try {
                    moduleName = require.resolve(`${RollupPluginPrefixes[i]}${moduleName}`, { paths: [process.cwd()] });
                    break;
                } catch {
                    continue;
                }
            }
        }

        return require(moduleName)();
    });
}

module.exports = class ConfigLoader {
    /**
     * Uses compiler to compile rollup.config.js
     * or dynamic import to directly load rollup.config.mjs
     * 
     * @param {string} filepath
     * @param {string[]} configPlugins
     * @return {Promise<object>}
     */
    static async load(filepath, configPlugins) {        
        
        let bundle = await nollup({
            input: filepath,
            // If it isn't relative, it's probably a NodeJS import
            // so mark it as external so the require call persists.
            external: id => (id[0] !== '.' && !path.isAbsolute(id)) || id.slice(-5, id.length) === '.json',
            // Support --configPlugin flag to transform this config file before loading
            plugins: getPlugins(configPlugins || [])
        });

        let isESM = filepath.endsWith('.mjs');
        let { output } = await bundle.generate({ format: isESM? 'es' : 'cjs' });

        let config =  isESM?
            await ConfigLoader.loadESM(filepath, output[0].code) :
            await ConfigLoader.loadCJS(filepath, output[0].code);

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
     * @param {string} code
     * @return {Promise<object>}
     */
    static async loadCJS(filepath, code) {
        // Once transpiled, we temporarily modify the require function
        // so that when it loads the config file, it will load the transpiled
        // version instead, and all of the require calls inside that will still work.
        let defaultLoader = require.extensions['.js'];
        require.extensions['.js'] = (module, filename) => {
            if (filename === filepath) {
                // @ts-ignore
                module._compile(code, filename);
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
     * @param {string} code
     * @return {Promise<object>}
     */
    static async loadESM(filepath, code) {
        let uri = `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;
        return (await import(uri)).default;
    }
};
