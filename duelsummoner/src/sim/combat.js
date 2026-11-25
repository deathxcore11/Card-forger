// Damage, status effects, explosions, drops and the little pools the view draws (telegraphs, effects).
import { K } from '../data/tuning.js';
import { sealKill } from './seals.js';
import { mightBracket, targetBracket } from './ledger.js';
import { CFG } from '../data/config.js';
import { KIND_LIST, KINDS } from '../data/enemies.js';
import { RUN } from '../data/waves.js';
import { FIELD_RULES, MARKS } from '../data/cards.js';
import { heightAt, moveXZ } from './terrain.js';
import { ELEMENTS } from '../data/elements.js';
import { aceFell } from './aces.js';
import { rollRare } from './powerups.js';
import { procEvent } from './procs.js';
import { POWER } from '../data/powerups.js';
import { CAP, capTake } from './caps.js';
import { takeBuf, freeBuf } from './scratch.js';
import { sourceBracket, affinityBracket, overtimeBracket, sourceClass } from './ledger.js';

export const PICK_XP = 0, PICK_COIN = 1, PICK_HEART = 2;
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
  const el = o.elem || (o.flame ? ELEMENTS.fire.bit : 0), BD = g.bracketDmg, b4 = e.mark[i] > 0 ? targetBracket(MARKS.bonus + g.mods.markBonus) : 1, b1 = mightBracket(g.mods.dmgMult + (g.drumT > 0 ? 0.5 : 0) + (g.buf ? g.buf.might : 0));
  let cls = g.srcClassOf[g.curSrc]; if (cls === undefined) cls = g.srcClassOf[g.curSrc] = sourceClass(g.srcNames[g.curSrc]);
  const b2 = cls >= 0 ? sourceBracket(g.mods.drill[cls]) : 1, b8 = g.otStep > 0 ? overtimeBracket(g.otStep) : 1;
  let b3 = 1; if (el) { let sum = 0, cnt = 0; for (let k = 0; k < 8; k++) if (el & (1 << k)) { sum += g.mods.aff[k]; cnt++; } b3 = affinityBracket(sum / cnt); }
  d *= b4 * b1 * b2 * b3 * b8;                                                    // brackets 4, 1 (knee), 2, 3 and 8: add within a bracket, multiply across
  let crit = 0;
  if (!o.noCrit && g.rc() < FIELD_RULES.critChance + g.mods.crit) { d *= Math.min(K.critCap, K.critBase + g.mods.critDmg); crit = 1; if (g.procs && g.procs.length) procEvent(g, 'crit', { x: e.x[i], y: e.y[i], z: e.z[i] }); }
  if (BD) { const x1 = b1 - 1, x2 = b2 - 1, x3 = b3 - 1, x4 = b4 - 1, x5 = crit ? K.critBase - 1 : 0, x8 = b8 - 1, tot = x1 + x2 + x3 + x4 + x5 + x8; if (tot > 1e-9) { const sh = d / tot; BD[1] += sh * x1; BD[2] += sh * x2; BD[3] += sh * x3; BD[4] += sh * x4; BD[5] += sh * x5; BD[8] += sh * x8; } }       // where the damage came from, for the end-of-run screen (each bracket's share of the extra damage; no logs, so it stays inside the sim's maths rule)
  g.logDealt(d);
  e.hp[i] -= d; e.flash[i] = 0.07; g.emit('hit', d, e.x[i], e.z[i], crit | (el << 1));       // flags for the view: bit 0 crit, bits 1+ element mask
  if (el & ELEMENTS.fire.bit) { e.burn[i] = ELEMENTS.fire.burn.dur + g.mods.burnDur; e.burnDps[i] = ELEMENTS.fire.burn.dps + g.mods.burnDps; }
  const chainAfter = (el & ELEMENTS.lightning.bit) && !o.noChain;
  if (o.kx !== undefined) {
    const l = Math.sqrt(o.kx * o.kx + o.kz * o.kz) || 1, k = o.knock === undefined ? (e.ace[i] ? 0 : CFG.enemy.knock) : o.knock;       // a card hit pushes a swarm enemy 0.4 m away; an Ace is not pushed by it (a named push such as the Gust Ward still moves everything)
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
  const C = ELEMENTS.lightning.chain, e = g.en, buf = takeBuf(), n = g.grid.query(x, z, C.radius, buf);
  let best = -1, bd = C.radius * C.radius;
  for (let k = 0; k < n; k++) { const j = buf[k]; if (j === from || !e.alive[j]) continue; const dx = e.x[j] - x, dz = e.z[j] - z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = j; } }
  freeBuf();
  if (best < 0) return;
  addFx(g, { type: 'bolt', owner: 0, el: 'lightning', x: x, y: e.y[from] + 0.9, z: z, x2: e.x[best], y2: e.y[best] + 0.9, z2: e.z[best], dur: 0.3, seed: best + 1, w: 0.12 });       // the link arc: the record carries the source point as well as the target
  addFx(g, { type: 'ring', owner: 0, el: 'lightning', x: e.x[best], y: e.y[best] + 0.5, z: e.z[best], r: 1.0, dur: 0.2, color: 0x7fe8ff });
  damageEnemy(g, best, dmg, { noCrit: true, noChain: true });
}

export function killEnemy(g, i) {
  const e = g.en; if (!e.alive[i]) return;
  e.alive[i] = 0; g.kills++; g.emit('kill', e.kind[i], e.x[i], e.z[i]);
  if (g.big) { if (g.mods.killHeal > 0 && g.kills % 20 === 0) g.p.hp = Math.min(g.p.maxHp, g.p.hp + g.mods.killHeal); if (g.procs && g.procs.length) procEvent(g, 'kill', { x: e.x[i], y: e.y[i], z: e.z[i] }); } { let cl = g.srcClassOf[g.curSrc]; if (cl === undefined) cl = g.srcClassOf[g.curSrc] = sourceClass(g.srcNames[g.curSrc]); sealKill(g, cl); }
  if (g.mods.bell && g.kills % Math.max(10, Math.floor(K.bellEvery / g.mods.bell)) === 0 && capTake(g, CAP.BELL)) { const prev = g.curSrc; g.curSrc = g.srcIndex('graveyard-bell'); explode(g, e.x[i], e.y[i], e.z[i], 4, 0, K.bellBase, 0xc0c0ff); g.curSrc = prev; }       // Graveyard Bell: its own source, so the toll is the same whoever landed the kill
  const x = e.x[i], y = e.y[i], z = e.z[i], kind = KIND_LIST[e.kind[i]];
  const mg = e.mrg[i];                                                        // enemies merged into this one: their rewards are summed
  dropPickup(g, PICK_XP, x, y, z, 1 + mg);
  for (let k = 0; k <= mg; k++) {
    if (g.rl() < RUN.coinChance * (g.diff.coin || 1) * (g.big ? 1 + (g.stakes || 0) / 300 : 1) || g.frenzyT > 0) dropPickup(g, PICK_COIN, x + 0.6, y, z, (g.t < RUN.coinEarly.until ? RUN.coinEarly.mult : 1) * (g.frenzyT > 0 ? 2 : 1));      // the Coin Rite: every kill pays a coin, worth double       // the quiet first minutes pay a coin worth a few, so the first paid chest opens before 2:00
    if (g.rl() < RUN.heartChance) dropPickup(g, PICK_HEART, x - 0.6, y, z);
  }
  if (g.big && g.rl() < POWER.enemyChance) { const k = rollRare(g); if (k) dropPickup(g, k, x, y, z - 0.6); }       // the big desert: now and then a rare pickup from an ordinary kill
  if (e.ace[i]) aceFell(g, x, y, z);                                          // a star-crested Ace: extra reward and a chance of a Trophy Chest
  if (kind === KINDS.bloat) explode(g, x, y, z, kind.blast.radius, kind.blast.dmg * g.dmgMul, kind.blast.dmg, 0xff9030, 'Sand Bloat');
  if (e.mark[i] > 0 && g.mods.markExplode && g.markDepth < K.explodeDepth && capTake(g, CAP.MARK_EXPLODE)) { g.markDepth++; explode(g, x, y, z, g.mods.markExplode.radius, 0, g.mods.markExplode.dmg, 0xb070ff); g.markDepth--; }       // victims of a mark blast do not blast again (depth), and the bucket holds a tick's worth (K.explodeBudget)
}

export function dropPickup(g, kind, x, y, z, val) {
  const m = g.pick; val = val || 1; const far = kind === PICK_XP && g.srcNames[g.curSrc] !== 'card-throw' ? 1 : 0;
  if (kind === PICK_XP) for (let i = 0; i < m.max; i++) if (m.alive[i] && m.kind[i] === PICK_XP && (m.x[i] - x) ** 2 + (m.z[i] - z) ** 2 < 1.44) { m.val[i] += val; if (far) m.far[i] = 1; return; }       // gems dropped within 1.2 m merge into one
  for (let i = 0; i < m.max; i++) if (!m.alive[i]) { m.alive[i] = 1; m.kind[i] = kind; m.x[i] = x; m.y[i] = y + 0.5; m.z[i] = z; m.val[i] = val; m.age[i] = 0; m.far[i] = far; m.ht[i] = -1; return; }
  if (kind >= 2) { let o = -1, oa = -1; for (let i = 0; i < m.max; i++) if (m.alive[i] && m.kind[i] === PICK_XP && m.age[i] > oa) { oa = m.age[i]; o = i; } if (o >= 0) { g.addXp(m.val[o]); m.kind[o] = kind; m.x[o] = x; m.y[o] = y + 0.5; m.z[o] = z; m.val[o] = val; m.age[o] = 0; m.far[o] = 0; m.ht[o] = -1; return; } }       // a heart or a power-up never vanishes in a full pool: it takes the oldest XP gem's slot and banks that gem's XP
  if (kind === PICK_XP) g.addXp(val);                                    // pool full: bank the XP directly
}

// ---- explosions: hurt the duelist (if pDmg) and every enemy and elite in range (if eDmg) ----
export function explode(g, x, y, z, r, pDmg, eDmg, color, src) {
  if (!(pDmg > 0)) r *= g.reachK;       // Reach scales the player's own area bursts (the Locket nova, the Graveyard Bell, Mark blasts); a hostile blast (it hurts the duelist) never grows
  addFx(g, { type: 'ring', owner: pDmg > 0 ? 1 : 0, x, y, z, r, dur: 0.45, color: color || 0xff9030 });
  const p = g.p;
  if (pDmg > 0) { const dx = p.x - x, dz = p.z - z; if (dx * dx + dz * dz < r * r && Math.abs(p.y - y) < 2.5) g.hurtPlayer(pDmg, true, src || 'an explosion'); }
  if (eDmg > 0) {
    const e = g.en, buf = takeBuf(), n = g.grid.query(x, z, r, buf);       // its own list: a Bloat felled in this loop blasts inside it
    for (let k = 0; k < n; k++) {
      const i = buf[k]; if (!e.alive[i]) continue;
      const dx = e.x[i] - x, dz = e.z[i] - z;
      if (dx * dx + dz * dz < r * r) damageEnemy(g, i, eDmg, { noCrit: true });
    }
    freeBuf();
    for (const sp of g.sp) {
      if (!sp.alive) continue;
      const dx = sp.x - x, dz = sp.z - z;
      if (dx * dx + dz * dz < (r + sp.radius) * (r + sp.radius)) g.damageSpecial(sp, eDmg, x, z, { area: true });
    }
  }
}

export function addFx(g, spec) {
  const list = g.fx;
  for (let i = 0; i < list.length; i++) if (!list[i].on) { Object.assign(list[i], { on: true, t: 0, dur: 0.4, r: 1, arc: 0, dx: 0, dz: 1, color: 0xff9030, owner: 2, el: null }, spec); return list[i]; }
  return null;
}
export function makeFx(n) { const a = []; for (let i = 0; i < n; i++) a.push({ on: false, type: 'ring', owner: 2, el: null, x: 0, y: 0, z: 0, r: 1, arc: 0, dx: 0, dz: 1, t: 0, dur: 0.4, color: 0xff9030 }); return a; }

export { heightAt };



