// Items that do something when something happens (the rare, epic and legendary ones of the big desert). One engine, table driven: an item carries `proc: { on, every | chance | cd, fx }`.
//   triggers (on): kill, crit, hurt, dash, level, chest, vase, pickup, tick (every N seconds), cond (while a condition holds: lowhp, full, still, moving, swarm, alone)
//   effects (fx):  nova {dmg, r}, heal {n}, ward {n}, coins {n}, xp {n}, haste {amt, t}, might {amt, t}, stop {t}, pickup {kind | rare}, magnet {}, dashReset {}, rumour {}, shot {n}
// A second copy of an item makes it stronger: the number of copies multiplies `n`, `dmg`, `amt` and `chance` (never `every`). State (counters, cooldowns) is on g.procState. Only the big desert has procs.
import { ITEMS } from '../data/items.js';
import { explode, dropPickup } from './combat.js';
import { collectPowerup, rollRare } from './powerups.js';
import { PICK } from '../data/powerups.js';

// the list of live procs, rebuilt when the items change (recompute calls this)
export function buildProcs(g) {
  const out = [], seen = new Map();
  for (const id of (g.items || [])) { const it = ITEMS[id]; if (!it || !it.proc) continue; seen.set(id, (seen.get(id) || 0) + 1); }
  for (const [id, n] of seen) out.push({ id, n, p: ITEMS[id].proc, name: ITEMS[id].name });
  g.procs = out; if (!g.procState) g.procState = {};
}
const st = (g, pr) => g.procState[pr.id] || (g.procState[pr.id] = { c: 0, cd: 0, t: 0 });
const cnt = pr => pr.n;
function fire(g, pr, at) {
  const f = pr.p.fx, n = cnt(pr), p = g.p, x = at ? at.x : p.x, y = at ? at.y : p.y, z = at ? at.z : p.z;
  if (f.nova) explode(g, x, y, z, f.nova.r, 0, f.nova.dmg * n * (g.dmgMul ? 1 : 1), 0xffd56a, pr.name);
  if (f.heal) p.hp = Math.min(p.maxHp, p.hp + f.heal * n);
  if (f.healPct) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * f.healPct * n);
  if (f.ward) g.wardHits = Math.min(6, (g.wardHits | 0) + f.ward * n);
  if (f.coins) { g.coinFrac += f.coins * n; const w = Math.floor(g.coinFrac); g.coins += w; g.coinsGained = (g.coinsGained | 0) + w; g.coinFrac -= w; }
  if (f.xp) g.addXp(f.xp * n);
  if (f.haste) addTimed(g, 'haste', f.haste.amt * n, f.haste.t);
  if (f.might) addTimed(g, 'might', f.might.amt * n, f.might.t);
  if (f.stop) g.stopT = Math.max(g.stopT || 0, f.stop.t);
  if (f.pickup) { const k = f.pickup.kind || rollRare(g); if (k) dropPickup(g, k, x, y, z + 0.8); }
  if (f.magnet) collectPowerup(g, PICK.LODE, 1);
  if (f.dashReset) p.dashCd = 0;
  if (f.rumour) collectPowerup(g, PICK.RUMOUR, 1);
  g.event('procfx', pr.name);
}
// a timed buff: kind 'haste' (move speed) or 'might' (damage); the biggest running one counts
function addTimed(g, kind, amt, t) { const L = g.timed || (g.timed = []), e = L.find(q => q.kind === kind && q.amt === amt); if (e) e.t = Math.max(e.t, t); else L.push({ kind, amt, t }); }
export function procEvent(g, on, at) {
  const L = g.procs; if (!L || !L.length) return;
  for (const pr of L) {
    const P = pr.p; if (P.on !== on) continue; const s = st(g, pr);
    if (P.every) { s.c++; if (s.c < P.every) continue; s.c = 0; }
    else if (P.chance) { if (g.rl() >= Math.min(0.9, P.chance * cnt(pr))) continue; }
    if (P.cd) { if (s.cd > 0) continue; s.cd = P.cd; }
    fire(g, pr, at);
  }
}
const COND = { lowhp: g => g.p.hp < g.p.maxHp * 0.35, full: g => g.p.hp >= g.p.maxHp - 0.01, still: g => g.p.speedXZ < 0.3, moving: g => g.p.speedXZ > 4, swarm: g => g.nearCount >= 8, alone: g => g.nearCount === 0 };
export function procTick(g, dt) {
  const L = g.procs, p = g.p; g.buf = g.buf || { might: 0, haste: 0 }; g.buf.might = 0; g.buf.haste = 0;
  if (g.timed && g.timed.length) { for (let i = g.timed.length - 1; i >= 0; i--) { const q = g.timed[i]; q.t -= dt; if (q.t <= 0) g.timed.splice(i, 1); else if (q.amt > g.buf[q.kind]) g.buf[q.kind] = q.amt; } }
  if (!L || !L.length) return;
  p.speedXZ = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
  let near = 0; if (L.some(q => q.p.cond === 'swarm' || q.p.cond === 'alone')) { const e = g.en; for (let i = 0; i < e.max; i++) if (e.alive[i] && (e.x[i] - p.x) ** 2 + (e.z[i] - p.z) ** 2 < 144) near++; } g.nearCount = near;
  for (const pr of L) {
    const P = pr.p, s = st(g, pr); if (s.cd > 0) s.cd -= dt;
    if (P.on === 'tick') { s.t += dt; if (s.t >= P.every) { s.t = 0; fire(g, pr); } }
    else if (P.cond) {      // while the condition holds the effect is a standing buff (might, haste) re-set every tick, or a slow trickle (heal)
      const c = COND[P.cond]; if (!c || !c(g)) continue; const f = P.fx, n = cnt(pr);
      if (f.might) g.buf.might = Math.max(g.buf.might, f.might.amt * n); if (f.haste) g.buf.haste = Math.max(g.buf.haste, f.haste.amt * n);
      if (f.heal) p.hp = Math.min(p.maxHp, p.hp + f.heal * n * dt); if (f.ward && s.cd <= 0) { s.cd = P.cd || 15; g.wardHits = Math.min(6, (g.wardHits | 0) + f.ward * n); }
    }
  }
}
