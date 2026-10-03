import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
globalThis.GoodfellasRating = require('../assets/player-rating.js');
globalThis.GoodfellasRating.configure(JSON.parse(readFileSync('assets/player-rating-policy.json', 'utf8')));

// Exercise the page's real rating helpers without changing its public exports.
const server = await createServer({
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
  plugins: [{
    name: 'position-penalty-test-exports',
    enforce: 'pre',
    transform(code, id) {
      if (id.replaceAll('\\', '/').endsWith('/src/pages/SorteoLegacyPageIsland.jsx')) {
        return `${code}\nexport { positionPenaltyPercent, CompactPlayerCard, fieldLineMinimum, fieldLineCountsFitLimits, getFormationCandidates };`;
      }
    },
  }],
});

try {
  const { positionPenaltyPercent, CompactPlayerCard, fieldLineMinimum, fieldLineCountsFitLimits } = await server.ssrLoadModule('/src/pages/SorteoLegacyPageIsland.jsx');
  assert.equal(fieldLineMinimum('MED', 6), 1);
  assert.equal(fieldLineMinimum('MED', 7), 1);
  assert.equal(fieldLineCountsFitLimits({ ARQ: 1, DEF: 2, LAT: 0, MED: 1, DEL: 2 }, 6), true);
  assert.equal(fieldLineCountsFitLimits({ ARQ: 1, DEF: 2, LAT: 0, MED: 1, DEL: 3 }, 7), true);
  const player = {
    nombre: 'PRUEBA', posicion: 'MED/DEL', puntuacion: 4,
    tecnica: 4, pase_vision: 4, ritmo_stat: 4, resistencia: 4,
    solidez: 4, ataque: 4, compromiso: 4, mentalidad: 4, regularidad: 3.5,
    habilidad_arquero: 2, photo_path: '/assets/images/player-placeholder.png',
  };
  assert.equal(positionPenaltyPercent(player, 'MED', 9), 0, 'Primary position has no discount');
  assert.equal(positionPenaltyPercent(player, 'DEL', 9), 5, 'Lower-rated secondary position shows its discount');
  assert.equal(positionPenaltyPercent(player, 'DEF', 9), 10, 'Out-of-position discount is preserved');
  assert.equal(positionPenaltyPercent(player, 'DEL', 6), 5, 'Secondary-position discount applies in small teams too');
  assert.equal(positionPenaltyPercent(player, 'DEF', 6), 10, 'Out-of-position discount applies in small teams too');
  assert.equal(positionPenaltyPercent(player, '', 9), 0, 'Missing position has no discount');
  assert.equal(positionPenaltyPercent({ ...player, ataque: 6, pase_vision: 1 }, 'DEL', 9), 0, 'A stronger secondary position has no discount');

  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const card = (assignedPosition) => renderToStaticMarkup(createElement(CompactPlayerCard, { player, assignedPosition, teamSize: 9 }));
  assert.match(card('DEL'), /Descuento por posicion: -5%/);
  assert.doesNotMatch(card('MED'), /sorteo-position-penalty/);
  console.log('PASS: primary, secondary, stronger secondary, out-of-position, small teams, and rendered indicators');

  if (process.argv.includes('--preview')) {
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir('.tmp', { recursive: true });
    await writeFile('.tmp/position-penalty-preview.html', `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><base href="/"><link rel="stylesheet" href="/assets/tailwind.css"><link rel="stylesheet" href="/assets/contrast-overrides.css"></head><body class="page-sorteo-legacy"><main class="content"><div class="sorteo-react-page"><div class="team-formation" style="height:280px;display:flex;align-items:center;justify-content:center;gap:8px">${['MED', 'DEL', 'DEF', 'DEL'].map(card).join('')}</div></div></main></body></html>`);
  }
} finally {
  await server.close();
}
