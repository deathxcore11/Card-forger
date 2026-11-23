import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js'; import { addBlessing } from '../src/sim/field.js';
import { ENCOUNTERS as E } from '../src/data/encounters.js'; import { BLESSINGS } from '../src/data/items.js';
const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false };
const mk = seed => { const g = new Game(seed, { oldGen: true, mode: 'run', duelist: 'kael', offers: false }); g.god = true; return g; };
const d2 = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);

test('shrines: 4 or 5 a stage, a cluster of 2 or 3 within 25 m, 7 m circles that do not overlap', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const g = mk(seed), S = g.world.shrines; assert.ok(S.length >= 4 && S.length <= 5, 'seed ' + seed + ' has ' + S.length + ' shrines');
    assert.equal(E.shrines.radius, 7);
    const within = S.map(s => S.filter(o => o !== s && d2(s, o) <= 25).length); assert.ok(Math.max(...within) >= 1, 'seed ' + seed + ': a cluster exists (' + within.join(',') + ')');
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) assert.ok(d2(S[i], S[j]) >= 14, 'circles of 7 m do not overlap');
  }
});

test('shrines: each blessing rolls a rarity with a multiplier, the circle shows the best, a declined shrine offers the same three again', () => {
  const g = mk(3), s = g.world.shrines[0], R = E.shrines.rarity;
  assert.equal(s.cards.length, 3); for (const c of s.cards) { assert.ok(R.order.includes(c.rarity)); assert.equal(c.mult, R.mult[c.rarity]); }
  assert.equal(s.best, s.cards.reduce((b, c) => (R.order.indexOf(c.rarity) > R.order.indexOf(b) ? c.rarity : b), R.order[0]));
  g.p.x = s.x; g.p.z = s.z; g.p.y = s.y; for (let t = 0; t < 7 && !g.offer; t += 1 / 60) g.step(1 / 60, idle);
  assert.equal(g.offer.type, 'blessing'); assert.equal(g.offer.leave, true, 'there is a Decline'); const first = JSON.stringify(g.offer.cards);
  g.leave(); assert.equal(g.offer, null); assert.equal(s.done, false, 'the shrine is still there'); assert.equal(s.charge, 0);
  for (let t = 0; t < 7 && !g.offer; t += 1 / 60) g.step(1 / 60, idle);
  assert.equal(JSON.stringify(g.offer.cards), first, 'the same three blessings come back (no reroll by leaving)');
});

test('shrines: a higher rarity multiplies the stat', () => {
  const a = mk(9), b = mk(9); addBlessing(a, 'might', 1); addBlessing(b, 'might', 3);
  assert.ok(Math.abs(a.mods.dmgMult - 0.1) < 1e-9); assert.ok(Math.abs(b.mods.dmgMult - 0.3) < 1e-9);
  const c = mk(9); addBlessing(c, 'guard', 1.5); assert.equal(c.mods.armour, 2, 'armour stays whole'); const d = mk(9); addBlessing(d, 'vigor', 2); assert.equal(d.p.maxHp, 100 + 40);
  assert.equal(BLESSINGS.might.fmt(3), '+30% damage.'); assert.equal(BLESSINGS.renewal.fmt(2), 'Regain 1 health every 2 s.');
});

