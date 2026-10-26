const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

const source = fs.readFileSync('src/pages/SorteoLegacyPageIsland.jsx', 'utf8');
const helpers = source.slice(0, source.indexOf('function iconPath('))
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/^export /gm, '')
  .replace(/function TeamRadar\([\s\S]*?(?=const LINE_STRENGTH_BALANCE_WEIGHTS)/, '');
let seed = 12851;
const math = Object.create(Math);
math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const context = vm.createContext({ console, performance, Math: math });
vm.runInContext(fs.readFileSync('assets/player-rating.js', 'utf8'), context);
context.GoodfellasRating.configure(JSON.parse(fs.readFileSync('assets/player-rating-policy.json', 'utf8')));
vm.runInContext(helpers, context);
const run = code => vm.runInContext(code, context);
run(`
let fixtureId = 0;
function fixture(pos, rating) {
  return normalizePlayer({ id: ++fixtureId, nombre: 'Jugador ' + fixtureId, positions: pos,
    puntuacion: rating, tecnica: rating, pase_vision: rating, solidez: rating, ataque: rating,
    ritmo_stat: 5, resistencia: 4, compromiso: rating, mentalidad: rating,
    regularidad: 4, habilidad_arquero: rating }, fixtureId);
}
function makeRoster(n, fieldCounts = [2*n,n,n]) {
  return [...Array.from({length:n}, () => fixture('ARQ', 4)),
    ...fieldCounts.flatMap((count, line) => Array.from({length:count}, (_, i) => fixture(['DEF','MED','DEL'][line], 3.2 + (i % n)*0.4)))];
}
function makePots(players, sizes) {
  let start = 0;
  return sizes.map((size, index) => ({name: 'Pote ' + (index+1), playerIds: players.slice(start, start += size).map(playerKey)}));
}
`);

async function generate(players, n, pots, avoid = []) {
  Object.assign(context, { input: players, n, pots, avoid });
  const result = await run('generateBalancedTeams(input, n, 2, {}, {}, new Set(avoid), { pots })');
  assert.ok(result, `Produces ${n} teams respecting arbitrary pots`);
  assert.equal(result.evaluation.valid, true);
  assert.equal(run('teamsRespectPots')(result.potReferenceTeams || result.teams, run('activeDrawPots')(pots, players)), true, 'Initial draw starts with balanced pot quotas');
  assert.ok(result.evaluation.potExchangePenalty >= 0);
  assert.equal(run('teamsSeparateTwoPlayerPots')(result.teams, pots), true);
  assert.deepEqual(Array.from(result.teams.flat(), p => String(p.id)).sort(), Array.from(players, p => String(p.id)).sort());
  for (const team of result.teams) {
    assert.equal(team.length, players.length / n);
    assert.equal(team.filter(p => p.reservedGoalkeeper).length, 1);
  }
  return result;
}

(async () => {
  const autoRoster = run("[fixture('DEF',4.5),fixture('DEF',4.4),fixture('DEF',3.1),fixture('DEF',3),fixture('MED',4.5),fixture('MED',4.4),fixture('DEL',2.5),fixture('DEL',2.4)]");
  const automatic = run('buildAutomaticDrawPots')(autoRoster, 2, 5, [{name:'Guardados',playerIds:[String(autoRoster[0].id),'99999']}]);
  const activeAutomatic = automatic.filter(pot => !pot.playerIds.includes('99999'));
  const byId = new Map(autoRoster.map(player => [String(player.id), player]));
  assert.equal(new Set(activeAutomatic.flatMap(pot => pot.playerIds)).size, autoRoster.length);
  const positions=[];
  for(const pot of activeAutomatic) {
    const members=pot.playerIds.map(id=>byId.get(id));
    assert.equal(new Set(members.map(p=>p.posicion)).size,1,'Automatic pots use one primary position');
    const scores=members.map(p=>run('playerCardRating')(p.base_puntuacion));
    assert.ok(Math.max(...scores)-Math.min(...scores)<=5,'Automatic pots respect the configured general gap');
    positions.push(members[0].posicion);
  }
  assert.deepEqual(positions,['DEF','DEF','MED','DEL'],'Role groups stay together even when a later role has a higher score');
  const keeperRoster = run("[fixture('ARQ',1),fixture('ARQ',6),fixture('ARQ',3),fixture('DEF',4), {...fixture('MED',5), manualGoalkeeper:true}]");
  const keeperPots = run('buildAutomaticDrawPots')(keeperRoster, 2, 0);
  const keeperIds = Array.from(keeperRoster).filter(p => p.posicion === 'ARQ' || p.manualGoalkeeper).map(p => String(p.id)).sort();
  assert.equal(keeperPots.filter(pot => pot.name.startsWith('ARQ')).length,1,'All goalkeepers use a single pot even with zero score tolerance');
  assert.deepEqual(Array.from(keeperPots[0].playerIds).sort(),keeperIds,'Includes manual goalkeepers and more keepers than teams');
  const flexibleRoster = run("[fixture('DEL/MED',4),fixture('MED',4.1),fixture('MED',4),fixture('DEF',2)]");
  const flexiblePots = run('buildAutomaticDrawPots')(flexibleRoster,2,5);
  const midfield = flexiblePots.find(pot => pot.playerIds.includes(String(flexibleRoster[1].id)));
  assert.ok(midfield.playerIds.includes(String(flexibleRoster[0].id)), 'Isolated forward joins compatible midfield pot through secondary position');
  assert.equal(new Set(flexiblePots.flatMap(pot=>pot.playerIds)).size, flexibleRoster.length, 'Fallback preserves each player exactly once');
  const incompatibleRoster = run("[fixture('DEL/MED',6),fixture('MED',2),fixture('MED',2)]");
  const incompatiblePots = run('buildAutomaticDrawPots')(incompatibleRoster,2,5);
  assert.ok(incompatiblePots.every(pot => pot.playerIds.length >= 2), 'Minimum pot size overrides gap when no compatible alternative exists');
  const sharedRoster = run("[fixture('DEL/MED',4),fixture('DEF/MED',4)]");
  const sharedPots = run('buildAutomaticDrawPots')(sharedRoster,2,5);
  assert.equal(sharedPots.length,1,'Isolated players can share a secondary position');
  assert.ok(sharedPots[0].name.startsWith('MED'));
  for (const role of ['DEF','MED']) {
    const lateralRoster = run(`[fixture('LAT',4),fixture('${role}',4),fixture('${role}',4.1)]`);
    const lateralPots = run('buildAutomaticDrawPots')(lateralRoster,2,5);
    assert.equal(lateralPots.length,1,`Isolated LAT can join ${role} without a registered secondary role`);
    assert.ok(lateralPots[0].name.startsWith(role));
    assert.equal(lateralPots[0].playerIds.length,3);
  }
  const lateralMismatch = run("[fixture('LAT',6),fixture('DEF',2),fixture('MED',2),fixture('DEL',6)]");
  const mismatchPots = run('buildAutomaticDrawPots')(lateralMismatch,2,5);
  assert.ok(mismatchPots.every(pot=>pot.playerIds.length >= 2),'Final score fallback leaves no isolated field players');
  const lateralClosest = run("[fixture('LAT',4),fixture('DEF',4.2),fixture('DEF',4.2),fixture('MED',4),fixture('MED',4)]");
  const closestPots = run('buildAutomaticDrawPots')(lateralClosest,2,5);
  assert.ok(closestPots.find(pot=>pot.name.startsWith('MED')).playerIds.includes(String(lateralClosest[0].id)),'LAT chooses the closest compatible score');
  const rodriRoster = run("[fixture('LAT/MED',4),fixture('DEF',4),fixture('DEF',4),fixture('DEF',4),fixture('MED',5),fixture('MED',5)]");
  const rodriPots = run('buildAutomaticDrawPots')(rodriRoster,2,5);
  assert.equal(rodriPots.find(pot=>pot.name.startsWith('DEF')).playerIds.length,4,'Rodri-like LAT joins a full compatible DEF pot instead of remaining alone');
  const isolatedRoster = run("[fixture('DEF',1.8),fixture('LAT',1.4),fixture('MED',4),fixture('MED',4)]");
  const isolatedPots = run('buildAutomaticDrawPots')(isolatedRoster,2,5);
  assert.ok(isolatedPots.every(pot=>pot.playerIds.length >= 2));
  assert.ok(isolatedPots.some(pot=>pot.playerIds.includes(String(isolatedRoster[0].id)) && pot.playerIds.includes(String(isolatedRoster[1].id))), 'Isolated low-score players merge with each other before distant high-score groups');
  assert.equal(new Set(isolatedPots.flatMap(pot=>pot.playerIds)).size,isolatedRoster.length);
  assert.ok(automatic.some(pot=>pot.playerIds.includes('99999')),'Absent saved members are retained');
  assert.equal(run('buildAutomaticDrawPots')([],2).length,0);
  const twoMember=[{name:'Par',playerIds:['1','2']}];
  assert.equal(run('teamsSeparateTwoPlayerPots')([[{id:1},{id:2}],[{id:3}]],twoMember),false);
  assert.equal(run('teamsSeparateTwoPlayerPots')([[{id:1}],[{id:2},{id:3}]],twoMember),true);
  assert.equal(run('teamsSeparateTwoPlayerPots')([[{id:1},{id:2}],[{id:3}]],[{name:'Tres',playerIds:['1','2','3']}]),true,'Larger pots do not impose pair separation');
  assert.equal(run('teamsSeparateTwoPlayerPots')([[{id:1},{id:2}],[{id:3}]],[{name:'Ausente',playerIds:['1','2','99999']}]),false,'The rule applies to the two attending members');
  for (const n of [2, 3, 4]) {
    const players = run(`makeRoster(${n})`);
    const pots = run(`makePots(input = ${JSON.stringify(players)}, [${n},${n+1},${n-1},${n},${n}])`);
    const result = await generate(players, n, pots);
    console.log(`${n} teams: balanced pot quotas, compensated prefixes and valid formations (${result.evaluatedCandidates} candidates)`);
    if (n === 2) {
      const signature = run('drawSignature')(result.teams);
      const next = await generate(players, n, pots, [signature]);
      assert.notEqual(run('drawSignature')(next.teams), signature, 'Redraw must keep the pots while finding fresh teams');
    }
  }
  const example = run('makeRoster(2, [4,4,4])');
  context.input = example;
  const examplePots = run('makePots(input, [3,3,4,2,2])');
  const uneven = await generate(example, 2, examplePots);
  context.resultTeams = uneven.teams;
  context.pots = examplePots;
  assert.equal(run('teamsRespectPots(resultTeams, pots)'), true, 'User example sizes compensate 2–1 then 1–2');

  const large = run('makeRoster(2, [8,6,6])');
  context.input = large;
  await generate(large, 2, run('makePots(input, [2,5,3,6,6])'));
  const smallPots = run('makeRoster(4)');
  context.input = smallPots;
  await generate(smallPots, 4, run('makePots(input, [1,3,5,3,2,2,4])'));

  run(`globalThis.strengthPlayers = [fixture('DEF',4.8), fixture('DEF',3), fixture('DEF',4.8), fixture('DEF',3), fixture('ARQ',4), fixture('ARQ',4), fixture('MED',4), fixture('MED',4), fixture('DEL',4), fixture('DEL',4)];`);
  const strength = context.strengthPlayers;
  context.input = strength;
  const strengthPots = run('makePots(input, [2,2,2,2,2])');
  assert.equal(run('drawPotDistance')(strengthPots[0].playerIds[0], strengthPots[0].playerIds[1], strengthPots), 0);
  assert.equal(run('drawPotDistance')(strengthPots[0].playerIds[0], strengthPots[1].playerIds[0], strengthPots), 1);
  assert.equal(run('drawPotDistance')(strengthPots[0].playerIds[0], strengthPots[4].playerIds[0], strengthPots), 4);
  assert.equal(run('drawPotDistance')('1', '2', null), 0, 'Habitual draw keeps its exchange rules');
  const compensated = await generate(strength, 2, strengthPots);
  const firstHighTeam = compensated.teams.findIndex(team => team.some(p => p.id === strength[0].id));
  const secondHighTeam = compensated.teams.findIndex(team => team.some(p => p.id === strength[2].id));
  assert.notEqual(firstHighTeam, secondHighTeam, 'The best player of pot 2 compensates the weaker team after pot 1');

  // Cross-pot changes are evaluated, with a graduated soft penalty.
  run(`
    globalThis.refinePlayers = [fixture('DEF',4.8),fixture('MED',4),fixture('DEF',3),fixture('DEF',4),fixture('MED',4),fixture('DEF',3.4),fixture('ARQ',4),fixture('ARQ',4),fixture('DEL',4),fixture('DEL',4)];
    globalThis.refinePots = makePots(refinePlayers,[3,3,2,2]);
    globalThis.refineTeams = [[0,1,3,6,8],[2,4,5,7,9]].map(ids=>ids.map(id=>refinePlayers[id]));
    globalThis.crossPot = refineTeams.map(team=>team.slice());
    [crossPot[0][0],crossPot[1][2]]=[crossPot[1][2],crossPot[0][0]];
    globalThis.sawCrossPotCandidate=false;
    globalThis.originalScoreForPots = scoreTeams;
    scoreTeams = (teams,...args) => {
      if(potExchangeDistancePenalty(teams,refineTeams,refinePots)>0) sawCrossPotCandidate=true;
      return originalScoreForPots(teams,...args);
    };
  `);
  assert.equal(run('teamsRespectPots(crossPot,refinePots)'), true, 'Fixture distinguishes same-pot rule from merely balanced quotas');
  await run('improveBySwapsAsync(refineTeams,5,{}, {},async()=>false,refinePots)');
  run('scoreTeams = originalScoreForPots');
  assert.equal(run('sawCrossPotCandidate'), true, 'Automatic refinement considers other pots instead of blocking them');
  assert.equal(run('potExchangeDistancePenalty(refineTeams,refineTeams,refinePots)'), 0);
  assert.equal(run('potExchangeDistancePenalty(crossPot,refineTeams,refinePots)'), 1);
  run(`
    globalThis.levelPots = refinePlayers.map((player,index)=>({name:'Pote '+(index+1),playerIds:[playerKey(player)]}));
    globalThis.distanceFour=refineTeams.map(team=>team.slice());
    [distanceFour[0][0],distanceFour[1][1]]=[distanceFour[1][1],distanceFour[0][0]];
    globalThis.same={diff:1,potAdjustedDiff:1};
    globalThis.near={diff:0.5,potAdjustedDiff:0.75};
    globalThis.far={diff:0,potAdjustedDiff:4};
  `);
  assert.equal(run('potExchangeDistancePenalty(distanceFour,refineTeams,levelPots)'), 16, 'Four levels cost substantially more than one');
  assert.equal(run('isBetterDraw(near,same)'), true, 'A worthwhile improvement can justify a neighboring pot');
  assert.equal(run('isBetterDraw(far,same)'), false, 'A small improvement does not justify a large jump');
  assert.equal(run('isBetterDraw(far,{diff:6,potAdjustedDiff:6})'), true, 'Large jumps remain possible for a substantial improvement');

  // Saved players who do not attend and empty pots are ignored for this draw.
  const reusable = [...strengthPots.map(pot => ({...pot, playerIds: [...pot.playerIds]})), {name:'Ausentes', playerIds:['99999']}];
  await generate(strength, 2, reusable);
  context.input = strength;
  context.pots = strengthPots.slice(1);
  assert.equal(await run('generateBalancedTeams(input,2,2,{}, {},new Set(),{pots})'), null, 'Never fall back when selected players lack a pot');
  context.pots = [...strengthPots, strengthPots[0]];
  assert.equal(await run('generateBalancedTeams(input,2,2,{}, {},new Set(),{pots})'), null, 'Duplicate membership is invalid');
  context.input = run("[...strengthPlayers.slice(0,4),fixture('ARQ',4),fixture('ARQ',4),fixture('ARQ',4),fixture('MED',4),fixture('DEL',4),fixture('DEL',4)]");
  context.pots = [{name:'Todos',playerIds:context.input.map(p=>String(p.id))}];
  assert.equal(await run('generateBalancedTeams(input,2,2,{}, {},new Set(),{pots})'), null, 'Incompatible goalkeeper rules never fall back to an unrestricted draw');
  context.pots = [{name:'Todos',playerIds:strength.map(p=>String(p.id))}];
  await generate(strength, 2, context.pots);
  console.log('PASS: strength compensation, uneven pots, reusable membership, redraw, goalkeepers and invalid configuration.');
})().catch(error => { console.error(error); process.exitCode = 1; });
