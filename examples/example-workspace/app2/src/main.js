document.body.textContent = 'Hello World - App2';

module.hot.accept(() => {
    window.location.reload();
});