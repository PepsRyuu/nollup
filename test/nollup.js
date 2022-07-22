let proxyquire = require('proxyquire').noCallThru();
let path = require('path');
let fs_impl = require('fs');
let expect = require('chai').expect;
let SourceMapFast = require('source-map-fast');

// Source map lib has a check for browser
if (!global.window) {
    global.window = {};
}

window.fetch = undefined;

let fs = {
    '@global': true,
    _stubs: {},

    lstatSync: function (file) {
        return {
            isSymbolicLink: () => false,
            isFile: () => true
        }
    },

    readdirSync: function (dir) {
        let output = [];

        // if (fs.existsSync(dir)) {
        //     output = output.concat(fs.readdirSync(dir));
        // }

        Object.keys(this._stubs).forEach(file => {
            if (path.dirname(file) === dir) {
                output.push(path.basename(file));
            }
        });

        return output;
    },

    readFile: function (file, encoding, callback) {
        try {
            let output = this.readFileSync(file, encoding);
            callback(null, output);     
        } catch (e) {
            callback(e);
        }
    },

    readFileSync: function (file, encoding) {
        if (this._stubs[file]) {
            return this._stubs[file]();
        }

        return fs_impl.readFileSync(file, encoding);
    },

    existsSync: function(file) {
        return Boolean(this._stubs[file]) || fs_impl.existsSync(file);
    },

    reset: function () {
        this._stubs = {};
    },

    stub: function (file, callback) {
        let fullPath = path.resolve(process.cwd(), file);
        this._stubs[fullPath] = callback;
    },

    promises: {
        lstat: async function (file) {
            return {
                isSymbolicLink: () => false,
                isFile: () => true
            }
        },

        realpath: async function (file) {
        },

        readdir: async function (directory) {
            return fs.readdirSync(directory);
        },

        readFile: async function (file, encoding) {
            return fs.readFileSync(file, encoding);
        }
    }
}

let nollup = proxyquire('../lib/index', { fs });

let rollup = async (input) => await proxyquire('rollup', { fs }).rollup(input);

module.exports = {
    nollup, fs, expect, rollup
};