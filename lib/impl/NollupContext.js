let path = require('path');
let PluginContext = require('./PluginContext');

function getInputEntries (input) {
    let getName = file => path.basename(file).replace(path.extname(file), '');
    let getFile = file => path.resolve(process.cwd(), file);

    if (!input) {
        throw new Error('Input option not defined');
    }

    if (typeof input === 'string') {
        return [{ 
            name: getName(input),
            file: getFile(input)
        }];
    }

    if (Array.isArray(input)) {
        return input.map(file => {
            return {
                name: getName(file),
                file: getFile(file)
            };
        });
    }

    if (typeof input === 'object') {
        return Object.keys(input).map(key => {
            return {
                name: key,
                file: getFile(input[key])
            };
        });
    }
}

module.exports = {
    create: function (options) {
        if (!options.plugins) {
            options.plugins = [];
        }

        // Ignore falsy plugins
        options.plugins = options.plugins.filter(p => Boolean(p));

        if (!options.output) {
            options.output = {};
        }
        
        options.plugins.forEach(plugin => {
            if (plugin.options) {
                options = plugin.options.call({
                    meta: PluginContext.meta
                }, options) || options;
            }
        });

        let context = {
            options,
            input: getInputEntries(options.input),
            output: options.output,
            plugins: options.plugins, 
            external: options.external || [],
            files: {},
            emitted: {},
            references: {},
            module_id_generator: 0,
            bundle: {},
            watchFiles: {},
            externalFiles: {},
            externalDynamicFiles: {},
            pluginsContext: []
        };

        if (options.output) {
            this.setOutput(context, options.output);
        }

        options.plugins.forEach((plugin, index) => {
            context.pluginsContext[index] = PluginContext.create(context, plugin);
        });

        return context;
    },

    setOutput: function (context, output = {}) {
        output.assetFileNames = output.assetFileNames || 'assets/[name]-[hash][extname]';
        output.chunkFileNames = output.chunkFileNames || '[name]-[hash].js';
        output.entryFileNames = output.entryFileNames || '[name].js';
        output.format = output.format || 'esm';
        output.globals = output.globals || {};
        context.output = output;
    }
}
