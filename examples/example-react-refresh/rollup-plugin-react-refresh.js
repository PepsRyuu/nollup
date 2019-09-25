var fs = require('fs');
var runtime = fs.readFileSync(require.resolve('react-refresh/cjs/react-refresh-runtime.development.js'), 'utf8');

runtime = runtime.replace('process.env.NODE_ENV', JSON.stringify(process.env.NODE_ENV));
runtime = runtime.replace('module.exports = ', 'window.$RefreshRuntime$ = ');

module.exports = function () {
    return {
        nollupBundleInit () {
            return `
                ${runtime};
                window.$RefreshRuntime$.injectIntoGlobalHook(window);
                window.$RefreshReg$ = () => {};
                window.$RefreshSig$ = () => type => type;
            `
        },

        resolveId (id) {
            if (id === 'react-refresh-runtime') {
                return id;
            }
        },

        load (id) {
            if (id === 'react-refresh-runtime') {
                return `                    
                    export function isReactRefreshBoundary(moduleExports) {
                        for (let key in moduleExports) {
                            let _c = moduleExports[key];
                            if ($RefreshRuntime$.isLikelyComponentType(_c)) {
                                $RefreshReg$(_c, _c.displayName || _c.name);
                            }
                        }

                        if ($RefreshRuntime$.isLikelyComponentType(moduleExports)) {
                            return true;
                        }
                        if (moduleExports == null || typeof moduleExports !== 'object') {
                            // Exit if we can't iterate over exports.
                            return false;
                        }
                        let hasExports = false;
                        let areAllExportsComponents = true;
                        for (const key in moduleExports) {
                            hasExports = true;
                            if (key === '__esModule') {
                                continue;
                            }
                            const desc = Object.getOwnPropertyDescriptor(moduleExports, key);
                            if (desc && desc.get) {
                                // Don't invoke getters as they may have side effects.
                                return false;
                            }
                            const exportValue = moduleExports[key];
                            if (!$RefreshRuntime$.isLikelyComponentType(exportValue)) {
                                areAllExportsComponents = false;
                            }
                        }
                        return hasExports && areAllExportsComponents;
                    };

                    export function __$RefreshCheck$__(m) {
                        if (isReactRefreshBoundary(m.exports)) {
                            m.hot.accept(() => require(m.id))    
                            setTimeout(function () {
                                $RefreshRuntime$.performReactRefresh()
                            }, 0);
                        }
                    }
                `;
            }
        },

        nollupModuleWrap (code) {
            return `
                var prevRefreshReg = window.$RefreshReg$;
                var prevRefreshSig = window.$RefreshSig$;
                var RefreshRuntime = window.$RefreshRuntime$

                 if (RefreshRuntime) {
                    window.$RefreshReg$ = function (type, id) {
                        var fullId = module.id + ' ' + id;
                        RefreshRuntime.register(type, fullId);
                    }
                    window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
                }

                try {
                    ${code}
                } finally {
                    window.$RefreshReg$ = prevRefreshReg;
                    window.$RefreshSig$ = prevRefreshSig;
                }
            `;
        },

        transform (code, id) {
            if (id === 'react-refresh-runtime' || id.includes('node_modules') ) {
                return;
            } 

            if (code.indexOf('React.createElement') === -1) {
                return;
            }

            return {
                code: [
                    code,
                    'import { __$RefreshCheck$__ } from "react-refresh-runtime"',
                    '__$RefreshCheck$__(module)'
                ].join(';'),
                map: null
            };
        }
    }
}