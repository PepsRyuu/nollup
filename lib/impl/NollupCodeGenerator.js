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

function escapeCode (code) {
    // Turning the code into eval statements, so we need
    // to escape line breaks and quotes. Using a multiline
    // approach here so that the compiled code is still
    // readable for advanced debugging situations.
    return code
            .replace(/\\/g, '\\\\')
            .replace(/'/g, '\\\'')
            .replace(/(\r)?\n/g, '\\n\\\n');
}

function getVariableNames(node) {
    if (node.type === 'ObjectPattern') {
        return node.properties.flatMap(p => {
            if (p.value.type === 'Identifier') {
                return p.value.name;
            } else {
                return getVariableNames(p.value)
            }
        });
    }

    if (node.type === 'ArrayPattern') {
        return node.elements.filter(Boolean).flatMap(e => {
            if (e.type === 'Identifier') {
                return e.name;
            } else {
                return getVariableNames(e);
            }
        })
    }

    return node.name;
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

    return `if (__m__.exports.${synthetic}) {
        for (let prop in __m__.exports.${synthetic}) {
            prop !== '${synthetic}' && !__m__.exports.hasOwnProperty(prop) && __e__(prop, function () { return __m__.exports.${synthetic}[prop] });
        }
    }`
}

let activeModules = {};

/**
 * @param {string} namespace 
 * @return {string}
 */
function getExportAllFrom (namespace) {
    return `for(let __k__ in ${namespace}){__k__ !== "default" && (__e__(__k__, function () { return ${namespace}[__k__] }))};`
}

/**
 * @param {NollupInternalModuleImport} externalImport 
 * @return {string}
 */
function getIIFEName(externalImport) {
    let hasDefaultSpec = externalImport.specifiers.find(s => s.imported === 'default' && s.local !== 'default');

    if (hasDefaultSpec && hasDefaultSpec.local) {
        return hasDefaultSpec.local;
    }

    return externalImport.source.replace(/\-([\w])/g, (m) => m[1].toUpperCase()).replace(/[^a-zA-Z0-9$_]/g, '_');
}

/**
 * @param {RollupRenderedChunk} chunk 
 * @param {RollupOutputOptions} outputOptions 
 * @param {Array<NollupInternalModuleImport>} externalImports
 * @return {string}
 */
function createExternalImports (chunk, outputOptions, externalImports) {
    let output = '';
    let { format, globals } = outputOptions;

    output += externalImports.map(ei => {
        let name = ei.source.replace(/[\W]/g, '_');
        let { source, specifiers } = ei;

        // Bare external import
        if (specifiers.length === 0) {
            if (format === 'es') 
                return `import '${source}';`
            if (format === 'cjs' || format === 'amd') 
                return `require('${source}');`
        }


        let iifeName = format === 'iife'? (globals[source] || getIIFEName(ei)) : '';

        return specifiers.map(s => {

            if (s.imported === '*') {
                if (format === 'es') 
                    return `import * as __nollup__external__${name}__ from '${source}';`;
                if (format === 'cjs' || format === 'amd') 
                    return `var __nollup__external__${name}__ = require('${source}');`;
                if (format === 'iife') 
                    return `var __nollup__external__${name}__ = self.${iifeName};`
            }

            if (s.imported === 'default') {
                if (format === 'es') 
                    return `import __nollup__external__${name}__default__ from '${source}';`;
                if (format === 'cjs' || format === 'amd') 
                    return `var __nollup__external__${name}__default__ = require('${source}').hasOwnProperty('default')? require('${source}').default : require('${source}');`
                if (format === 'iife') 
                    return `var __nollup__external__${name}__default__ = self.${iifeName} && self.${iifeName}.hasOwnProperty('default')? self.${iifeName}.default : self.${iifeName};`
            }

            if (format === 'es') 
                return `import { ${s.imported} as __nollup__external__${name}__${s.imported}__ } from '${source}';`;
            if (format === 'cjs' || format === 'amd') 
                return `var __nollup__external__${name}__${s.imported}__ = require('${source}').${s.imported};`
            if (format === 'iife') 
                return `var __nollup__external__${name}__${s.imported}__ = self.${iifeName}.${s.imported};`
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

    constructor (context) {
        this.context = context;
    }

    /**
     * @param {string} code 
     * @param {string} filePath 
     * @param {ESTree} ast 
     */
    onESMEnter (code, filePath, ast) {
        activeModules[filePath] = {
            output: new MagicString(code),
            code: code
        };
    }

    /**
     * @param {string} filePath
     * @param {ESTree} node 
     * @param {any} args 
     */
    onESMNodeFound (filePath, node, args) {
        let { output, code } = activeModules[filePath];
        if (node.type === 'ImportDeclaration' || (args && args.source)) {
            output.overwrite(node.start, node.end, blanker(code, node.start, node.end));
            return;
        } 
        
        if (node.type === 'ExportDefaultDeclaration') {
            // Account for "export default function" and "export default(()=>{})"
            let offset = code[node.start + 14] === ' '? 15 : 14;

            if (node.declaration && node.declaration.id) {
                // Using + 15 to avoid "export default (() => {})" being converted
                // to "module.exports.default = () => {})"
                output.overwrite(node.start, node.start + offset, '', { contentOnly: true });
                output.appendRight(node.declaration.end, `; __e__('default', function () { return ${node.declaration.id.name} });`);
            } else {
                output.overwrite(node.start, node.start + offset, `var __ex_default__ = `, { contentOnly: true });
                let end = code[node.end - 1] === ';'? node.end - 1 : node.end;
                output.appendRight(end, `; __e__('default', function () { return __ex_default__ });`);
            }

            return;
        }
        
        if (node.type === 'ExportNamedDeclaration') {
            if (node.declaration) {
                // Remove 'export' keyword.
                output.overwrite(node.start, node.start + 7, '', { contentOnly: true });
                let specifiers = '; ' + args.map(e => `__e__('${e.exported}', function () { return ${e.local} });`).join('');
                output.appendRight(node.end, specifiers);
            } 

            if (!node.declaration && node.specifiers) {
                if (!node.source) {
                    // Export from statements are already blanked by the import section.
                    output.overwrite(node.start, node.start + 6, '__e__(', { contentOnly: true });
                    node.specifiers.forEach(spec => {
                        // { a as b, c }, need to preserve the variable incase it's from an import statement
                        // This is important for live bindings to be able to be transformed.
                        output.prependLeft(spec.local.start, spec.exported.name + ': function () { return ');

                        if (spec.local.start !== spec.exported.start) {
                            output.overwrite(spec.local.end, spec.exported.end, '', { contentOnly: true });
                        }

                        output.appendRight(spec.exported.end, ' }');
                    });

                    if (code[node.end - 1] === ';') {
                        output.prependLeft(node.end - 1, ')');
                    } else {
                        output.appendRight(node.end, ');')

                    }

                }
            }

            return;
        } 
        
        if (node.type === 'ImportExpression') {
            if (!args.external) {
                if (typeof args.resolved.id === 'string' && path.isAbsolute(args.resolved.id.split(':').pop())) {
                    // import('hello') --> require.dynamic('/hello.js');
                    output.overwrite(node.start, node.start + 6, 'require.dynamic', { contentOnly: true });
                    output.overwrite(node.source.start, node.source.end, '\'' + normalizePathDelimiter(args.resolved.id) + '\'', { contentOnly: true });
                }
            }
        } 
    }

    onESMImportLiveBinding (filePath, node, ancestors) {
        let { output, code } = activeModules[filePath];
        let parent = ancestors[ancestors.length - 1];
        if (parent.type === 'Property' && parent.shorthand) {
            output.prependLeft(node.start, node.name + ': ');
        }

        output.overwrite(node.start, node.end, '__i__.' + node.name, { contentOnly: true })

    }

    /**
     * @param {ESTree} node 
     * @param {string[]} found 
     */
    onESMLateInitFound (filePath, node, found) {
        let { output, code } = activeModules[filePath];
        let transpiled = ';' + found.map(name => `__e__('${name}', function () { return typeof ${name} !== 'undefined' && ${name} })`).join(';') + ';';
        output.appendRight(node.end, transpiled);
    }

    /**
     * @param {string} code 
     * @param {string} filePath 
     * @param {ESTree} ast 
     * @return {{ code: string, map: RollupSourceMap }}
     */
    onESMLeave (code, filePath, ast) {
        let { output } = activeModules[filePath];

        let payload = {
            code: output.toString(),
            map: output.generateMap({ source: filePath })
        };

        delete activeModules[filePath];

        return payload;
    }

   
    /**
     * @param {Object<string, NollupInternalModule>} modules 
     * @param {string} filePath
     * @param {RollupConfigContainer} config
     * @return {string} 
     */
    onGenerateModule (modules, filePath, config) {
        let { esmTransformedCode: code, map, imports, exports, externalImports, dynamicImports, syntheticNamedExports, hoist } = modules[filePath];

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
                    let export_match = exports.find(e => e.local === node.id.name)
                    if (export_match) {
                        hoisted += `__e__('${export_match.exported}', function () { return ${export_match.local} });`;
                    }

                    s.overwrite(node.start, node.end, blanker(code, node.start, node.end));
                } else if (node.type === 'ClassDeclaration') {
                    hoisted += 'var ' + node.id.name + ';\n';
                    s.prependLeft(node.start, node.id.name + ' = ');
                } else if (node.type === 'VariableDeclaration') {
                    hoisted += 'var ' + node.declarations.flatMap(d => getVariableNames(d.id)).join(', ') + ';\n';
                    if (node.kind === 'var' || node.kind === 'let') {
                        s.overwrite(node.start, node.start + 3, ' ;(');
                    } 

                    if (node.kind === 'const') {
                        s.overwrite(node.start, node.start + 5, '   ;(');
                    }

                    if (code[node.end - 1] === ';') {
                        s.appendRight(node.end - 1, ')');
                    } else {
                        s.appendRight(node.end, ');');
                    }

                }
            }
            
            code = s.toString();
        }

        code = escapeCode(code);

        // Transform the source path so that they display well in the browser debugger.
        let sourcePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');

        // Append source mapping information
        code += '\\\n';

        if (map) {
            map.sourceRoot = 'nollup:///';
            map.sources[map.sources.length - 1] = sourcePath;
            code += `\\n${ConvertSourceMap.fromObject(map).toComment()}\\n`;
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
            function (__c__, __r__, __d__, __e__, require, module, __m__, __nollup__global__) {
                ${this.context.liveBindings? 'var __i__ = {};' : ''}
                ${this.context.liveBindings === 'with-scope'? 'with (__i__) {' : ''}
                
                ${imports.map((i, index) => {
                    let namespace = `_i${index}`;
                    return `var ${namespace}; ${this.context.liveBindings? '' : (!i.export? i.specifiers.map(s => 'var ' + s.local).join(';') : '')};`
                }).join('; ')}

                ${externalImports.map(i => {
                    let namespace = `__nollup__external__${i.source.replace(/[\W]/g, '_')}__`

                    return i.specifiers.map(s => {
                        let output = '';

                        if (i.export) {
                            if (s.imported === '*') {
                                return getExportAllFrom(namespace);
                            }
                            
                            return `__e__("${s.local}", function () { return ${namespace}${s.imported}__ });`;
                        }

                        if (s.imported === '*')
                            output += `var ${s.local} = ${namespace};`;
                        else
                            output += `var ${s.local} = ${namespace}${s.imported}__;`;

                        return output;
                    }).join(';');
                }).join('; ')}

                ${hoisted? hoisted : ''};

                __d__(function () {
                    ${imports.map((i, index) => {
                        let namespace = `_i${index}()`; 

                        return i.specifiers.map(s => {
                            let output = '';

                            if (!i.export) {
                                let value = `${namespace}${s.imported === '*'? '' : `.${s.imported}`}`;
                                if (this.context.liveBindings) {
                                    output = `!__i__.hasOwnProperty("${s.local}") && Object.defineProperty(__i__, "${s.local}", { get: function () { return ${value}}});`;
                                } else {
                                    output = `${s.local} = ${value};`;
                                }
                            }
                            
                            if (i.export) {
                                if (s.imported === '*') {
                                    output += getExportAllFrom(namespace);
                                } else {
                                    output += `__e__("${s.local}", function () { return ${namespace}.${s.imported} });`;
                                }
                            }

                            let import_exported = exports.find(e => e.local === s.local);
                            if (!i.export && import_exported) {
                                let local = this.context.liveBindings? `__i__["${import_exported.local}"]` : import_exported.local;
                                output += `__e__("${import_exported.exported}", function () { return ${local} });`;
                            }

                            return output;
                        }).join(';');
                    }).join('; ')}
                }, function () {
                    "use strict";
                    eval('${code}');
                    ${syntheticNamedExports? getSyntheticExports(syntheticNamedExports) : ''} 
                }.bind(${context}));

                ${this.context.liveBindings === 'with-scope'? '}' : ''}
                ${imports.map((i, index) => {
                    let id = `_i${index}`;
                    return `${id} = __c__(${modules[i.source].index}) && function () { return __r__(${modules[i.source].index}) }`;
                }).join('; ')}
            }   
        `.trim();
    }

    
    /**
     * @param {NollupOutputModule} module 
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
            return file.generatedCode.replace(/require\.dynamic\((\\)?\'(.*?)(\\)?\'\)/g, (match, escapeLeft, inner, escapeRight) => {
                let foundOutputChunk = bundle.find(b => {
                    // Look for chunks only, not assets
                    let facadeModuleId = /** @type {RollupOutputChunk} */ (b).facadeModuleId;
                    if (facadeModuleId) {
                        return normalizePathDelimiter(facadeModuleId) === inner
                    }
                });

                let fileName = foundOutputChunk? foundOutputChunk.fileName : '';
                return 'require.dynamic(' + (escapeLeft? '\\' : '') + '\'' + fileName + (escapeRight? '\\' : '') +'\', ' + modules[path.normalize(inner)].index + ')';
            });
        }
        
        return file.generatedCode;
    }

    /**
     * @param {Object<string, NollupOutputModule>} modules 
     * @param {RollupOutputChunk} chunk 
     * @param {RollupOutputOptions} outputOptions 
     * @param {RollupConfigContainer} config 
     * @param {Array<NollupInternalModuleImport>} externalImports
     * @return {string}
     */
    onGenerateChunk (modules, chunk, outputOptions, config, externalImports) {
        let files = Object.keys(chunk.modules).map(filePath => {
            let file = modules[filePath];
            return file.index + ':' + file.code;
        });  

        let entryIndex = modules[chunk.facadeModuleId].index;
        let { format } = outputOptions;
        let plugins = config.plugins || [];

        if (chunk.isDynamicEntry) {
            return `
                ${format === 'amd'? 'define(function (require, exports) {' : ''}
                ${createExternalImports(chunk, outputOptions, externalImports)}
                (function (global) {
                    global.__nollup_dynamic_require_callback("${chunk.fileName}", ${entryIndex}, {${files}});
                })(typeof globalThis !== 'undefined'? globalThis : (
                typeof self !== 'undefined' ? self : this
                ));
                ${format === 'amd'? '});' : ''}
            `;
        } else {
            return [
                format === 'amd'? 'define(function (require, exports) {' : '',
                createExternalImports(chunk, outputOptions, externalImports),
            ` ${(chunk.exports.length > 0 && (format === 'es' || format === 'amd'))? 'var __nollup_entry_exports = ' : ''}
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
                if (!__nollup__global__.__nollup__chunks__) __nollup__global__.__nollup__chunks__ = {};
                var chunks = __nollup__global__.__nollup__chunks__;

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
                    
                    localRequire.dynamic = function (file, entryIndex) {
                        return new Promise(function (resolve) {
                            var relative_file = getRelativePath('${path.dirname(chunk.fileName)}', file);

                            var cb = () => {
                                // Each main overrides the dynamic callback so they all have different chunk references
                                let chunk = chunks[file];
                                let id = chunk.entry;

                                for (var key in chunk.modules) {
                                    modules[key] = chunk.modules[key];
                                }
                                if (instances[number].dynamicDependencies.indexOf(id) === -1) {
                                    instances[number].dynamicDependencies.push(id);
                                }

                                resolve(_require(module, id));
                            };

                            // If the chunk already statically included this module, use that instead.
                            if (instances[entryIndex]) {
                                chunks[file] = { entry: entryIndex };
                                cb();
                                return;                                
                            }

                            if (chunks[file]) {
                                cb();
                            } else {
                                ${format === 'es'? (`
                                    ${this.context.liveBindings === 'with-scope'? `
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
                                ${format === 'amd'? (`
                                    return new Promise(function (resolve) { require([relative_file], resolve)}).then(cb);
                                `) : ''}
                            }
                        });
                    };


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
                            ${this.context.liveBindings? `
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
                    }, localRequire, module, module, __nollup__global__);

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

                    var executeModuleImpl = function (module) {
                        ${callNollupModuleWrap(/** @type {NollupPlugin[]} */ (plugins), `
                            module.__resolved = true;
                            module.__impl();
                        `)}
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

                if (!__nollup__global__.__nollup_dynamic_require_callback) {
                    __nollup__global__.__nollup_dynamic_require_callback = function (file, chunk_entry_module, chunk_modules) {
                        chunks[file] = { entry: chunk_entry_module, modules: chunk_modules };
                    };
                }

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

            ${format === 'amd'? (chunk.exports.length === 1 && chunk.exports[0] === 'default'? 'return __nollup_entry_exports.default;' : (
                chunk.exports.map(declaration => {
                    if (declaration === 'default') {
                        return 'exports["default"] = __nollup_entry_exports.default;'
                    } else {
                        return `exports.${declaration} = __nollup_entry_exports.${declaration};`
                    }
                }).join('\n') + '\nObject.defineProperty(exports, "__esModule", { value: true });'
            )) + '\n});' : ''}

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