// The exit door of the big desert. It is not on the map at the start. Between doorRise[0] and doorRise[1] on the stage clock (seeded from the run seed and the stage) it rises out of the sand at a boss ring 150 to 300 m
// from wherever the duelist is, behind a ridge or a mesa where there is one, always on ground the starting kit can walk to. A slim banner and a rumble say it has risen: there is no beam and no map pin (the fog shows it
// once it is seen; the red wind near it, view/threads.js, leads the last 90 m). Each elite or mini boss felled makes it rise 30 s sooner, never before 6:00. Waking it is still hold-to-wake (stages.js).
import { heightAt } from './terrain.js';
import { cos, sin } from './dmath.js';

export const DOOR = { near: 150, far: 300, widen: [110, 420], speedUp: 30, earliest: 360, riseSeconds: 5, hiddenChance: 0.75 };
const hash3 = (a, b, c) => { let h = (a ^ Math.imul(b + 1, 374761393) ^ Math.imul(c + 7, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function initDoor(g) {
  const S = g.stageSpec, R = S.doorRise || [S.gateWake, S.gateWake];
  g.door = { state: 'hidden', base: R[0] + (R[1] - R[0]) * hash3(g.seed | 0, g.stage | 0, 0xD00D), at: 0, x: 0, z: 0, t: 0, k0: g.elitesKilled | 0, dist: 0, hidden: false };
  g.door.at = g.door.base;
}
// when the door will rise now: the seeded time, sooner for each elite or mini boss felled this stage, never before 6:00
export function doorAt(g) { const d = g.door; return Math.max(DOOR.earliest, d.base - DOOR.speedUp * (Math.max(0, (g.elitesKilled | 0) - d.k0) + (d.shards | 0))); }

export function doorTick(g, dt) {
  const d = g.door; if (!d) return;
  if (d.state === 'hidden') { d.at = doorAt(g); if (g.sc >= d.at && !g.duelOn) riseDoor(g); }
  else d.t += dt;
}
export const doorReady = g => !g.door || (g.door.state === 'risen' && g.door.t >= DOOR.riseSeconds - 1);

// ---- where: a boss ring (a flat open disc the generator reserved) in the band round the duelist that the starting kit can walk to; one hidden from the duelist by the ground is preferred
function reachable(g, R) {
  const p = g.p, S = 8, n = Math.ceil(2 * R / S), seen = new Uint8Array(n * n), hs = new Float32Array(n * n), ox = p.x - R, oz = p.z - R;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) hs[j * n + i] = heightAt(ox + (i + 0.5) * S, oz + (j + 0.5) * S);
  const ci = Math.floor(R / S), q = [ci * n + ci]; seen[q[0]] = 1;
  while (q.length) { const c = q.pop(), x = c % n, z = (c / n) | 0; for (let d = 0; d < 4; d++) { const xx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), zz = z + (d === 2 ? 1 : d === 3 ? -1 : 0); if (xx < 0 || zz < 0 || xx >= n || zz >= n) continue; const m = zz * n + xx; if (seen[m] || hs[m] >= 50 || Math.abs(hs[m] - hs[c]) > 3.0) continue; seen[m] = 1; q.push(m); } }
  return (x, z) => { const i = Math.floor((x - ox) / S), j = Math.floor((z - oz) / S); return i >= 0 && j >= 0 && i < n && j < n && seen[j * n + i] === 1; };
}
function hiddenFrom(g, x, z) {               // is the door's top out of sight of the duelist's eyes: the ground (or a mesa) rises above the sight line somewhere between
  const p = g.p, ey = p.y + 1.7, ty = heightAt(x, z) + 7, dx = x - p.x, dz = z - p.z, L = Math.sqrt(dx * dx + dz * dz), n = Math.max(4, Math.floor(L / 6));
  for (let k = 1; k < n; k++) { const t = k / n, h = heightAt(p.x + dx * t, p.z + dz * t); if (h < 50 && h > ey + (ty - ey) * t + 0.3) return true; if (h >= 50) return true; }
  return false;
}
export function riseDoor(g) {
  const p = g.p, m = g.map, rings = m.bossRings || [], dist = r => Math.sqrt((r.x - p.x) * (r.x - p.x) + (r.z - p.z) * (r.z - p.z));
  const reach = reachable(g, 440), flatness = (x, z) => { const h = heightAt(x, z); if (h >= 50) return 99; let lo = h, hi = h; for (let q = 0; q < 8; q++) { const hh = heightAt(x + cos(q * 0.785) * 12, z + sin(q * 0.785) * 12); if (hh >= 50) return 99; lo = Math.min(lo, hh); hi = Math.max(hi, hh); } return hi - lo; };
  // candidates in the 150 to 300 m band: every reachable boss ring there, and spots found by chance that are flat enough to stand a door on
  const cand = []; for (const r of rings) { const d = dist(r); if (d >= DOOR.near && d <= DOOR.far && reach(r.x, r.z) && heightAt(r.x, r.z) < 50) cand.push({ x: r.x, z: r.z, ring: true }); }
  for (let k = 0; k < 70; k++) { const a = g.rsp() * 6.2832, r = DOOR.near + g.rsp() * (DOOR.far - DOOR.near), x = p.x + cos(a) * r, z = p.z + sin(a) * r; if (!reach(x, z)) continue; const f = flatness(x, z); if (f < 3.2) cand.push({ x, z, ring: false, f }); }
  let list = cand;
  if (!list.length) for (const r of rings) { const d = dist(r); if (d >= DOOR.widen[0] && d <= DOOR.widen[1] && reach(r.x, r.z)) list.push({ x: r.x, z: r.z, ring: true }); }
  { const r = p.ride, sp = Math.sqrt(p.vx * p.vx + p.vz * p.vz); if (r && r.on && sp > 10) { const ahead = list.filter(c => ((c.x - p.x) * p.vx + (c.z - p.z) * p.vz) / (dist(c) * sp) > 0.4); if (ahead.length) list = ahead; } }       // a rider meets the door ahead of the card, not behind it
  let site = null, hidden = false;
  if (list.length) { const hid = list.filter(r => hiddenFrom(g, r.x, r.z)), vis = list.filter(r => !hid.includes(r)), wantHid = g.rsp() < DOOR.hiddenChance, pool = wantHid && hid.length ? hid : vis.length ? vis : list; site = pool[Math.floor(g.rsp() * pool.length) % pool.length]; hidden = hid.includes(site); }
  if (!site) site = { x: p.x + 160, z: p.z };
  const d = g.door; d.state = 'risen'; d.x = site.x; d.z = site.z; d.t = 0; d.dist = Math.round(dist(site)); d.hidden = hidden; d.riseAt = g.sc; d.rank = (g.elitesKilled | 0) - d.k0;
  const gt = m.gate; gt.x = Math.round(site.x * 100) / 100; gt.z = Math.round(site.z * 100) / 100; m.arena.center.x = gt.x; m.arena.center.z = gt.z; m.arena.boss.x = gt.x + 9; m.arena.boss.z = gt.z; m.arena.tollPull.x = gt.x + 6; m.arena.tollPull.z = gt.z;
  g.event('banner', 'Stone grinds under the sand. A door has risen near you.'); g.emit('doorrise', gt.x, gt.z, 0);
}
