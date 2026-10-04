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
