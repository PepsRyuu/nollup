let es_to_cjs = require('./es_to_cjs');
let fs = require('fs');
let path = require('path');
let chokidar = require('chokidar');
let ConvertSourceMap = require('convert-source-map');
let acorn = require('acorn');

/**
 * Some APIs such as rollup-plugin-commonjs use the transform context
 * methods to parse the code rather than importing acorn themselves.
 *
 * @method createTransformContext
 * @return {Object}
 */
function createTransformContext () {
    let defaultAcornOptions = {
        ecmaVersion: 2018,
        sourceType: 'module',
        preserveParens: false
    };

    return {
        parse (code, options = {}) {
            return acorn.parse(code, Object.assign({}, defaultAcornOptions, options));
        },

        warn (e) {
            console.warn(e);
        },

        error (e) {
            throw e;
        }
    }
}

/**
 * Resolves the target path against the current path.
 *
 * @method resolvePath
 * @param {String} target
 * @param {String} current
 * @return {String}
 */
function resolvePath (target, current) {
    if (path.isAbsolute(target)) {
        return path.normalize(target);
    } else {
        // Plugins like CommonJS have namespaced imports.
        let parts = target.split(':');
        let namespace = parts.length === 2? parts[0] + ':' : '';
        let file = parts.length === 2? parts[1] : parts[0];
        let ext = path.extname(file);

        return namespace + path.normalize(path.resolve(path.dirname(current), ext? file : file + '.js'));
    }
}

/**
 * Calls the specified method on the plugin 
 * returning it's output when resolved.
 *
 * @method callPluginMethod
 * @param {Plugin} plugin
 * @param {String} method
 * @param {...} args
 * @return {Promise}
 */
async function callPluginMethod (thisValue, plugin, method, ...args) {
    if (plugin[method]) {
        let value;

        if (typeof plugin[method] === 'string') {
            value = plugin[method];
        } else {
            let hr = plugin[method].call(thisValue, ...args);
            if (hr instanceof Promise) {
                value = await hr;
            } else {
                value = hr;
            }
        }

        return value;
    }
}

/**
 * For 'intro', 'outro', 'banner', and 'footer' hooks.
 * Calls them, and when resolved contains a string.
 *
 * @method callPluginTextMethod
 * @param {Context} context
 * @param {String} method
 * @return {Promise}
 */
async function callPluginTextMethod (context, method) {
    let { plugins } = context.options;
    let output = '';

    for (let i = 0; i < plugins.length; i++) {
        let value = await callPluginMethod(null, plugins[i], method);

        if (value) {
            output += value;
        }
    }

    return output;
}

/**
 * For 'load', 'resolveId' and 'transform' hooks.
 * Calls them, and when resolved contains their output.
 *
 * @method callPluginCompileMethod
 * @param {Context} context,
 * @param {String} method
 * @param {...} args
 * @return {Promise}
 */
async function callPluginCompileMethod (context, thisValue, method, ...args) {
    let { plugins } = context.options;

    for (let i = 0; i < plugins.length; i++) {
        let value = await callPluginMethod(thisValue, plugins[i], method, ...args);
        
        if (value !== null && value !== undefined) {
            return value;
        }
    }
}

/**
 * Resolve the target dependency path relative to the current file.
 * If a hook provides a result, that result is returned instead.
 *
 * @method resolveId
 * @param {Context} context
 * @param {String} target
 * @param {String} current
 * @return {Promise}
 */
async function resolveId (context, target, current) {
    let result = await callPluginCompileMethod(context, null, 'resolveId', target, current);

    // Explicitly checked for so that modules can be excluded.
    if (result === false) {
        return false;
    }

    result = result || resolvePath(target, current);
    return path.normalize(result);
}

/**
 * Load the target file from disk. 
 * If a hook provides a result, that's returned instead.
 *
 * @method load
 * @param {Context} context,
 * @param {String} target
 * @param {String} current
 * @return {Promise}
 */
async function load (context, target, current) {
    let hr = await callPluginCompileMethod(context, null, 'load', target);
    return hr || fs.readFileSync(target, 'utf8');
}

/**
 * If a hook has a transform method, the code is transformed using that hook.
 * If there isn't any, the code is returned wrapped in an object.
 *
 * @method transform
 * @param {Context} context
 * @param {String} code
 * @param {String} filepath
 * @return {Promise}
 */
async function transform (context, code, filepath) {
    let result = await callPluginCompileMethod(context, createTransformContext(), 'transform', code, filepath);
    if (result !== null && result !== undefined) {
        return typeof result === 'object'? result : { code: result };
    }

    return { code };
}

/**
 * Loads target module.
 *
 * @method parse
 * @param {Context} context
 * @param {String} target
 * @param {String} current
 * @return {Promise}
 */
async function parse (context, filepath, current) {
    // If false, module is not included.
    if (filepath) {

        let file = context.files[filepath];

        if (!file) {
            file = {};

            let rawCode = await load(context, filepath, current);
            let { code, map } = await transform(context, rawCode, filepath);
            let { dependencies, output } = es_to_cjs(code);

            file.code = output;
            file.dependencies = dependencies || [];
            file.map = map;

            // Source maps sometimes don't have sources.
            if (map) {
                map.sources = map.sources || [];
                map.sourcesContent = map.sourcesContent || [];
                map.sources[0] = filepath;
                map.sourcesContent[0]  = rawCode;
            }

            context.files[filepath] = file;
        }       
        
        let dependencies = file.dependencies;

        for (let i = 0; i < dependencies.length; i++) {
            dependencies[i] = await resolveId(context, dependencies[i], filepath);
        }

        let errorThrown = false;

        for (let i = 0; i < dependencies.length; i++) {
            // If one of these fails at all, then the rest won't get parsed again on a file change because we don't parse the full tree of code.
            try {
                await parse(context, dependencies[i], filepath);
            } catch (e) {
                errorThrown = new Error('Error in ' + dependencies[i] + '\n' + e.stack);
                delete context.files[dependencies[i]];
            }
            
        }

        if (errorThrown) {
            delete context.files[filepath];
            throw errorThrown;
        }
    }
}

/**
 * Generates code. 
 *
 * @method generate
 * @param {Context}
 * @return {Promise}
 */
async function generate (context) {
    let intro = await callPluginTextMethod(context, 'intro');
    let outro = await callPluginTextMethod(context, 'outro');
    let banner = await callPluginTextMethod(context, 'banner');
    let footer = await callPluginTextMethod(context, 'footer');

    let file_index_map = Object.keys(context.files);
    let main_entry = file_index_map.indexOf(context.options.input);

    let files = Object.keys(context.files).map(filepath => {
        let { code, map, dependencies } = context.files[filepath];
       
        // Inject require numbers into module code.
        code = code.replace(/__nollup__(\d+)/g, (match, index) => {
            let dependency = dependencies[index];

            if (!context.files[dependency]) {
                throw new Error('File not found: ' + dependency);
            }

            return file_index_map.indexOf(dependency);
        });
        
        // Turning the code into eval statements, so we need
        // to escape line breaks and quotes. Using a multiline
        // approach here so that the compiled code is still
        // readable for advanced debugging situations.
        code = code
                   .replace(/\\/g, '\\\\')
                   .replace(/'/g, '\\\'')
                   .replace(/(\r)?\n/g, '\\n\\\n')
                   .replace(/\/\/# sourceMappingURL=(.*?)($|\n)/g, '') // remove existing sourcemapurls


        // Transform the source path so that they display well in the browser debugger.
        let sourcePath = path.relative(process.cwd(), filepath).replace(/\\/g, '/');

        // Append source mapping information
        if (map) {
            map.sourceRoot = 'nollup:///';
            map.sources[0] = sourcePath;
            code += `\\\n${ConvertSourceMap.fromObject(map).toComment()}`;
        } else {
            code += `\\\n//# sourceURL=nollup:///${sourcePath}`;
        }

        return [
            'function (require, module, exports) {',
            'eval(\'"use strict";' + code + '\')',
            '},'
        ].join('\n');

    }).join('')

    return [
        banner,
        intro,
        `
(function (modules) {
    let installed = {};

    let require = function (number) {
        if (!installed[number]) {
            let module = {
                exports: {}
            };

            modules[number](function (number) {
                return require(number);
            }, module, module.exports);

            installed[number] = module;
        }

        return installed[number].exports;
    };

    return require(${main_entry});
})([
        `,
        files,
        `
]);
        `,
        outro,
        footer
    ].join('\n');
}

/**
 * Bundles the code starting with the input.
 * Calls callback with output, stats, and error.
 *
 * @method bundle
 * @param {Context} context
 * @param {String} input
 * @param {Function} callback
 */
async function bundle (context, input, callback) {
    let start = Date.now();

    try {
        context.processing = true;
        await parse(context, input, process.cwd() + '/__entry__');

        context.options.plugins.forEach(plugin => {
            if (plugin.ongenerate) {
                plugin.ongenerate({});
            }
        });

        let output = {
            code: await generate(context),
            map: ''
        };

        let stats = {
            time: Date.now() - start 
        };

        context.processing = false;
        callback(output, stats);
    } catch (e) {
        context.processing = false;
        callback(undefined, undefined, e);
    }
}

/**
 * Creates an instance of nollup bundler.
 * Accepts 'input', 'plugins' for options.
 * Callback is triggered each time modules are compiled.
 * Starts a watcher and compiles on file change.
 *
 * @method nollup
 * @param {Object} options
 * @param {Function} callback
 */
function nollup (options, callback) {
    let context = {
        files: {},
        options,
        processing: false
    };

    // Stub plugins if needed
    if (!context.options.plugins) {
        context.options.plugins = [];
    }

    // Plugin hook manipulates options object.
    context.options.plugins.forEach(plugin => {
        plugin.options && plugin.options(options);
    });

    // Start watcher. Listens to the directory that the input is from.
    // TODO: Probably need to make this more flexible. 
    let watcher = chokidar.watch(path.dirname(options.input));
    watcher.on('change', file => {
        if (context.processing) {
            return;
        }

        let fullInputPath = resolvePath(file, path.dirname(options.input));  
          
        // If the file changed, we need to invalidate it.
        if (context.files[fullInputPath]) {
            delete context.files[fullInputPath];
        }

        bundle(context, options.input, callback);
    });

    // Let's start compiling!
    bundle(context, options.input, callback);
}

module.exports = nollup;