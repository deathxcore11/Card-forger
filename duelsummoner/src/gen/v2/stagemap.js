// The v2 generator's StageMap for the game: the designed map (districts, tiers with cliffs, a spine route, landmarks, risk-placed rewards) seen the way the sim and the view read a map.
//   heights   Float32Array(400 x 400), 1 m cells, metres: the standing height (WALL outside the playable shape and on the rim). The sim loads it straight into its collision grid (src/sim/terrain.js loadMap).
//   cellFlags Uint16Array(400 x 400): the generator's cell flags (F in map.js), so the view can colour cliffs, ramps, lanes, arenas and the spine without guessing
//   spawn, gate, arena, bossRings, encounters, districts: the shapes the old generator produced (world metres, x east, z south, origin at the grid centre), so the sim, scatter and HUD need no change
// The generator's own grid is N x N (N = 24 m x the stage's coarse grid, 336 to 360) and sits in the middle of the 400 x 400 sim grid. No platform maths and no clock: the same seed gives the same map everywhere.
import { generateStage } from './generate.js';
import { encodeSeal } from './seed.js';
import { F } from './map.js';
import { mapHash } from './emit.js';
import { hash32 } from './seed.js';
import { isqrt, DIR16 } from './imath.js';

const SIM_N = 400, HALF = 200, WALL = 99;
const TYPE = { witness_stone: 'stone', relic_broker: 'broker', shrine_tribute: 'shrine', altar_tribute: 'altar', card_chest: 'cchest', start_chest: 'cchest', wrapped_mimic: 'cchest' };       // the encounter kinds the game has today; the rest (statues, anvils, tablets, oaths, courts, covenants, fragments) wait for their quests
const r2 = v => Math.round(v * 100) / 100;

// Landmark density on foot: kit pieces along the spine (one every 12 m, 6 to 14 m to either side, on level unsolid ground) and a ring of them round each district centre, so that from any point of the route at least one piece stands within 40 m.
// Integer maths and the generator's own hash only; the pieces are view dressing (no collision beyond the heights they already have).
const KIT_POOL = [['stone_card_stand', 'pillar_short', 'pillar_tall', 'obelisk', 'awning', 'stone_card_lean', 'pillar_tall'], ['pillar_tall', 'obelisk', 'stone_card_stand', 'sealed_arch_pillar', 'pillar_short', 'obelisk'], ['obelisk', 'pillar_tall', 'stone_card_lean', 'stone_card_stand', 'sealed_arch_pillar', 'obelisk']];
function extraKits(m, N, stageIndex, wc, r2) {
  const out = [], pool = KIT_POOL[stageIndex] || KIT_POOL[0], sp = m.spine.path, good = (x, z, h0) => { if (x < 3 || z < 3 || x >= N - 3 || z >= N - 3) return false; const i = z * N + x; if (m.mask1[i] !== 2 || (m.flags[i] & (F.SOLID | F.PIT | F.RAMP | F.CLIFF)) || Math.abs(m.h0[i] - h0) > 60) return false; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (Math.abs(m.h0[i + dz * N + dx] - m.h0[i]) > 40) return false; return true; };
  const put = (x, z, k) => { const i = z * N + x; out.push({ kit: pool[hash32(k * 7919 + x * 31 + z) % pool.length], x: wc(x), z: wc(z), y: r2(m.h0[i] / 100), rot: hash32(k + x + z * 3) & 3 }); };
  for (let k = 0; k + 4 < sp.length; k += 12) {
    const a = sp[k], b = sp[k + 4], ax = a % N, az = (a / N) | 0, dx = (b % N) - ax, dz = ((b / N) | 0) - az, l = isqrt(dx * dx + dz * dz) || 1, h0 = m.h0[a];
    for (let tries = 0; tries < 4; tries++) { const hh = hash32(k * 131 + tries * 17 + 5), d = 6 + (hh % 9), side = (hh >> 8) & 1 ? 1 : -1, x = ax + Math.trunc((-dz * d * side) / l), z = az + Math.trunc((dx * d * side) / l); if (good(x, z, h0)) { put(x, z, k + tries); break; } }
  }
  for (const d of m.macro.districts) { const cx = (d.seed % m.C) * 8 + 4, cz = ((d.seed / m.C) | 0) * 8 + 4, h0 = m.h0[cz * N + cx]; let n = 0; for (let q = 0; q < 24 && n < 5; q++) { const hh = hash32(d.idx * 977 + q * 61 + 3), ang = hh % 16, r = 8 + ((hh >> 6) % 7), x = cx + Math.trunc((DIR16[ang][0] * r) / 1000), z = cz + Math.trunc((DIR16[ang][1] * r) / 1000); if (good(x, z, h0)) { put(x, z, d.idx * 100 + q); n++; } } }
  return out;
}
// Summoning pools: up to two, 5 to 7 m across, on level ground (within 20 cm over the lip circle), 30 m from every encounter, 40 m from the spawn and the gate arena, 8 m from the route, 60 m apart; chosen in the generator's hash order.
function poolSpotsV2(m, N, wc, r2, encounters, spawnW, arenaW) {
  const out = [], sp = m.spine.path, onRoute = (x, z, r) => { for (let k = 0; k < sp.length; k += 2) { const dx = (sp[k] % N) - x, dz = ((sp[k] / N) | 0) - z; if (dx * dx + dz * dz < (r + 8) * (r + 8)) return true; } return false; };
  const cands = []; for (let z = 14; z < N - 14; z += 5) for (let x = 14; x < N - 14; x += 5) cands.push([hash32(z * 4099 + x * 61 + 7), x, z]);
  cands.sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
  for (const [hh, x, z] of cands) {
    if (out.length >= 2) break; const r = 5 + (hh % 3), i0 = z * N + x, hc = m.h0[i0]; let ok = m.mask1[i0] === 2;
    for (let a = 0; a < 16 && ok; a++) for (const rr of [r + 2, r]) { const cx = x + Math.trunc((DIR16[a][0] * rr) / 1000), cz = z + Math.trunc((DIR16[a][1] * rr) / 1000), i = cz * N + cx; if (m.mask1[i] !== 2 || (m.flags[i] & (F.SOLID | F.PIT | F.CLIFF | F.RAMP)) || Math.abs(m.h0[i] - hc) > 20) { ok = false; break; } }
    if (!ok) continue; const wx = wc(x), wz = wc(z); let far = true;
    for (const e of encounters) if ((e.x - wx) * (e.x - wx) + (e.z - wz) * (e.z - wz) < 900) { far = false; break; }
    if (!far || (spawnW[0] - wx) * (spawnW[0] - wx) + (spawnW[1] - wz) * (spawnW[1] - wz) < 1600 || (arenaW[0] - wx) * (arenaW[0] - wx) + (arenaW[1] - wz) * (arenaW[1] - wz) < 1600 || onRoute(x, z, r)) continue;
    if (out.some(p => (p.x - wx) * (p.x - wx) + (p.z - wz) * (p.z - wz) < 3600)) continue; out.push({ x: wx, z: wz, r, y: r2(hc / 100) });
  }
  return out;
}
// seedLo: the run's 32-bit seed; stageIndex 0..2. Returns null when the generator fails (the caller keeps the old generator as a last resort).
// A finished map is kept for the next call with the same seed and stage (the view builds the next stage while an offer panel is open, so the stage change costs nothing), the last 4 only.
const CACHE = new Map();
export function stageMapV2(seedLo, stageIndex) {
  const ck = (seedLo >>> 0) * 4 + stageIndex, hit = CACHE.get(ck); if (hit) { CACHE.delete(ck); CACHE.set(ck, hit); return structuredClone(hit); }       // a copy: the sim and the view may write to what they are given
  const map = buildStageMapV2(seedLo, stageIndex); if (map) { CACHE.set(ck, map); while (CACHE.size > 4) CACHE.delete(CACHE.keys().next().value); return structuredClone(map); } return map;
}
function buildStageMapV2(seedLo, stageIndex) {
  const res = generateStage(encodeSeal(0, seedLo >>> 0), stageIndex + 1);
  if (!res || !res.ok || !res.m || !res.st) return null;
  const m = res.m, N = m.N, off = (SIM_N - N) >> 1, st = res.st, hash = mapHash(res);
  const wc = c => r2(c + off - HALF + 0.5);                     // a cell index to the world coordinate of its centre
  const wcm = cm => r2(cm / 100 + off - HALF);                  // centimetres on the generator grid to world metres
  const heights = new Float32Array(SIM_N * SIM_N).fill(WALL), cellFlags = new Uint16Array(SIM_N * SIM_N);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = z * N + x, k = (z + off) * SIM_N + (x + off); cellFlags[k] = m.flags[i];
    if (m.mask1[i] !== 2) continue;                              // outside the shape and the rim stay walls
    heights[k] = m.h0[i] / 100;                                  // solid cells (pillars, slabs) are as tall as their top; pits are below zero
  }
  const A = m.arena, encounters = [];
  for (const e of st.encounters) { const t = TYPE[e.type]; if (t) encounters.push(e.type === 'start_chest' ? { type: t, x: wc(e.x), z: wc(e.z), y: r2(e.y / 100), free: true } : { type: t, x: wc(e.x), z: wc(e.z), y: r2(e.y / 100) }); }
  for (const v of st.vases) encounters.push({ type: 'vase', x: wc(v.x), z: wc(v.z), y: r2(v.y / 100), banded: !!v.brass });
  const bossRings = st.rings.map(c => ({ x: wc(c % N), z: wc((c / N) | 0), r: 14, y: r2(m.h0[c] / 100) }));
  // the start comfort: one free Card Chest in reach of the spawn. The nearest placed chest within 70 m of the spawn becomes the free one; if none is that close, a chest is added on level ground 14 to 30 m from the spawn (the generator's own cells, found in a fixed scan order)
  { const sx = wcm(m.spawn.x), sz = wcm(m.spawn.z); let best = null, bd = 70 * 70; for (const e of encounters) if (e.type === 'cchest') { const d = (e.x - sx) * (e.x - sx) + (e.z - sz) * (e.z - sz); if (d < bd) { bd = d; best = e; } }
    if (encounters.some(e => e.free)) { /* placed by the generator's encounter rules (start_chest) */ } else if (best) best.free = true; else {
      const hAt = (x, z) => { const i = Math.floor(x + HALF), j = Math.floor(z + HALF); return i < 0 || j < 0 || i >= SIM_N || j >= SIM_N ? WALL : heights[j * SIM_N + i]; }; let pick = null;
      for (let r = 14; r <= 30 && !pick; r += 2) for (let a = 0; a < 16 && !pick; a++) { const ca = [1, 0.9239, 0.7071, 0.3827, 0, -0.3827, -0.7071, -0.9239], x = sx + r * (a < 8 ? ca[a] : -ca[a - 8]), z = sz + r * (a < 8 ? ca[(a + 6) & 7] : -ca[(a + 6) & 7]), h0 = hAt(sx, sz); let flat = hAt(x, z) < 50;
        for (let dz = -1; dz <= 1 && flat; dz++) for (let dx = -1; dx <= 1; dx++) if (Math.abs(hAt(x + dx, z + dz) - h0) > 0.12) { flat = false; break; } if (flat) pick = { x: r2(x), z: r2(z), y: r2(h0) }; }
      if (pick) encounters.push({ type: 'cchest', x: pick.x, z: pick.z, y: pick.y, free: true }); } }  const ax = wcm(A.x), az = wcm(A.z), toll = A.tollBell || [A.x, A.z];
  const landmarks = m.landmarks.map(l => ({ type: l.type, x: wc(l.x), z: wc(l.z), base: r2(l.base / 100), top: r2(l.top / 100), mega: !!l.mega, hero: !!l.hero }));       // the view draws these from data
  const kits = m.instances.map(i => ({ kit: i.kit, x: wc(i.x), z: wc(i.z), y: r2(i.y / 100), rot: i.rot >> 1 })).concat(res.spec.rooms ? [] : extraKits(m, N, stageIndex, wc, r2));       // rooms: no loose pieces along the route, only the room structures
  // rooms: the view tints each room's floor and plants it by its own rule, and the bird's-eye names it. roomOf is one byte per 2 m cell (255 outside), rooms lists each room's centre and style.
  const roomOf = new Uint8Array(200 * 200).fill(255); if (res.spec.rooms) for (let cz = 0; cz < 200; cz++) for (let cx = 0; cx < 200; cx++) { const gx = cx * 2 + 1 - off, gz = cz * 2 + 1 - off; if (gx >= 0 && gz >= 0 && gx < N && gz < N && m.mask1[gz * N + gx] === 2) roomOf[cz * 200 + cx] = m.reg[gz * N + gx]; }
  const rooms = (m.rooms || []).map(q => ({ id: q.id, name: q.name, tier: q.tier, style: q.style, x: wc(q.cx), z: wc(q.cz), landmark: q.landmark }));
  const gateways = (m.gateways || []).map(g => ({ x: wc(g.x), z: wc(g.z), alongZ: g.alongZ }));
  const districts = m.macro.districts.map(d => ({ id: d.id, name: d.name, gate: !!d.gate, cx: wc((d.seed % m.C) * 8 + 4), cz: wc(((d.seed / m.C) | 0) * 8 + 4), r: 40, short: d.name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase(), color: '#f3e3c2' }));
  const sp = m.spine.path, main = []; for (let k = 0; k < sp.length; k += 3) main.push([wc(sp[k] % N), wc((sp[k] / N) | 0)]);
  const map = {
    key: 'v2-' + hash, hash, sealCode: res.sealCode, stage: stageIndex, attempt: res.attempt, fallback: !!res.fallback, half: HALF, v2: true, n: N, off,
    prims: [], heights, cellFlags, palette: res.spec.palette, stageName: res.spec.name,
    districts, spawn: { x: wcm(m.spawn.x), z: wcm(m.spawn.z) },
    gate: { x: ax, z: az, radius: 5.5 }, arena: { center: { x: ax, z: az }, boss: { x: ax, z: az }, tollPull: { x: wcm(toll[0]), z: wcm(toll[1]) } },
    bossRings, encounters, landmarks, kits, rooms, roomOf, gateways,
    _road: { main, trails: [], width: 4.5, trailWidth: 3 }, _pools: poolSpotsV2(m, N, wc, r2, encounters, [wcm(m.spawn.x), wcm(m.spawn.z)], [ax, az]),
    report: { genVersion: res.genVersion, v2: true, attempt: res.attempt, fallback: !!res.fallback, timingMs: res.timing && res.timing.total, metrics: res.V && res.V.failing }
  };
  return map;
}
export function prewarmStage(seedLo, stageIndex) { stageMapV2(seedLo, stageIndex); }
export { WALL, SIM_N, F };









