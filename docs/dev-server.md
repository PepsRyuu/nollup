# Nollup Dev Server

The dev server provides a function that when called, will start an ExpressJS web server and the Nollup compiler. It's intended to be used by developers who need to programmatically control when Nollup is started and run additional code around it. 

The dev server can be imported into your startup script using the following:

```
let NollupDevServer = require('nollup/lib/dev-server');
```

Once imported, you can call it anywhere you want, and it will start compiling and serving:

```
NollupDevServer({
    hot: true,
    port: 9001,
    ...
});
```

## Options

The following options can be passed into Nollup Dev Server. You can find a full description of each of these options [here](./options.md).

* ```Function before```
* ```Function after```
* ```Object config```
* ```Boolean hot```
* ```Number port```
* ```Boolean verbose```
* ```String hmrHost```
* ```String contentBase```
* ```String publicPath```
* ```Object proxy```
* ```Boolean|String historyApiFallback```

## .nolluprc

The dev server supports an external configuration using [.nolluprc](./nolluprc.md).