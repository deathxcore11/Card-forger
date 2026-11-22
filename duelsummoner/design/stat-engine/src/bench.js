// Microbench: 1e6 hits through resolveHit (crit, proc, reactions, chains, kills, explosions, Bell, Tally)
// plus self-damage through hurtPlayer. Reports ns/hit, heap growth and GC events during the timed window.

import v8 from 'node:v8';
import vm from 'node:vm';
import { PerformanceObserver, performance } from 'node:perf_hooks';
import { Ledger, STAT, SRC, EBIT, EV, FX, PF, HF, C, hitFlags, DUELIST } from './stats.js';

function getGc() {
  if (typeof globalThis.gc === 'function') return globalThis.gc;
  try { v8.setFlagsFromString('--expose-gc'); return vm.runInNewContext('gc'); } catch { return null; }
}

export function benchLedger() {
  const L = new Ledger({ seed: 12345, duelist: DUELIST.VESH, enemyHp: 40, respawnOnDeath: true });
  const p = L.pts;
  p[STAT.MIGHT] = 15000; p[STAT.SRC_MON] = 8000; p[STAT.AFF_FIRE] = 9000; p[STAT.AFF_ICE] = 5000; p[STAT.KEEN] = 60; p[STAT.FERO] = 20000;
  p[STAT.FERV] = 40; p[STAT.RESO] = 9000; p[STAT.MARKD] = 5000; p[STAT.HUNT] = 4000; p[STAT.GUARD] = 40; p[STAT.SIDE] = 30; p[STAT.WARD] = 2;
  p[STAT.VOLLEY] = 2; p[STAT.REGEN] = 300; p[STAT.LP] = 100;
  L.locketN = 1; L.recoilN = 1; L.bellN = 1; L.tallyN = 1; L.gustLv = 3; L.tollLv = 5;
  L.explodeBase = 20; L.explodeTargets = 5; L.explodeElem = EBIT.lightning;
  L.setEffects(EV.HURT, [FX.GUST_WARD, FX.LOCKET_NOVA]); L.setEffects(EV.BLOCK, [FX.RECOIL_SEAL]);
  L.setEffects(EV.KILL, [FX.BELL, FX.TALLY, FX.MARK_EXPLODE]);
  L.recompute(); L.hp = L.maxLp;
  return L;
}

const FLAGS = Int32Array.from([
  hitFlags(SRC.MON, EBIT.fire), hitFlags(SRC.MON, EBIT.ice), hitFlags(SRC.MON, EBIT.lightning), hitFlags(SRC.MON, EBIT.fire | EBIT.lightning),
  hitFlags(SRC.CARD, EBIT.poison), hitFlags(SRC.MON, EBIT.wind), hitFlags(SRC.TRAP, EBIT.earth, HF.AREA), hitFlags(SRC.MON, EBIT.light | EBIT.dark)
]);
const COEF = Int32Array.from([200, 110, 200, 80, 160, 90, 120, 30]);

// one pass of n hits; returns the damage sum (so the work cannot be optimised away)
export function hitLoop(L, n) {
  let sum = 0;
  const N = L.N, out = L.out;
  for (let k = 0; k < n; k++) {
    const j = (k ^ (k >>> 5)) & 7, i = (k * 7) % N;
    if ((k & 3) === 0) L.markT[i] = 360;
    L.resolveHit(i, 5, FLAGS[j], COEF[j], 0);
    sum += out[0];
    if ((k & 63) === 0) { L.hurtPlayer(1, PF.SELF, SRC.SELF); L.hurtPlayer(9, 0, SRC.ENEMY); L.tickWorld(); }
  }
  return sum;
}

export async function benchHits(n = 1e6) {
  const gc = getGc();
  const L = benchLedger();
  hitLoop(L, 300000);                                    // warm-up: let the optimiser settle
  hitLoop(L, 300000);
  let gcEvents = 0, t0 = 0, t1 = 0;
  const obs = new PerformanceObserver(list => { for (const e of list.getEntries()) if (e.startTime >= t0 && e.startTime <= t1) gcEvents++; });
  obs.observe({ entryTypes: ['gc'] });
  if (gc) { gc(); gc(); }
  const h0 = process.memoryUsage().heapUsed;
  t0 = performance.now(); t1 = Infinity;
  const s0 = process.hrtime.bigint();
  const sum = hitLoop(L, n);
  const s1 = process.hrtime.bigint();
  t1 = performance.now();
  const h1 = process.memoryUsage().heapUsed;
  await new Promise(r => setTimeout(r, 50));
  obs.disconnect();
  const hits = L.c[C.HITS];
  return { n, nsPerHit: Number(s1 - s0) / n, heapDelta: h1 - h0, bytesPerHit: (h1 - h0) / n, gcEvents, gcExposed: !!gc,
    sum, totalHitsInclSecondary: hits, finite: Number.isFinite(sum), hp: L.hp };
}

// The per-hit path alone: every element, crits, reactions, statuses, chains, DoT snapshots, on enemies that do not die.
// This is the path the spec requires to be allocation-free; the test asserts 0 GC events and < 64 KB heap growth.
export function perHitLoop(L, n) {
  let sum = 0;
  const N = L.N, out = L.out;
  for (let k = 0; k < n; k++) {
    const j = (k ^ (k >>> 5)) & 7, i = (k * 7) % N;
    L.resolveHit(i, 5, FLAGS[j], COEF[j], 0);
    sum += out[0];
    if ((k & 255) === 0) { L.chainsTick = 0; L.rlock.fill(0); L.lockT.fill(0); }   // stand-in for the per-tick timers
  }
  return sum;
}
export async function benchPerHitPath(n = 1e6) {
  const gc = getGc();
  const L = benchLedger();
  L.enemyHp = 1e300; for (let i = 0; i < L.N; i++) L.ehp[i] = 1e300;
  perHitLoop(L, 300000); perHitLoop(L, 300000);
  let gcEvents = 0, on = false;
  const obs = new PerformanceObserver(list => { if (on) gcEvents += list.getEntries().length; });
  obs.observe({ entryTypes: ['gc'] });
  let h0 = 0, h1 = 0, s0 = 0n, s1 = 0n, sum = 0;
  for (let pass = 0; pass < 3; pass++) {               // passes 0-1 absorb one-off JIT/heap growth; pass 2 is reported
    if (gc) { gc(); gc(); }
    await new Promise(r => setTimeout(r, 20));
    on = pass === 2;
    h0 = process.memoryUsage().heapUsed; s0 = process.hrtime.bigint();
    sum = perHitLoop(L, n);
    s1 = process.hrtime.bigint(); h1 = process.memoryUsage().heapUsed;
  }
  await new Promise(r => setTimeout(r, 50));
  on = false; obs.disconnect();
  return { n, nsPerHit: Number(s1 - s0) / n, heapDelta: h1 - h0, gcEvents, sum, finite: Number.isFinite(sum), hits: L.c[C.HITS], reacts: L.c[C.REACTS], procs: L.c[C.PROCS], crits: L.c[C.CRITS] };
}
