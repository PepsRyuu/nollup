import { render, h } from 'preact';
import App from './App';

window.h = h;

let root = document.querySelector('#app');
document.body.appendChild(root);
render(<App />, root);