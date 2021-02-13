// @ts-check

let PluginContainer = require('./PluginContainer');
let CodeGenerator = require('./NollupCodeGenerator');
let AcornParser = require('./AcornParser');
let path = require('path');

/**
 * @param {PluginContainer} container 
 * @param {string} input 
 * @param {Object} output 
 * @param {ESTree} node 
 * @param {function} onNodeFound 
 */
function resolveDefaultExport (container, input, output, node, onNodeFound) {
    onNodeFound(node);
    output.exports.push('default');
}

/**
 * @param {PluginContainer} container 
 * @param {string} input 
 * @param {Object} output 
 * @param {ESTree} node 
 * @param {string} currentpath 
 * @param {function} onNodeFound 
 */
async function resolveNamedExport (container, input, output, node, currentpath, onNodeFound) {
    let exports = [];
    
    // export function / class / let...
    if (node.declaration) {
        let dec = node.declaration;

        // Singular export declaration
        if (dec.id) {
            output.exports.push(dec.id.name);
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
                        output.exports.push(prop.value.name);
                        exports.push({
                            local: prop.value.name,
                            exported: prop.value.name
                        });
                    });
                } else {
                    output.exports.push(node.id.name);

                    if (!node.init) {
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
            dep = await resolveImport(container, input, output, node, currentpath, onNodeFound);
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
                output.exports.push(spec.exported.name);

                exports.push(_export);
            }
        });
    }

    if (!node.source) {
        onNodeFound(node, exports);
    }
    
}

/**
 * @param {PluginContainer} container 
 * @param {string} input 
 * @param {Object} output 
 * @param {ESTree} node 
 * @param {string} currentpath 
 * @param {Function} onNodeFound 
 */
async function resolveAllExport (container, input, output, node, currentpath, onNodeFound) {
    // export * from './file';
    let dep = await resolveImport(container, input, output, node, currentpath, onNodeFound);
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
 * @param {Function} onNodeFound 
 */
function resolveMetaProperty (container, input, output, node, currentpath, onNodeFound) {
    let name = node.type === 'MetaProperty'? null : node.property && node.property.name;
    output.metaProperties.push(name);  
    onNodeFound(node, name);
}

/**
 * @param {PluginContainer} container 
 * @param {string} input 
 * @param {Object} output 
 * @param {ESTree} node 
 * @param {string} currentpath 
 * @param {Function} onNodeFound 
 */
async function resolveDynamicImport (container, input, output, node, currentpath, onNodeFound) {    
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

    if (resolved === false || (typeof resolved === 'object' && resolved.external)) {
        output.externalDynamicImports.push(resolved.id || value);
        external = true;
    }

    if (typeof resolved.id === 'string' && path.isAbsolute(resolved.id)) {
        output.dynamicImports.push(resolved.id);
    }

    onNodeFound(node, { resolved, external });
}


/**
 * @param {PluginContainer} container 
 * @param {string} input 
 * @param {Object} output 
 * @param {ESTree} node 
 * @param {string} currentpath 
 * @param {Function} onNodeFound 
 */
async function resolveImport (container, input, output, node, currentpath, onNodeFound) {
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

    onNodeFound(node, dependency);

    return dependency;
}

/**
 * @param {ESTree} node 
 * @return {Array<ESTree>}
 */
function findChildNodes (node) {
    let children = [];

    for (let prop in node) {
        if (Array.isArray(node[prop]) && node[prop][0] && node[prop][0].constructor && node[prop][0].constructor.name === 'Node') {
            children.push(...node[prop]);
        } 

        if (node[prop] && node[prop].constructor && node[prop].constructor.name === 'Node') {
            children.push(node[prop]);
        }
    }

    return children;
}

/**
 * @param {PluginContainer} container 
 * @param {string} input 
 * @param {Object} output 
 * @param {Array<ESTree>} nodes 
 * @param {string} currentpath 
 * @param {Function} onNodeFound 
 */
async function walk (container, input, output, nodes, currentpath, onNodeFound) {
    for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];

        if (!node) {
            // There's a possibility of null nodes
            continue;
        } else if (node.type === 'ImportDeclaration') {
            await resolveImport(container, input, output, node, currentpath, onNodeFound);
        } else if (node.type === 'ExportDefaultDeclaration') {
            resolveDefaultExport(container, input, output, node, onNodeFound);
        } else if (node.type === 'ExportNamedDeclaration') {
            await resolveNamedExport(container, input, output, node, currentpath, onNodeFound);
        } else if (node.type === 'ExportAllDeclaration') {
            await resolveAllExport(container, input, output, node, currentpath, onNodeFound);
        } else if (node.type === 'ImportExpression') {
            await resolveDynamicImport(container, input, output, node, currentpath, onNodeFound);
        } else if (node.type === 'MetaProperty' || (node.object && node.object.type === 'MetaProperty')) {
            resolveMetaProperty(container, input, output, node, currentpath, onNodeFound);
            continue; // can't be any more matches in this one
        }

        await walk(container, input, output, findChildNodes(node), currentpath, onNodeFound);
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
function walkLiveBindings (container, input, output, nodes, found, level, generator) {
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

        walkLiveBindings(container, input, output, findChildNodes(node), found, level + 1, generator);

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
 * @return {Promise<Object>}
 */
async function ImportExportResolver (container, input, currentpath, generator) {
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

    await walk(container, input, output, ast.body, currentpath, generator.onESMNodeFound);

    if (output.exportLiveBindings.length > 0) {
        walkLiveBindings(container, input, output, ast.body, [], 0, generator);
    }

    let { code, map } = generator.onESMLeave(input, currentpath, ast);
    output.code = code;
    output.map = map;

    return output;
}

module.exports = ImportExportResolver;