// Room dressing (stage C): everything in a room is a structure, nothing is dropped on open floor. Each room gets: one centre landmark (at least 9 m tall, its kit piece on a dais) with 20 m kept clear; a gateway of two tall posts at each passage;
// a straight colonnade of short pillars along its longest wall in some rooms; and reward nooks (slots) at the wall feet and behind the landmark. Integer only; the same seed gives the same room dressing.
import { F } from './map.js';
import { hash32 } from './seed.js';
const BLOCK = F.SOLID | F.RAMP | F.PIT | F.GULLY | F.ARENA | F.ENTRY | F.SPAWNB | F.PONLY;
export const ROOM_STYLES = ['pool', 'grove', 'colonnade', 'ruin', 'court', 'meadow'];
export function placeRoomDressing(ctx, m, spineDist) {
  const N = m.N, C = ctx.C, mac = m.macro, regs = mac.regions; m.reserve = m.reserve || new Uint8Array(N * N); m.rooms = []; const rot = 1 + (hash32(ctx.streams.chunks.next()) % 3);       // the first extra room is a pool room, the rest follow the list from a seeded start
  const flatOK = (x0, z0, w, h0) => { for (let dz = -w; dz <= w; dz++) for (let dx = -w; dx <= w; dx++) { const x = x0 + dx, z = z0 + dz; if (x < 3 || z < 3 || x >= N - 3 || z >= N - 3) return false; const i = z * N + x; if (m.mask1[i] !== 2 || (m.flags[i] & BLOCK) || Math.abs(m.h0[i] - h0) > 40) return false; } return true; };
  const keyOf = (r) => regs[r];
  regs.forEach((R, k) => {
    const district = mac.districts[R.district], cx = (R.centre % C) * 8 + 4, cz = ((R.centre / C) | 0) * 8 + 4, style = k === 0 ? 'court' : k === 1 ? 'meadow' : ROOM_STYLES[(k - 2 + rot) % ROOM_STYLES.length];
    const room = { id: k, name: district.name, district: R.district, tier: R.tier, style, cx: 0, cz: 0, landmark: null };
    // the centre landmark: the nearest flat spot to the room's middle, 9 m off the spine, 25 m from the spawn
    const cand = []; for (let dz = -26; dz <= 26; dz += 2) for (let dx = -26; dx <= 26; dx += 2) { const x = cx + dx, z = cz + dz; if (x < 6 || z < 6 || x >= N - 6 || z >= N - 6) continue; if (m.reg[z * N + x] !== k) continue; cand.push([dx * dx + dz * dz, z * N + x]); }
    cand.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (k === 0) { const gx = Math.floor(m.arena.x / 100), gz = Math.floor(m.arena.z / 100), gh = m.h0[gz * N + gx]; m.landmarks.push({ type: district.hero, x: gx, z: gz, base: gh, top: m.arena.tier * 300 + 900, hero: true, district: R.district, room: k }); room.cx = gx; room.cz = gz; room.landmark = district.hero; }
    else for (const [, i0] of cand) {
      const x0 = i0 % N, z0 = (i0 / N) | 0, h0 = m.h0[i0];
      if (spineDist[i0] < 90 || !flatOK(x0 + 1, z0 + 1, 4, h0) || (k === 1 && (x0 * 100 - m.spawn.x) ** 2 + (z0 * 100 - m.spawn.z) ** 2 < 2500 * 2500)) continue;
      for (let dz = 0; dz < 3; dz++) for (let dx = 0; dx < 3; dx++) { const i = (z0 + dz) * N + x0 + dx; m.flags[i] |= F.SOLID | F.CHUNK; m.h0[i] = h0 + 900; m.nodetail[i] = 1; }
      const mega = k === (mac.keystone >= 0 ? mac.keystone : (mac.spineRegions.length > 2 ? mac.spineRegions[1] : 2));
      m.instances.push({ kit: 'circle_dais', x: x0 - 1, z: z0 - 1, y: h0, rot: 0 }); m.instances.push({ kit: mega ? 'colossal_card' : district.hero, x: x0, z: z0, y: h0, rot: 0 });
      m.landmarks.push({ type: mega ? 'colossal_card' : district.hero, x: x0 + 1, z: z0 + 1, base: h0, top: h0 + (mega ? 2000 : 900), hero: true, mega, district: R.district, room: k });
      room.cx = x0 + 1; room.cz = z0 + 1; room.landmark = mega ? 'colossal_card' : district.hero; break;
    }
    for (let dz = -20; dz <= 20; dz++) for (let dx = -20; dx <= 20; dx++) { if (dx * dx + dz * dz > 400) continue; const x = room.cx + dx, z = room.cz + dz; if (x >= 0 && z >= 0 && x < N && z < N) m.reserve[z * N + x] = 1; }       // 20 m kept clear round the landmark
    m.rooms.push(room);
  });
  // gateways: two tall posts either side of each 14 m passage
  m.gateways = [];
  for (const w of (m.roomWalls || [])) {
    if (!w.open) continue; const h0 = m.h0[w.bz * N + w.bx]; const post = (x, z) => { const i = z * N + x; if (x < 3 || z < 3 || x >= N - 3 || z >= N - 3) return; m.instances.push({ kit: 'sealed_arch_pillar', x, z, y: (w.tier * 300), rot: 0 }); };
    const off = 9; if (w.alongZ) { post(w.bx, w.bz - off); post(w.bx, w.bz + off); } else { post(w.bx - off, w.bz); post(w.bx + off, w.bz); }
    m.gateways.push({ x: w.bx, z: w.bz, alongZ: w.alongZ, a: w.a, b: w.b });
  }
  // colonnades along the longest same-tier wall of 'colonnade' rooms: short pillars every 8 m, 5 m inside the wall, straight, none within 12 m of a passage
  for (const R of m.rooms) {
    if (R.style !== 'colonnade') continue;
    const ws = (m.roomWalls || []).filter((w) => w.a === R.id || w.b === R.id).sort((p, q) => Math.max(q.maxx - q.minx, q.maxz - q.minz) - Math.max(p.maxx - p.minx, p.maxz - p.minz));
    const w = ws[0]; if (!w) continue; const inward = (w.a === R.id ? 1 : -1);
    const lo = w.alongZ ? w.minz : w.minx, hi = w.alongZ ? w.maxz : w.maxx; let n = 0;
    for (let t = lo + 4; t <= hi - 4; t += 8) {
      if (Math.abs(t - (w.alongZ ? w.bz : w.bx)) < 12) continue;
      const x = w.alongZ ? w.bx + inward * 6 : t, z = w.alongZ ? t : w.bz + inward * 6; if (x < 4 || z < 4 || x >= N - 4 || z >= N - 4) continue;
      const i = z * N + x; if (m.reg[i] !== R.id || (m.flags[i] & BLOCK) || spineDist[i] < 60 || m.reserve[i]) continue;
      m.instances.push({ kit: 'pillar_short', x, z, y: m.h0[i], rot: 0 }); n++;
    }
  }
  // reward nooks: floor 3 to 4 m inside each same-tier wall, midway between passages, 12 m off the spine; and one spot behind each landmark
  const slots = [];
  for (const R of m.rooms) {
    let got = 0;
    for (const w of (m.roomWalls || [])) {
      if ((w.a !== R.id && w.b !== R.id) || got >= 2) continue; const inward = w.a === R.id ? 1 : -1, lo = w.alongZ ? w.minz : w.minx, hi = w.alongZ ? w.maxz : w.maxx;
      for (const f of [0.28, 0.72]) {
        const t = Math.trunc(lo + (hi - lo) * f); if (Math.abs(t - (w.alongZ ? w.bz : w.bx)) < 14) continue;
        const x = w.alongZ ? w.bx + inward * 5 : t, z = w.alongZ ? t : w.bz + inward * 5; if (x < 4 || z < 4 || x >= N - 4 || z >= N - 4) continue; const i = z * N + x;
        if (m.reg[i] !== R.id || (m.flags[i] & (BLOCK | F.LANE)) || spineDist[i] < 120 || m.reserve[i] || !(m.flags[i] & F.WALK)) continue;
        slots.push({ tag: 'reward_port', x, z, layer: 0, chunk: -1 }); got++; if (got >= 2) break;
      }
    }
    if (R.landmark && R.id > 1) { const dxm = Math.sign(R.cx - (R.cx * 0 + (regs[R.id].centre % C) * 8 + 4)) || 1; const x = R.cx + 7, z = R.cz + 7, i = z * N + x; if (x < N && z < N && m.reg[i] === R.id && !(m.flags[i] & BLOCK) && (m.flags[i] & F.WALK) && spineDist[i] >= 60) slots.push({ tag: 'pedestal', x, z, layer: 0, chunk: -1 }); void dxm; }
  }
  m.slots.push(...slots);
  return { rooms: m.rooms.length, slots: slots.length };
}
