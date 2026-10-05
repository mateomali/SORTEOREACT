const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const rating = require('../assets/player-rating.js');
rating.configure(JSON.parse(fs.readFileSync('assets/player-rating-policy.json', 'utf8')));
const source = fs.readFileSync('src/pages/SorteoLegacyPageIsland.jsx', 'utf8');
const helpers = source.slice(0, source.indexOf('function iconPath('))
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/function TeamRadar\([\s\S]*?(?=const LINE_STRENGTH_BALANCE_WEIGHTS)/, '');
const context = vm.createContext({ console, performance, GoodfellasRating: rating });
vm.runInContext(helpers, context);
const run = code => vm.runInContext(code, context);
run(`
  function player(id, value, positions = 'DEF') {
    return normalizePlayer({ id, positions, puntuacion: value, tecnica: value,
      pase_vision: value, solidez: value, ataque: value, ritmo_stat: value,
      resistencia: value, compromiso: value, mentalidad: value, regularidad: 3.5 }, id);
  }
  const high = player(1, 5), low = player(2, 3);
  const assignments = { 1: 'DEF', 2: 'DEF' };
  const single = lineStrengthSummary([high], assignments);
  const pair = lineStrengthSummary([high, low], assignments);
`);
assert.ok(run('pair.total > single.total'), 'Adding a weaker player increases line strength');
assert.ok(run('pair.average < single.average'), 'Average quality can fall independently');
assert.equal(run('pair.total'), run('single.total + lineStrengthSummary([low], assignments).total'));
assert.equal(run('pair.count'), 2);
assert.equal(run('lineStrengthSummary([], assignments).total'), 0);
assert.equal(run('lineStrengthSummary([], assignments).quality'), 0);
run(`
  const lateral = player(3, 4, 'LAT/MED');
  const balance = lineStrengthBalance([[high], [low, lateral]], {}, [{ 1: 'DEF' }, { 2: 'DEF', 3: 'LAT' }]);
`);
assert.ok(run('balance.details.DEF.sums[1] > balance.details.DEF.sums[0]'));
assert.ok(run('balance.details.DEF.averages[1] < balance.details.DEF.averages[0]'));
assert.equal(run('balance.details.DEF.gap'), run('Math.abs(balance.details.DEF.sums[1] - balance.details.DEF.sums[0])'));
assert.equal(run('balance.details.DEF.counts[1]'), 2, 'LAT contributes to defense');
run(`
  const outOfPosition = lineStrengthSummary([high], { 1: 'DEL' });
  const unavailable = lineStrengthSummary([normalizePlayer({ ...high, availability_percent: 50 }, 1)], assignments);
`);
assert.ok(run('outOfPosition.total < single.total'), 'Preserve position penalties');
assert.ok(run('unavailable.total < single.total'), 'Preserve availability penalties');
console.log('OK additive strength, separate average, empty lines, lateral contribution, position and availability adjustments');
