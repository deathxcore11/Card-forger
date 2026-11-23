// The opening view of a designed map: the camera yaw at the spawn that looks into the place. Candidate headings every 22.5 degrees are scored on what the game camera (3 m up, a 70 degree cone) would see:
// open ground (no wall and no cliff taller than 5 m within 40 m of the centre ray, and long sight lines on the side rays), a landmark, the gate or a boss ring in view and not hidden behind terrain, and at least two tiers
// (ground heights 3 m apart) along the rays. The first heading toward the route wins ties. View only: it never touches the sim.
const HALF = 200, N = 400, WALL = 50;
export function chooseStartYaw(map) {
  if (map.startYaw !== undefined) return map.startYaw;       // the open desert chooses its own opening view when it is made
  const H = map.heights, sx = map.spawn.x, sz = map.spawn.z, at = (x, z) => { const i = Math.floor(x + HALF), j = Math.floor(z + HALF); return i < 0 || j < 0 || i >= N || j >= N ? 99 : H[j * N + i]; }, h0 = at(sx, sz);
  const fwd = a => [-Math.sin(a), -Math.cos(a)];
  const open = (a, max) => { const [fx, fz] = fwd(a); for (let d = 2; d <= max; d += 2) { const h = at(sx + fx * d, sz + fz * d); if (h >= WALL || h - h0 > 5) return d; } return max; };
  const seen = (tx, tz) => { const dx = tx - sx, dz = tz - sz, d = Math.sqrt(dx * dx + dz * dz); if (d < 10 || d > 160) return null; const ht = at(tx, tz); for (let s = 4; s < d - 4; s += 4) { const h = at(sx + dx * s / d, sz + dz * s / d), eye = h0 + 3 + (ht - h0 - 3) * s / d; if (h > eye + 0.3) return null; } return [dx, dz]; };
  const marks = []; for (const l of map.landmarks || []) marks.push([l.x, l.z, l.mega ? 40 : 60]); marks.push([map.gate.x, map.gate.z, 50]); for (const r of map.bossRings || []) marks.push([r.x, r.z, 20]);
  let route = null; if (map._road && map._road.main) for (const q of map._road.main) if ((q[0] - sx) * (q[0] - sx) + (q[1] - sz) * (q[1] - sz) >= 625) { route = Math.atan2(-(q[0] - sx), -(q[1] - sz)); break; }
  let best = 0, bs = -1e9;
  for (let k = 0; k < 16; k++) {
    const a = k * Math.PI / 8; let s = 0; const c = open(a, 80); if (c < 40) s -= 200; s += c * 2;
    for (const da of [-0.5, -0.25, 0.25, 0.5]) s += open(a + da, 60);
    const tiers = new Set(); const [fx, fz] = fwd(a); for (let d = 8; d <= 90; d += 6) for (const da of [-0.4, 0, 0.4]) { const [rx, rz] = fwd(a + da), h = at(sx + rx * d, sz + rz * d); if (h < WALL) tiers.add(Math.floor(h / 3)); }
    s += Math.min(tiers.size, 4) * 18;
    for (const [mx, mz, w] of marks) { const v = seen(mx, mz); if (!v) continue; let diff = Math.atan2(-v[0], -v[1]) - a; while (diff > Math.PI) diff -= 6.2832; while (diff < -Math.PI) diff += 6.2832; if (Math.abs(diff) < 0.6) s += w; }
    if (route !== null) { let diff = route - a; while (diff > Math.PI) diff -= 6.2832; while (diff < -Math.PI) diff += 6.2832; s += 30 - Math.abs(diff) * 20; }
    if (s > bs) { bs = s; best = a; }
  }
  return best;
}
