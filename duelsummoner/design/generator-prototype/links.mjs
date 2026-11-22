// G11-G12 graphs. Player traversal graph (WALK/RAMP, HOP, DROP, G1, G2, AIR, SKILL, authored jumps)
// and the enemy walk graph, both over layered 1 m cells: node = cell*2 + layer.
import { F, NONE } from './map.mjs';
import { g1, g2, REACH } from './reach.mjs';
import { DIR16, isqrt } from './imath.mjs';

export const L = { WALK: 1, HOP: 2, G1: 3, DROP: 4, G2: 5, AIR: 6, SKILL: 7 };
export const LNAME = ['', 'WALK', 'HOP', 'G1', 'DROP', 'G2', 'AIR', 'SKILL'];
export const BASE = (1 << L.WALK) | (1 << L.HOP) | (1 << L.G1) | (1 << L.DROP);
export const ANY = BASE | (1 << L.G2) | (1 << L.AIR) | (1 << L.SKILL);
export const WALKONLY = 1 << L.WALK;

const N8 = [[1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [-1, 1, 14], [1, -1, 14], [-1, -1, 14]];

function pads(m) {
  const N = m.N, h = m.h0, fl = m.flags;
  const p3 = new Uint8Array(N * N), p4 = new Uint8Array(N * N);
  for (const [k, out] of [[3, p3], [4, p4]]) {
    for (let z = 0; z + k <= N; z++) for (let x = 0; x + k <= N; x++) {
      const i0 = z * N + x; if (!(fl[i0] & F.WALK)) continue;
      const h0 = h[i0]; let ok = true;
      for (let dz = 0; dz < k && ok; dz++) for (let dx = 0; dx < k; dx++) { const i = i0 + dz * N + dx; if (!(fl[i] & F.WALK) || Math.abs(h[i] - h0) > 70) { ok = false; break; } }
      if (ok) for (let dz = 0; dz < k; dz++) for (let dx = 0; dx < k; dx++) out[i0 + dz * N + dx] = 1;
    }
  }
  return { p3, p4 };
}

export function classify(gap, dh) {
  if (dh > REACH.hopOpt_cm[1]) return dh <= REACH.airMaxRise_cm && gap <= REACH.airMaxGap_cm ? L.AIR : 0;
  if (dh > REACH.hopReq_cm[1]) return gap <= REACH.airMaxGap_cm ? L.SKILL : 0;
  const a = g1(dh), b = g2(dh);
  if (gap <= a) return L.G1;
  if (gap <= b) return L.G2;
  return gap <= REACH.airMaxGap_cm ? L.AIR : 0;
}

// Ballistic arc height (cm) above the take-off point at horizontal distance d (cm), for a full-speed
// jump: run 900 cm/s, take-off speed 1110 cm/s (2.2 m apex), gravity 2800 cm/s^2. Integer, exact below 2^53.
export const ARC_V = 900, ARC_V0 = 1110, ARC_G = 2800, CAPSULE_CM = 30;
export const arcY = (d) => Math.trunc((ARC_V0 * ARC_V * d - (ARC_G >> 1) * d * d) / (ARC_V * ARC_V));

// March from cell i along (dx,dz)/1000; returns candidate landings [{cell, gap, dh, cls}] (layer 0 only).
// The take-off point is the last cell of the start surface (the lip), not the start cell: the ray may walk
// down a slope first. Every cell the arc passes over must sit at least CAPSULE_CM below the arc, evaluated at
// both ends of the 25 cm sample window (the arc is concave, so the minimum is at an end). The landing lip must
// be under the arc too. dh is measured from the take-off cell.
export function castRay(m, i, dx, dz, padOK, maxS = 800, target = -1) {
  const N = m.N, h = m.h0, fl = m.flags;
  const x = i % N, z = (i / N) | 0; const sx = x * 100 + 50, sz = z * 100 + 50;
  let left = false, sLeave = 0, ht = h[i], prev = i, prevW = true, prevH = h[i]; const out = [];
  for (let s = 25; s <= maxS; s += 25) {
    const px = sx + Math.trunc((dx * s) / 1000), pz = sz + Math.trunc((dz * s) / 1000);
    const cx = Math.floor(px / 100), cz = Math.floor(pz / 100); if (cx < 0 || cz < 0 || cx >= N || cz >= N) break;
    const c = cz * N + cx;
    const w = (fl[c] & F.WALK) !== 0, hc = h[c];
    if (!left) {
      if (c === prev) continue;
      if (w && Math.abs(hc - prevH) <= 70) { prev = c; prevH = hc; continue; }
      left = true; sLeave = s; ht = prevH;
    }
    const d = s - sLeave; const yLo = Math.min(arcY(d > 25 ? d - 25 : 0), arcY(d + 25));
    if (c !== prev && w && (!prevW || Math.abs(hc - prevH) > 70)) {
      const gap = Math.max(0, s - sLeave - 25), dh = hc - ht;
      if (gap >= 50 && yLo >= dh && (target < 0 || c === target || Math.abs(h[target] - hc) <= 70)) {
        const cls = classify(gap, dh);
        if (cls && padOK[c]) { out.push({ cell: c, gap, dh, cls }); if (target >= 0 || out.length >= 3) break; }
      }
    }
    // obstacle test: anything the feet cannot clear ends the ray
    if (hc + CAPSULE_CM - ht > yLo) break;
    if (c !== prev) { prev = c; prevW = w; prevH = hc; }
  }
  return out;
}

export function buildPlayerGraph(m) {
  const N = m.N, n = N * N * 2; const h = m.h0, h1 = m.h1, fl = m.flags;
  const { p3, p4 } = pads(m);
  const walkL = (c, l) => (l ? h1[c] !== NONE : (fl[c] & F.WALK) !== 0);
  const H = (c, l) => (l ? h1[c] : h[c]);
  // authored links bucketed by source cell
  const ahead = new Int32Array(N * N).fill(-1), anext = new Int32Array(m.jumps.length);
  m.jumps.forEach((j, k) => { const a = j.a[1] * N + j.a[0]; anext[k] = ahead[a]; ahead[a] = k; });
  let cap = N * N * 10; let to = new Int32Array(cap), cost = new Uint8Array(cap), cls = new Uint8Array(cap);
  const off = new Int32Array(n + 1); let e = 0;
  const add = (v, c, k) => { if (e >= cap) { cap *= 2; const t = new Int32Array(cap); t.set(to); to = t; const c2 = new Uint8Array(cap); c2.set(cost); cost = c2; const k2 = new Uint8Array(cap); k2.set(cls); cls = k2; } to[e] = v; cost[e] = c; cls[e] = k; e++; };
  const counts = new Int32Array(8); const lint = []; const authored = [];
  for (let u = 0; u < n; u++) {
    off[u] = e;
    const c = u >> 1, l = u & 1; if (!walkL(c, l)) continue;
    const x = c % N, z = (c / N) | 0, hu = H(c, l);
    for (let k = 0; k < 8; k++) {
      const [dx, dz, cc] = N8[k]; const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= N || zz >= N) continue;
      const j = zz * N + xx;
      for (let lj = 0; lj < 2; lj++) {
        if (!walkL(j, lj)) continue;
        const dh = H(j, lj) - hu;
        if (lj === 0 && h1[j] !== NONE && h1[j] - h[j] < 220) continue;
        if (Math.abs(dh) <= 70) {
          if (k >= 4) {
            const a = z * N + xx, b = zz * N + x;
            const okA = (walkL(a, 0) && Math.abs(h[a] - hu) <= 70) || (walkL(a, 1) && Math.abs(h1[a] - hu) <= 70);
            const okB = (walkL(b, 0) && Math.abs(h[b] - hu) <= 70) || (walkL(b, 1) && Math.abs(h1[b] - hu) <= 70);
            if (!okA || !okB) continue;
          }
          add(j * 2 + lj, cc, L.WALK); counts[L.WALK]++;
        } else if (k < 4 && lj === 0 && l === 0) {
          if (dh > 70 && dh <= 150) {
            const b1x = x - dx, b1z = z - dz, b2x = x - 2 * dx, b2z = z - 2 * dz;
            if (b2x < 0 || b2z < 0 || b2x >= N || b2z >= N) continue;
            const b1 = b1z * N + b1x, b2 = b2z * N + b2x;
            if ((fl[b1] & F.WALK) && (fl[b2] & F.WALK) && Math.abs(h[b1] - hu) <= 70 && Math.abs(h[b2] - hu) <= 70 && p3[j]) { add(j * 2, 20, L.HOP); counts[L.HOP]++; }
          } else if (dh < -70) {
            if (dh >= -150 ? (p3[j] || p4[j]) : p4[j]) { add(j * 2, 15, L.DROP); counts[L.DROP]++; }
          } else if (dh > 150 && dh <= 180) { add(j * 2, 30, L.SKILL); counts[L.SKILL]++; }
          else if (dh >= 260 && dh <= 360) { add(j * 2, 30, L.AIR); counts[L.AIR]++; }
        }
      }
    }
    if (l === 0) {
      // lip?
      let lip = false;
      for (let k = 0; k < 4; k++) { const xx = x + N8[k][0], zz = z + N8[k][1]; if (xx < 0 || zz < 0 || xx >= N || zz >= N) continue; const j = zz * N + xx; if (!(fl[j] & F.WALK) || Math.abs(h[j] - hu) > 70) { lip = true; break; } }
      if (lip) {
        for (const [dx, dz] of DIR16) {
          const fx = Math.floor((x * 100 + 50 + dx) / 100), fz = Math.floor((z * 100 + 50 + dz) / 100);
          if (fx < 0 || fz < 0 || fx >= N || fz >= N) continue;
          const f = fz * N + fx; if ((fl[f] & F.WALK) && Math.abs(h[f] - hu) <= 70) continue; // ray runs along own surface
          for (const r of castRay(m, c, dx, dz, p3)) { add(r.cell * 2, 10 + Math.trunc(r.gap / 10) + (r.cls >= L.G2 ? 20 : 0), r.cls); counts[r.cls]++; }
        }
      }
      for (let k = ahead[c]; k >= 0; k = anext[k]) {
        const J = m.jumps[k]; const tb = J.b[1] * N + J.b[0];
        const vx = J.b[0] - J.a[0], vz = J.b[1] - J.a[1]; const len = isqrt(vx * vx + vz * vz) || 1;
        const res = castRay(m, c, Math.trunc((vx * 1000) / len), Math.trunc((vz * 1000) / len), p3, 900, tb);
        const want = L[J.cls] || L.G1;
        const got = res.length ? res[0].cls : 0;
        authored.push({ k, cls: J.cls, measured: got ? LNAME[got] : 'NONE', gap: res.length ? res[0].gap : -1, dh: res.length ? res[0].dh : 0 });
        if (!got || (want <= L.G1 && got > L.G1 && got !== L.DROP) || (want === L.G2 && got > L.G2 && got !== L.DROP)) { lint.push({ jump: k, chunk: J.chunk, claimed: J.cls, measured: got ? LNAME[got] : 'NONE' }); continue; }
        add(res[0].cell * 2, 10 + Math.trunc(res[0].gap / 10), got); counts[got]++;
      }
    }
  }
  off[n] = e;
  return { n, m: e, off, to: to.subarray(0, e), cost: cost.subarray(0, e), cls: cls.subarray(0, e), counts, lint, authored, p3, p4 };
}

export function buildEnemyGraph(m) {
  const N = m.N, n = N * N * 2; const h = m.h0, h1 = m.h1, fl = m.flags;
  const ok = (c, l) => (l ? h1[c] !== NONE : (fl[c] & F.WALK) && !(fl[c] & F.PONLY));
  const H = (c, l) => (l ? h1[c] : h[c]);
  let cap = N * N * 9; const to = new Int32Array(cap), cost = new Uint8Array(cap), cls = new Uint8Array(cap);
  const off = new Int32Array(n + 1); let e = 0;
  for (let u = 0; u < n; u++) {
    off[u] = e; const c = u >> 1, l = u & 1; if (!ok(c, l)) continue;
    const x = c % N, z = (c / N) | 0, hu = H(c, l);
    for (let k = 0; k < 8; k++) {
      const [dx, dz, cc] = N8[k]; const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= N || zz >= N) continue;
      const j = zz * N + xx;
      for (let lj = 0; lj < 2; lj++) {
        if (!ok(j, lj) || Math.abs(H(j, lj) - hu) > 60) continue;
        if (lj === 0 && h1[j] !== NONE && h1[j] - h[j] < 220) continue;
        if (k >= 4) {
          const a = z * N + xx, b = zz * N + x;
          const okA = (ok(a, 0) && Math.abs(h[a] - hu) <= 60) || (ok(a, 1) && Math.abs(h1[a] - hu) <= 60);
          const okB = (ok(b, 0) && Math.abs(h[b] - hu) <= 60) || (ok(b, 1) && Math.abs(h1[b] - hu) <= 60);
          if (!okA || !okB) continue;
        }
        if (e >= cap) throw new Error('enemy graph overflow');
        to[e] = j * 2 + lj; cost[e] = cc + ((fl[j] & F.RAMP) ? 4 : 0); cls[e] = L.WALK; e++;
      }
    }
  }
  off[n] = e;
  return { n, m: e, off, to: to.subarray(0, e), cost: cost.subarray(0, e), cls: cls.subarray(0, e) };
}
