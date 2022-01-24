let WebSocket = require('ws');
let vm = require('vm');
let wait = require('./wait');

function findModule (specifier, chunks) {
    let code;

    if (specifier.indexOf('./') === 0) {
        specifier = specifier.slice(2);
    }
    
    let chunk = chunks.find(c => c.fileName === specifier);
    if (chunk) {
        code = chunk.code;
    }

    return code;
}

let Executors = {
    esm: async function (entry) {
        let resolve_module = async (specifier, code) => {
            code = code || findModule(specifier, global._activeChunks);
            let script = new vm.SourceTextModule(code + `//`, {
                context: global._activeContext,
                importModuleDynamically: spec => resolve_module(spec)
            });
    
            if (script.status === 'unlinked') {
                await script.link(spec => resolve_module(spec));
            }
        
            if (script.status === 'linked') {
                await script.evaluate();
            }
        
            return script;
        }
    
        return resolve_module(undefined, `await import("${entry}").then(res => _result = res);`);
    },

    cjs: async function (entry) {   
        let context = global._activeContext;

        context.require = function (spec) {
            let mod = findModule(spec, global._activeChunks);
            if (mod) {
                let script = new vm.Script(`
                    var module = { exports: {} };
                    ${mod}
                    module.exports;
                `, { context });
                return script.runInContext(context);
            }
    
            return require(spec);
        };
    
        context.require.resolve = require.resolve;
        context.require.extensions = require.extensions;
        context.require.cache = require.cache;
    
        let script = new vm.Script(`_result = require("${entry}")`, { context });
        script.runInContext(context);
    },

    iife: async function (entry) {
        let context = global._activeContext;
        let script = new vm.Script(global._activeChunks[0].code, { context });
        script.runInContext(context);
    }
}

process.on('message', async (msg) => {
    if (msg.invalidate) {
        global._activeChunks = msg.chunks;
    }

    if (msg.call) {
        global._activeContext[msg.call[0]](msg.call[1]);
    }

    if (msg.entry) {
        let log = (...args) => process.send({ log: args.join(' ') });

        let contextObj = {
            ...msg.globals,
            _result: undefined,
            WebSocket,
            console: { log }
        };

        contextObj.self = contextObj;
        contextObj.globalThis = contextObj;

        let context = vm.createContext(contextObj);

        // The link callback is cached. If you pass in a code snippet
        // into vm.SourceTextModule that was already passed it, it will
        // fetch a cached instance of the script, and ignore new calls
        // to linking, so it will fetch old chunks from scope.
        // To get around this, we use a global variable so even if the script
        // is pulled from cache, it will always have the latest chunks to evaluate.
        // Could also use inject a random number into the source code, but that might
        // cause a memory leak.
        global._activeChunks = msg.chunks;
        global._activeContext = context;

        try {
            await Executors[msg.format](msg.entry);
            msg.async && await wait(1000);
            
            let globals = { ...context };
            delete globals.self;
            delete globals.globalThis;

            process.send({ result: context._result, globals });
        } catch (e) {
            process.send({ error: e.message });
        }
    }    
});

process.send({ ready: true });