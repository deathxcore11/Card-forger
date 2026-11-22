// G10 scatter: integer Poisson-disk props on field cells (visual instances; < 0.45 m props have no collision).
import { F } from './map.mjs';
const PROPS = ['debris', 'broken_pillar', 'small_stone_card', 'bone_pile', 'rubble_a', 'rubble_b'];
export function scatter(ctx, m) {
  const rng = ctx.streams.scatter; const N = m.N; const out = []; const R = 7;
  const grid = new Int32Array(Math.ceil(N / R) ** 2).fill(-1); const G = Math.ceil(N / R);
  const block = F.LANE | F.ARENA | F.ENTRY | F.RAMP | F.CHUNK | F.SOLID | F.PONLY | F.SPAWNB | F.GULLY | F.PIT;
  for (let t = 0; t < 2600 && out.length < 700; t++) {
    const x = rng.int(N), z = rng.int(N); const i = z * N + x;
    if (!(m.flags[i] & F.WALK) || (m.flags[i] & block)) continue;
    const gx = (x / R) | 0, gz = (z / R) | 0; let ok = true;
    for (let dz = -1; dz <= 1 && ok; dz++) for (let dx = -1; dx <= 1; dx++) { const k = (gz + dz) * G + gx + dx; if (gz + dz < 0 || gx + dx < 0 || gz + dz >= G || gx + dx >= G) continue; const o = grid[k]; if (o >= 0 && (out[o].x - x) ** 2 + (out[o].z - z) ** 2 < R * R) { ok = false; break; } }
    if (!ok) continue;
    grid[gz * G + gx] = out.length;
    out.push({ kit: PROPS[rng.int(PROPS.length)], x, z, y: m.h0[i], yaw16: rng.int(16) });
  }
  m.scatter = out;
}
