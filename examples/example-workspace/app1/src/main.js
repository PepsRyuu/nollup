document.body.textContent = 'Hello World - App1';

module.hot.accept(() => {
    window.location.reload();
});