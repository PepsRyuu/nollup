// @ts-check
let NollupContext = require('./NollupContext');
let PluginContext = require('./PluginContext');
let PluginLifecycle = require('./PluginLifecycle');
const RollupConfigContainer = require('./RollupConfigContainer');
const PluginErrorHandler = require('./PluginErrorHandler');

class PluginContainer {
    /**
     * 
     * @param {RollupConfigContainer} config 
     * @param {{parse: function(string, object): ESTree}} parser
     */
    constructor (config, parser) {
        this.__config = config;
        this.__meta = {};
        
        this.__currentModuleId = null;
        this.__currentMapChain = null;
        this.__currentOriginalCode = null;
        this.__currentLoadQueue = [];
        this.__parser = parser;
        this.__errorState = true;

        this.__onAddWatchFile = (source, parent) => {};
        this.__onGetWatchFiles = () => ([]);
        this.__onEmitFile = (referenceId, emittedFile) => {};
        this.__onGetFileName = (referenceId) => '';
        this.__onGetModuleIds = () => new Set().values();
        this.__onGetModuleInfo = (id) => ({});
        this.__onSetAssetSource = (id, source) => {};
        this.__onLoad = (resolvedId) => Promise.resolve();
        
        this.__errorHandler = new PluginErrorHandler();
        this.__errorHandler.onThrow(() => {
            this.__errorState = true;
        });

        this.__plugins = (config.plugins || []).map(plugin => ({
            execute: plugin,
            context: PluginContext.create(this, plugin),
            error: this.__errorHandler
        }));

        this.hooks = /** @type {PluginLifecycleHooks} */ (Object.entries(PluginLifecycle.create(this)).reduce((acc, val) => {
            if (val[0] === 'buildEnd' || val[0] === 'renderError' || val[0] === 'watchChange') {
                acc[val[0]] = val[1];
                return acc;
            }

            acc[val[0]] = (...args) => {
                if (this.__errorState) {
                    throw new Error('PluginContainer "start()" method must be called before going further.');
                }

                // @ts-ignore
                return val[1](...args);
            }

            return acc;
        }, {}));
    }

    start () {
        this.__errorState = false;
        this.__errorHandler.reset();
        PluginLifecycle.resolveIdSkips.reset();
    }

    /**
     * Receives source and parent file if any.
     * @param {function(string, string): void} callback 
     */
    onAddWatchFile (callback) {
        // Local copy of watch files for the getWatchFiles method, but also triggers this event
        this.__onAddWatchFile = callback;
    }

    /**
     * Must return a list of files that are being watched.
     * 
     * @param {function(): string[]} callback 
     */
    onGetWatchFiles (callback) {
        this.__onGetWatchFiles = callback;
    }

    /**
     * Receives emitted asset and chunk information.
     * 
     * @param {function(string, RollupEmittedFile): void} callback 
     */
    onEmitFile (callback) {
        this.__onEmitFile = callback;
    }

    /**
     * Receives the requested module. Must return module info.
     * 
     * @param {function(string): object} callback 
     */
    onGetModuleInfo (callback) {
        this.__onGetModuleInfo = callback;
    }

    /**
     * Receives referenceId for emitted file. Must return output file name.
     * 
     * @param {function(string): string} callback 
     */
    onGetFileName (callback) {
        this.__onGetFileName = callback;
    }

    /**
     * Receives asset reference id, and source.
     * 
     * @param {function(string, string|Uint8Array): void} callback 
     */
    onSetAssetSource (callback) {
        this.__onSetAssetSource = callback;
    }

    /**
     * Must return iterable of all modules in the current bundle.
     * 
     * @param {function(): IterableIterator<string>} callback 
     */
    onGetModuleIds (callback) {
        this.__onGetModuleIds = callback;
    }

    /**
     * Must load the module.
     * 
     * @param {function(): Promise<void>} callback 
     */
     onLoad (callback) {
        this.__onLoad = callback;
    }
}

module.exports = PluginContainer;