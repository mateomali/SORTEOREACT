const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const rating = require('../assets/player-rating.js');
const formation = require('../assets/formation-policy.js');
rating.configure(JSON.parse(fs.readFileSync('assets/player-rating-policy.json', 'utf8')));
const context = vm.createContext({ console, performance, GoodfellasRating: rating });
const source = fs.readFileSync('src/pages/SorteoLegacyPageIsland.jsx', 'utf8');
const helpers = source.slice(0, source.indexOf('function iconPath(')).replace(/^import .*;\r?\n/gm, '')
  .replace(/function TeamRadar\([\s\S]*?(?=const LINE_STRENGTH_BALANCE_WEIGHTS)/, '');
vm.runInContext(helpers, context);
const run = code => vm.runInContext(code, context);
const legacyContext = vm.createContext({
  REQUIRED_FIELD_LINES: ['DEF', 'MED', 'DEL'], FIELD_LINES: ['DEF', 'LAT', 'MED', 'DEL'], GoodfellasRating: rating,
});
const legacy = fs.readFileSync('assets/sorteo-legacy.js', 'utf8');
vm.runInContext(legacy.slice(legacy.indexOf('function pitchLineForPosition('), legacy.indexOf('function normalizarPosiciones(')), legacyContext);
Object.assign(legacyContext, {
  GoodfellasFormation: formation, FORMATION_LINES:['ARQ','DEF','LAT','MED','DEL'],
  getOrderedPlayerPositions:p=>p.positions.split('/'),getPrimaryPlayerPosition:p=>p.positions.split('/')[0],
  isEmergencyGoalkeeper:()=>false,isPureGoalkeeper:p=>p.positions==='ARQ',adjustedPositionRating:()=>3.5,
});
vm.runInContext(legacy.slice(legacy.indexOf('function buildTeamPositionAssignment('),legacy.indexOf('function buildFlexibleTeamPositionAssignment(')),legacyContext);
for (const size of [5,6,7]) {
  legacyContext.team = Array.from({length:size},(_,id)=>({id,nombre:'Player '+id,positions:id===0?'ARQ':'DEF'}));
  const result = vm.runInContext('buildTeamPositionAssignment(team)',legacyContext);
  assert.equal(result.lineaMaximaValida,true);
  assert.equal(result.conteoFinal.MED,1);
  assert.equal(result.conteoFinal.DEL,1);
  assert.equal(result.conteoFinal.ARQ,1);
}
const cases = JSON.parse(execFileSync('php', ['tests/small-team-formations.php'], { encoding: 'utf8' }));
for (const fixture of cases) {
  context.counts = fixture.counts;
  context.size = fixture.size;
  assert.equal(run('fieldLineCountsFitLimits(counts,size)'), fixture.valid, JSON.stringify(fixture));
  assert.equal(run('pitchLineCountsFitLimits(counts,size)'), fixture.valid, JSON.stringify(fixture));
  assert.equal(run('lineCountViolationMessage(counts,size) === ""'), fixture.valid, JSON.stringify(fixture));
  legacyContext.counts = fixture.counts;
  legacyContext.size = fixture.size;
  assert.equal(vm.runInContext('fieldLineCountsFitLimits(counts,size)', legacyContext), fixture.valid);
}
assert.equal(run('fieldLineMinimum("MED",8)'), 1);
assert.equal(run('maxFieldPlayersPerLine(8)'), 3);
run(`let fixtureId = 0;
function player(role) {
  return normalizePlayer({id:++fixtureId,positions:role,skill:3.5,technique:3.5,pass_vision:3.5,
    defense_physical:3.5,rhythm:3.5,stamina:3.5,attack:3.5,teamwork:3.5,mentality:3.5,
    goalkeeper_skill:3.5,regularity:3.5}, fixtureId);
}`);
(async () => {
  for (const size of [5, 6, 7]) {
    context.size = size;
    const result = await run('generateBalancedTeams([player("ARQ"),player("ARQ"),...Array.from({length:2*(size-1)},()=>player("DEF"))],2,0.7,{}, {})');
    assert.ok(result, `All-defense field formation must be valid for ${size} players`);
    assert.ok(result.evaluation.valid);
    for (const team of result.teams) {
      context.team = team;
      const assignment = run('buildTeamAssignment(team)');
      assert.equal(Object.values(assignment).filter(role => role === 'ARQ').length, 1);
      assert.equal(Object.values(assignment).filter(role => role === 'DEF' || role === 'LAT').length, size - 3);
      assert.equal(Object.values(assignment).filter(role => role === 'MED').length, 1);
      assert.equal(Object.values(assignment).filter(role => role === 'DEL').length, 1);
    }
  }
  const large = await run('generateBalancedTeams([player("ARQ"),player("ARQ"),...Array.from({length:6},()=>player("DEF")),...Array.from({length:2},()=>player("MED")),...Array.from({length:6},()=>player("DEL"))],2,0.7,{}, {})');
  assert.ok(large?.evaluation.valid, 'Eight-player teams with one midfielder each must be valid');
  for (const team of large.teams) {
    context.team = team;
    const roles = Object.values(run('buildTeamAssignment(team)'));
    assert.equal(roles.filter(role=>role==='ARQ').length,1);
    assert.ok(roles.filter(role=>role==='DEF'||role==='LAT').length>=2);
    assert.equal(roles.filter(role=>role==='MED').length,1);
    assert.ok(roles.filter(role=>role==='DEL').length>=1);
  }
  // Missing midfielders require one adaptation per team.
  const attackHeavy = await run('generateBalancedTeams([player("ARQ"),player("ARQ"),...Array.from({length:4},()=>player("LAT")),...Array.from({length:6},()=>player("DEL"))],2,0.7,{}, {})');
  assert.ok(attackHeavy?.evaluation.valid);
  const shortage = await run('generateBalancedTeams([player("ARQ"),player("ARQ"),player("DEF"),player("DEF"),...Array.from({length:6},()=>player("DEL"))],2,0.7,{}, {})');
  assert.ok(shortage?.evaluation.valid, 'Defense shortage must adapt players while keeping two defenders');
  assert.equal(shortage.evaluation.hardConstraints.adaptationCount, 4);
  for (const size of [3,4]) { context.size = size; assert.equal(await run('generateBalancedTeams([player("ARQ"),player("ARQ"),...Array.from({length:2*(size-1)},()=>player("DEF"))],2,0.7,{}, {})'), null); }
  const native = await run('generateBalancedTeams([player("ARQ"),player("ARQ"),...Array.from({length:4},()=>player("DEF")),player("MED"),player("MED/DEL"),player("DEL"),player("DEL")],2,0.7,{}, {})');
  assert.ok(native?.evaluation.valid);
  assert.equal(native.evaluation.hardConstraints.adaptationCount,0,'Natural and secondary positions must prevent unnecessary adaptations');
  const oneMissing = await run('generateBalancedTeams([player("ARQ"),player("ARQ"),...Array.from({length:5},()=>player("DEF")),player("MED"),player("DEL"),player("DEL")],2,0.7,{}, {})');
  assert.ok(oneMissing?.evaluation.valid);
  assert.equal(oneMissing.evaluation.hardConstraints.adaptationCount,1,'One missing midfielder permits only one adaptation');
  const sharedShortage = await run('generateBalancedTeams([player("ARQ"),player("ARQ"),...Array.from({length:7},()=>player("DEF")),player("MED/DEL")],2,0.7,{}, {})');
  assert.ok(sharedShortage?.evaluation.valid);
  assert.equal(sharedShortage.evaluation.hardConstraints.adaptationCount,3,'Shared secondary positions cannot be counted twice');
  const presetPlayers = ['ARQ','DEF','DEF','MED','DEL'].map((role,id)=>({id,positions:[role]}));
  const preset = formation.assignCounts(presetPlayers,presetPlayers[0],p=>p.positions,()=>3.5,{DEF:2,MED:1,DEL:1});
  assert.ok(preset);
  assert.ok(presetPlayers.every(p=>preset.get(p) === p.positions[0]));
  const map = role => ({positions:[role],assigned:role});
  const naturalTeams = Array.from({length:2},()=>['ARQ','DEF','DEF','MED','DEL'].map(map));
  assert.equal(formation.validate(naturalTeams),true);
  const noKeeper = naturalTeams.map(team=>team.filter(p=>p.assigned !== 'ARQ'));
  assert.equal(formation.validate(noKeeper),false,'Every team must have one goalkeeper');
  const noDefense = naturalTeams.map(team=>team.map(p=>p.assigned === 'DEF' ? {positions:['MED'],assigned:'MED'} : p));
  assert.equal(formation.validate(noDefense),false,'Natural roles do not excuse missing defenders');
  const bad = naturalTeams.map(team=>team.map(p=>({...p})));
  bad[0][1].assigned='MED'; bad[0][3].assigned='DEF';
  assert.equal(formation.validate(bad),false,'A manual swap outside natural positions cannot be justified by a local deficit');
  console.log(`OK ${cases.length} PHP/React/API count combinations, 5-7 player draws, mandatory lines and minimum shortage adaptations`);
})().catch(error => { console.error(error); process.exitCode = 1; });
