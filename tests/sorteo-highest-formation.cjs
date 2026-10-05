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
context.team = Array.from({length: 7}, (_, index) => run(`normalizePlayer(${JSON.stringify({id:index+1,positions:index===0?'ARQ':['DEF/MED','MED/DEL','DEL/DEF'][index%3],skill:3.5,technique:2+index%4,pass_vision:1+index%5,defense_physical:1+(index*3)%5,attack:1+(index*2)%5,rhythm:3,stamina:4,teamwork:3,mentality:3,goalkeeper_skill:3,regularity:3})})`));
for (const locks of [{}, {'2':'MED'}]) {
  context.locks=locks;
  const best=run('highestScoringFormation(team, {}, locks)');
  assert.ok(best);
  assert.equal(best.assignments['1'],'ARQ');
  if (locks['2']) assert.equal(best.assignments['2'],'MED');
  let oracle=-Infinity;
  const visit=(index,assignments)=>{
    if(index===context.team.length) {
      context.proposal=assignments;
      if(run('fieldLineCountsFitLimits(teamLineCounts(team, proposal), team.length)')) oracle=Math.max(oracle,run('teamScore(team, proposal)'));
      return;
    }
    for(const position of locks[String(index+1)] ? [locks[String(index+1)]] : ['DEF','LAT','MED','DEL']) visit(index+1,{...assignments,[String(index+1)]:position});
  };
  visit(1,{'1':'ARQ'});
  assert.ok(Math.abs(best.total-oracle)<1e-9, `Expected exact maximum ${oracle}, got ${best.total}`);
  context.proposal=best.assignments;
  assert.ok(Math.abs(run('teamScore(team, proposal)')-best.total)<1e-9);
}
assert.equal(run('teamFormationSelectValue(team, {}, "highest-score", true, true)'), 'highest-score');
console.log('PASS: highest formation matches exhaustive search, preserves goalkeeper and locks');

context.second = context.team.map((p, index) => ({...p, id: index + 21}));
context.teams = [context.team, context.second];
const base = run('Object.assign({}, ...teams.map(team => buildTeamAssignment(team)))');
context.base = base;
const balanced = run('mostBalancedFormations(teams, base)');
assert.ok(balanced);
assert.ok(balanced.diff < 1e-8, 'Identical rosters must reach equal totals');
context.balanced = balanced;
assert.ok(run('teams.every(team => fieldLineCountsFitLimits(teamLineCounts(team, balanced.assignments), team.length))'));
assert.ok(run('teams.every(team => assignmentPositionUseStats(team, balanced.assignments).outOfPositionCount <= assignmentPositionUseStats(team, base).outOfPositionCount)'));
context.lock = {'2': base['2'], '22': base['22']};
const locked = run('mostBalancedFormations(teams, base, lock)');
assert.equal(locked.assignments['2'], base['2']);
assert.equal(locked.assignments['22'], base['22']);
context.third = context.team.map((p, index) => ({...p, id: index + 41}));
const three = run('mostBalancedFormations([...teams, third])');
assert.ok(three);
assert.ok(three.diff < 1e-8);
assert.equal(run('teamFormationSelectValue(team, {}, "balanced-teams")'), 'balanced-teams');
console.log('PASS: joint formations balance identical 2/3-team draws, preserve rules and locks, and avoid extra adaptations');

assert.ok(run('isBetterDraw({hardViolations:0,diff:0.2,lineQualityCost:10}, {hardViolations:0,diff:2.4,lineQualityCost:0})'), 'Total gap must take priority over line quality');
assert.equal(run('selectTopDraw([{teams, evaluation:{hardViolations:0,diff:0}}], {teams, evaluation:{hardViolations:0,diff:0}}, new Set([drawSignature(teams)]))'), null, 'Never return a forbidden roster partition');
console.log('PASS: total gap priority and no fallback to an already used draw');

assert.ok(run('isBetterDraw({hardViolations:0,enduranceGap:0.1,diff:2.5}, {hardViolations:0,enduranceGap:1.5,diff:0})'), 'Ida y vuelta must take priority over total points');
assert.equal(run('isBetterDraw({hardViolations:1,enduranceGap:0,diff:0}, {hardViolations:0,enduranceGap:2,diff:3})'), false, 'Mandatory rules take priority over endurance');
assert.equal(run('drawsAreNear({hardViolations:0,enduranceGap:1,diff:0}, {hardViolations:0,enduranceGap:0,diff:0})'), false, 'Random selection must not worsen endurance');
run(`globalThis.enduranceRoster = Array.from({length:10}, (_,index) => normalizePlayer({
  id:index+101, positions:index<2?'ARQ':'DEF/MED/DEL', skill:3.5, stamina:[3,3,6,5,4,3,2,1,5,2][index], regularity:3.5
},index));`);
(async () => {
  const result = await run('generateBalancedTeams(enduranceRoster, 2, 2, {}, {})');
  assert.ok(result);
  const oracle = run(`(() => { let minimum=Infinity;
    for(let mask=1; mask<1024; mask+=2) {
      const teams=[enduranceRoster.filter((p,i)=>mask&(1<<i)),enduranceRoster.filter((p,i)=>!(mask&(1<<i)))];
      if(teams[0].length!==5 || !teamsFitFormationRules(teams,5)) continue;
      minimum=Math.min(minimum,enduranceBalance(teams).enduranceGap);
    }
    return minimum;
  })()`);
  assert.ok(Math.abs(result.evaluation.enduranceGap-oracle)<1e-6, 'Generated draw must achieve the exhaustive minimum ida y vuelta gap');
  console.log('PASS: ida y vuelta is first balance priority and matches exhaustive roster oracle');
})().catch(error => {console.error(error);process.exitCode=1;});
