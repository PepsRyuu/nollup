let NollupContext = require('./impl/NollupContext');
let NollupCompiler = require('./impl/NollupCompiler');
let CodeGenerator = require('./impl/NollupCodeGenerator');

async function nollup (options = {}) {
    let queue = [];
    let processing = false;
    let context = await NollupContext.create(options);

    async function generateImpl (resolve, reject) {
        processing = true;

        try {
            resolve(await NollupCompiler.compile(context, new CodeGenerator()));
        } catch (e) {
            processing = false;
            reject(e);
        }

        processing = false;

        if (queue.length > 0) {
            queue.shift()();
        }
    }

    return {
        invalidate (file) {
            context.invalidate(file);
        },

        generate (outputOptions = {}) {
            context.setOutputOptions(outputOptions);

            return new Promise((resolve, reject) => {
                if (processing) {
                    queue.push(() => generateImpl(resolve, reject));
                } else {
                    generateImpl(resolve, reject);
                }
            });
        }
    };

};

module.exports = nollup;