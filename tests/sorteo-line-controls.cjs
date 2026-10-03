const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const rating = require('../assets/player-rating.js');
rating.configure(JSON.parse(fs.readFileSync('assets/player-rating-policy.json','utf8')));
const source = fs.readFileSync('src/pages/SorteoLegacyPageIsland.jsx','utf8');
const helpers = source.slice(0,source.indexOf('function iconPath(')).replace(/^import .*;\r?\n/gm,'')
  .replace(/function TeamRadar\([\s\S]*?(?=const LINE_STRENGTH_BALANCE_WEIGHTS)/,'');
const context = vm.createContext({console,performance,GoodfellasRating:rating});
vm.runInContext(helpers,context);
const run = code => vm.runInContext(code,context);
run(`
function fixture(roles,assigned) {
  const team = roles.map((role,index)=>normalizePlayer({id:index+1,positions:role,skill:3.5,regularity:3.5},index));
  const base = Object.fromEntries(team.map((p,index)=>[playerKey(p),assigned[index]]));
  return {team,base};
}
function allowed(team,assignment) {
  return fieldLineCountsFitLimits(teamLineCounts(team,assignment),team.length)
    && team.every(p=>assignment[playerKey(p)] === 'ARQ'
      ? getOrderedPlayerPositions(p).includes('ARQ')
      : getOrderedPlayerPositions(p).map(pitchLineForPosition).includes(pitchLineForPosition(assignment[playerKey(p)])));
}
function adjust(f,line,delta,locks={}) {
  return planPitchLineAdjustment(f.team,f.base,locks,line,delta,a=>allowed(f.team,a));
}
const direct = fixture(['ARQ','DEF','DEF','MED','MED','MED/DEL','DEL'],['ARQ','DEF','DEF','MED','MED','MED','DEL']);
const chain = fixture(['ARQ','DEF','DEF','DEF/MED','MED/DEL','DEL','DEL'],['ARQ','DEF','DEF','MED','DEL','DEL','DEL']);
`);
context.next=run('adjust(direct,"DEL",1)');
assert.ok(context.next,'+DEL must find a secondary-position midfielder');
assert.equal(run('next[6]'),'DEL');
assert.equal(run('next[1]'),'ARQ');
assert.equal(run('teamLineCounts(direct.team,next).MED'),2);
assert.equal(run('adjust(direct,"DEF",-1)'),null,'Defense cannot drop below two');
assert.equal(run('adjust(direct,"DEL",-1)'),null,'Attack cannot become empty');
context.next=run('adjust(direct,"MED",-1)');
assert.ok(context.next,'-MED must explore attack instead of always falling back to MED');
assert.equal(run('teamLineCounts(direct.team,next).DEL'),2);
assert.equal(run('adjust(direct,"DEL",1,{6:"MED"})'),null,'Locked secondary player must stay in place');
context.next=run('adjust(chain,"DEF",1)');
assert.ok(context.next,'+DEF must find a two-player redistribution through midfield');
assert.equal(run('next[4]'),'DEF');
assert.equal(run('next[5]'),'MED');
assert.equal(run('teamLineCounts(chain.team,next).DEF'),3);
assert.equal(run('teamLineCounts(chain.team,next).MED'),1);
assert.equal(run('teamLineCounts(chain.team,next).DEL'),2);
assert.equal(run('adjust(chain,"DEF",1,{4:"MED"})'),null,'A locked midfielder blocks the chain');
assert.equal(run('adjust(chain,"ARQ",1)'),null);
run('const full = fixture(["ARQ","DEF","DEF","MED","DEL"],["ARQ","DEF","DEF","MED","DEL"])');
for(const line of ['DEF','MED','DEL']) for(const delta of [-1,1]) {
 context.line=line; context.delta=delta;
 assert.equal(run('adjust(full,line,delta)'),null,'Minimum roster has no spare field slots');
}
run('const large = fixture(["ARQ","LAT","DEF","MED","MED/DEL","DEL","DEL","DEL"],["ARQ","LAT","DEF","MED","MED","DEL","DEL","DEL"])');
assert.equal(run('buildTeamAssignment(large.team,large.base)[2]'),'LAT','Explicit positions must survive defense layout normalization');
console.log('OK line controls: +/-, secondary positions, multi-player chains, minimum coverage, fixed keeper, locks and explicit positions');
