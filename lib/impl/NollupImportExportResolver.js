// @ts-check

let PluginContainer = require('./PluginContainer');
let CodeGenerator = require('./NollupCodeGenerator');
let AcornParser = require('./AcornParser');
let LiveBindingResolver = require('./NollupLiveBindingsResolver');
let path = require('path');
let { findChildNodes } = require('./utils');

/**
 * @param {PluginContainer} container 
 * @param {string} input 
 * @param {Object} output 
 * @param {ESTree} node 
 * @param {CodeGenerator} generator 
 */
function resolveDefaultExport (container, input, output, node, generator) {
    generator.onESMNodeFound(node, undefined);
    output.exports.push({
        local: '',
        exported: 'default'
    });
}

/**
 * @param {PluginContainer} container 
 * @param {string} input 
 * @param {Object} output 
 * @param {ESTree} node 
 * @param {string} currentpath 
 * @param {CodeGenerator} generator 
 * @param {Boolean|String} liveBindings
 */
async function resolveNamedExport (container, input, output, node, currentpath, generator, liveBindings) {
    let exports = [];
    
    // export function / class / let...
    if (node.declaration) {
        let dec = node.declaration;

        // Singular export declaration
        if (dec.id) {
            exports.push({ 
                local: dec.id.name, 
                exported: dec.id.name 
            });
        } 

        // Multiple export declaration
        if (dec.declarations) {
            dec.declarations.forEach(node => {
                if (node.id.type === 'ObjectPattern') {
                    node.id.properties.forEach(prop => {                        
                        exports.push({ 
                            local: prop.value.name, 
                            exported: prop.value.name 
                        });
                    });
                } else {
                    if (!liveBindings &&!node.init) {
                        output.exportLiveBindings.push(node.id.name);
                        return ``;
                    }

                    exports.push({ 
                        local: node.id.name, 
                        exported: node.id.name 
                    });
                }
            });
        }
    }

    // export { specifier, specifier }
    if (node.specifiers.length > 0) {
        let dep;
        // export { imported } from './file.js';
        if (node.source) {
            dep = await resolveImport(container, input, output, node, currentpath, generator);
            dep.export = true;
        }

        node.specifiers.forEach(spec => {
            /** @type {{local: string, exported: string}} */
            let _export;

            if (spec.type === 'ExportSpecifier') {
                if (node.source) {
                    _export = {
                        local: spec.exported.name,
                        exported: spec.exported.name
                    };
                } else {
                    _export = {
                        local: spec.local.name,
                        exported: spec.exported.name
                    }
                }

                exports.push(_export);
            }
        });
    }

    if (!node.source) {
        generator.onESMNodeFound(node, exports);
    }

    exports.forEach(e => output.exports.push(e));
    
}

/**
 * @param {PluginContainer} container 
 * @param {string} input 
 * @param {Object} output 
 * @param {ESTree} node 
 * @param {string} currentpath 
 * @param {CodeGenerator} generator 
 */
async function resolveAllExport (container, input, output, node, currentpath, generator) {
    // export * from './file';
    let dep = await resolveImport(container, input, output, node, currentpath, generator);
    if (!dep) {
        return;
    }

    dep.export = true;
    dep.specifiers.push({
        imported: '*'
    });
}


/**
 * @param {PluginContainer} container 
 * @param {string} input 
 * @param {Object} output 
 * @param {ESTree} node 
 * @param {string} currentpath 
 * @param {CodeGenerator} generator 
 */
function resolveMetaProperty (container, input, output, node, currentpath, generator) {
    let name = node.type === 'MetaProperty'? null : node.property && node.property.name;
    output.metaProperties.push(name);  
    generator.onESMNodeFound(node, name);
}

/**
 * @param {PluginContainer} container 
 * @param {string} input 
 * @param {Object} output 
 * @param {ESTree} node 
 * @param {string} currentpath 
 * @param {CodeGenerator} generator 
 */
async function resolveDynamicImport (container, input, output, node, currentpath, generator) {    
    let arg = node.source;
    let value;

    if (arg.type === 'Literal') {
        value = arg.value;
    }

    if (arg.type === 'TemplateLiteral') {
        if (arg.expressions.length === 0 && arg.quasis[0] && arg.quasis[0].value.raw) {
            value = arg.quasis[0].value.raw;
        }
    }

    let resolved = await container.hooks.resolveDynamicImport(value || arg, currentpath);
    let external = false;

    if ((typeof resolved === 'object' && resolved.external)) {
        output.externalDynamicImports.push(resolved.id || value);
        external = true;
    }

    if (typeof resolved.id === 'string' && path.isAbsolute(resolved.id)) {
        output.dynamicImports.push(resolved.id);
    }

    generator.onESMNodeFound(node, { resolved, external });
}


/**
 * @param {PluginContainer} container 
 * @param {string} input 
 * @param {Object} output 
 * @param {ESTree} node 
 * @param {string} currentpath 
 * @param {CodeGenerator} generator 
 */
async function resolveImport (container, input, output, node, currentpath, generator) {
    let resolved = await container.hooks.resolveId(node.source.value, currentpath);

    let dependency = {
        source: undefined,
        specifiers: []
    };

    // TODO: Is this still needed? Shouldn't resolved have an external check?
    if (resolved.external) {
        dependency.external = true;
    }

    if (resolved.syntheticNamedExports) {
        dependency.syntheticNamedExports = resolved.syntheticNamedExports;
    }

    if (dependency.external) {
        dependency.source = (resolved && resolved.external && resolved.id) || node.source.value;
        output.externalImports.push(dependency);
    } else {
        dependency.source = resolved.id;
        output.imports.push(dependency);
    }

    if (node.specifiers && node.specifiers.length > 0) {
        node.specifiers.forEach(specifier => {
            if (specifier.type === 'ImportDefaultSpecifier') {
                dependency.specifiers.push({
                    local: specifier.local.name,
                    imported: 'default'
                });
            }

            if (specifier.type === 'ImportSpecifier') {
                dependency.specifiers.push({
                    local: specifier.local.name,
                    imported: specifier.imported.name
                });
            }

            if (specifier.type === 'ImportNamespaceSpecifier') {
                dependency.specifiers.push({
                    local: specifier.local.name,
                    imported: '*'
                });
            }

            if (specifier.type === 'ExportSpecifier') {
                dependency.specifiers.push({
                    local: specifier.exported.name,
                    imported: specifier.local.name
                });
            }
        });
    }

    generator.onESMNodeFound(node, dependency);

    return dependency;
}

/**
 * @param {PluginContainer} container 
 * @param {string} input 
 * @param {Object} output 
 * @param {Array<ESTree>} nodes 
 * @param {string} currentpath 
 * @param {CodeGenerator} generator 
 * @param {String|Boolean} liveBindings
 */
async function walk (container, input, output, nodes, currentpath, generator, liveBindings) {
    
    for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];

        if (!node) {
            // There's a possibility of null nodes
            continue;
        } else if (node.type === 'ImportDeclaration') {
            await resolveImport(container, input, output, node, currentpath, generator);
        } else if (node.type === 'ExportDefaultDeclaration') {
            resolveDefaultExport(container, input, output, node, generator);
        } else if (node.type === 'ExportNamedDeclaration') {
            await resolveNamedExport(container, input, output, node, currentpath, generator, liveBindings);
        } else if (node.type === 'ExportAllDeclaration') {
            await resolveAllExport(container, input, output, node, currentpath, generator);
        } else if (node.type === 'ImportExpression') {
            await resolveDynamicImport(container, input, output, node, currentpath, generator);
        } else if (node.type === 'MetaProperty' || (node.object && node.object.type === 'MetaProperty')) {
            resolveMetaProperty(container, input, output, node, currentpath, generator);
            continue; // can't be any more matches in this one
        }

        await walk(container, input, output, findChildNodes(node), currentpath, generator, liveBindings);
    }
}

/**
 * @param {PluginContainer} container 
 * @param {string} input 
 * @param {Object} output 
 * @param {Array<ESTree>} nodes 
 * @param {Array<string>} found 
 * @param {number} level 
 * @param {CodeGenerator} generator 
 */
function walkSimpleLiveBindings (container, input, output, nodes, found, level, generator) {
    for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];
        let locals = [];

        if (!node) {
            continue;
        } 

        if (
            node.type === 'AssignmentExpression' && 
            node.left.type === 'Identifier' &&
            output.exportLiveBindings.indexOf(node.left.name) > -1
        ) {
            if (found.indexOf(node.left.name) === -1) {
                found.push(node.left.name);
            }
        }

        walkSimpleLiveBindings(container, input, output, findChildNodes(node), found, level + 1, generator);

        if (level === 0 && found.length > 0) {
            generator.onESMLateInitFound(node, found);
            found = [];
        }
    }
}

/**
 * @param {PluginContainer} container 
 * @param {string} input 
 * @param {string} currentpath 
 * @param {CodeGenerator} generator 
 * @param {Boolean|String} liveBindings
 * @return {Promise<Object>}
 */
async function ImportExportResolver (container, input, currentpath, generator, liveBindings) {
    let output = {
        imports: [],
        externalImports: [],
        exports: [],
        dynamicImports: [],
        externalDynamicImports: [],
        metaProperties: [],
        dynamicMappings: {},
        exportLiveBindings: []
    };

    let ast = AcornParser.parse(input);
    generator.onESMEnter(input, currentpath, ast);


    await walk(container, input, output, ast.body, currentpath, generator, liveBindings);

    if (!liveBindings && output.exportLiveBindings.length > 0) {
        walkSimpleLiveBindings(container, input, output, ast.body, [], 0, generator);
    }

    if (liveBindings === 'reference') {
        LiveBindingResolver(output.imports, ast.body, generator)
    }

    let { code, map } = generator.onESMLeave(input, currentpath, ast);
    output.code = code;
    output.map = map;

    return output;
}

module.exports = ImportExportResolver;