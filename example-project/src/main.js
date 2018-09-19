import { render, h } from 'preact';
import App from './App';
import HotManager from './HotManager';

window.h = h;

let root = document.createElement('div');
document.body.appendChild(root);
let el = render(<App />, root);

//#if _DEBUG
module.hot.accept(() => {
    let App = require(HotManager.getRegistered()).default;
    el = render(<App />, root, el);
});
//#endif
