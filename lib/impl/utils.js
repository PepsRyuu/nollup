let path = require('path');

module.exports = {
    /**
     * Returns file name using given pattern.
     *
     * @method formatFileName
     * @param {Object} context
     * @param {String} fileName
     * @param {String} pattern
     * @return {String}
     */
    formatFileName: function (context, fileName, pattern) {
        let name = path.basename(fileName).replace(path.extname(fileName), '');

        return pattern.replace('[name]', name)
            .replace('[extname]', path.extname(fileName))
            .replace('[ext]', path.extname(fileName).substring(1))
            .replace('[format]', context.output.format);
    },

    /**
     * Resolves the target path against the current path.
     *
     * @method resolvePath
     * @param {String} target
     * @param {String} current
     * @return {String}
     */
    resolvePath: function (target, current) {
        if (path.isAbsolute(target)) {
            return path.normalize(target);
        } else {
            // Plugins like CommonJS have namespaced imports.
            let parts = target.split(':');
            let namespace = parts.length === 2? parts[0] + ':' : '';
            let file = parts.length === 2? parts[1] : parts[0];
            let ext = path.extname(file);

            return namespace + path.normalize(path.resolve(path.dirname(current), ext? file : file + '.js'));
        }
    }
};