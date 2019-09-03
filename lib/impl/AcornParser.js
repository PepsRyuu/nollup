let acorn = require('acorn');
let walk = require('acorn-walk');

let defaultAcornOptions = {
    ecmaVersion: 11,
    sourceType: 'module',
    preserveParens: false
};

function parse (input, options = {}) {
    try {
        options = Object.assign({}, defaultAcornOptions, options)
        return acorn.Parser.parse(input, options);
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