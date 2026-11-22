// G13 repair loop: targeted deterministic fixes, full re-check after every fix, revert on regression.
import { F, snapshot, restore, refreshWalk } from './map.mjs';
import { INF } from './nav.mjs';
import { discOffsets } from './imath.mjs';
import { flattenRing } from './events.mjs';
import { populate } from './generate.mjs';
import { validate } from './validate.mjs';
import { finalizeTerrain } from './terrain.mjs';

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Hop staircase cut into the higher side of a cliff: 140 cm steps, 3 m deep, 4 m wide (player-only).
export function stampStairCut(m, lowCell, dir, lowH, topH) {
  const N = m.N; const K = Math.ceil((topH - lowH - 70) / 140); if (K < 1) return false;
  const x0 = lowCell % N, z0 = (lowCell / N) | 0; const [dx, dz] = dir; const px = -dz, pz = dx;
  const cells = [];
  for (let j = 0; j < K * 3; j++) for (let w = -2; w < 2; w++) {
    const x = x0 + dx * (j + 1) + px * w, z = z0 + dz * (j + 1) + pz * w; if (x < 1 || z < 1 || x >= N - 1 || z >= N - 1) return false;
    const i = z * N + x; if (!(m.flags[i] & F.WALK) || (m.flags[i] & (F.RAMP | F.ARENA | F.ENTRY)) || Math.abs(m.h0[i] - topH) > 70) return false;
    const k = K - Math.floor(j / 3); // nearest the cliff = lowest step
    cells.push([i, topH - 140 * k]);
  }
  for (const [i, h] of cells) { m.h0[i] = h; m.flags[i] |= F.PONLY | F.CHUNK; }
  (m.extraStairs = m.extraStairs || []).push({ x: x0, z: z0, dir, steps: K });
  return true;
}

function stuckStair(m, A, stuck) { // from a stuck component, climb to the nearest higher cell that can return
  const N = m.N; const cand = [];
  for (const v of stuck) {
    if (v & 1) continue; const c = v >> 1, x = c % N, z = (c / N) | 0;
    for (const [dx, dz] of N4) {
      const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= N || zz >= N) continue; const j = zz * N + xx;
      if (!(m.flags[j] & F.WALK) || !A.canReturn[j * 2]) continue;
      const rise = m.h0[j] - m.h0[c]; if (rise > 70) cand.push([rise, c, dx, dz, j]);
    }
  }
  cand.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]);
  for (const [, c, dx, dz, j] of cand) if (stampStairCut(m, c, [dx, dz], m.h0[c], m.h0[j])) return true;
  return false;
}

function demoteChunk(m, ch) { // replace a structure with plain terrain at its tier
  const N = m.N; const [x0, z0, w, h] = ch.rect; const base = ch.tier * 300;
  for (let z = z0; z < z0 + h; z++) for (let x = x0; x < x0 + w; x++) { const i = z * N + x; if (!(m.flags[i] & F.CHUNK)) continue; m.h0[i] = base; m.flags[i] &= ~(F.PONLY | F.SOLID | F.RAMP | F.SLIDE); }
  ch.removed = true;
  m.slots = m.slots.filter((s) => s.chunk !== ch.id); m.jumps = m.jumps.filter((j) => j.chunk !== ch.id);
  refreshWalk(m);
}

function addRingNear(ctx, m, x0, z0) {
  const N = m.N; const r = ctx.spec.bossRingR; const disc = discOffsets(r);
  const order = discOffsets(36);
  for (const [ox, oz] of order) {
    const x = x0 + ox, z = z0 + oz; if (x < r + 3 || z < r + 3 || x >= N - r - 3 || z >= N - r - 3) continue;
    const c = z * N + x; let ok = true;
    for (const [dx, dz] of disc) { const i = c + dz * N + dx; if (!(m.flags[i] & F.WALK) || (m.flags[i] & (F.PONLY | F.SOLID | F.ARENA | F.GULLY | F.RAMP | F.CHUNK | F.ENTRY)) || Math.abs(m.h0[i] - m.h0[c]) > 160) { ok = false; break; } }
    if (!ok) continue;
    flattenRing(m, c, r); m.rings.push(c); return true;
  }
  return false;
}

function fixesFor(kind, ctx, m, A, st, V) {
  const N = m.N; const f = V.fails; const out = [];
  if (kind === 'V3' || kind === 'V2') {
    const stuck = kind === 'V3' ? f.softlock || [] : (f.unreachable || []).map((u) => (u.z * N + u.x) * 2);
    out.push(['stair_on_lowest_cliff', () => stuckStair(m, A, stuck)]);
    if (kind === 'V2') out.push(['drop_unreachable_slots', () => { const bad = new Set((f.unreachable || []).map((u) => u.z * N + u.x)); const n = m.slots.length; m.slots = m.slots.filter((s) => !bad.has(s.z * N + s.x)); return m.slots.length < n; }]);
  }
  if (kind === 'V8' && f.ringWorst && m.rings.length < ctx.spec.bossRings[1]) out.push(['add_boss_ring', () => addRingNear(ctx, m, f.ringWorst[0], f.ringWorst[1])]);
  if (kind === 'V8' && f.ringWorst) out.push(['move_nearest_ring', () => { const [wx, wz] = f.ringWorst; let k = -1, bd = 1e9; m.rings.forEach((c, j) => { const d = (c % N - wx) ** 2 + (((c / N) | 0) - wz) ** 2; if (d < bd) { bd = d; k = j; } }); const old = m.rings.splice(k, 1)[0]; if (addRingNear(ctx, m, wx, wz)) return true; m.rings.splice(k, 0, old); return false; }]);
  if (kind === 'V7' || kind === 'V6' || kind === 'V5') {
    const pts = kind === 'V7' ? (f.spawnRing || []).map((b) => [b.x, b.z]) : (f.islands || []).map((q) => [q.cell % N, (q.cell / N) | 0]);
    if (pts.length) out.push(['demote_enclosing_structure', () => {
      const [px, pz] = pts[0]; let best = null, bd = 50 * 50;
      for (const ch of m.chunks) { if (ch.removed || ch.chain || ch.type === 'card_bridge') continue; const cx = ch.rect[0] + (ch.rect[2] >> 1), cz = ch.rect[1] + (ch.rect[3] >> 1); const d = (cx - px) ** 2 + (cz - pz) ** 2; if (d < bd) { bd = d; best = ch; } }
      if (!best) return false; demoteChunk(m, best); return true;
    }]);
  }
  return out;
}

export function repairLoop(ctx, m, A, st, V, rep, maxPasses = 4) {
  for (let pass = 1; pass <= maxPasses && V.failing.length; pass++) {
    let progressed = false;
    for (const kind of V.failing.slice()) {
      const fixes = fixesFor(kind, ctx, m, A, st, V);
      for (const [name, fn] of fixes) {
        const snap = snapshot(m); const rings = m.rings.slice(); const passing = Object.keys(V.metrics).filter((k) => V.metrics[k].gating && V.metrics[k].pass);
        if (!fn()) { restore(m, snap); m.rings = rings; continue; }
        finalizeTerrain(m);
        const P = populate(ctx, m); const V2 = validate(ctx, m, P.A, P.st);
        const regressed = passing.filter((k) => !V2.metrics[k].pass);
        const fixed = !V2.failing.includes(kind) || V2.failing.length < V.failing.length;
        if (regressed.length || !fixed) { restore(m, snap); m.rings = rings; rep.log.push({ pass, kind, fix: name, ok: false, regressed }); continue; }
        rep.log.push({ pass, kind, fix: name, ok: true }); A = P.A; st = P.st; V = V2; progressed = true; break;
      }
      if (progressed) break;
    }
    if (!progressed) break;
  }
  if (rep.log.some((l) => !l.ok)) { const P = populate(ctx, m); A = P.A; st = P.st; V = validate(ctx, m, A, st); }
  return { A, st, V };
}
