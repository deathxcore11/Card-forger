// Player-side projectiles (cards, fire lines, fireballs, homing bolts), enemy bolts, and pickups.
import { CFG } from '../data/config.js';
import { RUN } from '../data/waves.js';
import { heightAt, moveXZ } from './terrain.js';
import { damageEnemy, explode, addFx, PICK_XP, PICK_COIN, PICK_HEART } from './combat.js';
import { breakVasesNear } from './world.js';
import { sin, cos, atan2 } from './dmath.js';

export const KIND_CARD = 0, KIND_FIRE = 1, KIND_LOB = 2, KIND_HOMING = 3;
const MAXHITS = 6;

export function makeShots(max) {
  const f = () => new Float32Array(max);
  return { max, alive: new Uint8Array(max), kind: new Uint8Array(max), flame: new Uint8Array(max), pierce: new Int8Array(max), nHit: new Uint8Array(max), hits: new Int32Array(max * MAXHITS),
    src: new Uint8Array(max), x: f(), y: f(), z: f(), vx: f(), vy: f(), vz: f(), life: f(), dmg: f(), splash: f(), tx: f(), tz: f(), t0: f(), dur: f(), target: new Int32Array(max), speed: f(),
    px: f(), py: f(), pz: f() };
}
export function makePickups(max) { return { max, alive: new Uint8Array(max), kind: new Uint8Array(max), val: new Float32Array(max), x: new Float32Array(max), y: new Float32Array(max), z: new Float32Array(max), age: new Float32Array(max), far: new Uint8Array(max), ht: new Float32Array(max).fill(-1), hd: new Float32Array(max) }; }
export function makeBolts(max) { const a = []; for (let i = 0; i < max; i++) a.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vz: 0, life: 0, dmg: 0, r: 0.9, px: 0, pz: 0 }); return a; }

function slot(s) { for (let i = 0; i < s.max; i++) if (!s.alive[i]) return i; return -1; }
function init(s, i, kind, x, y, z, flame, dmg) {
  s.alive[i] = 1; s.kind[i] = kind; s.x[i] = s.px[i] = x; s.y[i] = s.py[i] = y; s.z[i] = s.pz[i] = z; s.flame[i] = flame | 0; s.dmg[i] = dmg; s.nHit[i] = 0; s.pierce[i] = 0; s.target[i] = -1; s.vx[i] = s.vy[i] = s.vz[i] = 0;
}

// straight shot at a point (card throw, fire line)
export function fireShot(g, kind, x, y, z, tx, ty, tz, speed, life, dmg, o) {
  const s = g.shots, i = slot(s); if (i < 0) return -1;
  o = o || {}; init(s, i, kind, x, y, z, o.flame, dmg); s.src[i] = g.curSrc;
  const dx = tx - x, dy = ty - y, dz = tz - z, l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  s.vx[i] = dx / l * speed; s.vy[i] = dy / l * speed; s.vz[i] = dz / l * speed; s.life[i] = life; s.pierce[i] = o.pierce || 0; s.speed[i] = speed;
  return i;
}
export function fireLob(g, x, y, z, tx, tz, flight, dmg, splash, flame) {
  const s = g.shots, i = slot(s); if (i < 0) return -1;
  init(s, i, KIND_LOB, x, y, z, flame, dmg); s.src[i] = g.curSrc;
  s.tx[i] = tx; s.tz[i] = tz; s.t0[i] = 0; s.dur[i] = flight; s.splash[i] = splash; s.life[i] = flight + 0.5; s.vx[i] = x; s.vz[i] = z; s.vy[i] = y;   // vx,vz,vy hold the start point
  return i;
}
export function fireHoming(g, x, y, z, target, speed, life, dmg, sp) {       // sp: an elite or boss to chase (target is then -2 - its index in g.sp)
  const s = g.shots, i = slot(s); if (i < 0) return -1;
  init(s, i, KIND_HOMING, x, y, z, false, dmg); s.src[i] = g.curSrc;
  s.target[i] = sp ? -2 - g.sp.indexOf(sp) : target; s.speed[i] = speed; s.life[i] = life; s.vy[i] = 0;
  const e = g.en; let dx = (sp ? sp.x : e.x[target]) - x, dz = (sp ? sp.z : e.z[target]) - z; const l = Math.sqrt(dx * dx + dz * dz) || 1; s.vx[i] = dx / l * speed; s.vz[i] = dz / l * speed;
  return i;
}

const near = new Int32Array(CFG.enemy.max);

export function updateShots(g, dt) {
  const s = g.shots, e = g.en;
  for (let i = 0; i < s.max; i++) {
    if (!s.alive[i]) continue;
    g.curSrc = s.src[i];
    s.px[i] = s.x[i]; s.py[i] = s.y[i]; s.pz[i] = s.z[i];
    s.life[i] -= dt;
    const kind = s.kind[i];
    if (kind === KIND_LOB) {
      s.t0[i] += dt; const t = Math.min(1, s.t0[i] / s.dur[i]);
      s.x[i] = s.vx[i] + (s.tx[i] - s.vx[i]) * t; s.z[i] = s.vz[i] + (s.tz[i] - s.vz[i]) * t;
      s.y[i] = s.vy[i] + (heightAt(s.tx[i], s.tz[i]) + 0.3 - s.vy[i]) * t + 4 * 3 * t * (1 - t);
      if (t >= 1) {
        s.alive[i] = 0;
        splash(g, s.tx[i], heightAt(s.tx[i], s.tz[i]), s.tz[i], s.splash[i], s.dmg[i], s.flame[i]);
      }
      continue;
    }
    if (kind === KIND_HOMING) {
      let t = s.target[i]; const tsp = t <= -2 ? g.sp[-2 - t] : null;
      if (tsp && tsp.alive && !tsp.dead) {           // chasing an elite or boss
        const dx = tsp.x - s.x[i], dz = tsp.z - s.z[i], l = Math.sqrt(dx * dx + dz * dz) || 1, k = Math.min(1, dt * 9);
        s.vx[i] += (dx / l * s.speed[i] - s.vx[i]) * k; s.vz[i] += (dz / l * s.speed[i] - s.vz[i]) * k;
        s.vy[i] += ((tsp.y + 1.2 - s.y[i]) / l * s.speed[i] - s.vy[i]) * k;
      } else {
      if (t < 0 || !e.alive[t]) { t = g.nearest(s.x[i], s.z[i], 30); s.target[i] = t; }
      if (t >= 0) {
        const dx = e.x[t] - s.x[i], dz = e.z[t] - s.z[i], l = Math.sqrt(dx * dx + dz * dz) || 1, k = Math.min(1, dt * 9);
        s.vx[i] += (dx / l * s.speed[i] - s.vx[i]) * k; s.vz[i] += (dz / l * s.speed[i] - s.vz[i]) * k;
        s.vy[i] += ((e.y[t] + 0.9 - s.y[i]) / l * s.speed[i] - s.vy[i]) * k;
      }
      }
    }
    s.x[i] += s.vx[i] * dt; s.y[i] += s.vy[i] * dt; s.z[i] += s.vz[i] * dt;
    if (s.life[i] <= 0 || s.y[i] < heightAt(s.x[i], s.z[i])) { s.alive[i] = 0; continue; }
    breakVasesNear(g, s.x[i], s.z[i], 0.9);
    const hr = CFG.card.hitRadius;
    const nc = g.grid.query(s.x[i], s.z[i], hr + 0.5, near);
    let dead = false;
    for (let n = 0; n < nc && !dead; n++) {
      const j = near[n]; if (!e.alive[j]) continue;
      const hx = e.x[j] - s.x[i], hz = e.z[j] - s.z[i];
      if (hx * hx + hz * hz < hr * hr && Math.abs(e.y[j] + 0.9 - s.y[i]) < 1.5) {
        let seen = false; for (let h = 0; h < s.nHit[i]; h++) if (s.hits[i * MAXHITS + h] === j) { seen = true; break; }
        if (seen) continue;
        damageEnemy(g, j, s.dmg[i], { elem: s.flame[i], kx: s.vx[i], kz: s.vz[i] });
        if (s.nHit[i] < MAXHITS) s.hits[i * MAXHITS + s.nHit[i]++] = j;
        if (s.pierce[i] > 0) s.pierce[i]--; else dead = true;
      }
    }
    if (!dead) for (const sp of g.sp) {                                // elites and the boss
      if (!sp.alive || sp.dead) continue;
      const hx = sp.x - s.x[i], hz = sp.z - s.z[i], r = sp.radius + 0.4;
      if (hx * hx + hz * hz < r * r && s.y[i] > sp.y - 0.3 && s.y[i] < sp.y + Math.max(3, sp.size || 0)) {
        const l = Math.sqrt(s.vx[i] * s.vx[i] + s.vz[i] * s.vz[i]) || 1;
        g.damageSpecial(sp, s.dmg[i], sp.x - s.vx[i] / l * 5, sp.z - s.vz[i] / l * 5, { elem: s.flame[i] });   // attacker is "behind" the shot
        dead = true; break;
      }
    }
    if (dead) s.alive[i] = 0;
  }
  g.curSrc = 0;
}

export function splash(g, x, y, z, r, dmg, flame) {
  addFx(g, { type: 'ring', x, y, z, r, dur: 0.35, color: (flame & 1) ? 0xff8a30 : 0x7fe8ff });
  breakVasesNear(g, x, z, r);
  const e = g.en, nc = g.grid.query(x, z, r, near);
  for (let k = 0; k < nc; k++) { const j = near[k]; if (!e.alive[j]) continue; const dx = e.x[j] - x, dz = e.z[j] - z; if (dx * dx + dz * dz < r * r) damageEnemy(g, j, dmg, { elem: flame }); }
  for (const sp of g.sp) if (sp.alive && !sp.dead) { const dx = sp.x - x, dz = sp.z - z; if (dx * dx + dz * dz < (r + sp.radius) * (r + sp.radius)) g.damageSpecial(sp, dmg, x, z, { area: true, elem: flame }); }
}

// ---- enemy bolts ----
export function updateBolts(g, dt) {
  const p = g.p;
  for (const b of g.eb) {
    if (!b.on) continue;
    b.px = b.x; b.pz = b.z;
    b.life -= dt; b.x += b.vx * dt; b.z += b.vz * dt;
    if (b.life <= 0 || heightAt(b.x, b.z) > b.y + 0.4) { b.on = false; continue; }
    const dx = p.x - b.x, dz = p.z - b.z;
    if (dx * dx + dz * dz < b.r * b.r && Math.abs(p.y + 0.9 - b.y) < 1.4) { b.on = false; g.hurtPlayer(b.dmg, true, b.src); }
  }
}

// ---- pickups: crystals, coins, hearts ----
const MAG = { x: 0, y: 0, z: 0 }, FLY_AFTER = 1.5, MAG_SETTLE = 0.28;
export function updatePickups(g, dt) {
  const m = g.pick, p = g.p, range = CFG.xp.magnet * (1 + g.mods.pickup) * (g.frenzyT > 0 ? 2 : 1);
  for (let i = 0; i < m.max; i++) {
    if (!m.alive[i]) continue;
    m.age[i] += dt;
    const dx = p.x - m.x[i], dz = p.z - m.z[i], d = Math.sqrt(dx * dx + dz * dz) || 0.001;
    // XP from a kill by one of your monsters (or a trap, a spell) is out of walking reach: after 1.5 s it flies to the duelist from anywhere, faster the longer it waits, and is banked after 6 s
    const flying = m.far[i] && m.age[i] > FLY_AFTER && m.kind[i] === PICK_XP;
    if (flying && m.age[i] > 6) { m.x[i] = p.x; m.z[i] = p.z; m.y[i] = p.y + 1; }
    if (flying) {
      const o = MAG; o.x = m.x[i]; o.y = m.y[i]; o.z = m.z[i];
      const sp = Math.min(34, 12 + 10 * (m.age[i] - FLY_AFTER));                 // a short speed-up as it flies in
      moveXZ(o, dx / d * sp * dt, dz / d * sp * dt, 0.1, 12);   // never climbs a wall taller than 12 m
      m.x[i] = o.x; m.z[i] = o.z;
      const hh = heightAt(o.x, o.z); if (hh < 50) m.y[i] = Math.max(hh, 0) + 0.5;   // keep the old height over a wall cell
    } else if (m.age[i] > MAG_SETTLE && (m.ht[i] >= 0 || (d < range && Math.abs(p.y - m.y[i]) < 3 + range * 0.3))) {
      // the magnet curve (feedback-feel 3.3): a drop newer than 280 ms ignores the magnet; on entering range it hops 0.6 m over 120 ms, then flies at v = min(32, 6 + 60 t) m/s from the hop, steering
      // toward the duelist at up to 14 rad/s so the path curves; never slower than the duelist's own speed + 6, so it can always catch a fast runner. Walls still stop it (12 m step).
      if (m.ht[i] < 0) { m.ht[i] = 0; m.hd[i] = atan2(dx, dz); }
      const t0 = m.ht[i]; m.ht[i] = t0 + dt; const t = m.ht[i];
      let da = atan2(dx, dz) - m.hd[i]; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; const turn = 14 * dt; m.hd[i] += da > turn ? turn : da < -turn ? -turn : da;
      let v = Math.min(32, 6 + 60 * t); const pv = Math.sqrt(p.vx * p.vx + p.vz * p.vz) + 6; if (v < pv) v = pv;
      const o = MAG; o.x = m.x[i]; o.y = m.y[i]; o.z = m.z[i];
      moveXZ(o, sin(m.hd[i]) * v * dt, cos(m.hd[i]) * v * dt, 0.1, 12);
      m.x[i] = o.x; m.z[i] = o.z;
      const hh = heightAt(o.x, o.z), outQ = u => 1 - (1 - u) * (1 - u), hop = 0.6 * (outQ(Math.min(1, t / 0.12)) - outQ(Math.min(1, t0 / 0.12)));
      if (hh < 50) { const ty = p.y + 1.0, k = Math.min(1, v * dt / Math.max(d, 0.4)); m.y[i] += (ty - m.y[i]) * k + hop; if (m.y[i] < Math.max(hh, 0) + 0.3) m.y[i] = Math.max(hh, 0) + 0.3; }       // it rises to the chest point as it closes in
    }
    if (d < CFG.xp.pick && (Math.abs(p.y + 1 - m.y[i]) < 2.5 || flying)) {
      m.alive[i] = 0; g.emit('pickup', m.kind[i], m.val[i]);
      addFx(g, { type: 'ring', x: m.x[i], y: m.y[i] - 0.3, z: m.z[i], r: 0.9, dur: 0.25, color: m.kind[i] === PICK_XP ? 0xd79af0 : 0xffe080 });   // sparkle on collect
      if (m.kind[i] === PICK_XP) g.addXp(m.val[i]);
      else if (m.kind[i] === PICK_COIN) { g.coinFrac += (m.val[i] || 1) * (1 + g.mods.coinMult); const w = Math.floor(g.coinFrac); g.coins += w; g.coinsGained = (g.coinsGained || 0) + w; g.coinFrac -= w; }
      else if (m.kind[i] === PICK_HEART) p.hp = Math.min(p.maxHp, p.hp + RUN.heartHeal);
    }
  }
}
export { explode };


