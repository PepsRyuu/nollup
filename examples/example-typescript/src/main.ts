function add (a: number, b: number) {
    return a + b;
}

let message: string = 'hello world';

document.body.textContent = message + ', Adding 1 + 2 = ' + add(1, 2);