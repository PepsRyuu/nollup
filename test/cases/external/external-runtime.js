let { spawn } = require('child_process');

function executeChunkedFiles (format, entry, chunks, async) {
    return new Promise(resolve => {
        let forked = spawn('node', [
            '--experimental-vm-modules', 
            process.cwd() + '/test/cases/external/fork-worker' 
        ], {
            stdio: [null, null, null, 'ipc']
        });

        forked.stdout.on('data', d => console.log(d.toString()));
        forked.stderr.on('data', d => console.error(d.toString()));

        forked.on('message', msg => {
            if (msg.ready) {
                forked.send({ format, entry, chunks, async });
            } else {
                resolve(msg.result);
                forked.kill();
            }
        });
    });
}

module.exports = { executeChunkedFiles };