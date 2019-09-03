/*
    This module looks through all lines of the code and checks for import and export statements.
    Each of these statements are then converted to CommonJS require and export calls.
    It does the trick for now.

    Issues:
        - No support for live bindings. Requires checking for various re-assignments of exported variables.

*/
let MagicString = require('magic-string');
let AcornParser = require('./AcornParser');

function resolveImport (context, input, output, node) {
    if (isExternal(context, node.source.value)) {
        return resolveExternalImport(context, input, output, node);
    } else {
        return resolveInternalImport(context, input, output, node);
    }
}

function isExternal(context, name) {
    if (context && context.external) {
        let external = context.external;
        if (Array.isArray(external)) {
            return external.indexOf(name) > -1;
        }

        if (typeof external === 'function') {
            return external(name);
        }
    }

    return false;
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
            node.source.value
        );

        importee = '_e' + globalName;
        transpiled += `var ${importee} = window.${globalName};`
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
        });
    }

    output.transpiled.overwrite(node.start, node.end, transpiled);
    return importee;
}

function resolveInternalImport (context, input, output, node) {
    let importee = `_i${output.dependencies.length}`;
    output.dependencies.push(node.source.value);

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
                })
            }

            if (specifier.type === 'ImportNamespaceSpecifier') {
                output.imports.push({
                    local: specifier.local.name,
                    importee,
                    imported: '*'
                })
            }
        });
    }

    output.transpiled.overwrite(node.start, node.end, '');
    return importee;
}

function resolveDefaultExport (context, input, output, node) {
    if (node.declaration.id) {
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

function resolveNamedExport (context, input, output, node) {
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
            importee = resolveImport(context, input, output, node);
        }

        node.specifiers.forEach(node => {
            if (node.type === 'ExportSpecifier') {
                if (importee !== undefined) {
                    transpiled += `__e__('${node.exported.name}', ${importee}.${node.local.name});`;
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

function resolveAllExport (context, input, output, node) {
    // export * from './file';
    let importee = resolveImport(context, input, output, node);
    let transpiled = `for(var k in ${importee}){k !== "default" && (__e__(k, ${importee}[k]))}`;
    output.transpiled.appendRight(node.end, transpiled);
}

function resolveDynamicImport (context, input, output, node) {    
    let arg = node.source;
    let value = arg.type === 'Literal'? arg.value : arg;
    let index = output.dynamicDependencies.length;

    // import('hello') --> require.dynamic(__nollup__dynamic__0);
    output.transpiled.overwrite(node.start, node.start + 6, 'require.dynamic');
    output.transpiled.overwrite(arg.start, arg.end, '__nollup__dynamic__' + index);

    // Either a string or a ESNode can be pushed here. Let resolveDynamicImport
    // determine how to resolve the file.
    output.dynamicDependencies.push(value);
}

module.exports = function (input, context) {
    let output = {
        transpiled: new MagicString(input),
        dependencies: [],
        dynamicDependencies: [],
        imports: [],
        exports: []
    };

    let ast = AcornParser.parse(input);

    AcornParser.walk.fullAncestor(ast, (node, ancestors) => {
        switch (node.type) {
            case 'ImportDeclaration': 
                resolveImport(context, input, output, node);
                break;

            case 'ExportDefaultDeclaration': 
                resolveDefaultExport(context, input, output, node);
                break;

            case 'ExportNamedDeclaration': 
                resolveNamedExport(context, input, output, node);
                break;

            case 'ExportAllDeclaration': 
                resolveAllExport(context, input, output, node);
                break;

            case 'ImportExpression': 
                resolveDynamicImport(context, input, output, node);
                break;
        }
    }, AcornParser.walk.base);

    return { 
        transpiled: output.transpiled.toString(), 
        dependencies: output.dependencies, 
        dynamicDependencies: output.dynamicDependencies,
        imports: output.imports,
        exports: output.exports
    };
}