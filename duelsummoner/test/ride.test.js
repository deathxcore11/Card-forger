import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { heightAt } from '../src/sim/terrain.js';
import { RIDE, comboValue, flowOf } from '../src/sim/ride.js';
import { railsNear } from '../src/sim/rails.js';
import { spawnEnemy } from '../src/sim/enemies.js';
const STEP = 1 / 60, I = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false, hold: false };
const mk = () => { const g = new Game(4711, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }); g.god = true; g.spawnAcc = -1e9; return g; };
const run = (g, n, cmd) => { for (let i = 0; i < n; i++) g.step(STEP, typeof cmd === 'function' ? cmd(i) : cmd || I); };
// find flat ground near the start to ride on
function flatSpot(g) { for (let r = 30; r < 600; r += 7) for (let a = 0; a < 6.28; a += 0.3) { const x = g.p.x + Math.cos(a) * r, z = g.p.z + Math.sin(a) * r, h = heightAt(x, z); let ok = h < 50; for (let k = 1; k <= 30 && ok; k++) if (Math.abs(heightAt(x, z - k) - h) > 0.25 * k / 10 + 0.15) ok = false; if (ok) return [x, z]; } return [g.p.x, g.p.z]; }
const place = (g, x, z, speed) => { g.p.x = x; g.p.z = z; g.p.y = heightAt(x, z); g.p.grounded = true; g.p.vx = 0; g.p.vz = -speed; g.p.vy = 0; };

test('ride: above 10.5 m/s the duelist steps on the card; below 7 m/s on the ground steps off', () => {
  const g = mk(), [x, z] = flatSpot(g); place(g, x, z, 13); run(g, 2, { ...I, f: 1 }); assert.ok(g.p.ride && g.p.ride.on, 'riding'); 
  place(g, x, z, 5); g.p.ride.speed = 5; run(g, 3); assert.equal(g.p.ride.on, false, 'stepped off');
});
test('ride: hold jump to crouch, release to pop: a short tap about 2.2 m, a full half-second crouch about 4.5 m', () => {
  for (const [hold, lo, hi] of [[1, 1.8, 2.8], [32, 3.8, 5.0]]) {
    const g = mk(), [x, z] = flatSpot(g); place(g, x, z, 14); run(g, 2, { ...I, f: 1 }); const y0 = g.p.y; let top = y0;
    run(g, hold, { ...I, f: 1, jump: true }); run(g, 70, i => { top = Math.max(top, g.p.y); return { ...I, f: 1 }; });
    assert.ok(top - y0 > lo && top - y0 < hi, 'hold ' + hold + ' ticks: ' + (top - y0).toFixed(2) + ' m');
  }
});
test('ride: a flip in the air landed clean banks a combo, slams and raises Flow; landing mid-flip bails and costs a Flow step', () => {
  const g = mk(), [x, z] = flatSpot(g); place(g, x, z, 14); run(g, 2, { ...I, f: 1 });
  for (let i = 0; i < 6; i++) spawnEnemy(g, 'husk', { x: g.p.x + 2 + i * 0.5, z: g.p.z - 6 });
  const k0 = g.kills; run(g, 30, { ...I, f: 1, jump: true }); run(g, 2, { ...I, f: 1 }); run(g, 1, { ...I, f: 1, dash: true }); run(g, 120, { ...I, f: 1 });
  const F = flowOf(g); assert.ok(F.banked > 0, 'banked ' + F.banked); assert.ok(F.slams >= 1, 'a slam'); assert.ok(g.kills > k0, 'the slam killed');
  F.step = 3; place(g, g.p.x, g.p.z, 14); run(g, 2, { ...I, f: 1 }); run(g, 30, { ...I, f: 1, jump: true }); run(g, 200, i => ({ ...I, f: 1, slide: i < 120 }));
  assert.ok(F.step <= 2, 'a grab held into the landing bails: Flow ' + F.step);
});
test('ride: rails exist (beams, card tops, mesa rims), the card snaps onto one in reach and grinds along it', () => {
  const g = mk(); let rail = null; for (let r = 20; r < 1500 && !rail; r += 40) { const L = railsNear(g, g.p.x + r, g.p.z, 60); rail = L.find(s => Math.hypot(s[3] - s[0], s[5] - s[2]) > 5 && Math.abs(s[4] - s[1]) < 1 && s[1] < 30); }
  assert.ok(rail, 'a rail');
  const mx = (rail[0] + rail[3]) / 2, mz = (rail[2] + rail[5]) / 2, my = (rail[1] + rail[4]) / 2, ux = (rail[3] - rail[0]), uz = (rail[5] - rail[2]), L = Math.hypot(ux, uz);
  g.p.ride = undefined; g.p.x = mx - ux / L * 1.5; g.p.z = mz - uz / L * 1.5; g.p.y = my + 1.0; g.p.vx = ux / L * 12; g.p.vz = uz / L * 12; g.p.vy = -1; g.p.grounded = false;
  // force the ride on, already airborne
  run(g, 1); if (!g.p.ride || !g.p.ride.on) { g.p.ride.on = true; g.p.ride.speed = 12; g.p.ride.heading = Math.atan2(g.p.vx, g.p.vz); }
  let ground = false; run(g, 20, i => { if (g.p.ride.grind) ground = true; return { ...I, use: i === 0 }; });
  assert.ok(ground, 'snapped onto the rail');
});
// flat ground with nothing solid in the 25 m run ahead (toward -z)
function clearFlat(g) { const C = g.colliders; for (let r = 30; r < 900; r += 7) for (let a = 0; a < 6.28; a += 0.3) { const x = g.p.x + Math.cos(a) * r, z = g.p.z + Math.sin(a) * r, h = heightAt(x, z); let ok = h < 50; for (let k = 1; k <= 30 && ok; k++) if (Math.abs(heightAt(x, z - k) - h) > 0.25 * k / 10 + 0.15) ok = false; if (!ok) continue; if (C.ensure) C.ensure(x - 5, z - 30, x + 5, z + 2); if (C.list.some(c => Math.abs(c.x - x) < c.r + 1.5 && c.z < z + 2 && c.z > z - 30)) continue; return [x, z]; } return [g.p.x, g.p.z]; }
test('ride: on dead-flat ground SLIDE after running at full speed kicks the card out within 1 s, on 5 seeds; pulling back brakes and steps off', () => {
  for (const seed of [4711, 9, 21, 77, 1234]) {
    const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }); g.god = true; g.spawnAcc = -1e9;
    const [x, z] = clearFlat(g); place(g, x, z, 0); let t = 0;
    while (!(g.p.ride && g.p.ride.on) && t < 60) { run(g, 1, { ...I, f: 1, slide: t >= 30 }); t++; }       // run half a second, then hold slide
    assert.ok(g.p.ride && g.p.ride.on, 'seed ' + seed + ': mounted'); assert.ok(t <= 60, 'within 1 s: ' + t + ' ticks');
    assert.ok(g.p.ride.speed >= 12, 'pushed to 12.5 m/s: ' + g.p.ride.speed.toFixed(1));
    run(g, 20, { ...I, f: 1, slide: true }); assert.ok(!g.p.ride.manual, 'the slide held from the kick is not a manual');
    let n = 0; while (g.p.ride.on && n < 120) { run(g, 1, { ...I, f: -1 }); n++; } assert.equal(g.p.ride.on, false, 'braked off in ' + n + ' ticks');
  }
});
test('ride: grinding a stone card lights it for good, and seal stones lit inside one combo open a chest', async () => {
  const { litOf } = await import('../src/sim/ride.js'); const { sealsNear } = await import('../src/sim/rails.js');
  const g = mk(); let card = null; for (let r = 20; r < 2500 && !card; r += 40) for (const a of [0, 1.57, 3.14, 4.71]) { const L = railsNear(g, g.p.x + Math.cos(a) * r, g.p.z + Math.sin(a) * r, 60); card = card || L.find(s => s[6] === 'card'); }
  assert.ok(card, 'a stone card rail');
  const ux = card[3] - card[0], uz = card[5] - card[2], L = Math.hypot(ux, uz);
  g.p.ride = undefined; g.p.x = (card[0] + card[3]) / 2 - ux / L * 0.6; g.p.z = (card[2] + card[5]) / 2 - uz / L * 0.6; g.p.y = card[1] + 0.8; g.p.vx = ux / L * 12; g.p.vz = uz / L * 12; g.p.vy = -1; g.p.grounded = false;
  run(g, 1); if (!g.p.ride.on) { g.p.ride.on = true; g.p.ride.speed = 12; g.p.ride.heading = Math.atan2(g.p.vx, g.p.vz); } run(g, 3);
  assert.equal(Object.keys(litOf(g).cards).length, 1, 'the card is lit');
  // seal stones: find a set and pass over all five while the combo stays open
  let set = null; for (let r = 0; r < 3000 && !set; r += 60) for (const a of [0, 1.57, 3.14, 4.71]) { const S = sealsNear(g, g.p.x + Math.cos(a) * r, g.p.z + Math.sin(a) * r, 80); if (S.length) { set = S[0][3]; break; } }
  assert.ok(set !== null, 'a seal set exists');
  const { sealSet } = await import('../src/sim/rails.js'); const stones = sealSet(g, set); assert.ok(stones.length >= 3, 'stones: ' + stones.length);
  const n0 = g.world.cchests.length; g.p.ride.grind = null; g.p.ride.combo.pts = 1;
  for (const s of stones) { g.p.x = s[0]; g.p.z = s[2]; g.p.y = s[1] + 2; g.p.grounded = false; g.p.vy = 4; g.p.ride.on = true; g.p.ride.speed = 3; run(g, 1); }
  assert.equal(g.world.cchests.length, n0 + 1, 'the set opened a chest'); assert.ok(litOf(g).sealsDone[set], 'the set is done');
});
test('ride: a banked landing makes every summon strike at once', async () => {
  const g = mk(), [x, z] = flatSpot(g); place(g, x, z, 14); run(g, 2, { ...I, f: 1 });
  g.field.monsters[0] = g.field.monsters[0] || null; const ms = g.field.monsters.filter(Boolean);
  for (const m of ms) m.cd = 5; run(g, 30, { ...I, f: 1, jump: true }); run(g, 2, { ...I, f: 1 }); run(g, 1, { ...I, f: 1, dash: true });
  let hit = false; for (let i = 0; i < 120 && !hit; i++) { run(g, 1, { ...I, f: 1 }); if (flowOf(g).slams > 0) hit = true; }
  assert.ok(hit, 'banked'); for (const m of ms) assert.ok(m.cd < 4.5, 'summon cooldown cut: ' + m.cd);
});
test('ride: holding the stick forward up a 15-degree climb never drops the rider off, charging an ollie included; braking still does', () => {
  const g = mk(); let spot = null;
  // a real climb near the start: rising at least 13 to 20 degrees over 14 m toward -z
  for (let r = 0; r < 1500 && !spot; r += 9) for (let a = 0; a < 6.28 && !spot; a += 0.35) { const x = g.p.x + Math.cos(a) * r, z = g.p.z + Math.sin(a) * r, h0 = heightAt(x, z); let ok = true; for (let k = 2; k <= 14 && ok; k += 2) { const s = (heightAt(x, z - k) - heightAt(x, z - k + 2)) / 2; if (s < 0.23 || s > 0.37) ok = false; } if (ok && h0 < 60) spot = [x, z]; }
  assert.ok(spot, 'a 15-degree climb');
  place(g, spot[0], spot[1] + 4, 12.3); run(g, 2, { ...I, f: 1 }); assert.ok(g.p.ride.on, 'riding');
  let off = false; for (let i = 0; i < 90; i++) { run(g, 1, { ...I, f: 1, jump: i > 40 && i < 70 }); if (!g.p.ride.on) off = true; }
  assert.equal(off, false, 'still on the card at ' + g.p.ride.speed.toFixed(1) + ' m/s');
  let n = 0; while (g.p.ride.on && n < 240) { run(g, 1, { ...I, f: -1 }); n++; } assert.equal(g.p.ride.on, false, 'the brake still takes the rider off');
});
test('ride: passing a trunk within a hand at speed counts a Close Call, once per trunk', () => {
  const g = mk(), [x, z] = flatSpot(g); place(g, x, z, 16); run(g, 2, { ...I, f: 1 }); const C = g.colliders;
  const c = { x: g.p.x + 1.2, y: g.p.y - 1, z: g.p.z - 8, r: 0.4, top: g.p.y + 9 }, k = Math.floor(c.x / C.CELL) * 4096 + Math.floor(c.z / C.CELL); let a = C.grid.get(k); if (!a) C.grid.set(k, a = []); a.push(c);
  run(g, 50, { ...I, f: 1 }); assert.equal(g.p.ride.combo.names['Close Call'], 1, JSON.stringify(g.p.ride.combo.names));
});
test('ride: the spin button turns the card in the air (counted in 180s); landing assist lets a grab held into touchdown land clean at low Flow', () => {
  const g = mk(), [x, z] = flatSpot(g); place(g, x, z, 14); run(g, 2, { ...I, f: 1 });
  run(g, 30, { ...I, f: 1, jump: true }); run(g, 2, { ...I, f: 1 }); let names = null;
  for (let i = 0; i < 200 && !names; i++) { run(g, 1, { ...I, f: 1, spin: i < 20 ? 1 : 0 }); if (g.p.grounded) names = Object.keys(flowOf(g)).length && g.p.ride.combo; }
  assert.ok(flowOf(g).banked > 0 && flowOf(g).step >= 1, 'banked a spin');
  const h = mk(); h.opts.rideAssist = true; const [x2, z2] = flatSpot(h); place(h, x2, z2, 14); run(h, 2, { ...I, f: 1 }); run(h, 30, { ...I, f: 1, jump: true }); run(h, 200, i => ({ ...I, f: 1, slide: i < 120 }));
  assert.equal(flowOf(h).step >= 1 && h.p.ride.bailT <= 0, true, 'no bail'); assert.ok(flowOf(h).banked > 0, 'the grab banked: ' + flowOf(h).banked);
});
test('ride school: a line of beams ahead of the spawn, grindable', async () => {
  const g = mk(), W = g.map.world; assert.ok(W.school && W.school.length >= 2, 'school beams: ' + (W.school || []).length);
  const s = W.school[0], L = railsNear(g, (s[0] + s[2]) / 2, (s[1] + s[3]) / 2, 3); assert.ok(L.length >= 1, 'a rail there');
});
test('ride (classic pad): a stick flick up then down starts a manual, held until an ollie; R2 before touchdown is a revert; two directions then flip at full Flow is the special', () => {
  const g = mk(), [x, z] = flatSpot(g); place(g, x, z, 14); run(g, 2, { ...I, f: 1 });
  run(g, 3, { ...I, f: 1 }); run(g, 3, { ...I, f: -1 }); run(g, 1, { ...I, f: 0.1 }); assert.ok(g.p.ride.manual, 'manual from a flick');
  run(g, 20, { ...I, f: 0.1 }); assert.ok(g.p.ride.manual, 'it holds with no button');
  run(g, 1, { ...I, f: 0.1, jump: true }); assert.ok(!g.p.ride.manual, 'an ollie ends it'); assert.ok(g.p.ride.combo.names.Manual, 'counted');
  const h = mk(), [x2, z2] = flatSpot(h); place(h, x2, z2, 14); run(h, 2, { ...I, f: 1 }); const F = flowOf(h); F.step = 5; h.p.ride.specialReady = true;
  run(h, 30, { ...I, f: 1, jump: true }); run(h, 4, { ...I, f: 1 }); run(h, 3, { ...I, f: 0, r: 1 }); run(h, 1, { ...I, f: 0, r: 1, dash: true });
  assert.ok(h.p.ride.combo.names['Royal Flush'], 'special: ' + JSON.stringify(h.p.ride.combo.names));
});
test('the wonder: every seed has a long ride line with five seal stones; lighting all five in one combo opens an epic chest', async () => {
  const { sealSet } = await import('../src/sim/rails.js'); let n = 0;
  for (let s = 0; s < 12; s++) { const g = new Game(2000 + s * 53, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }); const w = g.map.world.wonder; if (w && w.beams.length >= 5 && sealSet(g, -1).length === 5) n++; }
  assert.equal(n, 12, 'seeds with a whole wonder: ' + n);
  const g = mk(); g.god = true; const stones = sealSet(g, -1), n0 = g.world.cchests.length; place(g, stones[0][0], stones[0][2], 12); run(g, 2, { ...I, f: 1 }); g.p.ride.on = true; g.p.ride.combo.pts = 1;
  for (const s of stones) { g.p.x = s[0]; g.p.z = s[2]; g.p.y = s[1] + 2; g.p.grounded = false; g.p.vy = 4; g.p.ride.on = true; g.p.ride.speed = 3; g.p.ride.grind = null; run(g, 1); }
  assert.equal(g.world.cchests.length, n0 + 1, 'a chest'); assert.equal(g.world.cchests[n0].rarity, 'epic');
});
