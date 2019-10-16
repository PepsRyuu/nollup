let nollup = require('../index');
let path = require('path');

module.exports = async function (filepath) {
	let bundle = await nollup({
		external: id => (id[0] !== '.' && !path.isAbsolute(id)) || id.slice(-5, id.length) === '.json',
		input: filepath
	});

	let { output } = await bundle.generate({ format: 'cjs' });
	let defaultLoader = require.extensions['.js'];
	require.extensions['.js'] = (module, filename) => {
		if (filename === filepath) {
			module._compile(output[0].code, filename);
		} else {
			defaultLoader(module, filename);
		}
	};

	delete require.cache[filepath];
	let config = require(filepath);
	config = config.default || config;
	require.extensions['.js'] = defaultLoader;
	return config;
}