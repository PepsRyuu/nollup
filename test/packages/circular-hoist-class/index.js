import { impl, Hello } from './other.js';

var Base = class {};

class HelloImplImpl extends Base {
    getMessage () {
        return impl;
    }
}

function HelloImpl () {
    return new HelloImplImpl().getMessage();
}

export { HelloImpl };

console.log(Hello())