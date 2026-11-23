// The stage generator. generateStage(seed, stageIndex, spec) -> StageMap. Pure and seeded: the same seed gives the same map everywhere.
// Layout: the gate arena and the spawn plaza are placed far apart; three district kits and a handful of fillers fill the ground between;
// then a validator checks the map (reachability with run and jump only, enemy coverage, boss rings, spawn space, economy) and a bounded
// retry loop draws new attempts until one passes. After 8 failures the fixed Colosseum map is used (a fallback, flagged in the report).
// Ground is flat 0; everything else is a primitive, rasterised exactly like the live terrain (src/sim/raster.js).
import { rasterizeInto, WALL } from '../sim/raster.js';
import { sin, cos } from '../sim/dmath.js';
import { CLASSIC_MAP } from '../data/maps.js';
import { splitmix32, fnv1a32, rngFor, stageSeed, attemptSeed, sealCodeFrom, GEN_VERSION } from './seed.js';
import { dist, r2 } from './imath.js';
import { Kit } from './kit.js';
import { KITS, DISTRICT_POOL, FILLER_POOL } from './kits.js';

const HALF = 200, N = 400, BOUNDARY = 195, LAYOUT_R = 186;
const DEG = Math.PI / 180, RAMP_C = 0xb98c56;
const polar = (r, deg) => [r * cos(deg * DEG), r * sin(deg * DEG)];

export const DEFAULT_GEN = {
  minFillers: 1, minPlats: 3, spine: [150, 520], opening: 90, ringCover: 0.88, ringReach: 86, groundCover: 0.9, gateSepMin: 170, spawnAnnulus: 0.4,
  counts: { cchest: 8, stone: 2, broker: 1, shrine: 2, altar: 1, vaseClusters: 12 }, minCounts: { cchest: 6, stone: 1, broker: 1, shrine: 2, altar: 1 }
};

const scale3 = (c, a, b, d) => { const r = Math.min(255, Math.round(((c >> 16) & 255) * a)), g = Math.min(255, Math.round(((c >> 8) & 255) * b)), bl = Math.min(255, Math.round((c & 255) * d)); return (r << 16) | (g << 8) | bl; };
const tintFor = stage => (stage === 1 ? c => scale3(c, 0.74, 0.88, 1.15) : stage === 2 ? c => scale3(c, 0.98, 0.8, 0.42) : c => c);

// ---------- reachability on the 1 m grid ----------
const idx = (i, j) => j * N + i, ci = x => Math.floor(x + HALF), cell = v => v - HALF + 0.5;
const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function bfsEnemy(grid, si, sj) {                      // ground enemies: climb at most 0.6 m per metre, any drop
  const dist = new Int32Array(N * N).fill(-1), q = new Int32Array(N * N); let h = 0, t = 0;
  dist[idx(si, sj)] = 0; q[t++] = idx(si, sj);
  while (h < t) {
    const c = q[h++], i = c % N, j = (c / N) | 0, hc = grid[c];
    for (let k = 0; k < 4; k++) {
      const ni = i + D8[k][0], nj = j + D8[k][1]; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const n = idx(ni, nj); if (dist[n] >= 0) continue; const hn = grid[n];
      if (hn >= 50 || hn - hc > 0.6) continue; dist[n] = dist[c] + 1; q[t++] = n;
    }
  }
  return dist;
}
function bfsPlayer(grid, si, sj) {                     // the player: hop 1.5 m, jump gaps of up to 4 m (3 m on a diagonal), any drop. Dash and air jumps never count.
  const dist = new Int32Array(N * N).fill(-1), q = new Int32Array(N * N); let h = 0, t = 0;
  dist[idx(si, sj)] = 0; q[t++] = idx(si, sj);
  while (h < t) {
    const c = q[h++], i = c % N, j = (c / N) | 0, hc = grid[c];
    for (let k = 0; k < 8; k++) {
      const dx = D8[k][0], dz = D8[k][1], reach = k < 4 ? 4 : 3;
      for (let s = 1; s <= reach; s++) {
        const ni = i + dx * s, nj = j + dz * s; if (ni < 0 || nj < 0 || ni >= N || nj >= N) break;
        const n = idx(ni, nj), hn = grid[n];
        if (hn >= 50) break;
        if (s > 1) { const m = idx(i + dx * (s - 1), j + dz * (s - 1)); if (grid[m] > hc + 0.7) break; }   // no jumping through a wall
        if (dist[n] < 0 && hn - hc <= 1.5) { if (s === 1 || hn <= hc + 1.5) { dist[n] = dist[c] + s; q[t++] = n; } }
      }
    }
  }
  return dist;
}

function flatAt(grid, i, j, rad, tol) {
  const h0 = grid[idx(i, j)]; if (h0 >= 50) return false;
  for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) {
    const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= N || b >= N) return false;
    const h = grid[idx(a, b)]; if (h >= 50 || h - h0 > tol || h0 - h > tol) return false;
  }
  return true;
}
function annulusFrac(grid, ed, x, z) {                 // share of the 22-30 m ring around (x, z) that is ground the swarm can reach
  let ok = 0, tot = 0;
  for (let a = 0; a < 16; a++) for (let r = 22; r <= 30; r += 2) {
    const p = polar(r, a * 22.5), i = ci(x + p[0]), j = ci(z + p[1]); tot++;
    if (i >= 0 && j >= 0 && i < N && j < N && ed[idx(i, j)] >= 0 && grid[idx(i, j)] < 0.05) ok++;
  }
  return ok / tot;
}

// ---------- layout ----------
function tryLayout(as, stage, spec, G) {
  const rd = rngFor(as, 'districts'), rl = rngFor(as, 'regions'), re = rngFor(as, 'encounters'), rs = rngFor(as, 'terrain');
  const prims = [], placed = [], districts = [], tint = tintFor(stage), slotsAll = [];
  const rectGap = (x0, z0, x1, z1, px, pz) => dist(Math.max(x0 - px, 0, px - x1), Math.max(z0 - pz, 0, pz - z1));
  const fits = (cx, cz, r, gap) => dist(cx, cz) + r <= LAYOUT_R && placed.every(p => (p.rect ? rectGap(p.rect.x0, p.rect.z0, p.rect.x1, p.rect.z1, cx, cz) >= r + gap : dist(cx - p.cx, cz - p.cz) >= r + p.r + gap));
  const emit = (id, cx, cz, plan, rng) => {
    const def = KITS[id], rot = rl.int(4), k = new Kit(prims, cx, cz, rot, tint), res = def.build(k, plan, rng) || { slots: [] };
    placed.push({ id, cx, cz, r: plan.r });
    if (def.name && def.role !== 'spawn' && def.role !== 'filler') districts.push({ id, name: def.name, short: def.short, shape: 'circle', cx: r2(cx), cz: r2(cz), r: plan.r, color: def.color });
    for (const s of res.slots || []) { const [x, z] = k.pt(s.x, s.z); slotsAll.push({ tag: s.tag, x, z, y: s.y }); }
    return { k, res };
  };
  // the gate arena, then the spawn plaza far from it
  const gPlan = KITS.colosseum.plan(rl), ga = rl.int(360), gd = 70 + rl.int(46), [gx, gz] = polar(gd, ga);
  const gate = emit('colosseum', gx, gz, gPlan, rngFor(as, 'kit:gate'));
  let sx = 0, sz = 0, ok = false;
  for (let t = 0; t < 80 && !ok; t++) {
    const a = ga + 180 + rl.range(-30, 30), d = 100 + rl.int(50), [px, pz] = polar(d, a);
    if (fits(px, pz, 34, 10) && dist(px - gx, pz - gz) >= G.gateSepMin) { sx = px; sz = pz; ok = true; }
  }
  if (!ok) return { fail: 'spawn placement' };
  emit('plaza', sx, sz, { r: 34 }, rngFor(as, 'kit:spawn'));
  // districts: two of four, with the gate arena that is three districts
  const pool = DISTRICT_POOL.slice(); for (let i = pool.length - 1; i > 0; i--) { const j = rd.int(i + 1); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
  let n = 0;
  for (const id of pool.slice(0, 2).sort((a, b) => KITS[b].plan(rd).r - KITS[a].plan(rd).r)) {
    const plan = KITS[id].plan(rd); let done = false;
    for (let t = 0; t < 300 && !done; t++) { const x = rd.range(-LAYOUT_R, LAYOUT_R), z = rd.range(-LAYOUT_R, LAYOUT_R); if (fits(x, z, plan.r, 8)) { emit(id, x, z, plan, rngFor(as, 'kit:' + (n++))); done = true; } }
    if (!done) return { fail: 'district ' + id };
  }
  // plateaus: raised ground in tiers of 1.4, 3 and 6 m. Each has two enemy ramps (1:2) and, from 3 m up, a hop staircase on a third side,
  // so there are routes for the swarm, routes for the player, and cliffs between them
  const plats = [], kP = new Kit(prims, 0, 0, 0, tint), PC = [0xcdb37c, 0xc9a46a, 0xb8935c];
  for (let n = 0; n < 12; n++) {
    const w = 34 + rl.int(46), d = 28 + rl.int(40), h = rl.pick([1.4, 3, 3, 6]), run = h * 2 + 2, M = Math.floor(run * 0.55) + 3;
    for (let t = 0; t < 70; t++) {
      const cx = rl.range(-LAYOUT_R, LAYOUT_R), cz = rl.range(-LAYOUT_R, LAYOUT_R), x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
      if (dist(cx, cz) + dist(w / 2 + M, d / 2 + M) > LAYOUT_R + 30) continue;
      if (placed.some(p => !p.rect && rectGap(x0 - M, z0 - M, x1 + M, z1 + M, p.cx, p.cz) < p.r + 2)) continue;
      if (plats.some(q => x0 - M < q.x1 + q.M && x1 + M > q.x0 - q.M && z0 - M < q.z1 + q.M && z1 + M > q.z0 - q.M)) continue;
      kP.box(x0, z0, x1, z1, h, PC[h === 1.4 ? 0 : h === 3 ? 1 : 2]);
      const sides = [0, 1, 2, 3]; for (let i = 3; i > 0; i--) { const j = rl.int(i + 1); const s = sides[i]; sides[i] = sides[j]; sides[j] = s; }
      const lat = (a, b) => rl.range(a + 8, b - 8);
      const rampOn = s => {                                           // 0 east, 1 west, 2 south, 3 north
        if (s === 0) { const zc = lat(z0, z1); kP.ramp('x', x1 + run, x1, zc - 5, zc + 5, 0, h, RAMP_C); }
        else if (s === 1) { const zc = lat(z0, z1); kP.ramp('x', x0 - run, x0, zc - 5, zc + 5, 0, h, RAMP_C); }
        else if (s === 2) { const xc = lat(x0, x1); kP.ramp('z', z1 + run, z1, xc - 5, xc + 5, 0, h, RAMP_C); }
        else { const xc = lat(x0, x1); kP.ramp('z', z0 - run, z0, xc - 5, xc + 5, 0, h, RAMP_C); }
      };
      rampOn(sides[0]); rampOn(sides[1]);
      if (h >= 3) {                                                    // hop staircase: 1.4 m steps, then a 0.2-0.4 m last step
        const steps = h === 3 ? [1.4, 2.8] : [1.4, 2.8, 4.2, 5.6], s = sides[2], k = steps.length;
        for (let i = 0; i < k; i++) { const off = (k - i) * 4;          // farthest step is the lowest
          if (s === 0) { const zc = (z0 + z1) / 2; kP.box(x1 + off - 4, zc - 3, x1 + off, zc + 3, steps[i], PC[1]); }
          else if (s === 1) { const zc = (z0 + z1) / 2; kP.box(x0 - off, zc - 3, x0 - off + 4, zc + 3, steps[i], PC[1]); }
          else if (s === 2) { const xc = (x0 + x1) / 2; kP.box(xc - 3, z1 + off - 4, xc + 3, z1 + off, steps[i], PC[1]); }
          else { const xc = (x0 + x1) / 2; kP.box(xc - 3, z0 - off, xc + 3, z0 - off + 4, steps[i], PC[1]); }
        }
      }
      plats.push({ x0, x1, z0, z1, M }); placed.push({ rect: { x0: x0 - M, z0: z0 - M, x1: x1 + M, z1: z1 + M }, cx, cz, r: 0 });
      slotsAll.push({ tag: 'high_perch', x: cx, z: cz, y: h }, { tag: 'reward_port', x: x0 + 6, z: z0 + 6, y: h });
      break;
    }
  }
  if (plats.length < G.minPlats) return { fail: 'too few plateaus (' + plats.length + ')' };
  // low mounds (0.5 m): slide lines and a less flat ground
  for (let i = 0; i < 36; i++) { const x = rs.range(-LAYOUT_R, LAYOUT_R), z = rs.range(-LAYOUT_R, LAYOUT_R); if (dist(x - sx, z - sz) < 40 || dist(x, z) > LAYOUT_R) continue; const w = 6 + rs.int(9); kP.box(x - w, z - w / 2, x + w, z + w / 2, 0.5, 0xd2b27a, { rot: rs.int(180) }); }
  // fillers
  let fillers = 0;
  for (let f = 0; f < 16; f++) {
    const id = rd.pick(FILLER_POOL), plan = KITS[id].plan(rd);
    for (let t = 0; t < 140; t++) { const x = rd.range(-LAYOUT_R, LAYOUT_R), z = rd.range(-LAYOUT_R, LAYOUT_R); if (fits(x, z, plan.r, 7)) { emit(id, x, z, plan, rngFor(as, 'kit:' + (n++))); fillers++; break; } }
  }
  if (fillers < G.minFillers) return { fail: 'too few fillers (' + fillers + ')' };

  // terraces: low 1.2 m platforms (the Stage 1 rise) with 3 m ramps (about 22 degrees), 12 to 20 m across, in the empty ground between kits; a lighter top tone marks the surface as walkable
  const rt = rngFor(as, 'terraces'), TOP = 0xd8b886, TRIM = 0xe0b765; let terraces = 0;
  for (let q = 0; q < 400 && terraces < 10; q++) {
    const w = 12 + rt.int(9), d = 8 + rt.int(7), cx = rt.range(-LAYOUT_R, LAYOUT_R), cz = rt.range(-LAYOUT_R, LAYOUT_R), rr = dist(w / 2 + 3, d / 2 + 3);
    if (dist(cx, cz) + rr > LAYOUT_R || dist(cx - sx, cz - sz) < 48 || !fits(cx, cz, rr + 3, 3)) continue;
    kP.box(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, 1.2, TOP);
    kP.ramp('x', cx + w / 2 + 3, cx + w / 2, cz - 2, cz + 2, 0, 1.2, RAMP_C); kP.ramp('x', cx - w / 2 - 3, cx - w / 2, cz - 2, cz + 2, 0, 1.2, RAMP_C);
    kP.box(cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2 + 0.25, 1.23, TRIM, { y0: 1.17, deco: true }); kP.box(cx - w / 2, cz + d / 2 - 0.25, cx + w / 2, cz + d / 2, 1.23, TRIM, { y0: 1.17, deco: true });       // gold trim on the jump lips
    placed.push({ cx, cz, r: rr + 3 }); terraces++;
  }
  // the spawn hop chain: within 40 m of the spawn and in view of it. A 1.2 m base tier, a 2.4 m tier inset 3 m, and three 5.6 x 3.5 m pads at 3.6 m with 2.8 m gaps. The pads are deep enough that a full held jump (about 7.4 m on the level) lands on the next pad, and a short hop of 2.8 m or more also lands: early game never needs a feathered jump.
  // Every rise next to a walkable cell is 1.2 m, a missed jump lands on the tier below, and the pad edges carry the gold lip trim.
  { const ex = [[1, 0], [0, 1], [-1, 0], [0, -1]].sort((u, v) => (dist(gx - sx - 38 * u[0], gz - sz - 38 * u[1]) - dist(gx - sx - 38 * v[0], gz - sz - 38 * v[1])));
    for (const u of ex) {
      const hx = sx + u[0] * 38, hz = sz + u[1] * 38, rot = u[0] ? 1 : 0;
      if (dist(hx, hz) + 19 > LAYOUT_R || !placed.every(p => p.id === 'plaza' || (p.rect ? rectGap(p.rect.x0, p.rect.z0, p.rect.x1, p.rect.z1, hx, hz) >= 19 : dist(hx - p.cx, hz - p.cz) >= p.r + 19))) continue;
      const kh = new Kit(prims, hx, hz, rot, tint);
      kh.box(-16, -6, 16, 6, 1.2, TOP); kh.ramp('z', 9, 6, -2, 2, 0, 1.2, RAMP_C); kh.box(-13, -3, 13, 3, 2.4, TOP); kh.ramp('x', -16, -13, -2, 2, 1.2, 2.4, RAMP_C);
      for (const [x0, x1] of [[-11, -5.4], [-2.6, 3.0], [5.8, 11.4]]) { kh.box(x0, -1.75, x1, 1.75, 3.6, TOP);
        kh.box(x0, -1.75, x1, -1.5, 3.63, TRIM, { y0: 3.57, deco: true }); kh.box(x0, 1.5, x1, 1.75, 3.63, TRIM, { y0: 3.57, deco: true }); kh.box(x0, -1.75, x0 + 0.25, 1.75, 3.63, TRIM, { y0: 3.57, deco: true }); kh.box(x1 - 0.25, -1.75, x1, 1.75, 3.63, TRIM, { y0: 3.57, deco: true }); }
      const [px, pz] = kh.pt(8.6, 0); slotsAll.push({ tag: 'reward_port', x: px, z: pz, y: 3.6 }); placed.push({ cx: hx, cz: hz, r: 19 }); break;
    }
  }
  // a low mound (0.5 m) never sits on a ramp or on the 3 m of ground in front of its foot: it left a 0.5 m block there and the duelist popped up it
  { const rr = prims.filter(p => p.t === 'ramp').map(p => { const lo = Math.min(p.a0, p.a1), hi = Math.max(p.a0, p.a1), b = p.axis === 'x' ? [lo, hi, p.b0, p.b1] : [p.b0, p.b1, lo, hi]; return [b[0] - 3, b[1] + 3, b[2] - 3, b[3] + 3]; });
    for (let i = prims.length - 1; i >= 0; i--) { const m = prims[i]; if (m.t !== 'box' || m.h !== 0.5 || m.deco || m.c !== 0xd2b27a) continue; const cx = (m.x0 + m.x1) / 2, cz = (m.z0 + m.z1) / 2, r = dist(m.x1 - m.x0, m.z1 - m.z0) / 2; if (rr.some(b => cx + r > b[0] && cx - r < b[1] && cz + r > b[2] && cz - r < b[3])) prims.splice(i, 1); } }
  // rasterise and test
  const grid = new Float32Array(N * N); rasterizeInto(grid, N, HALF, prims, BOUNDARY);
  const spawnI = ci(sx), spawnJ = ci(sz), ed = bfsEnemy(grid, spawnI, spawnJ), pd = bfsPlayer(grid, spawnI, spawnJ);
  if (grid[idx(spawnI, spawnJ)] > 0.01) return { fail: 'spawn is not on ground' };
  const gp = gate.k.pt(gate.res.gate.x, gate.res.gate.z), gb = gate.k.pt(gate.res.boss.x, gate.res.boss.z), gt = gate.k.pt(gate.res.tollPull.x, gate.res.tollPull.z), gc = gate.k.pt(0, 0);
  const metrics = {};
  const gateD = ed[idx(ci(gp[0]), ci(gp[1]))];
  metrics.gateReach = { value: gateD, min: 1, pass: gateD >= 1 && pd[idx(ci(gp[0]), ci(gp[1]))] >= 0 };
  metrics.spine = { value: gateD, min: G.spine[0], max: G.spine[1], pass: gateD >= G.spine[0] && gateD <= G.spine[1] };
  let ground = 0, groundOk = 0; for (let c = 0; c < N * N; c++) if (grid[c] < 0.05) { ground++; if (ed[c] >= 0) groundOk++; }
  metrics.groundCover = { value: groundOk / ground, min: G.groundCover, pass: groundOk / ground >= G.groundCover };
  metrics.spawnSpace = { value: annulusFrac(grid, ed, sx, sz), min: G.spawnAnnulus, pass: annulusFrac(grid, ed, sx, sz) >= G.spawnAnnulus };
  for (const k of Object.keys(metrics)) if (!metrics[k].pass) return { fail: k + ' ' + JSON.stringify(metrics[k]) };

  // boss rings: flat open discs of r 14, reachable by the swarm and the player, covering the map within 70 m
  const cands = [];
  for (let j = 10; j < N - 10; j += 8) for (let i = 10; i < N - 10; i += 8) {
    const x = cell(i), z = cell(j); if (ed[idx(i, j)] < 0 || pd[idx(i, j)] < 0 || x * x + z * z > 150 * 150) continue;
    const h0 = grid[idx(i, j)]; let flat = true;
    for (let r = 4; r <= 14 && flat; r += 5) for (let a = 0; a < 8; a++) { const p = polar(r, a * 45), h = grid[idx(ci(x + p[0]), ci(z + p[1]))]; if (h >= 50 || Math.abs(h - h0) > 0.3) { flat = false; break; } }
    if (flat && dist(x - sx, z - sz) >= 25 && dist(x - gc[0], z - gc[1]) >= 20) cands.push({ x, z, y: h0 });
  }
  const pts = []; for (let j = 0; j < N; j += 4) for (let i = 0; i < N; i += 4) if (ed[idx(i, j)] >= 0) pts.push([cell(i), cell(j)]);
  const covered = new Uint8Array(pts.length), rings = [];
  while (rings.length < 7) {
    let best = -1, bs = 0;
    for (let c = 0; c < cands.length; c++) {
      if (rings.some(r => dist(r.x - cands[c].x, r.z - cands[c].z) < 30)) continue;
      let s = 0; for (let p = 0; p < pts.length; p++) if (!covered[p]) { const dx = pts[p][0] - cands[c].x, dz = pts[p][1] - cands[c].z; if (dx * dx + dz * dz <= G.ringReach * G.ringReach) s++; }
      if (s > bs) { bs = s; best = c; }
    }
    if (best < 0 || bs < 12) break;
    const c = cands[best]; rings.push({ x: r2(c.x), z: r2(c.z), r: 14, y: c.y });
    for (let p = 0; p < pts.length; p++) { const dx = pts[p][0] - c.x, dz = pts[p][1] - c.z; if (dx * dx + dz * dz <= G.ringReach * G.ringReach) covered[p] = 1; }
  }
  let cov = 0; for (let p = 0; p < pts.length; p++) cov += covered[p];
  metrics.bossRings = { value: rings.length, min: 5, max: 7, pass: rings.length >= 5 }; metrics.ringCover = { value: cov / pts.length, min: G.ringCover, pass: cov / pts.length >= G.ringCover };
  if (!metrics.bossRings.pass || !metrics.ringCover.pass) return { fail: 'rings ' + rings.length + ' cover ' + (cov / pts.length).toFixed(2) };

  // encounters
  const taken = [], out = [], pathD = (i, j) => (ed[idx(i, j)] >= 0 ? ed[idx(i, j)] : pd[idx(i, j)] >= 0 ? pd[idx(i, j)] + 25 : -1);
  const cs = [];
  for (const s of slotsAll) { const i = ci(s.x), j = ci(s.z); if (i < 3 || j < 3 || i > N - 4 || j > N - 4) continue; if (Math.abs(grid[idx(i, j)] - s.y) > 0.25 || pd[idx(i, j)] < 0 || !flatAt(grid, i, j, 1, 0.12)) continue; cs.push({ x: s.x, z: s.z, y: s.y, i, j, kit: true, ground: ed[idx(i, j)] >= 0 }); }
  for (let j = 12; j < N - 12; j += 6) for (let i = 12; i < N - 12; i += 6) {
    const x = cell(i), z = cell(j); if (x * x + z * z > 160 * 160 || pd[idx(i, j)] < 0 || !flatAt(grid, i, j, 1, 0.05)) continue;
    cs.push({ x, z, y: grid[idx(i, j)], i, j, kit: false, ground: ed[idx(i, j)] >= 0 });
  }
  for (const c of cs) { c.d = pathD(c.i, c.j); c.score = 0.5 * Math.min(1, c.d / 260) + 0.3 * Math.min(1, c.y / 6) + 0.2 * re.float() + (c.kit ? 0.15 : 0); }
  cs.sort((a, b) => b.score - a.score || a.i - b.i || a.j - b.j);
  const apart = (c, d) => taken.every(t => dist(t.x - c.x, t.z - c.z) >= d);
  const take = (type, rule, count, minApart, extra) => {
    let got = 0;
    for (const c of cs) {
      if (got >= count) break;
      if (!rule(c) || !apart(c, minApart) || (extra && !extra(c, got))) continue;
      if (dist(c.x - sx, c.z - sz) < 12) continue;
      if (dist(c.x - gp[0], c.z - gp[1]) < 12) continue;                 // nothing is placed inside the gate's seal
      taken.push(c); out.push({ type, x: r2(c.x), y: c.y, z: r2(c.z) }); got++;
    }
    return got;
  };
  const C = G.counts, nearChests = () => out.filter(o => o.type === 'cchest' && dist(o.x - sx, o.z - sz) < 60).length;
  take('broker', c => c.ground && c.d >= 80 && c.d <= 160, C.broker, 20);
  take('stone', c => c.d >= 110, C.stone, 60);
  take('altar', c => c.d >= 40, C.altar, 30);
  take('shrine', c => c.ground && c.d >= 30, C.shrine, 70);
  take('cchest', c => c.y >= 1.3 || c.kit, Math.min(3, C.cchest), 25, c => nearChests() < 2);
  take('cchest', c => true, C.cchest - out.filter(o => o.type === 'cchest').length, 25, c => nearChests() < 2);
  const gotOf = t => out.filter(o => o.type === t).length;
  for (const k of Object.keys(G.minCounts)) if (gotOf(k === 'cchest' ? 'cchest' : k) < G.minCounts[k]) return { fail: 'encounters: ' + k + ' ' + gotOf(k) };
  // vase clusters
  const vr = rngFor(as, 'scatter');
  for (let c = 0, tries = 0; c < C.vaseClusters && tries < 400; tries++) {
    const cd = cs[vr.int(cs.length)]; if (!cd.ground || dist(cd.x - sx, cd.z - sz) < 20 || !apart(cd, 4)) continue;
    taken.push(cd); c++;
    const n = 2 + vr.int(3);
    for (let v = 0; v < n; v++) { const a = vr.range(0, 360), r = v === 0 ? 0 : 0.9 + vr.range(0, 1.2), p = polar(r, a), x = cd.x + p[0], z = cd.z + p[1], i = ci(x), j = ci(z); if (Math.abs(grid[idx(i, j)] - cd.y) <= 0.2) out.push({ type: 'vase', x: r2(x), y: cd.y, z: r2(z), banded: vr.chance(0.12) }); }
  }
  // early picks that are not level-ups: one free Card Chest on open ground 14 to 22 m from the spawn (in view of it), and a cluster of three Shrines 30 to 55 m from the spawn, within 25 m of each other, reachable long before 2:00
  { const flatC = c => c.ground && c.y <= 0.05, dS = c => dist(c.x - sx, c.z - sz);
    const fc = cs.find(c => flatC(c) && dS(c) >= 14 && dS(c) <= 22 && apart(c, 6)); if (fc) { taken.push(fc); out.push({ type: 'cchest', x: r2(fc.x), y: fc.y, z: r2(fc.z), free: true }); }
    const anchor = cs.find(c => flatC(c) && dS(c) >= 30 && dS(c) <= 55 && apart(c, 16));
    if (anchor) { taken.push(anchor); out.push({ type: 'shrine', x: r2(anchor.x), y: anchor.y, z: r2(anchor.z) }); let n = 0;
      for (const c of cs) { if (n >= 2) break; const da = dist(c.x - anchor.x, c.z - anchor.z); if (flatC(c) && da >= 16 && da <= 24 && dS(c) >= 24 && apart(c, 16)) { taken.push(c); out.push({ type: 'shrine', x: r2(c.x), y: c.y, z: r2(c.z) }); n++; } } } }
  // economy: the opening region (90 m of path from spawn) holds at most one free reward; stones are kept out of it by the 110 m rule above
  const opening = out.filter(o => o.type === 'stone' && (ed[idx(ci(o.x), ci(o.z))] >= 0 ? ed[idx(ci(o.x), ci(o.z))] : 999) <= G.opening).length;
  metrics.economy = { value: opening, max: 1, pass: opening <= 1 }; metrics.chestsNearSpawn = { value: nearChests(), max: 2, pass: nearChests() <= 2 };
  if (!metrics.economy.pass || !metrics.chestsNearSpawn.pass) return { fail: 'economy' };

  return { ok: true, prims, districts, spawn: { x: r2(sx), z: r2(sz) }, gate: { x: r2(gp[0]), z: r2(gp[1]), radius: 5.5 }, arena: { center: { x: r2(gc[0]), z: r2(gc[1]) }, boss: { x: r2(gb[0]), z: r2(gb[1]) }, tollPull: { x: r2(gt[0]), z: r2(gt[1]) } },
    bossRings: rings, encounters: out, metrics, kits: placed.filter(p => p.id).map(p => p.id) };
}

function canon(m) {
  const P = m.prims.map(p => p.t + ':' + [p.x0, p.z0, p.x1, p.z1, p.x, p.z, p.cx, p.cz, p.r, p.r0, p.r1, p.a0, p.a1, p.b0, p.b1, p.h, p.h0, p.h1, p.y0, p.rot, p.c, p.axis || '', p.deco ? 1 : 0].map(v => (v === undefined ? '' : typeof v === 'number' ? Math.round(v * 100) : v)).join(','));
  return P.join(';') + '|' + JSON.stringify([m.spawn, m.gate, m.arena, m.bossRings, m.encounters]);
}

// seed: the run seed (32 bits). stage: 0, 1, 2. spec: optional overrides of DEFAULT_GEN.
export function generateStage(seed, stage, spec) {
  const G = Object.assign({}, DEFAULT_GEN, spec || {}), lo = seed >>> 0, ss = stageSeed(lo, 0, stage), sealCode = sealCodeFrom(lo, 0), fails = [];
  // attempts 0-7 use the full thresholds; 8-15 relax them step by step but still generate a map (it never falls back to the fixed one)
  const relaxed = Object.assign({}, G, { minFillers: 0, minPlats: 1, ringCover: 0.7, groundCover: 0.8, spine: [90, 800], gateSepMin: 110, spawnAnnulus: 0.3, minCounts: { cchest: 3, stone: 1, broker: 1, shrine: 1, altar: 1 } });
  for (let attempt = 0; attempt < 16; attempt++) {
    const r = tryLayout(attemptSeed(ss, attempt), stage, G.stageSpec || G, attempt < 8 ? G : relaxed);
    if (r.ok) {
      const m = { key: '', sealCode, stage, attempt, fallback: false, half: HALF, prims: r.prims, districts: r.districts, spawn: r.spawn, gate: r.gate, arena: r.arena, bossRings: r.bossRings, encounters: r.encounters, report: { genVersion: GEN_VERSION, attempt, metrics: r.metrics, kits: r.kits, failedAttempts: fails } };
      const h = fnv1a32(canon(m) + '|' + GEN_VERSION + '|' + stage); m.hash = h.toString(16).padStart(8, '0'); m.key = 'gen-' + m.hash;
      return m;
    }
    fails.push(r.fail);
  }
  return Object.assign({}, CLASSIC_MAP, { key: 'fallback-' + stage, sealCode, stage, fallback: true, report: { genVersion: GEN_VERSION, failedAttempts: fails } });
}
// for tests and tools: the grid and the two reachability maps of a finished map, rebuilt from its primitives
export function analyze(map) {
  const grid = new Float32Array(N * N); rasterizeInto(grid, N, HALF, map.prims, BOUNDARY);
  const si = ci(map.spawn.x), sj = ci(map.spawn.z);
  return { grid, ed: bfsEnemy(grid, si, sj), pd: bfsPlayer(grid, si, sj), ci, idx, N };
}
export { WALL };
