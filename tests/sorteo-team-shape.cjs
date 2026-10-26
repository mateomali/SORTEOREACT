const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

function load(file) {
  const source = fs.readFileSync(file, 'utf8');
  const helpers = source.slice(0, source.indexOf('function iconPath('))
    .replace(/^import .*;\r?\n/gm, '')
  .replace(/^export /gm, '')
    .replace(/function TeamRadar\([\s\S]*?(?=const LINE_STRENGTH_BALANCE_WEIGHTS)/, '');
  let seed = 562;
  const math = Object.create(Math);
  math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const context = vm.createContext({ console, performance, Math: math });
  vm.runInContext(fs.readFileSync('assets/player-rating.js', 'utf8'), context);
  context.GoodfellasRating.configure(JSON.parse(fs.readFileSync('assets/player-rating-policy.json', 'utf8')));
  vm.runInContext(helpers, context);
  return context;
}
const context = load('src/pages/SorteoLegacyPageIsland.jsx');
const run = code => vm.runInContext(code, context);
run(`
let nextId = 0;
function fixture(position, rating, extra = {}) {
  return normalizePlayer({ id: ++nextId, nombre: 'Fixture ' + nextId, positions: position,
    puntuacion: rating, tecnica: rating, pase_vision: rating, solidez: rating, ataque: rating,
    ritmo_stat: rating, resistencia: rating, compromiso: rating, mentalidad: rating,
    regularidad: 3.5, habilidad_arquero: rating, ...extra }, nextId);
}
function roster(n, counts = [2*n, 2*n, n]) {
  return [...Array.from({length:n}, () => fixture('ARQ', 4)),
    ...counts.flatMap((count, line) => Array.from({length:count}, (_,i) => fixture(['DEF','MED','DEL'][line], 2.9 + (i % n) * 0.3 + (i < n ? 1.2 : 0))))];
}
globalThis.control = roster(2);
`);
async function generate(players, n, avoid = []) {
  context.inputPlayers = players;
  context.inputN = n;
  context.avoid = avoid;
  const start = performance.now();
  const result = await run('generateBalancedTeams(inputPlayers,inputN,0.7,{}, {}, new Set(avoid))');
  console.log(`Generated ${n} teams / ${players.length} players in ${Math.round(performance.now() - start)} ms`);
  assert.ok(result, `Produces a valid ${n}-team result`);
  assert.equal(result.evaluation.valid, true);
  assert.equal(result.evaluation.hardConstraints.unique, true);
  assert.deepEqual(result.teams.flat().map(p=>String(p.id)).sort(),players.map(p=>String(p.id)).sort(),'Every selected player appears exactly once');
  for (const team of result.teams) {
    context.team = team;
    const assignments = run('buildTeamAssignment(team)');
    assert.equal(Object.values(assignments).filter(p => p === 'ARQ').length, 1);
    assert.equal(team.filter(p => p.reservedGoalkeeper).length, 1);
    for (const p of team) {
      assert.ok(p.posicion.split('/').some(pos => (pos === 'LAT' ? 'DEF' : pos) === (assignments[p.id] === 'LAT' ? 'DEF' : assignments[p.id])) || p.emergencyGoalkeeper || p.manualGoalkeeper || result.evaluation.hardConstraints.adaptationBudget > 0,
        `Never invent a position for ${p.id}`);
    }
  }
  return { result, ms: Math.round(performance.now() - start) };
}


(async () => {
  assert.equal(run('automaticShapePenalty({DEF:5,MED:1,DEL:1},8)'),3);
  assert.equal(run('automaticShapePenalty({DEF:3,MED:2,DEL:2},8)'),0);
  assert.equal(run('automaticShapePenalty({DEF:2,MED:3,DEL:2},8)'),0);
  assert.equal(run('isBetterDraw({hardViolations:0,shapePenalty:0,paceExcess:0,diff:2},{hardViolations:0,shapePenalty:3,paceExcess:0,diff:0})'),true);
  for (const discount of [true,false]) {
    const players = run(`roster(2,[6,4,4]).map(p=>({...p,position_rating_discount:${discount}}))`);
    const {result} = await generate(players,2);
    assert.equal(result.evaluation.shapePenalty,0,'Use normal lines ahead of total points');
    for(const team of result.teams) {
      context.team=team;
      const counts=run('pitchLineCountsFromLogical(teamLineCounts(team,buildTeamAssignment(team)))');
      assert.ok(counts.DEF<=3 && counts.MED>=2 && counts.DEL<=3,JSON.stringify(counts));
    }
    const repeated=await generate(players,2,[run('drawSignature')(result.teams)]);
    assert.equal(repeated.result.evaluation.shapePenalty,0,'Redraw must preserve normal shape');
  }
  console.log('PASS: eight-player shape and redraws with both position-discount settings');
  const screenshotRoster = run(`['DEF/MED','MED/DEL','MED','DEF/LAT','DEL','DEF','LAT/DEL','ARQ','MED','ARQ/DEF','MED/DEL','DEL','MED','LAT/MED','DEF/MED','ARQ'].map((role,i)=>fixture(role,3+(i%5)*0.3))`);
  const actual = await generate(screenshotRoster,2);
  assert.equal(actual.result.evaluation.shapePenalty,0,'Match 232 position mix must have normal lines');
  assert.equal(actual.result.evaluation.adaptationCount,0,'Use declared primary and secondary positions');
})().catch(error=>{console.error(error);process.exitCode=1;});
