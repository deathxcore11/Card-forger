import test from 'node:test';
import assert from 'node:assert/strict';
import { benchPerHitPath, benchHits } from '../src/bench.js';
import { Ledger, SRC, EBIT, EV, FX, C, hitFlags } from '../src/stats.js';

test('per-hit pipeline: zero allocations over 1e6 hits (0 GC events, < 64 KB heap growth)', async () => {
  const r = await benchPerHitPath(1e6);
  console.log(`  per-hit path: ${r.nsPerHit.toFixed(1)} ns/hit, heap delta ${r.heapDelta} B, GC events ${r.gcEvents}, reactions ${r.reacts}, procs ${r.procs}`);
  assert.equal(r.gcEvents, 0);
  assert.ok(r.heapDelta < 64 * 1024, `heap grew ${r.heapDelta} B`);
  assert.ok(r.finite && r.reacts > 0 && r.procs > 0 && r.crits > 0);
});

test('mixed bench with kills, explosions, Bell, Tally and self-damage: finite, amortised < 1 B/hit', async () => {
  const r = await benchHits(1e6);
  console.log(`  mixed: ${r.nsPerHit.toFixed(1)} ns/hit, ${r.bytesPerHit.toFixed(3)} B/hit amortised, GC events ${r.gcEvents}`);
  assert.ok(r.finite && r.hp >= 1);
  assert.ok(r.bytesPerHit < 1, `${r.bytesPerHit} B/hit`);
});

test('counters hold at 600k kills: exact float64 kill count, no queue drops, no NaN', () => {
  const L = new Ledger({ pool: 512, enemyHp: 1, respawnOnDeath: true });
  L.recompute(); L.bellN = 1; L.tallyN = 1; L.setEffects(EV.KILL, [FX.BELL, FX.TALLY]);
  const f = hitFlags(SRC.MON, EBIT.fire);
  let k = 0;
  while (L.c[C.KILLS] < 600000) { L.resolveHit(k % 512, 3, f, 200, 0); k++; if ((k & 255) === 0) L.tickWorld(); }
  L.tickWorld();
  assert.ok(L.c[C.KILLS] >= 600000 && Number.isInteger(L.c[C.KILLS]));
  assert.equal(L.c[C.KILLQ_DROPPED], 0);
  assert.ok(Number.isFinite(L.c[C.DMG]) && L.runKills === L.c[C.KILLS]);
});
