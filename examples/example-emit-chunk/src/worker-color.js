import { color } from './shared';

if (self.interval) {
    clearInterval(self.interval);
}

self.interval = setInterval(() => {
    self.postMessage({
        color
    });
}, 100);

if (module && module.hot) {
    module.hot.accept(() => {
        require(module.id);
    });
}