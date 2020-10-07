let path = require('path');
let ConvertSourceMap = require('convert-source-map');
let PluginLifecycle = require('./PluginLifecycle');

function getSyntheticExports (context, filePath) {
    let synthetic = context.syntheticNamedExports[filePath];
    if (synthetic === true) {
        synthetic = 'default';
    }

    return `if (module.exports.${synthetic}) {
        for (var prop in module.exports.${synthetic}) {
            prop !== 'default' && __e__(prop, module.exports.${synthetic}[prop]);
        }
    }`
}

function generateFile (context, filePath) {
    let { code, map, imports, externalImports, dynamicImports } = context.files[filePath];

    // Validate dependencies exist.
    imports.forEach(dep => {
        if (!context.files[dep.source]) {
            throw new Error('File not found: ' + dep.source);
        }
    });
    
    // Turning the code into eval statements, so we need
    // to escape line breaks and quotes. Using a multiline
    // approach here so that the compiled code is still
    // readable for advanced debugging situations.
    code = code
               .replace(/\\/g, '\\\\')
               .replace(/'/g, '\\\'')
               .replace(/(\r)?\n/g, '\\n\\\n')


    // Transform the source path so that they display well in the browser debugger.
    let sourcePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');

    // Append source mapping information
    if (map) {
        map.sourceRoot = 'nollup:///';
        map.sources[map.sources.length - 1] = sourcePath;
        code += `\\\n${ConvertSourceMap.fromObject(map).toComment()}`;
    } else {
        code += `\\\n//# sourceURL=${sourcePath}`;
    }

    return `
        function (__c__, __r__, __d__, __e__) {
            ${imports.map(i => {
                return `var ${i.importee}; ${i.specifiers.map(s => 'var ' + s.local).join(';')};`
            }).join('; ')}

            ${externalImports.map(i => {
                return i.specifiers.map(s => {
                    if (s.imported === '*')
                        return `var ${s.local} = ${i.importee};`;
                    else
                        return `var ${s.local} = ${i.importee}${s.imported}__;`;
                }).join(' ');
            }).join('; ')}

            __d__(function () {
                ${imports.map(i => {
                    return i.specifiers.map(s => {
                        let output = `${s.local} = ${i.importee}()${s.imported === '*'? '' : `.${s.imported}`}`;

                        if (s.exportFrom) {
                            if (s.imported === '*') {
                                output += `;for(var __k__ in ex${i.importee}){__k__ !== "default" && (__e__(__k__, ex${i.importee}[__k__]))}`
                            } else {
                                output += `;__e__("${s.local.slice(3)}", ${s.local})`;
                            }
                        }

                        return output;
                    }).join(';');
                }).join('; ')}
            }, function (require, module, __nollup__global__) {
                "use strict";
                eval('${code}');
                ${context.syntheticNamedExports[filePath]? getSyntheticExports(context, filePath) : ''} 
            });

            ${imports.map(i => {
                return `${i.importee} = __c__(${context.files[i.source].moduleId}) && function () { return __r__(${context.files[i.source].moduleId}) }`;
            }).join('; ')}
        }   
    `.trim();
}

/**
 * Convert URL meta properties if they exist.
 * Otherwise, run the resolveImportMeta hook.
 *
 * @method resolveMetaProperty
 */
const FILE_PROPS = ['ROLLUP_FILE_URL_', 'ROLLUP_ASSET_URL_', 'ROLLUP_CHUNK_URL_'];
function resolveMetaProperties (context, chunk, bundle) {
    let metaPropMap = {};

    chunk.__metaProperties.forEach(entry => {
        let { moduleId, name } = entry;

        if (name) {
            for (let i = 0; i < FILE_PROPS.length; i++) {
                if (name.startsWith(FILE_PROPS[i])) {
                    let id = name.replace(FILE_PROPS[i], '');
                    let entry = bundle.find(e => e.referenceId === id) || {};
                    let replacement = PluginLifecycle.hooks.resolveFileUrl(
                        context,
                        name,
                        id,
                        entry.fileName,
                        entry.type,
                        moduleId,
                        chunk.fileName
                    );

                    metaPropMap[name] = replacement || '"' + entry.fileName + '"';
                    return;
                }
            }
        }

        let replacement = PluginLifecycle.hooks.resolveImportMeta(context, name, chunk.fileName, moduleId);
        if (replacement) {
            metaPropMap[name] = replacement;
            return;
        }

        return 'import.meta.' + name;
    });

    return Object.keys(metaPropMap).map(key => `'${key}': ${metaPropMap[key]}`).join(',\n');
}

function createExternalImports (context, externalImports) {
    let output = '';
    let { format, globals } = context.output;

    output += externalImports.map(ei => {
        let file = ei.source;
        let name = ei.source.replace(/[\W]/g, '_');
        let specifiers = ei.specifiers;

        // Bare external import
        if (specifiers.length === 0) {
            if (format === 'es') 
                return `import '${file}';`
            if (format === 'cjs') 
                return `require('${file}');`
        }

        return specifiers.map(s => {
            let iifeName = globals[file] || name;

            if (s === '*') {
                if (format === 'es') 
                    return `import * as __nollup__external__${name}__ from '${file}';`;
                if (format === 'cjs') 
                    return `var __nollup__external__${name}__ = require('${file}');`;
                if (format === 'iife') 
                    return `var __nollup__external__${name}__ = self.${iifeName};`
            }

            if (s === 'default') {
                if (format === 'es') 
                    return `import __nollup__external__${name}__default__ from '${file}';`;
                if (format === 'cjs') 
                    return `var __nollup__external__${name}__default__ = require('${file}').hasOwnProperty('default')? require('${file}').default : require('${file}');`
                if (format === 'iife') 
                    return `var __nollup__external__${name}__default__ = self.${iifeName} && self.${iifeName}.hasOwnProperty('default')? self.${iifeName}.default : self.${iifeName};`
            }

            if (format === 'es') 
                return `import { ${s} as __nollup__external__${name}__${s}__ } from '${file}';`;
            if (format === 'cjs') 
                return `var __nollup__external__${name}__${s}__ = require('${file}').${s};`
            if (format === 'iife') 
                return `var __nollup__external__${name}__${s}__ = self.${iifeName}.${s};`
        }).join('\n');
    }).join('\n');

    return output;
}

function generateDelta (context, bundle, file) {
    return `
        (function () {
            ${file.dynamicImports.length > 0? file.dynamicImports.map(di => `
                __nollup__import__map__add__entry('${di.replace(/\\/g, '\\\\')}', '${bundle.find(e => e.__entryModule === di).fileName}');
            `).join('\n') : ''}
            return ${file.generated}
        })();
    `
}

async function generateChunk (context, chunk, bundle, dynamicImports) {
    let [ intro, outro, banner, footer ] = await Promise.all([
        PluginLifecycle.hooks.intro(context),
        PluginLifecycle.hooks.outro(context),
        PluginLifecycle.hooks.banner(context),
        PluginLifecycle.hooks.footer(context)
    ]);

    let files = Object.keys(chunk.modules).map(filePath => {
        let file = context.files[filePath];
        return file.moduleId + ':' + file.generated;
    });

    if (chunk.isDynamicEntry) {
        return `
            (function (global) {
                var __nollup__import__meta__ = {
                    ${resolveMetaProperties(context, chunk, bundle)}
                };

                global.__nollup_dynamic_require_callback("${chunk.fileName}", ${chunk.__entryModuleId}, {${files}});
            })(typeof globalThis !== 'undefined'? globalThis : (
               typeof self !== 'undefined' ? self : this
               )
            );
        `;
    } else {
        return [
                banner,
                intro,
                createExternalImports(context, chunk.__externalImports),
        `   var __nollup__import__meta__ = {
                ${resolveMetaProperties(context, chunk, bundle)}
            };

            ${(chunk.exports.length > 0 && context.output.format === 'es')? 'var __nollup_entry_exports = ' : ''}(function (modules, __nollup__global__) {

            var __nollup__import__map__ = {
                ${bundle.filter(e => e.isDynamicEntry).map(e => {
                    return `'${e.__entryModule.replace(/\\/g, '\\\\')}': getRelativePath('${path.dirname(chunk.fileName)}', '${e.fileName}')`
                }).join(', \n')}
            };

            function getRelativePath (from, to) {
                from = from === '.'? [] : from.split('/');
                to = to.split('/');
   
                var commonLength = from.length;
                for (var i = 0; i < from.length; i++) {
                    if (from[i] !== to[i]) {
                        commonLength = i;
                        break;
                    }
                } 

                if (from.length - commonLength === 0) {
                    return './' + to.slice(commonLength).join('/')
                }

                return from.slice(commonLength)
                  .map(() => '..')
                  .concat(to.slice(commonLength))
                  .join('/');
            }

            function getResolvedPath (from, to) {
                from = from === '.'? [] : from.split('/');
                to = to.split('/');

                for (var i = 0; i < to.length; i++) {
                    if (to[i] === '..') {
                        from = from.splice(-1, 1);
                    } else if (to[i] !== '.') {
                        from.push(to[i]);           
                    }
                }

                return from.join('/');
            }

            var __nollup__import__map__add__entry = function (moduleId, chunkFileName) {
                __nollup__import__map__[moduleId] = getRelativePath('${path.dirname(chunk.fileName)}', chunkFileName);
            }

            var instances = {};
            var chunks = {};

            var create_module = function (number) {

                var module = {
                    id: number,
                    dependencies: [],
                    dynamicDependencies: [],
                    exports: {},
                    invalidate: false,
                    __resolved: false,
                    __resolving: false
                };

                instances[number] = module;

                ${context.plugins.filter(p => p.nollupModuleInit).map(p => {
                    return `
                        (function () {
                            ${p.nollupModuleInit()}
                        })();
                    `;
                }).join('\n')}

                modules[number](function (dep) {
                    if (!instances[dep] || instances[dep].invalidate) {
                        create_module(dep);
                    }

                    if (instances[number].dependencies.indexOf(dep) === -1) {
                        instances[number].dependencies.push(dep);
                    }

                    return true;
                }, function (dep) {
                    return get_exports(module, dep);
                }, function(binder, impl) {
                    module.__binder = binder;
                    module.__impl = impl;
                }, function (bindingName, bindingValue) {
                    if (module.exports[bindingName] !== bindingValue) {
                        module.exports[bindingName] = bindingValue;
                
                        Object.keys(instances).forEach(key => {
                            if (instances[key].dependencies.indexOf(number) > -1) {
                                instances[key].__binder();
                            }
                        })
                    }
                });

                // Initially this will bind nothing, unless
                // the module has been replaced by HMR
                module.__binder();
            };

            var get_exports = function (parent, number) {
                return instances[number].exports;
            };

            var resolve_module = function (parent, number) {
                var module = instances[number];

                if (module.__resolved) {
                    return;
                }

                module.__resolving = true;

                var localRequire = function (dep) {
                    ${context.output.format === 'cjs'? `
                        if (typeof dep === 'string') {
                            return require(dep);
                        }

                        if (!modules[dep]) {
                            throw new Error([
                                'Module not found: ' + dep,
                                '- Module doesn\\'t exist in bundle.'
                            ].join('\\n'));
                        }
                    `: `
                        if (typeof dep === 'string' || !modules[dep]) {
                            throw new Error([
                                'Module not found: ' + dep,
                                '- Did you call "require" using a string?',
                                '- Check if you\\'re using untransformed CommonJS.',
                                '- If called with an id, module doesn\\'t exist in bundle.'
                            ].join('\\n'));
                        }
                    `}
                    return _require(module, dep);
                };

                ${context.output.format === 'cjs'? `
                    for (var prop in require) {
                        localRequire[prop] = require[prop];
                    }
                ` : ''}

                var executeModuleImpl = function (module) {
                    ${context.plugins.filter(p => p.nollupModuleWrap).reduce(
                        (code, p) => p.nollupModuleWrap(code),
                        `
                        module.__impl(localRequire, module, __nollup__global__);
                        module.__resolved = true;
                        `
                    )}
                };

                localRequire.dynamic = function (file) {
                    return new Promise(function (resolve) {
                        var relative_file = __nollup__import__map__[file];
                        var resolved_file = getResolvedPath('${path.dirname(chunk.fileName)}', relative_file);

                        var cb = () => {
                            let id = chunks[resolved_file];
                            if (instances[number].dynamicDependencies.indexOf(id) === -1) {
                                instances[number].dynamicDependencies.push(id);
                            }

                            resolve(_require(module, id));
                        };

                        if (chunks[resolved_file]) {
                            cb();
                        } else {
                            ${context.output.format === 'es'? (`
                                return import(relative_file).then(cb);
                            `) : ''}
                            ${context.output.format === 'cjs'? (`
                                return Promise.resolve(require(relative_file)).then(cb);
                            `) : ''}
                        }
                    });
                };

                module.dependencies.forEach((dep) => {
                    if (!instances[dep].__resolved && instances[dep].__resolving) {
                        instances[dep].dependencies.forEach(dep => {
                            if (!instances[dep].__resolved && !instances[dep].__resolving) {
                                resolve_module(module, dep);
                            }
                        });
                        executeModuleImpl(instances[dep]);
                    }

                    if (!instances[dep].__resolved && !instances[dep].__resolving) {
                        resolve_module(module, dep);
                    }
                });

                // Make sure module wasn't resolved as a result of circular dep.
                if (!module.__resolved) {
                    executeModuleImpl(module);                  
                }
            };

            var _require = function (parent, number) {
                if (!instances[number] || instances[number].invalidate) {
                    create_module(number);
                }

                resolve_module(parent, number);
                return instances[number].exports;
            };

            __nollup__global__.__nollup_dynamic_require_callback = function (file, chunk_entry_module, chunk_modules) {
                chunks[file] = chunk_entry_module;
                for (var key in chunk_modules) {
                    modules[key] = chunk_modules[key];
                }
            };

            ${context.plugins.filter(p => p.nollupBundleInit).map(p => {
                return `
                    (function () {
                        ${p.nollupBundleInit()}
                    })();
                `;
            }).join('\n')}

            ${context.output.format === 'cjs'? `
                var result = _require(null, ${chunk.__entryModuleId});
                var result_keys = Object.keys(result);
                if (result_keys.length === 1 && result_keys[0] === 'default') {
                    module.exports = result.default;
                } else {
                    module.exports = result;
                }
            `: `
                return _require(null, ${chunk.__entryModuleId});
            `}
        })({
                `,
                files.join(','),
                `
        }, typeof globalThis !== 'undefined'? globalThis : (
           typeof self !== 'undefined' ? self : this
        ));

        ${context.output.format === 'es'? chunk.exports.map(declaration => {
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

module.exports = { generateFile, generateChunk, generateDelta }