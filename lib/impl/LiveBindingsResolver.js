let MagicString = require('magic-string');
let AcornParser = require('./AcornParser');
let { findChildNodes } = require('./utils');

function getArrayPatternShadows (node) {
    let shadows = [];

    for (let i = 0; i < node.elements.length; i++) {
        let el = node.elements[i];
        if (el === null) {
            continue;
        }

        if (el.type === 'ArrayPattern') {
            shadows = shadows.concat(getArrayPatternShadows(el));
        } else {
            shadows.push(el.name);
        }
    }

    return shadows;
}

function getObjectPatternShadows (node) {
    let shadows = [];

    for (let i = 0; i < node.properties.length; i++) {
        let el = node.properties[i];
        if (el === null) {
            continue;
        }

        if (el.value.type === 'ObjectPattern') {
            shadows = shadows.concat(getObjectPatternShadows(el.value));
        } else {
            shadows.push(el.value.name);
        }
    }

    return shadows;
}

function walk (context, input, output, nodes) {
    let ancestors = [];
    let shadowed = [];

    let impl = (nodes) => {
        for (let i = 0; i < nodes.length; i++) {
            let node = nodes[i];

            if (!node) {
                // There's a possibility of null nodes
                continue;
            } 

            if (node.type === 'ImportDeclaration') {
                continue;
            }

            if (node.type === 'FunctionDeclaration' || 
                node.type === 'FunctionExpression' ||
                node.type === 'ArrowFunctionExpression' ||
                node.type === 'BlockStatement'
            ) {
                if (node.params) {
                    shadowed.push(node.params.map(n => n.name));
                }

                let body = node.params && node.body.body? node.body.body : node.body;

                let blockShadows = [];
                for (let i = 0; i < body.length; i++) {
                    let childNode = body[i];
                    if (childNode.type === 'VariableDeclaration') {
                        if (childNode.declarations[0] && childNode.declarations[0].id.type === 'ArrayPattern') {
                            blockShadows = blockShadows.concat(getArrayPatternShadows(childNode.declarations[0].id));
                        } else if (childNode.declarations[0] && childNode.declarations[0].id.type === 'ObjectPattern') {
                            blockShadows = blockShadows.concat(getObjectPatternShadows(childNode.declarations[0].id));
                        } else {
                            blockShadows = blockShadows.concat(childNode.declarations.map(n => n.id.name));
                        }
                    }
                }

                shadowed.push(blockShadows);
                ancestors.push(node);
                impl(Array.isArray(body)? body : [body]);
                ancestors.pop();
                shadowed.pop();
                shadowed.pop();
                continue;
            }


            if (node.type === 'Identifier') {
                let parent = ancestors[ancestors.length - 1];
                let isImport = output.imports.find(i => i.specifiers.find(s => s.local === node.name));
                let isShadowed = shadowed.findIndex(s => s.findIndex(si => si === node.name) !== -1) !== -1;

                if (isImport) {
                    // { B: A }, { A: A }, { A }, { A: B }
                    if (parent.type === 'Property') {
                        if (parent.value.name === node.name) {
                            if (ancestors[ancestors.length - 2].type !== 'ObjectPattern') {
                                if (!isShadowed) {
                                    output.transpiled.overwrite(parent.start, parent.end, parent.key.name + ': __i__["' + node.name + '"]')
                                }
                            }
                        }
                    } else if (parent.type === 'FunctionDeclaration' ||  // TODO: No need for these?
                        parent.type === 'FunctionExpression' || 
                        parent.type === 'ArrowFunctionExpression' ||
                        (parent.type === 'MemberExpression' && parent.object !== node && parent.computed === false)
                    ) {
                        // parameter
                        continue;
                    } else {
                        if (!isShadowed) {
                            output.transpiled.overwrite(node.start, node.end, '__i__["' + node.name + '"]')
                        }

                    }
                }

            }

            ancestors.push(node);
            impl(findChildNodes(node));
            ancestors.pop();
        }
    };

    impl(nodes);
}

/**
 * @method ImportExportResolver
 */
module.exports = function (context, input, currentpath, imports) {
    let output = {
        imports,
        transpiled: new MagicString(input)
    };

    let ast = AcornParser.parse(input);
    walk(context, input, output, ast.body);

    output.map = output.transpiled.generateMap({ source: currentpath });
    output.code = output.transpiled.toString();
    return output;
}