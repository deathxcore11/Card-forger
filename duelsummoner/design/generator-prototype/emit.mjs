// Canonical output: map hash, variety signature and the stage JSON. No timings in here, so the JSON is
// byte-identical for the same Seal Code + stage + GEN_VERSION. Timings go to a separate file.
import { xxh32, hex8, fnv1a32Ints, GEN_VERSION } from './seed.mjs';

const enc = new TextEncoder();

function encRec(e) { return [e.type, e.cls, e.x, e.z, e.layer, e.y, e.price ?? -1]; }
function chunkRec(c) { return [c.type, c.rect[0], c.rect[1], c.rect[2], c.rect[3], c.rot, c.mir, c.tier, c.removed ? 1 : 0]; }

// xxHash32 over h0, flags, then a canonical text of chunks, encounters, vases and rings.
export function mapHash(res) {
  const { m, st } = res;
  const h0 = new Uint8Array(m.h0.buffer, m.h0.byteOffset, m.h0.byteLength);
  const fl = new Uint8Array(m.flags.buffer, m.flags.byteOffset, m.flags.byteLength);
  const text = JSON.stringify([m.chunks.map(chunkRec), st.encounters.map(encRec), st.vases.map((v) => [v.x, v.z, v.cluster]), st.rings, m.jumps.map((j) => [j.a, j.b, j.cls])]);
  const tb = enc.encode(text);
  const all = new Uint8Array(h0.length + fl.length + tb.length);
  all.set(h0, 0); all.set(fl, h0.length); all.set(tb, h0.length + fl.length);
  return hex8(xxh32(all, GEN_VERSION));
}

// Variety signature: coarse layout identity (district order, region tiers/roles, gate and spawn on a 24 m grid,
// chunk mix). Two seeds with the same signature would feel like the same map.
export function varietySignature(res) {
  const { m } = res; const mac = m.macro; const q = (cm) => Math.floor(cm / 2400);
  const ints = [mac.signature >>> 0, q(m.arena.x), q(m.arena.z), q(m.spawn.x), q(m.spawn.z)];
  for (const r of mac.regions) ints.push(r.district, r.tier + 8, r.role === 'spine' ? 1 : r.role === 'branch' ? 2 : 3);
  const mix = {}; for (const c of m.chunks) if (!c.removed) mix[c.type] = (mix[c.type] || 0) + 1;
  for (const k of Object.keys(mix).sort()) ints.push(k.length * 31 + k.charCodeAt(0), mix[k]);
  return hex8(fnv1a32Ints(ints));
}

const b64 = (ta) => Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength).toString('base64');
const cellPt = (N, c) => [c % N, (c / N) | 0];

export function stageJSON(res, opts = {}) {
  const { m, st, V, spec } = res; const N = m.N; const mac = m.macro;
  const metrics = {}; for (const k of Object.keys(V.metrics)) { const q = V.metrics[k]; metrics[k] = { value: q.value, threshold: q.threshold, pass: q.pass, gating: q.gating }; }
  const out = {
    genVersion: GEN_VERSION, sealCode: res.sealCode, stage: res.stage, stageName: spec.name, palette: spec.palette,
    ok: res.ok, attempt: res.attempt, fallback: res.fallback, hash: res.hash || mapHash(res), signature: varietySignature(res),
    attempts: res.attempts.map((a) => ({ attempt: a.attempt, fail: a.fail, repairs: a.repairs ?? 0 })),
    repairs: (res.repairs || []).map((r) => ({ pass: r.pass, kind: r.kind, fix: r.fix, ok: r.ok })),
    grid: { N, cell_cm: 100, coarse_m: 8, origin: [0, 0] },
    spawn: { x: m.spawn.x, z: m.spawn.z },
    gate: { name: spec.gate, boss: spec.gateBoss, ...m.arena },
    districts: mac.districts.map((d) => ({ id: d.id, name: d.name, gate: d.gate, coarseSeed: cellPt(m.C, d.seed) })),
    regions: mac.regions.map((r) => ({ id: r.id, district: r.district, role: r.role, archetype: r.archetype, tier: r.tier, cells: r.cells })),
    edges: mac.edges.map((e) => ({ a: e.a, b: e.b, type: e.type, spine: !!e.spine, loop: !!e.loop })),
    spine: { len_m: m.spine.len_m, path: m.spine.path.filter((_, k) => k % 4 === 0).map((c) => cellPt(N, c)) },
    ramps: m.ramps.map((r) => ({ P: r.P, dir: r.dir, W: r.W, lowH: r.lowH, highH: r.highH, kind: r.kind })),
    chunks: m.chunks.filter((c) => !c.removed).map((c) => ({ id: c.id, type: c.type, rect: c.rect, rot: c.rot, mir: c.mir, tier: c.tier, region: c.region, island: c.island, chain: c.chain })),
    jumps: m.jumps.map((j) => ({ a: j.a, b: j.b, cls: j.cls, chunk: j.chunk })),
    landmarks: m.landmarks, lures: st.lures || [],
    instances: m.instances, scatter: m.scatter || [],
    encounters: st.encounters.map((e) => ({ type: e.type, cls: e.cls, x: e.x, z: e.z, y: e.y, layer: e.layer, region: e.region, tag: e.tag, R: e.R, price: e.price ?? null })),
    vases: st.vases.map((v) => ({ x: v.x, z: v.z, y: v.y, cluster: v.cluster, brass: v.brass, breadcrumb: !!v.breadcrumb })),
    events: {
      timeline: spec.timeline, clock_s: spec.clock_s,
      bossRings: st.rings.map((c, k) => ({ x: c % N, z: (c / N) | 0, y: m.h0[c], r_m: spec.bossRingR, entries: st.events.bossEntry?.[k] || [] })),
      elitePockets: st.elites, spawnMouths: st.events.spawnMouths || [],
    },
    islands: st.islands.islands.map((q) => ({ id: q.id, area: q.area, perchMax: q.perchMax, cell: cellPt(N, q.cell) })),
    metrics, failing: V.failing,
  };
  if (opts.fields !== false) out.fields = { encoding: 'base64 little-endian, row-major z*N+x', h0_cm_int16: b64(m.h0), h1_cm_int16: b64(m.h1), flags_uint16: b64(m.flags) };
  return out;
}
