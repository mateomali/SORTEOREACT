const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Exercise the actual React draw functions without mounting the UI.
const source = fs.readFileSync(path.join(__dirname, '../src/pages/SorteoLegacyPageIsland.jsx'), 'utf8');
const context = vm.createContext({ console });
const helperSource = source.slice(0, source.indexOf('function iconPath('))
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/function TeamRadar\([\s\S]*?(?=const LINE_STRENGTH_BALANCE_WEIGHTS)/, '');
vm.runInContext(helperSource, context);
const run = vm.runInContext(`(async () => {
const players = Array.from({ length: 18 }, (_, i) => normalizePlayer({
  id: i + 1, name: 'Jugador ' + (i + 1),
  positions: i < 3 ? 'ARQ/MED' : ['DEF/MED', 'DEF/DEL', 'MED/DEF', 'DEL/MED', 'DEL/DEF'][(i - 3) % 5],
  overall: 3 + (i % 4) * 0.4, rhythm: 4,
  manualGoalkeeper: i < 3,
}, i));
const valid = [0, 1, 2].map(index => [players[index], ...players.slice(3 + index * 5, 8 + index * 5)]);
const broken = valid.map(team => team.slice());
[broken[0][1], broken[1][0]] = [broken[1][0], broken[0][1]];
const examined = [];
const originalBuild = buildCandidateTeams;
buildCandidateTeams = (...args) => {
  const teams = originalBuild(...args);
  if (teams && teamsFitFormationRules(teams, args[2])) examined.push(scoreTeams(teams, args[3], {}, args[4]));
  return teams;
};
const originalImprove = improveBySwaps;
improveBySwaps = (...args) => {
  const result = originalImprove(...args);
  if (teamsFitFormationRules(result.teams, args[1])) examined.push(result.evaluation);
  return result;
};
const originalImproveAsync = improveBySwapsAsync;
improveBySwapsAsync = async (...args) => {
  const result = await originalImproveAsync(...args);
  if (teamsFitFormationRules(result.teams, args[1])) examined.push(result.evaluation);
  return result;
};
const progress = [];
const draw = await generateBalancedTeams(players, 3, 6, {}, {}, new Set(), { onProgress: fraction => progress.push(fraction) });
const smallPlayers = [players[0], players[1], ...players.slice(3, 11)];
const exact = await generateBalancedTeams(smallPlayers, 2, 6, {}, {});
let oracle = null;
for (let mask = 0; mask < (1 << smallPlayers.length); mask += 1) {
  const left = smallPlayers.filter((_, index) => mask & (1 << index));
  const right = smallPlayers.filter((_, index) => !(mask & (1 << index)));
  if (teamsFitFormationRules([left, right], 5)) {
    const evaluation = scoreTeams([left, right], {}, {}, {});
    if (isBetterDraw(evaluation, oracle)) oracle = evaluation;
  }
}
const linePools = Object.fromEntries(['DEF', 'MED', 'DEL'].map((line, lineIndex) => [line,
  Array.from({ length: 6 }, (_, index) => normalizePlayer({
    id: 100 + lineIndex * 10 + index, name: line + index, positions: line,
    overall: index < 3 ? 4.5 : 2.5, regularity: 3.5,
  }, index)),
]));
const concentrated = [
  [players[0], linePools.DEF[0], linePools.DEF[1], linePools.MED[3], linePools.MED[4], linePools.DEL[0], linePools.DEL[3]],
  [players[1], linePools.DEF[3], linePools.DEF[4], linePools.MED[0], linePools.MED[1], linePools.DEL[1], linePools.DEL[4]],
  [players[2], linePools.DEF[2], linePools.DEF[5], linePools.MED[2], linePools.MED[5], linePools.DEL[2], linePools.DEL[5]],
];
const redistributed = originalImprove(concentrated, 7, {}, {});
const distributedEvaluation = redistributed.evaluation;
const concentratedEvaluation = scoreTeams(concentrated, {}, {}, {});
const forcedAssignments = Object.fromEntries(concentrated.flat().map(player => [playerKey(player), 'MED']));
globalThis.results = {
  acceptsValid: teamsRespectGoalkeepers(valid),
  acceptsBroken: teamsRespectGoalkeepers(broken),
  inventsKeeper: Object.values(buildTeamAssignment(players.slice(3, 9))).includes('ARQ'),
  shortageAssignment: buildTeamAssignment([players[0], linePools.DEF[0], linePools.DEF[3], linePools.DEF[4], linePools.MED[0], linePools.MED[3], linePools.MED[4]]),
  draws: [draw], examined, progress, exact, oracle,
  concentratedEvaluation, distributedEvaluation, redistributed,
  hiddenEliteExcess: lineStrengthBalance(concentrated, forcedAssignments).eliteExcess,
  prefersSmallDiff: isBetterDraw({ diff: 0.1, value: 10000 }, { diff: 0.5, value: 1 }),
};
})()
`, context);
run.then(() => {
assert.equal(context.results.acceptsValid, true);
assert.equal(context.results.acceptsBroken, false, 'Reject two fixed keepers together and a team without one');
assert.equal(context.results.inventsKeeper, false, 'Do not assign a field player as keeper');
assert.equal(Object.values(context.results.shortageAssignment).includes('DEL'), false, 'Do not invent a striker when none is available');
assert.equal(context.results.prefersSmallDiff, true, 'Minimum point difference takes priority over secondary penalties');
assert.ok(context.results.progress.length >= 40, 'Complete the candidate search instead of stopping at the first acceptable draw');
assert.equal(context.results.draws[0].evaluatedCandidates, context.results.examined.length);
context.bestDrawEvaluation = context.results.draws[0].bestEvaluation;
for (const evaluation of context.results.examined) {
  context.otherEvaluation = evaluation;
  assert.equal(vm.runInContext('isBetterDraw(otherEvaluation, bestDrawEvaluation)', context), false, 'Present the best combined line and total balance among evaluated candidates');
}
assert.ok(context.results.exact.exhaustive);
assert.ok(Math.abs(context.results.exact.bestEvaluation.balanceScore - context.results.oracle.balanceScore) < 0.000001, 'Exhaustive two-team result agrees with independent enumeration');
assert.ok(context.results.concentratedEvaluation.eliteExcess > 0);
assert.equal(context.results.hiddenEliteExcess, context.results.concentratedEvaluation.eliteExcess, 'Changing formation cannot hide natural line concentration');
assert.equal(context.results.distributedEvaluation.eliteExcess, 0, 'Separate the strongest defenders and midfielders');
for (const line of ['DEF', 'MED', 'DEL']) {
  assert.deepEqual(Array.from(context.results.distributedEvaluation.lineBalance.details[line].eliteCounts), [1, 1, 1], 'One of the three best ' + line + ' players per team');
}
for (const draw of context.results.draws) {
  assert.ok(draw, 'Generate a triangular');
  for (const team of draw.teams) {
    assert.equal(team.filter(player => player.manualGoalkeeper).length, 1);
    context.teamToCheck = team;
    const assignments = vm.runInContext('buildTeamAssignment(teamToCheck)', context);
    const keeper = team.find(player => player.manualGoalkeeper);
    assert.equal(assignments[String(keeper.id)], 'ARQ');
    assert.equal(Object.values(assignments).filter(line => line === 'ARQ').length, 1);
  }
}
console.log('OK triangular: one selected goalkeeper per team, including after optimization');
}).catch(error => { console.error(error); process.exitCode = 1; });
