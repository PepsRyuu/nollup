let path = require('path');

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

        if (!options.output) {
            options.output = {};
        }

        options.plugins.forEach(plugin => {
            plugin.options && plugin.options(options);
        });

        let context = {
            input: getInputEntries(options.input),
            output: options.output,
            plugins: options.plugins, 
            external: options.external || [],
            files: {},
            assets: {},
            references: {},
            module_id_generator: 0,
            bundle: {},
            watchFiles: {}
        };

        if (options.output) {
            this.setOutput(context, options.output);
        }

        return context;
    },

    setOutput: function (context, output = {}) {
        output.assetFileNames = output.assetFileNames || 'assets/[name]-[hash][extname]';
        output.chunkFileNames = output.chunkFileNames || 'chunk-[name]-[hash].js';
        output.entryFileNames = output.entryFileNames || '[name].js';
        context.output = output;
    }
}
