#!/usr/bin/env node
// Batch run: node batch.mjs --count 50 [--stage S] [--start 1] [--workers 4] [--json report.json]
// Reports pass rates (first attempt, <= 1 retry, final), fallbacks, repairs, failure-kind histogram,
// metric distributions, timing (median / p95) and variety-signature collisions. Exit code 0 = batch passes.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { writeFileSync } from 'node:fs';
import { generateStage } from './generate.mjs';
import { encodeSeal } from './seed.mjs';
import { mapHash, varietySignature } from './emit.mjs';
import { isqrt, pseudoAngle } from './imath.mjs';
import { dijkstra } from './nav.mjs';
import { ANY } from './links.mjs';

// Batch acceptance (prototype targets).
export const GATES = { finalPassPct: 100, firstTryPct: 50, withinOneRetryPct: 70, fallbackPctMax: 5, medianMsMax: 2500, sigCollisionsMax: 0 };

// Macro-variety probes (review metrics): walkable 16x16 block grid, polar positions, spine straightness,
// mega-landmark offset, encounter spread, item+level route with any movement.
function macroProbe(res) {
  const { m, st, A } = res; const N = m.N; const B = 16, bs = Math.ceil(N / B); const grid = new Array(B * B).fill(0);
  for (let bz = 0; bz < B; bz++) for (let bx = 0; bx < B; bx++) { let w = 0, t = 0; for (let z = bz * bs; z < Math.min(N, (bz + 1) * bs); z++) for (let x = bx * bs; x < Math.min(N, (bx + 1) * bs); x++) { t++; if (m.flags[z * N + x] & 1) w++; } grid[bz * B + bx] = w * 2 > t ? 1 : 0; }
  const c = N * 50; const pol = (x, z) => [isqrt((x - c) ** 2 + (z - c) ** 2) / 100 | 0, Math.trunc((pseudoAngle(x - c, z - c) * 360) / 512)];
  const [sR, sA] = pol(m.spawn.x, m.spawn.z), [gR, gA] = pol(m.arena.x, m.arena.z); let sep = Math.abs(sA - gA); if (sep > 180) sep = 360 - sep;
  const mega = m.landmarks.find((l) => l.mega);
  const enc = st.encounters.filter((e) => e.cls !== 'GATE');
  const perD = {}, perR = {}; for (const e of enc) { perD[e.district] = (perD[e.district] || 0) + 1; perR[e.region] = (perR[e.region] || 0) + 1; }
  const nodeOf = (e) => (e.z * N + e.x) * 2 + e.layer; const free = (k) => enc.filter((e) => e.cls === k);
  const d0 = dijkstra(A.pg, [A.spawnNode], ANY, 6000); let route = 1e9;
  for (const [a, b] of [['FREE_ITEM', 'FREE_LEVEL'], ['FREE_LEVEL', 'FREE_ITEM']]) for (const p of free(a)) { if (d0[nodeOf(p)] > 6000) continue; const d1 = dijkstra(A.pg, [nodeOf(p)], ANY, 6000); for (const q of free(b)) route = Math.min(route, d0[nodeOf(p)] + d1[nodeOf(q)]); }
  return { shape: m.macro.shape, grid, spawnR: sR, gateR: gR, sepDeg: sep, spineRatio: m.spine.ratio100, megaOff: mega ? isqrt((mega.x * 100 - c) ** 2 + (mega.z * 100 - c) ** 2) / 100 | 0 : -1,
    chunks: m.chunks.filter((q) => !q.removed).length, heroes: m.landmarks.filter((l) => l.hero).length, maxDistrictPct: Math.trunc((Math.max(...Object.values(perD)) * 100) / Math.max(1, enc.length)), maxRegion: Math.max(...Object.values(perR)),
    itemLevelAny_m: route >= 1e9 ? -1 : Math.trunc(route / 10) };
}

function summarize(seed, stage) {
  const res = generateStage(encodeSeal(0, seed >>> 0), stage);
  const V = res.V;
  const metrics = {};
  if (V) for (const k of Object.keys(V.metrics)) metrics[k] = { pass: V.metrics[k].pass, gating: V.metrics[k].gating, value: V.metrics[k].value };
  if (metrics.V16) metrics.V16.value = { chains: metrics.V16.value.chains, candidates: metrics.V16.value.candidates };
  return {
    seed, stage, seal: res.sealCode, ok: !!res.ok, attempt: res.attempt ?? -1, fallback: !!res.fallback, ms: res.timing.total,
    attempts: res.attempts.map((a) => a.fail), draws: res.attempts.flatMap((a) => a.draws || []), repairs: (res.repairs || []).length, repairsOk: (res.repairs || []).filter((r) => r.ok).length,
    repairTried: res.attempts.reduce((s, a) => s + (a.repairs || 0), 0),
    hash: res.m && V ? mapHash(res) : null, sig: res.m ? varietySignature(res) : null, metrics, probe: res.m && V ? macroProbe(res) : null,
  };
}


const pct = (a, b) => (b ? Math.round((a * 1000) / b) / 10 : 0);
const quant = (arr, q) => { if (!arr.length) return null; const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]; };

async function main(argv) {
  const o = { count: 50, stages: [1, 2, 3], start: 1, workers: Math.max(1, Math.min(8, availableParallelism())), json: null };
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k], v = argv[k + 1];
    if (a === '--count') { o.count = Number(v); k++; } else if (a === '--stage') { o.stages = [Number(v)]; k++; }
    else if (a === '--start') { o.start = Number(v); k++; } else if (a === '--workers') { o.workers = Number(v); k++; }
    else if (a === '--json') { o.json = v; k++; }
    else { console.error(`unknown argument "${a}"`); process.exit(1); }
  }
  if (!(o.count >= 1 && Number.isInteger(o.count)) || !(o.start >= 0 && Number.isInteger(o.start)) || o.stages.some((s) => ![1, 2, 3].includes(s)) || !(o.workers >= 1)) {
    console.error('usage: node batch.mjs --count N [--stage 1|2|3] [--start S] [--workers W] [--json report.json]'); process.exit(1);
  }
  const jobs = []; for (const stage of o.stages) for (let s = 0; s < o.count; s++) jobs.push([o.start + s, stage]);
  const T0 = Date.now();
  const rows = [];
  const W = Math.min(o.workers, jobs.length);
  await Promise.all(Array.from({ length: W }, (_, w) => new Promise((resolve, reject) => {
    const mine = jobs.filter((_, k) => k % W === w);
    const wk = new Worker(new URL(import.meta.url), { workerData: { jobs: mine } });
    wk.on('message', (r) => { rows.push(r); if (rows.length % 10 === 0) process.stderr.write(`  ${rows.length}/${jobs.length}\n`); });
    wk.on('error', reject); wk.on('exit', (c) => (c ? reject(new Error('worker exit ' + c)) : resolve()));
  })));
  rows.sort((a, b) => a.stage - b.stage || a.seed - b.seed);
  const report = { count: o.count, stages: o.stages, wall_s: Math.round((Date.now() - T0) / 100) / 10, perStage: {}, gates: GATES };
  let allPass = true;
  const lines = [];
  for (const stage of o.stages) {
    const R = rows.filter((r) => r.stage === stage); const n = R.length;
    const fin = R.filter((r) => r.ok).length, first = R.filter((r) => r.ok && r.attempt === 0).length, one = R.filter((r) => r.ok && r.attempt <= 1).length;
    const fb = R.filter((r) => r.fallback).length;
    const kinds = {}; let failedAttempts = 0, totalAttempts = 0;
    for (const r of R) for (const f of r.attempts) { totalAttempts++; if (!f) continue; failedAttempts++; for (const k of f.replace(/^validate:/, '').split(',')) { const key = k.replace(/_\d+$/, ''); kinds[key] = (kinds[key] || 0) + 1; } }
    const drawKinds = {}; let drawN = 0; for (const r of R) for (const d of r.draws) { drawN++; const key = d.replace(/_\d+$/, ''); drawKinds[key] = (drawKinds[key] || 0) + 1; }
    const ms = R.map((r) => r.ms);
    const mdist = {};
    const keys = ['V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12', 'V13', 'V14', 'V15', 'V16', 'V17', 'V19'];
    const num = { V8p95: (v) => v.p95Path_m, V8worst: (v) => v.worstPath_m, V8rings: (v) => v.rings, V9len: (v) => v.len_m, V6count: (v) => v.count, V5cov: (v) => v.coverage, V7minFrac: (v) => v.minFracPct, V12mega: (v) => v.megaVisiblePct, V16chains: (v) => v.chains, V19ledges: (v) => v.ledges, V19topTier: (v) => v.topTierSharePct, V17tris: (v) => v.tris, V17visTris: (v) => v.visTris };
    const src = { V8p95: 'V8', V8worst: 'V8', V8rings: 'V8', V9len: 'V9', V6count: 'V6', V5cov: 'V5', V7minFrac: 'V7', V12mega: 'V12', V16chains: 'V16', V19ledges: 'V19', V19topTier: 'V19', V17tris: 'V17', V17visTris: 'V17' };
    for (const [name, f] of Object.entries(num)) { const vals = R.filter((r) => r.metrics[src[name]]).map((r) => f(r.metrics[src[name]].value)).filter((x) => typeof x === 'number'); mdist[name] = { min: quant(vals, 0), p50: quant(vals, 0.5), p95: quant(vals, 0.95), max: quant(vals, 1) }; }
    const metricPass = {}; for (const k of keys) { const has = R.filter((r) => r.metrics[k]); metricPass[k] = pct(has.filter((r) => r.metrics[k].pass).length, has.length); }
    const sigs = {}; for (const r of R) if (r.sig) (sigs[r.sig] = sigs[r.sig] || []).push(r.seed);
    const collisions = Object.entries(sigs).filter(([, v]) => v.length > 1).map(([s, v]) => ({ sig: s, seeds: v }));
    const hashes = new Set(R.map((r) => r.hash)); const dupHash = n - hashes.size;
    const repTried = R.reduce((s, r) => s + r.repairTried, 0), repOk = R.reduce((s, r) => s + r.repairsOk, 0);
    const S = {
      n, finalPassPct: pct(fin, n), firstTryPct: pct(first, n), withinOneRetryPct: pct(one, n), fallbackPct: pct(fb, n),
      attemptFailRatePct: pct(failedAttempts, totalAttempts), meanAttempts: Math.round((totalAttempts * 100) / Math.max(1, n)) / 100,
      repairs: { tried: repTried, succeededOnFinal: repOk, successPct: pct(repOk, repTried) },
      failureKinds: Object.fromEntries(Object.entries(kinds).sort((a, b) => b[1] - a[1])),
      layoutRedraws: { total: drawN, perMap: Math.round((drawN * 100) / Math.max(1, n)) / 100, kinds: Object.fromEntries(Object.entries(drawKinds).sort((a, b) => b[1] - a[1])) },
      ms: { p50: quant(ms, 0.5), p95: quant(ms, 0.95), max: quant(ms, 1) },
      metricPassPct: metricPass, metricDist: mdist, signatureCollisions: collisions, duplicateHashes: dupHash,
      failedSeeds: R.filter((r) => !r.ok).map((r) => ({ seed: r.seed, seal: r.seal, attempts: r.attempts })),
    };
    const gateRes = {
      finalPass: S.finalPassPct >= GATES.finalPassPct, firstTry: S.firstTryPct >= GATES.firstTryPct, withinOneRetry: S.withinOneRetryPct >= GATES.withinOneRetryPct,
      fallback: S.fallbackPct <= GATES.fallbackPctMax, median: S.ms.p50 <= GATES.medianMsMax, collisions: collisions.length <= GATES.sigCollisionsMax && dupHash === 0,
    };
    // macro variety (review gates): silhouette IoU, spine straightness, spawn/gate placement, mega offset, flatness
    const P = R.filter((r) => r.probe).map((r) => r.probe);
    const iou = []; for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { let a = 0, u = 0; for (let k = 0; k < P[i].grid.length; k++) { if (P[i].grid[k] || P[j].grid[k]) u++; if (P[i].grid[k] && P[j].grid[k]) a++; } iou.push(Math.round((a * 1000) / Math.max(1, u)) / 1000); }
    const shapes = {}; for (const p of P) shapes[p.shape] = (shapes[p.shape] || 0) + 1;
    const q = (k) => { const v = P.map((p) => p[k]).filter((x) => typeof x === 'number' && x >= 0); return { min: quant(v, 0), p50: quant(v, 0.5), p95: quant(v, 0.95), max: quant(v, 1) }; };
    const plain = R.filter((r) => r.metrics.V19).map((r) => r.metrics.V19.value.largestPlainPct);
    S.macro = { shapes, silhouetteIoU: { mean: Math.round(iou.reduce((a, b) => a + b, 0) * 1000 / Math.max(1, iou.length)) / 1000, min: quant(iou, 0), p95: quant(iou, 0.95) },
      spineRatio: q('spineRatio'), spawnR_m: q('spawnR'), gateR_m: q('gateR'), spawnGateSepDeg: q('sepDeg'), megaOffset_m: q('megaOff'), chunks: q('chunks'), heroes: q('heroes'),
      maxDistrictSharePct: q('maxDistrictPct'), maxPerRegion: q('maxRegion'), itemLevelRouteAny_m: q('itemLevelAny_m'),
      largestPlainPct: { p50: quant(plain, 0.5), max: quant(plain, 1) } };
    gateRes.spineRatioP50 = (S.macro.spineRatio.p50 ?? 0) >= 130;
    gateRes.silhouetteIoU = S.macro.silhouetteIoU.mean <= 0.85;
    gateRes.flatness = (S.macro.largestPlainPct.max ?? 100) <= 40;
    S.gateResults = gateRes; S.pass = Object.values(gateRes).every(Boolean); allPass &&= S.pass;
    report.perStage[stage] = S;
    lines.push(`\n== stage ${stage} (${n} seeds) ${S.pass ? 'PASS' : 'FAIL'}`);
    lines.push(`  final pass ${S.finalPassPct}%  first try ${S.firstTryPct}%  <=1 retry ${S.withinOneRetryPct}%  fallback ${S.fallbackPct}%  mean attempts ${S.meanAttempts}  failed attempts ${S.attemptFailRatePct}%`);
    lines.push(`  repairs tried ${repTried}, kept ${repOk} (${S.repairs.successPct}%)`);
    lines.push(`  failed-attempt kinds ${JSON.stringify(S.failureKinds)}`);
    lines.push(`  layout redraws inside attempts ${drawN} (${S.layoutRedraws.perMap}/map) ${JSON.stringify(S.layoutRedraws.kinds)}`);
    lines.push(`  ms p50 ${S.ms.p50}  p95 ${S.ms.p95}  max ${S.ms.max}`);
    lines.push(`  metric pass % ${JSON.stringify(metricPass)}`);
    for (const [k, d] of Object.entries(mdist)) lines.push(`  ${k.padEnd(11)} min ${d.min}  p50 ${d.p50}  p95 ${d.p95}  max ${d.max}`);
    lines.push(`  signature collisions ${collisions.length}  duplicate hashes ${dupHash}`);
    lines.push(`  macro ${JSON.stringify(S.macro)}`);
    if (S.failedSeeds.length) lines.push(`  failed seeds ${JSON.stringify(S.failedSeeds.map((f) => f.seed))}`);
    lines.push(`  gates ${JSON.stringify(gateRes)}`);
  }
  report.pass = allPass;
  console.log(lines.join('\n'));
  console.log(`\nBATCH ${allPass ? 'PASS' : 'FAIL'}  (${rows.length} maps, ${report.wall_s} s wall, ${W} workers)`);
  if (o.json) writeFileSync(o.json, JSON.stringify({ ...report, rows }, null, 1));
  process.exitCode = allPass ? 0 : 1;
}

if (!isMainThread) {
  for (const [seed, stage] of workerData.jobs) parentPort.postMessage(summarize(seed, stage));
} else if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  await main(process.argv.slice(2));
}
