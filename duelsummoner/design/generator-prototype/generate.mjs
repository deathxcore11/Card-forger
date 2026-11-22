// Pipeline driver: G0 seed -> macro -> terrain -> spine -> chunks -> finalise -> graphs -> events ->
// encounters -> validate -> repair loop -> attempt+1 -> authored fallback. Pure, deterministic.
import { performance } from 'node:perf_hooks';
import { decodeSeal, encodeSeal, stageSeedOf, attemptSeedOf, makeStreams, splitmix32, GEN_VERSION } from './seed.mjs';
import { STAGE_SPECS } from './spec.mjs';
import { buildMacro } from './macro.mjs';
import { initTerrain, carveChannels, carveTransitions, buildArena, spawnBasin, applyDetail, finalizeTerrain } from './terrain.mjs';
import { placeChunks, placeMegaLandmark, placeHeroes, gateApproach } from './protochunks.mjs';
import { F, refreshWalk } from './map.mjs';
import { chamfer, isqrt } from './imath.mjs';
import { walkSearch, pathFrom, INF } from './nav.mjs';
import { analyze } from './analyze.mjs';
import { findIslands } from './islands.mjs';
import { reserveBossRings, placeElitePockets, eventAnchors } from './events.mjs';
import { buildSlots, placeEncounters } from './encounters.mjs';
import { validate } from './validate.mjs';
import { repairLoop } from './repair.mjs';
import { scatter } from './scatter.mjs';

export const MAX_ATTEMPTS = 8, MAX_REPAIR_PASSES = 4, FALLBACK_TRIES = 6; // attempts MAX_ATTEMPTS.. use the authored layouts
// Cheap layout rejections (macro / spine length) re-draw inside an attempt before it counts as failed.
export const LAYOUT_DRAWS = 16; // a layout reject (macro/spine/terrain pre-check) costs ~10-120 ms, so it redraws inside the attempt
export const layoutSeedOf = (attemptSeed, draw) => (draw === 0 ? attemptSeed : splitmix32((attemptSeed ^ Math.imul(draw, 0x27D4EB2F)) >>> 0));

export function computeSpine(ctx, m) {
  const N = m.N; const mac = m.macro;
  const inSp = new Uint8Array(256); for (const r of mac.spineRegions) inSp[r] = 1;
  const blocked = new Uint8Array(N * N);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = z * N + x;
    if (!(m.flags[i] & F.WALK) || (m.flags[i] & F.PONLY)) { blocked[i] = 1; continue; }
    const h = m.h0[i];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= N || zz >= N) { blocked[i] = 1; break; } const j = zz * N + xx; if (!(m.flags[j] & F.WALK) || Math.abs(m.h0[j] - h) > 60) { blocked[i] = 1; break; } }
  }
  const clear = chamfer(N, blocked);
  const s = Math.floor(m.spawn.z / 100) * N + Math.floor(m.spawn.x / 100);
  const g = Math.floor(m.arena.z / 100) * N + Math.floor(m.arena.x / 100);
  const res = walkSearch(m, s, { rise: 60, allowed: (i) => inSp[m.reg[i]] === 1, pen: (i) => (clear[i] < 50 ? 60 : clear[i] < 70 ? 6 : 0), target: g });
  if (res.dist[g] >= INF) return null;
  const path = pathFrom(res.par, g);
  let len = 0; for (let k = 1; k < path.length; k++) { const a = path[k - 1], b = path[k]; len += (a % N !== b % N && ((a / N) | 0) !== ((b / N) | 0)) ? 14 : 10; }
  const straight = isqrt((m.spawn.x - m.arena.x) ** 2 + (m.spawn.z - m.arena.z) ** 2); // cm
  return { path, len_m: Math.trunc(len / 10), clear, straight_m: Math.trunc(straight / 100), ratio100: Math.trunc((len * 1000) / Math.max(1, straight)) };
}

const trace = (...a) => { if (globalThis.__TRACE) console.error('[gen]', ...a); };
function attemptOnce(ctx, timing) {
  const t0 = performance.now();
  const mac = buildMacro(ctx);
  if (mac.fail) return { fail: 'macro:' + mac.fail };
  timing.macro += performance.now() - t0;
  const t1 = performance.now();
  const m = initTerrain(ctx, mac);
  carveChannels(ctx, m); trace('carveChannels', Math.round(performance.now()-t0));
  const tf = carveTransitions(ctx, m); trace('carveTransitions', Math.round(performance.now()-t0));
  if (tf.includes('spine_ramp')) return { fail: 'terrain:spine_ramp' };
  const ar = buildArena(ctx, m); if (ar.fail) return { fail: 'terrain:' + ar.fail };
  spawnBasin(ctx, m);
  applyDetail(ctx, m); trace('applyDetail', Math.round(performance.now()-t0));
  refreshWalk(m);
  const sp = computeSpine(ctx, m); trace('computeSpine', Math.round(performance.now()-t0));
  if (!sp) return { fail: 'spine:no_path' };
  if (sp.len_m < ctx.spec.spineLen[0] || sp.len_m > ctx.spec.spineLen[1]) return { fail: 'spine:length_' + sp.len_m };
  if (sp.ratio100 < ctx.spec.spineRatioMin && !ctx.fallback) return { fail: 'spine:straight' };
  if (sp.path.some((c) => sp.clear[c] < 50)) return { fail: 'spine:narrow' }; // V9 width, known before structures
  m.spine = sp;
  const src = new Uint8Array(m.N * m.N); for (const c of sp.path) src[c] = 1;
  const spineDist = chamfer(m.N, src);
  for (let i = 0; i < m.N * m.N; i++) if (spineDist[i] <= 60) m.flags[i] |= F.LANE;
  const rr = reserveBossRings(ctx, m); trace('rings', JSON.stringify(rr), Math.round(performance.now()-t0));
  timing.terrain += performance.now() - t1;
  const t2 = performance.now();
  placeChunks(ctx, m, spineDist); trace('placeChunks', Math.round(performance.now()-t0));
  gateApproach(ctx, m, spineDist);
  placeMegaLandmark(ctx, m);
  placeHeroes(ctx, m);
  finalizeTerrain(m); trace('finalizeTerrain', Math.round(performance.now()-t0));
  scatter(ctx, m);
  timing.chunks += performance.now() - t2;
  return { m };
}

export function populate(ctx, m) { // graphs -> events -> encounters (re-run after repairs)
  const t0 = performance.now(); const A = analyze(m); trace('analyze', Math.round(performance.now()-t0));
  const isl = findIslands(m, A, ctx.spec);
  const br = { rings: m.rings || [] };
  const elites = placeElitePockets(ctx, m, A, br.rings);
  m.elitePockets = elites;
  const slots = buildSlots(ctx, m, A, isl, br.rings, elites);
  const enc = placeEncounters(ctx, m, A, slots); trace('enc', Math.round(performance.now()-t0));
  const ev = eventAnchors(ctx, m, A, br.rings);
  const st = { islands: isl, rings: br.rings, ringInfo: br, elites, slots, encounters: enc.list, vases: enc.vases, lures: enc.lures, econ: enc.econ, missing: enc.missing, events: ev };
  return { A, st };
}

export function generateStage(seal, stage, opts = {}) {
  const T0 = performance.now();
  const sealCode = typeof seal === 'number' ? encodeSeal(0, seal >>> 0) : String(seal).toUpperCase();
  const { hi, lo } = decodeSeal(sealCode);
  const spec = opts.spec || STAGE_SPECS[stage];
  const stageSeed = stageSeedOf(hi, lo, stage);
  const timing = { macro: 0, terrain: 0, chunks: 0, validate: 0, repair: 0 };
  const attempts = []; let last = null;
  for (let attempt = opts.forceFallback ? MAX_ATTEMPTS : 0; attempt < MAX_ATTEMPTS + FALLBACK_TRIES; attempt++) { // forceFallback: test hook
    const fallback = attempt >= MAX_ATTEMPTS; const lastTry = attempt === MAX_ATTEMPTS + FALLBACK_TRIES - 1;
    const attemptSeed = attemptSeedOf(stageSeed, attempt);
    let ctx, r; const draws = [];
    for (let d = 0; d < (fallback ? LAYOUT_DRAWS * 3 : LAYOUT_DRAWS); d++) {
      ctx = { spec, stage, C: spec.grid * 3, R: Math.trunc((spec.grid * 3) / 2) - 2, streams: makeStreams(layoutSeedOf(attemptSeed, d)), attempt, draw: d, fallback, fallbackIndex: (stageSeed + attempt + d) % 3, sealCode };
      r = attemptOnce(ctx, timing);
      if (!r.fail) break;
      draws.push(r.fail);
    }
    if (r.fail) { attempts.push({ attempt, fail: r.fail, draws }); continue; }
    const m = r.m;
    const tv = performance.now();
    let { A, st } = populate(ctx, m);
    let V = validate(ctx, m, A, st); trace('validate', Math.round(performance.now()-tv), V.failing.join(','), JSON.stringify(V.metrics.V16.value.detail), JSON.stringify(V.metrics.V8.value), JSON.stringify(V.fails.narrow||[]), JSON.stringify(V.fails.islands||[]), 'V7bad', JSON.stringify(V.fails.spawnRing||[]));
    timing.validate += performance.now() - tv;
    const tr = performance.now();
    const rep = { log: [] };
    if (V.failing.length) ({ A, st, V } = repairLoop(ctx, m, A, st, V, rep, MAX_REPAIR_PASSES));
    timing.repair += performance.now() - tr;
    attempts.push({ attempt, draws, fail: V.failing.length ? 'validate:' + V.failing.join(',') : null, repairs: rep.log.length, failVals: Object.fromEntries(V.failing.map((k) => [k, V.metrics[k].value])) });
    last = { ok: false, sealCode, stage, spec, ctx, m, A, st, V, attempt, fallback, attempts, repairs: rep.log };
    if (V.failing.length && !lastTry) continue;
    const ms = Math.round(performance.now() - T0);
    return { ok: !V.failing.length, sealCode, stage, spec, ctx, m, A, st, V, attempt, fallback, attempts, repairs: rep.log, timing: { total: ms, ...roundT(timing) }, genVersion: GEN_VERSION };
  }
  return { ...(last || {}), ok: false, sealCode, stage, attempts, timing: { total: Math.round(performance.now() - T0), ...roundT(timing) } };
}
const roundT = (t) => Object.fromEntries(Object.keys(t).map((k) => [k, Math.round(t[k])]));
