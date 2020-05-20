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

/**
 * Setting imports to empty can cause source maps to break.
 * This is because some imports could span across multiple lines when importing named exports.
 * To bypass this problem, this function will replace all text except line breaks with spaces.
 * This will preserve the lines so source maps function correctly.
 * Source maps are ideally the better way to solve this, but trying to maintain performance.
 *
 * @method blanker
 */
function blanker (input, start, end) {
    return input.substring(start, end).replace(/[^\n\r]/g, ' ');
}

/**
 * @method resolveDefaultExport
 */
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

/**
 * @method resolveNamedExport
 */
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
        let transpiled = '';

        // export { imported } from './file.js';
        if (node.source) {
            await resolveImport(context, input, output, node, currentpath);
        }

        node.specifiers.forEach(spec => {
            if (spec.type === 'ExportSpecifier') {
                if (node.source) {
                    transpiled += `__e__('${spec.exported.name}', ex_${spec.exported.name});`;
                } else {
                    transpiled += `__e__('${spec.exported.name}', ${spec.local.name});`;
                }
                output.exports.push(spec.exported.name);
            }
        });

        if (!node.source) {
            // Export from statements are already blanked by the import section.
            output.transpiled.overwrite(node.start, node.end, blanker(input, node.start, node.end));
        }

        output.transpiled.appendRight(node.end, transpiled);
    }
}

/**
 * @method resolveAllExport
 */
async function resolveAllExport (context, input, output, node, currentpath) {
    // export * from './file';
    let dep = await resolveImport(context, input, output, node, currentpath);
    if (!dep) {
        return;
    }

    dep.specifiers.push({
        local: 'ex' + dep.importee,
        imported: '*'
    });

    let transpiled = `for(var __k__ in ex${dep.importee}){__k__ !== "default" && (__e__(__k__, ex${dep.importee}[__k__]))}`;
    output.transpiled.appendRight(node.end, transpiled);
}


/**
 * Convert URL meta properties if they exist.
 * Otherwise, run the resolveImportMeta hook.
 *
 * @method resolveMetaProperty
 */
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

/**
 * @method resolveDynamicImport
 */
async function resolveDynamicImport (context, input, output, node, currentpath) {    
    let arg = node.source;
    let value = arg.type === 'Literal'? arg.value : arg;
    let resolved = await PluginLifecycle.resolveDynamicImport(context, value, currentpath);

    if (resolved === false || (typeof resolved === 'object' && resolved.external)) {
        output.externalDynamicImports.push(resolved.id || value);
        return;
    }

    let index = output.dynamicImports.length;

    // import('hello') --> require.dynamic(__nollup__dynamic__0);
    output.transpiled.overwrite(node.start, node.start + 6, 'require.dynamic');
    output.transpiled.overwrite(arg.start, arg.end, '__nollup__dynamic__' + index);

    // Either a string or a ESNode can be pushed here. Let resolveDynamicImport
    // determine how to resolve the file.
    output.dynamicImports.push(resolved.id);
}


/**
 * @method resolveImport
 */
async function resolveImport (context, input, output, node, currentpath) {
    let resolved = await PluginLifecycle.resolveId(context, node.source.value, currentpath);

    let dependency = {
        source: undefined,
        specifiers: []
    };

    if (isExternal(context, node.source.value) || resolved === false || (typeof resolved === 'object' && resolved.external)) {
        dependency.importee = `__nollup__external__${node.source.value.replace(/[\W]/g, '_')}__`;
        dependency.source = node.source.value;
        output.externalImports.push(dependency);
    } else {
        dependency.importee = `_i${output.imports.length}`;
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
                    local: 'ex_' + specifier.exported.name,
                    imported: specifier.local.name
                });
            }
        });
    }

    output.transpiled.overwrite(node.start, node.end, blanker(input, node.start, node.end));
    return dependency;
}

/**
 * @method ImportExportResolver
 */
module.exports = async function (input, context, currentpath) {
    let output = {
        transpiled: new MagicString(input),
        imports: [],
        externalImports: [],
        exports: [],
        dynamicImports: [],
        externalDynamicImports: []
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

    output.map = output.transpiled.generateMap({ source: currentpath });
    output.transpiled = output.transpiled.toString();

    return output;
}