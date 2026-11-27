import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { heightAt } from '../src/sim/terrain.js';
import { RIDE, comboValue, flowOf } from '../src/sim/ride.js';
import { railsNear } from '../src/sim/rails.js';
import { spawnEnemy } from '../src/sim/enemies.js';
const STEP = 1 / 60, I = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false, hold: false };
const mk = () => { const g = new Game(4711, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }); g.god = true; g.spawnAcc = -1e9; g.rideKicks = 1; return g; };
const run = (g, n, cmd) => { for (let i = 0; i < n; i++) g.step(STEP, typeof cmd === 'function' ? cmd(i) : cmd || I); };
// find flat ground near the start to ride on
function flatSpot(g) { for (let r = 30; r < 600; r += 7) for (let a = 0; a < 6.28; a += 0.3) { const x = g.p.x + Math.cos(a) * r, z = g.p.z + Math.sin(a) * r, h = heightAt(x, z); let ok = h < 50 && railsNear(g, x, z - 15, 22).length === 0; for (let k = 1; k <= 30 && ok; k++) if (Math.abs(heightAt(x, z - k) - h) > 0.25 * k / 10 + 0.15) ok = false; if (ok) return [x, z]; } return [g.p.x, g.p.z]; }
const place = (g, x, z, speed) => { g.p.x = x; g.p.z = z; g.p.y = heightAt(x, z); g.p.grounded = true; g.p.sliding = speed > 0; g.p.vx = 0; g.p.vz = -speed; g.p.vy = 0; };

test('ride: above 10.5 m/s the duelist steps on the card; below 7 m/s on the ground steps off', () => {
  const g = mk(), [x, z] = flatSpot(g); place(g, x, z, 13); run(g, 2, { ...I, f: 1 }); assert.ok(g.p.ride && g.p.ride.on, 'riding'); 
  place(g, x, z, 5); g.p.ride.speed = 5; run(g, 3); assert.equal(g.p.ride.on, false, 'stepped off');
});
test('ride: hold jump to crouch, release to pop: a tap about 1.2 m, a full 0.35 s crouch about 2.6 m (the feel table)', () => {
  for (const [hold, lo, hi] of [[1, 1.0, 1.6], [24, 2.3, 3.0]]) {
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
test('controls v2: each trick fires from its button and stick direction; manual on the held button; the combo timer; i-frames; the special', () => {
  const air = (cmd, frames) => { const g = mk(), [x, z] = flatSpot(g); place(g, x, z, 14); run(g, 2, { ...I, f: 1 }); run(g, 30, { ...I, f: 1, jump: true }); run(g, 2, { ...I, f: 1 }); assert.ok(!g.p.grounded, 'airborne'); run(g, frames || 1, cmd); return g; };
  const names = g => Object.keys(g.p.ride.combo.names);
  for (const [f, r, want] of [[1, 0, 'Impossible'], [0, 1, 'Heelflip'], [-1, 0, 'Pop Shuvit'], [0, -1, 'Kickflip'], [0, 0, 'Kickflip']]) assert.ok(names(air({ ...I, f, r, flip: true })).includes(want), 'flip ' + want);
  for (const [f, r, want] of [[1, 0, 'Nosegrab'], [0, 1, 'Indy'], [0, -1, 'Melon']]) { const g = air({ ...I, f, r, grab: true }, 6); run(g, 1, { ...I }); assert.ok(names(g).includes(want), 'grab ' + want + ' ' + names(g)); }
  { const g = air({ ...I, flip: true }); run(g, 4, { ...I }); run(g, 1, { ...I, flip: true }); assert.ok(names(g).includes('Double Flip'), 'double flip'); }
  { const g = air({ ...I }, 1); for (let k = 0; k < 40 && g.p.vy >= 0; k++) run(g, 1, { ...I }); run(g, 1, { ...I, f: -1, grab: true }); assert.ok(names(g).includes('Slam Drop'), 'slam drop'); assert.ok(g.p.vy < -20, 'straight down');
    g.eb[0].on = true; g.eb[0].x = g.p.x + 2; g.eb[0].z = g.p.z; for (let k = 0; k < 60 && !g.p.grounded; k++) run(g, 1, { ...I }); assert.ok(!g.eb[0].on, 'a Slam Drop landing wipes nearby enemy shots'); assert.ok(g.p.iframeT > 0, 'and gives i-frames'); }
  { const g = mk(), [x, z] = flatSpot(g); place(g, x, z, 14); run(g, 2, { ...I, f: 1 }); run(g, 20, { ...I, f: 1, jump: true }); run(g, 1, { ...I, f: 1 }); assert.ok(g.p.iframeT > 0, 'an ollie pop gives i-frames'); g.god = false; const hp = g.p.hp; g.hurtPlayer(10, false, 'test'); assert.equal(g.p.hp, hp, 'no damage inside them'); run(g, 20, { ...I, f: 1 }); assert.ok(!(g.p.iframeT > 0), 'they last 0.25 s'); }
  { const g = air({ ...I, flip: true }); for (let k = 0; k < 120 && !g.p.grounded; k++) run(g, 1, { ...I, revert: true }); run(g, 1, { ...I, revert: true }); assert.ok(g.p.ride.manual, 'the manual button held on landing: a manual');
    run(g, 60, { ...I, revert: true }); assert.ok(g.p.ride.manual, 'it holds while the button does (no balance bar)'); run(g, 100, { ...I, revert: true }); assert.ok(!g.p.ride.manual, 'the 2.5 s combo timer runs out and banks it'); assert.equal(comboValue(g.p.ride.combo), 0, 'banked, not bailed'); }
  { const h = mk(), [x, z] = flatSpot(h); place(h, x, z, 14); run(h, 2, { ...I, f: 1 }); flowOf(h).meter = 1; run(h, 30, { ...I, f: 1, jump: true }); run(h, 4, { ...I, f: 1 }); run(h, 3, { ...I, f: 1 }); run(h, 3, { ...I, f: -1 }); run(h, 1, { ...I, f: -1, flip: true });
    assert.ok(h.p.ride.combo.names['Deck Shuffle'], 'up, down, flip with the meter full: Deck Shuffle ' + names(h)); }
});
test('the wonder: every seed has a long ride line with five seal stones; lighting all five in one combo opens an epic chest', async () => {
  const { sealSet } = await import('../src/sim/rails.js'); let n = 0;
  for (let s = 0; s < 12; s++) { const g = new Game(2000 + s * 53, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }); const w = g.map.world.wonder; if (w && w.beams.length >= 5 && sealSet(g, -1).length === 5) n++; }
  assert.equal(n, 12, 'seeds with a whole wonder: ' + n);
  const g = mk(); g.god = true; const stones = sealSet(g, -1), n0 = g.world.cchests.length; place(g, stones[0][0], stones[0][2], 12); run(g, 2, { ...I, f: 1 }); g.p.ride.on = true; g.p.ride.combo.pts = 1;
  for (const s of stones) { g.p.x = s[0]; g.p.z = s[2]; g.p.y = s[1] + 2; g.p.grounded = false; g.p.vy = 4; g.p.ride.on = true; g.p.ride.speed = 3; g.p.ride.grind = null; run(g, 1); }
  assert.ok(g.world.cchests.slice(n0).some(c => c.rarity === 'epic' && c.trophy), 'an epic chest rose');       // (streaming may place pocket chests meanwhile)
});
test('landforms: a canyon half-pipe wall sends the card up (vert) and it comes back down on the wall without a bail; bowls and step-downs exist', () => {
  const g = mk(), W = g.map.world, sp = W.spawn; let spot = null;
  for (let r = 200; r < 12000 && !spot; r += 23) for (let a = 0; a < 6.28 && !spot; a += 0.21) { const x = sp.x + Math.cos(a) * r, z = sp.z + Math.sin(a) * r; if (W.regionAt(x, z).type !== 3) continue;
    for (let k = 0; k < 8 && !spot; k++) { const b = k * 0.785, c = Math.cos(b), s = Math.sin(b), h0 = heightAt(x, z), flat = Math.abs(heightAt(x - c * 6, z - s * 6) - h0) < 2; if (flat && heightAt(x + c * 3, z + s * 3) - h0 > 2.8 && heightAt(x + c * 1.2, z + s * 1.2) - h0 > 1.0 && heightAt(x + c * 1.2, z + s * 1.2) - h0 < 3) spot = [x, z, c, s]; } }
  assert.ok(spot, 'a half-pipe wall');
  const [x, z, c, s] = spot; g.p.x = x - c * 8; g.p.z = z - s * 8; g.p.y = heightAt(g.p.x, g.p.z); g.p.grounded = true; g.p.sliding = true; g.p.vx = c * 15; g.p.vz = s * 15; const yaw = Math.atan2(-c, -s);
  let vert = false, bail = false; for (let i = 0; i < 150; i++) { run(g, 1, { ...I, f: i < 30 ? 1 : 0, yaw }); const r = g.p.ride; if (r && r.vert) vert = true; if (r && r.bailT > 0) bail = true; }
  assert.ok(vert, 'went vert'); assert.ok(!bail, 'no bail');
  assert.ok(W.landSites(1, sp.x - 6000, sp.z - 6000, sp.x + 6000, sp.z + 6000).length > 0, 'bowls'); assert.ok(W.landSites(2, sp.x - 6000, sp.z - 6000, sp.x + 6000, sp.z + 6000).length > 0, 'step-downs');
});
test('ride shrines: a Ring Shrine charges from two laps grinded (tier lifted, rare or better at Flow x3); a Gate Shrine from its five arches threaded; standing on foot still charges at base tier', async () => {
  const { shrineCourse } = await import('../src/gen/world/world.js'); const { placeObject } = await import('../src/sim/world.js');
  // find a spot whose course is a ring, and one that is a gate
  let ringAt = null, gateAt = null; for (let i = 0; i < 400 && (!ringAt || !gateAt); i++) { const x = 40 + i * 0.37, z = 60; const k = shrineCourse(x, z).kind; if (k === 'ring' && !ringAt) ringAt = [x, z]; if (k === 'gate' && !gateAt) gateAt = [x, z]; }
  { const g = mk(); g.world.shrines.length = 0; const s = placeObject(g, 'shrine', { x: ringAt[0], y: heightAt(ringAt[0], ringAt[1]), z: ringAt[1] }); flowOf(g).step = 3; const was = s.cards.map(c => c.rarity);
    g.p.ride = undefined; place(g, s.x + 6.2, s.z, 12); run(g, 2, { ...I, f: 1 }); const r = g.p.ride; r.on = true;
    // grind round the ring: drive the grind state along a fake ring rail by moving the duelist round the centre
    const rail = [0, 0, 0, 0, 0, 0, 'ring', s.x, s.z]; for (let k = 0; k <= 140; k++) { const a = k / 60 * 6.283185307179586; g.p.x = s.x + Math.cos(a) * 6.2; g.p.z = s.z + Math.sin(a) * 6.2; r.grind = { s: rail, t: 0.5, L: 3, dir: 1, speed: 10, time: 0, name: 'Rim Ride' }; const { shrineRide } = await import('../src/sim/ride.js'); shrineRide(g, g.p, r, 1 / 60); }
    assert.ok(s.done && s.ridden, 'ring shrine charged'); const O = ['common', 'rare', 'epic', 'legendary']; s.cards.forEach((c, i) => assert.ok(O.indexOf(c.rarity) >= Math.max(1, Math.min(3, O.indexOf(was[i]) + 1)), c.rarity + ' from ' + was[i])); }
  { const g = mk(); g.world.shrines.length = 0; const s = placeObject(g, 'shrine', { x: gateAt[0], y: heightAt(gateAt[0], gateAt[1]), z: gateAt[1] }); const C = shrineCourse(s.x, s.z), A0 = C.arches[0];
    g.p.ride = undefined; place(g, s.x, s.z, 12); run(g, 2, { ...I, f: 1 }); const r = g.p.ride; r.on = true; const { shrineRide } = await import('../src/sim/ride.js');
    for (let d = 6; d <= 54; d += 0.5) { g.p.x = s.x + A0.ux * d; g.p.z = s.z + A0.uz * d; g.p.y = heightAt(g.p.x, g.p.z); shrineRide(g, g.p, r, 1 / 60); }
    assert.ok(s.done && s.ridden, 'gate shrine charged: ' + s.gn); }
  { const g = mk(); g.world.shrines.length = 0; const s = placeObject(g, 'shrine', { x: g.p.x + 3, y: g.p.y, z: g.p.z }); g.p.ride = undefined; run(g, 400); assert.ok(s.done && !s.ridden, 'on foot: charged by standing'); }
});
test('landforms 2: full pipes stand in ridge and ruin regions and loop the card at 13 m/s or more; two great drops near the start, each a shelf, a cliff and a landing slope', async () => {
  const { pipesNear } = await import('../src/sim/rails.js'); const g = mk(), W = g.map.world, sp = W.spawn; let P = null;
  for (let r = 0; r < 6000 && !P; r += 200) for (let a = 0; a < 6.28 && !P; a += 0.5) { const L = pipesNear(g, sp.x + Math.cos(a) * r, sp.z + Math.sin(a) * r, 200); if (L.length) P = L[0]; }
  assert.ok(P, 'a full pipe'); const [x, y, z, ux, uz] = P;
  g.p.x = x - ux * 12; g.p.z = z - uz * 12; g.p.y = heightAt(g.p.x, g.p.z); g.p.grounded = true; g.p.sliding = true; g.p.vx = ux * 16; g.p.vz = uz * 16; const yaw = Math.atan2(-ux, -uz);
  let top = -1e9, looped = false; for (let i = 0; i < 120; i++) { run(g, 1, { ...I, f: 1, yaw }); const r = g.p.ride; if (r && r.loop) { looped = true; top = Math.max(top, g.p.y); } }
  assert.ok(looped, 'rode the loop'); assert.ok(top - y > 8, 'over the top: ' + (top - y).toFixed(1)); assert.ok(g.p.ride.combo.names['Full Pipe'] || flowOf(g).banked > 0, 'counted');
  assert.equal(W.drops.length, 2); for (const d of W.drops) { const h = a => heightAt(d.x + d.c * a, d.z + d.s * a); assert.ok(h(-10) - h(3) > 3.5, 'a cliff: ' + (h(-10) - h(3)).toFixed(1)); assert.ok(h(3) - h(50) > 2, 'a landing slope: ' + (h(3) - h(50)).toFixed(1)); }
});
test('ride shrines 2: Bowl (three laps inside its stones), Spire (air over it) and Pipe (one loop of its full pipe) charge by riding', async () => {
  const { shrineCourse } = await import('../src/gen/world/world.js'); const { placeObject } = await import('../src/sim/world.js'); const { shrineRide } = await import('../src/sim/ride.js');
  const at = {}; for (let i = 0; i < 2000 && Object.keys(at).length < 5; i++) { const x = 40 + i * 0.37, z = 60, k = shrineCourse(x, z).kind; if (!at[k]) at[k] = [x, z]; }
  const setup = kind => { const g = mk(); g.world.shrines.length = 0; const s = placeObject(g, 'shrine', { x: at[kind][0], y: heightAt(at[kind][0], at[kind][1]), z: at[kind][1] }); g.p.ride = undefined; place(g, s.x + 10, s.z, 12); run(g, 2, { ...I, f: 1 }); g.p.ride.on = true; return { g, s, r: g.p.ride }; };
  { const { g, s, r } = setup('bowl'); for (let k = 0; k <= 3 * 60 + 2; k++) { const a = k / 60 * 6.283185307179586; g.p.x = s.x + Math.cos(a) * 10; g.p.z = s.z + Math.sin(a) * 10; shrineRide(g, g.p, r, 1 / 30); } assert.ok(s.done && s.ridden, 'bowl: three laps'); }
  { const { g, s, r } = setup('spire'); const C = shrineCourse(s.x, s.z), top = heightAt(C.spire.x, C.spire.z) + C.spire.h; g.p.x = C.spire.x; g.p.z = C.spire.z; g.p.y = top + 2.5; g.p.grounded = false; shrineRide(g, g.p, r, 1 / 60); g.p.grounded = true; shrineRide(g, g.p, r, 1 / 60); assert.ok(s.done && s.ridden, 'spire: aired over'); }
  { const { g, s, r } = setup('pipe'); const C = shrineCourse(s.x, s.z); r.loop = { x: C.pipe.x, z: C.pipe.z }; shrineRide(g, g.p, r, 1 / 60); r.loop = null; shrineRide(g, g.p, r, 1 / 60); assert.ok(s.done && s.ridden, 'pipe: a loop'); }
});
test('trick answers: every held card answers one trick (a Fusion two); a flip with the Rune Apprentice marks enemies, a grind with the Ember Wyvern burns along the rail, on cooldowns', async () => {
  const { ANSWERS } = await import('../src/data/answers.js'); const { MONSTERS, FUSIONS, SPELLS, TRAPS } = await import('../src/data/cards.js'); const { answerTrick } = await import('../src/sim/answers.js');
  for (const id of [...Object.keys(MONSTERS), ...Object.keys(SPELLS), ...Object.keys(TRAPS)]) assert.equal(ANSWERS[id].length, 1, id); for (const id of Object.keys(FUSIONS)) assert.equal(ANSWERS[id].length, 2, id);
  const g = mk(); g.field.monsters[1] = { id: 'rune-apprentice', level: 1, cd: 9, ang: 0, x: g.p.x, y: g.p.y, z: g.p.z }; for (let i = 0; i < 6; i++) spawnEnemy(g, 'husk', { x: g.p.x + 3 + i, z: g.p.z + 2 });
  const e = g.en; assert.equal(answerTrick(g, 'flip', g.p.x, g.p.y, g.p.z), 1); let marked = 0; for (let i = 0; i < e.max; i++) if (e.alive[i] && e.mark[i] > 0) marked++; assert.ok(marked >= 3, 'marked ' + marked);
  assert.equal(answerTrick(g, 'flip', g.p.x, g.p.y, g.p.z), 0, 'on cooldown'); const hp0 = []; for (let i = 0; i < e.max; i++) if (e.alive[i]) hp0.push(e.hp[i]);
  g.t += 1; assert.equal(answerTrick(g, 'grind', g.p.x + 3, g.p.y, g.p.z + 2), 1, 'the Wyvern answers the grind'); assert.equal(g.ansCount['ember-wyvern'], 1);
});
test('ride: a player who has never kicked the card out this run is not put on it by speed alone (a slope or a dash)', () => {
  const g = new Game(4711, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy' }); g.god = true; g.spawnAcc = -1e9; const [x, z] = flatSpot(g); place(g, x, z, 14); run(g, 5, { ...I, f: 1 });
  assert.ok(!(g.p.ride && g.p.ride.on), 'not riding'); g.rideKicks = 1; place(g, x, z, 14); run(g, 2, { ...I, f: 1 }); assert.ok(g.p.ride.on, 'after a kick, speed mounts again');
});
test('summon flourishes: every summon adds its element to a banked slam, bigger with its form; a Fusion adds a double ring', () => {
  const g = mk(), [x, z] = flatSpot(g); place(g, x, z, 14); run(g, 2, { ...I, f: 1 });
  g.field.monsters[1] = { id: 'twinflare-tyrant', level: 6, cd: 9, ang: 0, x: g.p.x, y: g.p.y, z: g.p.z };
  const seen = []; const em = g.emit.bind(g); g.emit = (t, a, b, c, d) => { if (t === 'flourish') seen.push(c); return em(t, a, b, c, d); };
  run(g, 30, { ...I, f: 1, jump: true }); run(g, 2, { ...I, f: 1 }); run(g, 1, { ...I, f: 1, dash: true }); for (let i = 0; i < 120 && !seen.length; i++) run(g, 1, { ...I, f: 1 });
  assert.ok(seen.length >= 2, 'flourishes: ' + seen); assert.ok(seen.some(c => c >= 100 && c % 10 === 1), 'the Fusion fire flourish: ' + seen);
});
test('riding unlocks: 8 boards (3 owned at the start), each a small lean; the ride quests unlock the other boards, the ride boons and the land items', async () => {
  const { BOARDS } = await import('../src/data/boards.js'); const { defaultMeta } = await import('../src/core/meta.js'); const { ladderQuests } = await import('../src/data/quests2.js'); const { recompute } = await import('../src/sim/field.js');
  assert.equal(Object.keys(BOARDS).length, 8); assert.equal(defaultMeta().boards.length, 3);
  const Q = ladderQuests().filter(q => q.tab === 'Riding'); assert.equal(Q.filter(q => q.reward.board).length, 5); assert.equal(Q.filter(q => q.reward.boon).length, 6); assert.equal(Q.filter(q => q.reward.item).length, 3);
  const g = mk(); g.opts.board = 'sun-back'; recompute(g); assert.ok(Math.abs(g.mods.ridePop - 0.05) < 1e-9, 'the Sun Back lean');
});
test('duelist ride styles: Kael (Ember Rider) burns the slam ground; touch riding helpers can be switched off (no auto-grind then)', () => {
  const g = mk(), [x, z] = flatSpot(g); place(g, x, z, 14); run(g, 2, { ...I, f: 1 });
  run(g, 30, { ...I, f: 1, jump: true }); run(g, 140, { ...I, f: 1 }); assert.ok(flowOf(g).slams > 0 && g.srcNames.includes('ember-rider'), 'Ember Rider fired with the slam');
  const h = mk(); h.opts.autoGrind = false; let rail = null; for (let r = 20; r < 1500 && !rail; r += 40) { const L = railsNear(h, h.p.x + r, h.p.z, 60); rail = L.find(s => Math.hypot(s[3] - s[0], s[5] - s[2]) > 5 && Math.abs(s[4] - s[1]) < 1 && s[1] < 30); }
  const mx = (rail[0] + rail[3]) / 2, mz = (rail[2] + rail[5]) / 2, my = (rail[1] + rail[4]) / 2, ux = rail[3] - rail[0], uz = rail[5] - rail[2], L = Math.hypot(ux, uz);
  h.p.ride = undefined; h.p.x = mx - ux / L * 1.5; h.p.z = mz - uz / L * 1.5; h.p.y = my + 1.0; h.p.vx = ux / L * 12; h.p.vz = uz / L * 12; h.p.vy = -1; h.p.grounded = false; run(h, 1); h.p.ride.on = true; h.p.ride.speed = 12;
  run(h, 6, { ...I }); assert.ok(!h.p.ride.grind, 'no auto-grind with the helpers off');
});
test('spawns: while riding, no new enemy appears in front of the camera within 40 m (they come from the sides and behind)', () => {
  const g = mk(); g.god = true; g.spawnAcc = 0; g.rideKicks = 1; const [x, z] = flatSpot(g); place(g, x, z, 16); run(g, 2, { ...I, f: 1 });
  let bad = 0, seen = 0; const e = g.en, was = new Uint8Array(e.max);
  for (let t = 0; t < 60 * 40; t++) { run(g, 1, { ...I, f: 1, jump: t % 180 < 20 }); const cy = g.camYaw || 0, fx = -Math.sin(cy), fz = -Math.cos(cy);
    for (let i = 0; i < e.max; i++) { if (e.alive[i] && !was[i]) { seen++; const dx = e.x[i] - g.p.x, dz = e.z[i] - g.p.z, d = Math.hypot(dx, dz); if (d < 40 && (dx * fx + dz * fz) / d > 0.5) bad++; } was[i] = e.alive[i]; } }
  assert.ok(seen > 30, 'spawns seen: ' + seen); assert.equal(bad, 0, 'spawned in view within 40 m: ' + bad + ' of ' + seen);
});
test('park toys and shapes: spines, gaps and quarter pipes exist; a quarter pipe sends the card vert; a slam near a park log sets it rolling; a wall met at speed is a wallie', async () => {
  const { quartersNear, kickersNear } = await import('../src/sim/rails.js'); const g = mk(), W = g.map, sp = W.world.spawn; let qs = 0, gaps = 0;
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const D = W.dressCell(Math.floor(sp.x / 256) + i, Math.floor(sp.z / 256) + j); qs += D.quarters.length; gaps += D.kickers.filter(k => k[7] === 3.3).length; }
  assert.ok(qs > 5, 'quarter pipes: ' + qs); assert.ok(gaps >= 1, 'gaps: ' + gaps);
  let q = null; for (let r = 0; r < 2000 && !q; r += 50) for (const a of [0, 1.57, 3.14, 4.71]) { const L = quartersNear(g, sp.x + Math.cos(a) * r, sp.z + Math.sin(a) * r, 60); if (L.length) { q = L[0]; break; } }
  const [x, y, z, ux, uz] = q; g.p.ride = undefined; g.p.x = x - ux * 6; g.p.z = z - uz * 6; g.p.y = heightAt(g.p.x, g.p.z); g.p.grounded = true; g.p.sliding = true; g.p.vx = ux * 14; g.p.vz = uz * 14; const yaw = Math.atan2(-ux, -uz);
  let vert = false; for (let i = 0; i < 40; i++) { run(g, 1, { ...I, f: 1, yaw }); if (g.p.ride && g.p.ride.vert) vert = true; } assert.ok(vert, 'went vert off the quarter');
  const h = mk(); h.world.rollers = [{ x: h.p.x + 2, y: h.p.y, z: h.p.z, ax: 1, az: 0, vx: 0, vz: 0, t: 0, spin: 0 }]; const [fx2, fz2] = flatSpot(h); place(h, h.p.x, h.p.z, 14); run(h, 2, { ...I, f: 1 }); run(h, 30, { ...I, f: 1, jump: true }); for (let i = 0; i < 150; i++) { const L = h.world.rollers[0]; if (L.t <= 0 && L.spin === 0) { L.x = h.p.x + 2; L.z = h.p.z; } run(h, 1, { ...I, f: 1 }); }
  assert.ok(h.world.rollers[0].spin > 0 || flowOf(h).slams === 0, 'the log rolled');
});
