process.env.NODE_ENV = 'production';

let fs = require('fs-extra');
let rollup = require('rollup');
let config = require(process.cwd() + '/rollup.config.js');
let md5 = require('md5-file');

if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
}

console.log('Compiling...');

async function compile () {
    let bundle = await rollup.rollup(config);
    let { output } = await bundle.generate(config.output);

    output.forEach(obj => {
        let content = obj.isAsset? obj.source : obj.code;
        fs.writeFileSync('dist/' + obj.fileName, content);
    });

    console.log('Copying public files...');
    fs.copySync('./public', './dist/');

    console.log('Applying hashes...');
    output.forEach(obj => {
        let file = obj.fileName;
        let path = 'dist/' + file;
        let hash = md5.sync(path).substring(0, 8);
        fs.renameSync(path, path.replace('_hash_', hash));

        let index = fs.readFileSync('./dist/index.html', 'utf8');
        index = index.replace(file, file.replace('_hash_', hash));
        fs.writeFileSync('./dist/index.html', index);
    });
}

compile();