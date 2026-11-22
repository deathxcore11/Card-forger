// Top-down debug render (tools/gen-render.mjs in the final layout). Floats allowed here (view only).
import { F, NONE } from './map.mjs';
import { INF } from './nav.mjs';
import { L } from './links.mjs';
import { encodePNG } from './png.mjs';

const hex = (s) => { const v = parseInt(s.replace('#', ''), 16); return s.length > 7 ? [(v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255] : [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255]; };
const PAL = {
  ruins_day: { t: { '-1': '#9C8A66', 0: '#D8C08A', 1: '#C4A46A', 2: '#A9884F', 3: '#8C6E3E' }, rim: '#6B5A44', out: '#3A3026' },
  catacomb_cool: { t: { '-1': '#5E6873', 0: '#8C99A6', 1: '#77838F', 2: '#626D78', 3: '#4E5761' }, rim: '#3E444C', out: '#22262B' },
  vault_gold: { t: { '-1': '#7A6630', 0: '#C9A646', 1: '#A88A35', 2: '#8A7028', 3: '#6B561C' }, rim: '#2B2416', out: '#14110A' },
};
export const CLASS_COL = { FREE_ITEM: '#FFFFFF', FREE_LEVEL: '#86EFAC', PAID: '#FACC15', DANGER: '#DC2626', UTILITY: '#8B5CF6', COLLECT: '#F97316', MIMIC: '#E879F9', GATE: '#FFFFFF' };
const DIST_COL = ['#F43F5E', '#3B82F6', '#10B981', '#F59E0B', '#A855F7'];

// 3x5 pixel font: glyph columns as 5-bit masks (bit 0 = top row).
const G5 = {
  A: [0x1E, 0x05, 0x1E], B: [0x1F, 0x15, 0x0A], C: [0x0E, 0x11, 0x11], D: [0x1F, 0x11, 0x0E], E: [0x1F, 0x15, 0x11], F: [0x1F, 0x05, 0x01],
  G: [0x0E, 0x11, 0x1D], H: [0x1F, 0x04, 0x1F], I: [0x11, 0x1F, 0x11], J: [0x08, 0x10, 0x0F], K: [0x1F, 0x04, 0x1B], L: [0x1F, 0x10, 0x10],
  M: [0x1F, 0x02, 0x1F], N: [0x1F, 0x0E, 0x1F], O: [0x0E, 0x11, 0x0E], P: [0x1F, 0x05, 0x02], Q: [0x0E, 0x19, 0x1E], R: [0x1F, 0x05, 0x1A],
  S: [0x12, 0x15, 0x09], T: [0x01, 0x1F, 0x01], U: [0x1F, 0x10, 0x1F], V: [0x0F, 0x10, 0x0F], W: [0x1F, 0x08, 0x1F], X: [0x1B, 0x04, 0x1B],
  Y: [0x03, 0x1C, 0x03], Z: [0x19, 0x15, 0x13], 0: [0x1F, 0x11, 0x1F], 1: [0x12, 0x1F, 0x10], 2: [0x1D, 0x15, 0x17], 3: [0x15, 0x15, 0x1F],
  4: [0x07, 0x04, 0x1F], 5: [0x17, 0x15, 0x1D], 6: [0x1F, 0x15, 0x1D], 7: [0x01, 0x01, 0x1F], 8: [0x1F, 0x15, 0x1F], 9: [0x17, 0x15, 0x1F],
  ' ': [0, 0, 0], '-': [4, 4, 4], ':': [0, 0x0A, 0], '.': [0, 0x10, 0], '/': [0x18, 0x04, 0x03], '%': [0x19, 0x04, 0x13], '_': [0x10, 0x10, 0x10], '=': [0x0A, 0x0A, 0x0A], '+': [4, 0x0E, 4],
};

export function renderPNG(res, opts = {}) {
  const { m, A, st, V, spec } = res; const N = m.N; const s = opts.scale || 2; const debug = !!opts.debug;
  const W = N * s, H = N * s + 164; const img = new Uint8ClampedArray(W * H * 4);
  const pal = PAL[spec.palette] || PAL.ruins_day;
  const put = (x, y, c, a = 255) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const k = (y * W + x) * 4; const al = (a * (c[3] ?? 255)) / 255 / 255; img[k] = img[k] * (1 - al) + c[0] * al; img[k + 1] = img[k + 1] * (1 - al) + c[1] * al; img[k + 2] = img[k + 2] * (1 - al) + c[2] * al; img[k + 3] = 255; };
  const cellFill = (cx, cz, c, a = 255) => { for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) put(cx * s + dx, cz * s + dy, c, a); };
  const h = m.h0;
  // 1. height shading
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = z * N + x; let c;
    if (m.mask1[i] === 0) c = hex(pal.out); else if (m.mask1[i] === 1) c = hex(pal.rim);
    else {
      const t = Math.max(-1, Math.min(3, Math.floor((h[i] + 150) / 300)));
      const base = hex(pal.t[t]); const intra = (h[i] - t * 300) / 300; const tint = 1 + 0.24 * intra;
      const a = x > 0 && z > 0 ? h[i - N - 1] : h[i], b = x < N - 1 && z < N - 1 ? h[i + N + 1] : h[i];
      const shade = Math.max(64, Math.min(192, 128 + (a - b) / 4)) / 128;
      c = base.map((v, k) => (k < 3 ? Math.max(0, Math.min(255, v * tint * shade)) : 255));
      if (m.flags[i] & F.SOLID) c = c.map((v, k) => (k < 3 ? v * 0.45 : 255));
    }
    cellFill(x, z, c);
    if (m.flags[i] & F.PIT) cellFill(x, z, hex('#201810'));
    else if (m.flags[i] & F.GULLY) cellFill(x, z, hex('#7A6040'), 110);
  }
  // 2. cliffs
  const cliff = hex('#2A2018');
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = z * N + x; if (m.mask1[i] !== 2) continue;
    if (x + 1 < N && Math.abs(h[i] - h[i + 1]) > 75) for (let d = 0; d < s; d++) put(x * s + s - 1, z * s + d, cliff);
    if (z + 1 < N && Math.abs(h[i] - h[i + N]) > 75) for (let d = 0; d < s; d++) put(x * s + d, z * s + s - 1, cliff);
  }
  // ramp chevrons pointing uphill
  const chev = hex('#F2E3B8');
  for (const r of m.ramps) for (let u = -400; u <= 400; u += 400) for (let v = -(r.W >> 1) + 150; v < (r.W >> 1); v += 300) {
    const px = (r.P[0] + u * r.dir[0] - v * r.dir[1]) / 100 * s, pz = (r.P[1] + u * r.dir[1] + v * r.dir[0]) / 100 * s;
    for (let k = -3; k <= 3; k++) { const back = -Math.abs(k); put(px + back * r.dir[0] * s * 0.5 + k * -r.dir[1] * s * 0.5, pz + back * r.dir[1] * s * 0.5 + k * r.dir[0] * s * 0.5, chev); }
  }
  // 3. player-only hatching, 4. decks
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = z * N + x;
    if (m.flags[i] & F.PONLY) for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (((x * s + dx) + (z * s + dy)) % 4 === 0) put(x * s + dx, z * s + dy, [255, 255, 255], 120);
    if (m.h1[i] !== NONE) { cellFill(x, z, hex('#5AA0C8'), 90); const edge = [i - 1, i + 1, i - N, i + N].some((j) => m.h1[j] === NONE); if (edge) cellFill(x, z, hex('#5AA0C8')); }
  }
  // dynamic platforms (optional, off for validation)
  for (const d of m.dynamic) for (let dz = 0; dz < d.cells[3]; dz++) for (let dx = 0; dx < d.cells[2]; dx++) cellFill(d.cells[0] + dx, d.cells[1] + dz, hex('#E7C65A'), 160);
  // 6. district borders + seeds
  const dOf = (i) => (m.reg[i] === 255 ? -1 : m.macro.regions[m.reg[i]].district);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = z * N + x; const d = dOf(i); if (d < 0) continue;
    if ((x + 1 < N && dOf(i + 1) >= 0 && dOf(i + 1) !== d) || (z + 1 < N && dOf(i + N) >= 0 && dOf(i + N) !== d)) cellFill(x, z, [0, 0, 0], 85);
    if (debug) cellFill(x, z, hex(DIST_COL[m.reg[i] % 5]), 30);
  }
  const C = m.C;
  m.macro.districts.forEach((d, k) => { const cx = ((d.seed % C) * 8 + 4) * s, cz = (((d.seed / C) | 0) * 8 + 4) * s; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 9) put(cx + dx, cz + dy, hex(DIST_COL[k])); text(put, cx + 6, cz - 2, d.name.toUpperCase().replace(/[^A-Z ]/g, ''), [20, 16, 10], 1); });
  // reachable-area outline
  const reach = (i) => A.dSpawn[i * 2] < INF || A.dSpawn[i * 2 + 1] < INF;
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) { const i = z * N + x; if (!reach(i)) continue; if (!reach(i + 1) || !reach(i - 1) || !reach(i + N) || !reach(i - N)) cellFill(x, z, hex('#FEF3C7'), 150); }
  // 13. opening radius contour
  const open = spec.openingM * 10;
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) { const i = z * N + x; const d = A.dSpawn[i * 2]; if (d >= INF || d < open) continue; if ([i - 1, i + 1, i - N, i + N].some((j) => A.dSpawn[j * 2] < open) && (x + z) % 3 === 0) cellFill(x, z, [255, 255, 255]); }
  // 7. spine + greed routes
  const line = (x0, y0, x1, y1, c, w = 1, dash = 0, a = 255) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let k = 0; k <= n; k++) { if (dash && ((k / dash) | 0) % 2) continue; const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n; for (let dy = -(w >> 1); dy <= (w - 1) >> 1; dy++) for (let dx = -(w >> 1); dx <= (w - 1) >> 1; dx++) put(x + dx, y + dy, c, a); } };
  const C2 = (c) => [(c % N) * s + s / 2, ((c / N) | 0) * s + s / 2];
  const greed = hex('#FFFFFF');
  for (const e of st.encounters) {
    if (e.cls === 'GATE') continue; let v = (e.z * N + e.x) * 2 + e.layer; let k = 0;
    while (A.parSpine[v] >= 0 && k < 2000) { const u = A.parSpine[v]; const [x0, y0] = C2(v >> 1), [x1, y1] = C2(u >> 1); if (k % 4 < 2) line(x0, y0, x1, y1, greed, 1, 0, 170); v = u; k++; }
  }
  const sp = m.spine.path; for (let k = 1; k < sp.length; k++) { const [x0, y0] = C2(sp[k - 1]), [x1, y1] = C2(sp[k]); line(x0, y0, x1, y1, hex('#22D3EE'), 3); }
  // 8. links: authored, required (on spawn tree to required targets), rhythm chains, all (debug)
  const linkCol = { [L.G1]: hex('#F5B301'), [L.G2]: hex('#3B82F6'), [L.DROP]: hex('#EF4444'), [L.HOP]: hex('#F5B301'), [L.AIR]: hex('#A3A3A3'), [L.SKILL]: hex('#A3A3A3') };
  const drawLink = (u, v, k, w = 1) => { const [x0, y0] = C2(u >> 1), [x1, y1] = C2(v >> 1); const c = linkCol[k]; if (!c) return; if (k === L.HOP) { line(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2, c, 2); return; } line(x0, y0, x1, y1, c, w); if (k === L.DROP) for (let d = -1; d <= 1; d++) put(x1 + d, y1, c), put(x1, y1 + d, c); };
  const pg = A.pg;
  const edgeCls = (u, v) => { for (let e = pg.off[u]; e < pg.off[u + 1]; e++) if (pg.to[e] === v) return pg.cls[e]; return 0; };
  if (debug) for (let u = 0; u < pg.n; u += 2) for (let e = pg.off[u]; e < pg.off[u + 1]; e++) { const k = pg.cls[e]; if (k === L.WALK || (u >> 1) % 3) continue; drawLink(u, pg.to[e], k); }
  for (const j of m.jumps) { const k = L[j.cls] || L.G1; const [x0, y0] = C2(j.a[1] * N + j.a[0]), [x1, y1] = C2(j.b[1] * N + j.b[0]); line(x0, y0, x1, y1, linkCol[k], 1); }
  // required jumps: non-walk links on spawn shortest paths to every required target
  const targets = st.encounters.filter((e) => e.cls !== 'VASE').map((e) => (e.z * N + e.x) * 2 + e.layer).concat(st.rings.map((c) => c * 2));
  for (const t of targets) { let v = t, k = 0; while (A.parSpawn[v] >= 0 && k++ < 3000) { const u = A.parSpawn[v]; const c = edgeCls(u, v); if (c && c !== L.WALK) { drawLink(u, v, c, 2); const [x1, y1] = C2(v >> 1); for (let d = -2; d <= 2; d++) put(x1 + d, y1 - 3, linkCol[c]); } v = u; } }
  // rhythm chains (2 px orange)
  for (const ch of (V?.chains || [])) { if (!ch.ok) continue; const p = ch.path; for (let k = 1; k < p.length; k += 2) { const [x0, y0] = C2(p[k - 1]), [x1, y1] = C2(p[k]); line(x0, y0, x1, y1, hex('#FB923C'), 2); } }
  // 9. boss rings, gate, spawn, elite pockets
  const circle = (cx, cy, r, c, w = 1, dotted = false) => { const n = Math.max(24, (r * 6) | 0); for (let k = 0; k < n; k++) { if (dotted && k % 2) continue; const a = (k / n) * Math.PI * 2; for (let t = 0; t < w; t++) put(cx + Math.cos(a) * (r - t), cy + Math.sin(a) * (r - t), c); } };
  for (const c of st.rings) { const [x, y] = C2(c); circle(x, y, spec.bossRingR * s, hex('#D946EF'), 2); }
  for (const e of st.elites) { const [x, y] = C2(e.z * N + e.x); circle(x, y, 4 * s, hex('#991B1B'), 2); }
  const gx = (m.arena.x / 100) * s, gy = (m.arena.z / 100) * s; circle(gx, gy, 22 * s, [255, 255, 255], 3);
  for (const [ex, ez] of m.arena.entrances) { const x = (ex / 100) * s, y = (ez / 100) * s; line(x - (x - gx) * 0.15, y - (y - gy) * 0.15, x + (x - gx) * 0.25, y + (y - gy) * 0.25, [255, 255, 255], 3); }
  const sx = (m.spawn.x / 100) * s, sy = (m.spawn.z / 100) * s;
  for (let dy = -4 * s; dy <= 4 * s; dy++) for (let dx = -4 * s; dx <= 4 * s; dx++) if (dx * dx + dy * dy <= 16 * s * s) put(sx + dx, sy + dy, hex('#22C55E'));
  circle(sx, sy, 30 * s, hex('#22C55E'), 1, true);
  for (const lm of m.landmarks) {
    const [x, y] = C2(lm.z * N + lm.x);
    if (lm.mega) { circle(x, y, 7 * s, [255, 255, 255], 3); text(put, x + 8 * s, y - 3, 'MEGA CARD', [255, 255, 255], 1); }
    else if (lm.hero) { for (let d = -3 * s; d <= 3 * s; d++) { put(x + d, y - 3 * s, hex('#0EA5E9')); put(x + d, y + 3 * s, hex('#0EA5E9')); put(x - 3 * s, y + d, hex('#0EA5E9')); put(x + 3 * s, y + d, hex('#0EA5E9')); } text(put, x + 4 * s, y + 2, lm.type.toUpperCase().replace(/_/g, ' ').replace(/[^A-Z ]/g, ''), [12, 74, 110], 1); }
    else if (lm.approach) { circle(x, y, 4 * s, hex('#0EA5E9'), 2); text(put, x + 5 * s, y - 2, 'SEALED ARCH', [12, 74, 110], 1); }
    else circle(x, y, 5 * s, [255, 255, 255], 1);
  }
  for (const lu of st.lures || []) { const [x, y] = C2(lu.z * N + lu.x); for (let d = -3; d <= 3; d++) { put(x + d, y, [255, 255, 255]); put(x, y + d, [255, 255, 255]); } }
  // 10. encounters + vases
  for (const v of st.vases) { const [x, y] = C2(v.z * N + v.x); for (let d = 0; d < 4; d++) put(x + (d & 1), y + (d >> 1), hex('#8B5A2B')); }
  for (const e of st.encounters) {
    if (e.cls === 'GATE') continue; const [x, y] = C2(e.z * N + e.x); const c = hex(CLASS_COL[e.cls] || '#FFFFFF');
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) put(x + dx, y + dy, Math.abs(dx) === 4 || Math.abs(dy) === 4 ? [0, 0, 0] : c);
    if (e.plinth) for (let d = -5; d <= 5; d++) put(x + d, y + 6, [0, 0, 0]);
  }
  // 11. failures
  const f = V?.fails || {};
  for (const u of f.unreachable || []) for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) put(u.x * s + dx, u.z * s + dy, hex('#FF00FF'));
  for (const v of f.softlock || []) { const c = v >> 1; cellFill(c % N, (c / N) | 0, ((c % N) + ((c / N) | 0)) % 2 ? [0, 0, 0] : [250, 204, 21]); }
  for (const b of f.spawnRing || []) { const x = b.x * s, y = b.z * s; for (let d = -5; d <= 5; d++) { put(x + d, y + d, hex('#EF4444')); put(x + d, y - d, hex('#EF4444')); put(x + d + 1, y + d, hex('#EF4444')); put(x + d + 1, y - d, hex('#EF4444')); } }
  // 12. legend strip
  for (let y = N * s; y < H; y++) for (let x = 0; x < W; x++) put(x, y, [24, 22, 20]);
  const items = [['#FFFFFF', 'FREE ITEM'], ['#86EFAC', 'FREE LEVEL'], ['#FACC15', 'PAID'], ['#DC2626', 'DANGER'], ['#8B5CF6', 'UTILITY'], ['#F97316', 'COLLECT'], ['#8B5A2B', 'VASE'],
    ['#22D3EE', 'SPINE'], ['#F5B301', 'G1 HOP'], ['#3B82F6', 'G2 DASH'], ['#EF4444', 'DROP'], ['#FB923C', 'CHAIN'], ['#D946EF', 'BOSS RING'], ['#22C55E', 'SPAWN'], ['#5AA0C8', 'DECK'], ['#0EA5E9', 'HERO LANDMARK'], ['#FEF3C7', 'REACH EDGE'], ['#FF00FF', 'UNREACHABLE'], ['#991B1B', 'ELITE POCKET'], ['#E879F9', 'MIMIC']];
  items.forEach(([c, label], k) => { const col = k % 6, row = (k / 6) | 0; const x = 8 + col * (W / 6), y = N * s + 10 + row * 18; for (let dy = 0; dy < 9; dy++) for (let dx = 0; dx < 9; dx++) put(x + dx, y + dy, dx === 0 || dy === 0 || dx === 8 || dy === 8 ? [0, 0, 0] : hex(c)); text(put, x + 13, y + 1, label, [235, 230, 220], 1); });
  const passN = V ? Object.values(V.metrics).filter((q) => q.gating && q.pass).length : 0, gN = V ? Object.values(V.metrics).filter((q) => q.gating).length : 0;
  text(put, 8, N * s + 86, `SEAL ${res.sealCode}  STAGE ${res.stage} ${spec.name.toUpperCase().replace(/[^A-Z ]/g, '')}  ATTEMPT ${res.attempt}${res.fallback ? ' FALLBACK' : ''}  HASH ${(res.hash || '').toUpperCase()}`, [255, 255, 255], 2);
  text(put, 8, N * s + 110, `${(m.macro.shape || '').toUpperCase()}  METRICS ${passN}/${gN} PASS  SPINE ${m.spine.len_m}M X${(m.spine.ratio100 / 100).toFixed(2)}  CHUNKS ${m.chunks.filter((c) => !c.removed).length}`, [200, 200, 200], 2);
  text(put, 8, N * s + 134, `RINGS ${st.rings.length}  ISLANDS ${st.islands.islands.length}  ENCOUNTERS ${st.encounters.length - 1}  VASES ${st.vases.length}`, [200, 200, 200], 2);
  return encodePNG(W, H, new Uint8Array(img.buffer));
}
function text(put, x, y, str, c, sc = 1) {
  let cx = x;
  for (const ch of str) { const g = G5[ch] || G5[' ']; for (let col = 0; col < 3; col++) for (let row = 0; row < 5; row++) if ((g[col] >> row) & 1) for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) put(cx + col * sc + a, y + row * sc + b, c); cx += 4 * sc; }
}
