// The road: one worn dirt road from the spawn to the gate that passes the district centres in order, with a bend every 30 m or so (up to 6 m sideways), and 3 m trails
// from each district centre back to the road. Pure and integer-friendly (no platform maths): the same map always gives the same road, so the scatter can keep a clear
// lane along it (the road plus 1.5 m each side holds no solids) and the view can paint it.
import { sin } from '../sim/dmath.js';
import { isqrt } from './imath.js';
const len = (dx, dz) => isqrt(Math.floor((dx * dx + dz * dz) * 10000)) / 100;

export function roadPath(map) {
  if (map._road) return map._road;
  const sx = map.spawn.x, sz = map.spawn.z, gx = map.gate.x, gz = map.gate.z, ux = gx - sx, uz = gz - sz, ul = len(ux, uz) || 1;
  const ds = (map.districts || []).filter(d => d.cx !== undefined).map(d => ({ d, t: ((d.cx - sx) * ux + (d.cz - sz) * uz) / (ul * ul) })).filter(o => o.t > 0.08 && o.t < 0.92).sort((a, b) => a.t - b.t);
  const way = [[sx, sz]]; for (const o of ds) way.push([o.d.cx, o.d.cz]); way.push([gx, gz]);
  const main = [[sx, sz]];
  for (let w = 1; w < way.length; w++) {
    const ax = way[w - 1][0], az = way[w - 1][1], bx = way[w][0], bz = way[w][1], l = len(bx - ax, bz - az), n = Math.max(1, Math.round(l / 30)), px = -(bz - az) / (l || 1), pz = (bx - ax) / (l || 1);
    for (let i = 1; i <= n; i++) { const t = i / n, bump = i === n ? 0 : sin((w * 7 + i * 2.3)) * 6; main.push([ax + (bx - ax) * t + px * bump, az + (bz - az) * t + pz * bump]); }
  }
  const trails = [];
  for (const o of ds) { let best = null, bd = 1e9; for (const p of main) { const d = len(p[0] - o.d.cx, p[1] - o.d.cz); if (d > 6 && d < bd) { bd = d; best = p; } } if (best) trails.push([[best[0], best[1]], [o.d.cx, o.d.cz]]); }
  map._road = { main, trails, width: 4.5, trailWidth: 3 };
  return map._road;
}
// distance from (x, z) to the nearest road or trail centre line
export function roadDist(road, x, z) {
  let best = 1e9;
  const seg = (ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), ex = ax + dx * t - x, ez = az + dz * t - z, d2 = ex * ex + ez * ez; if (d2 < best) best = d2; };
  for (let i = 1; i < road.main.length; i++) seg(road.main[i - 1][0], road.main[i - 1][1], road.main[i][0], road.main[i][1]);
  for (const t of road.trails) seg(t[0][0], t[0][1], t[1][0], t[1][1]);
  return len(best, 0);
}

// two summoning pools per map, 10 to 16 m across, on open flat ground at least 30 m from every encounter, 40 m from the spawn and the gate and clear of the districts
import { heightAt } from '../sim/terrain.js';
import { cos } from '../sim/dmath.js';
export function poolSpots(map) {
  if (map._pools) return map._pools;
  let h = 2166136261; const key = String(map.hash || map.key || 'x'); for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); } h >>>= 0;
  const out = [], rnd = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
  const far = (x, z, r, list) => { for (const e of list) { const dx = x - e.x, dz = z - e.z, rr = r + (e.r || 0); if (dx * dx + dz * dz < rr * rr) return false; } return true; };
  const enc = (map.encounters || []).map(e => ({ x: e.x, z: e.z, r: 0 })), dist = (map.districts || []).map(d => ({ x: d.cx, z: d.cz, r: (d.r || 30) + 6 }));
  for (let tries = 0; out.length < 2 && tries < 400; tries++) {
    const a = rnd() * 6.283185307, r = 90 + rnd() * 80, x = cos(a) * r, z = cos(a - 1.5707963) * r, rad = 5 + rnd() * 3;
    if (!far(x, z, 30 + rad, enc) || !far(x, z, 40 + rad, [{ x: map.spawn.x, z: map.spawn.z }, { x: map.gate.x, z: map.gate.z }]) || !far(x, z, rad, dist) || (out.length && !far(x, z, 60, out))) continue;
    let flat = true; for (let k = 0; k < 8 && flat; k++) if (heightAt(x + cos(k * 0.785) * (rad + 2), z + cos(k * 0.785 - 1.5707963) * (rad + 2)) > 0.01) flat = false; if (heightAt(x, z) > 0.01) flat = false;
    if (flat) out.push({ x, z, r: rad });
  }
  map._pools = out; return out;
}
