// @ts-check
let PluginMeta = require('./PluginMeta');

/**
 * @param {RollupOptions} opts 
 * @return {RollupOptions}
 */
function applyDefaultOptions (opts) {
    return {
        input: opts.input,
        plugins: (opts.plugins || []).filter(p => Boolean(p)),
        external: opts.external || [],
        context: opts.context || undefined,
        moduleContext: opts.moduleContext || undefined
    };
}

/**
 * @param {RollupModuleFormat} format 
 * @return {RollupModuleFormat}
 */
function normalizeFormat (format) {
    if (format === 'esm' || format === 'module') {
        return 'es';
    }

    if (format === 'commonjs') {
        return 'cjs';
    }

    return format;
}

/**
 * @param {string} format 
 */
function validateOutputFormat (format) {
    const formats = ['es', 'cjs', 'iife', 'amd'];

    if (formats.indexOf(format) === -1) {
        throw new Error(`Invalid format "${format}". Only ${formats.join(', ')} supported.`);
    }
}

/**
 * @param {RollupOptions} options 
 * @return {RollupOptions}
 */
function callOptionsHook (options) {
    if (options.plugins) {
        options.plugins.forEach(plugin => {
            if (plugin && plugin.options) {
                options = plugin.options.call({
                    meta: PluginMeta
                }, options) || options;
            }
        });    
    }
    
    return options;
}

/**
 * @param {RollupPlugin[]} plugins 
 * @param {RollupOutputOptions} outputOptions 
 */
function callOutputOptionsHook (plugins, outputOptions) {
    if (plugins) {
        plugins.forEach(plugin => {
            if (plugin.outputOptions) {
                outputOptions = plugin.outputOptions.call({
                    meta: PluginMeta
                }, outputOptions) || outputOptions;
            }
        });
    }

    return outputOptions;
}

/**
 * @param {RollupInputOption} input 
 * @return {string[]|Object<string, string>}
 */
function normalizeInput (input) {
    if (typeof input === 'string') {
        return [input];
    }

    if (Array.isArray(input)) {
        return input;
    }

    return input;
}

class RollupConfigContainer {
    /** 
     * @param {RollupOptions} options 
     */
    constructor (options) {
        options = applyDefaultOptions(options);
        options = callOptionsHook(options);

        this.input = normalizeInput(options.input);
        this.plugins = /** @type {RollupPlugin[]} */ (options.plugins);
        this.output = /** @type {RollupOutputOptions} */ (options.output || {});
        this.external = /** @type {RollupExternalOption} */ (options.external); 
        this.acornInjectPlugins = /** @type {Function|Function[]} */ (options.acornInjectPlugins); 
        this.context = /** @type {string} */ (options.context); 
        this.moduleContext = /** @type {function(string):string | {[id: string]: string }} */ (options.moduleContext)
    }

    /**
     * @param {RollupOutputOptions} outputOptions 
     */
    setOutputOptions (outputOptions) {
        outputOptions = callOutputOptionsHook(this.plugins, outputOptions);

        let output = {
            assetFileNames: 'assets/[name]-[hash][extname]',
            chunkFileNames: '[name]-[hash].js',
            entryFileNames: '[name].js',
            format: /** @type {RollupModuleFormat} */ ('es'),
            globals: {},
            ...outputOptions
        };

        if (output.format) {
            output.format = normalizeFormat(output.format);
            validateOutputFormat(output.format);
        }

        this.output = output;
    }
}

module.exports = RollupConfigContainer;