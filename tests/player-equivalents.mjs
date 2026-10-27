import assert from 'node:assert/strict';
import { comparePlayers } from '../src/player-equivalents.mjs';
const player = (name, position, rating) => ({ name, position, line: position === 'LAT' ? 'DEF' : position, rating });
const left = [player('Arquero A', 'ARQ', 3), player('Defensa A', 'DEF', 5), player('Ataque A', 'DEL', 4)];
const right = [player('Ataque B', 'DEL', 5), player('Arquero B', 'ARQ', 5), player('Defensa B', 'DEF', 3)];
const rows = comparePlayers(left, right);
assert.ok(rows.every(row => row.left.position === row.right.position));
assert.equal(new Set(rows.map(row => row.right.name)).size, 3);
assert.equal(rows.at(-1).cumulative, -1);
const unequal = comparePlayers(left, right.slice(0, 2));
assert.equal(unequal.length, 3);
assert.equal(unequal.filter(row => !row.right).length, 1);
assert.equal(unequal.at(-1).cumulative, 2);
assert.equal(comparePlayers([], left).length, 3);
assert.deepEqual(comparePlayers([], []), []);
// A local nearest choice (4 -> 3) would leave 1 -> 5; the global solution costs less.
const global = comparePlayers([player('A', 'DEF', 4), player('B', 'DEF', 1)], [player('C', 'DEF', 3), player('D', 'DEF', 5)]);
assert.equal(global.reduce((sum, row) => sum + Math.abs(row.difference), 0), 3);
console.log('OK: unique optimal pairing, positions, unequal teams and cumulative balance');
