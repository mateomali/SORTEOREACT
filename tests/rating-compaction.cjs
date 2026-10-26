const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const rating = require('../assets/player-rating.js');
const policy = JSON.parse(fs.readFileSync('assets/player-rating-policy.json', 'utf8'));
rating.configure(policy);
for (const [internal, shown] of [[1, 60], [2, 64], [3, 72], [4, 80], [4.5, 87], [5, 93], [6, 99]]) {
  assert.equal(rating.card(internal), shown);
}
assert.equal(rating.balanceCard(3), 64);
assert.equal(rating.balanceCard(5), 92);
for (let n = 10; n <= 60; n++) {
  assert.ok(rating.card(n / 10) >= rating.card((n - 1) / 10));
}
const source = fs.readFileSync('src/pages/SorteoLegacyPageIsland.jsx', 'utf8');
const helpers = source.slice(0, source.indexOf('function iconPath('))
  .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '')
  .replace(/function TeamRadar\([\s\S]*?(?=const LINE_STRENGTH_BALANCE_WEIGHTS)/, '');
function snapshot(activePolicy) {
  const context = vm.createContext({ console });
  vm.runInContext(fs.readFileSync('assets/player-rating.js', 'utf8'), context);
  context.GoodfellasRating.configure(activePolicy);
  vm.runInContext(helpers, context);
  return vm.runInContext(`(() => {
    const teams = [0, 1].map(t => ['ARQ','DEF','DEF/MED','MED','MED/DEL','DEL','DEL/DEF'].map((positions,i) =>
      normalizePlayer({id:t*7+i+1, name:'Fixture '+(t*7+i+1), positions, skill:2.5+(i%4)*0.7+t*0.1,
        rhythm:3+(i%3), stamina:2.5+(i%4)*0.8, regularity:2.5+(i%4)*0.7},i)));
    return JSON.stringify({score:scoreTeams(teams,{}), pots:buildAutomaticDrawPots(teams.flat(),2),
      tiers:teams.flat().map(p=>playerCardTier(bestNaturalPlayerRating(p))),
      irregular:teams.flat().map(isIrregularPlayer)});
  })()`, context);
}
assert.equal(snapshot(policy), snapshot({ ...policy, anchors: policy.balanceAnchors }));
console.log('PASS: compact GEN references, monotonicity and identical draw scores, pots, categories and regularity rules');
