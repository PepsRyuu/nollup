let path = require('path');

let files = {};
let filename = 'styles._hash_.css';

module.exports = function () {
    return {
        transform: function (code, id) {
            if (path.extname(id) !== '.css') {
                return;
            }

            files[id] = code;

            if (process.env.NODE_ENV !== 'production') {
                return `
                    function reload () {
                        let link = document.querySelector('link');
                        if (link.href.indexOf('${filename}') > -1) {
                            link.href = '${filename}' + '?' + Date.now();
                        }
                    }

                    // Using this approach so that when new files
                    // are added, they're immediately evaluated.
                    if (this.__styleLinkTimeout) {
                        cancelAnimationFrame(this.__styleLinkTimeout);
                    }

                    requestAnimationFrame(reload);  
                    module.hot.dispose(reload)
                    module.hot.accept(reload);
                `;
            }
            
            return '';
        },

        generateBundle (options, bundle) {
            let modules = bundle[options.file].modules;

            let output = '';
            Object.keys(modules).forEach(filename => {
                if (files[filename]) {
                    output += files[filename] + '\n';
                }
            });

            this.emitAsset(filename, output);
        }
    }
}
