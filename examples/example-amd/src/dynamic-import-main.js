import('./my-dynamic-module').then(mod => {
    let el = document.createElement('div');
    el.textContent = mod.default;
    document.body.appendChild(el);
});