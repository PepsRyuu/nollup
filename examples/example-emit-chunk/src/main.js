import WorkerColor from 'web-worker:./worker-color';
import WorkerSize from 'web-worker:./worker-size';

let workerColor = new WorkerColor();
let workerSize = new WorkerSize();

workerColor.onmessage = function (e) {
    document.body.style.color = e.data.color;
}

workerSize.onmessage = function (e) {
    document.body.style.fontSize = e.data.size + 'px';
}

document.body.innerHTML = '<h1>Hello World</h1>';