// @ts-check

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

        if (error.loc) {
            output += '\n';
            output += error.loc.file.replace(process.cwd(), '');
            output += ` (${error.loc.line}:${error.loc.column})`;
        }

        if (error.frame) {
            output += '\n' + error.frame;
        }
    } else {
        output += error;
    }    

    return { message: output };
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
        console.warn('\x1b[1m\x1b[33m' + format(e).message + '\x1b[39m\x1b[22m');
    }

    /**
     * @param {object|string} e 
     * @return {void|never}
     */
    throw (e) {
        e = format(e);

        e.__isNollupError = true;

        if (!this.__errorThrown) {
            this.__errorThrown = true;
            this.__onThrow();

            if (this.__asyncErrorListener) {
                this.__asyncErrorListener(e);
            } else {
                throw new Error(e.message);
            }
        }
    }

    /**
     * @param {Promise} promiseResult
     * @return {Promise}
     */
    async wrapAsync (promiseResult) {
        let result = await Promise.race([promiseResult, new Promise(resolve => this.__asyncErrorListener = resolve)]);
        if (result && result.__isNollupError) {
            this.__asyncErrorListener = undefined;
            throw new Error(result.message);
        }

        this.__asyncErrorListener = undefined;
        return result;
    }
}

module.exports = PluginErrorHandler;