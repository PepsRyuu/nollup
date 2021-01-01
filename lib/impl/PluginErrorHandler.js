// @ts-check

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

    /**
     * @param {object|string} e 
     * @return {void|never}
     */
    throw (e) {
        if (typeof e === 'object' && e.frame) {
            e.message = e.message + '\n' + e.frame;
        }

        if (typeof e === 'string') {
            e = { message: e };
        }

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