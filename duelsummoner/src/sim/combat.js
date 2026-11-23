// Damage, status effects, explosions, drops and the little pools the view draws (telegraphs, effects).
import { K } from '../data/tuning.js';
import { mightBracket, targetBracket } from './ledger.js';
import { CFG } from '../data/config.js';
import { KIND_LIST, KINDS } from '../data/enemies.js';
import { RUN } from '../data/waves.js';
import { FIELD_RULES, MARKS } from '../data/cards.js';
import { heightAt, moveXZ } from './terrain.js';
import { ELEMENTS } from '../data/elements.js';
import { aceFell } from './aces.js';
import { sourceBracket, affinityBracket, overtimeBracket, sourceClass } from './ledger.js';

export const PICK_XP = 0, PICK_COIN = 1, PICK_HEART = 2;
const buf = new Int32Array(CFG.enemy.max);
const tmp = { x: 0, y: 0, z: 0 };

// ---- pools the view reads ----
export function makeTele(n) { const a = []; for (let i = 0; i < n; i++) a.push({ on: false, type: 0, x: 0, y: 0, z: 0, dx: 0, dz: 1, len: 0, w: 0, r: 0, arc: 0, t: 0, dur: 1, color: 0xff3020 }); return a; }
// type 0 line (from x,z along dx,dz, length len, width w), 1 disc (radius r), 2 fan (radius r, arc degrees, facing dx,dz)
export function addTele(list, spec) {
  for (let i = 0; i < list.length; i++) if (!list[i].on) { Object.assign(list[i], { on: true, t: 0, dur: 1, color: 0xff3020, arc: 0, len: 0, w: 0, r: 0, dx: 0, dz: 1 }, spec); return list[i]; }
  return null;
}
export function tickPool(list, dt) { for (let i = 0; i < list.length; i++) { const o = list[i]; if (o.on) { o.t += dt; if (o.t >= o.dur) o.on = false; } } }

// ---- damage to swarm enemies ----
export function damageEnemy(g, i, dmg, o) {
  const e = g.en; if (!e.alive[i]) return false;
  o = o || {};
  let d = dmg;
  const el = o.elem || (o.flame ? ELEMENTS.fire.bit : 0), BD = g.bracketDmg, b4 = e.mark[i] > 0 ? targetBracket(MARKS.bonus + g.mods.markBonus) : 1, b1 = mightBracket(g.mods.dmgMult);
  let cls = g.srcClassOf[g.curSrc]; if (cls === undefined) cls = g.srcClassOf[g.curSrc] = sourceClass(g.srcNames[g.curSrc]);
  const b2 = cls >= 0 ? sourceBracket(g.mods.drill[cls]) : 1, b8 = g.otStep > 0 ? overtimeBracket(g.otStep) : 1;
  let b3 = 1; if (el) { let sum = 0, cnt = 0; for (let k = 0; k < 8; k++) if (el & (1 << k)) { sum += g.mods.aff[k]; cnt++; } b3 = affinityBracket(sum / cnt); }
  d *= b4 * b1 * b2 * b3 * b8;                                                    // brackets 4, 1 (knee), 2, 3 and 8: add within a bracket, multiply across
  let crit = 0;
  if (!o.noCrit && g.rc() < FIELD_RULES.critChance + g.mods.crit) { d *= K.critBase; crit = 1; }
  if (BD) { const x1 = b1 - 1, x2 = b2 - 1, x3 = b3 - 1, x4 = b4 - 1, x5 = crit ? K.critBase - 1 : 0, x8 = b8 - 1, tot = x1 + x2 + x3 + x4 + x5 + x8; if (tot > 1e-9) { const sh = d / tot; BD[1] += sh * x1; BD[2] += sh * x2; BD[3] += sh * x3; BD[4] += sh * x4; BD[5] += sh * x5; BD[8] += sh * x8; } }       // where the damage came from, for the end-of-run screen (each bracket's share of the extra damage; no logs, so it stays inside the sim's maths rule)
  g.logDealt(d);
  e.hp[i] -= d; e.flash[i] = 0.12; g.emit('hit', d, e.x[i], e.z[i], crit | (el << 1));       // flags for the view: bit 0 crit, bits 1+ element mask
  if (el & ELEMENTS.fire.bit) { e.burn[i] = ELEMENTS.fire.burn.dur + g.mods.burnDur; e.burnDps[i] = ELEMENTS.fire.burn.dps + g.mods.burnDps; }
  const chainAfter = (el & ELEMENTS.lightning.bit) && !o.noChain;
  if (o.kx !== undefined) {
    const l = Math.sqrt(o.kx * o.kx + o.kz * o.kz) || 1, k = o.knock === undefined ? CFG.enemy.knock : o.knock;
    tmp.x = e.x[i]; tmp.y = e.y[i]; tmp.z = e.z[i];
    moveXZ(tmp, o.kx / l * k, o.kz / l * k, KIND_LIST[e.kind[i]].radius, CFG.enemy.stepUp);
    e.x[i] = tmp.x; e.z[i] = tmp.z;
  }
  const x0 = e.x[i], z0 = e.z[i];
  const dead = e.hp[i] <= 0; if (dead) killEnemy(g, i);
  if (chainAfter) chain(g, i, x0, z0, d * ELEMENTS.lightning.chain.falloff);
  return dead;
}

// lightning: arc to the nearest other enemy within a few metres for a fraction of the damage
function chain(g, from, x, z, dmg) {
  const C = ELEMENTS.lightning.chain, e = g.en, n = g.grid.query(x, z, C.radius, buf);
  let best = -1, bd = C.radius * C.radius;
  for (let k = 0; k < n; k++) { const j = buf[k]; if (j === from || !e.alive[j]) continue; const dx = e.x[j] - x, dz = e.z[j] - z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = j; } }
  if (best < 0) return;
  addFx(g, { type: 'ring', x: e.x[best], y: e.y[best] + 0.5, z: e.z[best], r: 1.0, dur: 0.2, color: 0x7fe8ff });
  damageEnemy(g, best, dmg, { noCrit: true, noChain: true });
}

export function killEnemy(g, i) {
  const e = g.en; if (!e.alive[i]) return;
  e.alive[i] = 0; g.kills++; g.emit('kill', e.kind[i], e.x[i], e.z[i]);
  if (g.mods.bell && g.kills % 50 === 0) explode(g, e.x[i], e.y[i], e.z[i], 4, 0, 10, 0xc0c0ff);       // Graveyard Bell
  const x = e.x[i], y = e.y[i], z = e.z[i], K = KIND_LIST[e.kind[i]];
  const mg = e.mrg[i];                                                        // enemies merged into this one: their rewards are summed
  dropPickup(g, PICK_XP, x, y, z, 1 + mg);
  for (let k = 0; k <= mg; k++) {
    if (g.rl() < RUN.coinChance) dropPickup(g, PICK_COIN, x + 0.6, y, z);
    if (g.rl() < RUN.heartChance) dropPickup(g, PICK_HEART, x - 0.6, y, z);
  }
  if (e.ace[i]) aceFell(g, x, y, z);                                          // a star-crested Ace: extra reward and a chance of a Trophy Chest
  if (K === KINDS.bloat) explode(g, x, y, z, K.blast.radius, K.blast.dmg * g.dmgMul, K.blast.dmg, 0xff9030, 'Sand Bloat');
  if (e.mark[i] > 0 && g.mods.markExplode) explode(g, x, y, z, g.mods.markExplode.radius, 0, g.mods.markExplode.dmg, 0xb070ff);
}

export function dropPickup(g, kind, x, y, z, val) {
  const m = g.pick; val = val || 1;
  for (let i = 0; i < m.max; i++) if (!m.alive[i]) { m.alive[i] = 1; m.kind[i] = kind; m.x[i] = x; m.y[i] = y + 0.5; m.z[i] = z; m.val[i] = val; return; }
  if (kind === PICK_XP) g.addXp(val);                                    // pool full: bank the XP directly
}

// ---- explosions: hurt the duelist (if pDmg) and every enemy and elite in range (if eDmg) ----
export function explode(g, x, y, z, r, pDmg, eDmg, color, src) {
  addFx(g, { type: 'ring', x, y, z, r, dur: 0.45, color: color || 0xff9030 });
  const p = g.p;
  if (pDmg > 0) { const dx = p.x - x, dz = p.z - z; if (dx * dx + dz * dz < r * r && Math.abs(p.y - y) < 2.5) g.hurtPlayer(pDmg, true, src || 'an explosion'); }
  if (eDmg > 0) {
    const e = g.en, n = g.grid.query(x, z, r, buf);
    for (let k = 0; k < n; k++) {
      const i = buf[k]; if (!e.alive[i]) continue;
      const dx = e.x[i] - x, dz = e.z[i] - z;
      if (dx * dx + dz * dz < r * r) damageEnemy(g, i, eDmg, { noCrit: true });
    }
    for (const sp of g.sp) {
      if (!sp.alive) continue;
      const dx = sp.x - x, dz = sp.z - z;
      if (dx * dx + dz * dz < (r + sp.radius) * (r + sp.radius)) g.damageSpecial(sp, eDmg, x, z, { area: true });
    }
  }
}

export function addFx(g, spec) {
  const list = g.fx;
  for (let i = 0; i < list.length; i++) if (!list[i].on) { Object.assign(list[i], { on: true, t: 0, dur: 0.4, r: 1, arc: 0, dx: 0, dz: 1, color: 0xff9030 }, spec); return list[i]; }
  return null;
}
export function makeFx(n) { const a = []; for (let i = 0; i < n; i++) a.push({ on: false, type: 'ring', x: 0, y: 0, z: 0, r: 1, arc: 0, dx: 0, dz: 1, t: 0, dur: 0.4, color: 0xff9030 }); return a; }

export { heightAt };



