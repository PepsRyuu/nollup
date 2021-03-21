import { counter, increment }  from './counter';

setInterval(() => {
    increment();
    document.body.textContent = 'Counter: ' + counter;
}, 1000);