// Seeded scenery: groves of trees, boulders, bushes, grass tufts and flowers scattered over the generated stage. View only: it never touches
// the sim (no collision, no RNG stream the run uses), so replays and goldens are unaffected. The same stage seed always grows the same stage.
// Every kind is one InstancedMesh with its own chunky look; when a baked model for a kind is present (models.tree etc.) it replaces the stand-in.
import { scatterStage, mulberry } from '../gen/scatter.js';

const T = window.THREE;

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

// ------------------------------------------------------------------ themes: the palette of each stage (what grows where lives in gen/scatter.js)
export const THEMES = [
  { name: 'ruins', leaf: [0x9dc76a, 0xb7d884, 0x86b85a], bark: 0xc79a6b, rock: 0xd9d3c4, rock2: 0xc2b9a6, bladeCols: [0x8fc060, 0xb2d66e], flowerCols: [0xffe14a, 0xffffff, 0xb28cff, 0xff6b5a], special: null },
  { name: 'crypt', leaf: [0x6e8aa0, 0x7f9db3, 0x5f7a92], bark: 0x8a7a6a, rock: 0x8fa3b5, rock2: 0x72869a, bladeCols: [0x6f9aa3, 0x86b3b8], flowerCols: [0x8ae8ff, 0xb8f4ff], glow: 0x3fd6e0, special: 'mushroom' },
  { name: 'vault', leaf: [0xb48cff, 0xc9a8ff, 0x9a70e0], bark: 0x6b3fa0, rock: 0xd8b86a, rock2: 0xb89548, bladeCols: [0xd9b45a, 0xf0cf7a], flowerCols: [0xffe9a8], crystal: [0xb48cff, 0xd6b8ff, 0x8f64d6], special: 'crystal' }
];

// ------------------------------------------------------------------ drawing the scatter
export function buildScenery(map, stageIndex, models) {
  const theme = THEMES[Math.min(stageIndex || 0, THEMES.length - 1)], S = scatterStage(map, stageIndex, false), group = new T.Group();
  const kinds = [], add = (geo, list, mat, colored) => { if (list.length) kinds.push({ geo, list, mat, colored }); };
  const mat = new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }), matBoth = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });      // blades and petals are single triangles: seen from both sides
  for (let v = 0; v < 3; v++) add(treeGeo(theme, v), S.trees[v], mat);
  for (let v = 0; v < 3; v++) add(rockGeo(theme, v), S.rocks[v], mat);
  add(bushGeo(theme), S.bushes, mat);
  if (theme.special) add(theme.special === 'crystal' ? crystalGeo(theme) : mushroomGeo(theme), S.special, mat);
  add(grassGeo(theme), S.grass, matBoth);
  add(flowerGeo(), S.flowers.map(f => [f[0], f[1], f[2], f[3], f[4], theme.flowerCols[f[5] % theme.flowerCols.length]]), matBoth, true);
  for (const k of kinds) {
    const mesh = new T.InstancedMesh(k.geo, k.mat, k.list.length), m = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), p = new T.Vector3(), up = new T.Vector3(0, 1, 0), c = new T.Color();
    k.list.forEach((it, i) => { q.setFromAxisAngle(up, it[4]); s.setScalar(it[3]); p.set(it[0], it[1], it[2]); m.compose(p, q, s); mesh.setMatrixAt(i, m); if (k.colored) c.setHex(it[5]); else c.setScalar(it[5]); mesh.setColorAt(i, c); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.frustumCulled = false; group.add(mesh);
  }
  group.userData.counts = kinds.map(k => k.list.length); group.userData.flowerSpots = S.flowerSpots; group.userData.scatter = S;
  return group;
}
