let acorn = require('acorn');

// Basic implementation of import.meta based on
// https://github.com/acornjs/acorn-import-meta
// Using this approach because of the acorn NPM bug.
function ImportMetaPlugin (Parser) {
    return class extends Parser {
        parseExprAtom (errs) {
            if (this.type !== acorn.tokTypes._import || this.input[this.pos] !== '.') {
                return super.parseExprAtom(errs);
            }

            let node = this.startNode();
            node.meta = this.parseIdent(true);
            this.expect(acorn.tokTypes.dot);
            node.property = this.parseIdent(true);
            if (this.input[this.pos - 1] === '.') {
                this.expect(acorn.tokTypes.dot);
                node.meta_property = this.parseIdent();
            }

            return this.finishNode(node, 'MetaProperty');
        }

        parseStatement (context, topLevel, exports) {
            if (this.type !== acorn.tokTypes._import || this.input[this.pos] !== '.') {
                return super.parseStatement(context, topLevel, exports);
            }

            let node = this.startNode();
            let expr = this.parseExpression();
            return this.parseExpressionStatement(node, expr);
        }
    }
}

let defaultAcornOptions = {
    ecmaVersion: 11,
    sourceType: 'module',
    preserveParens: false
};

let parser = acorn.Parser.extend(ImportMetaPlugin);

function parse (input, options = {}) {
    try {
        options = Object.assign({}, defaultAcornOptions, options)
        return parser.parse(input, options);
    } catch (e) {
        e.message = [
            e.message,
            '    ' + input.split('\n')[e.loc.line - 1],
            '    ' +  '^'.padStart(e.loc.column + 1)
        ].join('\n');

        throw e;
    }
}

function inject (plugins = []) {
    plugins.forEach(plugin => {
        parser = acorn.Parser.extend(plugin);
    });
}

module.exports = { parse, inject };