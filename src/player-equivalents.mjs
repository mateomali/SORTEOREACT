// Minimum-cost one-to-one assignment, including unmatched players in unequal teams.
export function comparePlayers(left, right) {
  const size = Math.max(left.length, right.length);
  const cost = (a, b) => {
    if (!a || !b) return 100;
    const positionCost = a.position === b.position ? 0
      : a.line === b.line ? 2 : a.position === 'ARQ' || b.position === 'ARQ' ? 30 : 8;
    return positionCost + Math.abs(a.rating - b.rating);
  };
  const u = Array(size + 1).fill(0), v = [...u], p = [...u], way = [...u];
  for (let i = 1; i <= size; i++) {
    p[0] = i;
    let j0 = 0;
    const min = Array(size + 1).fill(Infinity), used = Array(size + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity, j1 = 0;
      for (let j = 1; j <= size; j++) {
        if (used[j]) continue;
        const current = cost(left[i0 - 1], right[j - 1]) - u[i0] - v[j];
        if (current < min[j]) { min[j] = current; way[j] = j0; }
        if (min[j] < delta) { delta = min[j]; j1 = j; }
      }
      for (let j = 0; j <= size; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else min[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const previous = way[j0]; p[j0] = p[previous]; j0 = previous; } while (j0);
  }
  const rows = [];
  for (let j = 1; j <= size; j++) {
    const a = left[p[j] - 1] || null, b = right[j - 1] || null;
    rows.push({ left: a, right: b, difference: (a?.rating || 0) - (b?.rating || 0) });
  }
  rows.sort((a, b) => (b.left?.rating || 0) - (a.left?.rating || 0));
  let cumulative = 0;
  return rows.map(row => ({ ...row, cumulative: cumulative += row.difference }));
}
