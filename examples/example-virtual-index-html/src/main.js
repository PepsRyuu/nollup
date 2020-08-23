import './main.css';

let el = document.createElement('p');
el.textContent = 'HTML plugin generated the following:';

let pre = document.createElement('pre');
pre.textContent = new XMLSerializer().serializeToString(document);

document.body.appendChild(el);
document.body.appendChild(pre);