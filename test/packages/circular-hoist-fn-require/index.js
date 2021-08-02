import { impl } from './other';

async function hello () {
    let dynamic = await import('./dynamic');
    console.log(impl + '-' + dynamic.default);
}

export { hello };