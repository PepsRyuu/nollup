/*
    This module looks through all lines of the code and checks for import and export statements.
    Each of these statements are then converted to CommonJS require and export calls.
    It does the trick for now.

    Issues:
        - No support for live bindings. Requires checking for various re-assignments of exported variables.

*/
let MagicString = require('magic-string');
let AcornParser = require('./AcornParser');
let PluginLifecycle = require('./PluginLifecycle');
let { isExternal } = require('./utils');

async function resolveImport (context, input, output, node, currentpath) {
    if (isExternal(context, node.source.value)) {
        output.externalDependencies.push(node.source.value);
        return resolveExternalImport(context, input, output, node);
    } else {
        return resolveInternalImport(context, input, output, node, currentpath);
    }
}

function resolveExternalImport (context, input, output, node) {
    let transpiled = '', importee = '', defaultNode, globalName;
    let globalConf = (context.output && context.output.globals) || {};

    if ((node.specifiers && node.specifiers.length > 0) || node.type === 'ExportAllDeclaration') {
        defaultNode = node.specifiers && node.specifiers.filter(n => n.type === 'ImportDefaultSpecifier')[0];

        // Need to figure out global name.
        // First use the configuration, else use the default name, else the source value.
        globalName = (
            globalConf[node.source.value] || 
            (defaultNode && defaultNode.local.name) || 
            node.source.value.replace(/[\W]/g, '_')
        );

        importee = '_e' + globalName;

        if (context.output && context.output.format === 'cjs') {
            transpiled += `var ${importee} = require("${node.source.value}");`;
        } else {
            transpiled += `var ${importee} = __nollup__global__.${globalName};`
        }
    }

    if (node.specifiers && node.specifiers.length > 0) {
        node.specifiers.forEach(node => {
            if (node.type === 'ImportDefaultSpecifier') {
                transpiled += `var ${node.local.name} = ${importee} && ${importee}.hasOwnProperty("default")? ${importee}.default : ${importee};`;
            }

            if (node.type === 'ImportSpecifier') {
                transpiled += `var ${node.local.name} = ${importee}.${node.imported.name};`;
            }

            if (node.type === 'ImportNamespaceSpecifier') {
                transpiled += `var ${node.local.name} = ${importee}`;
            }

            if (node.type === 'ExportSpecifier') {
                transpiled += `var ex_${node.exported.name} = ${importee}.${node.local.name};`;
            }
        });
    }

    output.transpiled.overwrite(node.start, node.end, transpiled);
    return importee;
}

async function resolveInternalImport (context, input, output, node, currentpath) {
    let dependency_path = await PluginLifecycle.resolveId(context, node.source.value, currentpath);

    if (dependency_path === false || (typeof dependency_path === 'object' && dependency_path.external)) {
        output.externalDependencies.push(dependency_path.id || node.source.value);
        return;
    }

    let importee = `_i${output.dependencies.length}`;
    output.dependencies.push(dependency_path.id);

    if (node.specifiers && node.specifiers.length === 0) {
        output.imports.push({
            importee
        });
    }

    if (node.specifiers && node.specifiers.length > 0) {
        node.specifiers.forEach(specifier => {
            if (specifier.type === 'ImportDefaultSpecifier') {
                output.imports.push({
                    local: specifier.local.name,
                    imported: 'default',
                    importee
                });
            }

            if (specifier.type === 'ImportSpecifier') {
                output.imports.push({
                    local: specifier.local.name,
                    imported: specifier.imported.name,
                    importee
                });
            }

            if (specifier.type === 'ImportNamespaceSpecifier') {
                output.imports.push({
                    local: specifier.local.name,
                    importee,
                    imported: '*'
                });
            }

            if (specifier.type === 'ExportSpecifier') {
                output.imports.push({
                    local: 'ex_' + specifier.exported.name,
                    importee,
                    imported: specifier.local.name
                });
            }
        });
    }

    output.transpiled.overwrite(node.start, node.end, '');
    return importee;
}

function resolveDefaultExport (context, input, output, node) {
    if (node.declaration && node.declaration.id) {
        // Using + 15 to avoid "export default (() => {})" being converted
        // to "module.exports.default = () => {})"
        output.transpiled.overwrite(node.start, node.start + 15, '');
        output.transpiled.appendRight(node.declaration.end, `; __e__('default', ${node.declaration.id.name});`);
    } else {
        output.transpiled.overwrite(node.start, node.start + 15, `__e__('default', `);
        let end = input[node.end - 1] === ';'? node.end - 1 : node.end;
        output.transpiled.appendRight(end, ')');
    }

    output.exports.push('default');
}

async function resolveNamedExport (context, input, output, node, currentpath) {
    // export function / class / let...
    if (node.declaration) {
        let dec = node.declaration;

        // Remove 'export' keyword.
        output.transpiled.overwrite(node.start, node.start + 7, '');

        // Singular export declaration
        if (dec.id) {
            output.transpiled.appendRight(dec.end, `; __e__('${dec.id.name}', ${dec.id.name});`);
            output.exports.push(dec.id.name);
        } 

        // Multiple export declaration
        if (dec.declarations) {
            let transpiled = '; ' + dec.declarations.map(node => {
                output.exports.push(node.id.name);
                return `__e__('${node.id.name}', ${node.id.name})`;
            }).join(', ') + ';';
            output.transpiled.appendRight(node.declaration.end, transpiled);
        }
    }

    // export { specifier, specifier }
    if (node.specifiers.length > 0) {
        let importee, transpiled = '';

        // export { imported } from './file.js';
        if (node.source) {
            importee = await resolveImport(context, input, output, node, currentpath);
        }

        node.specifiers.forEach(node => {
            if (node.type === 'ExportSpecifier') {
                if (importee) {
                    transpiled += `__e__('${node.exported.name}', ex_${node.exported.name});`;
                } else {
                    transpiled += `__e__('${node.exported.name}', ${node.local.name});`;
                }
                output.exports.push(node.exported.name);
            }
        });

        if (importee) {
            output.transpiled.appendRight(node.end, transpiled);
        } else {
            output.transpiled.overwrite(node.start, node.end, transpiled);
        }
        
    }
}

async function resolveAllExport (context, input, output, node, currentpath) {
    // export * from './file';
    let importee = await resolveImport(context, input, output, node, currentpath);
    if (!importee) {
        return;
    }

    output.imports.push({
        importee,
        imported: '*'
    });

    let transpiled = `for(var __k__ in ex${importee}){__k__ !== "default" && (__e__(__k__, ex${importee}[__k__]))}`;
    output.transpiled.appendRight(node.end, transpiled);
}

async function resolveDynamicImport (context, input, output, node, currentpath) {    
    let arg = node.source;
    let value = arg.type === 'Literal'? arg.value : arg;

    let dependency_path = await PluginLifecycle.resolveDynamicImport(context, value, currentpath);

    if (dependency_path === false || (typeof dependency_path === 'object' && dependency_path.external)) {
        output.dynamicExternalDependencies.push(dependency_path.id || value);
        return;
    }

    let index = output.dynamicDependencies.length;

    // import('hello') --> require.dynamic(__nollup__dynamic__0);
    output.transpiled.overwrite(node.start, node.start + 6, 'require.dynamic');
    output.transpiled.overwrite(arg.start, arg.end, '__nollup__dynamic__' + index);

    // Either a string or a ESNode can be pushed here. Let resolveDynamicImport
    // determine how to resolve the file.
    output.dynamicDependencies.push(dependency_path.id);
}

const META_PROPS = ['ROLLUP_FILE_URL_', 'ROLLUP_ASSET_URL_', 'ROLLUP_CHUNK_URL_'];
function resolveMetaProperty (context, input, output, node, currentpath) {
    if (node.meta_property) {
        for (let i = 0; i < META_PROPS.length; i++) {
            let prop = META_PROPS[i];
            if (node.meta_property.name.startsWith(prop)) {
                let id = node.meta_property.name.replace(prop, '');
                let replacement = PluginLifecycle.resolveFileUrl(
                    context,
                    prop,
                    id,
                    context.emitted[id].fileName
                ) || '"' + context.emitted[id].fileName + '"';
                output.transpiled.overwrite(node.start, node.end, replacement);
                return;
            }
        }
    }

    let replacement = PluginLifecycle.resolveImportMeta(context, node.meta_property? node.meta_property.name : null);
    if (replacement) {
        output.transpiled.overwrite(node.start, node.end, replacement);
    }
}

module.exports = async function (input, context, currentpath) {
    let output = {
        transpiled: new MagicString(input),
        dependencies: [],
        dynamicDependencies: [],
        externalDependencies: [],
        dynamicExternalDependencies: [],
        imports: [],
        exports: []
    };

    let ast = AcornParser.parse(input);

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

    async function walk (nodes) {
        for (let i = 0; i < nodes.length; i++) {
            let node = nodes[i];
            if (!node) {
                // There's a possibility of null nodes
                continue;
            } else if (node.type === 'ImportDeclaration') {
                await resolveImport(context, input, output, node, currentpath);
            } else if (node.type === 'ExportDefaultDeclaration') {
                resolveDefaultExport(context, input, output, node);
            } else if (node.type === 'ExportNamedDeclaration') {
                await resolveNamedExport(context, input, output, node, currentpath);
            } else if (node.type === 'ExportAllDeclaration') {
                await resolveAllExport(context, input, output, node, currentpath);
            } else if (node.type === 'ImportExpression') {
                await resolveDynamicImport(context, input, output, node, currentpath);
            } else if (node.type === 'MetaProperty') {
                resolveMetaProperty(context, input, output, node, currentpath);
            }

            await walk(findChildNodes(node));
        }
    }

    await walk(ast.body);

    return { 
        transpiled: output.transpiled.toString(), 
        dependencies: output.dependencies, 
        dynamicDependencies: output.dynamicDependencies,
        externalDependencies: output.externalDependencies,
        dynamicExternalDependencies: output.dynamicExternalDependencies,
        imports: output.imports,
        exports: output.exports
    };
}