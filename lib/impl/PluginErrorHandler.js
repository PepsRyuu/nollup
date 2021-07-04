// @ts-check
let { white, yellow } = require('./utils');

// Formats the message as best it can.
// Note that this diverges from Rollup warnings, which are formatted for the CLI only.
// When using Rollup API by itself, it only prints normal warning message without all of the other properties like frame or position.
// Nollup however has a dev-server, so it cannot take the CLI approach. Instead regardless of using CLI/API, it will be formatted.
function format (error) {
    let output = '';

    if (typeof error === 'object') {        
        if (error.pluginCode) {
            output += error.pluginCode + ': ';
        }

        if (error.message) {
            output += error.message;
        }

        if (!error.loc && error.filename) {
            let appendment = '';
            appendment += error.filename.replace(process.cwd(), '');
            if (error.start) 
                appendment += ` (${error.start.line}:${error.start.column})`;

            output += '\n' + white(appendment);
        }

        if (error.loc && error.loc.file) {
            let appendment = '';
            appendment += error.loc.file.replace(process.cwd(), '');
            appendment += ` (${error.loc.line}:${error.loc.column})`;
            output += '\n' + white(appendment);
        }

        if (error.frame) {
            output += '\n' + white(error.frame);
        }
    } else {
        output += error;
    }    
    
    if (error instanceof Error) {
        error.message = output;
    } else {
        error = new Error(output);
    }

    error.__isNollupError = true;

    return error;
}

class PluginErrorHandler {
    /**
     * @param {function} callback 
     */
    onThrow (callback) {
        this.__onThrow = callback;
    }

    reset () {
        this.__errorThrown = false;
    }

    warn (e) {
        console.warn(yellow(format(e).message));
    }

    /**
     * @param {object|string} e 
     * @return {void|never}
     */
    throw (e) {
        e = format(e);

        if (!this.__errorThrown) {
            this.__errorThrown = true;
            this.__onThrow();

            if (this.__asyncErrorListener) {
                this.__asyncErrorListener(e);
            } else {
                throw e;
            }
        }
    }

    /**
     * @param {Promise} promiseResult
     * @return {Promise}
     */
    async wrapAsync (promiseResult) {
        let errorPromise = new Promise(resolve => {
            this.__asyncErrorListener = resolve;
        });

        let result = await Promise.race([
            promiseResult,
            errorPromise
        ]).catch(e => {
            // Catches promises that resolve prior to
            // asyncErrorListener being instantiated.
            // Also catches errors that are async but 
            // not triggered using .error()
            if (!this.__errorThrown) {
                this.__errorThrow = true;
                this.__onThrow();
                e = format(e);
            }

            return e;
        });

        if (result && result.__isNollupError) {
            this.__asyncErrorListener = undefined;
            throw result;
        }

        this.__asyncErrorListener = undefined;
        return result;
    }
}

module.exports = PluginErrorHandler;