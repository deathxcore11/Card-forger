// Shared ground movement for swarm enemies, elites and the boss: flow-field steering, walking, settling on the floor.
import { CFG } from '../data/config.js';
import { heightAt, moveXZ } from './terrain.js';
import { resolveColliders } from './colliders.js';

const tgt = { x: 0, z: 0 };

export function lineClear(x0, z0, x1, z1, y) {
  const dx = x1 - x0, dz = z1 - z0, d = Math.sqrt(dx * dx + dz * dz), n = Math.ceil(d / 1.5);
  let prev = y;
  for (let k = 1; k < n; k++) {
    const h = heightAt(x0 + dx * k / n, z0 + dz * k / n);
    if (h > prev + 0.6) return false;
    prev = Math.max(h, y - 0.1);
  }
  return true;
}

// o: { x, y, z, vy, dx, dz }. Sets out.x/out.z to a unit steering vector toward (px,pz) and out.d to the distance.
export function steerVec(g, o, px, py, pz, out) {
  const E = CFG.enemy, dx = px - o.x, dz = pz - o.z, d = Math.sqrt(dx * dx + dz * dz) || 0.001;
  out.d = d; out.x = dx / d; out.z = dz / d; out.direct = true;
  if (!(d < E.directRange && Math.abs(py - o.y) < 1.0 && lineClear(o.x, o.z, px, pz, o.y))) {
    if (g.flow.next(o.x, o.z, tgt)) {
      const fx = tgt.x - o.x, fz = tgt.z - o.z, fl = Math.sqrt(fx * fx + fz * fz) || 1;
      out.x = fx / fl; out.z = fz / fl; out.direct = false;
    }
  }
}

// Turn toward the wanted direction a little each tick, then move with wall sliding.
export function walk(g, o, sx, sz, spd, dt, radius, stepUp) {
  const k = Math.min(1, dt * 10);
  o.dx += (sx - o.dx) * k; o.dz += (sz - o.dz) * k;
  const b = moveXZ(o, o.dx * spd * dt, o.dz * spd * dt, radius, stepUp);
  if (g.colliders) { o.vx = o.dx * spd; o.vz = o.dz * spd; resolveColliders(g.colliders, o, radius); o.dx = o.vx / (spd || 1); o.dz = o.vz / (spd || 1); }       // solid props push enemies out as they do the duelist
  return b;
}

// Snap to gentle ground, fall off ledges.
export function settle(o, dt) {
  const h = heightAt(o.x, o.z);
  if (o.y - h < 0.3 && o.vy <= 0) { o.y = h; o.vy = 0; }
  else if (h > o.y) { o.y = h; o.vy = 0; }
  else { o.vy -= CFG.gravity * dt; o.y += o.vy * dt; if (o.y <= h) { o.y = h; o.vy = 0; } }
}
