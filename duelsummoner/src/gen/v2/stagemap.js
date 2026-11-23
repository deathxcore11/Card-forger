// The v2 generator's StageMap for the game: the designed map (districts, tiers with cliffs, a spine route, landmarks, risk-placed rewards) seen the way the sim and the view read a map.
//   heights   Float32Array(400 x 400), 1 m cells, metres: the standing height (WALL outside the playable shape and on the rim). The sim loads it straight into its collision grid (src/sim/terrain.js loadMap).
//   cellFlags Uint16Array(400 x 400): the generator's cell flags (F in map.js), so the view can colour cliffs, ramps, lanes, arenas and the spine without guessing
//   spawn, gate, arena, bossRings, encounters, districts: the shapes the old generator produced (world metres, x east, z south, origin at the grid centre), so the sim, scatter and HUD need no change
// The generator's own grid is N x N (N = 24 m x the stage's coarse grid, 336 to 360) and sits in the middle of the 400 x 400 sim grid. No platform maths and no clock: the same seed gives the same map everywhere.
import { generateStage } from './generate.js';
import { encodeSeal } from './seed.js';
import { F } from './map.js';
import { mapHash } from './emit.js';

const SIM_N = 400, HALF = 200, WALL = 99;
const TYPE = { witness_stone: 'stone', relic_broker: 'broker', shrine_tribute: 'shrine', altar_tribute: 'altar', card_chest: 'cchest', wrapped_mimic: 'cchest' };       // the encounter kinds the game has today; the rest (statues, anvils, tablets, oaths, courts, covenants, fragments) wait for their quests
const r2 = v => Math.round(v * 100) / 100;

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
  for (const e of st.encounters) { const t = TYPE[e.type]; if (t) encounters.push({ type: t, x: wc(e.x), z: wc(e.z), y: r2(e.y / 100) }); }
  for (const v of st.vases) encounters.push({ type: 'vase', x: wc(v.x), z: wc(v.z), y: r2(v.y / 100), banded: !!v.brass });
  const bossRings = st.rings.map(c => ({ x: wc(c % N), z: wc((c / N) | 0), r: 14, y: r2(m.h0[c] / 100) }));
  // the start comfort: one free Card Chest in reach of the spawn. The nearest placed chest within 70 m of the spawn becomes the free one; if none is that close, a chest is added on level ground 14 to 30 m from the spawn (the generator's own cells, found in a fixed scan order)
  { const sx = wcm(m.spawn.x), sz = wcm(m.spawn.z); let best = null, bd = 70 * 70; for (const e of encounters) if (e.type === 'cchest') { const d = (e.x - sx) * (e.x - sx) + (e.z - sz) * (e.z - sz); if (d < bd) { bd = d; best = e; } }
    if (best) best.free = true; else {
      const hAt = (x, z) => { const i = Math.floor(x + HALF), j = Math.floor(z + HALF); return i < 0 || j < 0 || i >= SIM_N || j >= SIM_N ? WALL : heights[j * SIM_N + i]; }; let pick = null;
      for (let r = 14; r <= 30 && !pick; r += 2) for (let a = 0; a < 16 && !pick; a++) { const ca = [1, 0.9239, 0.7071, 0.3827, 0, -0.3827, -0.7071, -0.9239], x = sx + r * (a < 8 ? ca[a] : -ca[a - 8]), z = sz + r * (a < 8 ? ca[(a + 6) & 7] : -ca[(a + 6) & 7]), h0 = hAt(sx, sz); let flat = hAt(x, z) < 50;
        for (let dz = -1; dz <= 1 && flat; dz++) for (let dx = -1; dx <= 1; dx++) if (Math.abs(hAt(x + dx, z + dz) - h0) > 0.12) { flat = false; break; } if (flat) pick = { x: r2(x), z: r2(z), y: r2(h0) }; }
      if (pick) encounters.push({ type: 'cchest', x: pick.x, z: pick.z, y: pick.y, free: true }); } }  const ax = wcm(A.x), az = wcm(A.z), toll = A.tollBell || [A.x, A.z];
  const landmarks = m.landmarks.map(l => ({ type: l.type, x: wc(l.x), z: wc(l.z), base: r2(l.base / 100), top: r2(l.top / 100), mega: !!l.mega, hero: !!l.hero }));       // the view draws these from data
  const kits = m.instances.map(i => ({ kit: i.kit, x: wc(i.x), z: wc(i.z), y: r2(i.y / 100), rot: i.rot >> 1 }));
  const districts = m.macro.districts.map(d => ({ id: d.id, name: d.name, gate: !!d.gate, cx: wc((d.seed % m.C) * 8 + 4), cz: wc(((d.seed / m.C) | 0) * 8 + 4), r: 40, short: d.name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase(), color: '#f3e3c2' }));
  const sp = m.spine.path, main = []; for (let k = 0; k < sp.length; k += 3) main.push([wc(sp[k] % N), wc((sp[k] / N) | 0)]);
  const map = {
    key: 'v2-' + hash, hash, sealCode: res.sealCode, stage: stageIndex, attempt: res.attempt, fallback: !!res.fallback, half: HALF, v2: true, n: N, off,
    prims: [], heights, cellFlags, palette: res.spec.palette, stageName: res.spec.name,
    districts, spawn: { x: wcm(m.spawn.x), z: wcm(m.spawn.z) },
    gate: { x: ax, z: az, radius: 5.5 }, arena: { center: { x: ax, z: az }, boss: { x: ax, z: az }, tollPull: { x: wcm(toll[0]), z: wcm(toll[1]) } },
    bossRings, encounters, landmarks, kits,
    _road: { main, trails: [], width: 4.5, trailWidth: 3 }, _pools: [],
    report: { genVersion: res.genVersion, v2: true, attempt: res.attempt, fallback: !!res.fallback, timingMs: res.timing && res.timing.total, metrics: res.V && res.V.failing }
  };
  return map;
}
export function prewarmStage(seedLo, stageIndex) { stageMapV2(seedLo, stageIndex); }
export { WALL, SIM_N, F };






