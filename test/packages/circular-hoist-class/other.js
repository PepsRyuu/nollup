import { HelloImpl } from './index.js';

export const impl = 'hello';

export function Hello () {
    return HelloImpl();
}