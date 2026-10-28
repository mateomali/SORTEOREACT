const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const fixture = JSON.parse(execFileSync('php',['tests/position-skill-rating.php'],{encoding:'utf8'}));
const source = fs.readFileSync('src/pages/SorteoLegacyPageIsland.jsx','utf8');
const helpers = source.slice(0,source.indexOf('function iconPath(')).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'').replace(/function TeamRadar\([\s\S]*?(?=const LINE_STRENGTH_BALANCE_WEIGHTS)/,'');
const ctx = vm.createContext({ console, performance });
vm.runInContext(fs.readFileSync('assets/player-rating.js','utf8'),ctx);
ctx.GoodfellasRating.configure(fixture.policy);
vm.runInContext(helpers,ctx);
const run = code => vm.runInContext(code,ctx);
for (const sample of fixture.cases) {
  ctx.raw=sample.player; ctx.position=sample.position;
  assert.equal(run('adjustedPositionRating(normalizePlayer(raw,0),position)'),sample.expected,JSON.stringify(sample));
}
ctx.raw=fixture.cases[0].player;
run(`const p=normalizePlayer(raw,0); const fixed={...p,position_rating_mode:'general',position_rating_discount:false}; const skill={...p,position_rating_mode:'skill',position_rating_discount:false};`);
assert.equal(run("adjustedPositionRating(fixed,'DEF')"),run("adjustedPositionRating(fixed,'DEL')"));
assert.ok(run("adjustedPositionRating(skill,'DEF') > adjustedPositionRating(skill,'DEL')"));
assert.equal(run("positionPenaltyPercent(skill,'MED')"),0);
assert.equal(run("positionPenaltyPercent({...skill,position_rating_discount:true},'MED')"),0);
for (const discount of [true, false]) {
  run(`var fixedMode={...fixed,position_rating_discount:${discount}}; var penaltyMode={...fixedMode,position_rating_mode:'penalty'};`);
  const base = run("adjustedPositionRating(fixedMode,'DEF')");
  for (const position of ['ARQ','DEF','LAT','MED','DEL']) {
    assert.equal(run(`adjustedPositionRating(fixedMode,'${position}')`),base,'Fixed mode never changes by position or obsolete discount flag');
    const factor = position === 'DEF' ? 1 : position === 'MED' ? 0.95 : 0.9;
    assert.equal(run(`playerCardRating(adjustedPositionRating(penaltyMode,'${position}'))`),Math.round(run('playerCardRating('+base+')') * factor),'Penalty applies directly to GEN');
    assert.equal(run(`positionPenaltyPercent(penaltyMode,'${position}')`),Math.round((1-factor)*100));
    assert.equal(run(`adjustedPositionRating({...skill,position_rating_discount:${discount}},'${position}')`),run(`adjustedPositionRating(skill,'${position}')`),'Skill mode never stacks positional discounts');
  }
}
run(`
 const player=(id,r)=>normalizePlayer({id,positions:'MED',puntuacion:4,resistencia:r,regularidad:3.5},id);
 const even=[[player(1,3),player(2,3)],[player(3,3),player(4,3)]];
 const concentrated=[[player(1,1),player(2,5)],[player(3,3),player(4,3)]];
 const balanced=recorridoPointBalance(even,[8,8],3);
 const uneven=recorridoPointBalance(concentrated,[8,8],3);
`);
assert.equal(run('uneven.recorridoTotalGap'),0);
assert.ok(run('uneven.recorridoScore > balanced.recorridoScore'),'Detect all-rounders concentrated despite equal sums');
assert.equal(run('uneven.jointBalance'),run('(uneven.recorridoScore + uneven.generalScore)/2'));
assert.ok(run('recorridoPointBalance([[player(1,4),player(2,4)],[player(3,4.1),player(4,4.1)]],[8,8],3).recorridoScore < 0.021'),'Small stat differences must stay small after normalization');
assert.equal(run('isBetterDraw({jointBalance:0.1,paceExcess:2},{jointBalance:0.2,paceExcess:0})'),true,'Joint criterion precedes pace');
assert.equal(run('isBetterDraw({jointBalance:0.1,paceExcess:0},{jointBalance:0.1,paceExcess:1})'),true,'Pace breaks equal primary scores');
assert.equal(run('isBetterDraw({jointBalance:0,hardViolations:1},{jointBalance:1,hardViolations:0})'),false,'Mandatory restrictions remain first');
assert.equal(run('isBetterDraw({jointBalance:0.1,shapePenalty:1},{jointBalance:0.2,shapePenalty:0})'),true,'Soft shape preference must not override the first balance priority');
console.log(`OK ${fixture.cases.length} PHP/JS scoring cases, three distinct modes, Recorrido profiles and equal priority`);

for(const gen of [60,64,72,80,87,99]) { for(const factor of [0.95,0.9]) { ctx.gen=gen; ctx.factor=factor; assert.equal(run('GoodfellasRating.card(GoodfellasRating.fromCard(Math.round(gen*factor)))'),Math.round(gen*factor)); } }
