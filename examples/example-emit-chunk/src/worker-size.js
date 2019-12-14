import { size } from './shared';

if (self.interval) {
    clearInterval(self.interval);
}

self.interval = setInterval(() => {
    self.postMessage({
        size
    });
}, 100);

if (module && module.hot) {
    module.hot.accept(() => {
        require(module.id);
    });
}