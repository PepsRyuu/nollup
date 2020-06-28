module.exports = function (options = { bundleId: '' }) {
    // If there's only a single bundle, it will be an id of 0, which will default to ''.
    let bundleId = options.bundleId;
    let hotGlobal = `__nollup__global__.__hot${bundleId}`;

    return {
        nollupBundleInit () {
            return `
                ${hotGlobal} = {
                    status: 'idle',
                    options: ${JSON.stringify(options)},
                    statusHandlers: [],
                    dataCache: {}
                };

                var ws;

                if (typeof WebSocket === 'function') {
                    var protocol =  __nollup__global__.location.protocol === 'https:' ? 'wss://' : 'ws://';
                    ws = new WebSocket(protocol + ${options.hmrHost? `"${options.hmrHost}"` : '__nollup__global__.location.host'} + '/__hmr${bundleId}');
                }

                function verboseLog() {
                    if (!${hotGlobal}.options.verbose) {
                        return;
                    }

                    console.log.apply(console, ['[HMR]'].concat(Array.prototype.slice.call(arguments)));
                }

                function setHotStatus (status) {
                    verboseLog('Status Change', status);
                    ${hotGlobal}.status = status;
                    ${hotGlobal}.statusHandlers.forEach(function (handler) {
                        handler(status);
                    });
                }

                function getDiposableAcceptableModules (id) {
                    var instanceIds = Object.keys(instances).map(k => parseInt(k));
                    var disposable = [];
                    var acceptable = [];
                    var acceptable_args = { branches: {} };

                    if (instances[id] && instances[id].hot._accept) {
                        acceptable.push(id);
                        disposable.push(id);
                        acceptable_args.branches[id] = [id];
                    }

                    if (acceptable.length === 0) {
                        var branches = [[id]];

                        var checkForAcceptable = function (branch) {
                            var latest = branch[branch.length - 1];
                            if (instances[latest].hot._accept) {
                                if (acceptable.indexOf(latest) === -1) {
                                    acceptable.push(latest);
                                    acceptable_args.branches[latest] = branch.slice(0);
                                }

                                for (var i = 0; i < branch.length; i++) {
                                    if (disposable.indexOf(branch[i]) === -1) {
                                        disposable.push(branch[i]);
                                    }
                                }

                                return true;
                            }
                        }

                        while (branches.length) {
                            var newBranches = [];
                            for (var i = 0; i < branches.length; i++) {
                                var branch = branches[i];
                                var lastId = branch[branch.length - 1];
                                var parents = instanceIds.filter(function (i) {
                                    return (
                                        instances[i].dependencies.indexOf(lastId) > -1 || (
                                            instances[i].dynamicDependencies &&
                                            instances[i].dynamicDependencies.indexOf(lastId) > -1
                                        )
                                    )
                                }).filter(function (i) {
                                    return branch.indexOf(i) === -1;
                                });

                                if (parents.length > 0) {
                                    branch.push(parents[0]);
                                    if (checkForAcceptable(branch)) {
                                        branches.splice(i, 1);
                                    }

                                    for (var j = 1; j < parents.length; j++) {
                                        var newBranch = branch.slice(0, branch.length - 1).concat([parents[j]]);
                                        if (!checkForAcceptable(newBranch)) {
                                            newBranches.push(newBranch);
                                        }
                                    }
                                } else {
                                    branches.splice(i, 1);
                                }
                                
                            }

                            branches = branches.concat(newBranches);
                        }
                    }

                    if (acceptable.length === 0) {
                        return { acceptable: [], disposable: [], acceptable_args: acceptable_args };
                    }

                    return { acceptable: acceptable, disposable: disposable, acceptable_args: acceptable_args };
                }

                function hmrDisposeCallback (disposable) {
                    disposable.forEach(function (id) {
                        instances[id].invalidate = true;

                        var data = {};
                        if (instances[id] && instances[id].hot && instances[id].hot._dispose) {
                            instances[id].hot._dispose(data);
                        }
                        ${hotGlobal}.dataCache[id] = data;
                    });
                }

                function hmrAcceptCallback (acceptable, acceptable_args) {
                    acceptable.forEach(function (id) {
                        if (instances[id] && instances[id].hot && instances[id].hot._accept) {
                            instances[id].hot._accept({
                                disposed: acceptable_args.branches[id]
                            });
                        }
                    });
                }

                if (ws) {
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
                                if (!change.removed) {
                                    modules[change.id] = eval(change.code);
                                }
                                
                                // For when a module is added back, but isn't part of any dependency tree
                                if (instances[change.id]) {
                                    instances[change.id].invalidate = true;
                                }
                            });

                            hot.changes.forEach(function (change) {
                                setHotStatus('dispose');
                                var mods = getDiposableAcceptableModules(change.id);
                                hmrDisposeCallback(mods.disposable);

                                if (!change.removed) {
                                    setHotStatus('apply');
                                    hmrAcceptCallback(mods.acceptable, mods.acceptable_args);
                                }
                            });

                            setHotStatus('idle');
                        }
                    };
                }
                
            `;
        },

        nollupModuleInit () {
            return `
                module.hot = {
                    data: ${hotGlobal}.dataCache[module.id] || undefined,

                    accept: function (callback) {
                        this._accept = callback;
                    },

                    dispose: function (callback) {
                        this._dispose = callback;
                    },

                    status: function() {
                        return ${hotGlobal}.status;
                    },

                    addStatusHandler: function(callback) {
                        ${hotGlobal}.statusHandlers.push(callback);
                    },

                    removeStatusHandler: function(callback) {
                        var callbackIndex = ${hotGlobal}.statusHandlers.indexOf(callback);
                        if (callbackIndex > -1) {
                            ${hotGlobal}.statusHandlers.splice(callbackIndex, 1);
                        }
                    }
                };
            `;
        }
    };
}
