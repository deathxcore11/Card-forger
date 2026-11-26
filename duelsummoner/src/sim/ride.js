// Card Riding (big desert only). Above about 10.5 m/s the duelist kicks a giant spell card under their feet and rides it; below about 7 m/s on the ground they step off and run. Monsters, spells and traps keep fighting on their own.
// Riding: downhill builds speed, uphill and soft sand bleed it, flats keep it; top speed about 24 m/s; the stick carves. Jump: hold to crouch (up to 0.5 s), release to pop 2.2 to 4.5 m. In the air: dash is a flip (8 directions by the stick),
// slide held is a grab (worth more the longer it is held; you cannot land holding it), the stick left or right spins (counted in 180s). Near a rail in the air the card snaps on (auto-grind) or with use: speed is kept along the
// edge, a balance bar drifts and the stick corrects it; losing it is a bail. A clean landing (card within 30 degrees of the travel line, not mid-flip, not holding a grab) banks the combo: points x the number of distinct tricks.
// Holding slide as you land rides a manual (a balance trick that keeps the combo open); use as you land from a steep drop is a revert. A bail loses the open combo and a Flow step and knocks you down for 0.6 s.
// Flow (section 2): steps x1 to x5 fed by banked combos, one step lost after about 10 s without one. It multiplies damage (x1 to x2), XP and coins (x1 to x3) and score (x1 to x5), and adds 5% Stakes a step above 1.
// Every banked landing slams: a shockwave of 4 to 14 m whose damage comes from the combo just banked (capped by the Flow step). Grinding throws sparks that hurt enemies within 2.5 m of the rail.
import { CFG } from '../data/config.js';
import { heightAt, moveXZ } from './terrain.js';
import { atan2, cos, sin } from './dmath.js';
import { resolveColliders } from './colliders.js';
import { explode, damageEnemy } from './combat.js';
import { breakVasesNear } from './world.js';
import { railsNear, sealsNear, sealSet } from './rails.js';

export const RIDE = { mountAt: 10.5, dismountAt: 7, top: 24, push: 3.4, pushTo: 12.5, friction: 0.55, soft: 2.2, downhill: 10, carve: 2.6, airTurn: 1.0, crouchMax: 0.5, popLo: 2.2, popHi: 4.5,
  snap: 1.6, flipTime: 0.42, spinRate: 9.42, landTol: 0.52, bailT: 0.6, revertWin: 0.28, balDrift: 0.9, balFix: 2.6, sparkR: 2.5, sparkDmg: 7, sparkEvery: 0.2, gravity: 28, kickRun: 0.4, kickTo: 12.5, brake: 16 };
const FLIPS = ['Card Flip', 'Ace Flip', 'Deal Flip', 'Riffle', 'Heel Card', 'Cut Flip', 'Fan Flip', 'Shuffle'], GRABS = ['Hand Grab', 'Seal Grab', 'Joker Grab', 'Crown Grab'], GRINDS = ['Edge Grind', 'Rim Ride', 'Spine Slide'];
export const POINTS = { flip: 300, grab: 200, grabPerSecond: 420, spin180: 260, grind: 120, grindPerSecond: 160, manualPerSecond: 90, revert: 180, special: 3000, bigAir: 100, smash: 150, cardLit: 400, seal: 250, sealSet: 2500 };
export const FLOW = { need: [0, 1800, 4200, 7500, 12000], idle: 10, dmgPerStep: 0.25, gainPerStep: 0.5, stakesPerStep: 5, slamR: [4, 14], slamDiv: 22, slamCapPerStep: 45 };

export const makeRide = () => ({ on: false, heading: 0, speed: 0, crouch: 0, jumpWas: false, dashWas: false, useWas: false, flipT: 0, flipName: '', flipK: 0, grabbing: false, grabT: 0, grabName: '', spin: 0, airT: 0,
  grind: null, manual: false, bal: 0, bailT: 0, combo: newCombo(), lastLandVy: 0, revertT: 0, sparkT: 0, rvy: 0, specialReady: false });
const newCombo = () => ({ pts: 0, names: {}, n: 0, list: [], seals: {} });
export const comboValue = c => Math.round(c.pts * Math.max(1, Object.keys(c.names).length));
function addTrick(g, r, name, base) {
  const c = r.combo, k = c.names[name] || 0; let v = base; for (let i = 0; i < k; i++) v *= 0.75;
  c.names[name] = k + 1; c.pts += v; c.n++; c.list.push(name); if (c.list.length > 6) c.list.shift(); g.event('trick', name);
}
const dir8 = (cmd) => { const f = cmd.f || 0, s = cmd.r || 0; if (f * f + s * s < 0.16) return 0; let a = atan2(s, f); if (a < 0) a += 6.283185307; return Math.round(a / 0.785398) % 8; };
const dir4 = (cmd) => { const f = cmd.f || 0, s = cmd.r || 0; if (f * f + s * s < 0.16) return 0; return Math.abs(f) >= Math.abs(s) ? (f > 0 ? 0 : 2) : (s > 0 ? 1 : 3); };
const wrapA = a => { while (a > 3.141592653589793) a -= 6.283185307179586; while (a < -3.141592653589793) a += 6.283185307179586; return a; };

export function flowOf(g) { return g.rflow || (g.rflow = { step: 1, xp: 0, idle: 0, best: 0, slams: 0, banked: 0 }); }
export const flowDamage = g => (g.rflow ? 1 + (g.rflow.step - 1) * FLOW.dmgPerStep : 1);
export const flowGain = g => (g.rflow ? 1 + (g.rflow.step - 1) * FLOW.gainPerStep : 1);
export const flowStakes = g => (g.rflow ? (g.rflow.step - 1) * FLOW.stakesPerStep : 0);
function bank(g, r) {
  const v = comboValue(r.combo), F = flowOf(g); if (Object.keys(r.combo.seals).length) litOf(g).ver++; r.combo = newCombo(); if (v <= 0) return;
  F.idle = 0; F.xp += v; F.banked += v; if (v > F.best) F.best = v;
  while (F.step < 5 && F.xp >= FLOW.need[F.step]) { F.xp -= FLOW.need[F.step]; F.step++; g.event('flowup', F.step); }
  if (F.step === 5) F.xp = Math.min(F.xp, FLOW.need[4]);
  r.specialReady = F.step === 5;
  // the landing slam: radius and damage from the combo just banked, capped by the Flow step
  const p = g.p, rad = Math.min(FLOW.slamR[1], FLOW.slamR[0] + v / 900), dmg = Math.min(FLOW.slamCapPerStep * F.step, 6 + v / FLOW.slamDiv);
  explode(g, p.x, p.y, p.z, rad, 0, dmg, 0xffd56a, 'Landing slam'); F.slams++;
  // every summon on the field strikes at once with the landing (their cooldowns end now)
  if (g.field && g.field.monsters) { let n = 0; for (const m of g.field.monsters) if (m) { m.cd = Math.min(m.cd, 0); n++; } if (n) g.emit('volley', p.x, p.z, n); }
  g.score2 = (g.score2 || 0) + v * F.step; g.emit('slam', p.x, p.z, rad); g.event('banked', v);
}
function bail(g, r, why) {
  if (Object.keys(r.combo.seals).length) litOf(g).ver++; r.combo = newCombo(); r.grind = null; r.manual = false; r.grabbing = false; r.flipT = 0; r.spin = 0; r.bailT = RIDE.bailT; r.speed *= 0.35; r.crouch = 0;
  const F = flowOf(g); if (F.step > 1) F.step--; F.xp = 0; F.idle = 0; g.emit('bail', g.p.x, g.p.z, 0); g.event('bailed', why || '');
}

// returns true when the ride moved the duelist this tick (the run code then skips its own movement)
export function rideTick(g, dt, cmd, mx, mz, hasInput) {
  const p = g.p, r = p.ride || (p.ride = makeRide()), F = flowOf(g);
  if (F.step > 1) { F.idle += dt; if (F.idle > FLOW.idle) { F.step--; F.idle = 0; F.xp = 0; g.event('flowdown', F.step); } }
  const hs = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
  if (!r.on) {
    // kick the card out: SLIDE pressed after at least 0.4 s of running at full speed mounts at once, anywhere, flat sand included (and a fast enough slide or slope still mounts on its own)
    const slidePress = !!cmd.slide && !r.slideWas; r.slideWas = !!cmd.slide; if (slidePress && r.runT > 0) r.kickArm = true; if (!cmd.slide) r.kickArm = false;       // a press a moment early still counts while it is held
    r.runT = p.grounded && hasInput && hs >= 6 && p.dashT <= 0 ? (r.runT || 0) + dt : 0;       // running (soft sand slows the run to about 7 m/s, so the bar is 6)
    if ((slidePress || (cmd.slide && r.kickArm)) && r.runT >= RIDE.kickRun) { r.on = true; r.heading = atan2(p.vx, p.vz); r.speed = Math.max(hs, RIDE.kickTo); r.combo = newCombo(); r.jumpWas = !!cmd.jump; r.dashWas = !!cmd.dash; r.useWas = !!cmd.use; r.manualHold = true; p.sliding = false; r.runT = 0; g.rideKicks = (g.rideKicks || 0) + 1; g.emit('ride', 1, 0, 0); }
    else if (p.grounded && hs >= RIDE.mountAt && p.dashT <= 0) { r.on = true; r.heading = atan2(p.vx, p.vz); r.speed = hs; r.combo = newCombo(); r.jumpWas = !!cmd.jump; r.dashWas = !!cmd.dash; r.useWas = !!cmd.use; p.sliding = false; g.emit('ride', 1, 0, 0); }
    else return false;
  }
  const jumpPress = !!cmd.jump && !r.jumpWas, jumpRel = !cmd.jump && r.jumpWas, dashPress = !!cmd.dash && !r.dashWas, usePress = !!cmd.use && !r.useWas;
  r.jumpWas = !!cmd.jump; r.dashWas = !!cmd.dash; r.useWas = !!cmd.use; if (!cmd.slide) r.manualHold = false; if (r.manualHold) cmd = Object.assign({}, cmd, { slide: false });
  if (r.bailT > 0) { r.bailT -= dt; r.speed = Math.max(0, r.speed - 18 * dt); step(g, p, r, dt); groundFollow(g, p, r, dt); if (r.bailT <= 0 && r.speed < RIDE.dismountAt) dismount(g, p, r); return true; }
  if (r.grind) { grindTick(g, p, r, dt, cmd, jumpPress); return true; }
  if (p.grounded) {
    // carve toward the stick; slope, sand and pushing
    // pulling the stick back brakes (no carve): below 7 m/s the duelist steps off and runs
    const back = hasInput && (mx * sin(r.heading) + mz * cos(r.heading)) < -0.5;
    if (hasInput && !back) { const want = atan2(mx, mz), d = wrapA(want - r.heading), lim = RIDE.carve * dt; r.heading += d > lim ? lim : d < -lim ? -lim : d; }
    if (back) r.speed = Math.max(0, r.speed - RIDE.brake * dt);
    const ax = sin(r.heading), az = cos(r.heading), dh = heightAt(p.x + ax * 1.2, p.z + az * 1.2) - heightAt(p.x, p.z), slope = dh > 0.9 ? 0 : dh / 1.2;
    let acc = -slope * RIDE.downhill - RIDE.friction; if (slope > 0.12 && g.map.regionAt && g.map.regionAt(p.x, p.z).type === 0) acc -= RIDE.soft;
    const wk = g.windT > 0 ? 2 : 1; if (hasInput && r.speed < RIDE.pushTo * wk && (mx * ax + mz * az) > 0.5) acc += RIDE.push * wk;
    const top = RIDE.top * (1 + g.mods.move * 0.5); r.speed = Math.max(0, Math.min(top, r.speed + acc * dt));
    if (r.manual) { manualTick(g, p, r, dt, cmd); if (!r.manual) return true; }
    // the ollie: hold to crouch, release to pop
    if (cmd.jump) r.crouch = Math.min(RIDE.crouchMax, r.crouch + dt);
    if (jumpRel && r.crouch > 0) { const h = RIDE.popLo + (RIDE.popHi - RIDE.popLo) * (r.crouch / RIDE.crouchMax); p.vy = Math.sqrt(2 * RIDE.gravity * h * (1 + g.mods.jumpH)); p.grounded = false; r.crouch = 0; r.airT = 0; g.emit('ollie', h, 0, 0); }
    step(g, p, r, dt); if (p.grounded) groundFollow(g, p, r, dt);
    if (p.grounded && !r.manual && r.speed < RIDE.dismountAt) { bank(g, r); dismount(g, p, r); }
    return true;
  }
  // in the air
  r.airT += dt;
  if (hasInput) { const want = atan2(mx, mz), d = wrapA(want - r.heading), lim = RIDE.airTurn * dt; r.heading += d > lim ? lim : d < -lim ? -lim : d; }
  if (r.flipT > 0) { r.flipT = Math.max(0, r.flipT - dt); r.flipK = 1 - r.flipT / RIDE.flipTime; }
  if (dashPress && r.flipT <= 0) { const d = dir8(cmd); r.flipName = FLIPS[d]; r.flipT = RIDE.flipTime; r.flipK = 0; r.flipDir = d; addTrick(g, r, r.flipName, POINTS.flip); }
  if (cmd.slide && !r.grabbing && r.flipT <= 0) { r.grabbing = true; r.grabT = 0; r.grabName = GRABS[dir4(cmd)]; }
  if (r.grabbing) { if (cmd.slide) r.grabT += dt; else { r.grabbing = false; addTrick(g, r, r.grabName, POINTS.grab + POINTS.grabPerSecond * r.grabT); } }
  const sx = cmd.r || 0; if (sx * sx > 0.36 && !hasForward(cmd)) r.spin += (sx > 0 ? 1 : -1) * RIDE.spinRate * dt;
  if (usePress && r.specialReady && F.step === 5) { r.specialReady = false; addTrick(g, r, 'Royal Flush', POINTS.special); explode(g, p.x, p.y, p.z, 16, 0, 120, 0xfff2c0, 'Royal Flush'); F.step = 3; F.xp = 0; g.emit('special', p.x, p.z, 0); }
  // grind: auto-snap onto a rail while coming down, or with use
  if ((p.vy <= 1.5 || usePress) && trySnap(g, p, r, cmd)) return true;
  if (usePress) r.revertT = RIDE.revertWin;
  else if (r.revertT > 0) r.revertT -= dt;
  r.lastLandVy = p.vy;
  step(g, p, r, dt);
  const h = heightAt(p.x, p.z); p.y += p.vy * dt - 0.5 * RIDE.gravity * dt * dt; p.vy -= RIDE.gravity * dt;
  if (p.y <= h) { p.y = h; land(g, p, r, cmd); }
  return true;
}
const hasForward = cmd => Math.abs(cmd.f || 0) > 0.6;
function step(g, p, r, dt) {
  const ax = sin(r.heading), az = cos(r.heading); p.vx = ax * r.speed; p.vz = az * r.speed; p.face = r.heading;
  const blocked = moveXZ(p, p.vx * dt, p.vz * dt, CFG.player.radius, p.grounded ? 1.0 : CFG.player.stepUp);
  if (blocked) { r.speed *= 0.5; if (!p.grounded && r.speed > 6) { bail(g, r, 'wall'); } }
  resolveColliders(g.colliders, p, CFG.player.radius);
  if (r.speed > 12) { const n = breakVasesNear(g, p.x, p.z, 1.6); for (let i = 0; i < n; i++) addTrick(g, r, 'Smash', POINTS.smash); }
  sealTouch(g, p, r);
}
// a seal stone lights as the card passes over it (within 2 m, on the ground or in the air); light all five of one set inside one combo and the set opens a free chest
function sealTouch(g, p, r) {
  for (const s of sealsNear(g, p.x, p.z, 2.2)) {
    const sid = s[3], dy = p.y - s[1]; if (dy < -1 || dy > 5) continue; const L = litOf(g); if (L.sealsDone[sid]) continue;
    const c = r.combo, have = c.seals[sid] || (c.seals[sid] = []), key = s[0] + ',' + s[2]; if (have.includes(key)) continue; have.push(key); addTrick(g, r, 'Seal', POINTS.seal); L.ver++; g.emit('seal', s[0], s[2], have.length);
    if (have.length >= sealSet(g, sid).length) { L.sealsDone[sid] = true; L.ver++; addTrick(g, r, 'Seal Set', POINTS.sealSet); const tx = s[0] + sin(r.heading) * 6, tz = s[2] + cos(r.heading) * 6; g.world.cchests.push({ x: tx, y: heightAt(tx, tz), z: tz, open: false, rarity: null, free: true, trophy: true }); g.emit('sealset', tx, tz, 0); g.event('banner', 'The seal stones wake: a chest rises.'); }
  }
}
export function litOf(g) { return g.rideLit || (g.rideLit = { cards: {}, sealsDone: {}, ver: 0 }); }
// the seal stones glowing now: every finished set, and the stones lit in the open combo
export function litSeals(g) { const L = litOf(g), r = g.p.ride, out = []; for (const sid in L.sealsDone) for (const s of sealSet(g, +sid)) out.push([s[0], s[1], s[2], 1]); if (r && r.combo) for (const sid in r.combo.seals) if (!L.sealsDone[sid]) for (const k of r.combo.seals[sid]) { const [x, z] = k.split(',').map(Number); const s = sealSet(g, +sid).find(q => q[0] === x && q[2] === z); if (s) out.push([s[0], s[1], s[2], 0]); } return out; }
function groundFollow(g, p, r, dt) {
  const h = heightAt(p.x, p.z), prev = p.y;
  if (h >= prev - 0.35) { r.rvy = (h - prev) / Math.max(dt, 1e-4); p.y = h; return; }
  // the ground falls away faster than the card can follow: off the crest into the air, carrying the climb
  p.grounded = false; p.vy = Math.max(0, r.rvy) * 0.9; r.airT = 0;
}
function land(g, p, r, cmd) {
  p.grounded = true; const vy = r.lastLandVy || p.vy; p.vy = 0;
  if (r.airT > 1.1) addTrick(g, r, 'Big Air', POINTS.bigAir * r.airT);
  const halves = Math.round(Math.abs(r.spin) / 3.141592653589793), rem = Math.abs(Math.abs(r.spin) - halves * 3.141592653589793);
  if (halves > 0) addTrick(g, r, (halves * 180) + ' Spin', POINTS.spin180 * halves);
  const clean = !r.grabbing && r.flipT <= 0.06 && rem <= RIDE.landTol;
  r.spin = 0; r.flipT = 0; r.airT = 0;
  if (!clean) { bail(g, r, r.grabbing ? 'grab' : r.flipT > 0.06 ? 'flip' : 'angle'); return; }
  if (r.revertT > 0 && vy < -9) { addTrick(g, r, 'Revert', POINTS.revert); r.revertT = 0; }
  if (cmd.slide && comboValue(r.combo) > 0) { r.manual = true; r.bal = 0; r.manualT = 0; return; }       // land into a manual: the combo stays open
  bank(g, r); g.emit('land', p.x, p.z, -vy);
}
function manualTick(g, p, r, dt, cmd) {
  if (!cmd.slide) { r.manual = false; addTrick(g, r, 'Manual', POINTS.manualPerSecond * (r.manualT || 0)); bank(g, r); return; }
  r.manualT = (r.manualT || 0) + dt; const drift = sin(g.tickN * 0.05 + 1.3) * RIDE.balDrift + r.bal * 1.1; r.bal += (drift - (cmd.f || 0) * RIDE.balFix) * dt;
  if (r.bal > 1 || r.bal < -1) bail(g, r, 'manual');
}
// ---- grinds
function trySnap(g, p, r, cmd) {
  const rails = railsNear(g, p.x, p.z, 8); let best = null, bd = RIDE.snap * RIDE.snap;
  for (const s of rails) {
    const dx = s[3] - s[0], dz = s[5] - s[2], L2 = dx * dx + dz * dz; if (L2 < 0.25) continue; let t = ((p.x - s[0]) * dx + (p.z - s[2]) * dz) / L2; if (t < 0.02 || t > 0.98) continue;
    const qx = s[0] + dx * t, qz = s[2] + dz * t, qy = s[1] + (s[4] - s[1]) * t, d2 = (qx - p.x) * (qx - p.x) + (qz - p.z) * (qz - p.z), dy = p.y - qy;
    if (dy < -0.6 || dy > 1.6 || d2 >= bd) continue; bd = d2; best = { s, t, L: Math.sqrt(L2) };
  }
  if (!best) return false;
  const s = best.s, ux = (s[3] - s[0]) / best.L, uz = (s[5] - s[2]) / best.L, along = p.vx * ux + p.vz * uz, dir = along >= 0 ? 1 : -1;
  const hs = Math.sqrt(p.vx * p.vx + p.vz * p.vz); r.grind = { s, t: best.t, L: best.L, dir, speed: Math.max(6, Math.abs(along) * 0.6 + hs * 0.4), time: 0, name: GRINDS[cmd.f > 0.4 ? 1 : cmd.f < -0.4 ? 2 : 0] };
  r.bal = 0; r.flipT = 0; r.grabbing = false; p.vy = 0; p.grounded = false; g.emit('grind', 1, 0, 0);
  if (s[6] === 'card') { const L = litOf(g), key = s[7] + ',' + s[8]; if (!L.cards[key]) { L.cards[key] = [(s[0] + s[3]) / 2, s[1], (s[2] + s[5]) / 2]; L.ver++; addTrick(g, r, 'Lit Card', POINTS.cardLit); g.emit('cardlit', L.cards[key][0], L.cards[key][2], s[1]); } }       // a stone card lights for good the first time it is ground
  return true;
}
function grindTick(g, p, r, dt, cmd, jumpPress) {
  const G = r.grind, s = G.s, ux = (s[3] - s[0]) / G.L, uz = (s[5] - s[2]) / G.L, slope = (s[4] - s[1]) / G.L * G.dir;
  G.speed = Math.max(4, Math.min(RIDE.top, G.speed + (-slope * 12 - 0.35) * dt)); G.t += G.dir * G.speed * dt / G.L; G.time += dt;
  const drift = sin(g.tickN * 0.07 + G.L) * RIDE.balDrift + r.bal * (0.9 + G.time * 0.25); r.bal += (drift - (cmd.r || 0) * RIDE.balFix) * dt;
  const done = G.t <= 0 || G.t >= 1, fell = r.bal > 1 || r.bal < -1;
  const t = Math.max(0, Math.min(1, G.t)); p.x = s[0] + (s[3] - s[0]) * t; p.z = s[2] + (s[5] - s[2]) * t; p.y = s[1] + (s[4] - s[1]) * t + 0.08; p.vx = ux * G.dir * G.speed; p.vz = uz * G.dir * G.speed; r.heading = atan2(p.vx, p.vz); r.speed = G.speed; p.face = r.heading;
  r.sparkT -= dt; if (r.sparkT <= 0) { r.sparkT = RIDE.sparkEvery; sparks(g, p); }
  if (fell) { r.grind = null; addTrick(g, r, G.name, POINTS.grind + POINTS.grindPerSecond * G.time); bail(g, r, 'balance'); p.grounded = false; p.vy = 0; return; }
  if (done || jumpPress) { r.grind = null; addTrick(g, r, G.name, POINTS.grind + POINTS.grindPerSecond * G.time); p.grounded = false; p.vy = jumpPress ? Math.sqrt(2 * RIDE.gravity * RIDE.popLo) : 1.5; r.airT = 0; r.lastLandVy = 0; }
}
function sparks(g, p) {
  const e = g.en, R2 = RIDE.sparkR * RIDE.sparkR; for (let i = 0; i < e.max; i++) { if (!e.alive[i]) continue; const dx = e.x[i] - p.x, dz = e.z[i] - p.z; if (dx * dx + dz * dz < R2) damageEnemy(g, i, RIDE.sparkDmg * flowDamage(g), { noCrit: true }); }
  g.emit('sparks', p.x, p.z, 0);
}
function dismount(g, p, r) { r.on = false; r.runT = 0; r.slideWas = true; r.grind = null; r.manual = false; const ax = sin(r.heading), az = cos(r.heading); p.vx = ax * r.speed; p.vz = az * r.speed; g.emit('ride', 0, 0, 0); }
