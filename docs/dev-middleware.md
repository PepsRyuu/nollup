# Nollup Dev Middleware

The dev middleware is an ExpressJS middleware that can be plugged into an existing ExpressJS server. It is intended for situations where you want full control over the Express server and its configuration.

The dev middleware can be imported by using the following:

```
let NollupDevMiddleware = require('nollup/lib/dev-middleware');
```

Once imported, you can plug the middleware into your existing ExpressJS server:

```
app.use(NollupDevMiddleware(app, rollupConfig, {
    hot: true,
    contentBase: './public',
    ...
}));
```

## Options

The following options can be passed into Nollup Dev Middleware. You can find a full description of each of these options [here](./options.md).

* ```Boolean hot```
* ```Boolean verbose```
* ```String headers```
* ```String hmrHost```
* ```String contentBase```
* ```String publicPath```
