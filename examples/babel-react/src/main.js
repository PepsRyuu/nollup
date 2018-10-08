import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import HotManager from './HotManager';

let root = document.createElement('div');
document.body.appendChild(root);
let el = ReactDOM.render(<App />, root);

//#if _DEBUG
module.hot.accept(() => {
    let App = require(HotManager.getRegistered()).default;
    el = ReactDOM.render(<App />, root, el);
});
//#endif
