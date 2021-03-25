## .nolluprc

Configuration file that can be used to pass configuration instead of as flags through the CLI. 

```
{
    "hot": true,
    "contentBase": "./public"
}
```

A JavaScript file called ```.nolluprc.js``` or specified file can be used instead.

```
module.exports = {
    hot: true,
    contentBase: './public'
};
```

See "Nollup Options" for list of available options.