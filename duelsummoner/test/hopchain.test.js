// Slide-jump (fix list part 5, movement flow 3, owner decision: real speed tech). Rules, all constants in tuning (K.hop*):
// a slide hop (a jump within 6 ticks of landing with slide held, or out of a slide) keeps the horizontal speed and adds 8% of run speed per chained hop, up to 1.6x run speed;
// a late hop resets the chain and gives nothing; a wall or a hit takes the bonus away (a hit takes half); a dash into a slide within 6 ticks of the dash's end starts at 1.25x.
import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js'; import { heightAt } from '../src/sim/terrain.js'; import { hashHex } from '../src/sim/hash.js'; import { K } from '../src/data/tuning.js'; import { CFG } from '../src/data/config.js';
const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false };
const mk = seed => { const g = new Game(seed, { oldGen: true, mode: 'run', duelist: 'kael', offers: false }); g.god = true; g.spawnAcc = -1e9; g.colliders = null; return g; };
// a flat strip at least 400 m long along -z is not available, so the test runs along a long flat circle-free line and turns back when the strip ends: the player is simply put back at the start (speed kept)
function strip(len) { for (let z0 = 150; z0 > -150; z0 -= 3) for (let x0 = -150; x0 < 150; x0 += 3) { let ok = true; for (let d = 0; d < len && ok; d++) { if (heightAt(x0, z0 - d) !== 0 || heightAt(x0 + 1.5, z0 - d) !== 0 || heightAt(x0 - 1.5, z0 - d) !== 0) ok = false; } if (ok) return [x0, z0]; } return null; }
const speedOf = p => Math.sqrt(p.vx * p.vx + p.vz * p.vz);
function start(g, at) { const p = g.p; p.x = at[0]; p.z = at[1]; p.y = 0; p.vx = p.vz = 0; p.grounded = true; g.step(1 / 60, idle); for (let i = 0; i < 90; i++) g.step(1 / 60, { ...idle, f: 1 }); return p; }
function relocate(g, at) { const p = g.p; if (p.z < at[1] - 60) { p.z += 55; } }

test('slide-jump: a 20 s chain with frame-perfect input reaches the cap and never goes over it', () => {
  const g = mk(1), at = strip(80); assert.ok(at, 'a flat strip'); const p = start(g, at), R = CFG.player.speed * (1 + g.mods.move), cap = CFG.player.hop ? CFG.player.hop.cap : K.hopCap * R; let top = 0, ticks = 0;
  for (let i = 0; i < 60 * 20; i++) { relocate(g, at); g.step(1 / 60, { ...idle, f: 1, jump: true, slide: true }); const s = speedOf(p); if (s > top) top = s; ticks++; assert.ok(s <= cap + 1e-6, 'tick ' + i + ' speed ' + s + ' over the cap ' + cap); }
  assert.ok(top >= cap - 0.05, 'the chain reaches the cap: top ' + top.toFixed(3) + ' of ' + cap.toFixed(3));
  assert.ok(Math.abs(K.hopGain - 0.08) < 1e-9 && Math.abs(K.hopCap - 1.6) < 1e-9 && K.hopWindow === 6, 'the numbers are the owner\'s: +8% a hop, 1.6x, 6 ticks');
});

test('slide-jump: every hop 8 ticks late never goes over run speed', () => {
  const g = mk(2), at = strip(80), p = start(g, at), R = CFG.player.speed * (1 + g.mods.move); let top = 0, since = 99, was = true;
  for (let i = 0; i < 60 * 20; i++) { relocate(g, at); const hop = p.grounded && since >= 8; g.step(1 / 60, { ...idle, f: 1, jump: hop, slide: true }); if (p.grounded) since = was ? since + 1 : 0; else since = 0; was = p.grounded; top = Math.max(top, speedOf(p)); }
  assert.ok(top <= R + 1e-6, 'late hops: top ' + top + ' over run speed ' + R);
});

test('slide-jump: a hit takes half the bonus', () => {
  const g = mk(3), at = strip(80), p = start(g, at), R = CFG.player.speed * (1 + g.mods.move);
  for (let i = 0; i < 60 * 12; i++) { relocate(g, at); g.step(1 / 60, { ...idle, f: 1, jump: true, slide: true }); }
  const s0 = speedOf(p), bonus = s0 - R; assert.ok(bonus > 2, 'there is a bonus to lose: ' + bonus); g.god = false; g.hurtPlayer(5, false, 'swarm'); const s1 = speedOf(p);
  assert.ok(Math.abs((s1 - R) - bonus / 2) < 1e-6, 'half the bonus is left: ' + (s1 - R) + ' of ' + bonus);
});

test('slide-jump: a dash into a slide within 6 ticks of its end starts the slide at 1.25x run speed', () => {
  const g = mk(5), at = strip(60), p = start(g, at), R = CFG.player.speed * (1 + g.mods.move);
  g.step(1 / 60, { ...idle, f: 1, dash: true }); for (let i = 0; i < 12 && p.dashT > 0; i++) g.step(1 / 60, { ...idle, f: 1 });
  g.step(1 / 60, { ...idle, f: 1 }); g.step(1 / 60, { ...idle, f: 1, slide: true });
  assert.ok(p.sliding, 'the slide started'); assert.ok(Math.abs(p.slideSpeed - K.hopDashSlide * R) < 0.2, 'slide speed ' + p.slideSpeed + ' vs ' + K.hopDashSlide * R);
});

test('slide-jump: the same tape gives the same replay hash twice, and the carry state is in the hash', () => {
  const run = () => { const g = mk(6), at = strip(80), p = start(g, at); for (let i = 0; i < 60 * 8; i++) { relocate(g, at); g.step(1 / 60, { ...idle, f: 1, jump: i % 50 < 40, slide: true, r: (i % 97) < 10 ? 0.4 : 0 }); } return hashHex(g); };
  const a = run(), b = run(); assert.equal(a, b, 'identical');
  const g = mk(6); const h0 = hashHex(g); g.p.chain = 3; assert.notEqual(hashHex(g), h0, 'the hop chain is hashed');
});

import { loadMap } from '../src/sim/terrain.js';
function withBlock(g, prim) { g.map.prims.push(prim); loadMap(g.map); }
test('slide-jump: a wall, or a step up of more than 0.5 m, drops carried speed to run speed and ends the chain', () => {
  for (const [name, h] of [['wall', 5], ['step', 0.55]]) {
    const g = mk(8), at = strip(80), R = CFG.player.speed * (1 + g.mods.move); withBlock(g, { t: 'box', x0: at[0] - 10, x1: at[0] + 10, z0: at[1] - 40, z1: at[1] - 20, h, c: 0x808080 });
    const p = g.p; p.x = at[0]; p.z = at[1] - 8; p.y = 0; p.grounded = true; g.step(1 / 60, idle); p.chain = 5; p.hopped = true; p.vx = 0; p.vz = -1.5 * R; let worst = 0;
    for (let i = 0; i < 90; i++) { g.step(1 / 60, { ...idle, f: 1 }); if (p.z < at[1] - 19) worst = Math.max(worst, speedOf(p)); }
    assert.ok(worst <= R + 1e-6, name + ': speed after the obstacle ' + worst + ' over run speed ' + R); assert.equal(p.chain, 0, name + ' ends the chain');
  }
});

test('slide-jump: a slide may reach 2.0x run speed on a downward slope; on the flat anything above 1.6x falls to 1.6x over 18 ticks', () => {
  const g = mk(9), at = strip(80), R = CFG.player.speed * (1 + g.mods.move), p = g.p; assert.equal(K.hopSlideDown, 2.0);
  withBlock(g, { t: 'ramp', axis: 'z', a0: at[1] - 10, a1: at[1] - 40, b0: at[0] - 6, b1: at[0] + 6, h0: 6, h1: 0, c: 0x808080 });       // a slope going down toward -z
  p.x = at[0]; p.z = at[1] - 10; p.y = 6; p.grounded = true; g.step(1 / 60, idle); p.vx = 0; p.vz = -1.5 * R; let top = 0;
  for (let i = 0; i < 40; i++) { g.step(1 / 60, { ...idle, f: 1, slide: true }); top = Math.max(top, speedOf(p)); }
  assert.ok(top > 1.6 * R + 0.05 && top <= 2.0 * R + 1e-6, 'downhill slide reaches ' + (top / R).toFixed(2) + 'x');
  const f = mk(10), at2 = strip(80), q = f.p; q.x = at2[0]; q.z = at2[1]; q.y = 0; q.grounded = true; f.step(1 / 60, idle); q.vx = 0; q.vz = -1.95 * R; q.sliding = true; q.slideSpeed = 1.95 * R;
  for (let i = 0; i < 20; i++) f.step(1 / 60, { ...idle, f: 1, slide: true }); assert.ok(q.slideSpeed <= 1.6 * R + 1e-6, 'on the flat it is back to 1.6x after 18 ticks: ' + (q.slideSpeed / R).toFixed(3));
});

