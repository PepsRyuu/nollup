// @ts-check
const NollupCodeGenerator = require('./NollupCodeGenerator');
let { findChildNodes } = require('./utils');

function getPatternShadows (node, type, search, getter) {
    let shadows = [];
    let childNodes = node[search];

    for (let i = 0; i < childNodes.length; i++) {
        let el = childNodes[i];
        if (el === null) {
            continue;
        }

        let n = getter(el);
        if (n.type === type) {
            shadows = shadows.concat(getPatternShadows(n, type, search, getter));
        } else {
            shadows.push(n.name);
        }
    }

    return shadows;
}

function getVariableDeclarationNames (node) {
    let output = [];

    node.declarations.forEach(declaration => {
        if (declaration.id.type === 'ArrayPattern') {
            output.push(...getPatternShadows(declaration.id, 'ArrayPattern', 'elements', node => node));
        } else if (declaration.id.type === 'ObjectPattern') {
            output.push(...getPatternShadows(declaration.id, 'ObjectPattern', 'properties', node => node.value));
        } else {
            output.push(declaration.id.name);
        }
    });

    return output;
}

function getScopeVariables (node) {
    let variables = [];

    if (isFunction(node) && node.id) {
        variables.push(node.id.name);
    }

    if (node.params) {
        variables.push(...node.params.flatMap(n => {
            if (n.name) {
                return n.name;
            }

            // RestElement
            if (n.argument) {
                return n.argument.name;
            }

            // ArrayPattern
            if (n.elements) {
                return n.elements.map(n => n.name);
            }

            // ObjectPattern
            if (n.properties) {
                return n.properties.map(n => n.value.name);
            }
        }));
    }

    let body = findChildNodes(node);

    let impl = (nodes, insideNestedBlock) => {
        for (let i = 0; i < nodes.length; i++) {
            let n = nodes[i];
            if (n.type === 'VariableDeclaration' && (
                n.kind === 'var' || (!insideNestedBlock && (n.kind === 'let' || n.kind === 'const'))
            )) {
                variables.push(...getVariableDeclarationNames(n));
            }
    
            if (n.type === 'FunctionDeclaration') {
                variables.push(n.id.name);
                continue;
            }

            if (n.type === 'FunctionExpression' || n.type === 'ArrowExpression') {
                continue;
            }

            if (isBlock(n) || isControlBlock(n)) {
                impl(findChildNodes(n), true);
            } else {
                impl(findChildNodes(n));
            } 
        }
    };

    impl(body);

    return variables;
}

function isControlBlock (node) {
    return node.type === 'IfStatement' ||
        node.type === 'ForStatement' ||
        node.type === 'WhileStatement';
}

function isBlock (node) {
    return node.type === 'BlockStatement';
}

function isFunction (node) {
    return node.params;
}

function isObjectPattern (parent, ancestors, node) {
    let grandparent = ancestors[ancestors.length - 2];
    return parent.type === 'Property' && grandparent.type === 'ObjectPattern';
}

function isObjectMemberExpression (parent, ancestors, node) {
    return parent.type === 'MemberExpression' && parent.computed === false && parent.property === node;
}

function isObjectProperty (parent, ancestors, node) {
    return parent.type === 'Property' && parent.key === node && !parent.computed;
}

function isShadowed (scope_variables, name) {
    return scope_variables.findIndex(s => s.findIndex(si => si === name) !== -1) !== -1;
}

function isVariableDeclaration (parent, ancestors, node) {
    return parent.type === 'VariableDeclarator' && node === parent.id;
}

function isExportAlias (parent, ancestors, node) {
    return parent.type === 'ExportSpecifier' && parent.local.start !== parent.exported.start && parent.exported === node;
}

function isClassMethod (parent, ancestors, node) {
    return parent.type === 'MethodDefinition' && parent.computed === false;
}

function isFunctionName (parent, ancestors, node) {
    return isFunction(parent);
}

function isESMImportExportFrom (node) {
    return node.source;
}

function transformImportReferences (imports, ast, generator, currentpath) {
    let ancestors = [];
    let scope_variables = [];

    let impl = (nodes) => {
        for (let i = 0; i < nodes.length; i++) {
            let node = nodes[i];

            if (node === null) {
                continue;
            }

            if (isESMImportExportFrom(node)) {
                continue;
            }

            if (isFunction(node) || isBlock(node) || isControlBlock(node)) {
                scope_variables.push(getScopeVariables(node));
                ancestors.push(node);
                impl(findChildNodes(node));
                ancestors.pop();
                scope_variables.pop();
                continue;
            }

            if (node.type === 'Identifier' && imports.indexOf(node.name) > -1) {  
                let parent = ancestors[ancestors.length - 1];
                
                if (
                    !isObjectMemberExpression(parent, ancestors, node) && 
                    !isObjectPattern(parent, ancestors, node) &&
                    !isObjectProperty(parent, ancestors, node) &&
                    !isVariableDeclaration(parent, ancestors, node) &&
                    !isExportAlias(parent, ancestors, node) &&
                    !isFunctionName(parent, ancestors, node) &&
                    !isClassMethod(parent, ancestors, node) && 
                    !isShadowed(scope_variables, node.name)
                ) {
                    generator.onESMImportLiveBinding(currentpath, node, ancestors);
                }

                continue;
            }

            ancestors.push(node);
            impl(findChildNodes(node));
            ancestors.pop();
        }
    };

    impl(ast);
}

/**
 * @param {NollupInternalModuleImport[]} imports 
 * @param {ESTree} ast 
 * @param {NollupCodeGenerator} generator 
 */
function NollupLiveBindingsResolver (imports, ast, generator, currentpath) {
    let specifiers = imports.flatMap(i => i.specifiers.map(s => s.local));
    transformImportReferences(specifiers, ast, generator, currentpath);
}

module.exports = NollupLiveBindingsResolver;

// TODO: Performance improvements through proper checks