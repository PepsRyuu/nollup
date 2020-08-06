let AcornParser = require('./AcornParser');
let PluginContext = require('./PluginContext');
let PluginLifecycle = require('./PluginLifecycle');
let path = require('path');
let { resolvePath, getNameFromFileName } = require('./utils');

async function resolveInputId (context, input) {
    let resolved = await PluginLifecycle.hooks.resolveId(context, input, undefined);
    if (resolved === false || resolved.external) {
        throw new Error('Input cannot be external');
    } 

    return resolved.id;
}

async function getInputEntries (context, input) {
    if (!input) {
        throw new Error('Input option not defined');
    }

    if (typeof input === 'string') {
        input = await resolveInputId(context, input); 
        return [{ 
            name: getNameFromFileName(input),
            file: input
        }];
    }

    if (Array.isArray(input)) {
        return await Promise.all(input.map(async file => {
            file = await resolveInputId(context, file);
            return {
                name: getNameFromFileName(file),
                file: file
            };
        }));
    }

    if (typeof input === 'object') {
        return await Promise.all(Object.keys(input).map(async key => {
            let file = await resolveInputId(context, input[key]);
            return {
                name: key,
                file: file
            };
        }));
    }
}

function applyDefaultOptions (opts) {
    return {
        input: opts.input,
        plugins: (opts.plugins || []).filter(p => Boolean(p)),
        external: opts.external || []
    };
}

function callOptionsHook (options) {
    options.plugins.forEach(plugin => {
        if (plugin.options) {
            options = plugin.options.call({
                meta: PluginContext.meta
            }, options) || options;
        }
    });

    return options;
}

function callOutputOptionsHook (context, outputOptions) {
    context.plugins.forEach(plugin => {
        if (plugin.outputOptions) {
            outputOptions = plugin.outputOptions.call({
                meta: PluginContext.meta
            }, outputOptions) || outputOptions;
        }
    });

    return outputOptions;
}

function normalizeFormat (format) {
    if (format === 'esm' || format === 'module') {
        return 'es';
    }

    if (format === 'commonjs') {
        return 'cjs';
    }

    return format;
}

function validateOutputFormat (format) {
    const formats = ['es', 'cjs', 'iife'];

    if (formats.indexOf(format) === -1) {
        throw new Error(`Invalid format "${format}". Only ${formats.join(', ')} supported.`);
    }
}

module.exports = {
    async create (options) {
        if (options.acornInjectPlugins) {
            AcornParser.inject(options.acornInjectPlugins);
        }

        options = applyDefaultOptions(options);
        options = callOptionsHook(options);
        
        let context = {
            options: options,
            input: '',
            output: {},
            plugins: options.plugins || [],
            external: options.external,
            files: {}, // directory of all files parsed and cached
            dynamicChunks: {},
            emittedChunks: {},
            emittedAssets: {},
            watchFiles: {}, // additional files to watch
            externalFiles: {}, //directory of external files to load
            pluginsContext: [], // plugin context instances for plugins
            moduleIdGenerator: 0, // incremented as each file is parsed
            syntheticNamedExports: {}, // module ids with synthetic exports
            previousBundleModuleIds: new Set(), // used for hmr comparison
        };

        context.pluginsContext = context.plugins.map(p => {
            return PluginContext.create(context, p);
        });

        context.input = await getInputEntries(context, options.input);

        return context;
    },

    invalidate (context, filePath) {
        filePath = resolvePath(filePath, process.cwd() + '/__entry__');
        if (context.files[filePath]) {
            context.files[filePath].invalidate = true;
            PluginLifecycle.hooks.watchChange(context, filePath);
        }

         if (context.watchFiles[filePath]) {
            context.files[context.watchFiles[filePath]].invalidate = true;
            PluginLifecycle.hooks.watchChange(context, filePath);
        }
    },

    setOutputOptions (context, outputOptions) {
        outputOptions = callOutputOptionsHook(context, outputOptions);

        if (outputOptions.format) {
            outputOptions.format = normalizeFormat(outputOptions.format);
            validateOutputFormat(outputOptions.format);
        }

        outputOptions = {
            assetFileNames: 'assets/[name]-[hash][extname]',
            chunkFileNames: '[name]-[hash].js',
            entryFileNames: '[name].js',
            format: 'es',
            globals: {},
            ...outputOptions
        };

        context.output = {
            ...context.output,
            ...outputOptions
        };
    }
}