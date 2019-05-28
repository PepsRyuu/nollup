import A2 from './A2.js';
import B from './B.js';
 
export function create_wrapper_print (message) {
    return () => message + ' - A1';
}

B(); // should fail if circular not implemented correctly.

export default () => {
    return A2();
}