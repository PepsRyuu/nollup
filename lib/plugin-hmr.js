module.exports = function (options) {
    return {
        nollupBundleInit () {
            return `
                window.__hot = {
                    status: 'idle',
                    options: ${JSON.stringify(options)},
                    statusHandlers: []
                };

                var ws = new WebSocket('ws://' + ${options.hmrHost? `"${options.hmrHost}"` : 'window.location.host'} + '/__hmr');

                function verboseLog() {
                    if (!window.__hot.options.verbose) {
                        return;
                    }

                    console.log.apply(console, ['[HMR]'].concat(Array.prototype.slice.call(arguments)));
                }

                function setHotStatus (status) {
                    verboseLog('Status Change', status);
                    window.__hot.status = status;
                    window.__hot.statusHandlers.forEach(function (handler) {
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
                    setHotStatus('apply');

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

                    if (hot.status) {
                        setHotStatus(hot.status);
                    }

                    if (hot.changes) {
                        verboseLog('Changes Received');

                        hot.changes.forEach(function (change) {
                            hmrDisposeCallback(change.id);

                            if (!change.removed) {
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
                        return window.__hot.status;
                    },

                    addStatusHandler: function(callback) {
                        window.__hot.statusHandlers.push(callback);
                    },

                    removeStatusHandler: function(callback) {
                        var callbackIndex = window.__hot.statusHandlers.indexOf(callback);
                        if (callbackIndex > -1) {
                            window.__hot.statusHandlers.splice(callbackIndex, 1);
                        }
                    }
                };
            `;
        }
    };
}
