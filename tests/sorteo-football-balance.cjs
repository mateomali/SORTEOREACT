const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

function load(file) {
  const source = fs.readFileSync(file, 'utf8');
  const helpers = source.slice(0, source.indexOf('function iconPath('))
    .replace(/^import .*;\r?\n/gm, '')
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
  const report = [];
  for (const n of [2,3,4]) {
    const players = run(`roster(${n})`);
    const { result, ms } = await generate(players,n);
    for (const line of ['DEF','MED','DEL']) assert.ok(result.evaluation.lineBalance.details[line].countGap <= 1);
    report.push({ scenario: `${n} teams`, ms, candidates: result.evaluatedCandidates, metrics: result.evaluation.teamMetrics,
      gaps: Object.fromEntries(Object.entries(result.evaluation.lineBalance.details).map(([k,v])=>[k,v.gap])), totalGap:result.evaluation.totalBalance });
    // Repeated draws preserve exactly one real keeper and remain within tolerance.
    const previous = run('drawSignature')(result.teams);
    const again = await generate(players,n,[previous]);
    context.drawA = again.result.evaluation;
    context.bestA = again.result.bestEvaluation;
    assert.equal(run('drawsAreNear(drawA,bestA)'), true);
    if (again.result.topSolutions > 1) assert.notEqual(run('drawSignature')(again.result.teams), previous);
  }
  const uneven = await generate(run('roster(3,[7,5,6])'),3);
  assert.ok(uneven.result.evaluation.diff <= 2, 'Uneven natural-position counts must prioritize the total gap over equal line headcounts');
  report.push({scenario:'7 DEF / 5 MED / 6 DEL',ms:uneven.ms,counts:Object.fromEntries(Object.entries(uneven.result.evaluation.lineBalance.details).map(([k,v])=>[k,v.counts]))});

  run(`
    globalThis.bad = [[],[]]; globalThis.good = [[],[]];
    for (const line of ['ARQ','DEF','MED','DEL']) {
      const count = line === 'ARQ' || line === 'DEL' ? 1 : 2;
      for(let i=0;i<count;i++) {
        const high = fixture(line,line === 'ARQ' || line === 'DEL' ? 4 : 5.5);
        const low = fixture(line,line === 'ARQ' || line === 'DEL' ? 4 : 2.5);
        bad[line === 'MED' ? 1 : 0].push(high); bad[line === 'MED' ? 0 : 1].push(low);
        good[i % 2].push(high); good[1 - i % 2].push(low);
      }
    }
    globalThis.badEval=scoreTeams(bad,{},{});globalThis.goodEval=scoreTeams(good,{},{});
  `);
  assert.equal(run('isBetterDraw(goodEval,badEval)'),true,'Reject cross-line cancellation with equal totals');
  const balanced = await generate(run('bad.flat()'),2);
  assert.ok(balanced.result.evaluation.lineBalance.details.DEF.gap < 1e-6);
  assert.ok(balanced.result.evaluation.lineBalance.details.MED.gap < 1e-6);
  report.push({scenario:'Cross-line cancellation',before:{DEF:context.badEval.lineBalance.details.DEF.gap,MED:context.badEval.lineBalance.details.MED.gap,total:context.badEval.totalBalance},
    after:{DEF:balanced.result.evaluation.lineBalance.details.DEF.gap,MED:balanced.result.evaluation.lineBalance.details.MED.gap,total:balanced.result.evaluation.totalBalance},ms:balanced.ms});

  // Pace takes precedence over line strength and primary-position preference.
  run(`
    globalThis.paceBad = {...goodEval, paceExcess: 1, adaptationCount: 0, lineQualityCost: 0};
    globalThis.paceGood = {...goodEval, paceExcess: 0, adaptationCount: 1, lineQualityCost: 100};
  `);
  assert.equal(run('isBetterDraw(paceGood,paceBad)'), true, 'Mix slow players before preserving natural positions');
  const slowRoster = run("roster(3).map((p,i)=>({...p,ritmo_stat:i>=3 && i<9 ? 2 : 5}))");
  const paceDraw = await generate(slowRoster,3);
  assert.ok(paceDraw.result.evaluation.slowSpread <= 1, 'Spread six slow defenders across three teams');
  for (const team of paceDraw.result.teams) {
    context.team = team;
    const counts = run('teamLineCounts(team,buildTeamAssignment(team))');
    assert.ok(counts.DEF + counts.LAT >= 2 && counts.MED >= 1 && counts.DEL >= 1);
  }

  const baseline = JSON.parse(fs.readFileSync('tests/fixtures/football-balance-baseline.json','utf8'));
  context.baseline = baseline;
  const comparisonPlayers = run('Object.entries(baseline.ratingsByPosition).flatMap(([line,values])=>values.map(value=>fixture(line,value)))');
  context.comparisonPlayers = comparisonPlayers;
  const before = run('scoreTeams(baseline.previousTeamsByIndex.map(indices=>indices.map(index=>comparisonPlayers[index])),{}, {})');
  const after = await generate(comparisonPlayers,2);
  assert.ok(after.result.evaluation.diff <= before.diff + 1e-6, 'Total-gap priority must improve or preserve the previous draw total gap');
  report.push({scenario:'Previous algorithm vs new algorithm; unequal keepers',
    before:{gaps:baseline.previousGaps,totalAverageGap:before.totalBalance},
    after:{gaps:Object.fromEntries(Object.entries(after.result.evaluation.lineBalance.details).map(([k,v])=>[k,v.gap])),totalAverageGap:after.result.evaluation.totalBalance},ms:after.ms});

  // Exhaustive oracle independent of the generator: all non-equivalent bipartitions.
  context.small = run('roster(2,[4,2,2])');
  const exact = await generate(context.small,2);
  const oracle = run(`(() => {let best=null;for(let mask=1;mask<(1<<small.length);mask+=2){
    const teams=[small.filter((p,i)=>mask&(1<<i)),small.filter((p,i)=>!(mask&(1<<i)))];
    if(teams[0].length!==small.length/2 || !teamsFitFormationRules(teams,small.length/2))continue;
    const e=scoreTeams(teams,{},{});if(isBetterDraw(e,best))best=e;
  }return best;})()`);
  assert.ok(exact.result.exhaustive);
  assert.ok(Math.abs(exact.result.bestEvaluation.lineQualityCost-oracle.lineQualityCost)<1e-6);
  assert.ok(Math.abs(exact.result.bestEvaluation.totalBalance-oracle.totalBalance)<1e-6);

  const fewAttack = await generate(run('roster(3,[6,9,0])'),3);
  assert.equal(fewAttack.result.evaluation.hardConstraints.shortage.DEL,1);
  for(const team of fewAttack.result.teams) {
    context.team=team;assert.equal(Object.values(run('buildTeamAssignment(team)')).includes('DEL'),true);
  }
  const flexible = await generate(run("roster(3).map(p=>p.posicion==='DEF'?{...p,posicion:'DEF/LAT'}:p.posicion==='DEL'?{...p,posicion:'MED/DEL'}:p)"),3);
  assert.ok(flexible.result.evaluation.valid);
  const overlapping = await generate(run("roster(3,[12,6,3]).filter(p=>p.posicion!=='DEL').map(p=>p.posicion==='MED'?{...p,posicion:'MED/DEL'}:p)"),3);
  assert.equal(overlapping.result.evaluation.hardConstraints.shortage.MED,0,'Secondary positions cover midfield without shortage');
  const stars = await generate(run("(()=>{let index=0;return roster(3).map(p=>p.posicion==='DEF'?fixture('DEF',[6,5.8,5.7,3.2,3,2.9][index++]):p)})()"),3);
  assert.equal(stars.result.evaluation.eliteExcess,0,'Do not accumulate natural-line stars');
  // Selected field keepers are explicit definitions, not silent conversions.
  const manual = await generate(run("roster(3).map(p=>p.posicion==='ARQ'?{...p,posicion:'MED',manualGoalkeeper:true}:p)"),3);
  assert.ok(manual.result.evaluation.hardConstraints.goalkeeperRule);
  const excess = await generate(run("roster(3).map((p,i)=>i===3?{...p,posicion:'DEF/ARQ',manualGoalkeeper:true}:p)"),3);
  assert.ok(excess.result.evaluation.valid);
  const shortage = run("prepareEmergencyGoalkeepers(roster(3).map((p,i)=>i===2?{...p,posicion:'DEL'}:p),3)");
  assert.equal(shortage.emergencyGoalkeepers.length,1);
  await generate(shortage.players,3);
  context.duplicate = [...run('roster(2)')];context.duplicate[1]=context.duplicate[0];
  assert.equal(await run('generateBalancedTeams(duplicate,2,0.7,{}, {})'),null);

  fs.mkdirSync('.tmp',{recursive:true});
  fs.writeFileSync('.tmp/sorteo-football-results.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  console.log('OK constraints, repeated 2/3/4-team draws, odd line counts, cross-line balance, oracle, permitted positions, emergency, extra keepers and unique roster');
})().catch(error=>{console.error(error);process.exitCode=1;});
