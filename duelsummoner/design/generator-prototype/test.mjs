// Unit + determinism tests: node test.mjs   (uses node:test, no dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { REACH, g1, g2 } from './reach.mjs';
import { encodeSeal, decodeSeal, Rng, rngFor, xxh32, hex8 } from './seed.mjs';
import { createMap, refreshWalk, F } from './map.mjs';
import { analyze } from './analyze.mjs';
import { classify, castRay, L } from './links.mjs';
import { finalizeTerrain } from './terrain.mjs';
import { stampStairCut } from './repair.mjs';
import { economyViolations } from './encounters.mjs';
import { STAGE_SPECS } from './spec.mjs';
import { generateStage } from './generate.mjs';
import { mapHash } from './emit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

test('reach table rows (cm) match the movement constants', () => {
  assert.deepEqual(REACH.rows.map((r) => r.g1_cm), [390, 400, 434, 499, 573, 633, 731]);
  assert.deepEqual(REACH.rows.map((r) => r.g2_cm), [581, 590, 624, 689, 764, 824, 922]);
  assert.equal(g1(0), 499); assert.equal(g2(0), 689); assert.equal(g1(151), -1); assert.equal(g1(-900), 731);
});

test('gap classification: 460 cm is a plain jump, 600 cm needs the dash', () => {
  assert.equal(classify(460, 0), L.G1);
  assert.equal(classify(600, 0), L.G2);
  assert.equal(classify(700, 0), L.AIR);
  assert.equal(classify(900, 0), 0);
  assert.equal(classify(100, 170), L.SKILL); // above the required hop band
  assert.equal(classify(100, 250), L.AIR); // rise above hop height
});

test('Seal Code round-trip, case-insensitive, I/L/O aliases', () => {
  const r = new Rng(12345);
  for (let k = 0; k < 200; k++) {
    const hi = r.int(256), lo = r.next();
    const code = encodeSeal(hi, lo); assert.equal(code.length, 8);
    assert.deepEqual(decodeSeal(code), { hi, lo });
    assert.deepEqual(decodeSeal(code.toLowerCase()), { hi, lo });
  }
  assert.deepEqual(decodeSeal('0000000I'), decodeSeal('00000001'));
  assert.deepEqual(decodeSeal('0000000L'), decodeSeal('00000001'));
  assert.deepEqual(decodeSeal('O0000001'), decodeSeal('00000001'));
});

test('xoshiro128** matches an independent BigInt reference', () => {
  const r = new Rng(0); r.s = Uint32Array.from([1, 2, 3, 4]);
  const M = 0xFFFFFFFFn; const s = [1n, 2n, 3n, 4n];
  const rotl = (x, k) => ((x << BigInt(k)) | (x >> BigInt(32 - k))) & M;
  const ref = () => { const out = (rotl((s[1] * 5n) & M, 7) * 9n) & M; const t = (s[1] << 9n) & M; s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t; s[3] = rotl(s[3], 11); return Number(out); };
  const got = [], want = [];
  for (let k = 0; k < 64; k++) { got.push(r.next()); want.push(ref()); }
  assert.equal(got[0], 11520); assert.equal(got[1], 0);
  assert.deepEqual(got, want);
  // named streams are independent and stable
  assert.notEqual(rngFor(7, 'terrain').next(), rngFor(7, 'chunks').next());
  assert.equal(rngFor(7, 'terrain').next(), rngFor(7, 'terrain').next());
});

test('xxHash32 reference vectors', () => {
  assert.equal(hex8(xxh32(new Uint8Array(0), 0)), '02cc5d05');
  assert.equal(hex8(xxh32(new TextEncoder().encode('abc'), 0)), '32d153ff');
});

function flatMap(N) {
  const m = createMap(N);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) m.mask1[z * N + x] = x === 0 || z === 0 || x === N - 1 || z === N - 1 ? 1 : 2;
  refreshWalk(m); m.spawn = { x: 550, z: 550 };
  return m;
}
const softCount = (A) => { let n = 0; for (let v = 0; v < A.pg.n; v++) if (A.reachAny[v] && !A.canReturn[v]) n++; return n; };

test('synthetic 6 m pit is a soft-lock until the repair stair is cut', () => {
  const N = 40; const m = flatMap(N);
  for (let z = 15; z < 25; z++) for (let x = 15; x < 25; x++) m.h0[z * N + x] = -600;
  let A = analyze(m);
  assert.ok(softCount(A) > 0, 'pit floor should be reachable but not escapable');
  assert.ok(stampStairCut(m, 20 * N + 15, [-1, 0], -600, 0));
  A = analyze(m);
  assert.equal(softCount(A), 0);
  assert.ok(m.flags[20 * N + 14] & F.PONLY);
});

test('forbidden 181-259 cm steps are snapped to hop or tier heights', () => {
  const N = 30; const m = flatMap(N);
  for (let z = 1; z < N - 1; z++) for (let x = 15; x < N - 1; x++) m.h0[z * N + x] = 220;
  finalizeTerrain(m);
  let band = 0;
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 2; x++) { const i = z * N + x; if (!(m.flags[i] & F.WALK) || !(m.flags[i + 1] & F.WALK)) continue; const d = Math.abs(m.h0[i] - m.h0[i + 1]); if (d >= 181 && d <= 259) band++; }
  assert.equal(band, 0);
  assert.ok(m.snapped > 0);
});

test('economy rules flag an over-generous opening and accept a spread-out one', () => {
  const N = 60; const m = flatMap(N); const A = analyze(m); const ctx = { spec: STAGE_SPECS[1] };
  const at = (type, cls, x, z) => ({ type, cls, x, z, layer: 0, y: 0, pathDist: A.dSpawn[(z * N + x) * 2] });
  const bad = [at('witness_stone', 'FREE_ITEM', 10, 5), at('deck_anvil', 'FREE_LEVEL', 12, 8), at('echo_forge', 'FREE_ITEM', 20, 20),
    at('card_chest', 'PAID', 6, 9), at('card_chest', 'PAID', 9, 6), at('card_chest', 'PAID', 8, 8)];
  const rules = new Set(economyViolations(ctx, m, A, bad).map((v) => v.rule));
  for (const r of [1, 2, 4, 5]) assert.ok(rules.has(r), 'rule ' + r);
  const good = [at('card_chest', 'PAID', 7, 7), at('shrine_tribute', 'DANGER', 30, 30)];
  assert.equal(economyViolations(ctx, m, A, good).length, 0);
  // rule 2 counts any movement: a pair 85 m apart by route is flagged even with a shrine between them
  const near = [at('witness_stone', 'FREE_ITEM', 50, 50), at('deck_anvil', 'FREE_LEVEL', 50, 10), at('shrine_tribute', 'DANGER', 50, 30)];
  assert.ok(economyViolations(ctx, m, A, near).some((v) => v.rule === 2), 'opt-in danger is not a gate');
});

test('determinism: same seal + stage gives the same map in-process and in a child process', () => {
  for (const stage of [1, 2]) {
    const a = generateStage(4242, stage), b = generateStage(4242, stage);
    assert.ok(a.ok && b.ok);
    const ha = mapHash(a), hb = mapHash(b);
    assert.equal(ha, hb);
    const out = execFileSync(process.execPath, ['-e', `import('${join(HERE, 'generate.mjs')}').then(async (g) => { const e = await import('${join(HERE, 'emit.mjs')}'); console.log(e.mapHash(g.generateStage(4242, ${stage}))); })`], { encoding: 'utf8' }).trim();
    assert.equal(out, ha);
  }
  assert.notEqual(mapHash(generateStage(4242, 1)), mapHash(generateStage(4243, 1)));
});

test('jump arcs: no G1 link crosses a cell the ballistic arc cannot clear (incl. SOLID kerbs > 180 cm)', () => {
  // the arc check in castRay: a 190 cm kerb right after the lip blocks the jump; a clear gap keeps it
  const N = 40; const m = flatMap(N);
  for (let z = 1; z < N - 1; z++) for (let x = 20; x < N - 1; x++) m.h0[z * N + x] = 140; // +1.4 m terrace from x=20
  for (let z = 1; z < N - 1; z++) for (let x = 16; x < 20; x++) m.h0[z * N + x] = -300; // 4 m wide ditch before it
  refreshWalk(m);
  const pads = new Uint8Array(N * N).fill(1);
  const open = castRay(m, 20 * N + 15, 1000, 0, pads);
  assert.ok(open.some((r) => r.cls === L.G1 && r.dh === 140), 'clear 4 m gap onto +1.4 m is a G1');
  for (let z = 1; z < N - 1; z++) { m.h0[z * N + 17] = 190; m.flags[z * N + 17] |= F.SOLID; } // kerb in the ditch, 1.9 m above take-off
  refreshWalk(m);
  assert.equal(castRay(m, 20 * N + 15, 1000, 0, pads).filter((r) => r.cell % N >= 20).length, 0, 'kerb blocks the jump');
  // on generated maps: every G1 edge reachable from spawn clears every cell under its straight line by the arc
  for (const [seed, stage] of [[20019, 1], [20008, 1], [4242, 3]]) {
    const r = generateStage(seed, stage); const mm = r.m, A = r.A, NN = mm.N; let bad = 0;
    for (let u = 0; u < A.pg.n; u += 2) for (let e = A.pg.off[u]; e < A.pg.off[u + 1]; e++) {
      if (A.pg.cls[e] !== L.G1 || A.dSpawn[u] >= 1e9) continue; const a = u >> 1, b = A.pg.to[e] >> 1;
      const ax = a % NN, az = (a / NN) | 0, bx = b % NN, bz = (b / NN) | 0; const steps = Math.max(Math.abs(bx - ax), Math.abs(bz - az));
      for (let k = 1; k < steps; k++) { const c = Math.round(az + ((bz - az) * k) / steps) * NN + Math.round(ax + ((bx - ax) * k) / steps); if ((mm.flags[c] & F.SOLID) && mm.h0[c] - mm.h0[a] > 180) bad++; }
    }
    assert.equal(bad, 0, `seed ${seed} stage ${stage}: G1 over a tall SOLID cell`);
  }
});

test('authored fallback layouts produce valid maps', () => {
  for (const stage of [1, 2, 3]) { const r = generateStage(5, stage, { forceFallback: true }); assert.ok(r.fallback); assert.ok(r.ok, 'stage ' + stage + ' ' + (r.V?.failing || [])); }
});

test('CLI rejects bad seeds, seals and stages with a usage message', async () => {
  const { parseArgs } = await import('./gen.mjs');
  assert.ok(parseArgs(['--seed', 'abc']).errors.length);
  assert.ok(parseArgs(['--seed', '1099511627776']).errors.length);
  assert.ok(parseArgs(['--seal', 'UUUUUUUU']).errors.length);
  assert.ok(parseArgs(['--seal', '12']).errors.length);
  assert.ok(parseArgs(['--seed', '5', '--stage', '4']).errors.length);
  assert.equal(parseArgs(['--seed', '4294967296']).seal, '04000000'); // 2^32 no longer wraps to 0
  assert.equal(parseArgs(['--seal', 'oooooool']).seal, '00000001');
});

test('generator code is integer-only and never uses Math.random', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  for (const f of readdirSync(HERE).filter((n) => n.endsWith('.mjs') && n !== 'test.mjs')) {
    const src = readFileSync(join(HERE, f), 'utf8');
    assert.ok(!/Math\.random/.test(src), f + ' uses Math.random');
    if (['reach.mjs', 'render.mjs'].includes(f)) continue;
    assert.ok(!/Math\.(sqrt|sin|cos|atan2|pow|hypot|exp|log)\b/.test(src), f + ' uses float maths');
    assert.ok(!/localeCompare/.test(src), f + ' uses locale-dependent sorting');
  }
});
