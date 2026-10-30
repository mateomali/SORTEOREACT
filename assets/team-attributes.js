// Enhance the shared team summaries, including dynamically rendered lineups.
(() => {
  if (typeof document === 'undefined' || globalThis.goodfellasTeamAttributesStarted) return;
  globalThis.goodfellasTeamAttributesStarted = true;
  const selector = '.team-characteristics-stats, .sorteo-team-stats, .totals-breakdown';
  const update = () => {
    document.querySelectorAll(selector).forEach(container => {
      const chart = container.querySelector(':scope > div') || container;
      const entries = [...chart.children].filter(node => node.tagName === 'SPAN');
      if (!entries.length) return;
      chart.classList.add('gf-team-attribute-chart');
      chart.setAttribute('aria-label', 'Atributos del equipo, escala de 0 a 6');
      entries.forEach(entry => {
        const match = entry.textContent.trim().match(/^(.+?)\s+(\d+(?:[.,]\d+)?)$/);
        if (!match) return;
        const value = Math.max(0, Math.min(6, Number(match[2].replace(',', '.'))));
        entry.classList.add('gf-team-attribute-bar');
        entry.style.setProperty('--attribute-width', `${value / 6 * 100}%`);
        entry.setAttribute('role', 'meter');
        entry.setAttribute('aria-label', match[1]);
        entry.setAttribute('aria-valuemin', '0');
        entry.setAttribute('aria-valuemax', '6');
        entry.setAttribute('aria-valuenow', String(value));
      });
    });
  };
  let pending = false;
  const observer = new MutationObserver(records => {
    const relevant = records.some(record => {
      const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      if (target?.closest(selector)) return true;
      return [...record.addedNodes].some(node => node.nodeType === 1 && (node.matches(selector) || node.querySelector(selector)));
    });
    if (!relevant) return;
    if (pending) return;
    pending = true;
    queueMicrotask(() => { pending = false; update(); });
  });
  observer.observe(document.documentElement, {childList:true, subtree:true, characterData:true});
  update();
})();
