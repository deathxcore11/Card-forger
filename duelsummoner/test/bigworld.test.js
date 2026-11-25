import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, Q, REGION } from '../src/gen/world/world.js';
import { Game } from '../src/sim/game.js';
import { loadMap, heightAt, streamTo, isStreamed } from '../src/sim/terrain.js';
import { bigMap } from '../src/gen/world/map.js';

const SEEDS = [11, 4711, 90210, 77, 31337, 5, 123456, 8080];
const STEP = 1 / 60, IDLE = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false, hold: false };

test('big world: the same seed gives the same ground and the same cells, a different seed does not', () => {
  const a = makeWorld(4711, 0), b = makeWorld(4711, 0), c = makeWorld(4712, 0), A = new Float32Array(64 * 64), B = new Float32Array(64 * 64), C = new Float32Array(64 * 64);
  a.fillSim(1000, -2000, 64, A); b.fillSim(1000, -2000, 64, B); c.fillSim(1000, -2000, 64, C);
  assert.deepEqual(Array.from(A), Array.from(B)); assert.notDeepEqual(Array.from(A), Array.from(C));
  assert.deepEqual(a.spawn, b.spawn); assert.deepEqual(a.cell(3, -4).pockets, b.cell(3, -4).pockets); assert.deepEqual(a.cell(3, -4).blocks.map(x => [x.cx, x.cz, x.T]), b.cell(3, -4).blocks.map(x => [x.cx, x.cz, x.T]));
});

test('big world: a height is the same whatever chunks were loaded before it (the ring cache never changes an answer)', () => {
  const m1 = bigMap(90210, 0), m2 = bigMap(90210, 0), pts = []; let s = 1; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let k = 0; k < 400; k++) pts.push([(r() - 0.5) * 6000, (r() - 0.5) * 6000]);
  loadMap(m1); assert.ok(isStreamed()); const one = pts.map(p => heightAt(p[0], p[1]));
  loadMap(m2); streamTo(0, 0, 200, 6); const two = pts.slice().reverse().map(p => heightAt(p[0], p[1])).reverse();
  assert.deepEqual(one, two); assert.ok(one.every(h => h > 0 && h < 120), 'heights are sane');
});

test('big world: regions of every character exist, walkable ground is one connected piece, and a pocket is never far', () => {
  for (const seed of SEEDS) {
    const W = makeWorld(seed, 0), seen = new Set(); for (let z = -12000; z <= 12000; z += 500) for (let x = -12000; x <= 12000; x += 500) seen.add(W.regionAt(x, z).type);
    assert.ok(seen.size >= 6, seed + ' region kinds ' + [...seen].map(i => REGION[i]).join(','));
    // 500 m round the start: nearly all walkable ground is joined to the start, and every pocket is on it
    const R = 400, S = 2, n = R * 2 / S, hs = new Float32Array(n * n), ox = W.spawn.x - R, oz = W.spawn.z - R;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) hs[j * n + i] = W.simAt(ox + i * S + 1, oz + j * S + 1);
    const got = new Uint8Array(n * n), q = [(n >> 1) * n + (n >> 1)]; got[q[0]] = 1; let walk = 0, reach = 0; for (let k = 0; k < n * n; k++) if (hs[k] < 50) walk++;
    while (q.length) { const c = q.pop(), x = c % n, z = (c / n) | 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= n || zz >= n) continue; const m = zz * n + xx; if (got[m] || hs[m] >= 50 || Math.abs(hs[m] - hs[c]) > 0.55 * S) continue; got[m] = 1; q.push(m); } }
    for (let k = 0; k < n * n; k++) if (got[k]) reach++;
    assert.ok(reach / walk > 0.97, seed + ' connected ' + (reach / walk).toFixed(3));
    for (let qz = -1; qz <= 1; qz++) for (let qx = -1; qx <= 1; qx++) for (const p of W.cell(Math.floor(W.spawn.x / Q) + qx, Math.floor(W.spawn.z / Q) + qz).pockets) { const i = Math.floor((p.x - ox) / S), j = Math.floor((p.z - oz) / S); if (i > 0 && j > 0 && i < n && j < n) assert.ok(got[j * n + i], seed + ' pocket ' + p.type + ' reachable'); }
    // the longest stretch of a straight 3 km drive with no pocket within 90 m of the line is under 60 s at 9 m/s (540 m)
    for (let d = 0; d < 6; d++) { const a = d * 1.0471975 + 0.3, dx = Math.cos(a), dz = Math.sin(a); let last = 0, gap = 0;
      for (let t = 0; t <= 3000; t += 10) { const x = W.spawn.x + dx * t, z = W.spawn.z + dz * t; let near = false;
        for (let j = -1; j <= 1 && !near; j++) for (let i = -1; i <= 1 && !near; i++) { const C = W.cell(Math.floor(x / Q) + i, Math.floor(z / Q) + j); for (const p of [...C.pockets, ...C.extras]) if (Math.hypot(p.x - x, p.z - z) < 90) { near = true; break; } }
        if (near) last = t; gap = Math.max(gap, t - last); }
      assert.ok(gap <= 540, seed + ' drive ' + d + ' gap ' + gap + ' m'); }
  }
});

test('big world: a run on it starts in the open, the things of the cells near the duelist are placed and the ground follows them', () => {
  const g = new Game(4711, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }); g.god = true;
  assert.ok(g.map.big && g.openFlow); assert.ok(g.world.vases.length > 10 && g.world.shrines.length + g.world.stones.length + g.world.cchests.length >= 3, 'pockets near the start');
  const n0 = g.world.vases.length + g.world.cchests.length + g.world.shrines.length + g.world.stones.length;
  for (let i = 0; i < 20 * 60; i++) g.step(STEP, Object.assign({}, IDLE, { f: 1 }));
  g.p.x += 900; g.p.y = heightAt(g.p.x, g.p.z); for (let i = 0; i < 120; i++) g.step(STEP, IDLE);
  assert.ok(g.world.vases.length + g.world.cchests.length + g.world.shrines.length + g.world.stones.length > n0, 'new pockets were placed 900 m on'); assert.ok(g.fog.count > 100 && g.fog.big, 'the fog opens as the duelist goes');
  assert.ok(heightAt(g.p.x, g.p.z) < 50 && Math.abs(g.p.y - heightAt(g.p.x, g.p.z)) < 5, 'standing on the ground');
});

test('big world door: stages are 12 minutes, the door rises near the duelist between 8:00 and 10:00 (never a beam), and waking it is still hold-to-wake', () => {
  for (const seed of [11, 4711, 90210, 77, 31337, 5, 123456, 8080]) {
    const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }); g.god = true; g.spawnAcc = -1e9;
    assert.equal(g.stageSpec.clock, 720); assert.deepEqual(g.stageSpec.doorRise, [480, 600]); assert.equal(g.door.state, 'hidden'); assert.ok(g.door.base >= 480 && g.door.base <= 600);
    assert.ok(g.map.gate.x > 1e6, 'the gate is parked off the world until the door rises');
    let t = 0; const banners = []; const ev = g.event.bind(g); g.event = (k, d) => { if (k === 'banner') banners.push(d); ev(k, d); };
    while (g.door.state === 'hidden' && t < 700 * 60) { g.step(STEP, IDLE); t++; g.p.hp = g.p.maxHp; }
    assert.equal(g.door.state, 'risen'); assert.ok(g.sc >= 479 && g.sc <= 601, seed + ' rose at ' + g.sc);
    const dd = Math.hypot(g.map.gate.x - g.p.x, g.map.gate.z - g.p.z); assert.ok(dd >= 150 && dd <= 300, seed + ' door ' + Math.round(dd) + ' m away');
    assert.ok(banners.some(b => /door has risen/.test(b))); assert.ok(heightAt(g.map.gate.x, g.map.gate.z) < 50);
    // hold to wake: standing at it for 0.5 s does nothing, 2 s (after it has finished rising) wakes the stage boss
    g.p.x = g.map.gate.x + 1; g.p.z = g.map.gate.z; g.p.y = heightAt(g.p.x, g.p.z); for (let i = 0; i < 6 * 60; i++) g.step(STEP, IDLE); assert.equal(g.gate.state, 'closed');
    for (let i = 0; i < 2.2 * 60; i++) g.step(STEP, Object.assign({}, IDLE, { use: true })); assert.equal(g.gate.state, 'fight', seed + ' boss woken');
  }
});

test('big world door: each elite or mini boss felled makes it rise 30 s sooner, never before 6:00', () => {
  const g = new Game(4711, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }); const base = g.door.base;
  g.elitesKilled += 1; assert.equal(Math.round(g.door.base - 30), Math.round(base - 30)); g.step(STEP, IDLE); assert.equal(Math.round(g.door.at), Math.round(Math.max(360, base - 30)));
  g.elitesKilled += 20; g.step(STEP, IDLE); assert.equal(g.door.at, 360);
});
