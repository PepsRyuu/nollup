let es2cjs = require('./__es2cjs');
let fs = require('fs');
let path = require('path');
let ConvertSourceMap = require('convert-source-map');
let acorn = require('acorn');

/**
 * Some APIs such as rollup-plugin-commonjs use the transform context
 * methods to parse the code rather than importing acorn themselves.
 *
 * @method createPluginContext
 * @return {Object}
 */
function createPluginContext (context) {
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
        },

        emitAsset (assetName, source) {
            let id = assetName.replace(/\./g, '_');
            context.assets[assetName] = source;
            return id;
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
 * For 'load', and 'resolveId' hooks.
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
        // TODO: Transform doesn't have the null check
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
    let result = await callPluginCompileMethod(context, createPluginContext(context), 'resolveId', target, current);

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
    let hr = await callPluginCompileMethod(context, createPluginContext(context), 'load', target);

    // TODO: Support load maps
    if (hr && hr.code) {
        hr = hr.code;
    }

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
    let { plugins } = context.options;
    let map;

    for (let i = 0; i < plugins.length; i++) {
        // TODO: Source maps    
        let result = await callPluginMethod(createPluginContext(context), plugins[i], 'transform', code, filepath);
        
        if (result !== undefined && result !== null) {
            code = typeof result === 'object'? result.code : result;
            map = typeof result === 'object'? result.map : undefined;
        }
    }

    return { code, map };
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
async function parse (context, filepath, current, level, isEntry) { 
    if (level >= 255) {
        throw new Error('Maximum parse call stack exceeded.');
    }

    // If false, module is not included.
    if (filepath) {
        let file = context.files[filepath];

        if (!file) {
            file = {
                module_id: context.module_id_generator++,
                code: '',
                map: null,
                dependencies: [],
                invalidate: true,
                isEntry
            };

            context.files[filepath] = file;
        }

        if (file.invalidate) {
            let oldDependencies = file.dependencies;
            let rawCode = await load(context, filepath, current);
            let { code, map } = await transform(context, rawCode, filepath);
            let { dependencies, output } = es2cjs(code);

            // Source maps sometimes don't have sources.
            if (map) {
                map.sources = map.sources || [];
                map.sourcesContent = map.sourcesContent || [];
                map.sources[0] = filepath;
                map.sourcesContent[0]  = rawCode;
            }

            dependencies = dependencies || [];
            for (let i = 0; i < dependencies.length; i++) {
                dependencies[i] = await resolveId(context, dependencies[i], filepath);
            }

            file.code = output;
            file.dependencies = dependencies;
            file.map = map;
            file.invalidate = false;

            // Keeping references in a separate object so it's
            // not tied to whether or not a module successfully loads.
            // Unsuccessful loads can make it difficult to track references.
            oldDependencies.forEach(dep => {
                if (context.references[dep]) {
                    context.references[dep]--;
                }
            });

            file.dependencies.forEach(dep => {
                if (context.references[dep] === undefined) {
                    context.references[dep] = 0;
                }

                context.references[dep]++;
            });
        }    
        
        
        let dependencies = file.dependencies;

        for (let i = 0; i < dependencies.length; i++) {
            try {
                await parse(context, dependencies[i], filepath, level + 1);
            } catch (e) {
                throw new Error((e.message || e) + '\n' + ' --- ' + dependencies[i]);
            } 
        }
    }
}

function createFileFunctionWrapper (context, filepath) {
    let { code, map, dependencies } = context.files[filepath];
       
    // Inject require numbers into module code.
    code = code.replace(/__nollup__(\d+)/g, (match, index) => {
        let dependency = dependencies[index];

        if (!context.files[dependency]) {
            throw new Error('File not found: ' + dependency);
        }

        return context.files[dependency].module_id;
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
        code += `\\\n//# sourceURL=${sourcePath}`;
    }

    return [
        'function (require, module, exports) {',
        'eval(\'"use strict";' + code + '\')',
        '}'
    ].join('\n');
}

/**
 * Generates code. 
 *
 * @method generate
 * @param {Context}
 * @return {Promise}
 */
async function generate (context, input) {
    let intro = await callPluginTextMethod(context, 'intro');
    let outro = await callPluginTextMethod(context, 'outro');
    let banner = await callPluginTextMethod(context, 'banner');
    let footer = await callPluginTextMethod(context, 'footer');

    let files = Object.keys(context.files).map(filepath => {
        return context.files[filepath].module_id + ':' + createFileFunctionWrapper(context, filepath);
    }).join(',')

    return [
        banner,
        intro,
        `
(function (modules) {
    let instances = {};

    let require = function (parent, number) {
        if (!instances[number] || instances[number].invalidate) {
            let module = {
                id: number,
                exports: {},
                dependencies: []
            };

            ${context.options.plugins.filter(p => p.nollupModuleInit).map(p => {
                return `
                    (function () {
                        ${p.nollupModuleInit()}
                    })();
                `;
            })}

            modules[number](function (dep) {
                return require(module, dep);
            }, module, module.exports);

            instances[number] = module;
        }

        if (parent && parent.dependencies.indexOf(number) === -1) {
            parent.dependencies.push(number);
        }

        return instances[number].exports;
    };

    ${context.options.plugins.filter(p => p.nollupBundleInit).map(p => {
        return `
            (function () {
                ${p.nollupBundleInit()}
            })();
        `;
    })}

    return require(null, ${context.files[input].module_id});
})({
        `,
        files,
        `
});
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

    let old_file_count = Object.keys(context.files).length;
    let invalidated = Object.keys(context.files).filter(filepath => context.files[filepath].invalidate);

    try {
        input = path.resolve(process.cwd(), input);
        context.processing = true;
        await parse(context, input, process.cwd() + '/__entry__', 0, true);

        let changed_modules = invalidated.map(f => ({
            id: context.files[f].module_id,
            code: createFileFunctionWrapper(context, f)
        }));

        let new_modules = Object.keys(context.files).slice(old_file_count).map(f => ({
            id: context.files[f].module_id,
            code: createFileFunctionWrapper(context, f)
        }));

        let removed_modules = Object.keys(context.files).filter(f => {
            return context.references[f] <= 0 && !context.files[f].isEntry;
        }).map(f => {
            let id = context.files[f].module_id;
            delete context.files[f];
            return { id, removed: true };
        });

        let main_output = {
            fileName: context.options.output.file,
            isEntry: true,
            code: await generate(context, input),
            map: null,
            modules: Object.keys(context.files).reduce((acc, val) => (acc[val] = true) && acc, {})
        };

        for (let i = 0; i < context.options.plugins.length; i++) {
            await callPluginMethod(
                createPluginContext(context), 
                context.options.plugins[i], 
                'generateBundle', 
                context.options.output, 
                Object.assign({}, {
                    [main_output.fileName]: main_output
                }, context.assets)
            );
        }

        context.options.plugins.forEach(plugin => {
            if (plugin.ongenerate) {
                plugin.ongenerate({});
            }
        });

        let props = {
            stats: {
                time: Date.now() - start 
            },
            changes: new_modules.concat(changed_modules).concat(removed_modules)
        };

        let output = context.options.experimentalCodeSplitting?
            Object.assign({}, props, {
                output: Object.assign({}, {
                    [main_output.fileName]: main_output
                }, context.assets)
            })
            :
            Object.assign({}, props, main_output);

        context.processing = false;
        return output;
    } catch (e) {
        context.processing = false;
        throw new Error(e.message + e.stack);
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
async function nollup (options) {
    let context = {
        files: {},
        options,
        processing: false,
        module_id_generator: 0,
        assets: {},
        references: {}
    };

    // Stub plugins if needed
    if (!context.options.plugins) {
        context.options.plugins = [];
    }

    if (!context.options.output) {
        context.options.output = {};
    }

    // Plugin hook manipulates options object.
    context.options.plugins.forEach(plugin => {
        plugin.options && plugin.options(options);
    });

    let queue = [];

    async function generateImpl (resolve, reject) {
        try {
            resolve(await bundle(context, options.input));
        } catch (e) {
            reject(e);
        }

        if (queue.length > 0) {
            queue.shift()();
        }
    }

    return {
        invalidate: file => {
            file = resolvePath(file, process.cwd() + '/__entry__');

            if (context.files[file]) {
                context.files[file].invalidate = true;
            }
        },

        generate: (outputOptions) => {
            if (outputOptions) {
                context.options.output = outputOptions;
            }

            return new Promise((resolve, reject) => {
                if (context.processing) {
                    queue.push(() => generateImpl(resolve, reject));
                } else {
                    generateImpl(resolve, reject);
                }
            });
        }
    }    
}

module.exports = nollup;