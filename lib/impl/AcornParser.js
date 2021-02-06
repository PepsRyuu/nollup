// @ts-check
let acorn = require('acorn');

let defaultAcornOptions = {
    ecmaVersion: 11,
    sourceType: 'module',
    preserveParens: false
};

let parser = acorn.Parser;

/**
 * @param {string} input 
 * @param {object} options 
 * @return {any}
 */
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

/**
 * @param {function|function[]} plugins 
 */
function inject (plugins) {
    if (typeof plugins === 'function') {
        plugins = [plugins];
    }

    plugins.forEach(plugin => {
        // @ts-ignore
        parser = acorn.Parser.extend(plugin);
    });
}

module.exports = { parse, inject };