(() => {
  const showToast = (message, type = 'info') => {
    if (!message) return;
    let stack = document.querySelector('[data-toast-stack]');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'app-toast-stack';
      stack.setAttribute('data-toast-stack', '');
      document.body.appendChild(stack);
    }

    const toast = document.createElement('div');
    toast.className = `app-toast app-toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.textContent = message;
    stack.appendChild(toast);

    window.setTimeout(() => {
      toast.classList.add('is-leaving');
      window.setTimeout(() => toast.remove(), 220);
    }, type === 'error' ? 4200 : 2600);
  };

  const setBusy = (el, busy) => {
    if (!el) return;
    el.classList.toggle('is-partial-loading', busy);
    el.setAttribute('aria-busy', busy ? 'true' : 'false');
  };

  window.GoodfellasApp = Object.assign(window.GoodfellasApp || {}, {
    setBusy,
    showToast,
  });
})();
