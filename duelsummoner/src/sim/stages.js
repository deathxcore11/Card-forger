// The stage machine: a run is Stage 1, 2 and 3 (or one Quick Duel stage). Each stage has a clock, an elite and two timed bosses on a
// timeline, a gate that wakes, a gate boss, then a Descent Circle to the next stage (Stage 3: the Final Altar). Pure and deterministic.
// Everything tunable lives in data/stages.js. See design/run-structure.md (draft v1).
import { RUN } from '../data/waves.js';
import { sealStageStart, sealGateCleared } from './seals.js';
import { RUNSPEC, stagesFor, DIFFICULTY, ACES, BIG_PACE, BIG_TUNE } from '../data/stages.js';
import { initDoor, doorTick, doorReady } from './door.js';
import { STAKES, stakesDensity, stakesFrac } from './stakes.js';
import { pow, sin, cos, atan2 } from './dmath.js';
import { spawnEnemy, spawnAce, mergeEnemy, spawnRate, spotNear, enemyCount } from './enemies.js';
import { aliveAces } from './aces.js';
import { makeFog, makeFogBig, exploredAt } from './fog.js';
import { buildColliders } from './colliders.js';
import { CFG } from '../data/config.js';
import { K } from '../data/tuning.js';
import { spawnSpecial, startBoss } from './specials.js';
import { heightAt } from './terrain.js';
import { buildWorld, emptyWorld } from './world.js';
import { loadMap } from './terrain.js';
import { generateStage } from '../gen/generate.js';
import { sampleMap } from '../gen/sample.js';
import { openMap } from '../gen/open/terrain.js';
import { bigMap } from '../gen/world/map.js';
import { streamTo } from './terrain.js';
import { streamWorld } from './stream.js';
import { fusionsReady } from './field.js';
import { mixFor, pickKind } from './spawner.js';

const spot = { x: 0, y: 0, z: 0 };
const clockText = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

// XP gained is scaled by the run minute so the first minutes give about 4 level-ups a minute (data: RUNSPEC.xp)
export function xpScale(g) {
  const X = RUNSPEC.xp, m = g.mode === 'classic' ? g.t / 60 : (g.scTotal + g.sc) / 60 * (g.paceK || 1), boost = (g.big && g.stage === 0 ? 1 + 1.6 * Math.max(0, 1 - g.sc / 300) : 1) * (g.big && g.surgeP && g.surgeP.on ? 2.2 : 1);       // the big desert's first five minutes pay level-ups faster (the first minutes of the reference run are full of them)
  return boost * ot2XpMul(g) * (g.big ? (1 + (g.stakes || 0) * STAKES.xp) * (g.rflow ? 1 + (g.rflow.step - 1) * 0.1 : 1) : 1) * (X.start + (X.end - X.start) * (m >= X.minutes ? 1 : m / X.minutes)) * (1 + X.growth * (m > X.growFrom ? m - X.growFrom : 0));
}

// ---- setup ----
// Generates this stage's map from the run seed and loads it as the live terrain; the duelist starts on its plaza.
export function loadStageMap(g, i) {
  if (g.opts.terrain === 'open' && g.mode !== 'classic') { const T = BIG_TUNE[g.difficulty], base = DIFFICULTY[g.difficulty]; g.diff = Object.assign({}, base); if (T && i === 0) for (const k of ['hp', 'spawn', 'dmg', 'boss']) g.diff[k] = base[k] * T[k]; if (T && i === 0) g.diff.gate = T.gate || 1; }       // the big desert's first stage is tuned harder (a first-timer may not get through it); later stages keep the base numbers
  g.map = g.opts.terrain === 'open' ? bigMap(g.seed, i, { gym: !!g.opts.gym }) : g.opts.terrain === 'small' ? (openMap(g.seed, i, g.opts.arch) || generateStage(g.seed, i, g.stages[i].gen)) : g.opts.sample && i === 0 ? sampleMap() : generateStage(g.seed, i, g.opts.oldGen ? Object.assign({}, g.stages[i].gen, { old: true }) : g.stages[i].gen); loadMap(g.map); g.syncGrid(); g.colliders = buildColliders(g.map, i); g.streamed = new Set(); g._sq = -1; if (g.big) initDoor(g); if (g.big && g.stakesAdd === undefined) g.stakesAdd = 0; if (g.map.big) { g.fog = makeFogBig(); streamTo(g.map.spawn.x, g.map.spawn.z, 49, 3); g.colliders.ensure(g.map.spawn.x - 130, g.map.spawn.z - 130, g.map.spawn.x + 130, g.map.spawn.z + 130); } g.flow.col = g.colliders; g.flow.rebuild(); g.sealCode = g.map.sealCode;
  const p = g.p; p.x = g.map.spawn.x; p.z = g.map.spawn.z; p.y = heightAt(p.x, p.z); p.vx = p.vz = p.vy = 0; p.grounded = true;
  g.openFlow = !!(g.map && g.map.open && g.mode !== 'classic'); g.gateSeen = false; g.sleepersMade = false; g.horde = { on: false, t: 0, why: '' };       // the open desert has its own stage flow: the gate wakes by choice, the elite and the mini bosses sleep, a horde rises after the boss or when the clock runs out
}
export function initRun(g) {
  g.mode = g.opts.mode || 'classic'; g.difficulty = DIFFICULTY[g.opts.difficulty] ? g.opts.difficulty : 'medium'; g.diff = DIFFICULTY[g.difficulty]; g.maxAlive = RUN.maxAlive;

  if (g.mode === 'classic') { g.stages = null; g.stageSpec = null; return; }
  g.big = g.opts.terrain === 'open'; g.paceK = g.big ? BIG_PACE : 1; g.stages = stagesFor(g.mode, g.big); const open = g.opts.meta && g.opts.meta.stagesOpen; if (open && g.opts.flow !== 'v2' && g.mode === 'run' && open < g.stages.length) g.stages = g.stages.slice(0, open); g.stage = 0; g.scTotal = 0; g.stagesCleared = 0; g.stageFacts = [];
  g.flow2 = g.big && g.opts.flow === 'v2'; g.swiftChips = 0; g.duelOn = false; g.otT = 0; g.desc = null; g.chestsOpenedTotal = 0; g.heat = 1;
  initStage(g); loadStageMap(g, 0); g.world = buildWorld(g); if (g.map.big) streamWorld(g, 0);
  g.event('banner', g.stageSpec.name + '. Seal Code ' + g.sealCode);
}
// For tools, tests and golden scenes: restart the stage machine at stage i (the build and the clock total carry as they are).
export function jumpToStage(g, i) { g.stage = i; initStage(g); loadStageMap(g, i); g.world = buildWorld(g); if (g.map.big) streamWorld(g, 0); }
function initStage(g) {
  const S = g.stageSpec = g.stages[g.stage];
  g.sc = 0; g.evState = S.timeline.map(() => 0); g.evSpot = S.timeline.map(() => ({ x: 0, y: 0, z: 0 }));
  g.gate = { state: 'closed', awake: false, hold: 0, early: false, toll: false };
  g.aceT = 0; g.fog = makeFog(); g.bDown = false; g.gateDown = null; g.circle = null; g.altar = null; g.stagePrompt = '';
  g.boss = { state: 'idle', early: false, phase: 1 };
  g.spawnAcc = 0; g.ringT = 0; g.golemT = 0; g.huntT = 0; g.killsAtStage = g.kills; sealStageStart(g);
  g.surgeAnn = [0, 0, 0]; g.surgeDone = [0, 0, 0]; g.surgeAt = [0, 0, 0];
  g.ot2 = null; g.shades = []; g.shadeOn = false; g.shadeAge = 0; g.shadeNextAdd = 0; g.shadeWaveT = 0; g.afterGate = 0;
  g.flags.warden = g.flags.idols = true;                       // the classic timed elites are replaced by the timeline
}

// ---- per tick ----
export function updateStages(g, dt) {
  if (g.duelOn) { shadesTick(g, dt); overtime(g, dt); return; }
  const S = g.stageSpec, G = g.gate, p = g.p, cmd = g._cmd;
  const fight = G.state === 'fight';
  if (G.state === 'closed') g.sc += dt;                         // the clock freezes during the gate fight and after it
  const m = (g.scTotal + g.sc) / 60 * (g.paceK || 1), D = g.diff, C = D.hpCurve;
  g.hpMul = S.mult * (1 + C.a * m + C.b * m * m) * g.heat * D.hp * (1 + STAKES.hpAtCap * stakesFrac(g));
  g.dmgMul = D.dmg * (1 + D.dmgPerMinute * Math.max(0, m - 3)) * (1 + STAKES.dmgAtCap * stakesFrac(g));
  g.maxAlive = Math.floor(D.cap.start + (D.cap.end - D.cap.start) * (m >= D.cap.minutes ? 1 : m / D.cap.minutes));
  if (g.big) g.maxAlive = Math.min(CFG.enemy.max, Math.floor(300 + (g.stakes || 0) * 2));       // the big desert: the crowd grows with Stakes, up to the pool (900); past it a spawn merges into the nearest of its kind
  g.stagePrompt = '';
  if (g.openFlow && g.horde.on) { g.horde.t += dt; const hm = Math.max(0, g.horde.t) / 60; if (g.horde.t > 0) { g.hpMul *= 1.6 * (1 + 0.25 * hm); g.dmgMul *= 1.25 * (1 + 0.1 * hm); g.maxAlive = Math.floor(g.maxAlive * (1.5 + 0.2 * hm)); } }       // a clearly stronger, endless, rising horde
  if (g.flow2 && g.ot2) ot2Tick(g, dt);       // flow v2: Overtime after the stage boss
  shadesTick(g, dt); surgeTick(g);

  if (g.gateDown) { const sp = g.gateDown; g.gateDown = null; gateCleared(g, sp); return; }
  if (g.circle) { circleTick(g, dt); if (g.openFlow) spawner(g, dt, false, false); return; }       // the horde keeps rising while the gateway stands open
  if (g.altar) { altarTick(g); return; }

  if (g.openFlow) { if (g.flow2) flow2Tick(g, dt); else openTick(g, dt); fusionGuard(g, dt); spawner(g, dt, G.state === 'fight', false); return; }
  // timeline: announce 5 s ahead on a chosen boss ring, then spawn there
  if (G.state === 'closed') for (let i = 0; i < S.timeline.length; i++) {
    const ev = S.timeline[i], st = g.evState[i];
    if (st === 0 && g.sc >= ev.t - RUNSPEC.announceSeconds) {
      const at = g.evSpot[i];
      if (ringSpot(g, at)) { /* the nearest boss ring, 25 to 40 m away when one is */ } else if (spotNear(g, spot)) { at.x = spot.x; at.y = spot.y; at.z = spot.z; } else { at.x = g.p.x + 25; at.z = g.p.z; at.y = heightAt(at.x, at.z); }
      g.evState[i] = 1; g.emit('announce', i, at.x, at.z, ev.role); g.event('banner', ev.name + ' in ' + RUNSPEC.announceSeconds + ' seconds.');
    } else if (st === 1 && g.sc >= ev.t) {
      // boss rule: a timed boss waits for the previous timed boss to die, so there are never two timed boss bars at once
      if (ev.role !== 'elite' && g.sp.some(s => s.alive && (s.role === 'bossA' || s.role === 'bossB'))) { if (!g.evWaitSaid) { g.evWaitSaid = true; g.event('banner', ev.name + ' waits for the boss before it.'); } continue; }
      g.evWaitSaid = false; spawnSpecial(g, ev, g.evSpot[i]); g.evState[i] = 2;
    }
  }
  // the gate wakes when timed boss B falls, or at its wake time
  if (G.state === 'closed' && !G.awake && (g.bDown || g.sc >= S.gateWake)) { G.awake = true; g.emit('gatewake'); g.event('banner', 'The gate of ' + S.gate.name + ' wakes. Hold {use} at the gate to enter.'); }
  const gr = g.map.gate, gx = p.x - gr.x, gz = p.z - gr.z;
  if (G.state === 'closed' && G.awake && gx * gx + gz * gz < gr.radius * gr.radius) {
    g.stagePrompt = 'Hold {use}: enter the gate (forfeits ' + clockText(S.clock - g.sc) + ' of the clock)';
    G.hold = cmd && (cmd.use || cmd.hold) ? G.hold + dt : Math.max(0, G.hold - 2 * dt);
    if (G.hold >= RUNSPEC.gateHoldSeconds) startGate(g, false);
  } else G.hold = Math.max(0, G.hold - 2 * dt);
  // stage timeout: the Toll Bell pulls the duelist into the gate arena, the boss enraged
  if (G.state === 'closed' && g.sc >= S.clock) startGate(g, false, true);

  fusionGuard(g, dt);
  spawner(g, dt, G.state === 'fight', G.toll);
}

// ---- a ready Fusion pair always has a free Sealed Chest within reach ----
function placeNear(g, minD, maxD, out) {
  const p = g.p, tmp = { x: 0, z: 0 };
  for (let k = 0; k < 60; k++) {
    const a = g.rsp() * Math.PI * 2, d = minD + g.rsp() * (maxD - minD), x = p.x + cos(a) * d, z = p.z + sin(a) * d, h = heightAt(x, z);
    if (h >= 50 || Math.abs(h - p.y) > 1.0) continue;                      // standable ground on the duelist's own level
    if (g.flow.valid && !g.flow.next(x, z, tmp) && k < 50) continue;       // and a walkable route to it
    out.x = x; out.y = h; out.z = z; return true;
  }
  return false;
}
function fusionGuard(g, dt) {
  const ready = fusionsReady(g).length > 0, gd = g.fusionGuard, at = { x: 0, y: 0, z: 0 };
  if (!ready) { if (gd) { g.chests = g.chests.filter(c => !c.guaranteed || c.open); g.fusionGuard = null; } return; }
  const add = (lo, hi) => { if (placeNear(g, lo, hi, at)) { const c = { x: at.x, y: at.y, z: at.z, open: false, kind: 'sealed', guaranteed: true }; g.chests.push(c); g.emit('fusionchest', 0, at.x, at.z); return c; } return null; };
  if (!gd) { const c = add(8, 14); if (c) { g.fusionGuard = { t: 0, second: false }; g.event('banner', 'A Fusion is ready. A Sealed Chest has appeared nearby: open it.'); } return; }
  if (g.chests.some(c => c.guaranteed && !c.open)) {
    gd.t += dt;
    if (gd.t >= 45 && !gd.second) { gd.second = true; if (add(5, 9)) g.event('banner', 'Another Sealed Chest has appeared closer.'); }
  }
}

// The boss ring (a flat open disc the generator reserved) whose distance from the duelist is closest to 32 m, avoiding rings already used.
function ringSpot(g, at) {
  const R = g.map.bossRings; if (!R || !R.length) return false;
  let best = null, bs = 1e9;
  for (const r of R) { const d = Math.sqrt((r.x - g.p.x) ** 2 + (r.z - g.p.z) ** 2), used = g.evSpot.some(s => s !== at && s.x === r.x && s.z === r.z); const s = Math.abs(d - 32) + (used ? 80 : 0) + (d < 15 ? 60 : 0); if (s < bs) { bs = s; best = r; } }
  at.x = best.x; at.z = best.z; at.y = heightAt(best.x, best.z); return true;
}
function startGate(g, early, toll) {
  const S = g.stageSpec, G = g.gate, left = S.clock - g.sc;
  if (!toll && left > 1 && !g.openFlow) { g.swiftChips += Math.floor(left / 2); g.coins += Math.floor(left / 4); early = true; }       // Swift Seal: 1 Star Chip per 2 s left, plus coins
  G.state = 'fight'; G.early = early && !toll; G.toll = !!toll;
  for (const o of g.sp) if (o.alive && o.role !== 'gate') o.alive = false;      // timed bosses still alive are dismissed: one boss bar at a time
  const gate = Object.assign({}, S.gate); if (toll) gate.enrage = RUNSPEC.tollEnrage;
  startBoss(g, G.early, gate);
  g.gateOpenedAt = g.sc;
  if (toll) { g.p.x = g.map.arena.tollPull.x; g.p.z = g.map.arena.tollPull.z; g.p.y = heightAt(g.p.x, g.p.z); g.p.vx = g.p.vz = 0; g.p.grounded = true; g.event('banner', 'The Toll Bell rings. The sigil pulls you in.'); g.emit('tollbell'); }
  if (g.openFlow) { g.event('bannerdrop', g.door ? 'You see the door' : 'You see the gate'); g.event('bosscard', gate.name); }       // the large name card: only for the stage boss, when the player wakes the gate
  g.emit('gatefight', g.stage);
}

// The first walkable spot at the boss's ground height, searched outward from the wanted place (not a wall, within 0.5 m of the boss's ground).
function goodSpot(g, sp, wx, wz) {
  const ok = (x, z) => { const h = heightAt(x, z); return h < 50 && Math.abs(h - sp.y) <= 0.5; };
  if (ok(wx, wz)) return { x: wx, z: wz };
  for (let r = 1; r <= 14; r++) for (let k = 0; k < 16; k++) {
    const a = k * 0.3927, x = wx + cos(a) * r, z = wz + sin(a) * r;
    if (ok(x, z)) return { x, z };
  }
  const c = (g.map && g.map.arena && g.map.arena.center) || { x: sp.x, z: sp.z };
  return { x: c.x, z: c.z };
}
function gateCleared(g, sp) {
  const S = g.stageSpec, G = g.gate, p = g.p, last = g.stage >= g.stages.length - 1;
  G.state = 'done'; g.stagesCleared++; g.afterGate = 0; sealGateCleared(g, last);
  g.stageFacts.push({ stage: g.stage + 1, id: S.id, seconds: Math.round(g.sc), kills: g.kills - g.killsAtStage, gateOpenedAt: Math.round(g.gateOpenedAt), early: G.early, toll: G.toll, level: g.level });
  g.en.alive.fill(0);                                           // every enemy crumbles
  if (g.flow2) { for (const o of g.sp) if (o !== sp) o.alive = false; g.chests.push({ x: sp.x, y: sp.y, z: sp.z, open: false, kind: 'sealed' }); bossFell2(g, sp, last); g.emit('gatedown', g.stage); return; }       // flow v2: a portal and Overtime
  if (g.openFlow && !last) { if (!g.horde.on) startHorde(g, 'boss'); else g.horde.t = Math.min(g.horde.t, 0); }       // the end-stage horde rises after a short beat
  for (const o of g.sp) if (o !== sp) o.alive = false;
  const k = g.pick; for (let i = 0; i < k.max; i++) if (k.alive[i]) { k.x[i] = p.x; k.y[i] = p.y; k.z[i] = p.z; }      // every crystal and coin is pulled to the duelist
  g.chests.push({ x: sp.x, y: sp.y, z: sp.z, open: false, kind: 'sealed' });
  const spot = goodSpot(g, sp, last ? sp.x : sp.x + 8, last ? sp.z + 6 : sp.z);
  if (last) {
    g.won = true; g.bossKilled = true; g.altar = { x: spot.x, z: spot.z, used: false };
    g.event('banner', S.gate.name + ' falls. VICTORY. The Final Altar rises.');
  } else {
    g.circle = { x: spot.x, z: spot.z, t: g.openFlow ? 1e9 : RUNSPEC.circleSeconds };
    g.event('banner', g.openFlow ? S.gate.name + ' falls. The gateway is open. The horde rises.' : S.gate.name + ' falls. A Descent Circle opens: open the chest, then step in.');
  }
  g.emit('gatedown', g.stage);
}

// Surges: two named ones at about 40% and 70% of the stage clock (Stage 1: 2:48 and 4:54) and one when the gate wakes. The banner is up 4 s ahead, then 100 to 120 Husks at half HP close in from a ring round the duelist.
// Surges 1 and 2 wait while a timed boss (role bossA or bossB) is alive, for at most RUN.surge.waitSeconds, then fire anyway with their banner; the gate-wake surge never waits. (g.boss is the one shared state of the special
// fight that is running, a timed boss or the gate boss, so the rule looks at the alive timed bosses in g.sp, not at g.boss.)
const SURGE_NAMES = ['THE HORDE ANSWERS', 'THE HORDE ANSWERS AGAIN', 'THE GATE CALLS ITS DEAD'];
function surgeTick(g) {
  const S = g.stageSpec, G = g.gate; if (!S || !g.surgeAnn || g.mode === 'classic' || G.state === 'done') return;
  const at = [S.clock * 0.4, S.clock * 0.7, S.gateWake], wait = RUN.surge.waitSeconds;
  const timedBossAlive = g.sp.some(q => q.alive && !q.dead && (q.role === 'bossA' || q.role === 'bossB'));
  for (let i = 0; i < 3; i++) {
    if (g.surgeDone[i]) continue;
    if (!g.surgeAnn[i] && g.sc >= at[i] - 4) {
      if (i < 2 && timedBossAlive && g.sc < at[i] + wait) continue;               // hold the banner while a timed boss is on the field
      g.surgeAnn[i] = 1; g.surgeAt = g.surgeAt || [0, 0, 0]; g.surgeAt[i] = Math.max(at[i], g.sc + 4); g.event('banner', SURGE_NAMES[i]); g.emit('surge', i);
    }
    if (g.surgeAnn[i] && g.sc >= g.surgeAt[i]) {
      g.surgeDone[i] = 1;
      const SU = RUN.surge, n = SU.count[0] + Math.floor(g.rsp() * (SU.count[1] - SU.count[0] + 1)), p = g.p; let made = 0;
      for (let k = 0; k < n; k++) { if (enemyCount(g.en) >= Math.max(g.maxAlive, 140)) break; const a2 = k / n * 6.283185307, r = 26 + (k % 3) * 4; if (spawnEnemy(g, 'husk', { ring: 1, x: p.x + cos(a2) * r, z: p.z + sin(a2) * r })) { g.en.hp[g.lastSlot] *= RUN.surge.hpMul; made++; } }
      g.surgeSize = made;
    }
  }
}

function circleTick(g, dt) {
  const c = g.circle, p = g.p, dx = p.x - c.x, dz = p.z - c.z;       // the circle stays open: step in when you choose (greed time), while the Toll Shades rise on their own clock
  const left = Math.max(0, RUNSPEC.shades.afterGateSeconds - g.afterGate);
  if (g.openFlow) { g.stagePrompt = c.portal ? 'Walk into the portal when you are ready. Overtime pays more the longer you stay.' : 'Step through the gateway when you are ready, or stay and farm the rising horde.'; if (dx * dx + dz * dz < RUNSPEC.circleRadius * RUNSPEC.circleRadius) { g.desc = { t: 0 }; g.circle = null; g.emit('descent', g.stage + 1); g.event('banner', 'You step through.'); } return; }
  g.stagePrompt = g.shadeOn ? 'Step into the Descent Circle. The Toll Shades are out.' : 'Step into the Descent Circle when you are ready (the Toll Shades rise in ' + clockText(left) + ')';
  if (dx * dx + dz * dz < RUNSPEC.circleRadius * RUNSPEC.circleRadius) { g.desc = { t: 0 }; g.circle = null; g.emit('descent', g.stage + 1); g.event('banner', 'You descend.'); }
}

function altarTick(g) {
  const a = g.altar, p = g.p, dx = p.x - a.x, dz = p.z - a.z;
  if (a.used) return;
  if (dx * dx + dz * dz < RUNSPEC.circleRadius * RUNSPEC.circleRadius) {
    g.stagePrompt = '{use}: the Final Altar';
    if (g._cmd && g._cmd.use && !g.offer) {
      const cards = [{ kind: 'final', id: 'close', rarity: 'epic' }]; if (g.mode !== 'quick') cards.push({ kind: 'final', id: 'duelon', rarity: 'legendary' });
      g.offer = { type: 'final', cards, leave: false }; g.event('offer', null);
    }
  } else g.stagePrompt = 'Walk to the Final Altar (or open the chest first)';
}
export function finalChoice(g, i) {
  const c = g.offer && g.offer.cards[i]; if (!c) return false;
  g.offer = null; g.altar.used = true;
  if (c.id === 'close') { g.over = true; g.event('banner', 'The Vault is closed. Win banked.'); }
  else { g.duelOn = true; g.otT = 0; g.huntT = 0; g.otAcc = 0; g.flags.overtime = true; g.event('banner', 'DUEL ON. Hunters grow stronger every 30 seconds.'); }
  return true;
}

// ---- Toll Shades ----
function addShade(g, cap) {
  const SH = RUNSPEC.shades; if (g.shades.length >= cap) return;
  const a = g.rsp() * 6.283185307179586, d = SH.spawnMin + g.rsp() * (SH.spawnMax - SH.spawnMin), p = g.p, x = p.x + cos(a) * d, z = p.z + sin(a) * d;
  g.shades.push({ x, y: p.y, z, px: x, py: p.y, pz: z, face: 0, cd: 1.0, born: g.t });                  // a short grace so the rise can be seen
  g.emit('shade', x, z);
}
function startShades(g) {
  const SH = RUNSPEC.shades; g.shadeOn = true; g.shadeAge = 0; g.shadeNextAdd = SH.addEverySeconds;
  for (let k = 0; k < SH.start; k++) addShade(g, SH.max);
  g.event('banner', 'The Toll Shades rise. Nothing can hurt them. Run.'); g.emit('shades', g.stage + 1);
}
function shadesTick(g, dt) {
  const SH = RUNSPEC.shades, G = g.gate, S = g.stageSpec, p = g.p;
  if (!g.shadeOn && !g.duelOn && !g.openFlow) {
    if (G.state === 'closed' && g.sc >= S.clock) startShades(g);                                     // the clock hit 0:00
    else if (G.state === 'done' && !g.desc && (g.afterGate += dt) >= SH.afterGateSeconds) startShades(g);    // the gate boss fell and the Descent was not taken
  }
  if (g.duelOn) { g.shadeWaveT -= dt; if (g.shadeWaveT <= 0) { g.shadeWaveT = SH.overtimeEverySeconds; for (let k = 0; k < SH.overtimeCount; k++) addShade(g, SH.hardMax); g.event('banner', 'A wave of Toll Shades rises.'); } }
  if (!g.shades.length) return;
  g.shadeAge += dt;
  if (g.shadeOn && g.shadeAge >= g.shadeNextAdd) { g.shadeNextAdd += SH.addEverySeconds; addShade(g, SH.max); }
  let speed = CFG.player.speed * SH.speedFrac * pow(1 + SH.speedStepPct / 100, Math.floor(g.shadeAge / SH.stepSeconds));
  { const fl = Math.min(K.hunterBurst * CFG.player.speed * (1 + g.mods.move), Math.sqrt(p.vx * p.vx + p.vz * p.vz) * K.chaseLead); if (fl > speed) speed = fl; }       // a Shade bursts to the duelist's real speed (up to 1.7x run speed): slide-hopping does not outrun them
  for (const s of g.shades) {
    const dx = p.x - s.x, dz = p.z - s.z, d = Math.sqrt(dx * dx + dz * dz) || 0.001;
    if (d > 0.05) { const m = Math.min(d, speed * dt); s.x += dx / d * m; s.z += dz / d * m; }
    s.y += (p.y - s.y) * Math.min(1, dt * 4); s.face = atan2(dx, dz);                                 // straight at you, through terrain
    s.cd -= dt;
    if (d < SH.touchRadius && Math.abs(p.y - s.y) < 2.5 && s.cd <= 0 && !g.over) { s.cd = SH.touchCooldown; g.hurtPlayer(Math.max(1, p.maxHp * SH.touchPct), true, 'Toll Shade', 4); }       // TRUE damage, not SELF: it can kill
  }
}

// ---- the open stage flow: the gate wakes by choice, three sleepers, the horde ----
function startHorde(g, why) {
  g.horde = { on: true, t: -3, why };
  g.event('banner', why === 'clock' ? 'The clock runs out. The horde rises.' : 'The end-stage horde rises.'); g.emit('horde', why === 'clock' ? 1 : 2);
}
function openTick(g, dt) {
  const S = g.stageSpec, G = g.gate, p = g.p, cmd = g._cmd, gr = g.map.gate;
  if (!g.sleepersMade) {                                               // the elite and the two mini bosses stand asleep at their own spots (map.sleepers), with the same rewards as before
    g.sleepersMade = true;
    for (let i = 0; i < S.timeline.length; i++) { const ev = S.timeline[i], sl = (g.map.sleepers || []).find(q => q.role === ev.role); if (!sl) continue; const at = { x: sl.x, y: heightAt(sl.x, sl.z), z: sl.z }, n0 = g.sp.length; spawnSpecial(g, ev, at, true); for (let k = n0; k < g.sp.length; k++) { const q = g.sp[k]; q.asleep = true; q.hpBase = q.maxHp / (g.hpMul || 1); } g.evState[i] = 2; }
  }
  if (g.door) { doorTick(g, dt); if (g.door.state !== 'risen') { G.awake = false; G.hold = 0; if (G.state === 'closed' && !g.horde.on && g.sc >= S.clock) startHorde(g, 'clock'); return; } }       // the big desert: nothing to wake until the door has risen
  const gx = p.x - gr.x, gz = p.z - gr.z, gd2 = gx * gx + gz * gz, W = g.door ? 'door' : 'gate';
  if (!g.gateSeen && (gd2 < 90 * 90 || exploredAt(g.fog, gr.x, gr.z))) { g.gateSeen = true; if (G.state === 'closed' && gd2 > 64) g.event('banner', 'You see the ' + W + '. Wake it when you are ready.'); }
  G.awake = true;
  if (G.state === 'closed' && gd2 < gr.radius * gr.radius && doorReady(g)) {
    g.stagePrompt = 'Hold {use}: wake the ' + W + ' (the stage boss comes)';
    G.hold = cmd && (cmd.use || cmd.hold) ? G.hold + dt : Math.max(0, G.hold - 2 * dt);
    if (G.hold >= 1.5) startGate(g, false);
  } else G.hold = Math.max(0, G.hold - 2 * dt);
  if (G.state === 'closed' && !g.horde.on && g.sc >= S.clock) startHorde(g, 'clock');       // the clock ran out before the gate was woken: the horde starts anyway and keeps rising
}

// ---- the big desert's surges: a banner about 2 s before, 25 to 35 s of crowd, then 60 to 90 s of calm; the first minute is busier than the table so there is always something to hit ----
const SURGE = { first: 70, calmLo: 60, calmHi: 90, lenLo: 25, lenHi: 35, hi: 3.0, lo: 0.55, early: 1.6, earlyEnd: 150 };
function surgePlan(g) { const P = g.surgeP || (g.surgeP = { next: SURGE.first, on: false, end: 0, ann: false, n: 0 }); return P; }
function surgeMul(g) {
  const P = surgePlan(g), t = g.sc, h = k => { let x = (Math.imul((g.seed | 0) ^ Math.imul(g.stage + 3, 0x9E3779B1) ^ Math.imul(P.n + 1, 0x85EBCA6B), 0x27D4EB2F) >>> 0) / 4294967296; return k * x; };
  if (!P.on) { if (!P.ann && t >= P.next - 2) { P.ann = true; g.event('banner', 'THE SAND STIRS'); g.emit('surge', 0); } if (t >= P.next) { P.on = true; P.ann = false; P.end = t + SURGE.lenLo + h(SURGE.lenHi - SURGE.lenLo); } }
  else if (t >= P.end) { P.on = false; P.n++; P.next = t + SURGE.calmLo + h(SURGE.calmHi - SURGE.calmLo); }
  const early = t < SURGE.earlyEnd ? 1 + (SURGE.early - 1) * (1 - t / SURGE.earlyEnd) : 1;
  return (P.on ? SURGE.hi : SURGE.lo) * early;
}

// ---- the swarm ----
function spawner(g, dt, fight, toll) {
  const S = g.stageSpec;
  const hordeOn = g.openFlow && g.horde.on && g.horde.t > 0, hm = hordeOn ? 2.2 + 0.5 * g.horde.t / 60 : 1;
  const D = g.diff, te = Math.min(479, S.waves.offset + g.sc * S.waves.scale * D.ramp + (hordeOn ? 90 : 0)), p = g.p, cap = g.maxAlive;
  if (fight && !toll) {                                          // the horde keeps coming during the gate fight, thinned to 40 percent of the spawn rate at the moment the gate woke (the stage clock is frozen, so this is steady)
    g.spawnAcc += 0.4 * spawnRate(te) * D.spawn * dt; let live0 = enemyCount(g.en); if (g.spawnAcc > 60) g.spawnAcc = 60;
    while (g.spawnAcc >= 1) { g.spawnAcc -= 1; if (live0 < cap && spawnEnemy(g, pickKind(g, te))) live0++; }
    return;
  }
  if (te >= RUN.ring.from || toll) {                            // the Last Audience: a ring of Husks closes in
    g.ringT -= dt;
    if (g.ringT <= 0) {
      g.ringT = RUN.ring.every; g.event('banner', 'The Last Audience closes in.');
      for (let k = 0; k < RUN.ring.count; k++) { if (enemyCount(g.en) >= cap) break; const a = k / RUN.ring.count * Math.PI * 2; spawnEnemy(g, 'husk', { ring: 1, x: p.x + cos(a) * RUN.ring.radius, z: p.z + sin(a) * RUN.ring.radius }); }
    }
  }
  if (!toll && g.sc >= ACES.from) {                              // an Ace monster now and then, from 1:24 of the stage
    g.aceT -= dt;
    if (g.aceT <= 0) { g.aceT = ACES.every; if (aliveAces(g) < ACES.max && enemyCount(g.en) < cap) spawnAce(g, pickKind(g, te)); }
  }
  if (te >= RUN.golem.from) {
    g.golemT -= dt;
    if (g.golemT <= 0) { g.golemT = RUN.golem.every; if (enemyCount(g.en) < cap) spawnEnemy(g, 'golem'); }
  }
  if (toll) { g.huntT -= dt; if (g.huntT <= 0) { g.huntT = RUNSPEC.tollHunterEvery; for (let k = 0; k < RUNSPEC.tollHunterCount; k++) if (enemyCount(g.en) < cap) spawnEnemy(g, 'hunter'); } }
  const KB = g.map && g.map.world && g.map.world.killBowl, inBowl = !!KB && (p.x - KB.x) * (p.x - KB.x) + (p.z - KB.z) * (p.z - KB.z) < KB.r * KB.r; g.inBowl = inBowl;       // the kill bowl: the horde comes three times as thick while you ride it
  g.spawnAcc += (toll ? spawnRate(420) : spawnRate(te)) * D.spawn * dt * hm * (inBowl ? 3 : 1) * (g.big ? surgeMul(g) * stakesDensity(g) : 1);
  let live = enemyCount(g.en);
  if (g.spawnAcc > 60) g.spawnAcc = 60;                                // never a runaway backlog
  while (g.spawnAcc >= 1) { g.spawnAcc -= 1; const kind = pickKind(g, te); if (live < cap) { if (spawnEnemy(g, kind)) live++; } else mergeEnemy(g, kind); }       // past the cap a spawn merges into the nearest of its kind
}

// ---- Overtime after Duel On: endless hunters, a captain every 60 s that drops a Sealed Chest ----
function overtime(g, dt) {
  const O = RUNSPEC.overtime, R = RUN.overtime;
  g.otT += dt; const k = Math.floor(g.otT / O.stepSeconds); g.otStep = k;
  const m = (g.scTotal + g.sc) / 60 * (g.paceK || 1), D = g.diff, C = D.hpCurve; g.hpMul = g.stageSpec.mult * (1 + C.a * m + C.b * m * m) * g.heat * D.hp;
  g.dmgMul = D.dmg * (1 + D.dmgPerMinute * Math.max(0, m - 3)) * pow(R.dmgGrowth, k + 1);
  g.otAcc += (O.baseRate + O.rateStep * k) * dt;
  while (g.otAcc >= 1) { g.otAcc -= 1; if (enemyCount(g.en) < g.maxAlive) spawnEnemy(g, 'hunter'); else mergeEnemy(g, 'hunter'); }
  g.huntT -= dt;
  if (g.huntT <= 0) {
    g.huntT = 60;
    if (spotNear(g, spot)) spawnSpecial(g, { role: 'captain', id: 'captain', name: 'Hunter Captain', engine: 'warden', hpScale: 0.8 + 0.3 * k, drop: 'sealed' }, spot);
  }
}

// ---- Descent: six seconds, then the next stage is built and the whole build carries over ----
export function descentTick(g, dt) {
  g.desc.t += dt;
  if (g.desc.t >= RUNSPEC.descentSeconds) swapStage(g);
}
function swapStage(g) {
  const p = g.p, carried = g.chests.filter(c => !c.open).length, prevOpened = g.world.opened;
  g.scTotal += g.sc; g.stage++; g.desc = null;
  g.sp = []; g.chests = []; g.en.alive.fill(0); g.shots.alive.fill(0); g.pick.alive.fill(0);
  g.tele.forEach(o => { o.on = false; }); g.fx.forEach(o => { o.on = false; }); g.eb.forEach(o => { o.on = false; }); g.btraps.forEach(o => { o.on = false; });
  g.storm = null; g.offer = null; g.flow.valid = false;
  initStage(g); loadStageMap(g, g.stage); g.world = buildWorld(g); if (g.map.big) streamWorld(g, 0); g.world.opened = Math.round(prevOpened * RUNSPEC.chestPriceCarry);
  p.sliding = false; p.dashT = 0;
  p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - p.hp) * RUNSPEC.descentHeal);
  g.field.redraws++;                                            // one free Redraw at the start of each stage
  const sp0 = g.map.spawn;
  for (let i = 0; i < carried; i++) { const x = sp0.x + 2 + i * 1.6, z = sp0.z + 2; g.chests.push({ x, y: heightAt(x, z), z, open: false, kind: 'sealed' }); }   // carried Sealed Chests
  g.event('banner', 'Stage ' + (g.stage + 1) + ': ' + g.stageSpec.name + '. Seal Code ' + g.sealCode);
  g.emit('stage', g.stage + 1);
}






// ---- the run flow v2 (owner, 27 Nov; design/run-structure-v2.md), on with g.flow2 (the big desert; opts.flow 'v2'):
// the stage clock (12 minutes) brings the hordes and, at set marks, the elites and mini bosses, who come to you; when the clock ends the stage boss hunts you with its own adds;
// it falls and a portal opens at a seeded spot 120 to 200 m away (a red wind guides you within 60 m); Overtime starts at once: enemy health +22% every 30 s, XP and score
// rising with it, the Toll Shades after two minutes; walk into the portal to go down. Stage 3 has no portal: endless Overtime until death, scored.
// The door, the gate wake and the Toll Bell are left in place for flow v1.
const OT2 = { hpStep: 1.22, stepSeconds: 30, xpPerStep: 0.1, shadesAfter: 120, crowd: 1.5, portalMin: 120, portalMax: 200, huntDist: 38 };
export const FLOW2 = OT2;
function flow2Tick(g, dt) {
  const S = g.stageSpec, G = g.gate;
  if (G.state === 'closed' && g.sc < S.clock) timelineNear(g);       // the clock end belongs to the stage boss alone
  if (G.state === 'closed' && g.sc >= S.clock) startHunt(g);
}
// the clock marks: announced 5 s ahead, then the elite or mini boss arrives 30 to 40 m from the duelist and comes for them
function timelineNear(g) {
  const S = g.stageSpec, p = g.p;
  for (let i = 0; i < S.timeline.length; i++) {
    const ev = S.timeline[i], st = g.evState[i];
    if (st < 2 && ev.t > S.clock - 30) { g.evState[i] = 2; continue; }       // no timed mark in the last 30 s of the clock: the stage boss owns them
    if (st === 0 && g.sc >= ev.t - RUNSPEC.announceSeconds) { const at = g.evSpot[i]; if (!openSpot(g, p.x, p.z, 30, 40, i * 2.1 + g.stage, at)) { at.x = p.x + 30; at.z = p.z; at.y = heightAt(at.x, at.z); } g.evState[i] = 1; g.emit('announce', i, at.x, at.z, ev.role); g.event('banner', ev.name + ' comes in ' + RUNSPEC.announceSeconds + ' seconds.'); }
    else if (st === 1 && g.sc >= ev.t) { const at = g.evSpot[i]; openSpot(g, p.x, p.z, 30, 40, i * 2.1 + g.stage + 1, at); spawnSpecial(g, ev, at); g.evState[i] = 2; }
  }
}
// a walkable spot between rMin and rMax from (x, z), tried round from a seeded heading: below the mountain line, not on a block top
function openSpot(g, x, z, rMin, rMax, salt, out) {
  const h0 = ((Math.imul((g.seed | 0) ^ Math.imul(g.stage + 7, 0x9E3779B1) ^ Math.imul((salt * 1000) | 0, 0x85EBCA6B), 0x27D4EB2F) >>> 0) / 4294967296);
  for (let k = 0; k < 24; k++) { const a = (h0 + k / 24) * 6.283185307, r = rMin + (rMax - rMin) * (((h0 * 7 + k * 0.37) % 1)), px = x + cos(a) * r, pz = z + sin(a) * r, h = heightAt(px, pz);
    if (h < 50 && Math.abs(heightAt(px + 1.5, pz) - h) < 1 && Math.abs(heightAt(px, pz + 1.5) - h) < 1) { out.x = px; out.z = pz; out.y = h; return true; } }
  return false;
}
// the clock ran out: the stage boss comes after the duelist from just off screen, with its own adds
function startHunt(g) {
  const S = g.stageSpec, G = g.gate, p = g.p, cy = g.camYaw || 0;
  G.state = 'fight'; G.early = false; G.toll = false;
  for (const o of g.sp) if (o.alive && o.role !== 'gate') o.alive = false;
  startBoss(g, false, Object.assign({}, S.gate));
  const sp = g.sp[g.sp.length - 1], at = { x: 0, y: 0, z: 0 }, side = g.rsp() < 0.5 ? 1 : -1, a = cy + side * 1.2;       // behind and to one side of the camera's view: it walks in from the edge of the screen
  if (!openSpot(g, p.x + sin(a) * OT2.huntDist, p.z + cos(a) * OT2.huntDist, 0, 8, 9, at)) { at.x = p.x + sin(a) * OT2.huntDist; at.z = p.z + cos(a) * OT2.huntDist; at.y = heightAt(at.x, at.z); }
  sp.x = at.x; sp.z = at.z; sp.y = at.y; if (sp.px !== undefined) { sp.px = sp.x; sp.pz = sp.z; sp.py = sp.y; }
  g.gateOpenedAt = g.sc; g.event('bosscard', S.gate.name); g.event('banner', 'Time is up. ' + S.gate.name + ' hunts you.'); g.emit('gatefight', g.stage);
}
// the boss fell: a portal opens (not on the last stage) and Overtime starts at once
function bossFell2(g, sp, last) {
  const S = g.stageSpec;
  g.ot2 = { t: 0, shades: false, endless: last };
  if (last) { g.won = true; g.bossKilled = true; g.event('banner', S.gate.name + ' falls. Endless Overtime: stay alive, the score keeps climbing.'); return; }
  const at = { x: 0, y: 0, z: 0 }; if (!openSpot(g, sp.x, sp.z, OT2.portalMin, OT2.portalMax, 17, at)) { at.x = sp.x + OT2.portalMin; at.z = sp.z; }
  g.circle = { x: at.x, z: at.z, t: 1e9, portal: true };
  g.event('banner', S.gate.name + ' falls. A portal opens ' + Math.round(Math.sqrt((at.x - g.p.x) * (at.x - g.p.x) + (at.z - g.p.z) * (at.z - g.p.z))) + ' m away. Overtime: the longer you stay, the more it pays.');
}
function ot2Tick(g, dt) {
  const O = g.ot2; O.t += dt; const k = Math.floor(O.t / OT2.stepSeconds);
  g.hpMul *= pow(OT2.hpStep, k); g.maxAlive = Math.min(CFG.enemy.max, Math.floor(g.maxAlive * OT2.crowd));
  if (!O.shades && O.t >= OT2.shadesAfter) { O.shades = true; startShades(g); }
}
export const ot2XpMul = g => g.ot2 ? 1 + OT2.xpPerStep * Math.floor(g.ot2.t / OT2.stepSeconds) : 1;
