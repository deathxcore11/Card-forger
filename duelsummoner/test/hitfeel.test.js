import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { spawnEnemy } from '../src/sim/enemies.js';
import { damageEnemy } from '../src/sim/combat.js';

const mk = () => { const g = new Game(11, { mode: 'run', duelist: 'kael', offers: false, terrain: 'small', arch: 'a', difficulty: 'easy' }); g.god = true; return g; };
const dist = (g, i, x, z) => Math.hypot(g.en.x[i] - x, g.en.z[i] - z);

test('hit feel: a card hit pushes a swarm enemy about 0.4 m away, and an Ace ignores it', () => {
  const g = mk(); let done = false;
  for (const [ox, oz] of [[12, 3], [-12, 3], [3, 12], [3, -12], [20, 8], [-20, -8], [8, 20], [-8, -20]]) {       // open sand: some spots may be inside a block or a cactus
    const at = { x: g.p.x + ox, z: g.p.z + oz }; spawnEnemy(g, 'husk', at); const i = g.lastSlot; spawnEnemy(g, 'husk', { x: at.x + 6, z: at.z }); const j = g.lastSlot;
    g.en.hp[i] = g.en.hp[j] = 1e9; g.en.ace[j] = 1; const x0 = g.en.x[i], z0 = g.en.z[i], x1 = g.en.x[j], z1 = g.en.z[j];
    g.hitEnemy(i, 1, 1, 0); g.hitEnemy(j, 1, 1, 0); const d = dist(g, i, x0, z0); if (d < 0.2) continue;       // blocked by scenery: try another spot
    assert.ok(d > 0.3 && d <= 0.45, 'pushed ' + d + ' m'); assert.ok(g.en.x[i] > x0, 'pushed along the hit direction'); assert.ok(dist(g, j, x1, z1) < 1e-9, 'an Ace is not pushed by a card hit');
    const x2 = g.en.x[i]; damageEnemy(g, i, 1, { kx: 1, kz: 0, knock: 3 }); assert.ok(g.en.x[i] - x2 > 2.5, 'a named push (Gust Ward) still moves them'); done = true; break;
  }
  assert.ok(done, 'found an open spot');
});

test('hit feel: killing an Ace announces an elite fall (the view takes two frames of hit-stop from it); a plain kill does not', () => {
  const g = mk(); const ev = []; const em = g.emit.bind(g); g.emit = (t, a, b, c) => { ev.push(t); return em(t, a, b, c); };
  spawnEnemy(g, 'husk', { x: g.p.x + 12, z: g.p.z + 3 }); const i = g.lastSlot; spawnEnemy(g, 'husk', { x: g.p.x + 18, z: g.p.z + 3 }); const j = g.lastSlot; g.en.ace[j] = 1;
  damageEnemy(g, i, 1e9, {}); assert.ok(ev.includes('kill') && !ev.includes('elitefall'), 'a plain kill: no hit-stop event');
  damageEnemy(g, j, 1e9, {}); assert.ok(ev.includes('elitefall'), 'an Ace falls: hit-stop event');
});
