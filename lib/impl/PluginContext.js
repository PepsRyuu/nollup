let AcornParser = require('./AcornParser');
let { formatFileName } = require('./utils');

module.exports = {
    create: function (context) {
        return {
            parse (code, options) {
                return AcornParser.parse(code, options);
            },

            warn (e) {
                console.warn(e);
            },

            error (e) {
                throw e;
            },

            emitAsset (assetName, source) {
                let id = assetName.replace(/\./g, '_');
                context.bundle[assetName] = {
                    isAsset: true,
                    source: source,
                    fileName: formatFileName(context, assetName, context.output.assetFileNames)
                };
                context.assets[id] = context.bundle[assetName];
                return id;
            },

            getAssetFileName (id) {
                return context.assets[id].fileName;
            },

            setAssetSource (id, source) {
                return context.assets[id].source = source;
            },

            resolveId (importee, importer) {
                return require('./PluginLifecycle').resolveId(context, importee, importer);
            }

        }
    }
}