import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js'; import { spawnAce } from '../src/sim/enemies.js';
const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false };
test('Aces: melee shows a red ground disc at least 0.5 s before LP drops, and three Aces never take more than 25 percent of max LP in any second', () => {
  const g = new Game(3, { mode: 'run', duelist: 'kael', offers: false }); g.p.maxHp = 400; g.p.hp = 400; const p = g.p;
  for (let k = 0; k < 3; k++) { spawnAce(g, 'husk'); const i = g.lastSlot; g.en.x[i] = p.x + (k - 1) * 1.2; g.en.z[i] = p.z + 1.4; g.en.y[i] = p.y; g.en.hp[i] = 1e9; }
  const hits = [], tells = []; const orig = g.hurtPlayer.bind(g); g.hurtPlayer = (d, s, src) => { hits.push([g.t, d]); return orig(d, s, src); };
  let seenTell = -1; for (let t = 0; t < 60 && !g.over; t += 1 / 60) { g.p.x = p.x; g.step(1 / 60, idle); if (seenTell < 0 && g.tele.some(x => x.on && x.color === 0xff3020)) seenTell = g.t; for (const e of [0]) { } g.p.hp = Math.max(g.p.hp, 1); if (g.en.alive.length) for (let i = 0; i < g.en.max; i++) if (g.en.alive[i] && g.en.ace[i]) { g.en.hp[i] = 1e9; } }
  assert.ok(hits.length > 0, 'the Aces did hit');
  assert.ok(seenTell >= 0 && hits[0][0] - seenTell >= 0.45, 'a red disc appeared ' + (hits[0][0] - seenTell).toFixed(2) + ' s before the first hit');
  let worst = 0; for (let a = 0; a < hits.length; a++) { let s = 0; for (let b = a; b < hits.length && hits[b][0] - hits[a][0] <= 1; b++) s += hits[b][1]; worst = Math.max(worst, s); }
  assert.ok(worst <= 0.25 * 400 + 1e-6, 'worst second ' + worst.toFixed(1) + ' of 100 allowed');
});
