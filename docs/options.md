# Nollup Options

This list provides a description of all of the options for the [CLI](./cli.md), [dev server](./dev-server.md) and [dev middleware](./dev-middleware.md). See their respective pages for the exact options each of them support.

| Type | Name | Description |
|------|------|-------------|
| ```String\|Object``` | ```config``` | Pass a Rollup configuration file. By default it will look for ```rollup.config.js``` but can be specified otherwise. If object is supported, can receive Rollup config object. |
| ```String``` | ```contentBase``` | Folder to serve static content from. Typically the content would contain additional resources like images. By default it will be looking in ```./```. |
| ```Boolean``` | ```hot``` | Enable Hot Module Replacement. Default is ```false```. |
| ```Number``` | ```port``` | Port number to run server on. Default is ```8080```. |
| ```Boolean\|String``` | ```historyApiFallback``` | If set to true, it will fallback to ```index.html``` if accessing a file that doesn't exist. You can pass a string to fallback to a different file. Default is ```false```. |
| ```String``` | ```publicPath``` | All generated files will be served from this URL. Default is ```/``` |
| ```String``` | ```environment``` | Pass environment variables that are set to ```process.ENV```. |
| ```Object``` | ```proxy``` | Object keys are paths to match. Value is the domain to proxy to. ```"api": "http://localhost:8080"``` will have a request such as ```/api/todos``` proxy to ```http://localhost:8080/api/todos```. |
| ```Boolean``` | ```verbose``` | Enable verbose logging. Default is ```false```. |
| ```Object``` | ```headers``` | Provide custom headers for Express server responses. Useful to set cors headers for the server. |
| ```String``` | ```hmrHost``` | Host to connect to for HMR. Default is ```window.location.host```. Useful for Electron environments. |
| ```Function``` | ```before``` | Receives Express app as argument. You can inject custom middleware before Nollup dev middleware. |
| ```Function``` | ```after``` | Receives Express app as argument. You can inject custom middleware after Nollup dev middleware. |
| ```Boolean``` | ```https``` | Enable https. Default is ```false```. Requires ```key``` and ```cert``` to be set |
| ```String``` | ```key``` | Path to the private key file to use with https. |
| ```String``` | ```cert``` | Path to the certificate file to use with https. |
| ```Boolean``` | ```liveBindings``` | Enable live-bindings. Default is ```false```. |