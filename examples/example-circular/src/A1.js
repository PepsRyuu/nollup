import A2 from './A2.js';
import B from './B.js';
 
export function create_wrapper_print (message) {
    return () => console.log('wrapper-a1', message);
}

B();

export default () => {
    A2();
}