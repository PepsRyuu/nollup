import static_files from 'rollup-plugin-static-files';

const WEB_WORKER_PREFIX = 'web-worker:';

function WebWorkerPlugin () {
    return {
        load (id) {
            if (id.startsWith(WEB_WORKER_PREFIX)) {
                let cid = this.emitFile({
                    type: 'chunk',
                    id: id.slice(WEB_WORKER_PREFIX.length)
                });

                return `export default function () {
                    return new Worker(import.meta.ROLLUP_FILE_URL_${cid});
                }`;
            }
        },
      
        resolveId (source, importer) {
            if (source.startsWith(WEB_WORKER_PREFIX)) {
                return this.resolve(source.slice(WEB_WORKER_PREFIX.length), importer).then(
                    resolvedId => WEB_WORKER_PREFIX + resolvedId.id
                );
            }
            return null;
        }
    };
}

export default {
    input: 'src/main.js',
    output: {
        format: 'esm',
        dir: 'dist'
    },
    plugins: [
        WebWorkerPlugin(),
        process.env.NODE_ENV === 'production' && static_files({
            include: ['./public']
        })
    ]
}