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
import { breakVasesNear, rideShrineDone } from './world.js';
import { shrineCourse } from '../gen/world/world.js';
import { railsNear, sealsNear, sealSet, pipesNear, kickersNear, quartersNear } from './rails.js';
import { answerTrick } from './answers.js';
import { MONSTERS, FUSIONS, formOf } from '../data/cards.js';
import { elemBits } from '../data/elements.js';
import { splash } from './weapons.js';

export const RIDE = { mountAt: 10.5, dismountAt: 7, top: 24, push: 3.4, pushTo: 12.5, friction: 0.55, soft: 2.2, downhill: 10, carve: 2.6, airTurn: 1.0, crouchMax: 0.5, popLo: 2.2, popHi: 4.5,
  snap: 2.4, flipTime: 0.42, spinRate: 9.42, landTol: 0.52, bailT: 0.6, revertWin: 0.28, balDrift: 0.9, balFix: 2.6, sparkR: 2.5, sparkDmg: 7, sparkEvery: 0.2, gravity: 28, kickRun: 0.4, kickTo: 12.5, brake: 16, holdMin: 8.5 };
// controls v2 (owner, 27 Nov, design/controls-v2.md): four face buttons each do one job, the stick picks the trick. By stick direction: up, right, down, left (no direction: the left one).
export const FLIPS = ['Impossible', 'Heelflip', 'Pop Shuvit', 'Kickflip', 'Double Flip'], GRABS = ['Nosegrab', 'Indy', 'Method', 'Melon'], GRINDS = ['50-50', 'Nosegrind', '5-0', 'Boardslide'];
export const FLIP_POSE = [2, 4, 8, 0];       // the pose each flip uses (src/view/trickpose.js): an impossible pitches, a heelflip rolls back, a shuvit spins the card flat, a kickflip rolls
export const SPECIALS = { flip: 'Deck Shuffle', grab: 'Tableflip', grind: 'Seal Grind' };       // up then down on the stick, then a face button, once the special meter is full (touch: the Special button)
export const CTRL = { comboT: 2.5, iframes: 0.25, slamDropVy: -32, slamClear: 9, wallplantH: 1.6, wallplantSpeed: 4, powerslideTurn: 7, fallMul: 1.6, hang: 0.45, hangVy: 2, hangAfter: 0.45, powerslideBrake: 10, nosegrindSpeed: 1.25, fiveOhSpark: 1.8 };
export const POINTS = { flip: 300, grab: 200, grabPerSecond: 420, spin180: 260, grind: 120, grindPerSecond: 160, manualPerSecond: 90, revert: 180, special: 3000, bigAir: 100, vert: 250, loop: 800, smash: 150, crest: 150, closeCall: 120, cardLit: 400, seal: 250, sealSet: 2500 };
export const FLOW = { need: [0, 1800, 4200, 7500, 12000], idle: 10, dmgPerStep: 0.05, gainPerStep: 0.3, stakesPerStep: 5, slamR: [4, 14], slamDiv: 22, slamCapPerStep: 45 };

export const makeRide = () => ({ on: false, heading: 0, speed: 0, crouch: 0, jumpWas: false, dashWas: false, useWas: false, flipT: 0, flipName: '', flipK: 0, grabbing: false, grabT: 0, grabName: '', spin: 0, airT: 0,
  grind: null, manual: false, bal: 0, bailT: 0, combo: newCombo(), lastLandVy: 0, revertT: 0, sparkT: 0, rvy: 0, specialReady: false });
const newCombo = () => ({ pts: 0, names: {}, n: 0, list: [], seals: {} });
export const comboValue = c => Math.round(c.pts * Math.max(1, Object.keys(c.names).length));
function addTrick(g, r, name, base) {
  const c = r.combo, k = c.names[name] || 0; let v = base; for (let i = 0; i < k; i++) v *= 0.75;
  c.names[name] = k + 1; c.pts += v; c.n++; c.list.push(name); if (c.list.length > 6) c.list.shift(); r.comboT = CTRL.comboT; g.event('trick', name);       // every new trick refills the 2.5 s combo timer
}
const dir8 = (cmd) => { const f = cmd.f || 0, s = cmd.r || 0; if (f * f + s * s < 0.16) return 0; let a = atan2(s, f); if (a < 0) a += 6.283185307; return Math.round(a / 0.785398) % 8; };
const dir4 = (cmd) => { const f = cmd.f || 0, s = cmd.r || 0; if (f * f + s * s < 0.16) return 0; return Math.abs(f) >= Math.abs(s) ? (f > 0 ? 0 : 2) : (s > 0 ? 1 : 3); };
const dirN = cmd => { const f = cmd.f || 0, s = cmd.r || 0; return f * f + s * s < 0.16 ? -1 : dir4(cmd); };
const wrapA = a => { while (a > 3.141592653589793) a -= 6.283185307179586; while (a < -3.141592653589793) a += 6.283185307179586; return a; };

const F0 = g => flowOf(g);
export function flowOf(g) { return g.rflow || (g.rflow = { step: 1, xp: 0, idle: 0, best: 0, slams: 0, banked: 0 }); }
export const flowDamage = g => (g.rflow ? 1 + (g.rflow.step - 1) * FLOW.dmgPerStep : 1);
export const flowGain = g => (g.rflow ? 1 + (g.rflow.step - 1) * FLOW.gainPerStep : 1);
export const flowStakes = g => (g.rflow ? (g.rflow.step - 1) * FLOW.stakesPerStep : 0);
function specialTick(g, r, F, flipP, grabP, grindP, specialP) {
  if ((F.meter || 0) < 1 || !(flipP || grabP || grindP || specialP)) return false;
  const D = r.dirT || [-9, -9, -9, -9], upDown = r.clk - D[0] < 0.5 && r.clk - D[2] < 0.5 && D[2] >= D[0];       // up then down on the stick within half a second
  if (!upDown && !specialP) return false;
  const key = specialP ? (r.grind ? 'grind' : 'flip') : flipP ? 'flip' : grabP ? 'grab' : 'grind'; if (key === 'grind' && !r.grind && !specialP) return false;
  addTrick(g, r, SPECIALS[key], (POINTS.flip + POINTS.grab) * (typeof RIDE.specialMul === 'number' ? RIDE.specialMul : 3)); r.combo.special = true; r.specialName = SPECIALS[key]; r.specialT = 0.9; F.meter = 0; r.dirT = null; g.emit('special', g.p.x, g.p.z, 0); return true;
}
function bank(g, r) {
  const special = !!r.combo.special, v = comboValue(r.combo), F = flowOf(g); r.combo = newCombo(); if (v <= 0) return;
  F.meter = Math.min(1, (F.meter || 0) + v * (RIDE.meterPerPoint || 1 / 2500)); r.bankSpecial = special;
  F.idle = 0; F.xp += v; F.banked += v; if (v > F.best) F.best = v;
  while (F.step < 5 && F.xp >= FLOW.need[F.step]) { F.xp -= FLOW.need[F.step]; F.step++; g.event('flowup', F.step); }
  if (F.step === 5) F.xp = Math.min(F.xp, FLOW.need[4]);
  r.specialReady = F.step === 5;
  // the landing slam: radius and damage from the combo just banked, capped by the Flow step
  const p = g.p, rad = Math.min(FLOW.slamR[1], FLOW.slamR[0] + v / 900) * (1 + (g.mods.slamSize || 0)), dmg = Math.min(FLOW.slamCapPerStep * F.step, 6 + v / FLOW.slamDiv);
  explode(g, p.x, p.y, p.z, rad, 0, dmg, 0xffd56a, 'Landing slam'); F.slams++;
  for (const L of g.world.rollers || []) { const dx = L.x - p.x, dz = L.z - p.z, d = Math.sqrt(dx * dx + dz * dz); if (d < rad + 3 && L.t <= 0) { const k = (dx * L.az - dz * L.ax) >= 0 ? 1 : -1; L.vx = -L.az * k * 9; L.vz = L.ax * k * 9; L.t = 4; L.vx += dx / (d || 1) * 2; L.vz += dz / (d || 1) * 2; g.emit('rolllog', L.x, L.z, 0); } }       // a log near the slam rolls away, across its length
  if (g.field && g.field.duelist === 'kael') { g.curSrc = g.srcIndex('ember-rider'); splash(g, p.x, p.y, p.z, rad * 0.7, 3 + F.step, 1); g.curSrc = 0; }       // Kael's ride style, Ember Rider: the slam leaves the ground burning
  // summon flourishes: each summon on the field adds its element to the slam, bigger with each evolution form; a Fusion adds a double ring
  if (g.field && g.field.monsters) for (const m of g.field.monsters) { if (!m) continue; const D = MONSTERS[m.id] || FUSIONS[m.id]; if (!D) continue; const fu = !!FUSIONS[m.id], fm = formOf(m.id, m.level), el = elemBits(D.elements), R = (fu ? 6 : 3) + fm * 1.5, dm = (fu ? 12 : 4) + fm * 3; g.curSrc = g.srcIndex(m.id); splash(g, p.x, p.y, p.z, R, dm, el); if (fu) splash(g, p.x, p.y, p.z, R * 0.55, dm * 0.6, el); g.curSrc = 0; g.emit('flourish', p.x, p.z, (el & 1 ? 1 : el & 2 ? 2 : 0) + 10 * fm + (fu ? 100 : 0)); }
  { const T = g.map && g.map.regionAt ? g.map.regionAt(p.x, p.z).type : -1;       // the land answers the slam
    if (T === 2) { for (let k = 0; k < 5; k++) { const a = k * 1.2566 + r.heading, d = rad * 0.9; explode(g, p.x + sin(a) * d, p.y, p.z + cos(a) * d, rad * 0.45, 0, dmg * 0.5, 0xfff2c0, 'Star crack'); } g.emit('slamland', p.x, p.z, 2); }
    else if (T === 0) { const e = g.en, R2 = (rad * 1.7) ** 2; for (let i = 0; i < e.max; i++) { if (!e.alive[i]) continue; const dx = e.x[i] - p.x, dz = e.z[i] - p.z, d2 = dx * dx + dz * dz; if (d2 < R2 && d2 > rad * rad) { const d = Math.sqrt(d2); e.x[i] += dx / d * 3; e.z[i] += dz / d * 3; damageEnemy(g, i, dmg * 0.35, { noCrit: true }); } } g.emit('slamland', p.x, p.z, 0); }
    else if (T === 3 || r.lastLoopT > g.t - 2) { r.echo = { t: 0.35, x: p.x, y: p.y, z: p.z, rad, dmg: dmg * 0.6 }; g.emit('slamland', p.x, p.z, 3); } }
  // every summon on the field strikes at once with the landing (their cooldowns end now)
  if (g.field && g.field.monsters && (r.bankSpecial || (v >= 600 && !((r.volleyT || -9) > g.t - 6)))) { r.volleyT = g.t; g.chorusN = (g.chorusN || 0) + 1; let n = 0; for (const m of g.field.monsters) if (m) { m.cd = Math.min(m.cd, 0); n++; } if (n) g.emit('volley', p.x, p.z, v); }       // the chorus strike: a combo of 600 or more (two or three tricks), at most every 6 s
  g.score2 = (g.score2 || 0) + v * F.step; g.emit('slam', p.x, p.z, rad); g.event('banked', v);
}
function bail(g, r, why) {
  if (r.sealRun && Object.keys(r.sealRun).length) { r.sealRun = {}; litOf(g).ver++; } r.combo = newCombo(); r.grind = null;       // a bail puts the lit seal stones out r.manual = false; r.grabbing = false; r.flipT = 0; r.spin = 0; r.bailT = RIDE.bailT; r.speed *= 0.35; r.crouch = 0;
  const F = flowOf(g); if (F.step > 1) F.step--; F.xp = 0; F.idle = 0; g.emit('bail', g.p.x, g.p.z, 0); g.event('bailed', why || '');
}

// returns true when the ride moved the duelist this tick (the run code then skips its own movement)
export function rideTick(g, dt, cmd, mx, mz, hasInput) {
  if (g.opts && g.opts.noRide) return false;       // a walker (the bots' control group)
  const p = g.p, r = p.ride || (p.ride = makeRide()), F = flowOf(g);
  if (r.on) shrineRide(g, p, r, dt); rollersTick(g, dt);
  if (F.step > 1) { F.idle += dt; if (F.idle > FLOW.idle + (g.mods.flowHold || 0)) { F.step--; F.idle = 0; F.xp = 0; g.event('flowdown', F.step); } }
  const hs = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
  if (!r.on) p.iframeT = 0;
  if (!r.on) {
    // (riding on speed alone starts only from a foot slide, and only once the card has been kicked out this run: running down a hill never puts anyone on the card)
    // kick the card out: SLIDE pressed after at least 0.4 s of running at full speed mounts at once, anywhere, flat sand included (and a fast enough slide or slope still mounts on its own)
    const slidePress = !!cmd.slide && !r.slideWas; r.slideWas = !!cmd.slide; if (slidePress && r.runT > 0) r.kickArm = true; if (!cmd.slide) r.kickArm = false;       // a press a moment early still counts while it is held
    r.runT = p.grounded && hasInput && hs >= 6 && p.dashT <= 0 ? (r.runT || 0) + dt : 0;       // running (soft sand slows the run to about 7 m/s, so the bar is 6)
    if ((slidePress || (cmd.slide && r.kickArm)) && r.runT >= RIDE.kickRun) { r.on = true; r.heading = atan2(p.vx, p.vz); r.speed = Math.max(hs, RIDE.kickTo); r.combo = newCombo(); r.jumpWas = !!cmd.jump; r.dashWas = !!cmd.dash; r.useWas = !!cmd.use; r.manualHold = true; p.sliding = false; r.runT = 0; g.rideKicks = (g.rideKicks || 0) + 1; g.emit('ride', 1, 0, 0); }
    else if (p.grounded && p.sliding && hs >= RIDE.mountAt && p.dashT <= 0 && (g.rideKicks || 0) > 0) { r.on = true; r.heading = atan2(p.vx, p.vz); r.speed = hs; r.combo = newCombo(); r.jumpWas = !!cmd.jump; r.dashWas = !!cmd.dash; r.useWas = !!cmd.use; p.sliding = false; g.emit('ride', 1, 0, 0); }
    else return false;
  }
  const jumpPress = !!cmd.jump && !r.jumpWas, jumpRel = !cmd.jump && r.jumpWas, dashPress = !!cmd.dash && !r.dashWas && !cmd.kb, usePress = !!cmd.use && !r.useWas;
  const flipPress = !!cmd.flip && !r.flipWas, grindPress = !!cmd.grind && !r.grindWas, grabPress = !!cmd.grab && !r.grabWas, spinPress = !!cmd.spin && !r.spinWas; r.flipWas = !!cmd.flip; r.grindWas = !!cmd.grind; r.grabWas = !!cmd.grab; r.spinWas = !!cmd.spin;       // the feel pass: keyboard J flips, K grabs, L grinds, Q and E spin (Shift is the revert on the keyboard, so it never flips)
  const revertPress = !!cmd.revert && !r.revertWas; r.revertWas = !!cmd.revert; const specialPress = !!cmd.special && !r.specialWas; r.specialWas = !!cmd.special;
  if (r.iT > 0) r.iT -= dt; p.iframeT = r.iT > 0 ? r.iT : 0;       // i-frames from an ollie pop or a Slam Drop landing
  r.clk = (r.clk || 0) + dt; if (r.specialT > 0) r.specialT -= dt; const fy = cmd.f || 0; let flick = false; if (fy > 0.7) { if (r.dnT !== undefined && r.clk - r.dnT < 0.25 && !r.upHeld) r.flickPend = r.clk; r.upT = r.clk; r.upHeld = true; } else r.upHeld = false; if (fy < -0.7) { if (r.upT !== undefined && r.clk - r.upT < 0.25 && !r.dnHeld) r.flickPend = r.clk; r.dnT = r.clk; r.dnHeld = true; } else r.dnHeld = false;
  if (r.flickPend !== undefined) { if (Math.abs(fy) < 0.3) { flick = true; r.flickPend = undefined; } else if (r.clk - r.flickPend > 0.3) r.flickPend = undefined; }       // a flick is let go at once: held back it stays a brake       // up then down quickly, or down then up: a manual
  { const d = dir4(cmd), m = (cmd.f || 0) * (cmd.f || 0) + (cmd.r || 0) * (cmd.r || 0); if (m > 0.36) (r.dirT || (r.dirT = [-9, -9, -9, -9]))[d] = r.clk; }
  r.jumpWas = !!cmd.jump; r.dashWas = !!cmd.dash; r.useWas = !!cmd.use; if (!cmd.slide) r.manualHold = false; if (r.manualHold) cmd = Object.assign({}, cmd, { slide: false });
  if (r.bailT > 0) { r.bailT -= dt; r.speed = Math.max(0, r.speed - 18 * dt); step(g, p, r, dt); groundFollow(g, p, r, dt); if (r.bailT <= 0 && r.speed < RIDE.dismountAt) dismount(g, p, r); return true; }
  if (r.echo) { r.echo.t -= dt; if (r.echo.t <= 0) { const E = r.echo; r.echo = null; explode(g, E.x, E.y, E.z, E.rad, 0, E.dmg, 0xffe08a, 'Echo slam'); g.emit('slam', E.x, E.z, E.rad); } }
  if (r.loop) { loopTick(g, p, r, dt); return true; }
  if (r.grind) { grindTick(g, p, r, dt, cmd, jumpPress); return true; }
  if (p.grounded && r.speed >= 13 && !(r.loopCd > 0)) { for (const q of pipesNear(g, p.x, p.z, 9)) { const [x, y, z, ux, uz, R] = q, dx = p.x - x, dz = p.z - z, al = dx * ux + dz * uz, lat = Math.abs(-dx * uz + dz * ux), hx = sin(r.heading), hz = cos(r.heading), dot = hx * ux + hz * uz;
    if (lat < 1.3 && Math.abs(dot) > 0.85 && Math.abs(al) < 0.9) { const d = dot > 0 ? 1 : -1; r.loop = { x: x + ux * al, y: p.y, z: z + uz * al, ux: ux * d, uz: uz * d, R, th: 0 }; addTrick(g, r, 'Full Pipe', POINTS.loop); g.emit('loop', x, z, R); return true; } } }       // a full pipe at 13 m/s or more: the card sticks and rides the loop
  if (r.loopCd > 0) r.loopCd -= dt;
  if (p.grounded) {
    // carve toward the stick; slope, sand and pushing
    // pulling the stick back brakes (no carve): below 7 m/s the duelist steps off and runs
    if (r.vertG > 0) r.vertG -= dt; const back = !r.manual && !(r.vertG > 0) && hasInput && (mx * sin(r.heading) + mz * cos(r.heading)) < -0.5;       // for 1.5 s after a vert the stick behind is not a brake: the card carves round instead
    if (hasInput && !back) { const want = atan2(mx, mz), d = wrapA(want - r.heading), sk = Math.max(0, Math.min(1, (r.speed - 8) / 22)), lim = (RIDE.turnLow !== undefined ? RIDE.turnLow + (RIDE.turnHigh - RIDE.turnLow) * sk : RIDE.carve) * dt; r.heading += d > lim ? lim : d < -lim ? -lim : d; }
    if (back) r.speed = Math.max(0, r.speed - RIDE.brake * dt);
    const ax = sin(r.heading), az = cos(r.heading), dh = heightAt(p.x + ax * 1.2, p.z + az * 1.2) - heightAt(p.x, p.z), slope = dh > 0.9 ? 0 : dh / 1.2;
    let acc = -slope * RIDE.downhill * (cmd.jump && slope < 0 ? 1.6 : 1) - RIDE.friction;       // pump: crouching down the back of a roller or into a dip gains more
    // a wall steeper than about 40 degrees ahead at speed (a half-pipe, a bowl wall): the card goes up it and comes back down facing the other way (vert air)
    if (dh / 1.2 > 0.85 && dh < 3 && r.speed > 8 && !r.manual && heightAt(p.x + ax * 3, p.z + az * 3) - heightAt(p.x, p.z) > 2.7) { p.vy = Math.min(11, r.speed * 0.6); p.grounded = false; r.airT = 0; r.vert = true; r.vertG = 1.5; r.heading += 3.141592653589793; r.speed *= 0.18; r.lastLandVy = 0; addTrick(g, r, 'Vert', POINTS.vert); g.emit('ollie', 2, 0, 0); if (g.mods.canyonVert > 0 && g.map.regionAt && g.map.regionAt(p.x, p.z).type === 3) { p.hp = Math.min(p.maxHp, p.hp + 3 * g.mods.canyonVert); F.idle = Math.max(-g.mods.canyonVert, F.idle - g.mods.canyonVert); } return true; }       // Canyon Spur if (slope > 0.12 && g.map.regionAt && g.map.regionAt(p.x, p.z).type === 0) acc -= RIDE.soft;
    const wk = g.windT > 0 ? 2 : 1, fwd = hasInput && (mx * ax + mz * az) > 0.5; if (RIDE.pushMax !== undefined) { if (!back && r.speed < RIDE.pushTo * wk) acc += RIDE.push * wk; if (fwd && r.speed < RIDE.pushMax * wk) acc += RIDE.push * wk; } else if (fwd && r.speed < RIDE.pushTo * wk) acc += RIDE.push * wk;
    const top = RIDE.top * (1 + g.mods.move * 0.5); r.speed = Math.max(fwd ? Math.min(r.speed, RIDE.holdMin) : 0, Math.min(top, r.speed + acc * dt)); if (fwd && r.speed < RIDE.holdMin) r.speed = Math.min(RIDE.holdMin, r.speed + RIDE.push * 2 * dt);       // the stick held forward kicks along: a dune climb never drops the rider below 8.5 m/s
    if (revertPress && !r.manual && comboValue(r.combo) > 0) { r.manual = true; r.manualFlick = false; r.bal = 0; r.manualT = 0; r.comboT = CTRL.comboT; }       // the manual button on the ground, with a combo open: a manual
    if (cmd.grab && !r.manual) { if (!r.pslide) { r.pslide = true; addTrick(g, r, 'Powerslide', 120); } r.speed = Math.max(0, r.speed - CTRL.powerslideBrake * dt); if (hasInput) { const want = atan2(mx, mz), d = wrapA(want - r.heading), lim = CTRL.powerslideTurn * dt; r.heading += d > lim ? lim : d < -lim ? -lim : d; } } else r.pslide = false;       // grab on the ground: a Powerslide, a sharp drift that kills speed
    if (r.manual) { manualTick(g, p, r, dt, cmd, jumpPress); if (!r.manual) return true; }
    // the ollie: hold to crouch, release to pop
    if (cmd.jump) r.crouch = Math.min(RIDE.crouchMax, r.crouch + dt);
    if (jumpRel && r.crouch > 0) { const h = (RIDE.popLo + (RIDE.popHi - RIDE.popLo) * (r.crouch / RIDE.crouchMax)) * (1 + (g.mods.ridePop || 0)); p.vy = Math.sqrt(2 * RIDE.gravity * h * (1 + g.mods.jumpH)); p.grounded = false; r.crouch = 0; r.airT = 0; r.iT = CTRL.iframes; p.iframeT = r.iT; g.emit('ollie', h, 0, 0); }
    step(g, p, r, dt); if (p.grounded) groundFollow(g, p, r, dt); if (p.grounded && (kickerTick(g, p, r) || quarterTick(g, p, r))) return true;
    if (p.grounded && !r.manual && !(hasInput && (mx * sin(r.heading) + mz * cos(r.heading)) > -0.3) && !cmd.jump && !(r.vertG > 0) && r.speed < RIDE.dismountAt) { bank(g, r); dismount(g, p, r); }       // only a stop, the brake or a bail takes the rider off: never while pushing forward or charging an ollie
    return true;
  }
  // in the air
  r.airT += dt; if (hasInput && (mx * sin(r.heading) + mz * cos(r.heading)) < -0.5) r.speed = Math.max(0, r.speed - RIDE.brake * 0.5 * dt);       // pulling back in the air still slows the card
  if (hasInput) { const want = atan2(mx, mz), d = wrapA(want - r.heading), lim = RIDE.airTurn * dt; r.heading += d > lim ? lim : d < -lim ? -lim : d; }
  if (r.flipT > 0) { r.flipT = Math.max(0, r.flipT - dt); r.flipK = 1 - r.flipT / RIDE.flipTime; }
  const twoDirs = r.dirT && r.dirT.filter(t0 => r.clk - t0 < 0.35).length >= 2;
  if (false && (dashPress || (cmd.slide && !r.grabbing && !r.slideAirWas)) && twoDirs && r.specialReady && F.step === 5) { r.specialReady = false; addTrick(g, r, 'Royal Flush', POINTS.special); explode(g, p.x, p.y, p.z, 16, 0, 120, 0xfff2c0, 'Royal Flush'); F.step = 1; F.xp = 0; for (const q of g.field.monsters) if (q) q.cd = 0; g.emit('volley', p.x, p.z, 9); g.emit('special', p.x, p.z, 0); r.slideAirWas = !!cmd.slide; r.dirT = null; return true; }       // two directions then a face button, Flow full: the special
  r.slideAirWas = !!cmd.slide;
  const sp = specialTick(g, r, F, flipPress || dashPress, grabPress, grindPress, specialPress);
  if (!sp && (dashPress || flipPress)) { if (r.flipT > 0 && r.flipT < RIDE.flipTime - 0.05 && !r.doubled) { r.doubled = true; r.flipName = FLIPS[4]; r.flipT = RIDE.flipTime; r.flipK = 0; addTrick(g, r, r.flipName, POINTS.flip * (r.airT > 0.5 ? 1.6 : 1.2)); }       // tapped again mid-flip: a Double Flip, worth more with air to spare
    else if (r.flipT <= 0) { const d = dirN(cmd), k = d < 0 ? 3 : d; r.flipName = FLIPS[k]; r.flipT = RIDE.flipTime; r.flipK = 0; r.flipDir = FLIP_POSE[k]; r.doubled = false; addTrick(g, r, r.flipName, POINTS.flip); answerTrick(g, 'flip', p.x, p.y, p.z); } }
  if (!sp && (cmd.slide || cmd.grab) && !r.grabbing && r.flipT <= 0 && !r.slamDrop) { const d = dirN(cmd);
    if (d === 2 && p.vy < 0 && grabPress) { r.slamDrop = true; p.vy = Math.min(p.vy, CTRL.slamDropVy); addTrick(g, r, 'Slam Drop', 250); g.emit('ollie', 3, 0, 0); }       // down + grab on the way down: a Slam Drop, straight down
    else { r.grabbing = true; r.grabT = 0; r.grabName = GRABS[d < 0 ? 3 : d]; } }
  if (r.grabbing) { if (cmd.slide || cmd.grab) r.grabT += dt; else { r.grabbing = false; const k = r.grabName === 'Method' ? 1.6 : r.grabName === 'Indy' ? 1.2 : 1; addTrick(g, r, r.grabName, (POINTS.grab + POINTS.grabPerSecond * r.grabT) * k); answerTrick(g, 'grab', p.x, p.y, p.z); } }       // Method: huge Flow (and it must be let go early enough: a held grab bails); Indy a little more
  const sx = cmd.r || 0; if (cmd.spin) r.spin += (cmd.spin > 0 ? 1 : -1) * RIDE.spinRate * (1 + (g.mods.rideSpin || 0)) * dt; else if (sx * sx > 0.36 && !hasForward(cmd)) r.spin += (sx > 0 ? 1 : -1) * RIDE.spinRate * (1 + (g.mods.rideSpin || 0)) * dt;       // the shoulders spin (pad), or the stick left or right
  if (false && usePress && r.specialReady && F.step === 5) { r.specialReady = false; addTrick(g, r, 'Royal Flush', POINTS.special); explode(g, p.x, p.y, p.z, 16, 0, 120, 0xfff2c0, 'Royal Flush'); F.step = 1; F.xp = 0; for (const q of g.field.monsters) if (q) q.cd = 0; g.emit('volley', p.x, p.z, 9); g.emit('special', p.x, p.z, 0); }
  // grind: auto-snap onto a rail while coming down, or with use
  if ((usePress || grindPress || !(g.opts && g.opts.autoGrind === false)) && trySnap(g, p, r, cmd, usePress || grindPress || p.vy <= 1.5)) return true;       // auto-grind as the card comes down, unless switched off (then GRIND snaps it)
  if (flick) r.manualArm = r.clk;
  if (usePress || jumpPress || revertPress) r.revertT = RIDE.revertWin;       // a tap of USE or of OLLIE just before touching down: a revert
  else if (r.revertT > 0) r.revertT -= dt;
  r.lastLandVy = p.vy;
  if (r.wall) { const W = r.wall; W.t -= dt; const wallThere = heightAt(p.x - W.nx * 1.0, p.z - W.nz * 1.0) > p.y + 0.4;
    if (jumpPress && W.t < RIDE.wallT - 0.05) { r.wall = null; p.vy = Math.sqrt(2 * RIDE.gravity * RIDE.popHi * CTRL.wallplantH); r.speed += CTRL.wallplantSpeed; r.heading = atan2(sin(r.heading) + W.nx * 0.8, cos(r.heading) + W.nz * 0.8); r.airT = 0; r.iT = CTRL.iframes; addTrick(g, r, 'Wallplant', (POINTS.wallRide || 220) * 1.5); g.emit('ollie', 3, 0, 0); }       // ollie off a wall: a Wallplant, big height and speed
    else if (W.t <= 0 || !wallThere) r.wall = null;
    else { step(g, p, r, dt); p.vy = -RIDE.wallSink; p.y += p.vy * dt; const h0 = heightAt(p.x, p.z); if (p.y <= h0) { p.y = h0; r.wall = null; land(g, p, r, cmd); } return true; } }
  step(g, p, r, dt);
  const Gk = RIDE.gravity * (p.vy < 0 ? (r.slamDrop ? 1 : CTRL.fallMul) : 1) * (r.airT > CTRL.hangAfter && p.vy < CTRL.hangVy && p.vy > -CTRL.hangVy ? CTRL.hang : 1);       // a heavier arc: falls faster than it rises; a short hang at the top of big air only
  const h = heightAt(p.x, p.z); p.y += p.vy * dt - 0.5 * Gk * dt * dt; p.vy -= Gk * dt;
  if (p.y <= h) { p.y = h; land(g, p, r, cmd); }
  return true;
}
const hasForward = cmd => Math.abs(cmd.f || 0) > 0.6;
function step(g, p, r, dt) {
  const ax = sin(r.heading), az = cos(r.heading); p.vx = ax * r.speed; p.vz = az * r.speed; p.face = r.heading;
  const blocked = moveXZ(p, p.vx * dt, p.vz * dt, CFG.player.radius, p.grounded ? 1.0 : CFG.player.stepUp);
  if (blocked && RIDE.headOn !== undefined) {
    const nx = blocked & 1 ? (ax > 0 ? -1 : 1) : 0, nz = blocked & 2 ? (az > 0 ? -1 : 1) : 0, into = -(ax * nx + az * nz) / (Math.sqrt(nx * nx + nz * nz) || 1), square = (blocked & 3) === 3 || into > sin(RIDE.headOn * 0.017453292519943295);
    if (!square) {       // glancing: along the wall, most of the speed kept; in the air at speed it is a wall ride
      const tx = nx ? 0 : ax, tz = nz ? 0 : az, tl = Math.sqrt(tx * tx + tz * tz) || 1; r.heading = atan2(tx / tl, tz / tl); r.speed *= RIDE.deflectKeep;
      if (!p.grounded && r.speed >= RIDE.wallMin && !r.wall && heightAt(p.x - (nx || 0) * 0.9 + nx * 0, p.z) >= -1e9) { r.wall = { t: RIDE.wallT, nx, nz }; p.vy = Math.max(p.vy, 0); addTrick(g, r, 'Wall Ride', POINTS.wallRide || 220); g.emit('ollie', 2, 0, 0); }
    } else if (p.grounded && r.speed > 10 && !(r.wallieT > g.t)) { r.wallieT = g.t + 1; p.grounded = false; p.vy = 6; r.airT = 0; r.lastLandVy = 0; r.speed *= 0.75; r.heading += Math.PI; addTrick(g, r, 'Wallie', 150); g.emit('ollie', 2, 0, 0); }       // head-on on the ground: the card pops back off the wall (never a dead stop)
    else if (!p.grounded && r.speed > 10) bail(g, r, 'wall');
    else { r.speed = Math.max(4, r.speed * 0.5); r.heading += Math.PI * 0.5; }       // slow and square: turn along it, keep rolling
  }
  else if (blocked && p.grounded && r.speed > 10 && !(r.wallieT > g.t)) { r.wallieT = g.t + 1; p.grounded = false; p.vy = 6; r.airT = 0; r.lastLandVy = 0; r.speed *= 0.75; r.heading += r.heading > 0 ? -0.35 : 0.35; addTrick(g, r, 'Wallie', 150); g.emit('ollie', 2, 0, 0); }       // a mesa foot or a wall met at speed: the card pops up off it (a wallie) and turns away
  else if (blocked) { const fast = r.speed > 15; r.speed *= 0.5; if (!p.grounded && fast) { bail(g, r, 'wall'); } }       // only a fast crash into a wall in the air bails; a slow bump just stops the card
  resolveColliders(g.colliders, p, CFG.player.radius);
  if (r.speed > 12) { const n = breakVasesNear(g, p.x, p.z, 1.6); for (let i = 0; i < n; i++) addTrick(g, r, 'Smash', POINTS.smash); }
  sealTouch(g, p, r); if (r.speed > 14) closeCall(g, p, r);
  if (r.speed > 8 && RIDE.knock) runThrough(g, p, r);
}
// the feel pass: riding through small enemies throws them (a trick kill that counts toward the combo); a big one (golem, hunter) hops the card over it instead of stopping it
const SMALL = [1, 1, 1, 0, 1, 1, 0];       // by kind id: husk, runner, seer, golem, bloat, scarab, hunter
function runThrough(g, p, r) {
  const e = g.en, ax = sin(r.heading), az = cos(r.heading);
  for (let i = 0; i < e.max; i++) { if (!e.alive[i]) continue; const dx = e.x[i] - p.x, dz = e.z[i] - p.z; if (dx * dx + dz * dz > 1.7 * 1.7 || Math.abs(e.y[i] - p.y) > 1.6) continue;
    if (SMALL[e.kind[i]]) { g.curSrc = g.srcIndex ? g.srcIndex('run-through') : 0; damageEnemy(g, i, 9999, {}); g.curSrc = 0; if (!e.alive[i]) { addTrick(g, r, 'Run Through', RIDE.knock.points); g.emit('knock', e.x[i], e.z[i], r.heading); } }
    else if (p.grounded) { p.grounded = false; p.vy = RIDE.knock.hop; r.airT = 0; r.lastLandVy = 0; damageEnemy(g, i, 20, {}); addTrick(g, r, 'Bump Hop', 100); g.emit('ollie', 2, 0, 0); } }
}
// ---- shrines you ride (plan section 10): Ring Shrine, one lap of its ring rail grinded (a second lap lifts the tier); Gate Shrine, its five arches threaded in one go
const TWO_PI = 6.283185307179586, wrapPi = a => (a > 3.141592653589793 ? a - TWO_PI : a < -3.141592653589793 ? a + TWO_PI : a);
function shrineTier(g) { const st = flowOf(g).step; return st >= 5 ? 'epic' : st >= 3 ? 'rare' : null; }
// rolling logs: roll for 4 s, slowing, flattening enemies in the way
export function rollersTick(g, dt) {
  for (const L of g.world.rollers || []) { if (L.t <= 0) continue; L.t -= dt; const k = Math.max(0, L.t / 4); L.x += L.vx * k * dt; L.z += L.vz * k * dt; L.y = heightAt(L.x, L.z); L.spin += 9 * k * dt; const e = g.en; for (let i = 0; i < e.max; i++) { if (!e.alive[i]) continue; const dx = e.x[i] - L.x, dz = e.z[i] - L.z; if (dx * dx + dz * dz < 5) damageEnemy(g, i, 12 * dt * 10, { noCrit: true }); } }
}
export function shrineRide(g, p, r, dt) {
  for (const s of g.world.shrines || []) {
    if (s.done || s.form === 'stand') continue; const dx = p.x - s.x, dz = p.z - s.z; if (dx * dx + dz * dz > 70 * 70) continue; const C = s.course || (s.course = shrineCourse(s.x, s.z));
    if (C.kind === 'ring') {
      const on = r.grind && r.grind.s[6] === 'ring' && Math.abs(r.grind.s[7] - s.x) < 1.5 && Math.abs(r.grind.s[8] - s.z) < 1.5;
      if (on) { const a = atan2(dz, dx); if (s.rLast !== undefined && s.rIdle < 0.8) s.ra += wrapPi(a - s.rLast); else s.ra = 0; s.rLast = a; s.rIdle = 0;
        const laps = Math.floor(Math.abs(s.ra) / TWO_PI); s.charge = Math.max(s.charge, Math.min(0.98, Math.abs(s.ra) / TWO_PI) * 5);
        if (laps >= 1 && !s.lap1) { s.lap1 = true; g.event('banner', 'Ring Shrine: a full lap. Another clean lap lifts it.'); }
        if (laps >= 2) rideShrineDone(g, s, shrineTier(g), true, 'Two laps'); }
      else { s.rIdle = (s.rIdle || 0) + dt; if (s.lap1 && s.rIdle > 0.8) rideShrineDone(g, s, shrineTier(g), false, 'A lap'); }
    } else if (C.kind === 'bowl') {       // three laps ridden inside the marker stones (6 to 16 m out) within 20 s; under 12 s lifts the tier
      const d = Math.sqrt(dx * dx + dz * dz), a = atan2(dz, dx); if (d > 5 && d < 17) { if (s.bLast !== undefined) s.ba += wrapPi(a - s.bLast); else { s.ba = 0; s.bT = 0; } s.bLast = a; s.bT += dt; s.charge = Math.max(s.charge, Math.min(0.98, Math.abs(s.ba) / (3 * TWO_PI)) * 5);
        if (s.bT > 20) { s.ba = 0; s.bT = 0; } if (Math.abs(s.ba) >= 3 * TWO_PI) rideShrineDone(g, s, shrineTier(g), s.bT < 12, 'Three laps'); } else s.bLast = undefined;
    } else if (C.kind === 'spire') {       // air over the spire: clear its top by 0.3 m within 2 m of it; 2 m clear or a trick in that air lifts the tier
      const sp = C.spire, ex = p.x - sp.x, ez = p.z - sp.z, top = heightAt(sp.x, sp.z) + sp.h; if (!p.grounded && ex * ex + ez * ez < 3.5 * 3.5 && p.y > top + 0.3) { s.sp = Math.max(s.sp || 0, p.y - top); s.spTr = s.spTr || r.combo.n; }
      if (s.sp && p.grounded) rideShrineDone(g, s, shrineTier(g), s.sp > 2 || r.combo.n > (s.spTr || 0), 'Over the spire');
    } else if (C.kind === 'pipe') {       // one clean loop of its full pipe
      if (r.loop && Math.abs(r.loop.x - C.pipe.x) < 3 && Math.abs(r.loop.z - C.pipe.z) < 3) s.inLoop = true; if (s.inLoop && !r.loop) { s.inLoop = false; if (r.bailT <= 0) rideShrineDone(g, s, shrineTier(g), false, 'A loop'); }
    } else {
      s.gIdle = (s.gIdle || 0) + dt; if (s.gIdle > 6) { s.gn = 0; s.gDir = 0; }
      const prev = s.gPrev || (s.gPrev = []); C.arches.forEach((A, i) => { const ax = p.x - A.x, az = p.z - A.z, d = ax * A.ux + az * A.uz, lat = Math.abs(-ax * A.uz + az * A.ux), was = prev[i]; prev[i] = d;
        if (was === undefined || (was < 0) === (d < 0) || lat > 1.8 || p.y - heightAt(A.x, A.z) > 3.3) return;
        const dir = d > was ? 1 : -1, want = dir > 0 ? (s.gn || 0) : 4 - (s.gn || 0); if ((s.gDir && s.gDir !== dir) || i !== want) { s.gn = 0; s.gDir = 0; if (!((dir > 0 && i === 0) || (dir < 0 && i === 4))) return; }
        s.gDir = dir; s.gn = (s.gn || 0) + 1; s.gIdle = 0; s.charge = Math.max(s.charge, s.gn * 0.98); g.emit('arch', A.x, A.z, s.gn);
        if (s.gn >= 5) rideShrineDone(g, s, shrineTier(g), false, 'Five arches'); });
    }
  }
}
// a trunk, a cactus or a stone card passed within a hand of the card at speed: Close Call (once per thing)
function closeCall(g, p, r) {
  const C = g.colliders; if (!C || !C.grid) return; const i0 = Math.floor((p.x - 3) / C.CELL), i1 = Math.floor((p.x + 3) / C.CELL), j0 = Math.floor((p.z - 3) / C.CELL), j1 = Math.floor((p.z + 3) / C.CELL);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = C.grid.get(i * 4096 + j); if (!a) continue; for (const c of a) { if (c === r.ccLast || p.y > c.top) continue; const dx = p.x - c.x, dz = p.z - c.z, d = Math.sqrt(dx * dx + dz * dz) - c.r - CFG.player.radius; if (d < 0.9) { r.ccLast = c; addTrick(g, r, 'Close Call', POINTS.closeCall); return; } } }
}
// a set's stones stay lit for 15 s from the first, through landings; a bail puts them out
// a seal stone lights as the card passes over it (within 2 m, on the ground or in the air); light all five of one set inside one combo and the set opens a free chest
function sealTouch(g, p, r) {
  for (const s of sealsNear(g, p.x, p.z, 3.0)) {
    const sid = s[3], dy = p.y - s[1]; if (dy < -1 || dy > 5) continue; const L = litOf(g); if (L.sealsDone[sid]) continue;
    const run = r.sealRun || (r.sealRun = {}); let E = run[sid]; if (!E || g.t - E.t > 15) { E = run[sid] = { k: [], t: g.t }; L.ver++; } const have = E.k, key = s[0] + ',' + s[2]; if (have.includes(key)) continue; have.push(key); addTrick(g, r, 'Seal', POINTS.seal); answerTrick(g, 'seal', s[0], s[1], s[2]); L.ver++; g.emit('seal', s[0], s[2], have.length);
    if (have.length >= sealSet(g, sid).length) { L.sealsDone[sid] = true; L.ver++; flowOf(g).sets = (flowOf(g).sets || 0) + 1; addTrick(g, r, 'Seal Set', POINTS.sealSet); const tx = s[0] + sin(r.heading) * 6, tz = s[2] + cos(r.heading) * 6; const wonder = sid === -1; g.world.cchests.push({ x: tx, y: heightAt(tx, tz), z: tz, open: false, rarity: wonder ? 'epic' : null, free: true, trophy: true }); g.emit('sealset', tx, tz, wonder ? 1 : 0); g.event('banner', wonder ? 'The wonder wakes: an epic chest rises.' : 'The seal stones wake: a chest rises.'); }
  }
}
export function litOf(g) { return g.rideLit || (g.rideLit = { cards: {}, sealsDone: {}, ver: 0 }); }
// the seal stones glowing now: every finished set, and the stones lit in the open combo
export function litSeals(g) { const L = litOf(g), r = g.p.ride, out = []; for (const sid in L.sealsDone) for (const s of sealSet(g, +sid)) out.push([s[0], s[1], s[2], 1]); if (r && r.sealRun) for (const sid in r.sealRun) { const E = r.sealRun[sid]; if (L.sealsDone[sid] || g.t - E.t > 15) continue; for (const k of E.k) { const [x, z] = k.split(',').map(Number); const s = sealSet(g, +sid).find(q => q[0] === x && q[2] === z); if (s) out.push([s[0], s[1], s[2], 0]); } } return out; }
function groundFollow(g, p, r, dt) {
  const lift = kickerLift(g, p, r), h = heightAt(p.x, p.z) + lift, prev = p.y;       // on a kicker's face the ground is the ramp (so the card climbs it instead of being thrown off its foot)
  if (lift > 0) { r.rvy = 0; p.y = h; return; }       // on the face: climb it; the lip throws the card (kickerTick), never a crest halfway up
  if (h >= prev - 0.35) { const rvy = (h - prev) / Math.max(dt, 1e-4), sx = sin(r.heading), sz = cos(r.heading), ahead = (heightAt(p.x + sx * 0.8, p.z + sz * 0.8) - h) / 0.8 * r.speed;
    if (r.rvy > 4 && ahead < r.rvy * 0.35 && rvy > 0) { p.y = h; p.grounded = false; p.vy = r.rvy * 0.95; r.airT = 0; r.lastLandVy = 0; if (r.rvy > 3 && r.speed > 13) { addTrick(g, r, 'Crest Launch', POINTS.crest); g.emit('crest', p.x, p.z, 0); } r.rvy = 0; return; }       // the lip of a ramp or a crest: the climb carries the card into the air
    r.rvy = Math.min(rvy, r.speed * 0.6); p.y = h; return; }       // the climb rate, capped at a 31-degree ramp: a step in the ground is not a launcher
  // the ground falls away faster than the card can follow: off the crest into the air, carrying the climb
  p.grounded = false; p.vy = Math.max(0, r.rvy) * 0.9; r.airT = 0;
  if (r.rvy > 3 && r.speed > 13) { p.vy *= 1.15; addTrick(g, r, 'Crest Launch', POINTS.crest); g.emit('crest', p.x, p.z, 0); }       // a dune crest taken fast throws the card up a little more, and counts
}
function land(g, p, r, cmd) {
  p.grounded = true; const vy = r.lastLandVy || p.vy; p.vy = 0;
  const bigAir = r.airT > (RIDE.bigAirT || 1.1); if (bigAir) addTrick(g, r, 'Big Air', POINTS.bigAir * r.airT);
  const halves = Math.round(Math.abs(r.spin) / 3.141592653589793), rem = Math.abs(Math.abs(r.spin) - halves * 3.141592653589793);
  if (halves > 0) addTrick(g, r, (halves * 180) + ' Spin', POINTS.spin180 * halves);
  // landing assist (touch, on by default; only at Flow x1 and x2): a wider landing angle, a flip nearly done counts, a grab still held is let go on touchdown
  const assist = !!(g.opts && g.opts.rideAssist) && flowOf(g).step <= 2; let letGo = false; if (assist && r.grabbing) { letGo = true; r.grabbing = false; addTrick(g, r, r.grabName, POINTS.grab + POINTS.grabPerSecond * r.grabT); }
  const clean = !r.grabbing && r.flipT <= (assist ? 0.16 : 0.1) && rem <= RIDE.landTol * (assist ? 1.6 : 1);
  const why = r.grabbing ? 'grab' : r.flipT > 0.1 ? 'flip' : 'angle';       // a flip with 0.1 s or less to go finishes on touchdown (the feel pass: the finish grace)
 r.spin = 0; r.flipT = 0; r.airT = 0;       // (the reason is read before the flip clock is cleared)
  if (!clean) { bail(g, r, why); return; }
  if (r.slamDrop) { r.slamDrop = false; r.iT = CTRL.iframes; p.iframeT = r.iT; const R2 = CTRL.slamClear * CTRL.slamClear; for (const b of g.eb || []) if (b.on && (b.x - p.x) * (b.x - p.x) + (b.z - p.z) * (b.z - p.z) < R2) b.on = false; g.emit('slamdrop', p.x, p.z, 0); }       // a Slam Drop lands: i-frames, and the enemy shots near it are wiped (the slam itself fires as the combo banks)
  if (r.revertT > 0 && vy < -4) { addTrick(g, r, 'Revert', POINTS.revert); r.revertT = 0; if (cmd.revert) { r.manual = true; r.manualFlick = false; r.bal = 0; r.manualT = 0; return; } }       // a revert chains into a manual while the button is held
  if (letGo) r.manualHold = true;       // the slide still held from the grab is not a manual
  if (r.manualArm !== undefined && r.clk - r.manualArm < 0.4) { r.manualArm = undefined; r.manual = true; r.manualFlick = true; r.bal = 0; r.manualT = 0; return; }       // flicked just before landing: land into a manual
  if ((cmd.revert || (cmd.slide && !letGo)) && comboValue(r.combo) > 0) { r.manual = true; r.manualFlick = false; r.bal = 0; r.manualT = 0; r.comboT = CTRL.comboT; return; }       // the manual button held on landing: a manual, the combo stays open (C held still works)
  if (halves >= 2) answerTrick(g, 'spin', p.x, p.y, p.z); if (bigAir) answerTrick(g, 'air', p.x, p.y, p.z);
  if (bigAir && g.mods.duneAir > 0 && g.map.regionAt && g.map.regionAt(p.x, p.z).type === 0) { const k = 1 + 0.6 * g.mods.duneAir; explode(g, p.x, p.y, p.z, 6 * k, 0, 14 * k, 0xf3c978, 'Dune Kite'); g.emit('slam', p.x, p.z, 6 * k); }       // Dune Kite
  bank(g, r); answerTrick(g, 'land', p.x, p.y, p.z); g.emit('land', p.x, p.z, -vy);
}
function manualTick(g, p, r, dt, cmd, jumpPress) {
  if (r.manualFlick) { if (jumpPress) { r.manual = false; r.manualFlick = false; addTrick(g, r, 'Manual', POINTS.manualPerSecond * (r.manualT || 0)); r.crouch = 0.001; return; } }       // a flick manual ends with an ollie, the combo still open
  else if (!cmd.slide && !cmd.revert) { r.manual = false; addTrick(g, r, 'Manual', POINTS.manualPerSecond * (r.manualT || 0)); bank(g, r); return; }
  const mt0 = r.manualT || 0; r.manualT = mt0 + dt; if (Math.floor(r.manualT) > Math.floor(mt0)) answerTrick(g, 'manual', p.x, p.y, p.z);
  r.comboT = (r.comboT === undefined ? CTRL.comboT : r.comboT) - dt;       // no balance bar: the combo timer runs; a new trick, rail or ramp refills it; at zero the combo banks (never a bail)
  if (r.comboT <= 0) { r.manual = false; addTrick(g, r, 'Manual', POINTS.manualPerSecond * (r.manualT || 0)); bank(g, r); }
}
// ---- grinds
function trySnap(g, p, r, cmd, down) {
  const rails = railsNear(g, p.x, p.z, 8); let best = null, bd = RIDE.snap * RIDE.snap;
  for (const s of rails) {
    const dx = s[3] - s[0], dz = s[5] - s[2], L2 = dx * dx + dz * dz; if (L2 < 0.25) continue; let t = ((p.x - s[0]) * dx + (p.z - s[2]) * dz) / L2; if (t < 0.02 || t > 0.98) continue;
    const qx = s[0] + dx * t, qz = s[2] + dz * t, qy = s[1] + (s[4] - s[1]) * t, d2 = (qx - p.x) * (qx - p.x) + (qz - p.z) * (qz - p.z), dy = p.y - qy;
    if (dy < (down ? -0.8 : 0.15) || dy > (down ? 2.4 : 1.4) || d2 >= bd || (!down && d2 > 2.6)) continue; bd = d2; best = { s, t, L: Math.sqrt(L2) };       // still rising: it takes the rail once the card is just over its top (jump near a rail and it grinds, no pixel aim)
  }
  if (!best) return false;
  const s = best.s, ux = (s[3] - s[0]) / best.L, uz = (s[5] - s[2]) / best.L, along = p.vx * ux + p.vz * uz, dir = along >= 0 ? 1 : -1;
  const hs = Math.sqrt(p.vx * p.vx + p.vz * p.vz); r.grind = { s, t: best.t, L: best.L, dir, speed: Math.max(6, Math.abs(along) * 0.6 + hs * 0.4) * (1 + (g.mods.grindSpeed || 0)), time: 0, name: GRINDS[cmd.f > 0.4 ? 1 : cmd.f < -0.4 ? 2 : Math.abs(cmd.r || 0) > 0.4 ? 3 : 0] };
  if (r.grind.name === 'Nosegrind') r.grind.speed *= CTRL.nosegrindSpeed; r.comboT = CTRL.comboT;       // a new rail refills the combo timer; a Nosegrind is faster
  r.bal = 0; r.flipT = 0; r.grabbing = false; p.vy = 0; p.grounded = false; g.emit('grind', 1, 0, 0);
  if (s[6] === 'card') { const L = litOf(g), key = s[7] + ',' + s[8]; if (!L.cards[key]) { L.cards[key] = [(s[0] + s[3]) / 2, s[1], (s[2] + s[5]) / 2]; L.ver++; addTrick(g, r, 'Lit Card', POINTS.cardLit); g.emit('cardlit', L.cards[key][0], L.cards[key][2], s[1]); } }       // a stone card lights for good the first time it is ground
  return true;
}
function grindTick(g, p, r, dt, cmd, jumpPress) {
  const G = r.grind, s = G.s, ux = (s[3] - s[0]) / G.L, uz = (s[5] - s[2]) / G.L, slope = (s[4] - s[1]) / G.L * G.dir;
  G.speed = Math.max(4, Math.min(RIDE.top, G.speed + (-slope * 12 - 0.35) * dt)); G.t += G.dir * G.speed * dt / G.L; G.time += dt;
  r.comboT = (r.comboT === undefined ? CTRL.comboT : r.comboT) - dt; r.bal = 0;       // no balance bar on a rail: the combo timer; at zero the card hops off the rail with the combo still open
  const done = G.t <= 0 || G.t >= 1 || r.comboT <= 0, fell = false;
  const t = Math.max(0, Math.min(1, G.t)); p.x = s[0] + (s[3] - s[0]) * t; p.z = s[2] + (s[5] - s[2]) * t; p.y = s[1] + (s[4] - s[1]) * t + 0.08; p.vx = ux * G.dir * G.speed; p.vz = uz * G.dir * G.speed; r.heading = atan2(p.vx, p.vz); r.speed = G.speed; p.face = r.heading;
  F0(g).grindSec = (F0(g).grindSec || 0) + dt;
  r.sparkT -= dt; if (r.sparkT <= 0) { r.sparkT = RIDE.sparkEvery; sparks(g, p); if (g.field && g.field.duelist === 'mira') { const e = g.en; for (let i = 0; i < e.max; i++) if (e.alive[i] && (e.x[i] - p.x) ** 2 + (e.z[i] - p.z) ** 2 < 36) e.mark[i] = Math.max(e.mark[i], 3); } answerTrick(g, 'grind', p.x, p.y, p.z); } sealTouch(g, p, r);       // seal stones light from a rail too
  if (fell) { r.grind = null; addTrick(g, r, G.name, POINTS.grind + POINTS.grindPerSecond * G.time); bail(g, r, 'balance'); p.grounded = false; p.vy = 0; return; }
  if (done || jumpPress) { r.grind = null; addTrick(g, r, G.name, POINTS.grind + POINTS.grindPerSecond * G.time); p.grounded = false; p.vy = jumpPress ? Math.sqrt(2 * RIDE.gravity * RIDE.popLo) : 1.5; r.airT = 0; r.lastLandVy = 0; }
}
function sparks(g, p) {
  const ru = g.mods.ruinGrind > 0 && g.map.regionAt && g.map.regionAt(p.x, p.z).type === 4 ? g.mods.ruinGrind : 0, SR = (RIDE.sparkR + ru) * (g.p.ride && g.p.ride.grind && g.p.ride.grind.name === '5-0' ? CTRL.fiveOhSpark : 1), R2 = SR * SR;       // a 5-0 leaves a wide elemental trail       // Ruin Chalk
  const e = g.en; for (let i = 0; i < e.max; i++) { if (!e.alive[i]) continue; const dx = e.x[i] - p.x, dz = e.z[i] - p.z; if (dx * dx + dz * dz < R2) damageEnemy(g, i, RIDE.sparkDmg * flowDamage(g) * (1 + 0.8 * ru), { noCrit: true }); }
  g.emit('sparks', p.x, p.z, 0);
}
// round the inside of the hoop: the angle runs at speed over radius, the card upside down at the top; out the bottom going on the same way
function loopTick(g, p, r, dt) {
  const L = r.loop; L.th += Math.max(r.speed, 13) / L.R * dt; const th = Math.min(L.th, 6.283185307179586), al = sin(th) * L.R * 0.35 + (th / 6.283185307179586) * 1.2;
  p.x = L.x + L.ux * al; p.z = L.z + L.uz * al; p.y = L.y + L.R - cos(th) * L.R; p.vx = L.ux * r.speed; p.vz = L.uz * r.speed; p.vy = 0; p.grounded = false; r.heading = atan2(L.ux, L.uz); p.face = r.heading; r.loopTh = th;
  if (th >= 6.283185307179586) { r.loop = null; r.lastLoopT = g.t; flowOf(g).loops = (flowOf(g).loops || 0) + 1; r.loopTh = 0; r.loopCd = 0.8; p.grounded = true; p.y = heightAt(p.x, p.z); r.speed = Math.min(RIDE.top, r.speed * 1.05); }
}
// a kicker: on its ramp the card rises with it; off its lip at speed it launches (more air the faster), and counts
// a kicker: the ramp's height over the ground where the card is, when it rides up the face (from the front, along its heading); 0 elsewhere
function kickerAt(g, p, r) {
  const hx = sin(r.heading), hz = cos(r.heading);
  let best = null; for (const q of kickersNear(g, p.x, p.z, 10)) { const [x, y, z, ux, uz, len, w, h] = q, dx = p.x - x, dz = p.z - z, a = dx * ux + dz * uz + len / 2, b = Math.abs(-dx * uz + dz * ux); if (b > w / 2 + 0.3 || a < -0.2 || a > len + 0.4 || hx * ux + hz * uz < 0.35) continue; const k = { a: Math.max(0, a), len, h }, l = h * Math.min(1, k.a / len); if (!best || l > best.l) { best = k; best.l = l; } }
  return best;       // two faces overlapping: ride the higher one, so the ground never drops under the card
}
function kickerLift(g, p, r) { const k = kickerAt(g, p, r); return k ? k.h * Math.min(1, k.a / k.len) : 0; }
// off the lip at speed: launch, more air the faster, and it counts
function kickerTick(g, p, r) {
  if (r.speed < 4) return false; const k = kickerAt(g, p, r); if (!k) { r.kickA = -1; return false; }
  const lipNow = k.a >= k.len - 0.05, crossed = r.kickA >= 0 && r.kickA < k.len && k.a >= k.len - 0.6; r.kickA = k.a;
  if (lipNow || crossed) { p.y = heightAt(p.x, p.z) + k.h; p.grounded = false; p.vy = Math.min(12.5, 6.5 + r.speed * 0.3 + k.h * 0.8);       // at least ~0.75 s of air off any lip, at any ride speed
 r.airT = 0; r.lastLandVy = 0; r.kickA = -1; addTrick(g, r, 'Kicker', 80); g.emit('ollie', 3, 0, 0); return true; }
  return false;
}
// a quarter pipe cut into a hill face: riding up the face (uphill, within 4 m of its line) into the carved lip sends the card vert, back down facing out
function quarterTick(g, p, r) {
  if (r.speed < 9) return false; const hx = sin(r.heading), hz = cos(r.heading);
  for (const q of quartersNear(g, p.x, p.z, 6)) { const [x, y, z, ux, uz, w] = q, dx = p.x - x, dz = p.z - z, along = Math.abs(-dx * uz + dz * ux), into = dx * ux + dz * uz; if (along > w / 2 || into < -1.5 || into > 1.5 || hx * ux + hz * uz < 0.5) continue;
    p.vy = Math.min(11, r.speed * 0.6); p.grounded = false; r.airT = 0; r.vert = true; r.vertG = 1.5; r.heading += 3.141592653589793; r.speed *= 0.2; r.lastLandVy = 0; addTrick(g, r, 'Quarter', POINTS.vert); g.emit('ollie', 2, 0, 0); return true; }
  return false;
}
function dismount(g, p, r) { r.on = false; r.runT = 0; r.slideWas = true; r.grind = null; r.manual = false; const ax = sin(r.heading), az = cos(r.heading); p.vx = ax * r.speed; p.vz = az * r.speed; g.emit('ride', 0, 0, 0); }
