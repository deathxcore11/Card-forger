import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js'; import { openCardChest } from '../src/sim/world.js';
const mk = (seed, trophy) => { const g = new Game(seed, { mode: 'run', difficulty: 'easy', duelist: 'kael' }); const c = { x: g.p.x, y: g.p.y, z: g.p.z, open: false, rarity: trophy ? null : 'common', free: true, trophy }; g.world.cchests.push(c); return { g, c }; };
test('chests: the tier is rolled when the chest is opened, from the seeded loot stream, and is the same on a replay', () => {
  const roll = (seed, trophy) => { const { g, c } = mk(seed, trophy); const before = c.rarity; openCardChest(g, c); return { before, after: c.rarity, reveal: g.offer && g.offer.reveal }; };
  for (const trophy of [false, true]) { const a = roll(5, trophy), b = roll(5, trophy); assert.deepEqual(a, b, 'same seed, same roll'); assert.ok(['common', 'rare', 'epic', 'legendary'].includes(a.after)); assert.equal(a.reveal, a.after); }
  const seen = new Set(); for (let s = 1; s < 80; s++) seen.add(roll(s, true).after); assert.ok(seen.size >= 2, 'a Trophy Chest can roll more than one tier');
  const { g, c } = mk(3, true); g.forceChest = 'rare'; openCardChest(g, c); assert.equal(g.offer.reveal, 'rare', 'the debug hook forces the roll');
});

