// Elites and the boss: the Sealed Warden (4:00), the Twin Jackal Idols (6:00) and The Hollow Pharaoh (8:00 or the Royal Gate).
import { CFG } from '../data/config.js';
import { atan2, cos, sin } from './dmath.js';
import { SPECIALS } from '../data/enemies.js';
import { RUN } from '../data/waves.js';
import { RUNSPEC } from '../data/stages.js';
import { K } from '../data/tuning.js';
import { SCALE, specialSize } from '../data/scale.js';
import { mightBracket, targetBracket, sourceBracket, affinityBracket, overtimeBracket, sourceClass } from './ledger.js';
import { ELEMENTS } from '../data/elements.js';
import { FIELD_RULES, MARKS } from '../data/cards.js';
import { heightAt, moveXZ } from './terrain.js';
import { steerVec, walk, settle } from './steer.js';
import { addTele, addFx, explode, dropPickup, PICK_XP } from './combat.js';
import { isDashing } from './player.js';
import { spawnEnemy, spotNear } from './enemies.js';

const sv = { x: 0, z: 0, d: 0, direct: true }, spot = { x: 0, y: 0, z: 0 };
const DEG = Math.PI / 180;

export function make(kind, name, S, x, y, z) {
  return { size: SCALE.engineRef[kind === 'idol' ? 'idol' : kind], k: 1, kr: 1, kind, name, alive: true, dead: false, x, y, z, px: x, py: y, pz: z, pface: 0, vy: 0, dx: 0, dz: 0, face: 0, hp: S.hp, maxHp: S.hp, radius: S.radius, st: 0, stT: 0, cd: 0, atk: 0.5, flash: 0, twin: null, reviveT: 0, aux: 0, mark: 0, burn: 0, burnDps: 0 };
}
export function spawnWarden(g) {
  if (!spotNear(g, spot)) { spot.x = g.p.x + 25; spot.z = g.p.z; spot.y = heightAt(spot.x, spot.z); }
  const sp = make('warden', 'Sealed Warden', SPECIALS.warden, spot.x, spot.y, spot.z); sp.hp = sp.maxHp = SPECIALS.warden.hp * g.hpMul;
  g.sp.push(sp); g.event('banner', 'The Sealed Warden approaches. Hit it from behind.');
}
export function spawnIdols(g) {
  const S = SPECIALS.idol, a = make('idol', 'Twin Jackal Idol', S, 0, 0, 0), b = make('idol', 'Twin Jackal Idol', S, 0, 0, 0);
  if (!spotNear(g, spot)) { spot.x = g.p.x + 25; spot.z = g.p.z; spot.y = heightAt(spot.x, spot.z); }
  for (const [s, off] of [[a, -1.2], [b, 1.2]]) { s.x = s.px = spot.x + off; s.z = s.pz = spot.z; s.y = s.py = heightAt(s.x, s.z); s.hp = s.maxHp = S.hp * g.hpMul; }
  a.twin = b; b.twin = a; g.sp.push(a, b); g.event('banner', 'The Twin Jackal Idols hunt you. Fell both within 10 seconds.');
}
// A timed stage event (elite or timed boss) at a spot chosen when it was announced. engine decides which existing fight plays it.
export function spawnSpecial(g, ev, at) {
  const hpm = g.hpMul * (ev.hpScale || 1) * (g.diff ? g.diff.boss : 1), Z = specialSize(ev.id, ev.engine);
  const tag = s => { s.role = ev.role; s.id = ev.id; s.drop = ev.drop; s.size = Z.h; s.radius = Z.radius; s.k = Z.k; s.kr = Z.kr; };      // big in the model and in the sim
  if (ev.engine === 'idols') {
    const S = SPECIALS.idol, a = make('idol', ev.name, S, 0, 0, 0), b = make('idol', ev.name, S, 0, 0, 0);
    for (const [s, off] of [[a, -1.2], [b, 1.2]]) { s.x = s.px = at.x + off; s.z = s.pz = at.z; s.y = s.py = heightAt(s.x, s.z); s.hp = s.maxHp = S.hp * hpm; tag(s); }
    a.twin = b; b.twin = a; g.sp.push(a, b); g.event('banner', ev.name + ' hunt you. Fell both within 10 seconds.');
  } else {
    const S = SPECIALS.warden, sp = make('warden', ev.name, S, at.x, at.y, at.z); sp.hp = sp.maxHp = S.hp * hpm; tag(sp);
    g.sp.push(sp); g.event('banner', ev.name + ' approaches.' + (ev.role === 'elite' ? '' : ' Hit it from behind.'));
  }
}
export function startBoss(g, early, gate) {
  if (g.boss.state !== 'idle') return false;                       // one shared state: only one gate boss at a time
  const S = SPECIALS.pharaoh, B = gate ? g.map.arena.boss : RUN.bossSpawn;
  const sp = make('pharaoh', gate ? gate.name : S.name, S, B.x, heightAt(B.x, B.z), B.z); sp.hp = sp.maxHp = gate ? gate.hp * g.stageSpec.mult * g.diff.boss : S.hp * g.hpMul; sp.cd = 3; sp.aux = 6;
  if (gate) { const Z = specialSize(gate.id, 'pharaoh'); sp.role = 'gate'; sp.id = gate.id; sp.enrage = gate.enrage || 1; sp.size = Z.h; sp.radius = Z.radius; sp.k = Z.k; sp.kr = Z.kr; }
  g.sp.push(sp); g.gateOpenedAt = early ? (gate ? g.sc : g.t) : -1; g.boss = { state: 'active', early: !!early, t0: g.t, phase: 1, sandT: 0, summonT: S.summon.every, trapT: 2 };
  g.event('banner', gate ? gate.name + (gate.enrage > 1 ? ' is enraged by the Toll Bell.' : ' wakes.') : early ? 'You enter the Royal Gate early. The Hollow Pharaoh wakes.' : 'The Hollow Pharaoh wakes.');
  return true;
}

export function damageSpecial(g, sp, dmg, fromX, fromZ, o) {
  if (!sp.alive || sp.dead) return false;
  o = o || {};
  if (sp.kind === 'warden' && !o.area) {                           // the shield blocks everything from the front
    const f = SPECIALS.warden.shieldHalfArc * DEG, tx = fromX - sp.x, tz = fromZ - sp.z, tl = Math.sqrt(tx * tx + tz * tz) || 1;
    if ((tx / tl) * sin(sp.face) + (tz / tl) * cos(sp.face) > cos(f)) { g.event('block', { x: sp.x, y: sp.y + 1.5, z: sp.z }); sp.flash = 0.05; return false; }
  }
  // brackets 1, 2, 3, 4 and 8, the same as for the swarm: Might, the Drill of the source, the hit's element, Hunter, Overtime
  const el = o.elem || (o.flame ? ELEMENTS.fire.bit : 0); let cls = g.srcClassOf[g.curSrc]; if (cls === undefined) cls = g.srcClassOf[g.curSrc] = sourceClass(g.srcNames[g.curSrc]);
  let b3 = 1; if (el) { let sum = 0, cnt = 0; for (let k = 0; k < 8; k++) if (el & (1 << k)) { sum += g.mods.aff[k]; cnt++; } b3 = affinityBracket(sum / cnt); }
  const b4m = sp.mark > 0 ? targetBracket(MARKS.bonus + g.mods.markBonus) : 1;       // bracket 4 reads the mark on a boss or an elite too
  let d = dmg * b4m * mightBracket(g.mods.dmgMult) * targetBracket(g.mods.bossDmg) * (cls >= 0 ? sourceBracket(g.mods.drill[cls]) : 1) * b3 * (g.otStep > 0 ? overtimeBracket(g.otStep) : 1);
  let crit = 0;
  if (!o.noCrit && g.rc() < FIELD_RULES.critChance + g.mods.crit) { d *= K.critBase; crit = 1; }
  g.logDealt(d); g.emit('hit', d, sp.x, sp.z, crit | ((o.elem || 0) << 1));
  if (el & ELEMENTS.fire.bit) { sp.burn = ELEMENTS.fire.burn.dur + g.mods.burnDur; sp.burnDps = ELEMENTS.fire.burn.dps + g.mods.burnDps; }
  sp.hp -= d; sp.flash = 0.12;
  if (sp.hp > 0) return false;
  onDeath(g, sp);
  return true;
}

const credit = (g, sp) => { g.roleKills[sp.role || 'other']++; };
function dropChest(g, x, y, z, sp) {
  dropPickup(g, PICK_XP, x + 1.2, y, z, 30);
  if (sp && sp.drop === 'card') { g.world.cchests.push({ x, y, z, open: false, rarity: 'rare', free: true }); g.event('banner', 'A Card Chest appears, free.'); }
  else { g.chests.push({ x, y, z, open: false, kind: 'sealed' }); g.event('banner', 'A sealed chest appears.'); }
}

function onDeath(g, sp) {
  if (sp.kind === 'warden') { sp.alive = false; credit(g, sp); if (!sp.role || sp.id === 'warden') g.wardenKilled = true; g.elitesKilled++; dropChest(g, sp.x, sp.y, sp.z, sp); g.event('banner', sp.role ? sp.name + ' falls.' : 'The Sealed Warden falls.'); if (sp.role === 'bossB') g.bDown = true; }
  else if (sp.kind === 'idol') {
    const tw = sp.twin;
    if (tw.dead) {                                                 // the other is already waiting: both down in time
      sp.alive = false; tw.alive = false; tw.dead = false; g.elitesKilled++; credit(g, sp); dropChest(g, sp.x, sp.y, sp.z, sp);
      g.event('banner', 'Both idols are broken.'); if (sp.role === 'bossB') g.bDown = true;
    } else if (!tw.alive) { sp.alive = false; }
    else { sp.dead = true; sp.hp = 0; sp.reviveT = SPECIALS.idol.reviveSeconds; g.event('banner', 'Fell the other twin within 10 seconds.'); }
  } else if (sp.kind === 'pharaoh' && sp.role === 'gate') {
    sp.alive = false; g.boss.state = 'dead'; g.elitesKilled++; g.gateDown = sp; credit(g, sp); g.event('banner', sp.name + ' falls.');
  } else if (sp.kind === 'pharaoh') {
    sp.alive = false; g.boss.state = 'dead'; g.elitesKilled++; credit(g, sp); g.bossKilled = true; g.won = true;
    g.event('banner', 'The Hollow Pharaoh falls. VICTORY. Overtime goes on: pause to end the run.');
    g.en.alive.fill(0);
  }
}

const o = { x: 0, y: 0, z: 0, vy: 0, dx: 0, dz: 0 };
function load(sp) { o.x = sp.x; o.y = sp.y; o.z = sp.z; o.vy = sp.vy; o.dx = sp.dx; o.dz = sp.dz; }
function store(sp) { sp.x = o.x; sp.y = o.y; sp.z = o.z; sp.vy = o.vy; sp.dx = o.dx; sp.dz = o.dz; }
function turn(sp, want, rate, dt) {
  let d = want - sp.face; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  sp.face += Math.max(-rate * dt, Math.min(rate * dt, d));
}
function chase(g, sp, spd, dt) {
  load(sp); steerVec(g, o, g.p.x, g.p.y, g.p.z, sv);
  if (!(sv.direct && sv.d < sp.radius + 0.8)) walk(g, o, sv.x, sv.z, spd, dt, Math.min(sp.radius, SCALE.walkRadiusCap), CFG.enemy.stepUp);
  settle(o, dt); store(sp);
}

export function updateSpecials(g, dt) {
  const p = g.p;
  for (const sp of g.sp) {
    if (!sp.alive) continue;
    const mul = g.dmgMul * (sp.enrage || 1), kr = sp.kr || 1;
    if (sp.flash > 0) sp.flash -= dt;
    if (sp.mark > 0) sp.mark -= dt;
    if (sp.burn > 0) { sp.burn -= dt; const bd = sp.burnDps * dt; sp.hp -= bd; { const prev = g.curSrc; g.curSrc = g.srcIndex('burn'); g.logDealt(bd); g.curSrc = prev; } if (sp.hp <= 0) { onDeath(g, sp); continue; } }
    const dx = p.x - sp.x, dz = p.z - sp.z, d = Math.sqrt(dx * dx + dz * dz) || 0.001;

    if (sp.kind === 'warden') {
      const S = SPECIALS.warden;
      if (sp.st === 1) {                                           // slam windup, circle shown
        sp.stT -= dt;
        if (sp.stT <= 0) {
          sp.st = 0; sp.cd = S.slam.cooldown;
          if (d < S.slam.radius * kr && Math.abs(p.y - sp.y) < 2.5) g.hurtPlayer(S.slam.dmg * mul, true, 'Sealed Warden slam');
          addFx(g, { type: 'ring', x: sp.x, y: sp.y, z: sp.z, r: S.slam.radius * kr, dur: 0.5, color: 0xff5030 });
        }
        continue;
      }
      turn(sp, atan2(dx, dz), S.turnRate, dt);
      sp.cd -= dt;
      chase(g, sp, S.speed, dt);
      if (sp.cd <= 0 && d < S.slam.trigger * kr) {
        sp.st = 1; sp.stT = S.slam.telegraph;
        addTele(g.tele, { type: 1, x: sp.x, y: sp.y, z: sp.z, r: S.slam.radius * kr, dur: S.slam.telegraph });
      }
    } else if (sp.kind === 'idol') {
      const S = SPECIALS.idol;
      if (sp.dead) {                                               // fallen: the revive timer counts down over the body
        sp.reviveT -= dt;
        if (sp.reviveT <= 0) { sp.dead = false; sp.hp = sp.maxHp * S.reviveHpFraction; g.event('banner', 'An idol rises again.'); }
        continue;
      }
      const I = g.mode !== 'classic' && g.diff ? g.diff.idol : null, spd = I ? I.speed : S.speed, bite = I ? I.bite : S.bite;      // difficulty table: bite and speed
      chase(g, sp, spd, dt); sp.face = atan2(dx, dz);
      sp.atk -= dt;
      if (d < S.reach * kr && Math.abs(p.y - sp.y) < CFG.enemy.vReach && sp.atk <= 0 && g.grace <= 0 && !isDashing(p)) { sp.atk = CFG.enemy.attackCd; g.hurtPlayer(bite * mul, false, 'Twin Jackal Idol'); }
    } else if (sp.kind === 'pharaoh') updatePharaoh(g, sp, dt, dx, dz, d);
  }
  // sand closes in during the last phase
  if (g.boss.state === 'active' && g.boss.phase === 3) {
    const S = SPECIALS.pharaoh.sand, b = g.boss;
    b.sandT += dt; b.sandR = S.rStart + (S.rEnd - S.rStart) * Math.min(1, b.sandT / S.seconds);
    b.tickT = (b.tickT || 0) - dt;
    const ac = (g.map && g.map.arena && g.map.arena.center) || { x: 0, z: 0 };       // measured from the arena centre, not the world origin
    const r = Math.sqrt((p.x - ac.x) * (p.x - ac.x) + (p.z - ac.z) * (p.z - ac.z));
    if (b.tickT <= 0) { b.tickT = S.tick; if (r > b.sandR && r < 34 && p.y < 1.5) g.hurtPlayer(S.dps * S.tick, true, 'the rising sand'); }
  }
  // face-down trap cards
  for (const t of g.btraps) {
    if (!t.on) continue;
    t.life -= dt; if (t.life <= 0) { t.on = false; continue; }
    const T = SPECIALS.pharaoh.traps, dx = p.x - t.x, dz = p.z - t.z;
    if (dx * dx + dz * dz < T.stepRadius * T.stepRadius && Math.abs(p.y - t.y) < 1.5) { t.on = false; explode(g, t.x, t.y, t.z, T.burstRadius, T.dmg * g.dmgMul, 0, 0xb050ff, 'a Pharaoh trap card'); }
  }
}

function updatePharaoh(g, sp, dt, dx, dz, d) {
  const S = SPECIALS.pharaoh, BR = S.blade.range * (sp.kr || 1), b = g.boss, p = g.p, mul = g.dmgMul * (sp.enrage || 1);
  const frac = sp.hp / sp.maxHp, phase = frac > S.phase2 ? 1 : frac > S.phase3 ? 2 : 3;
  if (phase !== b.phase) {
    b.phase = phase; g.emit('bossphase', phase);
    g.event('banner', phase === 2 ? 'Phase two: face-down traps cover the floor.' : 'Phase three: the sand rises.');
    addFx(g, { type: 'ring', x: sp.x, y: sp.y, z: sp.z, r: 12, dur: 0.8, color: 0xe8c56a });
  }
  if (sp.st === 1) {                                               // blade windup: marked arc
    sp.stT -= dt;
    if (sp.stT <= 0) {
      sp.st = 0; sp.cd = S.blade.cooldown;
      const fx = sin(sp.face), fz = cos(sp.face), l = d || 1, dot = (dx / l) * fx + (dz / l) * fz;
      if (d < BR && dot > cos(S.blade.arcDeg / 2 * DEG) && Math.abs(p.y - sp.y) < 2.5) g.hurtPlayer(S.blade.dmg * mul, true, 'The Hollow Pharaoh blade');
      addFx(g, { type: 'fan', x: sp.x, y: sp.y, z: sp.z, r: BR, arc: S.blade.arcDeg, dx: fx, dz: fz, dur: 0.3, color: 0xffe0a0 });
    }
    return;
  }
  turn(sp, atan2(dx, dz), 2.5, dt);
  sp.cd -= dt;
  chase(g, sp, S.speed, dt);
  if (sp.cd <= 0 && d < BR - 1) {
    sp.st = 1; sp.stT = S.blade.telegraph;
    addTele(g.tele, { type: 2, x: sp.x, y: sp.y, z: sp.z, r: BR, arc: S.blade.arcDeg, dx: sin(sp.face), dz: cos(sp.face), dur: S.blade.telegraph });
  }
  if (phase === 1) {
    b.summonT -= dt;
    if (b.summonT <= 0) {
      b.summonT = S.summon.every;
      for (let k = 0; k < S.summon.count; k++) { const a = k / S.summon.count * 6.283; spawnEnemy(g, 'husk', { x: sp.x + cos(a) * 6, z: sp.z + sin(a) * 6 }); } if (g.gate && g.gate.state === 'fight') g.spawnAcc -= S.summon.count;       // during the gate fight the boss's adds count against the 40 percent horde, so the total stays near that rate
      g.event('banner', 'The Pharaoh summons Husks.');
    }
  }
  if (phase === 2) {
    b.trapT -= dt;
    if (b.trapT <= 0) {
      b.trapT = S.traps.every;
      let placed = 0;
      for (let tries = 0; tries < 30 && placed < S.traps.count; tries++) {
        const a = g.rsp() * 6.283, r = 3 + g.rsp() * S.traps.spread, x = p.x + p.vx * K.leadCap + cos(a) * r, z = p.z + p.vz * K.leadCap + sin(a) * r, h = heightAt(x, z);       // traps are laid where the duelist's real velocity takes them
        if (h >= 50 || Math.abs(h - p.y) > 1) continue;
        let slot = g.btraps.find(t => !t.on); if (!slot || g.btraps.filter(t => t.on).length >= S.traps.max) break;
        Object.assign(slot, { on: true, x, y: h, z, life: S.traps.lifetime }); placed++;
      }
    }
  }
}





