import { OATH_BY_ID } from '../data/progress.js';
import { K } from '../data/tuning.js';
import { CAP, capReady, capTake } from './caps.js';
import { takeBuf, freeBuf } from './scratch.js';
// What the monsters on your field do each tick, plus Traps and one-shot Spells. Every number comes from data/cards.js.
import { CFG } from '../data/config.js';
import { atan2, cos, pow, sin } from './dmath.js';
import { MARKS, TRAPS, ONE_SHOTS, FIELD_RULES } from '../data/cards.js';
import { heightAt } from './terrain.js';
import { resolveColliders } from './colliders.js';
const SUMMON_AT = { x: 0, y: 0, z: 0, vx: 0, vz: 0 };
import { fireShot, fireLob, fireHoming, KIND_CARD, KIND_FIRE, splash, AREA_SHARE } from './weapons.js';
import { damageEnemy, addFx, addTele, explode } from './combat.js';
import { def, param, damageOf } from './field.js';
import { elemBits } from '../data/elements.js';

const pick = [];

// shrine basins, stones, chests, the Broker and the altar are solid for a summon (their size is a stand-in until the models have collision data)
function propPush(g, m) {
  const W = g.world, push = (o, r) => { const dx = m.x - o.x, dz = m.z - o.z, rr = r + 0.6, d2 = dx * dx + dz * dz; if (d2 < rr * rr && Math.abs(m.y - (o.y || 0)) < 6) { const d = Math.sqrt(d2) || 1e-4; m.x = o.x + dx / d * rr; m.z = o.z + dz / d * rr; } };
  for (const s of W.shrines) push(s, 1.9); for (const s of W.stones) push(s, 1.1); for (const c of W.cchests) if (!c.open) push(c, 0.9); if (W.broker) push(W.broker, 2.6); if (W.altar) push(W.altar, 2.2);
}
// ---- the Ember Wake: a strip of embers left under a fire line (level 3 and up on the Wyvern). One per Wyvern, laid again by each shot; every WAKE_TICK s it hurts everything within half its width of the line ----
const RING_EVERY = 4;
export const WAKE_W = 2, WAKE_TICK = 0.5, WAKE_LIFE = 1.5;       // base width in metres (grows with Reach), seconds between hits, seconds it lasts
export function layWake(g, m, tx, ty, tz, len, dmg, flame) {
  const dx = tx - m.x, dz = tz - m.z, l = Math.sqrt(dx * dx + dz * dz) || 1, ux = dx / l, uz = dz / l, hw = WAKE_W * g.reachK / 2;
  const x2 = m.x + ux * len, z2 = m.z + uz * len, mx = (m.x + x2) / 2, mz = (m.z + z2) / 2, id = g.srcIndex(m.id);
  let o = null; for (const q of g.fx) if (q.on && q.type === 'wake' && q.src === id) { o = q; break; }
  const spec = { type: 'wake', owner: 0, el: 'fire', x: mx, y: Math.max(heightAt(m.x, m.z), heightAt(x2, z2), heightAt(mx, mz)), z: mz, ax: m.x, az: m.z, bx: x2, bz: z2, hw, dmg: dmg * AREA_SHARE, flame, src: id, dx: ux, dz: uz, r: len / 2, dur: WAKE_LIFE, color: 0xff8a30 };
  if (o) { const k = o.k; Object.assign(o, spec, { t: 0, k }); } else { o = addFx(g, spec); if (o) o.k = 0; }
}
export function updateWakes(g, dt) {
  const e = g.en;
  for (const o of g.fx) {
    if (!o.on || o.type !== 'wake') continue;
    o.k += dt; if (o.k < WAKE_TICK) continue; o.k -= WAKE_TICK;
    g.curSrc = o.src;
    const buf = takeBuf(), c = g.grid.query(o.x, o.z, o.r + o.hw * 1.5, buf);
    for (let k = 0; k < c; k++) {
      const j = buf[k]; if (!e.alive[j]) continue;
      if (inWake(o, e.x[j], e.z[j], 0)) damageEnemy(g, j, o.dmg, { elem: o.flame, noCrit: true });
    }
    freeBuf();
    for (const sp of g.sp) { if (!sp.alive || sp.dead) continue; if (inWake(o, sp.x, sp.z, sp.radius)) g.damageSpecial(sp, o.dmg, o.x, o.z, { area: true, elem: o.flame }); }
    g.curSrc = 0;
  }
}
// the footprint is a rectangle: from the Wyvern along the line (length len), hw each side. pad widens it for a body with a radius. The view draws exactly this rectangle.
export function inWake(o, x, z, pad) { const a = (x - o.ax) * o.dx + (z - o.az) * o.dz, c = -(x - o.ax) * o.dz + (z - o.az) * o.dx; return a > -pad && a < o.r * 2 + pad && Math.abs(c) < o.hw + pad; }

export function updateMonsters(g, dt) {
  const p = g.p, f = g.field;
  updateWakes(g, dt);
  for (let k = 0; k < f.monsters.length; k++) {
    const m = f.monsters[k]; if (!m) continue;
    m.px = m.x; m.py = m.y; m.pz = m.z;
    // fixed slots beside the duelist, relative to the camera yaw (right, left, then wider and a step back): a summon never sits on the camera line over the duelist, and none overlap each other
    const cy = g.camYaw || 0, fx0 = -sin(cy), fz0 = -cos(cy), rx0 = -fz0, rz0 = fx0, side = (k % 2 ? -1 : 1) * (k < 2 ? 2.7 : 3.6), ahead = k < 2 ? 0.8 : -0.6;
    const tx = p.x + rx0 * side + fx0 * ahead, tz = p.z + rz0 * side + fz0 * ahead, ty = p.y + 2.2 + sin(g.t * 3 + k) * 0.2;
    if (!m.init) { m.x = tx; m.y = ty; m.z = tz; m.px = tx; m.py = ty; m.pz = tz; m.init = true; }
    const kk = Math.min(1, dt * 6); m.x += (tx - m.x) * kk; m.y += (ty - m.y) * kk; m.z += (tz - m.z) * kk;
    if (g.colliders) { const o = SUMMON_AT; o.x = m.x; o.z = m.z; o.y = Math.max(0, heightAt(m.x, m.z)) + 0.5; resolveColliders(g.colliders, o, 0.7); m.x = o.x; m.z = o.z; }
    if (g.world) propPush(g, m);       // a summon is pushed out of trunks and boulders as a body on the ground, whatever height it hovers at
    { const lx = m.x - tx, ly = m.y - ty, lz = m.z - tz, l2 = lx * lx + ly * ly + lz * lz, LEASH = 9; if (l2 > LEASH * LEASH) { const l = Math.sqrt(l2), s = LEASH / l; if (l > 40) { m.x = tx; m.y = ty; m.z = tz; m.px = tx; m.py = ty; m.pz = tz; } else { m.x = tx + lx * s; m.y = ty + ly * s; m.z = tz + lz * s; } } }       // the leash: a summon is never more than 9 m from its duelist, and after a teleport (stage change, gate) it simply arrives with them
    { const sr = param(m, 'ring'); if (sr > 0) { m.ringT = (m.ringT === undefined ? RING_EVERY : m.ringT) - dt; if (m.ringT <= 0 && g.nearest(m.x, m.z, sr * g.reachK) >= 0) { m.ringT = RING_EVERY; g.curSrc = g.srcIndex(m.id); splash(g, m.x, heightAt(m.x, m.z), m.z, sr, damageOf(m) * AREA_SHARE, elemBits(def(m.id).elements)); g.curSrc = 0; } else if (m.ringT <= 0) m.ringT = 0; } }       // the Seal Ring: a pulse around the Sigil Familiar every RING_EVERY s once an enemy is inside it (level 3 and up)
    m.cd -= dt;
    if (m.cd > 0) continue;
    const D = def(m.id), A = D.attack, cd = A.cd / (1 + g.mods.monsterRate) / (g.rflow ? 1 + 0.1 * (g.rflow.step - 1) : 1);       // Flow fuels the summons: +10% attack rate a Flow step
    g.curSrc = g.srcIndex(m.id);
    if (attack(g, m, D, A)) m.cd = cd; else m.cd = 0;
    g.curSrc = 0;
  }
  // the duelist's own card throw
  g.cardT -= dt;
  const peace = g.oaths.peace && (g.mode === 'classic' ? g.t : g.scTotal + g.sc) < OATH_BY_ID.peace.peaceSeconds;      // Peace Oath: no damage from you for the first 3 minutes
  if (peace) g.cardT = 0.3;
  if (g.cardT <= 0) {
    const i = g.nearest(p.x, p.z, CFG.card.range), e = g.en;
    g.curSrc = g.srcIndex('card-throw');
    if (i >= 0) { g.aimX = e.x[i]; g.aimZ = e.z[i]; fireShot(g, KIND_CARD, p.x, p.y + 1.1, p.z, e.x[i], e.y[i] + 0.9, e.z[i], CFG.card.speed, CFG.card.life, FIELD_RULES.playerCardDamage, { flame: g.mods.cardBurn ? 1 : 0 }); g.cardT = FIELD_RULES.playerCardCooldown / (1 + g.mods.cardRate); }
    else {
      const sp = nearestSpecial(g, p.x, p.z, CFG.card.range);
      if (sp) { g.aimX = sp.x; g.aimZ = sp.z; fireShot(g, KIND_CARD, p.x, p.y + 1.1, p.z, sp.x, sp.y + 1.2, sp.z, CFG.card.speed, CFG.card.life, FIELD_RULES.playerCardDamage, { flame: g.mods.cardBurn ? 1 : 0 }); g.cardT = FIELD_RULES.playerCardCooldown / (1 + g.mods.cardRate); }
      else g.cardT = 0;
    }
    g.curSrc = 0;
  }
}

export function nearestSpecial(g, x, z, range) {
  let best = null, bd = range * range;
  for (const sp of g.sp) { if (!sp.alive || sp.dead) continue; const dx = sp.x - x, dz = sp.z - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = sp; } }
  return best;
}

function target(g, m, range) {
  const i = g.nearest(m.x, m.z, range);
  if (i >= 0) return { e: i };
  const sp = nearestSpecial(g, m.x, m.z, range);
  return sp ? { sp } : null;
}

function attack(g, m, D, A) {
  const e = g.en, dmg = damageOf(m), flame = elemBits(D.elements);
  switch (A.kind) {
    case 'line': {
      const T = target(g, m, param(m, 'length')); if (!T) return false;
      const x = T.sp ? T.sp.x : e.x[T.e], y = T.sp ? T.sp.y + 1.2 : e.y[T.e] + 0.9, z = T.sp ? T.sp.z : e.z[T.e];
      const len = param(m, 'length');
      fireShot(g, KIND_FIRE, m.x, m.y - 0.6, m.z, x, y, z, A.speed, len / A.speed, dmg, { flame, pierce: param(m, 'pierce'), burst: param(m, 'burst') });
      if (param(m, 'wake') > 0) layWake(g, m, x, y, z, len, dmg, flame);
      g.faceOf[m.id] = atan2(x - m.x, z - m.z); g.faceT = g.t; return true;
    }
    case 'lob': {
      const T = target(g, m, A.range); if (!T) return false;
      const n = param(m, 'count');
      for (let c = 0; c < n; c++) {
        let x = T.sp ? T.sp.x : e.x[T.e], z = T.sp ? T.sp.z : e.z[T.e];
        if (c > 0) { const j = g.nearest(m.x + (g.rc() - 0.5) * 6, m.z + (g.rc() - 0.5) * 6, A.range); if (j >= 0) { x = e.x[j]; z = e.z[j]; } }
        fireLob(g, m.x, m.y, m.z, x, z, A.flight, dmg, param(m, 'splash'), flame);
      }
      return true;
    }
    case 'mark': {
      const range = param(m, 'range'), n = param(m, 'marks');
      const buf = takeBuf(), c = g.grid.query(m.x, m.z, range, buf);
      pick.length = 0;
      for (let k = 0; k < c; k++) { const i = buf[k]; if (!e.alive[i]) continue; const dx = e.x[i] - m.x, dz = e.z[i] - m.z, d = dx * dx + dz * dz; if (d < range * range) pick.push({ i, d, marked: e.mark[i] > 0 ? 1 : 0 }); }
      freeBuf();
      for (const sp of g.sp) { if (!sp.alive || sp.dead) continue; const dx = sp.x - m.x, dz = sp.z - m.z, d = dx * dx + dz * dz, rr = range + sp.radius; if (d < rr * rr) pick.push({ i: -1, sp, d, marked: sp.mark > 0 ? 1 : 0, big: 1 }); }       // elites and bosses can be marked too
      if (!pick.length) return false;
      pick.sort((a, b) => a.marked - b.marked || (b.big | 0) - (a.big | 0) || a.d - b.d);               // unmarked ones first, a boss or elite before the swarm, then nearest first
      const dur = MARKS.duration + g.mods.markDur;
      for (let k = 0; k < Math.min(n, pick.length); k++) { const P = pick[k]; if (P.sp) { P.sp.mark = dur; g.damageSpecial(P.sp, dmg, m.x, m.z, { noCrit: true, elem: flame }); } else { e.mark[P.i] = dur; damageEnemy(g, P.i, dmg, { noCrit: true, elem: flame }); } }
      addFx(g, { type: 'ring', owner: 0, x: m.x, y: m.y, z: m.z, r: 1.2, dur: 0.3, color: 0xb070ff });
      for (let k = 0; k < Math.min(n, pick.length, 4); k++) { const P = pick[k], i = P.i; addFx(g, { type: 'bolt', owner: 0, el: 'lightning', x: m.x, y: m.y - 0.3, z: m.z, x2: P.sp ? P.sp.x : e.x[i], y2: P.sp ? P.sp.y + 1.2 : e.y[i] + 0.9, z2: P.sp ? P.sp.z : e.z[i], dur: 0.15, color: 0x5fe8ff, seed: P.sp ? 99 : i }); }   // cyan rune bolts
      g.castAt = g.t;
      return true;
    }
    case 'homing': {
      const range = param(m, 'range'); let t = -1, bd = range * range;
      { const buf = takeBuf(), c = g.grid.query(m.x, m.z, range, buf);
      for (let k = 0; k < c; k++) { const i = buf[k]; if (!e.alive[i] || e.mark[i] <= 0) continue; const dx = e.x[i] - m.x, dz = e.z[i] - m.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; t = i; } }
      freeBuf(); }
      let tsp = null; for (const sp of g.sp) { if (!sp.alive || sp.dead || sp.mark <= 0) continue; const dx = sp.x - m.x, dz = sp.z - m.z, d = dx * dx + dz * dz, rr = range + sp.radius; if (d < rr * rr && d < bd) { bd = d; tsp = sp; t = -1; } }       // a marked boss or elite is the first choice
      if (t < 0 && !tsp) t = g.nearest(m.x, m.z, range);
      if (t < 0 && !tsp) tsp = nearestSpecial(g, m.x, m.z, range);
      if (t < 0 && !tsp) return false;
      const hi = fireHoming(g, m.x, m.y, m.z, t, param(m, 'speed') || A.speed, 2.5, dmg, tsp); if (hi >= 0) g.shots.flame[hi] = flame; return true;
    }
    case 'cone': {
      const range = param(m, 'range'), arc = param(m, 'arc'), i = g.nearest(m.x, m.z, range);
      let tx, tz;
      if (i >= 0) { tx = e.x[i] - m.x; tz = e.z[i] - m.z; } else { const sp = nearestSpecial(g, m.x, m.z, range); if (!sp) return false; tx = sp.x - m.x; tz = sp.z - m.z; }
      const l = Math.sqrt(tx * tx + tz * tz) || 1, fx = tx / l, fz = tz / l, cosA = cos(arc / 2 * Math.PI / 180);
      const rr = range * g.reachK, buf = takeBuf(), c = g.grid.query(m.x, m.z, rr, buf);
      for (let k = 0; k < c; k++) {
        const j = buf[k]; if (!e.alive[j]) continue;
        const dx = e.x[j] - m.x, dz = e.z[j] - m.z, d = Math.sqrt(dx * dx + dz * dz);
        if (d < rr && d > 0.01 && (dx / d) * fx + (dz / d) * fz > cosA) damageEnemy(g, j, dmg, { elem: flame, kx: dx, kz: dz });
      }
      freeBuf();
      for (const sp of g.sp) { if (!sp.alive || sp.dead) continue; const dx = sp.x - m.x, dz = sp.z - m.z, d = Math.sqrt(dx * dx + dz * dz); if (d < rr + sp.radius && (dx / (d || 1)) * fx + (dz / (d || 1)) * fz > cosA) g.damageSpecial(sp, dmg, m.x, m.z, { elem: flame }); }
      addFx(g, { type: 'fan', owner: 0, el: 'fire', x: m.x, y: m.y - 0.8, z: m.z, r: rr, arc, dx: fx, dz: fz, dur: 0.25, color: 0xffa848 });
      return true;
    }
  }
  return false;
}

// ---- Traps ----
// EV_HURT: every hurt-triggered effect (traps and the Thornbound Locket) from enemy hits and self-damage alike sits under one per-minute cap
export function onPlayerHurt(g, self) {
  let any = g.mods.locket > 0; if (!any) for (const s of g.field.spells) if (s && TRAPS[s.id] && TRAPS[s.id].trigger === 'hurt' && s.cd <= 0) { any = true; break; }
  if (!any) return;
  if (self && !capReady(g, CAP.HURT_SELF)) return;
  if (!capTake(g, CAP.HURT_FIRE)) return;
  if (self) capTake(g, CAP.HURT_SELF);
  for (const s of g.field.spells) if (s && TRAPS[s.id] && TRAPS[s.id].trigger === 'hurt' && s.cd <= 0) fireTrap(g, s);
  if (g.mods.locket > 0) locketNova(g);
}
const copyEff = n => 1 + (K.copyCap - 1) * (n - 1) / ((n - 1) + K.copyK);        // n copies act as 1, 2, 2.5, 2.8 ... toward x4
function locketNova(g) {
  const guard = g.mods.armour * K.guardPerArmour, base = K.locketPerGuard * Math.min(guard, K.locketGuardCap) * copyEff(g.mods.locket);
  if (base <= 0) return;
  const prev = g.curSrc; g.curSrc = g.srcIndex('thornbound-locket'); explode(g, g.p.x, g.p.y, g.p.z, K.locketRadius, 0, base, 0xd8b24a, 'Thornbound Locket'); g.curSrc = prev;       // the attack that set this off keeps its own source (and its Pack Drill) for the rest of its hits
}
function fireTrap(g, s) {
  const T = TRAPS[s.id], p = g.p, e = g.en, lv = s.level - 1, prevSrc = g.curSrc; g.curSrc = g.srcIndex(s.id);
  s.cd = T.recharge * pow(T.rechargePerLevel, lv) * (1 - g.mods.trapRecharge); g.trapsFired++; g.emit('sound', 3);
  const dmg = T.dmg * (1 + T.dmgPerLevel * lv), TR = T.radius * g.reachK;
  addFx(g, { type: 'ring', owner: 0, el: s.id === 'gust-ward' ? 'wind' : null, x: p.x, y: p.y, z: p.z, r: TR, dur: 0.5, color: s.id === 'gust-ward' ? 0xa0e0ff : 0xe8c56a });
  const buf = takeBuf(), c = g.grid.query(p.x, p.z, TR, buf);
  for (let k = 0; k < c; k++) {
    const i = buf[k]; if (!e.alive[i]) continue;
    const dx = e.x[i] - p.x, dz = e.z[i] - p.z;
    if (dx * dx + dz * dz > TR * TR) continue;
    if (s.id === 'gust-ward') damageEnemy(g, i, dmg, { noCrit: true, kx: dx, kz: dz, knock: T.knock });
    else { e.root[i] = T.root; damageEnemy(g, i, dmg, { noCrit: true }); }
  }
  freeBuf();
  g.event('banner', T.name + ' fires!'); g.curSrc = prevSrc;
}
export function updateTraps(g, dt) {
  const p = g.p, e = g.en;
  for (const s of g.field.spells) {
    if (!s || !TRAPS[s.id]) continue;
    if (s.cd > 0) { s.cd -= dt; continue; }
    const T = TRAPS[s.id];
    if (T.trigger === 'crowd') {
      const buf = takeBuf(), c = g.grid.query(p.x, p.z, T.radius + 6, buf); let n = 0;
      for (let k = 0; k < c; k++) { const i = buf[k]; if (!e.alive[i]) continue; const dx = e.x[i] - p.x, dz = e.z[i] - p.z; if (dx * dx + dz * dz < T.radius * T.radius) n++; }
      freeBuf();
      if (n >= T.crowd) fireTrap(g, s);
    }
  }
  // Storm of Cards: 60 cards rain on enemies over a few seconds
  if (g.storm) {
    const S = ONE_SHOTS['storm-of-cards']; g.storm.t += dt;
    const due = Math.floor(S.cards * Math.min(1, g.storm.t / S.seconds)) - (S.cards - g.storm.left);
    g.curSrc = g.srcIndex('storm-of-cards');
    for (let k = 0; k < due && g.storm.left > 0; k++) {
      g.storm.left--;
      const a = g.rc() * Math.PI * 2, i = g.nearest(p.x + cos(a) * 12, p.z + sin(a) * 12, 40);
      if (i >= 0) { addFx(g, { type: 'ring', owner: 0, x: e.x[i], y: e.y[i], z: e.z[i], r: 1.2, dur: 0.25, color: 0xf3e3c2 }); damageEnemy(g, i, S.dmg, { noCrit: true }); }
    }
    g.curSrc = 0;
    if (g.storm.left <= 0) g.storm = null;
  }
}





