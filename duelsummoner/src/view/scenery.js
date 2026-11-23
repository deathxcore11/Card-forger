// Seeded scenery: groves of trees, boulders, bushes, grass tufts and flowers scattered over the generated stage. View only: it never touches
// the sim (no collision, no RNG stream the run uses), so replays and goldens are unaffected. The same stage seed always grows the same stage.
// Every kind is one InstancedMesh with its own chunky look; when a baked model for a kind is present (models.tree etc.) it replaces the stand-in.
import { scatterStage, mulberry } from '../gen/scatter.js';
import { seeInstanced } from './seethrough.js';
import { windify } from './engine.js';

// the top-down shadow mask (one 512 x 512 texture over the 464 m square, baked once per stage): a soft disc for every tree canopy, boulder and bush, pushed away from the sun by its height
function bakeShadowMask(S) {
  const n = 512, d = new Uint8Array(n * n * 4), B0 = -232, SZ = 464, k = n / SZ, ox = -0.86, oz = -0.51;
  const disc = (x, z, r) => { const cx = (x - B0) * k, cz = (z - B0) * k, rr = r * k, x0 = Math.max(0, Math.floor(cx - rr)), x1 = Math.min(n - 1, Math.ceil(cx + rr)), z0 = Math.max(0, Math.floor(cz - rr)), z1 = Math.min(n - 1, Math.ceil(cz + rr));
    for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) { const dd = Math.hypot(i + 0.5 - cx, j + 0.5 - cz) / rr; if (dd < 1) { const v = 255 * Math.min(1, (1 - dd) * 3 + 0.2), o = (j * n + i) * 4; if (v > d[o]) d[o] = v; } } };
  for (let v = 0; v < 4; v++) for (const it of S.trees[v]) disc(it[0] + ox * 5 * it[3], it[2] + oz * 5 * it[3], (v < 2 ? 4.4 : 3.4) * it[3]);
  for (const it of [].concat(S.rocks[0], S.rocks[1], S.rocks[2])) disc(it[0] + ox * 1.2 * it[3], it[2] + oz * 1.2 * it[3], 1.3 * it[3]);
  for (const it of S.bushes) disc(it[0] + ox * 0.6 * it[3], it[2] + oz * 0.6 * it[3], 1.0 * it[3]);
  for (let i = 3; i < d.length; i += 4) d[i] = 255;
  const tex = new T.DataTexture(d, n, n, T.RGBAFormat); tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping; tex.minFilter = tex.magFilter = T.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true; return tex;
}

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
// two tree species, both built 10 m tall at scale 1: the parasol (variants 0 and 1, scale 0.9-1.1, a wide flat crown) and the blob (variants 2 and 3, scale 1.3-1.6, 13-16 m). The trunk is bare to about 5.6 m and upright.
function trunkGeo(theme, v) { const g = new Geo(); g.prism(0, 0, 0, v < 2 ? 6.4 : 5.6, 0.55, 0.32, 8, rgb(theme.bark), 0); return g.geometry(); }
// one geometry from a trunk and a canopy, with a per-vertex part (0 trunk, 1 canopy) so the two fade on their own
function treeGeo(theme, v) {
  const a = trunkGeo(theme, v), b = canopyGeo(theme, v), na = a.attributes.position.count, nb = b.attributes.position.count, g = new T.BufferGeometry(), cat = (n1, n2, k) => { const o = new Float32Array((n1.length + n2.length)); o.set(n1); o.set(n2, n1.length); return o; };
  g.setAttribute('position', new T.BufferAttribute(cat(a.attributes.position.array, b.attributes.position.array), 3)); g.setAttribute('normal', new T.BufferAttribute(cat(a.attributes.normal.array, b.attributes.normal.array), 3)); g.setAttribute('color', new T.BufferAttribute(cat(a.attributes.color.array, b.attributes.color.array), 3));
  const part = new Float32Array(na + nb); part.fill(1, na); g.setAttribute('aPart', new T.BufferAttribute(part, 1)); return g;
}
function canopyGeo(theme, v) {
  const g = new Geo(), sage = theme.leaf;
  const blobs = v < 2 ? [[0, 7.7, 0, 4.6, 1.9, 4.6], [-3.4, 7.3, 1.0, 3.0, 1.6, 3.0], [3.2, 7.4, -1.2, 3.2, 1.7, 3.2], [0.8, 7.2, 3.4, 2.8, 1.6, 2.8]]
    : [[0, 7.8, 0, 3.6, 2.8, 3.6], [-3.2, 6.9, 0.6, 2.6, 2.1, 2.6], [3.0, 7.1, -0.8, 2.8, 2.2, 2.8], [0.4, 6.9, 3.0, 2.5, 2.1, 2.5], [-0.6, 9.4, -0.6, 2.4, 1.8, 2.4]];
  if (v === 2) blobs.pop();                                                         // two of the three blob looks lose the small top blob
  blobs.forEach((q, i) => g.blob(q[0], q[1], q[2], q[3], q[4], q[5], rgb(sage[i % sage.length]), 0.14, 7 + i + v * 11));
  return g.geometry();
}
function rockGeo(theme, variant) { const g = new Geo(), r = mulberry(50 + variant); g.blob(0, 0.45, 0, 1, 0.7 + r() * 0.2, 0.85 + r() * 0.25, rgb(theme.rock), 0.16, 31 + variant); if (variant % 2) g.blob(0.9, 0.2, 0.3, 0.45, 0.35, 0.4, rgb(theme.rock2), 0.15, 5 + variant); return g.geometry(); }
function bushGeo(theme) { const g = new Geo(); g.blob(0, 0.45, 0, 0.8, 0.55, 0.8, rgb(theme.leaf[1]), 0.15, 3); g.blob(0.55, 0.35, 0.2, 0.55, 0.42, 0.55, rgb(theme.leaf[2]), 0.15, 4); g.blob(-0.45, 0.3, -0.3, 0.5, 0.38, 0.5, rgb(theme.leaf[0]), 0.15, 5); return g.geometry(); }
function grassGeo(theme) {                                                      // four short blades fanned from one point, each a bent triangle (0.25 to 0.4 m long)
  const g = new Geo(), r = mulberry(9), c0 = rgb(theme.bladeCols[0]), c1 = rgb(theme.bladeCols[1]);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + r(), len = 0.25 + r() * 0.15, w = 0.09, bx = Math.cos(a), bz = Math.sin(a), px = -bz, pz = bx, tx = bx * len * 0.6, tz = bz * len * 0.6; g.tri([bx * 0.04 + px * w, 0, bz * 0.04 + pz * w], [bx * 0.04 - px * w, 0, bz * 0.04 - pz * w], [tx, len, tz], i % 2 ? c0 : c1); }
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
  { name: 'ruins', leaf: [0x5a9a66, 0x66a46e, 0x74ae72], bark: 0x5e5048, rock: 0xbdb8ae, rock2: 0xb0aa9e, bladeCols: [0x8a7a48, 0x8a7a48], flowerCols: [0xffe14a, 0xffffff, 0xb28cff, 0xff6b5a], special: null },
  { name: 'crypt', leaf: [0x6e8aa0, 0x7f9db3, 0x5f7a92], bark: 0x8a7a6a, rock: 0x8fa3b5, rock2: 0x72869a, bladeCols: [0x6f9aa3, 0x86b3b8], flowerCols: [0x8ae8ff, 0xb8f4ff], glow: 0x3fd6e0, special: 'mushroom' },
  { name: 'vault', leaf: [0x8a7a5c, 0xb8a37c, 0x46445a], bark: 0x2e2c3a, rock: 0x46445a, rock2: 0x2e2c3a, bladeCols: [0x8a7a5c, 0xb8a37c], flowerCols: [0xd8e4f4], crystal: [0xd8e4f4, 0xf4f8ff, 0x9fb4d0], glow: 0x9fb4d0, special: 'crystal' }       // basalt, ash-gold and moon-white: no violet in the scenery (violet means summons and seals)
];

// ------------------------------------------------------------------ drawing the scatter
export function buildScenery(map, stageIndex, models) {
  const theme = THEMES[Math.min(stageIndex || 0, THEMES.length - 1)], S = scatterStage(map, stageIndex, false), group = new T.Group();
  const kinds = [], add = (geo, list, mat, colored, canopy, v) => { if (list.length) kinds.push({ geo, list, mat, colored, canopy, v }); };
  const mat0 = new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }), mat = mat0, matBoth = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });      // blades and petals are single triangles: seen from both sides
  for (let v = 0; v < 4; v++) add(treeGeo(theme, v), S.trees[v], windify(seeInstanced(mat0.clone(), { c: [0, 7.5, 0], r: v < 2 ? 4.8 : 3.7, keep0: 0.25 }, { top: v < 2 ? 6.4 : 5.6 }), { h: 9, lean: 0.35, flut: 0.03 }), false, 3, v);       // trunk and canopy are one mesh per variant (aPart 0 and 1); each variant has its own material (its canopy radius), still 4 draws
  { const rg = rockGeo(theme, 0), all = [].concat(S.rocks[0], S.rocks[1], S.rocks[2]); rg.computeBoundingSphere(); const bs = rg.boundingSphere; add(rg, all, seeInstanced(mat.clone(), { c: [bs.center.x, bs.center.y, bs.center.z], r: bs.radius, keep0: 0.25 })); }       // one shared boulder shape; size, squash and turn make the variety
  const fadeOut = (m, nearD, farD) => { const c = m.clone(); c.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n { float dd_ = distance((modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz, cameraPosition); if (dd_ < ' + nearD.toFixed(1) + ' || dd_ > ' + farD.toFixed(1) + ') transformed *= 0.0; }\n#endif'); }; return c; };       // small scatter collapses in the vertex shader: nothing within 4 m of the camera, and a far cut-off, with no per-frame upload
  { const bg = bushGeo(theme); bg.computeBoundingSphere(); const bs = bg.boundingSphere; add(bg, S.bushes, seeInstanced(fadeOut(mat, 0, 90), { c: [bs.center.x, bs.center.y, bs.center.z], r: bs.radius, keep0: 0.25 })); }
  if (theme.special) { const sg = theme.special === 'crystal' ? crystalGeo(theme) : mushroomGeo(theme); sg.computeBoundingSphere(); const bs = sg.boundingSphere; add(sg, S.special, seeInstanced(mat.clone(), { c: [bs.center.x, bs.center.y, bs.center.z], r: bs.radius, keep0: 0.25 })); }
  add(grassGeo(theme), S.grass, windify(fadeOut(matBoth, 4, 70), { h: 0.35, lean: 0.2, flut: 0.03 }));
  add(flowerGeo(), S.flowers.map(f => [f[0], f[1], f[2], f[3], f[4], theme.flowerCols[f[5] % theme.flowerCols.length]]), windify(fadeOut(matBoth, 4, 50), { h: 0.5, lean: 0.14, flut: 0.02 }), true);
  for (const k of kinds) {
    const mesh = new T.InstancedMesh(k.geo, k.mat, k.list.length), m = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), p = new T.Vector3(), up = new T.Vector3(0, 1, 0), c = new T.Color();
    k.list.forEach((it, i) => { q.setFromAxisAngle(up, it[4]); s.set(it[3], it[6] || it[3], it[3]); p.set(it[0], it[1], it[2]); m.compose(p, q, s); mesh.setMatrixAt(i, m); if (k.colored) c.setHex(it[5]); else c.setScalar(it[5]); mesh.setColorAt(i, c); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.frustumCulled = false; group.add(mesh);
  }
  {   // one static instanced contact-shadow mesh under every tree, boulder and bush (one draw call): the ground under a prop is darker, so props stand on the sand instead of floating
    const sh = []; const push = (it, r) => sh.push([it[0], it[1], it[2], r]);
    for (let v = 0; v < 4; v++) for (const it of S.trees[v]) push(it, (v < 2 ? 2.4 : 3.2) * it[3]);
    for (const it of [].concat(S.rocks[0], S.rocks[1], S.rocks[2])) push(it, 1.5 * it[3]);
    for (const it of S.bushes) push(it, 1.1 * it[3]);
    if (sh.length) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(30,18,8,0.55)'); gr.addColorStop(0.5, 'rgba(30,18,8,0.4)'); gr.addColorStop(1, 'rgba(30,18,8,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
      const geo = new T.PlaneGeometry(2, 2); geo.rotateX(-Math.PI / 2); const m4 = new T.Matrix4(), sc = new T.Vector3(), ps = new T.Vector3(), q0 = new T.Quaternion();
      const mesh = new T.InstancedMesh(geo, new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), sh.length);
      sh.forEach((s, i) => { ps.set(s[0], s[1] + 0.06, s[2]); sc.set(s[3], 1, s[3]); m4.compose(ps, q0, sc); mesh.setMatrixAt(i, m4); }); mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.renderOrder = 1; group.add(mesh); group.userData.propShadows = sh.length;
    }
  }
  group.userData.counts = kinds.map(k => k.list.length); group.userData.flowerSpots = S.flowerSpots; group.userData.scatter = S; group.userData.mask = bakeShadowMask(S); group.userData.theme = theme;
  return group;
}



