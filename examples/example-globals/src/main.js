import jquery from 'jquery';
import _ from 'underscore';
import { max } from 'maths';
import document, { querySelector } from 'document';
import { pathname } from 'location';

jquery('body').text('Hello World');
console.log(max(1,2,3));
console.log(_);
console.log(document, querySelector);
console.log(pathname);