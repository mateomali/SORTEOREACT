/* Shared browser/Node rating engine. PHP supplies the effective policy on each page. */
(function (root) {
  let configured;
  let lastElement, lastText, cachedPolicy;
  function policy() {
    const element = typeof document !== 'undefined' && document.querySelector('[data-player-rating-policy]');
    if (!element) return configured;
    if (element !== lastElement || element.textContent !== lastText) {
      lastElement = element;
      lastText = element.textContent;
      cachedPolicy = JSON.parse(lastText);
    }
    return cachedPolicy;
  }
  const clamp = value => Math.max(1, Math.min(6, value));
  function stat(value, fallback = 3) {
    const number = value === null || value === '' || value === undefined ? fallback : Number(value);
    return clamp(Math.round((Number.isFinite(number) ? number : fallback) * 10) / 10);
  }
  function fit(positions, position, ignore = false) {
    if (ignore || !position || positions[0] === position) return 1;
    return positions[1] === position ? policy().secondaryFit : policy().outsideFit;
  }
  function base(stats, position, weights = policy().weights) {
    const row = weights[position] || weights.MED;
    let total = 0;
    let sum = 0;
    for (const [field, weight] of Object.entries(row)) {
      total += stat(stats[field]) * weight;
      sum += weight;
    }
    return sum > 0 ? total / sum : 3;
  }
  function regularity(value, stats) {
    const p = policy();
    return clamp(value * (1 + (stat(stats.regularity, p.regularityCenter) - p.regularityCenter) / p.regularityDivisor));
  }
  function position(stats, role, positions = [role], ignore = false, weights) {
    return Math.round(regularity(base(stats, role, weights), stats) * fit(positions, role, ignore) * 10) / 10;
  }
  function card(value) {
    const rating = clamp(Number(value) || 1);
    const anchors = policy().anchors;
    for (let i = 0; i < anchors.length - 1; i++) {
      const [x, y] = anchors[i];
      const [nextX, nextY] = anchors[i + 1];
      if (rating <= nextX) return Math.round(y + (nextY - y) * (rating - x) / (nextX - x));
    }
    return 99;
  }
  const api = { configure: value => { configured = value; }, policy, stat, fit, base, regularity, position, card };
  root.GoodfellasRating = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
