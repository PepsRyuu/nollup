import C, { c_fn } from './C.js';

export var b_fn = function () {
    return c_fn();
}

export default C;