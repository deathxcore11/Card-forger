// §7 validation metrics. Each metric -> {value, threshold, pass, gating}. Cheapest first.
import { F, NONE, los } from './map.js';
import { INF, dijkstra, bfsReach, tarjan, Dial } from './nav.js';
import { BASE, ANY, L, WALKONLY } from './links.js';
import { chamfer, discOffsets, sector8, isqrt } from './imath.js';
import { coverageField } from './events.js';
import { lureSamples, lureOK, economyViolations, spineSamples, approachPoints, visCount, tellOf, visExempt, MAJOR } from './encounters.js';

const mk = (value, threshold, pass, gating = true, extra = {}) => ({ value, threshold, pass: !!pass, gating, ...extra });

export function validate(ctx, m, A, st) {
  const spec = ctx.spec; const N = m.N; const M = {}; const fails = {};
  const W = (i) => (m.flags[i] & F.WALK) !== 0;
  /* V15 jump lint (cheap) */
  let band = 0;
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = z * N + x; if (!W(i)) continue;
    if (x + 1 < N && W(i + 1)) { const d = Math.abs(m.h0[i] - m.h0[i + 1]); if (d >= 181 && d <= 259) band++; }
    if (z + 1 < N && W(i + N)) { const d = Math.abs(m.h0[i] - m.h0[i + N]); if (d >= 181 && d <= 259) band++; }
  }
  const g2 = A.pg.authored.filter((a) => m.jumps[a.k].cls === 'G2');
  let g2bad = 0;
  for (const a of g2) {
    const J = m.jumps[a.k]; const na = (J.a[1] * N + J.a[0]) * 2, nb = (J.b[1] * N + J.b[0]) * 2;
    const linkCost = 10 + Math.trunc(Math.max(0, a.gap) / 10) + 20;
    const d = dijkstra(A.pg, [na], BASE, linkCost * 2);
    // same surface as b
    let best = INF; const hb = m.h0[nb >> 1];
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const c = (J.b[1] + dz) * N + J.b[0] + dx; if (c >= 0 && c < N * N && Math.abs(m.h0[c] - hb) <= 70) best = Math.min(best, d[c * 2]); }
    if (best * 10 > linkCost * 16) g2bad++;
  }
  M.V15 = mk({ forbiddenBand: band, authoredLint: A.pg.lint.length, g2NoAlt: g2bad, authoredJumps: A.pg.authored.length }, 0, band === 0 && A.pg.lint.length === 0 && g2bad === 0);
  if (A.pg.lint.length) fails.lint = A.pg.lint;
  /* V2 required reachability */
  const req = [];
  for (const s of m.slots) req.push({ what: 'slot:' + s.tag, x: s.x, z: s.z, layer: s.layer });
  for (const e of st.encounters) if (e.cls !== 'VASE') req.push({ what: e.type, x: e.x, z: e.z, layer: e.layer });
  for (const c of st.rings) req.push({ what: 'boss_ring', x: c % N, z: (c / N) | 0, layer: 0 });
  for (const e of st.elites) req.push({ what: 'elite_pocket', x: e.x, z: e.z, layer: 0 });
  for (const [x, z] of m.arena.entrances) req.push({ what: 'gate_entrance', x: Math.floor(x / 100), z: Math.floor(z / 100), layer: 0 });
  req.push({ what: 'gate_interior', x: Math.floor(m.arena.x / 100), z: Math.floor(m.arena.z / 100), layer: 0 });
  const unreach = req.filter((r) => A.dSpawn[(r.z * N + r.x) * 2 + r.layer] >= INF);
  M.V2 = mk(Math.trunc(((req.length - unreach.length) * 1000) / Math.max(1, req.length)) / 1000, 1, unreach.length === 0, true, { required: req.length });
  if (unreach.length) fails.unreachable = unreach;
  /* V3 soft-locks */
  const soft = [];
  for (let v = 0; v < A.pg.n; v++) if (A.reachAny[v] && !A.canReturn[v]) soft.push(v);
  const isNode = new Uint8Array(A.pg.n); for (let v = 0; v < A.pg.n; v++) if (A.reachAny[v]) isNode[v] = 1;
  const scc = tarjan(A.pg, BASE, isNode);
  M.V3 = mk(soft.length, 0, soft.length === 0, true, { sccCount: scc.count });
  if (soft.length) fails.softlock = soft.slice(0, 5000);
  /* V4 fall recovery */
  if (spec.falls === 'gully') {
    let pits = 0; for (let i = 0; i < N * N; i++) if (m.flags[i] & F.PIT) pits++;
    const exits = []; const gul = [];
    for (let i = 0; i < N * N; i++) { const v = i * 2; if (!A.reachAny[v]) continue; if (m.flags[i] & F.GULLY) gul.push(v); else if (A.canReturn[v] && A.dSpawn[v] < INF) exits.push(v); }
    let far = 0;
    if (gul.length) { const d = dijkstra(A.prev, exits, BASE, 400); for (const v of gul) if (d[v] > 200) far++; }
    M.V4 = mk({ pits, gullyCells: gul.length, gullyFar: far }, '0 pits, exit <= 20 m', pits === 0 && far === 0);
  } else {
    const src = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) if (m.flags[i] & F.SAFE) src[i] = 1;
    const ds = chamfer(N, src); let edges = 0, bad = 0;
    for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
      const i = z * N + x; if (!W(i) || !A.reachAny[i * 2]) continue;
      if ((m.flags[i + 1] | m.flags[i - 1] | m.flags[i + N] | m.flags[i - N]) & F.PIT) { edges++; if (ds[i] > 120) bad++; }
    }
    M.V4 = mk({ pitEdges: edges, farFromSafe: bad }, 'pit edge <= 12 m from safe ground', bad === 0);
  }
  /* V5 enemy coverage */
  let wTot = 0, wEn = 0;
  for (let i = 0; i < N * N; i++) { if (!W(i) || !A.reachAny[i * 2]) continue; wTot++; if (A.enemy[i * 2]) wEn++; }
  const cov = Math.trunc((wEn * 1000) / Math.max(1, wTot));
  M.V5 = mk({ coverage: cov / 10, unreachablePct: (1000 - cov) / 10 }, '>= 95% / <= 8%', cov >= spec.enemyCover * 10 && 1000 - cov <= 80);
  /* V6 islands */
  const isl = st.islands.islands; const I = spec.islands;
  const badIsl = isl.filter((q) => q.perchMax > I.perchMax || q.area > I.islandMax || q.seerDist > I.seerDist || q.flyerDist > I.flyerDist);
  const islArea = isl.reduce((s, q) => s + q.area, 0);
  M.V6 = mk({ count: isl.length, bad: badIsl.length, areaPct: Math.trunc((islArea * 1000) / Math.max(1, wTot)) / 10 }, `${I.count[0]}-${I.count[1]} islands, perch<=64, island<=120, seer<=25, flyer<=18`,
    spec.rooms || (isl.length >= I.count[0] && isl.length <= I.count[1] && !badIsl.length && islArea * 100 <= I.maxFrac * wTot));       // rooms: perches and islands are placed by the room kit, not counted
  if (badIsl.length) fails.islands = badIsl;
  /* V8 boss rings */
  const ringField = coverageField(m, A, st.rings, spec.bossRingR);
  let worst = 0, worstAt = -1; const rh = new Int32Array(2002); let nR = 0;
  for (let i = 0; i < N * N; i++) { const v = i * 2; if (A.dSpawn[v] >= INF || !A.enemy[v]) continue; const d = ringField[v]; nR++; rh[Math.min(2001, d)]++; if (d > worst) { worst = d; worstAt = i; } }
  let p95 = 0; { let acc = 0; const lim = Math.trunc((nR * 95) / 100); for (let d = 0; d < 2002; d++) { acc += rh[d]; if (acc >= lim) { p95 = d; break; } } }
  fails.ringWorst = [worstAt % N, (worstAt / N) | 0];
  M.V8 = mk({ rings: st.rings.length, p95Path_m: Math.trunc(p95 / 10), worstPath_m: Math.trunc(worst / 10) }, `${spec.bossRings[0]}-${spec.bossRings[1]} rings (the gate arena floor also serves until the gate wakes), 95% of enemy-reachable ground <= ${spec.bossRingCover} m and all <= ${spec.bossRingCoverMax} m path from a ring`,
    st.rings.length >= spec.bossRings[0] && st.rings.length <= spec.bossRings[1] && p95 <= spec.bossRingCover * 10 && worst <= spec.bossRingCoverMax * 10);
  /* V9 spine */
  const sp = m.spine; let narrow = 0, tall = 0;
  const narrowAt = []; for (const c of sp.path) if (sp.clear[c] < 50) { narrow++; narrowAt.push([c % N, (c / N) | 0, sp.clear[c]]); }
  if (narrowAt.length) fails.narrow = narrowAt;
  for (let i = 0; i < N * N; i++) if ((m.flags[i] & F.LANE) && (m.flags[i] & F.CHUNK)) tall++;
  const mac = m.macro; const spE = mac.spineRegions.length - 1;
  M.V9 = mk({ len_m: sp.len_m, ratio: sp.ratio100 / 100, narrowCells: narrow, tallInside: tall, tierChanges: mac.spineChanges, edges: spE }, `${spec.spineLen[0]}-${spec.spineLen[1]} m, path/straight >= ${spec.spineRatioMin / 100}, width >= 12 m, walk/ramp only, 1 to ceil(40%) tier changes`,
    sp.len_m >= spec.spineLen[0] && sp.len_m <= spec.spineLen[1] && narrow === 0 && tall === 0 && mac.spineChanges >= 1 && mac.spineChanges <= Math.max(1, Math.ceil((spE * spec.maxSpineChange) / 100)) && (ctx.fallback || sp.ratio100 >= spec.spineRatioMin));
  /* V10 readability (deck clearance + feature density) */
  let lowDeck = 0; for (let i = 0; i < N * N; i++) if (m.h1[i] !== NONE && m.h1[i] - m.h0[i] < 450) lowDeck++;
  let dense = 0; const cs = m.chunks.filter((c) => c.type !== 'card_bridge');
  for (const c of cs) { const cx = c.rect[0] + (c.rect[2] >> 1), cz = c.rect[1] + (c.rect[3] >> 1); let n = 0; for (const d of cs) { const dx = d.rect[0] + (d.rect[2] >> 1), dz = d.rect[1] + (d.rect[3] >> 1); if (Math.abs(dx - cx) <= 16 && Math.abs(dz - cz) <= 16) n++; } if (n > 3) dense++; }
  M.V10 = mk({ lowDeckCells: lowDeck, denseFeatures: dense }, 'deck clearance >= 4.5 m, <= 3 features per 32 m', lowDeck === 0 && dense === 0);
  /* V11 lure */
  const ls = lureSamples(m, spec.lureEvery); const lureSet = st.encounters.concat(st.lures || []); const lureBad = ls.filter((p) => !lureOK(m, p, lureSet, spec.lureDist));
  M.V11 = mk({ samples: ls.length, failing: lureBad.length }, 'every 40 m of spine sees an off-route landmark within 35 m', lureBad.length === 0);
  if (lureBad.length) fails.lure = lureBad;
  /* V12 landmark visibility */
  const mega = m.landmarks.find((l) => l.mega); let vis = 0, tot = 0;
  if (mega) for (let z = 8; z < N; z += 16) for (let x = 8; x < N; x += 16) { const i = z * N + x; if (!W(i) || !A.reachAny[i * 2]) continue; tot++; if (los(m, x, z, m.h0[i] + 170, mega.x, mega.z, mega.top + 60)) vis++; }
  const megaPct = Math.trunc((vis * 100) / Math.max(1, tot));
  // per-encounter: every landmark seen from >= 1 spine sample within its tell range (Shrines, Broker and Duel
  // Statues from >= 3); golden statues and the stage-1 Echo Forge are secrets and exempt
  const spSamples = spineSamples(m); const appr = approachPoints(m);
  let seen1 = 0, needs3 = 0, seen3 = 0, plinths = 0; const blind = [];
  const lmEnc = st.encounters.filter((e) => e.cls !== 'VASE' && e.cls !== 'GATE' && !visExempt(e.type, ctx.stage));
  for (const e of lmEnc) {
    const T = tellOf(e.type); const top = e.lmTop ?? T.top; if (e.plinth) plinths++;
    let n = visCount(m, spSamples, e.x, e.z, e.y, top, T.range);
    const need = MAJOR[e.type] ? 3 : 1;
    if (!n && need === 1 && m.macro.regions[e.region]?.role !== 'spine' && visCount(m, appr, e.x, e.z, e.y, top, T.range)) n = 1; // seen from the branch's approach point if (need === 3) { needs3++; if (n >= 3) seen3++; }
    if (n >= 1) seen1++; if (n < need) blind.push({ type: e.type, x: e.x, z: e.z, seen: n, need });
  }
  if (blind.length) fails.blind = blind;
  M.V12 = mk({ megaVisiblePct: megaPct, encountersSeenFromSpine: `${seen1}/${lmEnc.length}`, majorSeenFrom3: `${seen3}/${needs3}`, plinths, heroes: m.landmarks.filter((l) => l.hero).length },
    'mega landmark >= 75% of samples; every encounter landmark seen in tell range from >= 1 spine sample (branch rewards: or their approach point), majors from >= 3 spine samples; a hero per district', !!mega && megaPct >= 75 && blind.length === 0 && m.landmarks.filter((l) => l.hero).length >= mac.districts.length);
  /* V13 economy */
  const econ = economyViolations(ctx, m, A, st.encounters).filter((v) => !v.soft);
  M.V13 = mk(econ.length, 0, econ.length === 0, true, { rules: econ.map((v) => v.why) });
  /* V14 branch value */
  const empty = mac.regions.filter((r) => r.role !== 'spine' && !st.encounters.some((e) => e.region === r.id && e.cls !== 'VASE' && e.cls !== 'GATE' && e.R >= 100));
  M.V14 = mk(empty.length, 0, empty.length === 0, true, { regions: empty.map((r) => r.id) });
  /* V16 rhythm */
  const chains = rhythm(ctx, m, A);
  const good = chains.filter((c) => c.ok);
  const goodTypes = new Set(good.map((c) => c.type));
  M.V16 = mk({ chains: good.length, types: goodTypes.size, candidates: chains.length, detail: chains }, `>= ${spec.rhythm.min} chains (3-6 moves, 25-60 m, save 10-35%) of >= 2 different chunk types`, spec.rooms || (good.length >= spec.rhythm.min && goodTypes.size >= Math.min(2, spec.rhythm.min)));
  /* V17 perf */
  const perf = perfBudget(m, st);
  M.V17 = mk(perf, spec.budgets, perf.tris <= spec.budgets.tris && perf.visTris <= spec.budgets.visTris && perf.draws <= spec.budgets.draws && perf.instances <= spec.budgets.instances);
  /* V19 per-seed blandness */
  const hist = {}; let walkN = 0;
  for (let i = 0; i < N * N; i++) { if (!W(i)) continue; walkN++; const t = Math.floor((m.h0[i] + 150) / 300); hist[t] = (hist[t] || 0) + 1; }
  const topShare = Math.max(...Object.values(hist)) * 100 / Math.max(1, walkN) | 0;
  const ledgeBlocks = new Set();
  for (let v = 0; v < A.pg.n; v += 2) for (let e = A.pg.off[v]; e < A.pg.off[v + 1]; e++) if (A.pg.cls[e] === L.HOP || A.pg.cls[e] === L.G1) { const c = v >> 1; ledgeBlocks.add(((c / N / 4) | 0) * 1000 + ((c % N) >> 2)); break; }
  const plainPct = largestPlainPct(m);
  M.V19 = mk({ topTierSharePct: topShare, largestPlainPct: plainPct, ledges: ledgeBlocks.size }, `top tier <= ${spec.maxTopTierPct}% of walkable area, largest +-1 m plain <= ${spec.maxPlainPct}%, >= 25 ledges`,
    spec.rooms || (topShare <= spec.maxTopTierPct && plainPct <= spec.maxPlainPct && ledgeBlocks.size >= 25));       // rooms are flat on purpose
  /* V7 spawn ring (most expensive) */
  const sr = spawnRing(ctx, m, A);
  // tolerance: up to 3% of samples (cliff-backed corners, pocket ends, tier tops) may reach fewer sectors,
  // but never zero; the valid-fraction rule is strict
  const hard = sr.bad.filter((b) => b.frac < spec.spawnRing.minFrac || b.cells < spec.spawnRing.minCells || b.sectors < 1);
  M.V7 = mk({ samples: sr.samples, failing: sr.bad.length, hardFailing: hard.length, minFracPct: sr.minFrac }, `>= ${spec.spawnRing.minFrac}% of the ground (chasm cells excluded) and >= ${spec.spawnRing.minCells} m2 valid in 22-30 m, >= 3 sectors with path <= 1.8x (<= ${spec.spawnRing.tolPct}% of samples fewer, never 0)`,
    hard.length === 0 && sr.bad.length * 100 <= sr.samples * spec.spawnRing.tolPct);
  if (sr.bad.length) fails.spawnRing = sr.bad;
  const order = ['V15', 'V2', 'V3', 'V4', 'V5', 'V6', 'V8', 'V9', 'V10', 'V11', 'V12', 'V13', 'V14', 'V16', 'V17', 'V19', 'V7'];
  const failing = order.filter((k) => M[k].gating && !M[k].pass);
  return { metrics: M, failing, fails, chains };
}

// Largest plain: 4-connected walkable cells within +-1 m of the cell the flood starts from (scan order), as a
// share of all walkable cells. Same definition the review used.
export function largestPlainPct(m) {
  const N = m.N, h = m.h0, fl = m.flags; const seen = new Uint8Array(N * N); const q = new Int32Array(N * N); let walk = 0, best = 0;
  for (let i = 0; i < N * N; i++) if (fl[i] & F.WALK) walk++;
  for (let i = 0; i < N * N; i++) {
    if (seen[i] || !(fl[i] & F.WALK)) continue; const h0 = h[i]; let qh = 0, qt = 0; q[qt++] = i; seen[i] = 1;
    while (qh < qt) { const c = q[qh++], x = c % N; for (const j of [x + 1 < N ? c + 1 : -1, x > 0 ? c - 1 : -1, c + N < N * N ? c + N : -1, c - N]) { if (j < 0 || seen[j] || !(fl[j] & F.WALK) || Math.abs(h[j] - h0) > 100) continue; seen[j] = 1; q[qt++] = j; } }
    if (qt > best) best = qt;
  }
  return Math.trunc((best * 100) / Math.max(1, walk));
}

export function rhythm(ctx, m, A) {
  const R = ctx.spec.rhythm; const out = [];
  for (const c of m.chunks) {
    if (!c.chain) continue;
    const E = c.chainEntry * 2, X = c.chainExit * 2;
    const p = dijkstra(A.pg, [E], BASE, 900, true);
    const dP = p.dist[X];
    const w = dijkstra(A.pg, [E], WALKONLY, 2000);
    const dW = w[X];
    let moves = 0; const path = [];
    if (dP < INF) for (let v = X; p.par[v] >= 0; v = p.par[v]) { const u = p.par[v]; path.push(v >> 1, u >> 1); for (let e = A.pg.off[u]; e < A.pg.off[u + 1]; e++) if (A.pg.to[e] === v && A.pg.cost[e] + p.dist[u] === p.dist[v]) { if (A.pg.cls[e] !== L.WALK) moves++; break; } }
    const save = dP < INF && dW < INF ? 100 - Math.trunc((dP * 100) / dW) : -1;
    const len = dP < INF ? Math.trunc(dP / 10) : -1;
    const ok = dP < INF && moves >= R.moves[0] && moves <= R.moves[1] && len >= R.len[0] && len <= R.len[1] && save >= R.save[0] && save <= R.save[1];
    const rec = { chunk: c.id, type: c.type, moves, len_m: len, walk_m: dW < INF ? Math.trunc(dW / 10) : -1, savePct: save, ok }; Object.defineProperty(rec, 'path', { value: path, enumerable: false }); out.push(rec);
  }
  return out;
}

function perfBudget(m, st) {
  const N = m.N; let cliffQuads = 0;
  for (let z = 0; z < N - 1; z += 2) for (let x = 0; x < N - 1; x += 2) { const i = z * N + x; if (Math.abs(m.h0[i] - m.h0[i + 2 < N * N ? i + 2 : i]) > 75) cliffQuads++; if (z + 2 < N && Math.abs(m.h0[i] - m.h0[i + 2 * N]) > 75) cliffQuads++; }
  const terrain = ((N / 2) * (N / 2)) * 2 / 2 + cliffQuads * 2; // field cells decimated to 4 m (about half)
  const chunkT = m.chunks.reduce((s, c) => s + c.tris, 0) + m.landmarks.length * 600;
  const encT = st.encounters.length * 400 + st.vases.length * 3 * 60;
  const props = m.instances.length + st.vases.reduce((s, v) => s + v.cluster, 0) + (m.scatter?.length || 0) + st.encounters.length;
  const tris = Math.trunc(terrain + chunkT + encT + (m.scatter?.length || 0) * 80);
  // visible from a spine sample: everything within the 90 m fog radius
  let visTris = 0;
  for (let k = 0; k < m.spine.path.length; k += 40) {
    const c = m.spine.path[k]; const x = c % N, z = (c / N) | 0; let t = Math.trunc((terrain * 3.14159 * 90 * 90) / (N * N)) | 0;
    for (const ch of m.chunks) { const dx = ch.rect[0] - x, dz = ch.rect[1] - z; if (dx * dx + dz * dz < 8100) t += ch.tris; }
    for (const e of st.encounters) if ((e.x - x) ** 2 + (e.z - z) ** 2 < 8100) t += 400;
    visTris = Math.max(visTris, t);
  }
  // unique set pieces (heroes, mega card, arch pillars) merge into the 96 m static sections; repeated kits are
  // InstancedMesh buckets (one draw each)
  const kc = {}; for (const i of m.instances) kc[i.kit] = (kc[i.kit] || 0) + 1;
  const buckets = Object.values(kc).filter((n) => n >= 2).length; const draws = 16 + 1 + buckets + 6;
  return { tris, visTris, draws, instances: props };
}

function spawnRing(ctx, m, A) {
  const S = ctx.spec.spawnRing; const N = m.N; const eg = A.eg;
  const ann = []; for (let dz = -S.outer; dz <= S.outer; dz++) for (let dx = -S.outer; dx <= S.outer; dx++) { const d2 = dx * dx + dz * dz; if (d2 >= S.inner * S.inner && d2 <= S.outer * S.outer) ann.push([dx, dz, sector8(dx, dz), isqrt(d2 * 100)]); }
  const full = new Int32Array(8); for (const a of ann) full[a[2]]++;
  ann.sort((a, b) => Math.abs(a[3] - 260) - Math.abs(b[3] - 260) || a[1] - b[1] || a[0] - b[0]);
  const samples = [];
  const sp = m.spine.path; for (let k = 0; k < sp.length; k += 8) samples.push(sp[k]);
  for (let z = 8; z < N; z += 16) for (let x = 8; x < N; x += 16) { const i = z * N + x; if ((m.flags[i] & F.WALK) && A.dSpawn[i * 2] < INF) samples.push(i); }
  const valid = (i) => (m.flags[i] & F.WALK) && A.enemy[i * 2] && !(m.flags[i] & (F.PONLY | F.SOLID));
  const dist = new Int32Array(eg.n).fill(INF); const touched = []; const q = new Dial(256); const secOf = new Uint8Array(eg.n); const marked = [];
  const bad = []; let minFrac = 100; let n = 0;
  for (let s of samples) {
    if (!A.enemy[s * 2]) { // measure from the foot ring
      const x0 = s % N, z0 = (s / N) | 0; let f = -1;
      for (const [dx, dz] of discOffsets(12)) { const x = x0 + dx, z = z0 + dz; if (x < 0 || z < 0 || x >= N || z >= N) continue; const j = z * N + x; if (valid(j)) { f = j; break; } }
      if (f < 0) continue; s = f;
    }
    n++;
    const x0 = s % N, z0 = (s / N) | 0;
    let inb = 0, ok = 0; const secIn = new Int32Array(8), secOk = new Int32Array(8); const target = [[], [], [], [], [], [], [], []];
    for (const [dx, dz, sec] of ann) {
      const x = x0 + dx, z = z0 + dz; if (x < 0 || z < 0 || x >= N || z >= N) continue; const j = z * N + x;
      if (m.mask1[j] !== 2 || (m.flags[j] & F.PIT)) continue; inb++; secIn[sec]++; // chasm / sand-sea cells are not ground: flyers cover them, ground spawns cannot
      if (valid(j)) { ok++; secOk[sec]++; target[sec].push(j); }
    }
    const frac = Math.trunc((ok * 100) / Math.max(1, inb)); minFrac = Math.min(minFrac, frac);
    // enemy path back to the sample for one point per populated sector (early exit once all are settled)
    const tg = []; for (let k = 0; k < 8; k++) if (secOk[k] >= Math.max(4, (secIn[k] * 5) / 100) && target[k].length) tg.push(k);
    for (const v of touched) dist[v] = INF; touched.length = 0; q.reset();
    // up to 8 targets per sector, spread over the whole sector (a single cluster behind one kerb must not fail a sector)
    for (const k of tg) { const T = target[k]; const step = Math.max(1, Math.trunc(T.length / 8)); for (let q2 = 0; q2 < T.length; q2 += step) { const t = T[q2]; secOf[t * 2] = k + 1; marked.push(t * 2); } }
    const sN = s * 2; dist[sN] = 0; touched.push(sN); q.push(0, sN);
    const lim = Math.trunc((S.pathRatio10 * (S.outer * 10)) / 10) + 20; let okSec = 0; const got = new Uint8Array(8);
    while (q.count && okSec < S.minSectors) { // stops at 3; need <= 3
      const u = q.pop(); const d = q.cur; if (d !== dist[u]) continue; if (d > lim) break;
      const sk = secOf[u];
      if (sk && !got[sk - 1]) { const t = u >> 1; const straight = isqrt((((t % N) - x0) ** 2 + (((t / N) | 0) - z0) ** 2) * 100); if (d * 10 <= S.pathRatio10 * straight) { got[sk - 1] = 1; okSec++; } }
      for (let e = eg.off[u]; e < eg.off[u + 1]; e++) { const v = eg.to[e]; const nd = d + eg.cost[e]; if (nd < dist[v]) { if (dist[v] === INF) touched.push(v); dist[v] = nd; q.push(nd, v); } }
    }
    for (const v of marked) secOf[v] = 0; marked.length = 0;
    let pop = 0; for (let k = 0; k < 8; k++) if (secIn[k] * 2 >= full[k]) pop++; // sectors mostly inside the playable mask
    const need = Math.min(S.minSectors, pop);
    if (frac < S.minFrac || ok < S.minCells || okSec < need) bad.push({ x: x0, z: z0, frac, cells: ok, sectors: okSec, need });
  }
  return { samples: n, bad, minFrac };
}

