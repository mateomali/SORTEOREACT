const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/pages/SorteoLegacyPageIsland.jsx', 'utf8');
const helpers = source.slice(0, source.indexOf('function iconPath('))
  .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '')
  .replace(/function TeamRadar\([\s\S]*?(?=const LINE_STRENGTH_BALANCE_WEIGHTS)/, '');
const context = vm.createContext({ console, performance });
vm.runInContext(fs.readFileSync('assets/player-rating.js', 'utf8'), context);
context.GoodfellasRating.configure(JSON.parse(fs.readFileSync('assets/player-rating-policy.json', 'utf8')));
vm.runInContext(helpers, context);
const run = code => vm.runInContext(code, context);
run(`
  const roles = ['ARQ', 'DEF', 'DEF', 'MED', 'MED', 'DEL', 'DEL'];
  const teams = [0,1].map(t => roles.map((position, i) => normalizePlayer({
    id: t * 10 + i + 1, nombre: 'Jugador ' + t + '-' + i, positions: position,
    puntuacion: 4, tecnica: 4, pase_vision: 4, solidez: 4, ataque: 4,
    ritmo_stat: i === 0 ? 1 : i === 1 || i === 3 ? (t === 0 ? 1 : 3) : 5,
    resistencia: 4, compromiso: 4, mentalidad: 4, regularidad: 3.5,
  }, i)));
  const positions = Object.assign({}, ...teams.map(team => Object.fromEntries(team.map(p => [p.id, getPrimaryPlayerPosition(p)]))));
  const initial = scoreTeams(teams, {}, positions);
  const separated = withSeparatedPairs(teams, [['2', '4']]);
`);
assert.equal(run('initial.slowSpread'), 0, 'Old slow counts see no imbalance');
assert.equal(run('initial.verySlowSpread'), 2, 'Detect concentration of the very slow');
assert.equal(run('initial.mobilityGap'), 8, 'Intensity exposes the hidden gap');
assert.equal(run('initial.mobilitySummaries[0].verySlow'), 2, 'Goalkeeper excluded');
assert.equal(run('separationViolations(separated)'), 1);
assert.equal(run('scoreTeams(separated, {}, positions).valid'), false);
assert.equal(run('normalizeSeparatedPairs([[2,4],[4,2],[2,2]]).length'), 1);
assert.equal(run('isBetterDraw({...initial, verySlowSpread:0, diff:initial.diff+0.1}, initial)'), true);
assert.equal(run('drawsAreNear({...initial, verySlowSpread:0}, initial)'), false, 'Random diversity must not undo mobility gains');
run(`
  const sameSector = teams.map(team => team.slice());
  sameSector[0][2] = {...sameSector[0][2], ritmo_stat:1};
  const sectorBalance = mobilityBalance(sameSector, positions);
  const suggestions = mobilitySwapSuggestions(teams, positions);
`);
assert.ok(run('sectorBalance.mobilitySectorCost > 0'));
assert.ok(run('suggestions.length > 0'), 'Find actionable swaps');
assert.ok(run('suggestions.every(s => s.after.valid && mobilityImproves(s.after,s.before))'));
assert.ok(run('suggestions.every(s => s.after.diff <= Math.max(2,s.before.diff) + 1e-6)'));
assert.ok(run('suggestions.every(s => s.after.lineStrengthSpread <= Math.max(2,s.before.lineStrengthSpread) + 1e-6)'));
(async () => {
  const result = await run('generateBalancedTeams(separated.flat(),2,2,{}, {})');
  assert.ok(result, 'Generate with separation');
  context.result = result;
  assert.equal(run('separationViolations(result.teams)'), 0);
  assert.equal(result.evaluation.verySlowSpread, 0);
  const impossible = await run('generateBalancedTeams(withSeparatedPairs(teams, [[2,4],[2,12],[4,12]]).flat(),2,2,{}, {})');
  assert.equal(impossible, null, 'Impossible separation must fail rather than silently relax');
  for (const n of [3, 4]) {
    context.n = n;
    const multi = await run(`(() => {
      const roles = ['ARQ','DEF','DEF','MED','DEL'];
      const squads = Array.from({length:n}, (_,t) => roles.map((position,i) => normalizePlayer({
        id:t*10+i+1, positions:position, puntuacion:4, ritmo_stat:4, resistencia:4, regularidad:3.5,
      },i)));
      return generateBalancedTeams(withSeparatedPairs(squads, [[2,3]]).flat(),n,2,{},{});
    })()`);
    assert.ok(multi, `Generate ${n} teams with separation`);
    context.multi = multi;
    assert.equal(run('separationViolations(multi.teams)'), 0);
  }
  console.log('OK mobility intensity, sector concentration, swaps, separation enforcement and impossible rules');
})().catch(error => { console.error(error); process.exitCode = 1; });

assert.equal(run("normalizeSeparatedPairs([[1,2,3],[3,2,1],[1,2,3,4],[1,2,2]]).length"), 2);
assert.equal(run("separationViolations(withSeparatedPairs([[{id:1},{id:3}], [{id:2}], [{id:4}]], [[1,2,3,4]]))"), 1);
assert.equal(run("separationViolations(withSeparatedPairs([[{id:1}], [{id:2}], [{id:3}], [{id:4}]], [[1,2,3,4]]))"), 0);
