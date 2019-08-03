import Message, { module_id } from './message-a';

let el = document.createElement('div');
el.textContent = Message;
document.body.appendChild(el);

if (module && module.hot) {
    module.hot.accept(() => {
        el.textContent = require(module_id).default;
    });
}