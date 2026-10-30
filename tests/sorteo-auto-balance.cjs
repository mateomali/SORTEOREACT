const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/pages/SorteoLegacyPageIsland.jsx', 'utf8');
const context = vm.createContext({
  drawSignature: teams => JSON.stringify(teams),
  selectTopDraw: pool => pool[0],
  isBetterDraw: (a, b) => a.rank < b.rank,
});
vm.runInContext(source.slice(source.indexOf('function collectTopDraw('), source.indexOf('async function refineDrawFormations(')), context);
const candidate = (diff, id, valid = true) => ({ teams:[[id]], evaluation:{ diff, valid, rank:id } });
const select = (pool, avoid = new Set()) => context.selectAutomaticBalanceDraw(pool, avoid);
assert.equal(select([candidate(0,1),candidate(0.05,2)]).usedMaxDiff, 0);
assert.equal(select([candidate(0.31,1),candidate(0.04,2)]).usedMaxDiff, 0.1);
assert.equal(select([candidate(0.1,1)]).usedMaxDiff, 0.1);
assert.equal(select([candidate(0.10000000001,1)]).usedMaxDiff, 0.1);
assert.equal(select([candidate(0.11,1)]).usedMaxDiff, 0.2);
assert.equal(select([candidate(0,1,false),candidate(0.21,2)]).usedMaxDiff, 0.3);
assert.equal(select([candidate(0,1)], new Set(['[[1]]'])), null);
assert.equal(select([]), null);
let pool = [];
for (let id = 0; id < 100; id++) pool = context.collectTopDraw(pool, candidate((100-id)/10, id), null, { autoBalance:true });
assert(pool.some(item => item.evaluation.diff === 0.1), 'Retain tight candidates even when other scoring criteria rank them lower');
assert(pool.length <= 64);
console.log('OK automatic thresholds, rounding, invalid/excluded draws and candidate retention');
