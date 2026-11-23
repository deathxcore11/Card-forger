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
export function stageMapV2(seedLo, stageIndex) {
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
  const ax = wcm(A.x), az = wcm(A.z), toll = A.tollBell || [A.x, A.z];
  const districts = m.macro.districts.map(d => ({ id: d.id, name: d.name, gate: !!d.gate, cx: wc((d.seed % m.C) * 8 + 4), cz: wc(((d.seed / m.C) | 0) * 8 + 4), r: 40 }));
  const sp = m.spine.path, main = []; for (let k = 0; k < sp.length; k += 3) main.push([wc(sp[k] % N), wc((sp[k] / N) | 0)]);
  const map = {
    key: 'v2-' + hash, hash, sealCode: res.sealCode, stage: stageIndex, attempt: res.attempt, fallback: !!res.fallback, half: HALF, v2: true, n: N, off,
    prims: [], heights, cellFlags, palette: res.spec.palette, stageName: res.spec.name,
    districts, spawn: { x: wcm(m.spawn.x), z: wcm(m.spawn.z) },
    gate: { x: ax, z: az, radius: 5.5 }, arena: { center: { x: ax, z: az }, boss: { x: ax, z: az }, tollPull: { x: wcm(toll[0]), z: wcm(toll[1]) } },
    bossRings, encounters,
    _road: { main, trails: [], width: 4.5, trailWidth: 3 }, _pools: [],
    report: { genVersion: res.genVersion, v2: true, attempt: res.attempt, fallback: !!res.fallback, timingMs: res.timing && res.timing.total, metrics: res.V && res.V.failing }
  };
  return map;
}
export { WALL, SIM_N, F };

