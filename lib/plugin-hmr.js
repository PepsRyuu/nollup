module.exports = function (options) {
    // If there's only a single bundle, it will be an id of 0, which will default to ''.
    let bundleId = options.bundleId;

    return {
        nollupBundleInit () {
            return `
                window.__hot${bundleId} = {
                    status: 'idle',
                    options: ${JSON.stringify(options)},
                    statusHandlers: []
                };

                var ws = new WebSocket('ws://' + ${options.hmrHost? `"${options.hmrHost}"` : 'window.location.host'} + '/__hmr${bundleId}');

                function verboseLog() {
                    if (!window.__hot${bundleId}.options.verbose) {
                        return;
                    }

                    console.log.apply(console, ['[HMR]'].concat(Array.prototype.slice.call(arguments)));
                }

                function setHotStatus (status) {
                    verboseLog('Status Change', status);
                    window.__hot${bundleId}.status = status;
                    window.__hot${bundleId}.statusHandlers.forEach(function (handler) {
                        handler(status);
                    });
                }

                function invalidateParents (id) {
                    return Object.keys(instances).filter(function (instancesId) {
                        return instances[instancesId].dependencies.indexOf(id) > -1;
                    }).map(function (id) {
                        instances[id].invalidate = true;
                        return parseInt(id);
                    });
                }

                function hmrDisposeCallback (id) {
                    setHotStatus('dispose');

                    if (instances[id]) {
                        if (instances[id].hot._dispose) {
                            instances[id].hot._dispose();
                        }
                    }
                }

                function hmrAcceptCallback (id) {
                    if (instances[id]) {
                        instances[id].invalidate = true;

                        if (instances[id].hot._accept) {
                            instances[id].hot._accept();
                            return true;
                        }

                        return invalidateParents(id).some(function (id) {
                            return hmrAcceptCallback(id);
                        });
                    }
                }

                ws.onmessage = function (e) {
                    var hot = JSON.parse(e.data);

                    if (hot.greeting) {
                        verboseLog('Enabled');
                    }

                    if (hot.status) {
                        setHotStatus(hot.status);
                    }

                    if (hot.changes) {
                        verboseLog('Changes Received');

                        hot.changes.forEach(function (change) {
                            hmrDisposeCallback(change.id);

                            if (!change.removed) {
                                setHotStatus('apply');
                                modules[change.id] = eval('(' + change.code + ')');
                                hmrAcceptCallback(change.id);
                            }
                        });

                        setHotStatus('idle');
                    }
                };
            `;
        },

        nollupModuleInit () {
            return `
                module.hot = {
                    accept: function (callback) {
                        this._accept = callback;
                    },

                    dispose: function (callback) {
                        this._dispose = callback;
                    },

                    status: function() {
                        return window.__hot${bundleId}.status;
                    },

                    addStatusHandler: function(callback) {
                        window.__hot${bundleId}.statusHandlers.push(callback);
                    },

                    removeStatusHandler: function(callback) {
                        var callbackIndex = window.__hot${bundleId}.statusHandlers.indexOf(callback);
                        if (callbackIndex > -1) {
                            window.__hot${bundleId}.statusHandlers.splice(callbackIndex, 1);
                        }
                    }
                };
            `;
        }
    };
}
