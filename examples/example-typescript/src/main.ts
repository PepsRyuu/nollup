import { DIGITS } from './enum';

function add (a: number, b: number) {
    return a + b;
}

let message: string = 'hello world';

document.body.textContent = message + ', Adding 1 + 2 = ' + add(DIGITS.ONE, DIGITS.TWO);