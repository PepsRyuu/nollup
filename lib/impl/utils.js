// @ts-check
let path = require('path');
let NollupContext = require('./NollupContext');

function white (text) {
    return '\x1b[1m\x1b[37m' + text + '\x1b[39m\x1b[22m';
}

function yellow (text) {
    return '\x1b[1m\x1b[33m' + text + '\x1b[39m\x1b[22m';
}

/**
 * @param {ESTree} node 
 * @return {Array<ESTree>}
 */
function findChildNodes (node) {
    let children = [];

    for (let prop in node) {
        if (Array.isArray(node[prop]) && node[prop][0] && node[prop][0].constructor && node[prop][0].constructor.name === 'Node') {
            children.push(...node[prop]);
        } 

        if (node[prop] && node[prop].constructor && node[prop].constructor.name === 'Node') {
            children.push(node[prop]);
        }
    }

    return children;
}

/**
 * @param {string} target 
 * @param {string} current 
 * @return {string}
 */
function resolvePath (target, current) {
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

/**
 * @param {string} format 
 * @param {string} fileName 
 * @param {string|function(RollupPreRenderedFile): string} pattern 
 * @return {string}
 */
function formatFileName (format, fileName, pattern) {
    let name = path.basename(fileName).replace(path.extname(fileName), '');

    if (typeof pattern === 'string') {
        return pattern.replace('[name]', name)
            .replace('[extname]', path.extname(fileName))
            .replace('[ext]', path.extname(fileName).substring(1))
            .replace('[format]', format === 'es'? 'esm' : format);
    }
 
    // TODO: Function pattern implementation
    return '';
}

/**
 * @param {string} file 
 * @return {string}
 */
function getNameFromFileName (file) {
    return path.basename(file.replace(/\0/g, '_')).replace(path.extname(file), '')
}

/**
 * @param {RollupOutputOptions} outputOptions 
 * @param {RollupOutputFile[]} bundle
 * @param {NollupInternalEmittedAsset} asset 
 * @param {Object<string, RollupOutputFile>} bundleReferenceIdMap
 */
function emitAssetToBundle (outputOptions, bundle, asset, bundleReferenceIdMap) {
    let extensionlessName = getNameFromFileName(asset.name);
    let extension = path.extname(asset.name);
    let deconflictMatcher = new RegExp('^' + extensionlessName + '(\\d+)?' + extension + '$');
    let matches = bundle.filter(e => e.type === 'asset' && e.name.match(deconflictMatcher));
    let finalisedName = extensionlessName + (matches.length > 0? matches.length + 1 : '') + extension;

    let bundleEntry = {
        name: finalisedName,
        isAsset: /** @type {true} */ (true),
        type: /** @type {'asset'} */ ('asset'),
        source: asset.source,
        fileName: asset.fileName || formatFileName(outputOptions.format, finalisedName, outputOptions.assetFileNames)
    };

    bundleReferenceIdMap[asset.referenceId] = bundleEntry;
    bundle.push(bundleEntry);
}



module.exports = {
    white,
    yellow,
    resolvePath,
    formatFileName,
    getNameFromFileName,
    emitAssetToBundle,
    findChildNodes
};