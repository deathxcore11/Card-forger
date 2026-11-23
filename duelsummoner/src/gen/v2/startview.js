// The spawn-view rule (a validator check with a re-roll): from the spawn, at game-camera height, some heading (of 16) must open on a composed view: open ground ahead (no cell off the playable shape and no rise over 5 m within 40 m of the
// centre ray), a landmark or the gate within 200 m inside a 40 degree cone with a clear line of sight, and at least two tiers (ground heights 3 m apart) along the centre and the two neighbouring rays. Integer maths only.
// The game then starts the camera on the best such heading (src/view/startview.js).
import { isqrt, DIR16 } from './imath.js';
import { los } from './map.js';

export function startViewOk(m) {
  const N = m.N, sx = Math.floor(m.spawn.x / 100), sz = Math.floor(m.spawn.z / 100), h0 = m.h0[sz * N + sx], marks = [];
  for (const l of m.landmarks) marks.push([l.x, l.z, l.top]); marks.push([Math.floor(m.arena.x / 100), Math.floor(m.arena.z / 100), m.h0[Math.floor(m.arena.z / 100) * N + Math.floor(m.arena.x / 100)] + 400]);
  const at = (x, z) => (x < 0 || z < 0 || x >= N || z >= N || m.mask1[z * N + x] !== 2 ? 99999 : m.h0[z * N + x]);
  for (let k = 0; k < 16; k++) {
    const [dx, dz] = DIR16[k]; let open = true; for (let d = 2; d <= 40 && open; d += 2) { const h = at(sx + Math.trunc((dx * d) / 1000), sz + Math.trunc((dz * d) / 1000)); if (h >= 99999 || h - h0 > 500) open = false; }
    if (!open) continue;
    let seen = false; for (const [mx, mz, top] of marks) { const ex = mx - sx, ez = mz - sz, d = isqrt(ex * ex + ez * ez); if (d < 10 || d > 200 || ex * dx + ez * dz < 766 * d) continue; if (los(m, sx, sz, h0 + 300, mx, mz, top)) { seen = true; break; } }
    if (!seen) continue;
    const tiers = new Set(); for (const kk of [(k + 15) & 15, k, (k + 1) & 15]) for (let d = 8; d <= 90; d += 8) { const h = at(sx + Math.trunc((DIR16[kk][0] * d) / 1000), sz + Math.trunc((DIR16[kk][1] * d) / 1000)); if (h < 99999) tiers.add(Math.floor(h / 300)); }
    if (tiers.size >= 2) return true;
  }
  return false;
}

