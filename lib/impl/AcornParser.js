let acorn = require('acorn');
let acornWalk = require('acorn-walk');
let injectDynamicImportWalk = require('acorn-dynamic-import/lib/walk').default;
let injectDynamicImportParser = require('acorn-dynamic-import').default;

let defaultAcornOptions = {
    ecmaVersion: 2018,
    sourceType: 'module',
    preserveParens: false,
    plugins: {
        dynamicImport: true
    }
};

let parser = acorn.Parser.extend(injectDynamicImportParser);
let walk = injectDynamicImportWalk(acornWalk);

function parse (input, options = {}) {
    try {
        options = Object.assign({}, defaultAcornOptions, options)
        return parser.parse(input, options);
    } catch (e) {
        console.log(e);
        let err = [
            e.name + ': ' + e.message,
            '    ' + input.split('\n')[e.loc.line - 1],
            '    ' +  '^'.padStart(e.loc.column)
        ].join('\n');

        throw new Error(err);
    }
}

function inject (plugins = []) {
    plugins.forEach(plugin => {
        parser = acorn.Parser.extend(plugin);
    });
}

module.exports = { parse, walk, inject };