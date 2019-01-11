let path = require('path');
let ConvertSourceMap = require('convert-source-map');
let ImportExportResolver = require('./impl/ImportExportResolver');
let NollupContext = require('./impl/NollupContext');
let PluginContext = require('./impl/PluginContext');
let PluginLifecycle = require('./impl/PluginLifecycle');
let { formatFileName, resolvePath } = require('./impl/utils');

/**
 * Loads target module.
 *
 * @method parse
 * @param {Context} context
 * @param {String} target
 * @param {String} current
 * @return {Promise}
 */
async function parse (context, filepath, current, level, isEntry, input_modules) { 
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
            let rawCode = await PluginLifecycle.load(context, filepath, current);
            let { code, map } = await PluginLifecycle.transform(context, rawCode, filepath);
            let { dependencies, output, dynamicDependencies, exports } = ImportExportResolver(code, context);

            for (let i = 0; i < dependencies.length; i++) {
                dependencies[i] = await PluginLifecycle.resolveId(context, dependencies[i], filepath);
            }

            for (let i = 0; i < dynamicDependencies.length; i++) {
                dynamicDependencies[i] = await PluginLifecycle.resolveDynamicImport(context, dynamicDependencies[i], filepath);                
            }

            file.code = output;
            file.dependencies = dependencies;
            file.dynamicDependencies = dynamicDependencies;
            file.exports = exports;
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
        
        input_modules[filepath] = true;

        let dependencies = file.dependencies;

        for (let i = 0; i < dependencies.length; i++) {
            try {
                await parse(context, dependencies[i], filepath, level + 1, false, input_modules);
            } catch (e) {
                throw new Error((e.message || e) + '\n' + ' --- ' + dependencies[i] + e.stack);
            } 
        }

        let dynamicDependencies = file.dynamicDependencies;

        for (let i = 0; i < dynamicDependencies.length; i++) {
            try {

                // TODO: How to detect if dynamic dependency is removed.
                if (!context.dynamicDependencies[dynamicDependencies[i]]) {
                    context.dynamicDependencies[dynamicDependencies[i]] = {};
                }

                await parse(context, dynamicDependencies[i], filepath, 0, false, context.dynamicDependencies[dynamicDependencies[i]]);
            } catch (e) {
                throw new Error((e.message || e) + '\n' + ' --- ' + dynamicDependencies[i] + e.stack);
            } 
        }
    }
}

function createFileFunctionWrapper (context, filepath) {
    let { code, map, dependencies, dynamicDependencies } = context.files[filepath];

    // Inject require numbers into module code.
    code = code.replace(/__nollup__(dynamic__)?(\d+)/g, (match, isDynamic, index) => {
        let dependency = isDynamic? dynamicDependencies[index] : dependencies[index];

        if (!context.files[dependency]) {
            throw new Error('File not found: ' + dependency);
        }

        return isDynamic? 
            `'./${formatFileName(context, dependency, context.output.chunkFileNames)}'`
            :
            context.files[dependency].module_id;
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
        map.sources[map.sources.length - 1] = sourcePath;
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
async function generate (context, input, dynamicFileName) {
    let intro = await PluginLifecycle.callPluginTextMethod(context, 'intro');
    let outro = await PluginLifecycle.callPluginTextMethod(context, 'outro');
    let banner = await PluginLifecycle.callPluginTextMethod(context, 'banner');
    let footer = await PluginLifecycle.callPluginTextMethod(context, 'footer');

    let files = Object.keys(input.modules).map(filepath => {
        return context.files[filepath].module_id + ':' + createFileFunctionWrapper(context, filepath);
    }).join(',')

    if (dynamicFileName) {
        return `
            window.__nollup_dynamic_require_callback("./${dynamicFileName}", ${context.files[input.file].module_id}, {${files}});
        `;
    } else {
        return [
                banner,
                intro,
                `
        ${context.output.format === 'esm'? 'var __nollup_entry_exports = ' : ''}(function (modules) {
            let instances = {};
            let chunks = {};

            let require = function (parent, number) {
                if (!instances[number] || instances[number].invalidate) {
                    let module = {
                        id: number,
                        exports: {},
                        dependencies: []
                    };

                    ${context.plugins.filter(p => p.nollupModuleInit).map(p => {
                        return `
                            (function () {
                                ${p.nollupModuleInit()}
                            })();
                        `;
                    })}

                    let localRequire = function (dep) {
                        return require(module, dep);
                    };

                    ${Object.keys(context.dynamicDependencies).length > 0 &&                       
                        `
                            localRequire.dynamic = function (file) {
                                return new Promise(function (resolve) {
                                    if (chunks[file]) {
                                        let mod = require(module, chunks[file]);
                                        resolve(mod);
                                    } else {
                                        return import(file).then(() => {
                                            let mod = require(module, chunks[file]);
                                            resolve(mod);
                                        });
                                    }
                                });
                            };

                        `
                    }
                    
                    modules[number](localRequire, module, module.exports);

                    instances[number] = module;
                }

                if (parent && parent.dependencies.indexOf(number) === -1) {
                    parent.dependencies.push(number);
                }

                return instances[number].exports;
            };

            window.__nollup_dynamic_require_callback = function (file, chunk_entry_module, chunk_modules) {
                chunks[file] = chunk_entry_module;
                for (var key in chunk_modules) {
                    if (!modules[key]) {
                        modules[key] = chunk_modules[key];
                    }
                }
            };

            ${context.plugins.filter(p => p.nollupBundleInit).map(p => {
                return `
                    (function () {
                        ${p.nollupBundleInit()}
                    })();
                `;
            })}

            return require(null, ${context.files[input.file].module_id});
        })({
                `,
                files,
                `
        });

        ${context.output.format === 'esm'? context.files[input.file].exports.map(declaration => {
            if (declaration === 'default') {
                return 'export default __nollup_entry_exports.default;' 
            } else {
                return `export var ${declaration} = __nollup_entry_exports.${declaration};`
            }
        }).join('\n') : ''}
                `,
                outro,
                footer
            ].join('\n');
    }

    
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
async function bundle (context) {
    let start = Date.now();

    let old_file_count = Object.keys(context.files).length;
    let invalidated = Object.keys(context.files).filter(filepath => context.files[filepath].invalidate);

    context.dynamicDependencies = {};

    for (let i = 0; i < context.input.length; i++) {
        try {
            context.input[i].modules = {};
            await parse(context, context.input[i].file, process.cwd() + '/__entry__', 0, true, context.input[i].modules);
        } catch (e) {
            throw e;
        }
    }

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

    for (let i = 0; i < context.input.length; i++) {
        let input = context.input[i];
        let opts = context.output;
        let fileName = opts.file? opts.file : formatFileName(context, input.name, opts.entryFileNames);

        context.bundle[fileName] = {
            fileName,
            isEntry: true,
            code: await generate(context, input),
            map: null,
            modules: Object.keys(input.modules).reduce((acc, val) => (acc[val] = true) && acc, {})
        };
    }

    for (let key in context.dynamicDependencies) {
        let input = { file: key, modules: context.dynamicDependencies[key] };
        let opts = context.output;
        let fileName = formatFileName(context, key, opts.chunkFileNames);

        context.bundle[fileName] = {
            fileName,
            isDynamicEntry: true,
            code: await generate(context, input, fileName),
            map: null,
            modules: Object.keys(input.modules).reduce((acc, val) => (acc[val] = true) && acc, {})
        };
    }

    for (let i = 0; i < context.plugins.length; i++) {
        await PluginLifecycle.callPluginMethod(
            PluginContext.create(context), 
            context.plugins[i], 
            'generateBundle', 
            context.output, 
            context.bundle
        );
    }

    let props = {
        stats: {
            time: Date.now() - start 
        },
        changes: new_modules.concat(changed_modules).concat(removed_modules),
        output: Object.keys(context.bundle).map(fileName => context.bundle[fileName]).sort((a, b) => {
            if (a.isEntry) {
                return -1;
            } else if (a.isDynamicEntry) {
                return -1;
            } else {
                return 1;
            }
        })
    };

    return props;
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
    let queue = [];
    let processing = false;
    let context = NollupContext.create(options);

    async function generateImpl (resolve, reject) {
        processing = true;

        try {
            resolve(await bundle(context));
        } catch (e) {
            processing = false;
            reject(e);
        }

        processing = false;

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
                NollupContext.setOutput(context, outputOptions);
            }

            return new Promise((resolve, reject) => {
                if (processing) {
                    queue.push(() => generateImpl(resolve, reject));
                } else {
                    generateImpl(resolve, reject);
                }
            });
        }
    }    
}

module.exports = nollup;