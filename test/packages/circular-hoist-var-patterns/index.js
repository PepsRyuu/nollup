import { getMessage } from './other.js';

var { hello: hello_alias } = { hello: 'world' };
var [ , foo ] = [ 'blank', 'bar' ];

var { nested: { lorem: lorem_alias }} = { nested: { lorem: 'ipsum' } }

var multiA, multiB = 'multi';

export const message = hello_alias + '-' + foo + '-' + lorem_alias + '-' + multiB;

console.log(getMessage())