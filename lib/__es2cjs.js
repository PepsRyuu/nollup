/*
    This module looks through all lines of the code and checks for import and export statements.
    Each of these statements are then converted to CommonJS require and export calls.
    It does the trick for now.

    Issues:
        - No support for live bindings. Not sure if I want to break debugging symbols though for a trivial feature.

*/
let acorn = require('acorn');
let MagicString = require('magic-string');

module.exports = function (input) {
    let s = new MagicString(input);
    let dependencies = [];
    let ast;

    try {
        ast = acorn.parse(input, {
            ecmaVersion: 2018,
            sourceType: 'module',
            preserveParens: false
        });
    } catch (e) {
        let err = [
            e.name + ': ' + e.message,
            '    ' + input.split('\n')[e.loc.line - 1],
            '    ' +  '^'.padStart(e.loc.column)
        ].join('\n');

        throw err;
    }

    for (let i = 0; i < ast.body.length; i++) {
        let node = ast.body[i];
        if (node.type === 'ImportDeclaration') {
            let importIndex = dependencies.length;
            dependencies.push(node.source.value);

            let output = `var _i${importIndex} = require(__nollup__${importIndex});`;

            if (node.specifiers.length > 0) {
                let variables_output = [];

                node.specifiers.forEach(node => {
                    if (node.type === 'ImportDefaultSpecifier') {
                        variables_output.push(`${node.local.name} = _i${importIndex}.default`);
                    }

                    if (node.type === 'ImportSpecifier') {
                        variables_output.push(`${node.local.name} = _i${importIndex}.${node.imported.name}`);
                    }

                    if (node.type === 'ImportNamespaceSpecifier') {
                        variables_output.push(`${node.local.name} = _i${importIndex}`);
                    }
                });

                output += ' var ' + variables_output.join(', ') + ';';
            }

            s.overwrite(node.start, node.end, output);
        } 

        if (node.type === 'ExportDefaultDeclaration') {
            if (node.declaration.id) {
                s.overwrite(node.start, node.declaration.start, '');
                s.appendRight(node.declaration.end, `; module.exports.default = ${node.declaration.id.name};`);
            } else {
                s.overwrite(node.start, node.declaration.start, `module.exports.default = `);
            }
        }

        if (node.type === 'ExportNamedDeclaration') {

            if (node.declaration) {
                if (node.declaration.id) {
                    s.overwrite(node.start, node.declaration.start, '');
                    s.appendRight(node.declaration.end, `; module.exports.${node.declaration.id.name} = ${node.declaration.id.name};`);
                } else if (node.declaration.declarations) {
                    s.overwrite(node.start, node.declaration.start, '');

                    let output = '; ' + node.declaration.declarations.map(node => {
                        return `module.exports.${node.id.name} = ${node.id.name}`;
                    }).join(', ') + ';';
                    s.appendRight(node.declaration.end, output);
                }
            } else if (node.specifiers) {
                let output = [], importIndex, outputPrefix = '';

                // Export {} from statements
                if (node.source) {
                    importIndex = dependencies.length;
                    dependencies.push(node.source.value);
                    outputPrefix = `var _i${importIndex} = require(__nollup__${importIndex});`;
                }

                node.specifiers.forEach(node => {
                    if (node.type === 'ExportSpecifier') {
                        if (importIndex !== undefined) {
                            output.push(`module.exports.${node.exported.name} = _i${importIndex}.${node.local.name}`);
                        } else {
                            output.push(`module.exports.${node.exported.name} = ${node.local.name}`);
                        }
                    }
                });

                s.overwrite(node.start, node.end, outputPrefix + output.join(', ') + ';');
            }
        }

        if (node.type === 'ExportAllDeclaration') {
            importIndex = dependencies.length;
            dependencies.push(node.source.value);
            s.overwrite(node.start, node.end, `var _i${importIndex} = require(__nollup__${importIndex});for(var k in _i${importIndex}){k !== "default" && (module.exports[k] = _i${importIndex}[k])}`);
        }

    }

    return { output: s.toString(), dependencies };
}