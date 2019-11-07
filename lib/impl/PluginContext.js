let AcornParser = require('./AcornParser');
let { formatFileName, resolvePath } = require('./utils');

const FILE_ID_REGEX = /[\W]/g;

function getIdForFile (name) {
    return '__file__' + name.replace(FILE_ID_REGEX, '_');
}

module.exports = {
    meta: {
        rollupVersion: '2.0'
    },

    create: function (context, current_filepath) {
        return {
            meta: this.meta,

            get moduleIds () {
                console.warn('moduleIds: not implemented');
            },

            addWatchFile (filepath) {
                context.watchFiles[resolvePath(filepath, current_filepath)] = current_filepath;
            },

            emitFile (file) {
                if (file.type === 'chunk') {
                    return console.warn('emitFile: type "chunk": not implemented');
                }

                if (!file.name && !file.fileName) {
                    file.name = file.type;
                }

                let fileName = file.name? formatFileName(context, file.name, context.output.assetFileNames) : file.fileName;
                let id = getIdForFile(fileName);
                context.bundle[fileName] = {
                    name: file.name || file.fileName,
                    isAsset: true,
                    source: file.source,
                    fileName: fileName
                };
                context.assets[id] = context.bundle[fileName];
                return id;
            },

            getCombinedSourcemap () {
                console.warn('getCombinedSourcemap: not implemented');
            },

            getFileName (id) {
                return context.assets[id].fileName;
            },

            getModuleInfo (id) {
                console.warn('getModuleInfo: not implemented');
            },

            async resolve () {
                console.warn('resolve: not implemented');
            },

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
                let id = getIdForFile(assetName);
                context.bundle[assetName] = {
                    name: assetName,
                    isAsset: true,
                    source: source,
                    fileName: formatFileName(context, assetName, context.output.assetFileNames)
                };
                context.assets[id] = context.bundle[assetName];
                return id;
            },

            emitChunk () {
                console.warn('emitChunk: not implemented');
            },

            getAssetFileName (id) {
                return context.assets[id].fileName;
            },

            getChunkFileName () {
                console.warn('getChunkFileName: not implemented');
            },

            setAssetSource (id, source) {
                return context.assets[id].source = source;
            },

            isExternal () {
                console.warn('isExternal: not implemented');
            },

            resolveId (importee, importer) {
                return require('./PluginLifecycle').resolveId(context, importee, importer);
            }

        }
    }
}
