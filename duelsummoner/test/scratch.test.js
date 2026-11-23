// Fix list part 5, NOW 1: nested blasts (a Sand Bloat felled by a blast fells the next one inside that blast's own loop) must not overwrite each other's candidate list.
// 4 Bloats and 40 husks: every husk must take exactly one hit from each Bloat whose blast reaches it, checked against a brute-force count.
import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js'; import { spawnEnemy } from '../src/sim/enemies.js'; import { killEnemy } from '../src/sim/combat.js'; import { KINDS } from '../src/data/enemies.js';
import { takeBuf, freeBuf, resetBufs } from '../src/sim/scratch.js';
const mk = seed => { const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false }); g.god = true; g.spawnAcc = -1e9; return g; };
const R = KINDS.bloat.blast.radius;

function ring(seed) {
  const g = mk(seed), cx = g.p.x + 20, cz = g.p.z + 20, bloats = [], husks = []; let s = seed * 7919 + 13; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 4; i++) { const x = cx + i * 1.1, z = cz + (i % 2) * 0.9; spawnEnemy(g, 'bloat', { x, z }); const slot = g.lastSlot; g.en.hp[slot] = 1; bloats.push({ slot, x: g.en.x[slot], z: g.en.z[slot] }); }
  for (let i = 0; i < 40; i++) { const a = rnd() * Math.PI * 2, d = rnd() * R * 2.2; spawnEnemy(g, 'husk', { x: cx + 1.6 + Math.cos(a) * d, z: cz + 0.4 + Math.sin(a) * d }); const slot = g.lastSlot; g.en.hp[slot] = 5000; husks.push({ slot, x: g.en.x[slot], z: g.en.z[slot] }); }
  g.grid.rebuild(g.en.max, g.en.x, g.en.z, g.en.alive); return { g, bloats, husks };
}

test('1: four Bloats and forty husks, each husk is hit exactly once by every blast that reaches it', () => {
  // the unit: one husk next to one Bloat, one blast
  const u = mk(21); spawnEnemy(u, 'bloat', { x: u.p.x + 20, z: u.p.z + 20 }); const bs = u.lastSlot; spawnEnemy(u, 'husk', { x: u.p.x + 20.5, z: u.p.z + 20 }); const hs = u.lastSlot; u.en.hp[hs] = 5000; u.grid.rebuild(u.en.max, u.en.x, u.en.z, u.en.alive); killEnemy(u, bs);
  const unit = 5000 - u.en.hp[hs]; assert.ok(unit > 0, 'one blast hurts a husk beside it');
  for (const seed of [31, 32, 33]) {
    const { g, bloats, husks } = ring(seed); const hp0 = husks.map(h => g.en.hp[h.slot]);
    killEnemy(g, bloats[0].slot);
    for (const b of bloats) assert.equal(g.en.alive[b.slot], 0, 'every Bloat in the chain went off (seed ' + seed + ')');
    let wrong = 0, hit = 0;
    husks.forEach((h, k) => { const n = bloats.filter(b => (b.x - h.x) ** 2 + (b.z - h.z) ** 2 < R * R).length, lost = hp0[k] - g.en.hp[h.slot]; if (n > 0) hit++; if (Math.abs(lost - n * unit) > 1e-3 * unit) wrong++; });
    assert.ok(hit >= 10, 'the ring has husks in reach (' + hit + ')'); assert.equal(wrong, 0, 'husks hit the wrong number of times (seed ' + seed + ')');
  }
});

test('1: scratch buffers nest and reset', () => {
  resetBufs(); const a = takeBuf(), b = takeBuf(); assert.notEqual(a, b, 'two live takes are two slabs'); freeBuf(); const c = takeBuf(); assert.equal(c, b, 'a freed slab is reused'); freeBuf(); freeBuf();
  resetBufs(); assert.equal(takeBuf(), a, 'reset hands back the first slab');
  resetBufs();
});
