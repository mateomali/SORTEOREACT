import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { restorePlayerExchanges } = await server.ssrLoadModule('/src/pages/SorteoLegacyPageIsland.jsx');
  const players = [1, 2, 3, 4, 5, 6].map(id => ({ id, nombre: String(id) }));
  // A/B, then A/C depend on each other; D/E is independent.
  const record = (a, b, at, bt, ai, bi) => ({ sourceKey: String(a), targetKey: String(b), sourceTeam: at, targetTeam: bt, sourceIndex: ai, targetIndex: bi, sourcePosition: 'DEF', targetPosition: 'MED' });
  const history = [record(1, 3, 0, 1, 0, 0), record(1, 5, 1, 2, 0, 0), record(2, 4, 0, 1, 1, 1)];
  const current = [[players[2], players[3]], [players[4], players[1]], [players[0], players[5]]];
  const restored = restorePlayerExchanges(current, {}, history, '1');
  assert.deepEqual(restored.teams.map(team => team.map(p => p.id)), [[1, 4], [3, 2], [5, 6]]);
  assert.deepEqual(restored.exchanges, [history[2]]);
  assert.equal(restored.assignments['1'], 'DEF');
  assert.equal(restored.assignments['3'], 'MED');
  assert.equal(new Set(restored.teams.flat().map(p => p.id)).size, 6);
  console.log('Dependent exchanges restored; independent exchange preserved.');
} finally {
  await server.close();
}

