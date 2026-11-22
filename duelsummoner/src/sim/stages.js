// The stage machine: a run is Stage 1, 2 and 3 (or one Quick Duel stage). Each stage has a clock, an elite and two timed bosses on a
// timeline, a gate that wakes, a gate boss, then a Descent Circle to the next stage (Stage 3: the Final Altar). Pure and deterministic.
// Everything tunable lives in data/stages.js. See design/run-structure.md (draft v1).
import { RUN } from '../data/waves.js';
import { RUNSPEC, stagesFor, DIFFICULTY } from '../data/stages.js';
import { pow, sin, cos } from './dmath.js';
import { spawnEnemy, spawnRate, spotNear, enemyCount } from './enemies.js';
import { spawnSpecial, startBoss } from './specials.js';
import { heightAt } from './terrain.js';
import { buildWorld } from './world.js';
import { fusionsReady } from './field.js';
import { mixFor, pickKind } from './spawner.js';

const spot = { x: 0, y: 0, z: 0 };
const clockText = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

// XP gained is scaled by the run minute so the first minutes give about 4 level-ups a minute (data: RUNSPEC.xp)
export function xpScale(g) {
  const X = RUNSPEC.xp, m = g.mode === 'classic' ? g.t / 60 : (g.scTotal + g.sc) / 60;
  return (X.start + (X.end - X.start) * (m >= X.minutes ? 1 : m / X.minutes)) * (1 + X.growth * (m > X.growFrom ? m - X.growFrom : 0));
}

// ---- setup ----
export function initRun(g) {
  g.mode = g.opts.mode || 'classic'; g.difficulty = DIFFICULTY[g.opts.difficulty] ? g.opts.difficulty : 'medium'; g.diff = DIFFICULTY[g.difficulty]; g.maxAlive = RUN.maxAlive;
  if (g.mode === 'classic') { g.stages = null; g.stageSpec = null; return; }
  g.stages = stagesFor(g.mode); g.stage = 0; g.scTotal = 0; g.stagesCleared = 0; g.stageFacts = [];
  g.swiftChips = 0; g.duelOn = false; g.otT = 0; g.desc = null; g.chestsOpenedTotal = 0; g.heat = 1;
  initStage(g);
}
// For tools, tests and golden scenes: restart the stage machine at stage i (the build and the clock total carry as they are).
export function jumpToStage(g, i) { g.stage = i; initStage(g); }
function initStage(g) {
  const S = g.stageSpec = g.stages[g.stage];
  g.sc = 0; g.evState = S.timeline.map(() => 0); g.evSpot = S.timeline.map(() => ({ x: 0, y: 0, z: 0 }));
  g.gate = { state: 'closed', awake: false, hold: 0, early: false, toll: false };
  g.bDown = false; g.gateDown = null; g.circle = null; g.altar = null; g.stagePrompt = '';
  g.boss = { state: 'idle', early: false, phase: 1 };
  g.spawnAcc = 0; g.ringT = 0; g.golemT = 0; g.huntT = 0; g.killsAtStage = g.kills;
  g.flags.warden = g.flags.idols = true;                       // the classic timed elites are replaced by the timeline
}

// ---- per tick ----
export function updateStages(g, dt) {
  if (g.duelOn) { overtime(g, dt); return; }
  const S = g.stageSpec, G = g.gate, p = g.p, cmd = g._cmd;
  const fight = G.state === 'fight';
  if (G.state === 'closed') g.sc += dt;                         // the clock freezes during the gate fight and after it
  const m = (g.scTotal + g.sc) / 60, D = g.diff, C = D.hpCurve;
  g.hpMul = S.mult * (1 + C.a * m + C.b * m * m) * g.heat * D.hp;
  g.dmgMul = D.dmg * (1 + D.dmgPerMinute * Math.max(0, m - 3));
  g.maxAlive = Math.floor(D.cap.start + (D.cap.end - D.cap.start) * (m >= D.cap.minutes ? 1 : m / D.cap.minutes));
  g.stagePrompt = '';

  if (g.gateDown) { const sp = g.gateDown; g.gateDown = null; gateCleared(g, sp); return; }
  if (g.circle) { circleTick(g, dt); return; }
  if (g.altar) { altarTick(g); return; }

  // timeline: announce 5 s ahead on a chosen boss ring, then spawn there
  if (G.state === 'closed') for (let i = 0; i < S.timeline.length; i++) {
    const ev = S.timeline[i], st = g.evState[i];
    if (st === 0 && g.sc >= ev.t - RUNSPEC.announceSeconds) {
      const at = g.evSpot[i];
      if (spotNear(g, spot)) { at.x = spot.x; at.y = spot.y; at.z = spot.z; } else { at.x = g.p.x + 25; at.z = g.p.z; at.y = heightAt(at.x, at.z); }
      g.evState[i] = 1; g.emit('announce', i, at.x, at.z, ev.role); g.event('banner', ev.name + ' in ' + RUNSPEC.announceSeconds + ' seconds.');
    } else if (st === 1 && g.sc >= ev.t) {
      // boss rule: a timed boss waits for the previous timed boss to die, so there are never two timed boss bars at once
      if (ev.role !== 'elite' && g.sp.some(s => s.alive && (s.role === 'bossA' || s.role === 'bossB'))) { if (!g.evWaitSaid) { g.evWaitSaid = true; g.event('banner', ev.name + ' waits for the boss before it.'); } continue; }
      g.evWaitSaid = false; spawnSpecial(g, ev, g.evSpot[i]); g.evState[i] = 2;
    }
  }
  // the gate wakes when timed boss B falls, or at its wake time
  if (G.state === 'closed' && !G.awake && (g.bDown || g.sc >= S.gateWake)) { G.awake = true; g.emit('gatewake'); g.event('banner', 'The gate of ' + S.gate.name + ' wakes. Hold E at the gate to enter.'); }
  const gr = RUNSPEC.gate, gx = p.x - gr.x, gz = p.z - gr.z;
  if (G.state === 'closed' && G.awake && gx * gx + gz * gz < gr.radius * gr.radius) {
    g.stagePrompt = 'Hold E: enter the gate (forfeits ' + clockText(S.clock - g.sc) + ' of the clock)';
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
  if (!gd) { const c = add(15, 25); if (c) { g.fusionGuard = { t: 0, second: false }; g.event('banner', 'A Fusion is ready. A Sealed Chest has appeared nearby: open it.'); } return; }
  if (g.chests.some(c => c.guaranteed && !c.open)) {
    gd.t += dt;
    if (gd.t >= 45 && !gd.second) { gd.second = true; if (add(8, 14)) g.event('banner', 'Another Sealed Chest has appeared closer.'); }
  }
}

function startGate(g, early, toll) {
  const S = g.stageSpec, G = g.gate, left = S.clock - g.sc;
  if (!toll && left > 1) { g.swiftChips += Math.floor(left / 2); g.coins += Math.floor(left / 4); early = true; }       // Swift Seal: 1 Star Chip per 2 s left, plus coins
  G.state = 'fight'; G.early = early && !toll; G.toll = !!toll;
  for (const o of g.sp) if (o.alive && o.role !== 'gate') o.alive = false;      // timed bosses still alive are dismissed: one boss bar at a time
  const gate = Object.assign({}, S.gate); if (toll) gate.enrage = RUNSPEC.tollEnrage;
  startBoss(g, G.early, gate);
  g.gateOpenedAt = g.sc;
  if (toll) { g.p.x = RUNSPEC.gate.tollPull.x; g.p.z = RUNSPEC.gate.tollPull.z; g.p.y = heightAt(g.p.x, g.p.z); g.p.vx = g.p.vz = 0; g.p.grounded = true; g.event('banner', 'The Toll Bell rings. The sigil pulls you in.'); g.emit('tollbell'); }
  g.emit('gatefight', g.stage);
}

function gateCleared(g, sp) {
  const S = g.stageSpec, G = g.gate, p = g.p, last = g.stage >= g.stages.length - 1;
  G.state = 'done'; g.stagesCleared++;
  g.stageFacts.push({ stage: g.stage + 1, id: S.id, seconds: Math.round(g.sc), kills: g.kills - g.killsAtStage, gateOpenedAt: Math.round(g.gateOpenedAt), early: G.early, toll: G.toll, level: g.level });
  g.en.alive.fill(0);                                           // every enemy crumbles
  for (const o of g.sp) if (o !== sp) o.alive = false;
  const k = g.pick; for (let i = 0; i < k.max; i++) if (k.alive[i]) { k.x[i] = p.x; k.y[i] = p.y; k.z[i] = p.z; }      // every crystal and coin is pulled to the duelist
  g.chests.push({ x: sp.x, y: sp.y, z: sp.z, open: false, kind: 'sealed' });
  if (last) {
    g.won = true; g.bossKilled = true; g.altar = { x: sp.x, z: sp.z + 6, used: false };
    g.event('banner', S.gate.name + ' falls. VICTORY. The Final Altar rises.');
  } else {
    g.circle = { x: sp.x + 8, z: sp.z, t: RUNSPEC.circleSeconds };
    g.event('banner', S.gate.name + ' falls. A Descent Circle opens: open the chest, then step in.');
  }
  g.emit('gatedown', g.stage);
}

function circleTick(g, dt) {
  const c = g.circle, p = g.p, dx = p.x - c.x, dz = p.z - c.z; c.t -= dt;
  g.stagePrompt = 'Step into the Descent Circle (' + clockText(c.t) + ')';
  if (dx * dx + dz * dz < RUNSPEC.circleRadius * RUNSPEC.circleRadius || c.t <= 0) { g.desc = { t: 0 }; g.circle = null; g.emit('descent', g.stage + 1); g.event('banner', 'You descend.'); }
}

function altarTick(g) {
  const a = g.altar, p = g.p, dx = p.x - a.x, dz = p.z - a.z;
  if (a.used) return;
  if (dx * dx + dz * dz < RUNSPEC.circleRadius * RUNSPEC.circleRadius) {
    g.stagePrompt = 'E: the Final Altar';
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

// ---- the swarm ----
function spawner(g, dt, fight, toll) {
  const S = g.stageSpec; if (fight && !toll) return;
  const D = g.diff, te = Math.min(479, S.waves.offset + g.sc * S.waves.scale * D.ramp), p = g.p, cap = g.maxAlive;
  if (te >= RUN.ring.from || toll) {                            // the Last Audience: a ring of Husks closes in
    g.ringT -= dt;
    if (g.ringT <= 0) {
      g.ringT = RUN.ring.every; g.event('banner', 'The Last Audience closes in.');
      for (let k = 0; k < RUN.ring.count; k++) { if (enemyCount(g.en) >= cap) break; const a = k / RUN.ring.count * Math.PI * 2; spawnEnemy(g, 'husk', { x: p.x + cos(a) * RUN.ring.radius, z: p.z + sin(a) * RUN.ring.radius }); }
    }
  }
  if (te >= RUN.golem.from) {
    g.golemT -= dt;
    if (g.golemT <= 0) { g.golemT = RUN.golem.every; if (enemyCount(g.en) < cap) spawnEnemy(g, 'golem'); }
  }
  if (toll) { g.huntT -= dt; if (g.huntT <= 0) { g.huntT = RUNSPEC.tollHunterEvery; for (let k = 0; k < RUNSPEC.tollHunterCount; k++) if (enemyCount(g.en) < cap) spawnEnemy(g, 'hunter'); } }
  g.spawnAcc += (toll ? spawnRate(420) : spawnRate(te)) * D.spawn * dt;
  let live = enemyCount(g.en);
  while (g.spawnAcc >= 1) { g.spawnAcc -= 1; if (live < cap && spawnEnemy(g, pickKind(g, te))) live++; }
}

// ---- Overtime after Duel On: endless hunters, a captain every 60 s that drops a Sealed Chest ----
function overtime(g, dt) {
  const O = RUNSPEC.overtime, R = RUN.overtime;
  g.otT += dt; const k = Math.floor(g.otT / O.stepSeconds); g.otStep = k;
  const m = (g.scTotal + g.sc) / 60, D = g.diff, C = D.hpCurve; g.hpMul = g.stageSpec.mult * (1 + C.a * m + C.b * m * m) * g.heat * D.hp;
  g.dmgMul = D.dmg * (1 + D.dmgPerMinute * Math.max(0, m - 3)) * pow(R.dmgGrowth, k + 1);
  g.otAcc += (O.baseRate + O.rateStep * k) * dt;
  while (g.otAcc >= 1) { g.otAcc -= 1; if (enemyCount(g.en) < g.maxAlive) spawnEnemy(g, 'hunter'); }
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
  g.world = buildWorld(g); g.world.opened = Math.round(prevOpened * RUNSPEC.chestPriceCarry);
  p.x = 0; p.z = 0; p.y = heightAt(0, 0); p.vx = p.vz = p.vy = 0; p.grounded = true; p.sliding = false; p.dashT = 0;
  p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - p.hp) * RUNSPEC.descentHeal);
  g.field.redraws++;                                            // one free Redraw at the start of each stage
  initStage(g);
  for (let i = 0; i < carried; i++) g.chests.push({ x: 2 + i * 1.6, y: heightAt(2 + i * 1.6, 2), z: 2, open: false, kind: 'sealed' });   // carried Sealed Chests
  g.event('banner', 'Stage ' + (g.stage + 1) + ': ' + g.stageSpec.name);
  g.emit('stage', g.stage + 1);
}




