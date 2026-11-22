// What the monsters on your field do each tick, plus Traps and one-shot Spells. Every number comes from data/cards.js.
import { CFG } from '../data/config.js';
import { MARKS, TRAPS, ONE_SHOTS, FIELD_RULES } from '../data/cards.js';
import { heightAt } from './terrain.js';
import { fireShot, fireLob, fireHoming, KIND_CARD, KIND_FIRE, splash } from './weapons.js';
import { damageEnemy, addFx, addTele } from './combat.js';
import { def, param, damageOf } from './field.js';
import { elemBits } from '../data/elements.js';

const buf = new Int32Array(CFG.enemy.max), pick = [];

export function updateMonsters(g, dt) {
  const p = g.p, f = g.field;
  for (let k = 0; k < f.monsters.length; k++) {
    const m = f.monsters[k]; if (!m) continue;
    m.px = m.x; m.py = m.y; m.pz = m.z;
    const a = (m.ang || 0) + g.t * 0.9 + k * 1.57, r = 2.1 + (k % 2) * 0.5;
    const tx = p.x + Math.cos(a) * r, tz = p.z + Math.sin(a) * r, ty = p.y + 2.2 + Math.sin(g.t * 3 + k) * 0.2;
    if (!m.init) { m.x = tx; m.y = ty; m.z = tz; m.px = tx; m.py = ty; m.pz = tz; m.init = true; }
    const kk = Math.min(1, dt * 6); m.x += (tx - m.x) * kk; m.y += (ty - m.y) * kk; m.z += (tz - m.z) * kk;
    m.cd -= dt;
    if (m.cd > 0) continue;
    const D = def(m.id), A = D.attack, cd = A.cd / (1 + g.mods.monsterRate);
    if (attack(g, m, D, A)) m.cd = cd; else m.cd = 0;
  }
  // the duelist's own card throw
  g.cardT -= dt;
  if (g.cardT <= 0) {
    const i = g.nearest(p.x, p.z, CFG.card.range), e = g.en;
    if (i >= 0) { fireShot(g, KIND_CARD, p.x, p.y + 1.1, p.z, e.x[i], e.y[i] + 0.9, e.z[i], CFG.card.speed, CFG.card.life, FIELD_RULES.playerCardDamage, { flame: g.mods.cardBurn ? 1 : 0 }); g.cardT = FIELD_RULES.playerCardCooldown / (1 + g.mods.cardRate); }
    else {
      const sp = nearestSpecial(g, p.x, p.z, CFG.card.range);
      if (sp) { fireShot(g, KIND_CARD, p.x, p.y + 1.1, p.z, sp.x, sp.y + 1.2, sp.z, CFG.card.speed, CFG.card.life, FIELD_RULES.playerCardDamage); g.cardT = FIELD_RULES.playerCardCooldown / (1 + g.mods.cardRate); }
      else g.cardT = 0;
    }
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
      fireShot(g, KIND_FIRE, m.x, m.y - 0.6, m.z, x, y, z, A.speed, len / A.speed, dmg, { flame, pierce: param(m, 'pierce') });
      g.faceOf[m.id] = Math.atan2(x - m.x, z - m.z); g.faceT = g.t; return true;
    }
    case 'lob': {
      const T = target(g, m, A.range); if (!T) return false;
      const n = param(m, 'count');
      for (let c = 0; c < n; c++) {
        let x = T.sp ? T.sp.x : e.x[T.e], z = T.sp ? T.sp.z : e.z[T.e];
        if (c > 0) { const j = g.nearest(m.x + (g.rng() - 0.5) * 6, m.z + (g.rng() - 0.5) * 6, A.range); if (j >= 0) { x = e.x[j]; z = e.z[j]; } }
        fireLob(g, m.x, m.y, m.z, x, z, A.flight, dmg, param(m, 'splash'), flame);
      }
      return true;
    }
    case 'mark': {
      const range = param(m, 'range'), n = param(m, 'marks');
      const c = g.grid.query(m.x, m.z, range, buf);
      pick.length = 0;
      for (let k = 0; k < c; k++) { const i = buf[k]; if (!e.alive[i]) continue; const dx = e.x[i] - m.x, dz = e.z[i] - m.z, d = dx * dx + dz * dz; if (d < range * range) pick.push({ i, d, marked: e.mark[i] > 0 ? 1 : 0 }); }
      if (!pick.length) return false;
      pick.sort((a, b) => a.marked - b.marked || a.d - b.d);               // unmarked ones first, nearest first
      const dur = MARKS.duration + g.mods.markDur;
      for (let k = 0; k < Math.min(n, pick.length); k++) { const i = pick[k].i; e.mark[i] = dur; damageEnemy(g, i, dmg, { noCrit: true, elem: flame }); }
      addFx(g, { type: 'ring', x: m.x, y: m.y, z: m.z, r: 1.2, dur: 0.3, color: 0xb070ff });
      return true;
    }
    case 'homing': {
      const range = param(m, 'range'); let t = -1, bd = range * range;
      const c = g.grid.query(m.x, m.z, range, buf);
      for (let k = 0; k < c; k++) { const i = buf[k]; if (!e.alive[i] || e.mark[i] <= 0) continue; const dx = e.x[i] - m.x, dz = e.z[i] - m.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; t = i; } }
      if (t < 0) t = g.nearest(m.x, m.z, range);
      if (t < 0) return false;
      const hi = fireHoming(g, m.x, m.y, m.z, t, param(m, 'speed') || A.speed, 2.5, dmg); if (hi >= 0) g.shots.flame[hi] = flame; return true;
    }
    case 'cone': {
      const range = param(m, 'range'), arc = param(m, 'arc'), i = g.nearest(m.x, m.z, range);
      let tx, tz;
      if (i >= 0) { tx = e.x[i] - m.x; tz = e.z[i] - m.z; } else { const sp = nearestSpecial(g, m.x, m.z, range); if (!sp) return false; tx = sp.x - m.x; tz = sp.z - m.z; }
      const l = Math.sqrt(tx * tx + tz * tz) || 1, fx = tx / l, fz = tz / l, cosA = Math.cos(arc / 2 * Math.PI / 180);
      const c = g.grid.query(m.x, m.z, range, buf);
      for (let k = 0; k < c; k++) {
        const j = buf[k]; if (!e.alive[j]) continue;
        const dx = e.x[j] - m.x, dz = e.z[j] - m.z, d = Math.sqrt(dx * dx + dz * dz);
        if (d < range && d > 0.01 && (dx / d) * fx + (dz / d) * fz > cosA) damageEnemy(g, j, dmg, { elem: flame, kx: dx, kz: dz });
      }
      for (const sp of g.sp) { if (!sp.alive || sp.dead) continue; const dx = sp.x - m.x, dz = sp.z - m.z, d = Math.sqrt(dx * dx + dz * dz); if (d < range + sp.radius && (dx / (d || 1)) * fx + (dz / (d || 1)) * fz > cosA) g.damageSpecial(sp, dmg, m.x, m.z, { elem: flame }); }
      addFx(g, { type: 'fan', x: m.x, y: m.y - 0.8, z: m.z, r: range, arc, dx: fx, dz: fz, dur: 0.25, color: 0xff7a30 });
      return true;
    }
  }
  return false;
}

// ---- Traps ----
export function onPlayerHurt(g) {
  for (const s of g.field.spells) if (s && TRAPS[s.id] && TRAPS[s.id].trigger === 'hurt' && s.cd <= 0) fireTrap(g, s);
}
function fireTrap(g, s) {
  const T = TRAPS[s.id], p = g.p, e = g.en, lv = s.level - 1;
  s.cd = T.recharge * Math.pow(T.rechargePerLevel, lv) * (1 - g.mods.trapRecharge);
  const dmg = T.dmg * (1 + T.dmgPerLevel * lv);
  addFx(g, { type: 'ring', x: p.x, y: p.y, z: p.z, r: T.radius, dur: 0.5, color: s.id === 'gust-ward' ? 0xa0e0ff : 0xe8c56a });
  const c = g.grid.query(p.x, p.z, T.radius, buf);
  for (let k = 0; k < c; k++) {
    const i = buf[k]; if (!e.alive[i]) continue;
    const dx = e.x[i] - p.x, dz = e.z[i] - p.z;
    if (dx * dx + dz * dz > T.radius * T.radius) continue;
    if (s.id === 'gust-ward') damageEnemy(g, i, dmg, { noCrit: true, kx: dx, kz: dz, knock: T.knock });
    else { e.root[i] = T.root; damageEnemy(g, i, dmg, { noCrit: true }); }
  }
  g.event('banner', T.name + ' fires!');
}
export function updateTraps(g, dt) {
  const p = g.p, e = g.en;
  for (const s of g.field.spells) {
    if (!s || !TRAPS[s.id]) continue;
    if (s.cd > 0) { s.cd -= dt; continue; }
    const T = TRAPS[s.id];
    if (T.trigger === 'crowd') {
      const c = g.grid.query(p.x, p.z, T.radius + 6, buf); let n = 0;
      for (let k = 0; k < c; k++) { const i = buf[k]; if (!e.alive[i]) continue; const dx = e.x[i] - p.x, dz = e.z[i] - p.z; if (dx * dx + dz * dz < T.radius * T.radius) n++; }
      if (n >= T.crowd) fireTrap(g, s);
    }
  }
  // Storm of Cards: 60 cards rain on enemies over a few seconds
  if (g.storm) {
    const S = ONE_SHOTS['storm-of-cards']; g.storm.t += dt;
    const due = Math.floor(S.cards * Math.min(1, g.storm.t / S.seconds)) - (S.cards - g.storm.left);
    for (let k = 0; k < due && g.storm.left > 0; k++) {
      g.storm.left--;
      const a = g.rng() * Math.PI * 2, i = g.nearest(p.x + Math.cos(a) * 12, p.z + Math.sin(a) * 12, 40);
      if (i >= 0) { addFx(g, { type: 'ring', x: e.x[i], y: e.y[i], z: e.z[i], r: 1.2, dur: 0.25, color: 0xf3e3c2 }); damageEnemy(g, i, S.dmg, { noCrit: true }); }
    }
    if (g.storm.left <= 0) g.storm = null;
  }
}



