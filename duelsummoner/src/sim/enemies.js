// Swarm enemies in flat typed arrays. Six kinds, each asking the player to move differently (see data/enemies.js).
import { CFG } from '../data/config.js';
import { atan2, cos, pow, sin } from './dmath.js';
import { KINDS, KIND_LIST } from '../data/enemies.js';
import { RUN } from '../data/waves.js';
import { heightAt } from './terrain.js';
import { steerVec, walk, settle, lineClear } from './steer.js';
import { addTele, killEnemy } from './combat.js';
import { isDashing } from './player.js';
import { MAP } from '../data/map.js';

const HUSK = KINDS.husk.id, RUNNER = KINDS.runner.id, SEER = KINDS.seer.id, GOLEM = KINDS.golem.id, BLOAT = KINDS.bloat.id, SCARAB = KINDS.scarab.id;
export const KIND_ID = Object.fromEntries(Object.keys(KINDS).map(k => [k, KINDS[k].id]));

export function makeEnemies(max) {
  const f = () => new Float32Array(max);
  return {
    max, alive: new Uint8Array(max), kind: new Uint8Array(max), st: new Uint8Array(max),
    x: f(), y: f(), z: f(), vy: f(), hp: f(), atk: f(), flash: f(), face: f(), spd: f(), dx: f(), dz: f(),
    stT: f(), ax: f(), az: f(), mark: f(), burn: f(), burnDps: f(), root: f(),
    px: f(), py: f(), pz: f(), pface: f(),                      // previous tick, for smooth drawing
    mrg: new Uint8Array(max), size: f()                         // enemies merged into this one past the cap, and its size factor (1 to 1.5)
  };
}
export function enemyCount(e) { let c = 0; for (let i = 0; i < e.max; i++) c += e.alive[i]; return c; }

export function spawnRate(t) {
  const T = RUN.rate;
  if (t <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (t <= T[i][0]) { const a = T[i - 1], b = T[i]; return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]); }
  return T[T.length - 1][1];
}

// Pick a spot 22 to 30 m from the duelist on standable ground. Returns false if none found.
function ringSpot(g, out) {
  const S = CFG.spawn, p = g.p;
  for (let k = 0; k < S.tries; k++) {
    const a = g.rsp() * Math.PI * 2, d = S.min + g.rsp() * (S.max - S.min);
    const x = p.x + cos(a) * d, z = p.z + sin(a) * d, h = heightAt(x, z);
    if (h >= 50) continue;
    out.x = x; out.z = z; out.y = h; return true;
  }
  return false;
}
export function spotNear(g, out) { return ringSpot(g, out); }

const spot = { x: 0, y: 0, z: 0 };
function put(g, i, x, y, z, kind) {
  const e = g.en;
  e.x[i] = e.px[i] = x; e.y[i] = e.py[i] = y; e.z[i] = e.pz[i] = z; e.vy[i] = 0;
  if (KIND_LIST[kind].fly) e.y[i] = e.py[i] = y + KIND_LIST[kind].hover;
}

// Past the enemy cap a new spawn does not appear: it merges into the nearest enemy of the same kind. That enemy gains the merged HP, grows up
// (to 1.5x) and drops the summed reward when it dies, so the total HP and reward are kept while the screen stays readable.
export function mergeEnemy(g, kindName) {
  const e = g.en, K = KINDS[kindName || 'husk'];
  if (!ringSpot(g, spot)) return false;
  let best = -1, bd = 1e18;
  for (let i = 0; i < e.max; i++) if (e.alive[i] && e.kind[i] === K.id) { const dx = e.x[i] - spot.x, dz = e.z[i] - spot.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
  if (best < 0) return false;
  const ot = K === KINDS.hunter ? Math.max(0, g.otStep || 0) : 0;
  e.hp[best] += K.hp * g.hpMul * pow(RUN.overtime.hpGrowth, ot);
  if (e.mrg[best] < 255) e.mrg[best]++;
  e.size[best] = 1 + Math.min(0.5, 0.05 * e.mrg[best]);
  g.merged = (g.merged || 0) + 1;
  return true;
}
// kindName: 'husk' ... 'scarab'. at: optional {x,z}; otherwise a spot on the spawn ring.
export function spawnEnemy(g, kindName, at) {
  const e = g.en, K = KINDS[kindName || 'husk'];
  let slot = -1;
  for (let i = 0; i < e.max; i++) if (!e.alive[i]) { slot = i; break; }
  if (slot < 0) return false;
  if (at) { const h = heightAt(at.x, at.z); if (h >= 50) return false; spot.x = at.x; spot.z = at.z; spot.y = h; }
  else if (!ringSpot(g, spot)) return false;
  put(g, slot, spot.x, spot.y, spot.z, K.id);
  e.alive[slot] = 1; e.kind[slot] = K.id; e.st[slot] = 0; e.stT[slot] = K.id === SEER ? 1.2 : K.id === GOLEM ? 2 : 0;
  const ot = K === KINDS.hunter ? Math.max(0, g.otStep || 0) : 0, O = RUN.overtime;
  e.mrg[slot] = 0; e.size[slot] = 1;
  e.hp[slot] = K.hp * g.hpMul * pow(O.hpGrowth, ot); e.atk[slot] = 0.4; e.flash[slot] = 0; e.mark[slot] = 0; e.burn[slot] = 0; e.root[slot] = 0;
  e.spd[slot] = K.speed * (1 + (g.rsp() * 2 - 1) * CFG.enemy.speedJitter) * g.speedMul * Math.min(O.speedCap, pow(O.speedGrowth, ot));
  e.dx[slot] = 0; e.dz[slot] = 0; e.face[slot] = e.pface[slot] = 0;
  g.spawned++;
  return true;
}

const o = { x: 0, y: 0, z: 0, vy: 0, dx: 0, dz: 0 }, sv = { x: 0, z: 0, d: 0, direct: true };

export function updateEnemies(g, dt) {
  const e = g.en, p = g.p, E = CFG.enemy, mul = g.dmgMul;
  for (let i = 0; i < e.max; i++) {
    if (!e.alive[i]) continue;
    const K = KIND_LIST[e.kind[i]], kid = e.kind[i];
    o.x = e.x[i]; o.y = e.y[i]; o.z = e.z[i]; o.vy = e.vy[i]; o.dx = e.dx[i]; o.dz = e.dz[i];

    if (e.mark[i] > 0) e.mark[i] -= dt;
    if (e.flash[i] > 0) e.flash[i] -= dt;
    if (e.burn[i] > 0) { e.burn[i] -= dt; e.hp[i] -= e.burnDps[i] * dt; if (e.hp[i] <= 0) { killEnemy(g, i); continue; } }
    const rooted = e.root[i] > 0; if (rooted) e.root[i] -= dt;

    let dx = p.x - o.x, dz = p.z - o.z, d = Math.sqrt(dx * dx + dz * dz) || 0.001;
    if (d > E.relocateDist && spotNear(g, spot)) {                // fell behind: jump back to the spawn ring
      put(g, i, spot.x, spot.y, spot.z, kid); e.st[i] = 0;
      o.x = e.x[i]; o.y = e.y[i]; o.z = e.z[i]; o.vy = 0;
      dx = p.x - o.x; dz = p.z - o.z; d = Math.sqrt(dx * dx + dz * dz) || 0.001;
    }
    const spd = rooted ? 0 : e.spd[i];
    let touching = false;

    switch (kid) {
      case SCARAB: {                                                // flyer: ignores walls and height
        const k = Math.min(1, dt * 10);
        e.dx[i] += (dx / d - e.dx[i]) * k; e.dz[i] += (dz / d - e.dz[i]) * k;
        o.x += e.dx[i] * spd * dt; o.z += e.dz[i] * spd * dt;
        const ty = Math.max(p.y + K.hover + sin(g.t * 3 + i) * 0.3, heightAt(o.x, o.z) + 0.6);
        o.y += (ty - o.y) * Math.min(1, dt * 3);
        const r = Math.sqrt(o.x * o.x + o.z * o.z); if (r > MAP.boundaryR - 1) { o.x *= (MAP.boundaryR - 1) / r; o.z *= (MAP.boundaryR - 1) / r; }
        touching = d < K.reach && Math.abs(p.y + 0.9 - o.y) < 1.6;
        o.dx = e.dx[i]; o.dz = e.dz[i];
        break;
      }
      case SEER: {
        const S = K.shot;
        if (e.st[i] === 1) {                                        // telegraph: stand still, then fire along the locked line
          e.stT[i] -= dt;
          if (e.stT[i] <= 0) { g.fireBolt(o.x, o.y + 1.0, o.z, e.ax[i] * S.speed, e.az[i] * S.speed, S.life, S.dmg * mul, S.radius, 'Glass Seer bolt'); e.st[i] = 0; e.stT[i] = S.every; }
          break;
        }
        e.stT[i] -= dt;
        steerVec(g, o, p.x, p.y, p.z, sv);
        if (d > S.keepMax) walk(o, sv.x, sv.z, spd, dt, K.radius, E.stepUp);
        else if (d < S.keepMin) walk(o, -dx / d, -dz / d, spd, dt, K.radius, E.stepUp);
        if (e.stT[i] <= 0 && d < S.range && lineClear(o.x, o.z, p.x, p.z, o.y)) {
          e.ax[i] = dx / d; e.az[i] = dz / d; e.st[i] = 1; e.stT[i] = S.telegraph;
          addTele(g.tele, { type: 0, x: o.x, y: o.y, z: o.z, dx: e.ax[i], dz: e.az[i], len: S.speed * S.life, w: S.width, dur: S.telegraph });
        }
        break;
      }
      case GOLEM: {
        const R = K.rush;
        if (e.st[i] === 1) {                                        // marked lane: leave it within 1 s
          e.stT[i] -= dt;
          if (e.stT[i] <= 0) { e.st[i] = 2; e.stT[i] = R.duration; e.atk[i] = 0; }
          break;
        }
        if (e.st[i] === 2) {
          e.stT[i] -= dt;
          o.dx = e.ax[i]; o.dz = e.az[i];
          const b = walk(o, e.ax[i], e.az[i], R.speed, dt, K.radius, E.stepUp); o.dx = e.ax[i]; o.dz = e.az[i];
          if (e.atk[i] <= 0 && d < K.reach + 0.5 && Math.abs(p.y - o.y) < E.vReach) { e.atk[i] = 5; g.hurtPlayer(R.dmg * mul, true, 'Ram Golem rush'); }   // 5 s marker: one hit per rush
          if (e.stT[i] <= 0 || b) { e.st[i] = 0; e.stT[i] = R.cooldown; }
          break;
        }
        e.stT[i] -= dt;
        steerVec(g, o, p.x, p.y, p.z, sv);
        if (!(sv.direct && d < K.reach * 0.8)) walk(o, sv.x, sv.z, spd, dt, K.radius, E.stepUp);
        if (e.stT[i] <= 0 && d < R.trigger && Math.abs(p.y - o.y) < 1.5 && lineClear(o.x, o.z, p.x, p.z, o.y)) {
          e.ax[i] = dx / d; e.az[i] = dz / d; e.st[i] = 1; e.stT[i] = R.telegraph;
          addTele(g.tele, { type: 0, x: o.x, y: o.y, z: o.z, dx: e.ax[i], dz: e.az[i], len: R.speed * R.duration, w: R.width, dur: R.telegraph });
        }
        break;
      }
      case BLOAT: {
        const B = K.blast;
        if (e.st[i] === 1) {                                        // fuse lit: blast circle is shown on the ground
          e.stT[i] -= dt;
          if (e.stT[i] <= 0) { e.alive[i] = 0; g.explodeAt(o.x, o.y, o.z, B.radius, B.dmg * mul, B.dmg, 'Sand Bloat'); }
          break;
        }
        steerVec(g, o, p.x, p.y, p.z, sv);
        walk(o, sv.x, sv.z, spd, dt, K.radius, E.stepUp);
        if (d < B.trigger && Math.abs(p.y - o.y) < 2) {
          e.st[i] = 1; e.stT[i] = B.fuse;
          addTele(g.tele, { type: 1, x: o.x, y: o.y, z: o.z, r: B.radius, dur: B.fuse, color: 0xff7a20 });
        }
        break;
      }
      default: {                                                   // husk, runner
        steerVec(g, o, p.x, p.y, p.z, sv);
        if (!(sv.direct && d < K.reach * 0.8)) walk(o, sv.x, sv.z, spd, dt, K.radius, E.stepUp);
        touching = d < K.reach && Math.abs(p.y - o.y) < E.vReach;
      }
    }

    // keep the pack from stacking: push away from close neighbours (swarm only; flyers pass over)
    if (kid !== SCARAB) {
      const nc = g.grid.query(o.x, o.z, E.separation, g.nearBuf2);
      let px = 0, pz = 0;
      for (let n = 0; n < nc; n++) {
        const j = g.nearBuf2[n]; if (j === i || !e.alive[j] || e.kind[j] === SCARAB) continue;
        const ox = o.x - e.x[j], oz = o.z - e.z[j], od = ox * ox + oz * oz;
        if (od < E.separation * E.separation && od > 1e-6) { const q = Math.sqrt(od), push = (E.separation - q) * 0.5; px += ox / q * push; pz += oz / q * push; }
      }
      if (px !== 0 || pz !== 0) walk2(o, px, pz, K.radius);
      settle(o, dt);
    }
    e.x[i] = o.x; e.y[i] = o.y; e.z[i] = o.z; e.vy[i] = o.vy;
    if (kid !== GOLEM || e.st[i] !== 2) { e.dx[i] = o.dx; e.dz[i] = o.dz; }
    if (e.st[i] !== 1 || kid === SEER || kid === GOLEM) e.face[i] = kid === GOLEM && e.st[i] === 2 ? atan2(e.ax[i], e.az[i]) : atan2(dx, dz);

    // touch damage: 0.9 s per enemy, plus the 0.25 s shared grace
    e.atk[i] -= dt; if (e.atk[i] < -1) e.atk[i] = -1;
    if (touching && K.touch > 0 && e.atk[i] <= 0 && g.grace <= 0 && !isDashing(p) && !g.over) { e.atk[i] = E.attackCd; g.hurtPlayer(K.touch * mul, false, K.name); }
  }
}

import { moveXZ } from './terrain.js';
function walk2(o, px, pz, radius) { moveXZ(o, px, pz, radius, CFG.enemy.stepUp); }


