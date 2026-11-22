// Independent ballistic oracle (test tool, floats allowed; not generator code). Adapted from the verifier checker.
// node tools/physcheck.mjs SEED|SEAL STAGE  -> JSON. physCheck(seal, stage, {edgesOnly}) for scripts.
// Independent physics checker. Uses only the generator's output fields (h0,h1,flags,mask1) + encounter list.
import { generateStage } from '../generate.mjs';
import { F, NONE } from '../map.mjs';
import { L, BASE } from '../links.mjs';

const G = 2800, V0 = Math.sqrt(2 * 2800 * 220), TUP = V0 / G; // cm, s
const SPEEDS_ND = [900, 800, 700, 600, 500, 400, 300, 200, 120];
const DASHES = [0, 0.1, 0.2, TUP, 0.5];
const BACKS = [0, 30, 60, 100, 150, 200, 300];

export function physCheck(seed, stage, opts = {}) {
  if (typeof seed === "string" && /^[0-9]+$/.test(seed)) seed = Number(seed);
  const r = generateStage(seed, stage);
  const m = r.m, N = m.N, h = m.h0, fl = m.flags, A = r.A;
  const inMap = (c) => m.mask1[c] === 2;
  // standable: walkable, or top of a SOLID box inside the playable mask (not PIT)
  const stand = (c) => inMap(c) && !(fl[c] & F.PIT) && ((fl[c] & F.WALK) || (fl[c] & F.SOLID));
  const walkOnly = (c) => (fl[c] & F.WALK) !== 0;
  const cellAt = (px, pz) => { const x = Math.floor(px / 100), z = Math.floor(pz / 100); return (x < 0 || z < 0 || x >= N || z >= N) ? -1 : z * N + x; };
  const gh = (c) => (c < 0 ? 99999 : h[c]); // out of map is a wall

  // simulate: from cell c centre, direction (ux,uz). returns list of landing cells (first contact per profile)
  function sim(c, ux, uz, dash, standFn, wantAll) {
    const sx = (c % N) * 100 + 50, sz = ((c / N) | 0) * 100 + 50; const hs = h[c];
    // own surface extent
    let s = 0, prevH = hs, lastOwn = c;
    for (; s <= 1500; s += 10) { const cc = cellAt(sx + ux * s, sz + uz * s); if (cc < 0 || !standFn(cc) || Math.abs(h[cc] - prevH) > 70) break; prevH = h[cc]; lastOwn = cc; }
    const edge = s - 10;
    const lands = new Set();
    for (const back of BACKS) {
      const s0 = edge - back; const tc0 = cellAt(sx + ux * s0, sz + uz * s0); if (tc0 < 0 || !standFn(tc0)) break; const hT = h[tc0];
      const profiles = dash ? DASHES.map((td) => [900, td]) : SPEEDS_ND.map((v) => [v, -1]);
      for (const [v, td] of profiles) {
        const dt = Math.min(0.012, 10 / (v + (td >= 0 ? 1700 : 0))); for (let t = dt; t < 2.0; t += dt) {
          let x = v * t; if (td >= 0 && t > td) x += 1700 * Math.min(t - td, 0.16);
          const y = hT + V0 * t - 0.5 * G * t * t;
          const ss = s0 + x; const cc = cellAt(sx + ux * ss, sz + uz * ss);
          if (cc < 0) break;
          if (ss <= edge) { if (gh(cc) > y + 5) break; continue; } // still over own surface: ground above the feet stops the arc
          const g = gh(cc);
          if (!inMap(cc)) { if (g > y) break; continue; }
          if (fl[cc] & F.PIT) { if (y < h[cc]) break; continue; }
          if (g >= y) { if (standFn(cc) && g - y <= 30 && cc !== lastOwn) lands.add(cc); break; }
        }
      }
    }
    return [...lands];
  }
  const DIRS = []; for (let k = 0; k < 32; k++) { const a = (k * Math.PI * 2) / 32; DIRS.push([Math.cos(a), Math.sin(a)]); }

  // ---- 1. every BASE (HOP/G1/DROP) edge of the generator's graph must be physical without dash
  const walkNear = (a, b) => { const seen = new Map([[a,0]]); const q=[a]; for (let k=0;k<q.length;k++){const c=q[k]; if(c===b) return true; const d=seen.get(c); if(d>=14) continue; const x=c%N,z=(c/N)|0; for(const[dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const j=(z+dz)*N+x+dx; if(!seen.has(j)&&walkOnly(j)&&Math.abs(h[j]-h[c])<=70){seen.set(j,d+1);q.push(j);}}} return false; };
  const allBad = []; const pg = A.pg; let checked = 0; const bad = [];
  const badByCls = {};
  for (let u = 0; u < pg.n; u += 2) {
    const c = u >> 1;
    for (let e = pg.off[u]; e < pg.off[u + 1]; e++) {
      const k = pg.cls[e]; if (k !== L.HOP && k !== L.G1 && k !== L.DROP) continue;
      const v = pg.to[e]; if (v & 1) continue; const tc = v >> 1;
      if (!(A.dSpawn[u] < 1e9)) continue; // only edges reachable from spawn matter
      checked++;
      const dx = (tc % N) - (c % N), dz = ((tc / N) | 0) - ((c / N) | 0); const len = Math.hypot(dx, dz);
      let ok = walkNear(c, tc);
      for (const da of [0, -0.12, 0.12]) {
        const ca = Math.cos(da), sa = Math.sin(da); const ux = (dx * ca - dz * sa) / len, uz = (dx * sa + dz * ca) / len;
        for (const lc of sim(c, ux, uz, false, walkOnly)) if (Math.abs(h[lc] - h[tc]) <= 70 && Math.hypot(lc % N - tc % N, ((lc / N) | 0) - ((tc / N) | 0)) <= 3) { ok = true; break; }
        if (ok) break;
      }
      if (!ok) { badByCls[k] = (badByCls[k] || 0) + 1; if (opts.edgesOnly) allBad.push([u, v, k]); if (bad.length < 12) bad.push({ cls: ['', 'WALK', 'HOP', 'G1', 'DROP'][k], from: [c % N, (c / N) | 0, h[c]], to: [tc % N, (tc / N) | 0, h[tc]] }); }
    }
  }
  if (opts.edgesOnly) return { r, allBad, checked };
  // ---- 2. own graphs. generous (dash, stand on solids) and strict (no dash, walk cells + solids)
  function buildAdj(dash, standFn) {
    const adj = new Map(); const add = (a, b) => { let l = adj.get(a); if (!l) adj.set(a, l = []); l.push(b); };
    for (let c = 0; c < N * N; c++) {
      if (!standFn(c)) continue; const x = c % N, z = (c / N) | 0; let lip = false;
      for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= N || zz >= N) { lip = true; continue; } const j = zz * N + xx;
        if (standFn(j) && Math.abs(h[j] - h[c]) <= 70) { if (dx && dz) { const a = z * N + xx, b = zz * N + x; if (!(standFn(a) && Math.abs(h[a]-h[c])<=70 && standFn(b) && Math.abs(h[b]-h[c])<=70)) continue; } add(c, j); }
        else if (!dx || !dz) lip = true;
      }
      if (lip) for (const [ux, uz] of DIRS) for (const lc of sim(c, ux, uz, dash, standFn)) add(c, lc);
    }
    return adj;
  }
  const sc = Math.floor(m.spawn.z / 100) * N + Math.floor(m.spawn.x / 100);
  const bfs = (adj, src) => { const seen = new Uint8Array(N * N); const q = [src]; seen[src] = 1; for (let k = 0; k < q.length; k++) { const l = adj.get(q[k]); if (l) for (const v of l) if (!seen[v]) { seen[v] = 1; q.push(v); } } return seen; };
  const rev = (adj) => { const r = new Map(); for (const [a, l] of adj) for (const b of l) { let x = r.get(b); if (!x) r.set(b, x = []); x.push(a); } return r; };
  const gen = buildAdj(true, stand);
  const strictW = buildAdj(false, walkOnly);
  const reachGen = bfs(gen, sc);
  const reachStrict = bfs(strictW, sc);
  const retStrict = bfs(rev(strictW), sc);
  const retGenStand = bfs(rev(buildAdj(false, stand)), sc); // no dash, may use solid tops
  let genReach = 0, soft = 0, softWalk = 0; const softEx = [];
  let escapesMap = 0;
  for (let c = 0; c < N * N; c++) { if (!reachGen[c]) continue; genReach++; if (!retGenStand[c]) { soft++; if (walkOnly(c)) softWalk++; if (softEx.length < 8) softEx.push([c % N, (c / N) | 0, h[c], walkOnly(c) ? 'walk' : 'solid']); } }
  // ---- 3. required targets with strict physics (walk cells, no dash), and return
  const targets = [];
  for (const e of r.st.encounters) if (e.cls !== 'VASE') targets.push([e.type, e.x, e.z, e.layer]);
  for (const c of r.st.rings) targets.push(['ring', c % N, (c / N) | 0, 0]);
  targets.push(['gate', Math.floor(m.arena.x / 100), Math.floor(m.arena.z / 100), 0]);
  const unreach = [], noReturn = [];
  for (const [t, x, z, layer] of targets) {
    if (layer) continue; // decks: skipped by this checker
    const c = z * N + x; let ok = false, ret = false;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const j = (z + dz) * N + x + dx; if (reachStrict[j]) ok = true; if (retStrict[j]) ret = true; }
    if (!ok) unreach.push([t, x, z, h[c]]); if (!ret) noReturn.push([t, x, z, h[c]]);
  }
  // generator-reachable cells my strict model cannot reach
  let genOnly = 0; for (let c = 0; c < N * N; c++) if (A.dSpawn[c * 2] < 1e9 && !reachStrict[c]) genOnly++;
  return { seal: r.sealCode, stage, ok: r.ok, checkedEdges: checked, badEdges: bad.length ? Object.values(badByCls).reduce((a, b) => a + b, 0) : 0, badByCls, badEx: bad,
    genReachCells: genReach, softCells: soft, softWalkCells: softWalk, softEx, unreach, noReturn, genReachNotStrict: genOnly, layer1Targets: targets.filter((t) => t[3]).length };
}
if (process.argv[1]?.endsWith('/physcheck.mjs')) { const o = physCheck(Number(process.argv[2]), Number(process.argv[3])); console.log(JSON.stringify(o, null, 1)); }
