// G5-G6 (prototype): ~10 parametric proto-chunks in local (u,v) metres, 8 variants (rot4 x mirror),
// region feature budgets, the rhythm-chain placer beside enemy ramps, card bridges over gullies, the mega landmark.
import { F, NONE } from './map.mjs';
import { chamfer, isqrt } from './imath.mjs';
import { walkSearch } from './nav.mjs';
import { tryRamp } from './terrain.mjs';

/* ---------- local chunk builder ---------- */
function mk(type, L, W, extra = {}) {
  return { type, L, W, dh: new Int16Array(L * W), fl: new Uint16Array(L * W), slots: [], jumps: [], kit: [], island: false, tris: 400, ...extra };
}
function box(c, u0, v0, lu, lv, dh, flags = 0) {
  for (let u = u0; u < u0 + lu; u++) for (let v = v0; v < v0 + lv; v++) { if (u < 0 || v < 0 || u >= c.L || v >= c.W) continue; const k = u * c.W + v; c.dh[k] = dh; c.fl[k] |= flags; }
}
const slot = (c, tag, u, v, layer = 0) => c.slots.push({ tag, u, v, layer });
const jump = (c, a, b, cls) => c.jumps.push({ a, b, cls });

export const CHUNKS = {
  hub_plaza(rng) {
    const c = mk('hub_plaza', 24, 24, { tris: 1200 });
    for (const [u, v] of [[5, 5], [17, 5], [5, 17], [17, 17]]) { box(c, u, v, 2, 2, 500, F.SOLID); c.kit.push(['pillar_tall', u, v]); }
    slot(c, 'ring_open_r10', 12, 12); slot(c, 'hub_edge', 12, 2); slot(c, 'hub_edge', 12, 21); slot(c, 'pedestal', 2, 12);
    return c;
  },
  roof_run(rng) {
    const W = 14; const roofs = []; let u = 4; let hgt = 280; const n = 3;
    const g2At = 1; // gap after roof index 1 is the optional dash gap (with a G1 detour via a stepping slab)
    for (let k = 0; k < n; k++) {
      const len = rng.range(5, 6);
      roofs.push({ u0: u, len, h: hgt });
      if (k === n - 1) break;
      if (k === g2At) { u += len + 6; continue; } // 6 m gap, same height
      u += len + rng.range(3, 4);
      const opts = [0]; if (hgt + 140 <= 420) opts.push(140); if (hgt - 140 >= 280) opts.push(-140);
      hgt += opts[rng.int(opts.length)];
    }
    roofs[g2At + 1].h = roofs[g2At].h;
    const L = roofs[n - 1].u0 + roofs[n - 1].len + 2;
    const c = mk('roof_run', L, W, { island: true, tris: 2600 });
    box(c, 1, 3, 3, 3, 140, F.PONLY); c.kit.push(['crate', 1, 3]);
    for (const r of roofs) { box(c, r.u0, 1, r.len, 5, r.h, F.PONLY); c.kit.push(['roof_slab', r.u0, 1]); }
    const e2 = roofs[g2At].u0 + roofs[g2At].len;
    box(c, e2 + 1, 8, 3, 3, roofs[g2At].h, F.PONLY); c.kit.push(['stone_card_flat', e2 + 1, 8]);
    for (let k = 0; k + 1 < n; k++) {
      const a = roofs[k], b = roofs[k + 1];
      jump(c, [a.u0 + a.len - 1, 3], [b.u0, 3], k === g2At ? 'G2' : 'G1');
    }
    jump(c, [e2 - 1, 5], [e2 + 1, 8], 'G1'); jump(c, [e2 + 3, 9], [e2 + 6, 5], 'G1');
    const last = roofs[n - 1]; slot(c, 'reward_port', last.u0 + (last.len >> 1), 3);
    slot(c, 'vase', 0, 7); slot(c, 'vase', roofs[0].u0 + 2, 9);
    return c;
  },
  pillar_hop(rng) {
    const n = rng.range(4, 6); const seq = [140, 280, 420, rng.chance(50) ? 420 : 280, 280, 140];
    const L = n * 3 + (n - 1) * 3 + 2, W = 7;
    const c = mk('pillar_hop', L, W, { island: true, tris: 900 });
    let best = 0;
    for (let k = 0; k < n; k++) { box(c, 1 + k * 6, 2, 3, 3, seq[k], F.PONLY); c.kit.push(['pillar_short', 1 + k * 6, 2]); if (seq[k] > seq[best]) best = k; }
    for (let k = 0; k + 1 < n; k++) jump(c, [1 + k * 6 + 2, 3], [1 + (k + 1) * 6, 3], 'G1');
    slot(c, 'reward_port', 1 + best * 6 + 1, 3); slot(c, 'vase', 0, 0);
    return c;
  },
  card_slab_run(rng) {
    const n = rng.range(4, 5); const hs = [140]; for (let k = 1; k < n; k++) hs.push(Math.min(420, hs[k - 1] + (rng.chance(60) ? 140 : 0)));
    const L = n * 3 + (n - 1) * 3 + 2, W = 9;
    const c = mk('card_slab_run', L, W, { island: true, tris: 1000 });
    for (let k = 0; k < n; k++) { box(c, 1 + k * 6, 2, 3, 5, hs[k], F.PONLY); c.kit.push(['stone_card_flat', 1 + k * 6, 2]); }
    for (let k = 0; k + 1 < n; k++) jump(c, [1 + k * 6 + 2, 4], [1 + (k + 1) * 6, 4], 'G1');
    let top = 0; hs.forEach((h, k) => { if (h >= hs[top]) top = k; });
    slot(c, 'high_perch', 1 + top * 6 + 1, 4); slot(c, 'vase', 0, 1);
    return c;
  },
  card_field(rng) {
    const c = mk('card_field', 20, 20, { tris: 700 });
    const spots = [[2, 2], [2, 12], [12, 2], [12, 12], [7, 7]]; rng.shuffle(spots);
    const n = rng.range(3, 4);
    for (let k = 0; k < n; k++) { const [u, v] = spots[k]; const vert = rng.chance(50); box(c, u, v, vert ? 3 : 5, vert ? 5 : 3, rng.chance(50) ? 100 : 140, F.PONLY); c.kit.push(['stone_card_lean', u, v]); slot(c, 'vase', u + 1, v + 6 > 19 ? v - 1 : v + 6); }
    slot(c, 'pedestal', 10, 10);
    return c;
  },
  terrace_ring(rng) {
    const c = mk('terrace_ring', 32, 32, { tris: 1400 });
    for (let u = 0; u < 32; u++) for (let v = 0; v < 32; v++) {
      const du = u * 100 + 50 - 1600, dv = v * 100 + 50 - 1600; const d = isqrt(du * du + dv * dv);
      const k = u * 32 + v;
      if (d < 1000) c.dh[k] = 280; else if (d < 1300) c.dh[k] = 140;
      if (u >= 16 && d >= 900 && d < 1600) {
        const off = Math.abs(v - 16);
        const h = Math.max(0, Math.min(280, 280 - ((d - 950) >> 1)));
        if (off < 4) { c.dh[k] = h; c.fl[k] |= F.RAMP; }
        else if (off === 4 || off === 5) { c.dh[k] = h + 60; c.fl[k] |= F.SOLID; } // low kerb: never a jump-over obstacle above 70 cm
      }
    }
    c.kit.push(['circle_dais', 6, 6]);
    slot(c, 'ring_open_r10', 16, 16);
    return c;
  },
  mesa_climb(rng, tagOverride) {
    const c = mk('mesa_climb', 31, 16, { tris: 1300 });
    box(c, 8, 1, 14, 14, 300);
    box(c, 0, 5, 4, 6, 140, F.PONLY); box(c, 4, 5, 4, 6, 280, F.PONLY);
    for (let u = 22; u < 29; u++) { const h = Math.max(0, 300 - 50 * (u - 22)); box(c, u, 4, 1, 8, h, F.RAMP); box(c, u, 3, 1, 1, h + 100, F.SOLID); box(c, u, 12, 1, 1, h + 100, F.SOLID); }
    c.kit.push(['mesa_block', 8, 1], ['stair_step', 0, 5], ['ramp_4m', 22, 4]);
    slot(c, tagOverride || 'high_perch', 15, 8);
    return c;
  },
  pocket_end(rng) {
    const c = mk('pocket_end', 16, 15, { island: true, tris: 800 });
    box(c, 6, 4, 7, 7, 300, F.PONLY); box(c, 0, 5, 3, 5, 140, F.PONLY); box(c, 3, 5, 3, 5, 280, F.PONLY);
    c.kit.push(['pocket_platform', 6, 4], ['stair_step', 0, 5]);
    slot(c, 'pocket_end', 9, 7);
    return c;
  },
  ledge_climb(rng) { // self-contained rhythm chain: card climb onto a 3 m ledge beside its own enemy ramp (33 x 22 m)
    const c = mk('ledge_climb', 33, 22, { island: true, tris: 1600, chain: { entry: [0, 17], exit: [30, 17] } });
    box(c, 25, 0, 8, 22, 300);
    for (let u = 19; u < 25; u++) { const h = 50 * (u - 19); box(c, u, 3, 1, 8, h, F.RAMP); box(c, u, 2, 1, 1, h + 100, F.SOLID); box(c, u, 11, 1, 1, h + 100, F.SOLID); }
    box(c, 8, 15, 3, 5, 140, F.PONLY); box(c, 14, 15, 3, 5, 140, F.PONLY); box(c, 20, 15, 3, 5, 280, F.PONLY);
    jump(c, [10, 17], [14, 17], 'G1'); jump(c, [16, 17], [20, 17], 'G1'); jump(c, [22, 17], [25, 17], 'G1');
    c.kit.push(['mesa_block', 25, 0], ['ramp_4m', 19, 1], ['stone_card_flat', 8, 15], ['stone_card_flat', 14, 15], ['stone_card_flat', 20, 15]);
    slot(c, 'high_perch', 29, 9); slot(c, 'vase', 4, 17);
    return c;
  },
  ledge_pillars(rng) { // variant of ledge_climb: pillars instead of flat cards, a different rise order (33 x 22 m)
    const c = mk('ledge_pillars', 33, 22, { island: true, tris: 1500, chain: { entry: [0, 17], exit: [30, 17] } });
    box(c, 25, 0, 8, 22, 300);
    for (let u = 19; u < 25; u++) { const h = 50 * (u - 19); box(c, u, 3, 1, 8, h, F.RAMP); box(c, u, 2, 1, 1, h + 60, F.SOLID); box(c, u, 11, 1, 1, h + 60, F.SOLID); }
    box(c, 6, 15, 3, 4, 140, F.PONLY); box(c, 12, 15, 3, 4, 280, F.PONLY); box(c, 18, 15, 3, 4, 280, F.PONLY);
    jump(c, [8, 17], [12, 17], 'G1'); jump(c, [14, 17], [18, 17], 'G1'); jump(c, [20, 17], [25, 17], 'G1');
    c.kit.push(['mesa_block', 25, 0], ['ramp_4m', 19, 1], ['pillar_short', 6, 15], ['pillar_short', 12, 15], ['pillar_short', 18, 15]);
    slot(c, 'high_perch', 29, 9); slot(c, 'vase', 3, 17);
    return c;
  },
  slide_ramp(rng) {
    const c = mk('slide_ramp', 26, 10, { island: true, tris: 900 });
    box(c, 0, 3, 3, 4, 140, F.PONLY); box(c, 3, 3, 4, 4, 280, F.PONLY);
    for (let u = 7; u < 19; u++) { const h = 280 - 15 * (u - 6); box(c, u, 3, 1, 4, h, F.PONLY | F.SLIDE); }
    for (let u = 3; u < 19; u++) { const h = u < 7 ? 280 : 280 - 15 * (u - 6); box(c, u, 2, 1, 1, h + 100, F.SOLID); box(c, u, 7, 1, 1, h + 100, F.SOLID); }
    box(c, 22, 2, 3, 6, 100, F.PONLY);
    jump(c, [18, 5], [22, 5], 'G1');
    c.kit.push(['slide_lane', 7, 3], ['stone_card_flat', 22, 2]);
    slot(c, 'vase', 19, 1); slot(c, 'vase', 4, 8);
    return c;
  },
};
// kiting obstacles: standing stone cards round an open 10-14 m circle, 6 m+ clearance between them
Object.assign(CHUNKS, {
  card_grove(rng) {
    const c = mk('card_grove', 18, 18, { tris: 900 });
    const n = rng.range(4, 5); const spots = [[1, 7], [7, 1], [15, 7], [7, 15], [14, 14]];
    for (let k = 0; k < n; k++) { const [u, v] = spots[k]; const vert = (k & 1) === 0; box(c, u, v, vert ? 1 : 3, vert ? 3 : 1, 450, F.SOLID); c.kit.push(['stone_card_stand', u, v]); }
    slot(c, 'pedestal', 9, 9); slot(c, 'vase', 1, 1);
    return c;
  },
  pillar_ring(rng) {
    const c = mk('pillar_ring', 18, 18, { tris: 1000 });
    box(c, 7, 7, 4, 4, 600, F.SOLID); c.kit.push(['obelisk', 7, 7]);
    for (const [u, v] of [[0, 0], [16, 0], [0, 16], [16, 16]]) { box(c, u, v, 2, 2, 350, F.SOLID); c.kit.push(['pillar_short', u, v]); }
    slot(c, 'hub_edge', 9, 1); slot(c, 'vase', 4, 13);
    return c;
  },
  // walkable rooftop terrace: enemies climb its 1:2 ramp, the player can also hop up the stair side
  roof_terrace(rng) {
    const c = mk('roof_terrace', 20, 12, { tris: 1300 });
    box(c, 6, 2, 10, 8, 300); c.kit.push(['roof_slab', 6, 2], ['awning', 6, 1]);
    for (let u = 0; u < 6; u++) { const h = 50 * u; box(c, u, 4, 1, 4, h, F.RAMP); box(c, u, 3, 1, 1, h + 60, F.SOLID); box(c, u, 8, 1, 1, h + 60, F.SOLID); }
    box(c, 16, 4, 2, 4, 160, F.PONLY); box(c, 18, 4, 2, 4, 20, 0);
    c.kit.push(['ramp_4m', 0, 4], ['stair_step', 16, 4]);
    slot(c, 'reward_port', 11, 6); slot(c, 'vase', 19, 1);
    return c;
  },
});
// enemy-walkable chunks with no tier step of their own may straddle same-tier region borders
const SPAN_TYPES = { card_grove: 1, pillar_ring: 1, hub_plaza: 1, card_field: 1 };
export const ISLAND_TYPES = { ledge_climb: 1, ledge_pillars: 1, roof_run: 1, pillar_hop: 1, card_slab_run: 1, slide_ramp: 1, pocket_end: 1, slab_climb: 1, pillar_steps: 1 };

// local -> world for anchor (top-left of the world rect), rot4, mirror
export function xform(c, ax, az, rot, mir, u, v) {
  const vv = mir ? c.W - 1 - v : v;
  switch (rot & 3) {
    case 0: return [ax + u, az + vv];
    case 1: return [ax + (c.W - 1 - vv), az + u];
    case 2: return [ax + (c.L - 1 - u), az + (c.W - 1 - vv)];
    default: return [ax + vv, az + (c.L - 1 - u)];
  }
}
const dims = (c, rot) => ((rot & 1) ? [c.W, c.L] : [c.L, c.W]);

export function stampChunk(m, c, ax, az, rot, mir, base, region, extra = {}) {
  const N = m.N;
  const [dx, dz] = dims(c, rot);
  // 3 m skirt blends towards the base height
  for (let z = az - 3; z < az + dz + 3; z++) for (let x = ax - 3; x < ax + dx + 3; x++) {
    if (x < 0 || z < 0 || x >= N || z >= N) continue;
    if (x >= ax && x < ax + dx && z >= az && z < az + dz) continue;
    const i = z * N + x; if (m.reg[i] !== region || m.flags[i] & (F.RAMP | F.GULLY | F.SOLID | F.CHUNK | F.ARENA | F.PONLY)) continue;
    const ring = Math.max(ax - x, x - (ax + dx - 1), az - z, z - (az + dz - 1));
    m.h0[i] = base + Math.trunc(((m.h0[i] - base) * ring) / 4);
  }
  for (let u = 0; u < c.L; u++) for (let v = 0; v < c.W; v++) {
    const [x, z] = xform(c, ax, az, rot, mir, u, v); const i = z * N + x; const k = u * c.W + v;
    m.h0[i] = base + c.dh[k]; m.flags[i] = (m.flags[i] & ~(F.RAMP | F.SOLID | F.PONLY | F.SLIDE)) | F.CHUNK | c.fl[k]; m.nodetail[i] = 1;
  }
  const id = m.chunks.length;
  const rec = { id, type: c.type, anchor: [ax, az], rot, mir, tier: Math.trunc(base / 300), region, island: !!c.island, tris: c.tris, rect: [ax, az, dx, dz], chain: false, ...extra };
  if (c.chain) { const e = xform(c, ax, az, rot, mir, c.chain.entry[0], c.chain.entry[1]), x = xform(c, ax, az, rot, mir, c.chain.exit[0], c.chain.exit[1]); rec.chain = true; rec.chainEntry = e[1] * N + e[0]; rec.chainExit = x[1] * N + x[0]; }
  m.chunks.push(rec);
  for (const s of c.slots) { const [x, z] = xform(c, ax, az, rot, mir, s.u, s.v); m.slots.push({ tag: s.tag, x, z, layer: s.layer, chunk: id, region }); }
  for (const j of c.jumps) { const a = xform(c, ax, az, rot, mir, j.a[0], j.a[1]), b = xform(c, ax, az, rot, mir, j.b[0], j.b[1]); m.jumps.push({ a, b, cls: j.cls, chunk: id }); }
  for (const k of c.kit) { const [x, z] = xform(c, ax, az, rot, mir, k[1], k[2]); m.instances.push({ kit: k[0], x, z, y: m.h0[z * N + x], rot: rot * 2 + mir }); }
  return rec;
}

/* ---------- placement ---------- */
const BLOCK = F.LANE | F.ARENA | F.RAMP | F.GULLY | F.CHUNK | F.SOLID | F.PONLY | F.SPAWNB | F.PIT | F.ENTRY;

function budgetFor(arch, role, rng) {
  const b = [];
  switch (arch) {
    case 'plaza': b.push('hub_plaza', rng.chance(50) ? 'pillar_ring' : 'card_grove'); break;
    case 'necropolis': { b.push('roof_terrace'); const n = rng.range(1, 2); for (let k = 0; k < n; k++) b.push('roof_run'); b.push('roof_terrace'); break; }
    case 'graveyard': b.push(rng.chance(50) ? 'card_slab_run' : 'card_field', 'card_grove', 'card_field'); break;
    case 'mesa': b.push('mesa_climb', 'pillar_ring'); break;
    case 'terraces': { const n = rng.range(1, 2); for (let k = 0; k < n; k++) b.push('terrace_ring'); b.push('card_grove'); break; }
    case 'dunes': if (rng.chance(60)) b.push('slide_ramp'); b.push(rng.chance(50) ? 'card_grove' : 'pillar_ring'); if (rng.chance(50)) b.push('card_grove'); break;
    default: break;
  }
  if (role === 'pocket') b.unshift('pocket_end');
  return b;
}

export function placeChunks(ctx, m, spineDist) {
  const N = m.N; const mac = m.macro; const rng = ctx.streams.chunks;
  const borderSrc = new Uint8Array(N * N);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = z * N + x; const a = m.reg[i];
    if (a === 255 || (x > 0 && m.reg[i - 1] !== a) || (x < N - 1 && m.reg[i + 1] !== a) || (z > 0 && m.reg[i - N] !== a) || (z < N - 1 && m.reg[i + N] !== a)) borderSrc[i] = 1;
  }
  const bdist = chamfer(N, borderSrc);
  const sx = m.spawn.x, sz = m.spawn.z;
  let islands = 0;
  const stats = { placed: 0, skipped: 0 };
  // 1) rhythm chains beside enemy ramps
  const chains = placeChains(ctx, m, spineDist);
  islands += chains;
  // 2) region budgets
  const sat = new Int32Array((N + 1) * (N + 1));
  const tierOf = (i) => (m.reg[i] === 255 ? -99 : mac.regions[m.reg[i]].tier);
  const buildSat = (r, sameTier = false) => { // sameTier: any region at r's tier counts (self-contained chunks)
    const tr = mac.regions[r].tier;
    for (let z = 0; z < N; z++) { let row = 0; for (let x = 0; x < N; x++) {
      const i = z * N + x;
      const bl = (sameTier ? (tierOf(i) !== tr || m.mask1[i] !== 2 || mac.regions[m.reg[i]].archetype === 'setpiece') : (m.reg[i] !== r || bdist[i] < 20)) || (m.reserve && m.reserve[i]) || (m.flags[i] & BLOCK) || ((x * 100 + 50 - sx) ** 2 + (z * 100 + 50 - sz) ** 2 < 3000 * 3000) ? 1 : 0;
      row += bl; sat[(z + 1) * (N + 1) + x + 1] = sat[z * (N + 1) + x + 1] + row; } }
  };
  const rectFree = (x, z, w, h) => { if (x < 0 || z < 0 || x + w > N || z + h > N) return false; const W1 = N + 1; return sat[(z + h) * W1 + x + w] - sat[z * W1 + x + w] - sat[(z + h) * W1 + x] + sat[z * W1 + x] === 0; };
  const order = mac.regions.slice().sort((a, b) => a.id - b.id);
  let dbg = null;
  const placeOne = (R, type, tagOverride, filter) => {
    const c = CHUNKS[type](rng, tagOverride);
    let x0 = N, x1 = 0, z0 = N, z1 = 0;
    for (let i = 0; i < N * N; i++) if (m.reg[i] === R.id) { const x = i % N, z = (i / N) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    const cands = [];
    for (let z = z0; z <= z1; z += 4) for (let x = x0; x <= x1; x += 4) {
      const rot = rng.int(4), mir = rng.int(2);
      for (const rr of [rot, (rot + 1) & 3]) {
        const [w, h] = dims(c, rr);
        const mg = (type === 'ledge_climb' || type === 'ledge_pillars') ? 1 : 2; if (!rectFree(x - mg, z - mg, w + 2 * mg, h + 2 * mg)) { if (dbg) dbg.rect++; continue; }
        const cx = x + (w >> 1), cz = z + (h >> 1); const sd = spineDist[cz * N + cx];
        if (filter && !filter(sd)) { if (dbg) dbg.sd.push(sd); continue; }
        let score = rng.int(40);
        if (sd >= 80 && sd <= 300) score += 100;
        if (type === 'pocket_end') score += Math.min(200, sd >> 2);
        cands.push({ x, z, rot: rr, mir, score });
      }
    }
    if (!cands.length) return null;
    cands.sort((a, b) => b.score - a.score || a.z - b.z || a.x - b.x || a.rot - b.rot);
    const p = cands[0];
    const rec = stampChunk(m, c, p.x, p.z, p.rot, p.mir, R.tier * 300, R.id);
    buildSat(R.id);
    return rec;
  };
  // 1b) self-contained ledge climbs when the tier borders could not host two chains
  let chainN = chains;
  for (const R of mac.regions.slice().sort((a, b) => (a.role === 'spine') - (b.role === 'spine') || a.id - b.id)) {
    if (chainN >= 2) break;
    if (R.archetype === 'setpiece' || R.id === 1 || R.archetype === 'canyon' || R.archetype === 'trench' || R.archetype === 'shoal') continue;
    buildSat(R.id, true);
    if (globalThis.__TRACE) dbg = { rect: 0, sd: [] };
    const used = new Set(m.chunks.filter((q) => q.chain && !q.removed).map((q) => q.type));
    const rec = placeOne(R, used.has('ledge_climb') ? 'ledge_pillars' : 'ledge_climb', undefined, (sd) => sd >= 100 && sd <= 900);
    if (rec) { chainN++; islands++; stats.placed++; } else if (globalThis.__TRACE) console.error('[ledge] no fit in region', R.id, R.archetype, dbg.rect, dbg.sd.length, Math.min(...dbg.sd), Math.max(...dbg.sd));
    dbg = null;
  }
  for (const R of order) {
    if (R.archetype === 'setpiece') continue;
    if (R.archetype === 'canyon' || R.archetype === 'trench' || R.archetype === 'shoal') { stats.placed += placeBridges(ctx, m, R); }
    const budget = budgetFor(R.archetype, R.role, rng);
    if (!budget.length) continue;
    for (let type of budget) {
      buildSat(R.id, !!SPAN_TYPES[type]);
      let tagOverride;
      if (ISLAND_TYPES[type] && islands >= 8) {
        if (type === 'pocket_end') { type = 'mesa_climb'; tagOverride = 'pocket_end'; }
        else if (type === 'roof_run' || type === 'card_slab_run') type = 'card_field';
        else { stats.skipped++; continue; }
      }
      const rec = placeOne(R, type, tagOverride);
      if (rec) { stats.placed++; if (rec.island) islands++; } else { stats.skipped++; }
    }
  }
  // 3) island floor: >= 4 per stage
  for (const R of order) {
    if (islands >= 4) break;
    if (R.archetype === 'setpiece' || R.role === 'spine') continue;
    buildSat(R.id);
    const rec = placeOne(R, 'pillar_hop'); if (rec) { islands++; stats.placed++; }
  }
  for (const R of order) {
    if (islands >= 4) break;
    if (R.archetype === 'setpiece' || R.id === 1) continue;
    buildSat(R.id);
    const rec = placeOne(R, 'pillar_hop'); if (rec) { islands++; stats.placed++; }
  }
  m.chunkStats = { ...stats, chains: chainN, plannedIslands: islands };
}

/* ---------- card bridges over gullies ---------- */
function placeBridges(ctx, m, R) {
  const g = m.gullies.find((q) => q.region === R.id); if (!g) return 0;
  const rng = ctx.streams.chunks; const N = m.N; const want = R.archetype === 'shoal' ? 1 : rng.range(1, 2);
  let made = 0; const used = [];
  const cum = [0]; for (let k = 1; k < g.poly.length; k++) cum.push(cum[k - 1] + isqrt((g.poly[k][0] - g.poly[k - 1][0]) ** 2 + (g.poly[k][1] - g.poly[k - 1][1]) ** 2));
  const ks = []; for (let k = 1; k + 1 < g.poly.length; k++) if (cum[k] > g.len / 4 && cum[k] < (3 * g.len) / 4 && !g.exits.some((s) => Math.abs(s - cum[k]) < 900)) ks.push(k);
  rng.shuffle(ks);
  for (const k of ks) {
    if (made >= want) break;
    if (used.some((s) => Math.abs(s - cum[k]) < 1500)) continue;
    const vx = g.poly[k + 1][0] - g.poly[k - 1][0], vz = g.poly[k + 1][1] - g.poly[k - 1][1];
    const ax = Math.abs(vx) >= Math.abs(vz) ? [0, 1] : [1, 0];
    const cx = Math.floor(g.poly[k][0] / 100), cz = Math.floor(g.poly[k][1] / 100);
    const cells = []; let ok = true; const ends = [];
    for (const sgn of [1, -1]) {
      let t = sgn > 0 ? 0 : -1;
      for (;; t += sgn) {
        const x = cx + ax[0] * t, z = cz + ax[1] * t; if (x < 0 || z < 0 || x >= N || z >= N) { ok = false; break; }
        const i = z * N + x;
        if (m.flags[i] & F.GULLY) { if (Math.abs(t) > 40) { ok = false; break; } continue; }
        if (!(m.mask1[i] === 2) || (m.flags[i] & (F.RAMP | F.SOLID)) || Math.abs(m.h0[i] - g.top) > 70) ok = false;
        ends.push(t); break;
      }
      if (!ok) break;
    }
    if (!ok) continue;
    const [tA, tB] = [ends[1] + 1, ends[0] - 1];
    for (let t = tA; t <= tB && ok; t++) for (let w = -2; w <= 1; w++) {
      const x = cx + ax[0] * t + ax[1] * w, z = cz + ax[1] * t + ax[0] * w; const i = z * N + x;
      if (!(m.flags[i] & F.GULLY)) continue;
      if (g.top - m.h0[i] < 450) { ok = false; break; }
      cells.push(i);
    }
    if (!ok || cells.length < 8) continue;
    for (const i of cells) { m.h1[i] = g.top; m.flags[i] |= F.DECK | F.CHUNK; }
    const mid = (tA + tB) >> 1; const mx = cx + ax[0] * mid, mz = cz + ax[1] * mid;
    const id = m.chunks.length;
    m.chunks.push({ id, type: 'card_bridge', anchor: [mx, mz], rot: ax[0] ? 1 : 0, mir: 0, tier: R.tier, region: R.id, island: false, tris: 800, rect: [mx, mz, 1, 1], chain: false, span: tB - tA + 1 });
    m.slots.push({ tag: 'reward_port', x: mx, z: mz, layer: 1, chunk: id, region: R.id });
    m.instances.push({ kit: 'bridge_span', x: mx, z: mz, y: g.top, rot: ax[0] ? 2 : 0 });
    used.push(cum[k]); made++;
    if (R.archetype === 'shoal') {
      // optional dynamic card platforms over the sand sea (validator runs with all dynamics off)
      for (let d = 0; d < 2; d++) {
        const off = (d ? 8 : -8);
        const px = cx + ax[1] * off, pz = cz + ax[0] * off;
        m.dynamic.push({ id: m.dynamic.length, cells: [px - 1, pz - 1, 3, 3], h: g.top - 100, type: d ? 'drift' : 'flip', periodTicks: d ? 480 : 360, phase: rng.int(360) });
      }
    }
  }
  return made;
}

/* ---------- rhythm chains: slab climbs beside enemy ramps ---------- */
function rampFrame(r) { const [dx, dz] = r.dir; return (u, v) => [r.P[0] + u * dx - v * dz, r.P[1] + u * dz + v * dx]; }
function placeChains(ctx, m, spineDist) {
  const rng = ctx.streams.chunks; const N = m.N; const mac = m.macro; const C = ctx.C;
  const frames = [];
  m.ramps.forEach((r, k) => { if (r.highH - r.lowH === 300 && mac.edges[r.edge]) frames.push({ P: r.P, dir: r.dir, W: r.W, lowH: r.lowH, highH: r.highH, edge: mac.edges[r.edge], ramp: r, key: k }); });
  // new climb sites on tier-change edge borders: the chain brings its own 8 m enemy ramp
  for (const e of mac.edges) {
    const lo = mac.regions[e.low], hi = mac.regions[e.high]; if (hi.tier - lo.tier !== 1) continue;
    for (let z = 0; z < C; z++) for (let x = 0; x < C; x++) {
      if (mac.cregion[z * C + x] !== e.low) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= C || zz >= C || mac.cregion[zz * C + xx] !== e.high) continue;
        frames.push({ P: [(2 * x + dx) * 400 + 400, (2 * z + dz) * 400 + 400], dir: [dx, dz], W: 800, lowH: lo.tier * 300, highH: hi.tier * 300, edge: e, ramp: null, key: 1000 + frames.length });
      }
    }
  }
  const cands = []; const why = {}; const W_ = (k) => { why[k] = (why[k] || 0) + 1; };
  for (const f of frames) {
    const W2 = (u, v) => [f.P[0] + u * f.dir[0] - v * f.dir[1], f.P[1] + u * f.dir[1] + v * f.dir[0]];
    for (const side of [1, -1]) {
      const ev = side * ((f.W >> 1) + 625 + rng.int(300));
      let ok = true, nLow = 0, nLowIn = 0, nHigh = 0, nHighIn = 0; const cells = [];
      const vMin = f.ramp ? ev - 250 : Math.min(ev - 250, -(f.W >> 1) - 100), vMax = f.ramp ? ev + 250 : Math.max(ev + 250, (f.W >> 1) + 100);
      for (let u = -2450; u < 1500 && ok; u += 100) for (let v = vMin; v <= vMax; v += 100) {
        const [px, pz] = W2(u, v); const x = Math.floor(px / 100), z = Math.floor(pz / 100);
        if (x < 0 || z < 0 || x >= N || z >= N) { ok = false; break; }
        const i = z * N + x;
        if (m.mask1[i] !== 2 || (m.reserve && m.reserve[i])) { W_('r_mask'); ok = false; break; } if (m.flags[i] & BLOCK) { W_('r_flag' + (m.flags[i] & BLOCK)); ok = false; break; } const rt = m.reg[i] === 255 ? -99 : mac.regions[m.reg[i]].tier; if (rt !== f.lowH / 300 && rt !== f.highH / 300) { W_('r_reg'); ok = false; break; }
        if (Math.abs(v - ev) <= 250) { if (u < 0) { nLow++; if (rt === f.lowH / 300) nLowIn++; } else { nHigh++; if (rt === f.highH / 300) nHighIn++; } cells.push([i, u, v]); }
      }
      if (!ok) { W_('rect'); continue; } if (nLowIn * 10 < nLow * 7 || nHighIn * 10 < nHigh * 7) { W_('regions'); continue; }
      const [mx, mz] = W2(-300, ev); const sd = spineDist[Math.floor(mz / 100) * N + Math.floor(mx / 100)];
      if (sd < 80 || sd > 300) { W_('spineDist'); continue; }
      const [ex, ez] = W2(-2400, ev), [xx, xz] = W2(1400, ev);
      const E = Math.floor(ez / 100) * N + Math.floor(ex / 100), X = Math.floor(xz / 100) * N + Math.floor(xx / 100);
      let save;
      if (f.ramp) {
        const ws = walkSearch(m, E, { rise: 70, target: X, maxD: 800 });
        const dW = ws.dist[X]; if (dW >= 800) continue;
        save = 100 - Math.trunc((390 * 100) / dW);
      } else {
        const a = Math.abs(ev) - (f.W >> 1); // lateral offset to the ramp edge (cm)
        const dW = isqrt(2100 * 2100 + a * a) + 600 + isqrt(1100 * 1100 + a * a);
        save = 100 - Math.trunc((3900 * 100) / dW);
      }
      if (save < 11 || save > 29) { W_('save' + save); continue; }
      cands.push({ f, side, ev, cells, E, X, save, score: Math.abs(save - 20) * 10 + rng.int(10) + (f.ramp ? 0 : 15) + (f.edge.spine ? 0 : 5) });
    }
  }
  if (globalThis.__TRACE) console.error('[chains]', frames.length, cands.length, JSON.stringify(why));
  cands.sort((a, b) => a.score - b.score || a.f.key - b.f.key || a.side - b.side);
  // two slab patterns; the first two chains always use different ones
  const PATTERNS = [
    { type: 'slab_climb', kit: 'stone_card_flat', slabs: [[-1700, -1400, 140], [-1100, -800, 140], [-500, -200, 280]] },
    { type: 'pillar_steps', kit: 'pillar_short', slabs: [[-1800, -1500, 140], [-1200, -900, 280], [-600, -300, 280]] },
  ];
  let made = 0; const taken = [];
  for (const c of cands) {
    if (made >= 3) break;
    const P = PATTERNS[(made + (rng.int(2) && made === 2 ? 1 : 0)) % 2];
    if (c.cells.some(([i]) => m.flags[i] & (F.CHUNK | F.RAMP | F.SOLID | F.PONLY))) { W_('c_overlap'); continue; }
    if (taken.some((t) => t.edge === c.f.edge && (t.P[0] - c.f.P[0]) ** 2 + (t.P[1] - c.f.P[1]) ** 2 < 4000 * 4000)) continue;
    if (!c.f.ramp && !tryRamp(m, c.f.P, c.f.dir, c.f.W, c.f.lowH, c.f.highH, null, { edge: c.f.edge.id, kind: 'chain_ramp' })) { W_('c_ramp'); continue; }
    if (c.cells.some(([i]) => m.flags[i] & (F.RAMP | F.SOLID))) { W_('c_after'); continue; }
    const W2 = (u, v) => [c.f.P[0] + u * c.f.dir[0] - v * c.f.dir[1], c.f.P[1] + u * c.f.dir[1] + v * c.f.dir[0]];
    for (const [i, u, v] of c.cells) {
      let h = u < 0 ? c.f.lowH : c.f.highH; let fl = F.CHUNK;
      const inSlab = Math.abs(v - c.ev) < 250;
      for (const [u0, u1, dh] of P.slabs) if (inSlab && u >= u0 && u < u1) { h = c.f.lowH + dh; fl |= F.PONLY; }
      m.h0[i] = h; m.flags[i] = (m.flags[i] & ~(F.PONLY | F.SOLID)) | fl; m.nodetail[i] = 1;
    }
    const cellAt = (u) => { const [px, pz] = W2(u, c.ev); return [Math.floor(px / 100), Math.floor(pz / 100)]; };
    const id = m.chunks.length;
    for (let k = 0; k < 3; k++) m.jumps.push({ a: cellAt(P.slabs[k][1] - 50), b: cellAt(k < 2 ? P.slabs[k + 1][0] + 50 : 50), cls: 'G1', chunk: id });
    const [ax, az] = cellAt(-2400);
    m.chunks.push({ id, type: P.type, anchor: [ax, az], rot: 0, mir: 0, tier: Math.trunc(c.f.lowH / 300), region: c.f.edge.low, island: true, tris: 900,
      rect: [ax, az, 1, 1], chain: true, chainEntry: c.E, chainExit: c.X, estSave: c.save, ownRamp: !c.f.ramp });
    const top = cellAt(P.slabs[2][0] + 150); m.slots.push({ tag: 'high_perch', x: top[0], z: top[1], layer: 0, chunk: id, region: c.f.edge.low });
    for (const [u0] of P.slabs) { const p = cellAt(u0 + 150); m.instances.push({ kit: P.kit, x: p[0], z: p[1], y: m.h0[p[1] * N + p[0]], rot: 0 }); }
    taken.push({ edge: c.f.edge, P: c.f.P }); made++;
  }
  if (globalThis.__TRACE) console.error('[chains2]', made, JSON.stringify(why));
  return made;
}

/* ---------- mega landmark: colossal stone card on the keystone region the spine bends around ---------- */
// Target: the keystone region's centre (off the spine by construction); without a keystone, a seeded point in
// the centre third. Kept off lanes, ramps and arenas.
export function placeMegaLandmark(ctx, m) {
  const N = m.N; const C = ctx.C; const mac = m.macro; const rng = ctx.streams.chunks;
  let tx, tz;
  if (mac.keystone >= 0) { const r = mac.regions[mac.keystone]; tx = (r.centre % C) * 8 + 4; tz = ((r.centre / C) | 0) * 8 + 4; }
  else { const c = N >> 1, rr = Math.trunc(((ctx.R - 2) * 8) / 3); tx = c + rng.range(-rr, rr); tz = c + rng.range(-rr, rr); }
  const rMax = 60; const cand = [];
  for (let z = tz - rMax; z <= tz + rMax; z += 2) for (let x = tx - rMax; x <= tx + rMax; x += 2) { if (x < 3 || z < 3 || x >= N - 4 || z >= N - 4) continue; const d = (x - tx) ** 2 + (z - tz) ** 2; if (d <= rMax * rMax) cand.push([d, z * N + x]); }
  cand.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [, i0] of cand) {
    const x0 = i0 % N, z0 = (i0 / N) | 0; let ok = true; const h0 = m.h0[i0];
    for (let dz = -2; dz < 4 && ok; dz++) for (let dx = -2; dx < 4; dx++) { const i = (z0 + dz) * N + x0 + dx; if (m.mask1[i] !== 2 || (m.flags[i] & BLOCK) || (m.reserve && m.reserve[i]) || Math.abs(m.h0[i] - h0) > 50) { ok = false; break; } }
    if (!ok) continue;
    for (let dz = 0; dz < 2; dz++) for (let dx = -1; dx < 3; dx++) { const i = (z0 + dz) * N + x0 + dx; m.flags[i] |= F.SOLID | F.CHUNK; m.h0[i] = h0 + 2000; }
    m.landmarks.push({ type: 'colossal_card', x: x0, z: z0, base: h0, top: h0 + 2000, mega: true, region: m.reg[i0] });
    m.instances.push({ kit: 'colossal_card', x: x0, z: z0, y: h0, rot: 0 });
    return true;
  }
  return false;
}

/* ---------- district heroes: one tall silhouette per district, near its seed; a compass on the ground ---------- */
export function placeHeroes(ctx, m) {
  const N = m.N; const C = ctx.C; const mac = m.macro; let n = 0;
  for (const d of mac.districts) {
    if (d.gate) { m.landmarks.push({ type: d.hero, x: Math.floor(m.arena.x / 100), z: Math.floor(m.arena.z / 100), base: m.h0[Math.floor(m.arena.z / 100) * N + Math.floor(m.arena.x / 100)], top: m.arena.tier * 300 + 900, hero: true, district: d.idx }); n++; continue; }
    const tx = (d.seed % C) * 8 + 4, tz = ((d.seed / C) | 0) * 8 + 4; const cand = [];
    for (let z = tz - 40; z <= tz + 40; z += 2) for (let x = tx - 40; x <= tx + 40; x += 2) { if (x < 4 || z < 4 || x >= N - 6 || z >= N - 6) continue; cand.push([(x - tx) ** 2 + (z - tz) ** 2, z * N + x]); }
    cand.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (const [, i0] of cand) {
      const x0 = i0 % N, z0 = (i0 / N) | 0; const h0 = m.h0[i0]; let ok = mac.regions[m.reg[i0]] && mac.regions[m.reg[i0]].district === d.idx;
      for (let dz = -3; dz < 7 && ok; dz++) for (let dx = -3; dx < 7; dx++) { const i = (z0 + dz) * N + x0 + dx; if (m.mask1[i] !== 2 || (m.flags[i] & BLOCK) || (m.reserve && m.reserve[i]) || Math.abs(m.h0[i] - h0) > 50) { ok = false; break; } }
      if (!ok) continue;
      for (let dz = 0; dz < 4; dz++) for (let dx = 0; dx < 4; dx++) { const i = (z0 + dz) * N + x0 + dx; m.flags[i] |= F.SOLID | F.CHUNK; m.h0[i] = h0 + 900; }
      m.landmarks.push({ type: d.hero, x: x0 + 2, z: z0 + 2, base: h0, top: h0 + 900, hero: true, district: d.idx });
      m.instances.push({ kit: d.hero, x: x0, z: z0, y: h0, rot: 0 });
      n++; break;
    }
  }
  return n;
}

/* ---------- gate approach: a processional avenue of obelisk pairs and a sealed arch in front of the main entrance ---------- */
// Pairs stand 9 m either side of the approach axis at 32, 40 and 48 m from the arena centre, and the arch at
// 56 m, so the gate is framed from the spine 40-60 m out. Every pillar keeps 7 m from the spine path.
export function gateApproach(ctx, m, spineDist) {
  const N = m.N; const a = m.arena; const [dx, dz] = a.mainDir; const placed = [];
  const tryPillar = (along, side, hgt, kit) => {
    const px = a.x + Math.trunc((dx * along) / 1000) - Math.trunc((dz * side) / 1000), pz = a.z + Math.trunc((dz * along) / 1000) + Math.trunc((dx * side) / 1000);
    const x0 = Math.floor(px / 100) - 1, z0 = Math.floor(pz / 100) - 1; if (x0 < 2 || z0 < 2 || x0 >= N - 4 || z0 >= N - 4) return false;
    const cells = []; let hmin = 32767, hmax = -32768;
    for (let k = 0; k < 4; k++) { const i = (z0 + (k >> 1)) * N + x0 + (k & 1); if (!(m.flags[i] & F.WALK) || (m.flags[i] & (BLOCK & ~F.LANE)) || spineDist[i] < 70) return false; cells.push(i); hmin = Math.min(hmin, m.h0[i]); hmax = Math.max(hmax, m.h0[i]); }
    if (hmax - hmin > 60) return false;
    for (const i of cells) { m.flags[i] |= F.SOLID | F.CHUNK; m.h0[i] = hmax + hgt; m.nodetail[i] = 1; }
    m.instances.push({ kit, x: x0, z: z0, y: hmax, rot: 0 }); placed.push([x0, z0]); return true;
  };
  for (const along of [3200, 4000, 4800]) for (const side of [-900, 900]) tryPillar(along, side, 500, 'obelisk');
  const l = tryPillar(5600, -900, 700, 'sealed_arch_pillar'), r = tryPillar(5600, 900, 700, 'sealed_arch_pillar');
  if (l && r) {
    const px = a.x + Math.trunc((dx * 5600) / 1000), pz = a.z + Math.trunc((dz * 5600) / 1000);
    m.landmarks.push({ type: 'sealed_arch', x: Math.floor(px / 100), z: Math.floor(pz / 100), base: m.h0[Math.floor(pz / 100) * N + Math.floor(px / 100)], top: m.h0[Math.floor(pz / 100) * N + Math.floor(px / 100)] + 800, approach: true });
  }
  m.gateApproach = { pillars: placed.length, arch: !!(l && r) };
  return placed.length;
}
