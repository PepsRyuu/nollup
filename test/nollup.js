let proxyquire = require('proxyquire');
let path = require('path');
let fs_impl = require('fs');
let expect = require('chai').expect;

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

        if (fs.existsSync(dir)) {
            output = output.concat(fs.readdirSync(dir));
        }

        Object.keys(this._stubs).forEach(file => {
            if (path.dirname(file) === dir) {
                output.push(path.basename(file));
            }
        });

        return output;
    },

    readFile: function (file, encoding, callback) {
        try {
            let output = this.readFileSync(file);
            callback(null, output);
        } catch (e) {
            callback(e);
        }
    },

    readFileSync: function (file) {
        if (this._stubs[file]) {
            return this._stubs[file]();
        }

        return fs_impl.readFileSync(file, 'utf8');
    },

    reset: function () {
        this._stubs = {};
    },

    stub: function (file, callback) {
        let fullPath = path.resolve(process.cwd(), file);
        this._stubs[fullPath] = callback;
    }
}

let nollup = proxyquire('../lib/index', { fs });

let rollup = async (input) => await proxyquire('rollup', { fs }).rollup(input);

module.exports = {
    nollup, fs, expect, rollup
};