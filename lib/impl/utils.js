let path = require('path');
let SourceMap = require('source-map');

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
    },

    isExternal: function (context, name) {
        if (context && context.external) {
            let external = context.external;
            if (Array.isArray(external)) {
                return external.indexOf(name) > -1;
            }

            if (typeof external === 'function') {
                return external(name);
            }
        }

        return false;
    },


    combineSourceMapChain: function (mapChain, original_code, filepath) {
        // TODO: Proper handling of null maps.
        let map;
        mapChain = mapChain.filter(o => o.map && o.map.mappings).reverse();

        if (mapChain.length > 1) {
            mapChain.forEach((obj, index) => {
                obj.version = 3;
                obj.map.file = filepath + '_' + index;
                // Check is in place because some transforms return sources, in particular multi-file sources.
                obj.map.sources = obj.map.sources.length === 1? [filepath + '_' + (index + 1)] : obj.map.sources;
                obj.map.sourcesContent = obj.map.sourcesContent.length === 1? [mapChain[index + 1]? mapChain[index + 1].code : original_code] : obj.map.sourcesContent;
            });

            let mapGenerator = SourceMap.SourceMapGenerator.fromSourceMap(new SourceMap.SourceMapConsumer(mapChain[0].map));

            for (let i = 1; i < mapChain.length; i++) {
                mapGenerator.applySourceMap(new SourceMap.SourceMapConsumer(mapChain[i].map))
            }

            map = mapGenerator.toJSON();

            // Remove irrelevant maps.
            map.sources = map.sources && map.sources.map((s, i) => i !== map.sources.length - 1? '' : s);
            map.sourcesContent = map.sourcesContent && map.sourcesContent.map((s, i) => i !== map.sourcesContent.length - 1? '' : s);
        } else {
            map = mapChain.length > 0? mapChain[0].map : undefined;
        }   

        if (map) {
            map.file = filepath;
            map.sources = [filepath];
            map.sourcesContent = [original_code];
        }
        

        return map;
    }
};