// @ts-check
let path = require('path');
let ConvertSourceMap = require('convert-source-map');
let NollupContext = require('./NollupContext');
const PluginContainer = require('./PluginContainer');
const RollupConfigContainer = require('./RollupConfigContainer');
let MagicString = require('magic-string').default;
let AcornParser = require('./AcornParser');


/**
 * Setting imports to empty can cause source maps to break.
 * This is because some imports could span across multiple lines when importing named exports.
 * To bypass this problem, this function will replace all text except line breaks with spaces.
 * This will preserve the lines so source maps function correctly.
 * Source maps are ideally the better way to solve this, but trying to maintain performance.
 *
 * @param {string} input
 * @param {number} start
 * @param {number} end
 * @return {string}
 */
function blanker (input, start, end) {
    return input.substring(start, end).replace(/[^\n\r]/g, ' ');
}

function normalizePathDelimiter (id) {
    return id.replace(/\\/g, '/');
}

/**
 * 
 * @param {boolean|string} synthetic 
 * @return {string}
 */
function getSyntheticExports (synthetic) {
    if (synthetic === true) {
        synthetic = 'default';
    }

    return `if (module.exports.${synthetic}) {
        for (let prop in module.exports.${synthetic}) {
            prop !== '${synthetic}' && __e__(prop, function () { return module.exports.${synthetic}[prop] });
        }
    }`
}

/** @type {MagicString} */
let activeESMOutput;

/** @type {string} */
let activeESMCode;


/**
 * @param {string} id
 * @param {NollupInternalModuleImport} i 
 * @param {NollupInternalModuleImportSpecifier} s
 * @return {string} 
 */
function getLocalSpecifier (id, i, s) {
    return i.export? 'ex_' + (s.imported === '*'? id : s.local) : s.local;
}

/**
 * 
 * @param {NollupInternalModuleImportSpecifier} s 
 * @param {string} namespace 
 * @param {string} local 
 * @return {string}
 */
function getExportFrom (s, namespace, local, exportAs) {
    if (s.imported === '*') {
        return `for(let __k__ in ${namespace}){__k__ !== "default" && (__e__(__k__, function () { return ${namespace}[__k__] }))}`
    } else {
        return `__e__("${exportAs}", function () { return ${local} })`;
    }
}



/**
 * @param {RollupRenderedChunk} chunk 
 * @param {RollupOutputOptions} outputOptions 
 * @return {string}
 */
function createExternalImports (chunk, outputOptions) {
    let output = '';
    let { format, globals } = outputOptions;

    output += chunk.imports.map(source => {
        let name = source.replace(/[\W]/g, '_');
        let specifiers = chunk.importedBindings[source];

        // Bare external import
        if (specifiers.length === 0) {
            if (format === 'es') 
                return `import '${source}';`
            if (format === 'cjs') 
                return `require('${source}');`
        }

        return specifiers.map(s => {
            let iifeName = globals[source] || name;

            if (s === '*') {
                if (format === 'es') 
                    return `import * as __nollup__external__${name}__ from '${source}';`;
                if (format === 'cjs') 
                    return `var __nollup__external__${name}__ = require('${source}');`;
                if (format === 'iife') 
                    return `var __nollup__external__${name}__ = self.${iifeName};`
            }

            if (s === 'default') {
                if (format === 'es') 
                    return `import __nollup__external__${name}__default__ from '${source}';`;
                if (format === 'cjs') 
                    return `var __nollup__external__${name}__default__ = require('${source}').hasOwnProperty('default')? require('${source}').default : require('${source}');`
                if (format === 'iife') 
                    return `var __nollup__external__${name}__default__ = self.${iifeName} && self.${iifeName}.hasOwnProperty('default')? self.${iifeName}.default : self.${iifeName};`
            }

            if (format === 'es') 
                return `import { ${s} as __nollup__external__${name}__${s}__ } from '${source}';`;
            if (format === 'cjs') 
                return `var __nollup__external__${name}__${s}__ = require('${source}').${s};`
            if (format === 'iife') 
                return `var __nollup__external__${name}__${s}__ = self.${iifeName}.${s};`
        }).join('\n');
    }).join('\n');

    return output;
}

/**
 * @param {NollupPlugin[]} plugins
 * @return {string}
 */
function callNollupModuleInit (plugins) {
    return plugins.filter(p => {
        return p.nollupModuleInit;
    }).map(p => {
        let output = p.nollupModuleInit();

        return `
            (function () {
                ${output}
            })();
        `;
    }).join('\n');
}

/**
 * @param {NollupPlugin[]} plugins 
 * @param {string} code 
 * @return {string} 
 */
function callNollupModuleWrap (plugins, code) {
    return plugins.filter(p => {
        return p.nollupModuleWrap
    }).reduce((code, p) => {
        return p.nollupModuleWrap(code)
    }, code);
}

/**
 * @param {NollupPlugin[]} plugins
 * @return {string}
 */
function callNollupBundleInit (plugins) {
    return plugins.filter(p => {
        return p.nollupBundleInit;
    }).map(p => {
        let output = p.nollupBundleInit();

        return `
            (function () {
                ${output}
            })();
        `;
    }).join('\n');
}

class NollupCodeGenerator {

    constructor (options = {}) {
        this.liveBindings = options.liveBindings || false;
    }

    /**
     * @param {string} code 
     * @param {string} filePath 
     * @param {ESTree} ast 
     */
    onESMEnter (code, filePath, ast) {
        activeESMOutput = new MagicString(code);
        activeESMCode = code;
    }

    /**
     * @param {ESTree} node 
     * @param {any} args 
     */
    onESMNodeFound (node, args) {
        if (node.type === 'ImportDeclaration' || (args && args.source)) {
            activeESMOutput.overwrite(node.start, node.end, blanker(activeESMCode, node.start, node.end));
            return;
        } 
        
        if (node.type === 'ExportDefaultDeclaration') {
            // Account for "export default function" and "export default(()=>{})"
            let offset = activeESMCode[node.start + 14] === ' '? 15 : 14;

            if (node.declaration && node.declaration.id) {
                // Using + 15 to avoid "export default (() => {})" being converted
                // to "module.exports.default = () => {})"
                activeESMOutput.overwrite(node.start, node.start + offset, '', { contentOnly: true });
                activeESMOutput.appendRight(node.declaration.end, `; __e__('default', function () { return ${node.declaration.id.name} });`);
            } else {
                activeESMOutput.overwrite(node.start, node.start + offset, `var __ex_default__ = `, { contentOnly: true });
                let end = activeESMCode[node.end - 1] === ';'? node.end - 1 : node.end;
                activeESMOutput.appendRight(end, `; __e__('default', function () { return __ex_default__ });`);
            }

            return;
        }
        
        if (node.type === 'ExportNamedDeclaration') {
            if (node.declaration) {
                // Remove 'export' keyword.
                activeESMOutput.overwrite(node.start, node.start + 7, '', { contentOnly: true });
                let specifiers = '; ' + args.map(e => `__e__('${e.exported}', function () { return ${e.local} });`).join('');
                activeESMOutput.appendRight(node.end, specifiers);
            } 

            if (!node.declaration && node.specifiers) {
                if (!node.source) {
                    // Export from statements are already blanked by the import section.
                    activeESMOutput.overwrite(node.start, node.start + 6, '__e__(', { contentOnly: true });
                    node.specifiers.forEach(spec => {
                        // { a as b, c }, need to preserve the variable incase it's from an import statement
                        // This is important for live bindings to be able to be transformed.
                        activeESMOutput.prependLeft(spec.local.start, spec.exported.name + ': function () { return ');

                        if (spec.local.start !== spec.exported.start) {
                            activeESMOutput.overwrite(spec.local.end, spec.exported.end, '', { contentOnly: true });
                        }

                        activeESMOutput.appendRight(spec.exported.end, ' }');
                    });

                    if (activeESMCode[node.end - 1] === ';') {
                        activeESMOutput.prependLeft(node.end - 1, ')');
                    } else {
                        activeESMOutput.appendRight(node.end, ');')

                    }

                }
            }

            return;
        } 
        
        if (node.type === 'ImportExpression') {
            if (!args.external) {
                if (typeof args.resolved.id === 'string' && path.isAbsolute(args.resolved.id)) {
                    // import('hello') --> require.dynamic('/hello.js');
                    activeESMOutput.overwrite(node.start, node.start + 6, 'require.dynamic', { contentOnly: true });
                    activeESMOutput.overwrite(node.source.start, node.source.end, '\'' + normalizePathDelimiter(args.resolved.id) + '\'', { contentOnly: true });
                }
            }
        } 
    }

    onESMImportLiveBinding (node, ancestors) {
        let parent = ancestors[ancestors.length - 1];
        if (parent.type === 'Property' && parent.shorthand) {
            activeESMOutput.prependLeft(node.start, node.name + ': ');
        }

        activeESMOutput.overwrite(node.start, node.end, '__i__.' + node.name, { contentOnly: true })

    }

    /**
     * @param {ESTree} node 
     * @param {string[]} found 
     */
    onESMLateInitFound (node, found) {
        let transpiled = ';' + found.map(name => `__e__('${name}', function () { return typeof ${name} !== 'undefined' && ${name} })`).join(';') + ';';
        activeESMOutput.appendRight(node.end, transpiled);
    }

    /**
     * @param {string} code 
     * @param {string} filePath 
     * @param {ESTree} ast 
     * @return {{ code: string, map: RollupSourceMap }}
     */
    onESMLeave (code, filePath, ast) {
        return {
            code: activeESMOutput.toString(),
            map: activeESMOutput.generateMap({ source: filePath })
        };
    }

   
    /**
     * @param {Object<string, NollupInternalModule>} modules 
     * @param {string} filePath
     * @param {RollupConfigContainer} config
     * @return {string} 
     */
    onGenerateModule (modules, filePath, config) {
        let { code, map, imports, exports, externalImports, dynamicImports, syntheticNamedExports, hoist } = modules[filePath];

        // Validate dependencies exist.
        imports.forEach(dep => {
            if (!modules[dep.source]) {
                throw new Error('File not found: ' + dep.source);
            }
        });

        let hoisted = '';
        if (hoist) {
            let ast = AcornParser.parse(code);
            let s = new MagicString(code);

            for (let i = 0; i < ast.body.length; i++) {
                let node = ast.body[i];

                if (!node) {
                    continue;
                }

                if (node.type === 'FunctionDeclaration') {
                    hoisted += code.substring(node.start, node.end) + ';\n';
                    // TODO: aliases might be off (export { a as b });
                    if (exports.indexOf(node.id.name) > -1) {
                        hoisted += `__e__('${node.id.name}', function () { return ${node.id.name} });`;
                    }

                    s.overwrite(node.start, node.end, blanker(code, node.start, node.end));
                } else if (node.type === 'VariableDeclaration') {
                    hoisted += 'var ' + node.declarations.map(d => d.id.name).join(', ') + ';\n';
                    if (node.kind === 'var' || node.kind === 'let') {
                        s.overwrite(node.start, node.start + 3, '   ');
                    } 

                    if (node.kind === 'const') {
                        s.overwrite(node.start, node.start + 5, '     ');
                    }
                }
            }

            code = s.toString();
        }
        
        // Turning the code into eval statements, so we need
        // to escape line breaks and quotes. Using a multiline
        // approach here so that the compiled code is still
        // readable for advanced debugging situations.
        code = code
                .replace(/\\/g, '\\\\')
                .replace(/'/g, '\\\'')
                .replace(/(\r)?\n/g, '\\n\\\n');


        // Transform the source path so that they display well in the browser debugger.
        let sourcePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');

        // Append source mapping information
        code += '\\\n';

        if (map) {
            map.sourceRoot = 'nollup:///';
            map.sources[map.sources.length - 1] = sourcePath;
            code += `${ConvertSourceMap.fromObject(map).toComment()}\\n`;
        } 
        
        code += `\\n//# sourceURL=nollup-int:///${sourcePath}`;

        let context = (
            config.moduleContext? (
                typeof config.moduleContext === 'function'? 
                    config.moduleContext(filePath) : 
                    config.moduleContext[filePath]
            ) : undefined
        ) || config.context;

        return `
            function (__c__, __r__, __d__, __e__) {
                ${this.liveBindings? 'var __i__ = {};' : ''}

                // TODO: If hoisted function depends on import, this with scope will fail
                ${this.liveBindings === 'with-scope'? 'with (__i__) {' : ''}
                ${imports.map((i, index) => {
                    let id = `_i${index}`;
                    return `var ${id}; ${this.liveBindings? '' : i.specifiers.map(s => 'var ' + getLocalSpecifier(id, i, s)).join(';')};`
                }).join('; ')}

                ${externalImports.map(i => {
                    let id = `__nollup__external__${i.source.replace(/[\W]/g, '_')}__`

                    return i.specifiers.map(s => {
                        let output = '';

                        let local = getLocalSpecifier(id, i, s);

                        if (s.imported === '*')
                            output += `var ${local} = ${id};`;
                        else
                            output += `var ${local} = ${id}${s.imported}__;`;

                        if (i.export)
                            output += getExportFrom(s, id, local, local.slice(3));

                        return output;
                    }).join(';');
                }).join('; ')}

                ${hoisted};

                __d__(function () {
                    ${imports.map((i, index) => {
                        let id = `_i${index}`; 

                        return i.specifiers.map(s => {
                            let local, output, exportAs;
                            
                            if (this.liveBindings) {
                                local = '__i__.' + s.local;
                                if (!i.export || (i.export && s.imported !== '*')) {
                                    output = `!__i__.hasOwnProperty("${s.local}") && Object.defineProperty(__i__, "${s.local}", { get: function () { return ${id}()${s.imported === '*'? '' : `.${s.imported}`}}})`;
                                }
                                exportAs = s.local;
                            } else {
                                local = getLocalSpecifier(id, i, s);
                                output = `${local} = ${id}()${s.imported === '*'? '' : `.${s.imported}`}`;
                                exportAs = local.slice(3);
                            }
                            
                            if (i.export)
                                output += ';' + getExportFrom(s, id + '()', local, exportAs) + ';';

                            return output;
                        }).join(';');
                    }).join('; ')}
                }, function (require, module, __nollup__global__) {
                    
                    "use strict";
                    eval('${code}');
                    ${syntheticNamedExports? getSyntheticExports(syntheticNamedExports) : ''} 
                }.bind(${context}));

                ${this.liveBindings === 'with-scope'? '}' : ''}

                ${imports.map((i, index) => {
                    let id = `_i${index}`;
                    return `${id} = __c__(${modules[i.source].index}) && function () { return __r__(${modules[i.source].index}) }`;
                }).join('; ')}
            }   
        `.trim();
    }

    
    /**
     * @param {NollupInternalModule} module 
     * @return {string}
     */
    onGenerateModuleChange (module) {
        return `
            (function () {
                return ${module.code}
            })();
        `
    }

    /**
     * @param {NollupInternalModule} file 
     * @param {RollupOutputFile[]} bundle
     * @param {Object<string, NollupInternalModule>} modules
     * @return {string} 
     */
    onGenerateModulePreChunk (file, bundle, modules) {
        if (file.dynamicImports.length > 0) {
            return file.code.replace(/require\.dynamic\(\\\'(.*?)\\\'\)/g, (match, inner) => {
                let foundOutputChunk = bundle.find(b => {
                    return normalizePathDelimiter(/** @type {RollupOutputChunk} */ (b).facadeModuleId) === inner
                });

                let fileName = foundOutputChunk? foundOutputChunk.fileName : '';
                return 'require.dynamic(\\\'' + fileName + '\\\', ' + modules[path.normalize(inner)].index + ')';
            });
        }
        
        return file.code;
    }

    /**
     * @param {Object<string, NollupOutputModule>} modules 
     * @param {RollupOutputChunk} chunk 
     * @param {RollupOutputOptions} outputOptions 
     * @param {RollupConfigContainer} config 
     * @return {string}
     */
    onGenerateChunk (modules, chunk, outputOptions, config) {
        let files = Object.keys(chunk.modules).map(filePath => {
            let file = modules[filePath];
            return file.index + ':' + file.code;
        });  

        let entryIndex = modules[chunk.facadeModuleId].index;
        let { format } = outputOptions;
        let plugins = config.plugins || [];

        if (chunk.isDynamicEntry) {
            return `
                ${createExternalImports(chunk, outputOptions)}
                (function (global) {
                    global.__nollup_dynamic_require_callback("${chunk.fileName}", ${entryIndex}, {${files}});
                })(typeof globalThis !== 'undefined'? globalThis : (
                typeof self !== 'undefined' ? self : this
                ));
            `;
        } else {
            return [
                    createExternalImports(chunk, outputOptions),
            ` ${(chunk.exports.length > 0 && format === 'es')? 'var __nollup_entry_exports = ' : ''}
                (function (modules, __nollup__global__) {

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

                    ${callNollupModuleInit(/** @type {NollupPlugin[]} */(plugins))}

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
                    }, function (arg1, arg2) {
                        var bindings = {};
                        if (typeof arg1 === 'object') {
                            bindings = arg1;
                        } else {
                            bindings[arg1] = arg2;
                        }

                        for (var prop in bindings) {
                            ${this.liveBindings? `
                            if (!module.exports.hasOwnProperty(prop) || prop === 'default') {
                                Object.defineProperty(module.exports, prop, {
                                    get: bindings[prop],
                                    enumerable: true,
                                    configurable: true
                                });
                            ` : `
                            if (module.exports[prop] !== bindings[prop]()) {
                                module.exports[prop] = bindings[prop]();
                            `}

                                Object.keys(instances).forEach(key => {
                                    if (instances[key].dependencies.indexOf(number) > -1) {
                                        instances[key].__binder();
                                    }
                                })
                            }
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
                        ${format === 'cjs'? `
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

                    ${format === 'cjs'? `
                        for (var prop in require) {
                            localRequire[prop] = require[prop];
                        }
                    ` : ''}
                    
                    var executeModuleImpl = function (module) {
                        ${callNollupModuleWrap(/** @type {NollupPlugin[]} */ (plugins), `
                            module.__resolved = true;
                            module.__impl(localRequire, module, __nollup__global__);
                        `)}
                    };

                    localRequire.dynamic = function (file, entryIndex) {
                        return new Promise(function (resolve) {
                            var relative_file = getRelativePath('${path.dirname(chunk.fileName)}', file);

                            var cb = () => {
                                let id = chunks[file];
                                if (instances[number].dynamicDependencies.indexOf(id) === -1) {
                                    instances[number].dynamicDependencies.push(id);
                                }

                                resolve(_require(module, id));
                            };

                            // If the chunk already statically included this module, use that instead.
                            if (instances[entryIndex]) {
                                chunks[file] = entryIndex;
                                cb();
                                return;                                
                            }

                            if (chunks[file]) {
                                cb();
                            } else {
                                ${format === 'es'? (`
                                    ${this.liveBindings === 'with-scope'? `
                                        return fetch(file).then(res => {
                                            return res.text();
                                        }).then(res => {
                                            eval(res);
                                            cb();
                                        });
                                    ` : `
                                    return import(relative_file).then(cb);
                                    `}
                                    
                                `) : ''}
                                ${format === 'cjs'? (`
                                    return Promise.resolve(require(relative_file)).then(cb);
                                `) : ''}
                            }
                        });
                    };

                    module.dependencies.forEach((dep) => {
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

                ${callNollupBundleInit(/** @type {NollupPlugin[]} */ (plugins))}

                ${format === 'cjs'? `
                    var result = _require(null, ${entryIndex});
                    var result_keys = Object.keys(result);
                    if (result_keys.length === 1 && result_keys[0] === 'default') {
                        module.exports = result.default;
                    } else {
                        module.exports = result;
                    }
                `: `
                    return _require(null, ${entryIndex});
                `}
            })({
                    `,
                    files.join(','),
                    `
            }, typeof globalThis !== 'undefined'? globalThis : (
            typeof self !== 'undefined' ? self : this
            ));

            ${format === 'es'? chunk.exports.map(declaration => {
                if (declaration === 'default') {
                    return 'export default __nollup_entry_exports.default;' 
                } else {
                    return `export var ${declaration} = __nollup_entry_exports.${declaration};`
                }
            }).join('\n') : ''}
                    `,
            ].join('\n');
        }
    }
}

module.exports = NollupCodeGenerator;