/*
    This module looks through all lines of the code and checks for import and export statements.
    Each of these statements are then converted to CommonJS require and export calls.
    It does the trick for now.

    Issues:
        - No support for "export <export> from <file>". It's possible to add though.
        - No support for live bindings. Not sure if I want to break debugging symbols though for a trivial feature.
        - Probably should be using an AST parser. This module can't differentiate between an actual import, and string content for example.

*/
const IMPORT_REGEX = /import\s+(?:(.+)\s+from\s+)?[\'"]([^"\']+)["\']/
const VARIABLE_REGEX = /^(?:([\w]+)(?:$|,\s*))?(?:(?:\* as (\w+))|(?:{(.*)}))?/;
const EXPORT_DEFAULT_REGEX = /export default /g;
const EXPORT_ASSIGNMENT_REGEX = /export (?:let|const|var)\s+(\w+)\s*=\s*(.*?)/g;
const EXPORT_FUNCTION_REGEX = /export ((?:function|class)\s+(\w+))/g;
const EXPORT_VARIABLE_REGEX = /export (?:{(.*?)})/g;

module.exports = function (input) {
    let lines = input.split('\n');
    let dependencies = [];

    lines.forEach((line, lineNum) => {
        let statements = line.split(';');
        statements.forEach((statement, statementNum) => {
            statement = statement.trim();

            if (statement.startsWith('import ')) {
                let matches = statement.match(IMPORT_REGEX);
                let importIndex = dependencies.length;
                dependencies.push(matches[2]);

                let output = `var _i${importIndex} = require(__nollup__${importIndex});`;

                let variables = matches[1];
                if (variables) {
                    let variables_output = [];
                    let matches = variables.trim().match(VARIABLE_REGEX);
                    let type_default = matches[1];
                    let type_all = matches[2];
                    let type_members = matches[3];

                    if (type_default || type_all || type_members) {

                        if (type_default) {
                            variables_output.push(`${type_default} = _i${importIndex}.default`);
                        }

                        if (type_all) {
                            variables_output.push(`${type_all} = _i${importIndex}`);
                        }

                        if (type_members) {
                            type_members.split(',').forEach(member => {
                                let parts = member.split(' as ').map(part => part.trim());
                      
                                if (!parts[1]) {
                                    variables_output.push(`${parts[0]} = _i${importIndex}.${parts[0]}`);
                                } else {
                                    variables_output.push(`${parts[1]} = _i${importIndex}.${parts[0]}`);
                                }
                            });
                        }
                    }

                    output += ' var ' + variables_output.join(', ') + ';';
                }

                statements[statementNum] = output;
            } else if (statement.startsWith('export ')) {
                let output = statements[statementNum];

                output = output.replace(EXPORT_DEFAULT_REGEX, 'module.exports.default = ');

                output = output.replace(EXPORT_ASSIGNMENT_REGEX, (match, name, code) => {
                    return 'module.exports.' + name + ' = ' + code;
                });

                output = output.replace(EXPORT_FUNCTION_REGEX, (match, code, name) => {
                    return 'module.exports.' + name + ' = ' + code;
                });

                output = output.replace(EXPORT_VARIABLE_REGEX, (match, inner) => {
                    let output = [];

                    inner.split(',').forEach(member => {
                        let parts = member.split(' as ').map(part => part.trim());

                        if (!parts[1]) {
                            output.push('module.exports.' + parts[0] + ' = ' + parts[0]);
                        } else {
                            output.push('module.exports.' + parts[1] + ' = ' + parts[0]);
                        }
                    });

                    return output.join(', ');
                });

                statements[statementNum] = output;
            }
        });
        
        lines[lineNum] = statements.join(';');
    });

    return { output: lines.join('\n'), dependencies };
}