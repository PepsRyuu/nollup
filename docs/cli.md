# Nollup CLI

The Nollup CLI is the preferred method of using Nollup. You're probably already using ```rollup -c``` in your ```package.json``` ```scripts``` section. Nollup functions the same way, you can use ```nollup -c``` to start a web server that reads your ```rollup.config.js``` file. 

```
"scripts": {
    "start": "nollup -c"
}
```

## Flags

The following flags can be passed into Nollup CLI. You can find a full description of each of these options [here](./options.md).

* ```-c | --config [file]```
* ```--rc [file]```
* ```--content-base [folder]```
* ```--history-api-fallback [fallback]?``` 
* ```--hot```
* ```--port [port]```
* ```--verbose```
* ```--hmr-host [host]```
* ```--host [host]```
* ```--public-path [folder]```
* ```--environment [variables]```
* ```--https```
* ```--key [file]```
* ```--cert [file]```
* ```--live-bindings [mode]```
* ```--configPlugin [plugin]```

## .nolluprc

The CLI supports an external configuration using [.nolluprc](./nolluprc.md).