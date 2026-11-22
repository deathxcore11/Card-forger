// G8 arenas/reservations and G14 event anchors: timed-boss rings, elite ambush pockets, spawn mouths,
// boss entry points, safe ground. Runtime-director data for the run structure.
import { F, los } from './map.mjs';
import { discOffsets, isqrt, DIR16, chamfer } from './imath.mjs';
import { dijkstra, INF, Dial } from './nav.mjs';
import { BASE } from './links.mjs';

const BAD = F.PONLY | F.SOLID | F.ARENA | F.GULLY | F.ENTRY | F.RAMP | F.PIT | F.SLIDE;

export function flattenRing(m, c, r = 14) { // level a boss ring disc, blending a 3 m skirt
  const N = m.N, h = m.h0; const hc = h[c]; const x0 = c % N, z0 = (c / N) | 0; let changed = 0;
  for (const [dx, dz] of discOffsets(r + 3)) {
    const i = (z0 + dz) * N + x0 + dx; const d = isqrt((dx * dx + dz * dz) * 100);
    const nh = d <= r * 10 ? hc : hc + Math.trunc(((h[i] - hc) * (d - r * 10)) / 30);
    if (nh !== h[i]) { h[i] = nh; changed++; }
  }
  return changed;
}

// The gate arena floor doubles as a timed-boss ring until the gate wakes, so it counts as a source too.
export function arenaCell(m) { return Math.floor(m.arena.z / 100) * m.N + Math.floor(m.arena.x / 100); }
export function coverageField(m, A, rings, r = 14, maxD = INF) {
  const N = m.N; const disc = discOffsets(r); const src = [];
  for (const c of rings) for (const [dx, dz] of disc) src.push((c + dz * N + dx) * 2);
  if (m.arena) { const c = arenaCell(m); for (const [dx, dz] of discOffsets(Math.trunc(m.arena.r / 100))) src.push((c + dz * N + dx) * 2); }
  return dijkstra(A.prev, src, BASE, maxD);
}

export function exposureAt(m, A, c) { // per mille enemy-walkable open fraction within 12 m (2 m lattice)
  const N = m.N; const x0 = c % N, z0 = (c / N) | 0; let tot = 0, open = 0;
  for (let dz = -12; dz <= 12; dz += 2) for (let dx = -12; dx <= 12; dx += 2) {
    if (dx * dx + dz * dz > 144) continue; const x = x0 + dx, z = z0 + dz; tot++;
    if (x < 0 || z < 0 || x >= N || z >= N) continue; const i = z * N + x;
    if ((m.flags[i] & F.WALK) && A.enemy[i * 2]) open++;
  }
  return Math.trunc((open * 1000) / tot);
}

export function placeElitePockets(ctx, m, A, rings) {
  const N = m.N; const rng = ctx.streams.events; const mac = m.macro;
  const want = rng.range(3, 5); const cands = [];
  for (let z = 4; z < N; z += 8) for (let x = 4; x < N; x += 8) {
    const i = z * N + x;
    if (!(m.flags[i] & F.WALK) || (m.flags[i] & (F.PONLY | F.ARENA | F.SPAWNB | F.GULLY)) || !A.enemy[i * 2]) continue;
    const r = mac.regions[m.reg[i]]; if (!r || r.role === 'spine' || r.archetype === 'setpiece') continue;
    const off = A.dSpine[i * 2]; if (off >= INF || off < 200) continue;
    if (rings.some((c) => (c % N - x) ** 2 + (((c / N) | 0) - z) ** 2 < 24 * 24)) continue;
    if ((x * 100 + 50 - m.spawn.x) ** 2 + (z * 100 + 50 - m.spawn.z) ** 2 < 4000 * 4000) continue;
    const exp = exposureAt(m, A, i);
    const R = Math.trunc((off * 10) / 40) + Math.trunc(exp / 10); // x100
    cands.push({ i, R, score: R + rng.int(30) });
  }
  cands.sort((a, b) => b.score - a.score || a.i - b.i);
  const out = [];
  for (const c of cands) {
    if (out.length >= want) break;
    if (c.R < 150 && cands.filter((q) => q.R >= 150).length >= want) continue;
    if (out.some((o) => (o.i % N - c.i % N) ** 2 + (((o.i / N) | 0) - ((c.i / N) | 0)) ** 2 < 50 * 50)) continue;
    out.push(c);
  }
  return out.map((c) => ({ x: c.i % N, z: (c.i / N) | 0, R: c.R }));
}

export function eventAnchors(ctx, m, A, rings) {
  const N = m.N; const h = m.h0;
  // spawn mouths: ramp feet and gully exit feet, enemy reachable
  const mouths = [];
  for (const r of m.ramps) {
    const px = r.P[0] - r.dir[0] * 700, pz = r.P[1] - r.dir[1] * 700; const x = Math.floor(px / 100), z = Math.floor(pz / 100);
    if (x >= 0 && z >= 0 && x < N && z < N && A.enemy[(z * N + x) * 2]) mouths.push([x, z, 'ramp_foot']);
  }
  for (const g of m.gullies) for (const s of g.exits) {
    let acc = 0; for (let k = 1; k < g.poly.length; k++) { const d = isqrt((g.poly[k][0] - g.poly[k - 1][0]) ** 2 + (g.poly[k][1] - g.poly[k - 1][1]) ** 2); if (acc + d >= s) { const x = Math.floor(g.poly[k][0] / 100), z = Math.floor(g.poly[k][1] / 100); if (A.enemy[(z * N + x) * 2]) mouths.push([x, z, 'gully_mouth']); break; } acc += d; }
  }
  mouths.sort((a, b) => (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0) || a[1] - b[1] || a[0] - b[0]); // plain code-unit compare, no locale
  const spread = [];
  for (const mth of mouths) { if (spread.length >= 10) break; if (spread.some((s) => (s[0] - mth[0]) ** 2 + (s[1] - mth[1]) ** 2 < 400)) continue; spread.push(mth); }
  // boss entries: 4 per ring, 30-40 m out, hidden from the ring centre where possible
  const bossEntry = rings.map((c) => {
    const cx = c % N, cz = (c / N) | 0; const hidden = [], open = [];
    for (const [dx, dz] of DIR16) for (const rr of [35, 30, 40]) {
      const x = cx + Math.trunc((dx * rr) / 1000), z = cz + Math.trunc((dz * rr) / 1000); if (x < 0 || z < 0 || x >= N || z >= N) continue;
      const i = z * N + x; if (!A.enemy[i * 2]) continue;
      (los(m, cx, cz, h[c] + 170, x, z, h[i] + 170) ? open : hidden).push([x, z]); break;
    }
    const pick = []; const take = (list) => { for (const p of list) { if (pick.length >= 4) break; if (pick.some((q) => (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 < 300)) continue; pick.push(p); } };
    take(hidden); take(open);
    return pick;
  });
  // safe ground (pit / sand respawn)
  const safe = new Uint8Array(Math.ceil((N * N) / 8));
  let safeN = 0;
  for (let i = 0; i < N * N; i++) {
    if ((m.flags[i] & F.WALK) && !(m.flags[i] & F.PONLY) && A.pg.p3[i] && A.dSpawn[i * 2] < INF && A.canReturn[i * 2]) { safe[i >> 3] |= 1 << (i & 7); m.flags[i] |= F.SAFE; safeN++; }
  }
  return { spawnMouths: spread, bossEntry, safeGround: safe, safeCount: safeN };
}

/* ---------- G8 boss-ring reservation on a 2 m search grid (before chunks, so no kit can take the spots) ---------- */
export function reserveBossRings(ctx, m) {
  const spec = ctx.spec; const N = m.N; const G = N >> 1; const r = spec.bossRingR;
  const h = m.h0, fl = m.flags;
  const pass = new Uint8Array(G * G), gh = new Int16Array(G * G);
  for (let Z = 0; Z < G; Z++) for (let X = 0; X < G; X++) {
    const i = 2 * Z * N + 2 * X; const c = [i, i + 1, i + N, i + N + 1]; let ok = true, mn = 32767, mx = -32768;
    for (const j of c) { if (!(fl[j] & F.WALK) || (fl[j] & F.PONLY)) { ok = false; break; } mn = Math.min(mn, h[j]); mx = Math.max(mx, h[j]); }
    if (ok && mx - mn <= 110) { pass[Z * G + X] = 1; gh[Z * G + X] = h[i]; }
  }
  const NB = [[1, 0, 20], [-1, 0, 20], [0, 1, 20], [0, -1, 20], [1, 1, 28], [-1, 1, 28], [1, -1, 28], [-1, -1, 28]];
  // 2 m grid as CSR (built once, searched many times)
  const goff = new Int32Array(G * G + 1), gto = new Int32Array(G * G * 8), gcost = new Uint8Array(G * G * 8); let ge = 0;
  for (let u = 0; u < G * G; u++) {
    goff[u] = ge; if (!pass[u]) continue; const X = u % G, Z = (u / G) | 0;
    for (let k = 0; k < 8; k++) { const [dx, dz, c] = NB[k]; const xx = X + dx, zz = Z + dz; if (xx < 0 || zz < 0 || xx >= G || zz >= G) continue; const v = zz * G + xx; if (!pass[v] || Math.abs(gh[v] - gh[u]) > 120) continue; if (k >= 4 && (!pass[Z * G + xx] || !pass[zz * G + X])) continue; gto[ge] = v; gcost[ge] = c; ge++; }
  }
  goff[G * G] = ge;
  const q = new Dial(256); const dist = new Int32Array(G * G);
  const run = (srcs) => {
    dist.fill(INF); q.reset();
    for (const s of srcs) { dist[s] = 0; q.push(0, s); }
    while (q.count) {
      const u = q.pop(); const d = q.cur; if (d !== dist[u]) continue;
      for (let e = goff[u], e1 = goff[u + 1]; e < e1; e++) { const v = gto[e], nd = d + gcost[e]; if (nd < dist[v]) { dist[v] = nd; q.push(nd, v); } }
    }
    return dist;
  };
  const sN = (Math.floor(m.spawn.z / 200)) * G + Math.floor(m.spawn.x / 200);
  run([sN]); const reach = []; for (let v = 0; v < G * G; v++) if (dist[v] < INF) reach.push(v);
  // candidates: flat-enough 17 m discs, clear of structures (lanes allowed)
  const okC = new Uint8Array(N * N);
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
    const i = z * N + x; if (!(fl[i] & F.WALK) || (fl[i] & BAD) || (fl[i] & F.SPAWNB)) continue;
    if (Math.abs(h[i] - h[i + 1]) > 60 || Math.abs(h[i] - h[i + N]) > 60 || Math.abs(h[i] - h[i - 1]) > 60 || Math.abs(h[i] - h[i - N]) > 60) continue;
    okC[i] = 1;
  }
  // clearance to the nearest unusable cell (chamfer, 10 per cell) prunes most discs before the height test
  const notOk = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) notOk[i] = okC[i] ? 0 : 1;
  const clr = chamfer(N, notOk); const need = (r + 3) * 10 - 10; // conservative: pruning only
  const disc = discOffsets(r + 3); const cands = [];
  for (let z = r + 3; z < N - r - 3; z += 4) for (let x = r + 3; x < N - r - 3; x += 4) {
    const c = z * N + x; if (clr[c] < need) continue;
    let good = true; for (const [dx, dz] of disc) { const i = c + dz * N + dx; if (!okC[i] || Math.abs(h[i] - h[c]) > 160) { good = false; break; } }
    if (good) cands.push(c);
  }
  const reachMask = new Uint8Array(G * G); for (const v of reach) reachMask[v] = 1;
  const cl = cands.filter((c) => reachMask[(((c / N) | 0) >> 1) * G + ((c % N) >> 1)]);
  if (!cl.length) return { rings: [], worst: INF };
  const gdisc = discOffsets(r >> 1);
  const adisc = discOffsets(Math.trunc(m.arena.r / 200)); const ac = arenaCell(m);
  const srcOf = (rings) => { const s = []; for (const c of rings.concat([ac])) { const X = (c % N) >> 1, Z = ((c / N) | 0) >> 1; for (const [dx, dz] of (c === ac ? adisc : gdisc)) { const v = (Z + dz) * G + X + dx; if (v >= 0 && v < G * G && pass[v]) s.push(v); } } return s; };
  // score = how far the set is from the V8 targets (95th percentile <= cover, worst <= coverMax), 0 when met
  const cover = spec.bossRingCover * 10 - 100, coverMax = spec.bossRingCoverMax * 10 - 100; const [nMin, nMax] = spec.bossRings; // 10 m margin: chunks and finishing add detours after rings are reserved
  const worstOf = (rings) => {
    run(srcOf(rings)); let w = -1, wd = -1; const ds = new Int32Array(reach.length);
    reach.forEach((v, k) => { ds[k] = dist[v]; if (dist[v] > wd) { wd = dist[v]; w = v; } });
    ds.sort(); const p95 = ds[Math.trunc((ds.length * 95) / 100)] ?? 0;
    return [w, Math.max(0, p95 - cover) * 2 + Math.max(0, wd - coverMax) + cover];
  };
  const nearestTo = (v, excl) => { // candidate with the smallest grid path distance to v
    run([v]); let b = -1, bd = INF; for (const c of cl) { if (excl.includes(c)) continue; const d = dist[(((c / N) | 0) >> 1) * G + ((c % N) >> 1)]; if (d < bd) { bd = d; b = c; } } return [b, bd];
  };
  let sx = 0, sz = 0; for (const v of reach) { sx += v % G; sz += (v / G) | 0; } sx = (sx / reach.length) | 0; sz = (sz / reach.length) | 0;
  const [c0] = nearestTo(sz * G + sx, []);
  const rings = [c0 >= 0 ? c0 : cl[0]];
  for (;;) {
    const [w, wd] = worstOf(rings); if (wd <= cover || rings.length >= nMax) break;
    const fr = dist.slice(); // ring field from worstOf
    // walk from the worst point back towards the rings until ~55 m out, then take the nearest candidate there
    run([w]); let best = -1, bs = -1; const field = dist;
    for (const c of cl) { if (rings.includes(c)) continue; const v = (((c / N) | 0) >> 1) * G + ((c % N) >> 1); if (field[v] > cover - 100) continue; if (fr[v] > bs) { bs = fr[v]; best = c; } }
    if (best < 0) { const [b] = nearestTo(w, rings); if (b < 0) break; best = b; }
    rings.push(best);
  }
  // local search: move single rings towards the current worst point when it lowers the worst distance
  let [, cur] = worstOf(rings); let evals = 0;
  for (let it = 0; it < 40 && cur > cover; it++) {
    const [w] = worstOf(rings); run([w]); const fw = dist.slice();
    const near = cl.filter((c) => !rings.includes(c) && fw[(((c / N) | 0) >> 1) * G + ((c % N) >> 1)] <= cover).slice(0, 400);
    let improved = false;
    for (let k = 0; k < rings.length && !improved; k++) {
      // try the 3 candidates closest to the worst point
      const order = near.map((c) => [fw[(((c / N) | 0) >> 1) * G + ((c % N) >> 1)], c]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).filter((_, k) => k % 7 === 0).slice(0, 5);
      for (const [, c] of order) { const t = rings.slice(); t[k] = c; if (evals >= 120) break; const [, wd] = worstOf(t); evals++; if (wd < cur) { rings[k] = c; cur = wd; improved = true; break; } }
    }
    if (!improved) break;
  }
  while (rings.length < nMin) { run(srcOf(rings)); let b = -1, bs = -1; for (const c of cl) { if (rings.includes(c)) continue; const d = dist[(((c / N) | 0) >> 1) * G + ((c % N) >> 1)]; if (d < INF && d > bs) { bs = d; b = c; } } if (b < 0) break; rings.push(b); }
  for (const c of rings) flattenRing(m, c, r);
  m.reserve = m.reserve || new Uint8Array(N * N);
  for (const c of rings) for (const [dx, dz] of discOffsets(r + 2)) m.reserve[c + dz * N + dx] = 1;
  m.rings = rings;
  return { rings, worst: cur, evals };
}
