(() => {
  const script = document.currentScript;
  const serverTime = Number(script?.dataset.serverTime) * 1000;
  const loadedAt = Date.now();
  const tick = () => {
    const now = (serverTime + Date.now() - loadedAt) / 1000;
    document.querySelectorAll('[data-proposal-countdown]').forEach(node => {
      const remaining = Math.max(0, Math.ceil(Number(node.dataset.proposalCountdown) - now));
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor(remaining % 3600 / 60);
      const seconds = remaining % 60;
      node.textContent = `${hours} h ${String(minutes).padStart(2, '0')} min ${String(seconds).padStart(2, '0')} s`;
      if (!remaining) window.location.reload();
    });
  };
  tick();
  window.setInterval(tick, 1000);
})();
