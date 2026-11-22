// Seeded scenery: groves of trees, boulders, bushes, grass tufts and flowers scattered over the generated stage. View only: it never touches
// the sim (no collision, no RNG stream the run uses), so replays and goldens are unaffected. The same stage seed always grows the same stage.
// Every kind is one InstancedMesh with its own chunky look; when a baked model for a kind is present (models.tree etc.) it replaces the stand-in.
import { heightAt } from '../sim/terrain.js';
import { MAP } from '../data/map.js';

const T = window.THREE;

// ------------------------------------------------------------------ tiny deterministic helpers
const strHash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const mulberry = a => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function noise2(seed) {                                                       // smooth value noise 0..1, for patchy grass and flower meadows
  const L = 64, v = new Float32Array(L * L), r = mulberry(seed); for (let i = 0; i < v.length; i++) v[i] = r();
  const g = (x, y) => v[((y & 63) << 6) | (x & 63)], s = t => t * t * (3 - 2 * t);
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = s(x - xi), fy = s(y - yi); return (g(xi, yi) * (1 - fx) + g(xi + 1, yi) * fx) * (1 - fy) + (g(xi, yi + 1) * (1 - fx) + g(xi + 1, yi + 1) * fx) * fy; };
}

// ------------------------------------------------------------------ geometry: one merged, vertex-coloured, flat-shaded geometry per kind
class Geo {
  constructor() { this.p = []; this.c = []; }
  tri(a, b, c, col) { for (const q of [a, b, c]) { this.p.push(q[0], q[1], q[2]); this.c.push(col[0], col[1], col[2]); } }
  blob(cx, cy, cz, sx, sy, sz, col, jit = 0.12, seed = 1) {                    // a faceted blob: icosahedron, squashed, with each vertex nudged
    const ico = new T.IcosahedronGeometry(1, 0), pos = ico.attributes.position, rnd = mulberry(seed), nudge = new Map();
    const V = i => { const k = pos.getX(i).toFixed(3) + pos.getY(i).toFixed(3) + pos.getZ(i).toFixed(3); if (!nudge.has(k)) nudge.set(k, 1 + (rnd() - 0.5) * 2 * jit); const n = nudge.get(k); return [cx + pos.getX(i) * sx * n, cy + pos.getY(i) * sy * n, cz + pos.getZ(i) * sz * n]; };
    for (let i = 0; i < pos.count; i += 3) { const sh = 0.82 + (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3 * 0.2; this.tri(V(i), V(i + 1), V(i + 2), col.map(x => Math.min(1, x * sh))); }
  }
  prism(cx, cz, y0, y1, r0, r1, n, col, lean = 0) {                           // tapered n-sided trunk
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, sh = 0.8 + 0.25 * Math.cos(a0);
      const P = (a, r, y) => [cx + Math.cos(a) * r + lean * (y - y0) / (y1 - y0), y, cz + Math.sin(a) * r], c = col.map(x => x * sh);
      this.tri(P(a0, r0, y0), P(a1, r0, y0), P(a1, r1, y1), c); this.tri(P(a0, r0, y0), P(a1, r1, y1), P(a0, r1, y1), c);
    }
  }
  geometry(up) {                                                                  // up: every normal points up, so thin blades and petals are lit like the ground they stand on
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
    if (up) { const n = new Float32Array(this.p.length); for (let i = 0; i < n.length; i += 3) { n[i] = 0.15; n[i + 1] = 0.97; n[i + 2] = 0.1; } g.setAttribute('normal', new T.BufferAttribute(n, 3)); } else g.computeVertexNormals(); return g;
  }
}
const rgb = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

// stand-ins, each about one metre scale unit; instance scale sets the real size. Colours are the Stage 1 palette: light and bright, never dark.
function treeGeo(theme, variant) {
  const g = new Geo(), sage = theme.leaf, bark = theme.bark, r = mulberry(100 + variant);
  g.prism(0, 0, 0, 2.4, 0.42, 0.26, 7, rgb(bark), (r() - 0.5) * 0.6);
  const blobs = [[0, 3.5, 0, 1.7, 1.25, 1.7], [-1.5, 2.8, 0.3, 1.2, 0.9, 1.2], [1.4, 3.0, -0.4, 1.3, 1.0, 1.3], [0.2, 2.7, 1.5, 1.15, 0.9, 1.15], [-0.3, 4.4, -0.3, 1.1, 0.8, 1.1]];
  blobs.forEach((b, i) => g.blob(b[0] * (0.9 + variant * 0.1), b[1], b[2], b[3], b[4], b[5], rgb(sage[i % sage.length]), 0.14, 7 + i + variant * 11));
  return g.geometry();
}
function rockGeo(theme, variant) { const g = new Geo(), r = mulberry(50 + variant); g.blob(0, 0.45, 0, 1, 0.7 + r() * 0.2, 0.85 + r() * 0.25, rgb(theme.rock), 0.16, 31 + variant); if (variant % 2) g.blob(0.9, 0.2, 0.3, 0.45, 0.35, 0.4, rgb(theme.rock2), 0.15, 5 + variant); return g.geometry(); }
function bushGeo(theme) { const g = new Geo(); g.blob(0, 0.45, 0, 0.8, 0.55, 0.8, rgb(theme.leaf[1]), 0.15, 3); g.blob(0.55, 0.35, 0.2, 0.55, 0.42, 0.55, rgb(theme.leaf[2]), 0.15, 4); g.blob(-0.45, 0.3, -0.3, 0.5, 0.38, 0.5, rgb(theme.leaf[0]), 0.15, 5); return g.geometry(); }
function grassGeo(theme) {                                                      // seven chunky blades fanned from one point, each a bent triangle
  const g = new Geo(), r = mulberry(9), c0 = rgb(theme.bladeCols[0]), c1 = rgb(theme.bladeCols[1]);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + r(), len = 0.35 + r() * 0.35, w = 0.09, bx = Math.cos(a), bz = Math.sin(a), px = -bz, pz = bx, tx = bx * len * 0.6, tz = bz * len * 0.6; g.tri([bx * 0.04 + px * w, 0, bz * 0.04 + pz * w], [bx * 0.04 - px * w, 0, bz * 0.04 - pz * w], [tx, len, tz], i % 2 ? c0 : c1); }
  return g.geometry(true);
}
function flowerGeo() {                                                          // a thin stem and a four-petal head (white; the instance colour tints it)
  const g = new Geo(), st = [0.25, 0.55, 0.2]; g.tri([-0.015, 0, 0], [0.015, 0, 0], [0, 0.42, 0], st);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2, x = Math.cos(a) * 0.09, z = Math.sin(a) * 0.09; g.tri([0, 0.43, 0], [x - z * 0.5, 0.45, z + x * 0.5], [x + z * 0.5, 0.45, z - x * 0.5], [1, 1, 1]); }
  g.tri([-0.03, 0.44, 0], [0.03, 0.44, 0], [0, 0.46, 0.03], [1, 0.85, 0.2]); return g.geometry();
}
function crystalGeo(theme) { const g = new Geo(), r = mulberry(21); for (let i = 0; i < 5; i++) { const a = r() * 6.28, d = i ? 0.35 + r() * 0.3 : 0, h = i ? 0.8 + r() * 0.8 : 1.6, w = i ? 0.12 : 0.2, cx = Math.cos(a) * d, cz = Math.sin(a) * d, lean = (r() - 0.5) * 0.3; const B = [[cx - w, 0, cz - w], [cx + w, 0, cz - w], [cx + w, 0, cz + w], [cx - w, 0, cz + w]], tp = [cx + lean, h, cz + lean * 0.5];
  for (let k = 0; k < 4; k++) g.tri(B[k], B[(k + 1) % 4], tp, rgb(theme.crystal[(k + i) % theme.crystal.length])); } return g.geometry(); }
function mushroomGeo(theme) { const g = new Geo(); g.prism(0, 0, 0, 0.35, 0.07, 0.06, 5, [0.8, 0.82, 0.9]); g.blob(0, 0.4, 0, 0.3, 0.16, 0.3, rgb(theme.glow), 0.08, 6); return g.geometry(); }

// ------------------------------------------------------------------ themes: what grows where. One per stage, palette from the look rules.
export const THEMES = [
  { name: 'ruins', leaf: [0x9dc76a, 0xb7d884, 0x86b85a], bark: 0xc79a6b, rock: 0xd9d3c4, rock2: 0xc2b9a6, bladeCols: [0x8fc060, 0xb2d66e], flowerCols: [0xffe14a, 0xffffff, 0xb28cff, 0xff6b5a],
    trees: 1.0, rocks: 0.5, bushes: 0.6, grass: 1.0, flowers: 0.6, specials: 0 },
  { name: 'crypt', leaf: [0x6e8aa0, 0x7f9db3, 0x5f7a92], bark: 0x8a7a6a, rock: 0x8fa3b5, rock2: 0x72869a, bladeCols: [0x6f9aa3, 0x86b3b8], flowerCols: [0x8ae8ff, 0xb8f4ff], glow: 0x3fd6e0,
    trees: 0.0, rocks: 0.9, bushes: 0.0, grass: 0.2, flowers: 0.1, specials: 0.8, special: 'mushroom' },
  { name: 'vault', leaf: [0xb48cff, 0xc9a8ff, 0x9a70e0], bark: 0x6b3fa0, rock: 0xd8b86a, rock2: 0xb89548, bladeCols: [0xd9b45a, 0xf0cf7a], flowerCols: [0xffe9a8], crystal: [0xb48cff, 0xd6b8ff, 0x8f64d6],
    trees: 0.0, rocks: 0.6, bushes: 0.0, grass: 0.1, flowers: 0.0, specials: 0.9, special: 'crystal' }
];

// ------------------------------------------------------------------ the scatter
export function buildScenery(map, stageIndex, models) {
  const theme = THEMES[Math.min(stageIndex || 0, THEMES.length - 1)], seed = strHash(String(map.hash || map.key || 'x')), rnd = mulberry(seed ^ 0x5CE9E), pat = noise2(seed ^ 0xA11CE), group = new T.Group();
  const R = (MAP && MAP.boundaryR ? MAP.boundaryR : 195) * 0.94;
  // places scenery must stay out of: where you start, the gate, the arena, boss rings and every encounter
  const keep = [{ x: map.spawn.x, z: map.spawn.z, r: 9 }, { x: map.gate.x, z: map.gate.z, r: 12 }];
  if (map.arena) keep.push({ x: map.arena.center.x, z: map.arena.center.z, r: 16 });
  for (const b of map.bossRings || []) keep.push({ x: b.x, z: b.z, r: (b.r || 14) + 3 });
  for (const e of map.encounters || []) keep.push({ x: e.x, z: e.z, r: 6 });
  const free = (x, z, pad) => { for (const k of keep) { const dx = x - k.x, dz = z - k.z, rr = k.r + (pad || 0); if (dx * dx + dz * dz < rr * rr) return false; } return x * x + z * z < R * R; };
  const flat = (x, z, tol = 0.3) => { const h = heightAt(x, z); for (const [dx, dz] of [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]]) if (Math.abs(heightAt(x + dx, z + dz) - h) > tol) return null; return h; };
  const spots = (n, test) => { const out = []; for (let i = 0, tries = 0; out.length < n && tries < n * 12; tries++, i++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R, x = Math.cos(a) * d, z = Math.sin(a) * d; const h = test(x, z); if (h !== null && h !== undefined && h !== false) out.push([x, h, z, rnd]); } return out; };

  const kinds = [];                                                              // { geo, instances: [[x,y,z,scale,rotY,tint]], tint }
  const add = (geo, list, mat) => { if (list.length) kinds.push({ geo, list, mat }); };
  const mat = new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }), matBoth = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });      // blades and petals are single triangles: seen from both sides
  const tint = (lo, hi) => 1 - lo + rnd() * (lo + hi);

  if (theme.trees > 0) {                                                         // groves: pick centres, then ring them with trees of different sizes
    const groves = spots(Math.round(14 * theme.trees), (x, z) => (free(x, z, 14) && flat(x, z, 0.4) !== null ? flat(x, z, 0.4) : null)), per = [];
    for (const g of groves) { const n = 5 + Math.floor(rnd() * 9); for (let i = 0; i < n; i++) { const a = rnd() * 6.283, d = 3 + rnd() * 11, x = g[0] + Math.cos(a) * d, z = g[2] + Math.sin(a) * d; if (!free(x, z, 3)) continue; const h = flat(x, z, 0.35); if (h === null) continue; per.push([x, h, z, 0.75 + rnd() * 0.7, rnd() * 6.283, tint(0.12, 0.12)]); } }
    for (let v = 0; v < 3; v++) add(treeGeo(theme, v), per.filter((_, i) => i % 3 === v), mat);
  }
  if (theme.rocks > 0) { const rs = spots(Math.round(90 * theme.rocks), (x, z) => (free(x, z, 2) ? flat(x, z, 0.5) : null)).map(s => [s[0], s[1], s[2], 0.5 + rnd() * rnd() * 3.2, rnd() * 6.283, tint(0.1, 0.1)]); for (let v = 0; v < 3; v++) add(rockGeo(theme, v), rs.filter((_, i) => i % 3 === v), mat); }
  if (theme.bushes > 0) add(bushGeo(theme), spots(Math.round(110 * theme.bushes), (x, z) => (free(x, z, 2) ? flat(x, z, 0.35) : null)).map(s => [s[0], s[1], s[2], 0.7 + rnd() * 0.8, rnd() * 6.283, tint(0.1, 0.1)]), mat);
  if (theme.special) add(theme.special === 'crystal' ? crystalGeo(theme) : mushroomGeo(theme), spots(Math.round(120 * theme.specials), (x, z) => (free(x, z, 3) ? flat(x, z, 0.4) : null)).map(s => [s[0], s[1], s[2], 0.8 + rnd() * 1.6, rnd() * 6.283, 1]), mat);
  if (theme.grass > 0) add(grassGeo(theme), spots(Math.round(2600 * theme.grass), (x, z) => (free(x, z, 0) && pat(x * 0.045 + 7, z * 0.045 + 3) > 0.38 ? flat(x, z, 0.25) : null)).map(s => [s[0], s[1], s[2], 0.8 + rnd() * 0.9, rnd() * 6.283, tint(0.15, 0.1)]), matBoth);
  if (theme.flowers > 0) {                                                       // meadows: only inside the noise's high patches, in clumps of one colour
    const cols = theme.flowerCols, fl = spots(Math.round(420 * theme.flowers), (x, z) => (free(x, z, 0) && pat(x * 0.03 + 40, z * 0.03 + 9) > 0.62 ? flat(x, z, 0.25) : null)), tinted = [];
    for (const s of fl) { const c = cols[Math.floor(pat(s[0] * 0.05, s[2] * 0.05) * cols.length) % cols.length]; tinted.push([s[0], s[1], s[2], 0.8 + rnd() * 0.6, rnd() * 6.283, c]); }
    kinds.push({ geo: flowerGeo(), list: tinted, mat: matBoth, colored: true });
  }

  for (const k of kinds) {
    if (!k.geo) continue;
    const mesh = new T.InstancedMesh(k.geo, k.mat, k.list.length), m = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), p = new T.Vector3(), up = new T.Vector3(0, 1, 0), c = new T.Color();
    k.list.forEach((it, i) => { q.setFromAxisAngle(up, it[4]); s.setScalar(it[3]); p.set(it[0], it[1], it[2]); m.compose(p, q, s); mesh.setMatrixAt(i, m); if (k.colored) c.setHex(it[5]); else c.setScalar(it[5]); mesh.setColorAt(i, c); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.frustumCulled = false; group.add(mesh);
  }
  group.userData.counts = kinds.map(k => k.list.length);
  return group;
}
