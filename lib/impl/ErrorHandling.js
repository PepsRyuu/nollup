let errorThrown = false, asyncErrorListener;

module.exports = {
    // Reset if error has been thrown in this build compilation
    reset: function () {
        errorThrown = false;
    },

    throw: function (e) {
        if (typeof e === 'object' && e.frame) {
            e.message = e.message + '\n' + e.frame;
        }

        if (typeof e === 'string') {
            e = { message: e };
        }

        e.__isNollupError = true;

        if (!errorThrown) {
            errorThrown = true;

            if (asyncErrorListener) {
                asyncErrorListener(e);
            } else {
                throw new Error(e.message);
            }
        }
    },

    wrapAsync: async function (promiseResult) {
        let result = await Promise.race([promiseResult, new Promise(resolve => asyncErrorListener = resolve)]);
        if (result && result.__isNollupError) {
            asyncErrorListener = undefined;
            throw new Error(result.message);
        }

        asyncErrorListener = undefined;
        return result;
    }
};