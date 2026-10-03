const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const vm = require('node:vm');
const rating = require('../assets/player-rating.js');
const fixtures = JSON.parse(execFileSync('php', ['tests/player-rating-fixtures.php'], { encoding: 'utf8' }));
rating.configure(fixtures.policy);
for (const fixture of fixtures.cases) {
  const positions = [...new Set(fixture.player.positions.split('/'))];
  const value = rating.position(fixture.player, fixture.position, positions, fixture.ignore);
  assert.equal(value, fixture.rating, JSON.stringify(fixture));
  assert.equal(rating.card(value), fixture.card);
}
const stats = Object.fromEntries(Object.keys(fixtures.policy.weights.MED).concat('goalkeeper_skill').map(field => [field, 3]));
stats.regularity = 3.5;
const specialties = { ARQ: 'goalkeeper_skill', DEF: 'defense_physical', MED: 'pass_vision', DEL: 'attack' };
for (const [role, field] of Object.entries(specialties)) {
  assert.ok(rating.position({ ...stats, [field]: 6 }, role) > rating.position(stats, role));
  assert.ok(fixtures.policy.weights[role][field] === Math.max(...Object.values(fixtures.policy.weights[role])));
}
for (const role of Object.keys(fixtures.policy.weights)) {
  const all = value => Object.fromEntries(Object.keys(stats).map(field => [field, field === 'regularity' ? 3.5 : value]));
  assert.equal(rating.position(all(1), role), 1);
  assert.equal(rating.position(all(6), role), 6);
  for (const field of Object.keys(fixtures.policy.weights[role])) {
    let previous = 0;
    for (let i = 10; i <= 60; i++) {
      const value = rating.position({ ...stats, [field]: i / 10 }, role);
      assert.ok(value >= previous, `${role}/${field} must be monotonic`);
      previous = value;
    }
  }
}
assert.equal(rating.card(6), 99);
const custom = structuredClone(fixtures.policy);
custom.weights.DEF = { defense_physical: 1 };
rating.configure(custom);
assert.equal(rating.position({ ...stats, defense_physical: 6 }, 'DEF'), 6);
rating.configure(fixtures.policy);
// The actual draw helpers must agree with the server when no match modifiers apply.
const source = fs.readFileSync('src/pages/SorteoLegacyPageIsland.jsx', 'utf8');
const helpers = source.slice(0, source.indexOf('function iconPath(')).replace(/^import .*;\r?\n/gm, '')
  .replace(/function TeamRadar\([\s\S]*?(?=const LINE_STRENGTH_BALANCE_WEIGHTS)/, '');
const context = vm.createContext({ console, GoodfellasRating: rating });
vm.runInContext(helpers, context);
for (const fixture of fixtures.cases) {
  context.raw = fixture.player;
  context.role = fixture.position;
  context.ignore = fixture.ignore;
  const actual = vm.runInContext('adjustedPositionRating(normalizePlayer(raw, 0), role, {ignorePositionFit:ignore})', context);
  assert.equal(actual, fixture.rating);
}
console.log(`OK ${fixtures.cases.length} PHP/JS cases, draw parity, bounds, monotonicity, role priorities and custom weights`);
