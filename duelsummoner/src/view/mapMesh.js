// Builds one flat-shaded, vertex-coloured mesh from the same primitives the collision uses.
import { MAP } from '../data/map.js';
import { seeMap } from './seethrough.js';

const T = window.THREE, DEG = Math.PI / 180;

class Builder {
  constructor(uv) { this.pos = []; this.nor = []; this.col = []; this.uv = uv ? [] : null; this.seed = 12345; }
  rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  // quad a,b,c,d (any winding); `out` is a vector pointing away from the solid so we can face it correctly
  quad(a, b, c, d, out, color) { this.tri(a, b, c, out, color); this.tri(a, c, d, out, color); }
  tri(a, b, c, out, color) {
    let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz); if (l < 1e-9) return;
    nx /= l; ny /= l; nz /= l;
    if (nx * out[0] + ny * out[1] + nz * out[2] < 0) { const t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz; }
    const j = 0.97 + this.rnd() * 0.06, r = ((color >> 16) & 255) / 255 * j, g = ((color >> 8) & 255) / 255 * j, bl = (color & 255) / 255 * j;
    [a, b, c].forEach(p => { this.pos.push(p[0], p[1], p[2]); this.nor.push(nx, ny, nz); this.col.push(r, g, bl); if (this.uv) this.uv.push(p[0] / 26, p[2] / 26); });
  }
  mesh(far, fade) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3)); if (this.uv) g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2));
    const mat = new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }); if (this.uv) mat.map = groundTex();
    if (far) mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', '#ifdef USE_FOG\n float fogFactor = min(smoothstep(fogNear, fogFar, fogDepth), 0.55);\n gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);\n#endif'); };       // far pieces never fog past 55%, so the rim and the landmarks stay readable silhouettes
    if (fade) seeMap(mat);                            // anything solid between the camera and the duelist opens a screen-space porthole round the duelist (walls, pylons, columns, ruins, the rim)
    return new T.Mesh(g, mat);
  }
}

function addBox(B, p) {
  const y0 = p.y0 || 0, y1 = p.h, cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2, hw = (p.x1 - p.x0) / 2, hd = (p.z1 - p.z0) / 2;
  const c = Math.cos((p.rot || 0) * DEG), s = Math.sin((p.rot || 0) * DEG);
  const P = (lx, lz, y) => [cx + lx * c - lz * s, y, cz + lx * s + lz * c];
  const A = P(-hw, -hd, 0), Bq = P(hw, -hd, 0), C = P(hw, hd, 0), D = P(-hw, hd, 0);
  B.quad(P(-hw, -hd, y1), P(hw, -hd, y1), P(hw, hd, y1), P(-hw, hd, y1), [0, 1, 0], p.c);
  const sides = [[A, Bq, [0, 0, -1]], [Bq, C, [1, 0, 0]], [C, D, [0, 0, 1]], [D, A, [-1, 0, 0]]];
  sides.forEach(sd => {
    const a = sd[0], b = sd[1], o = [(a[0] + b[0]) / 2 - cx, 0, (a[2] + b[2]) / 2 - cz];
    B.quad([a[0], y0, a[2]], [b[0], y0, b[2]], [b[0], y1, b[2]], [a[0], y1, a[2]], o, p.c);
  });
}

function addRamp(B, p) {
  const ax = p.axis === 'x';
  const V = (a, b, y) => (ax ? [a, y, b] : [b, y, a]);
  const mid = [(p.a0 + p.a1) / 2, (p.b0 + p.b1) / 2], dirA = Math.sign(p.a1 - p.a0);
  const O = (da, db, dy) => (ax ? [da, dy, db] : [db, dy, da]);
  B.quad(V(p.a0, p.b0, p.h0), V(p.a1, p.b0, p.h1), V(p.a1, p.b1, p.h1), V(p.a0, p.b1, p.h0), [0, 1, 0], p.c);
  [[p.b0, -1], [p.b1, 1]].forEach(s => {                       // two side walls (triangles/trapezoids)
    B.quad(V(p.a0, s[0], 0), V(p.a1, s[0], 0), V(p.a1, s[0], p.h1), V(p.a0, s[0], p.h0), O(0, s[1], 0), p.c);
  });
  if (p.h1 > 0) B.quad(V(p.a1, p.b0, 0), V(p.a1, p.b1, 0), V(p.a1, p.b1, p.h1), V(p.a1, p.b0, p.h1), O(dirA, 0, 0), p.c);
  if (p.h0 > 0) B.quad(V(p.a0, p.b0, 0), V(p.a0, p.b1, 0), V(p.a0, p.b1, p.h0), V(p.a0, p.b0, p.h0), O(-dirA, 0, 0), p.c);
}

function addRing(B, p) {
  const y0 = p.y0 || 0, y1 = p.h, step = 5, n = Math.max(1, Math.ceil((p.a1 - p.a0) / step));
  const pt = (r, a, y) => [p.cx + r * Math.cos(a * DEG), y, p.cz + r * Math.sin(a * DEG)];
  for (let i = 0; i < n; i++) {
    const a = p.a0 + (p.a1 - p.a0) * i / n, b = p.a0 + (p.a1 - p.a0) * (i + 1) / n, m = (a + b) / 2 * DEG;
    B.quad(pt(p.r0, a, y1), pt(p.r1, a, y1), pt(p.r1, b, y1), pt(p.r0, b, y1), [0, 1, 0], p.c);
    B.quad(pt(p.r1, a, y0), pt(p.r1, b, y0), pt(p.r1, b, y1), pt(p.r1, a, y1), [Math.cos(m), 0, Math.sin(m)], p.c);
    B.quad(pt(p.r0, a, y0), pt(p.r0, b, y0), pt(p.r0, b, y1), pt(p.r0, a, y1), [-Math.cos(m), 0, -Math.sin(m)], p.c);
  }
  [[p.a0, -1], [p.a1, 1]].forEach(e => {                        // end caps
    const a = e[0] * DEG, o = [-Math.sin(a) * e[1], 0, Math.cos(a) * e[1]];
    B.quad(pt(p.r0, e[0], y0), pt(p.r1, e[0], y0), pt(p.r1, e[0], y1), pt(p.r0, e[0], y1), o, p.c);
  });
}

// a slab tilted back by tiltDeg about its width axis and turned by yawDeg: w wide, t thick, hgt tall from y0 up (the mega landmark)
function addTilt(B, cx, cy, cz, w, t, hgt, yawDeg, tiltDeg, color, y0) {
  const ct = Math.cos(tiltDeg * DEG), st = Math.sin(tiltDeg * DEG), ca = Math.cos(yawDeg * DEG), sa = Math.sin(yawDeg * DEG), P = (sx, y, sz) => { const lx = sx * w / 2, lz = sz * t / 2, y2 = y * ct - lz * st, z2 = y * st + lz * ct; return [cx + lx * ca + z2 * sa, cy + y2, cz - lx * sa + z2 * ca]; };
  const lo = y0 || 0, c = [P(0, (lo + hgt) / 2, 0)][0], V = (a, b, d) => P(a, b, d), face = (pts, mid) => B.quad(pts[0], pts[1], pts[2], pts[3], [mid[0] - c[0], mid[1] - c[1], mid[2] - c[2]], color);
  face([V(-1, lo, 1), V(1, lo, 1), V(1, hgt, 1), V(-1, hgt, 1)], P(0, (lo + hgt) / 2, 2)); face([V(-1, lo, -1), V(1, lo, -1), V(1, hgt, -1), V(-1, hgt, -1)], P(0, (lo + hgt) / 2, -2));
  face([V(1, lo, -1), V(1, lo, 1), V(1, hgt, 1), V(1, hgt, -1)], P(2, (lo + hgt) / 2, 0)); face([V(-1, lo, -1), V(-1, lo, 1), V(-1, hgt, 1), V(-1, hgt, -1)], P(-2, (lo + hgt) / 2, 0));
  face([V(-1, hgt, -1), V(1, hgt, -1), V(1, hgt, 1), V(-1, hgt, 1)], P(0, hgt + 2, 0));
}

function addCyl(B, p) {
  const y0 = p.y0 || 0, n = 8, pt = (a, y) => [p.x + p.r * Math.cos(a), y, p.z + p.r * Math.sin(a)];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2, m = (a + b) / 2;
    B.tri([p.x, p.h, p.z], pt(a, p.h), pt(b, p.h), [0, 1, 0], p.c);
    B.quad(pt(a, y0), pt(b, y0), pt(b, p.h), pt(a, p.h), [Math.cos(m), 0, Math.sin(m)], p.c);
  }
}

// 2D value noise, two octaves, for the ground colour
const hash2 = (x, z) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); return (hash2(xi, zi) * (1 - u) + hash2(xi + 1, zi) * u) * (1 - v) + (hash2(xi, zi + 1) * (1 - u) + hash2(xi + 1, zi + 1) * u) * v; }
const SAND = [0xc8a46c, 0xcaa978, 0xc09c66];

import { roadPath, poolSpots } from '../gen/road.js';
// a tiling detail texture for the ground: soft dark blotches and light and dark flecks, multiplied over the cell colours so open sand is never one flat colour (one draw, no extra triangles)
let gtex = null;
function groundTex() {
  if (gtex) return gtex; const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, 256, 256); let s = 99; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const wrap = (x, y, rad, col) => { c.fillStyle = col; for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) { c.beginPath(); c.arc(x + dx, y + dy, rad, 0, 6.283); c.fill(); } };
  for (let i = 0; i < 70; i++) wrap(r() * 256, r() * 256, 12 + r() * 34, 'rgba(120,95,50,0.16)');
  for (let i = 0; i < 40; i++) wrap(r() * 256, r() * 256, 10 + r() * 24, 'rgba(255,245,215,0.20)');
  for (let i = 0; i < 900; i++) wrap(r() * 256, r() * 256, 0.8 + r() * 1.6, r() < 0.6 ? 'rgba(90,70,40,0.35)' : 'rgba(255,250,235,0.45)');
  gtex = new T.CanvasTexture(cv); gtex.wrapS = gtex.wrapT = T.RepeatWrapping; gtex.magFilter = T.LinearFilter; gtex.minFilter = T.LinearMipmapLinearFilter; return gtex;
}
export function buildMapMesh(map) {
  const B = new Builder(), F = new Builder(), G = new Builder(true), group = new T.Group();
  F.seed = 777;
  // the ground: 8 m cells coloured by two octaves of noise (periods 60 m and 18 m) across three sand tones
  const R = 216, cell = 8;
  for (let x = -R; x < R; x += cell) for (let z = -R; z < R; z += cell) {
    const nz = vnoise(x / 60 + 11, z / 60 + 5) * 0.65 + vnoise(x / 18 + 3, z / 18 + 9) * 0.35, col = nz < 0.4 ? SAND[2] : nz < 0.6 ? SAND[0] : SAND[1];
    G.quad([x, 0, z], [x + cell, 0, z], [x + cell, 0, z + cell], [x, 0, z + cell], [0, 1, 0], col);
  }
  // the worn dirt road and its 3 m trails: top-face strips just above the ground, 15 to 25 percent darker than the sand, no kerbs
  { const rd = roadPath(map), strip = (ax, az, bx, bz, hw) => { const dx = bx - ax, dz = bz - az, l = Math.sqrt(dx * dx + dz * dz) || 1, px = -dz / l * hw, pz = dx / l * hw; B.quad([ax - px, 0.05, az - pz], [ax + px, 0.05, az + pz], [bx + px, 0.05, bz + pz], [bx - px, 0.05, bz - pz], [0, 1, 0], 0xb09470); };
    for (let i = 1; i < rd.main.length; i++) strip(rd.main[i - 1][0], rd.main[i - 1][1], rd.main[i][0], rd.main[i][1], rd.width / 2); for (const t of rd.trails) strip(t[0][0], t[0][1], t[1][0], t[1][1], rd.trailWidth / 2); }
  // two summoning pools: an ink-blue disc, a bone rim 1.5 m wide, a ring of glyph tiles; flat and walkable, no effect
  for (const p of poolSpots(map)) { addCyl(B, { x: p.x, z: p.z, r: p.r, h: 0.06, c: 0x2e3f66 }); addRing(B, { cx: p.x, cz: p.z, r0: p.r, r1: p.r + 1.5, a0: 0, a1: 360, h: 0.08, c: 0xe6dcc0 });
    for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283, x = p.x + Math.cos(a) * (p.r + 2.2), z = p.z + Math.sin(a) * (p.r + 2.2); addBox(B, { x0: x - 0.5, x1: x + 0.5, z0: z - 0.5, z1: z + 0.5, h: 0.09, rot: a / DEG, c: 0x4a4250 }); } }
  map.prims.forEach(p => { const T2 = p.landmark ? F : B; if (p.t === 'tilt') addTilt(B, p.x, 0, p.z, p.w, p.th, p.hgt, p.yaw, p.tilt, p.c); else if (p.t === 'box') addBox(T2, p); else if (p.t === 'ramp') addRamp(T2, p); else if (p.t === 'ring') addRing(T2, p); else addCyl(T2, p); });
  // the rim: 56 stacked buttes (a base, an inset mid band, a cap on about a third), 16 to 45 m tall, in two strata colours; 8 seeded notches only 8 to 10 m high (view only; the invisible wall stays)
  const n = 56, w = MAP.boundaryR + 6, hs = [];
  for (let i = 0; i < n; i++) {
    const notch = i % 7 === 3; let hb = 10 + F.rnd() * 4, hm = 6 + F.rnd() * 12, hc = F.rnd() < 0.34 ? 8 + F.rnd() * 5 : 0;
    if (notch) { hb = 8 + F.rnd() * 2; hm = 0; hc = 0; }
    else { const t = hb + hm + hc, p1 = hs[i - 1], p2 = hs[i - 2]; if (p1 !== undefined && p2 !== undefined && Math.abs(t - p1) < 2 && Math.abs(p1 - p2) < 2) hm += 4; }
    hs.push(hb + hm + hc);
    const a = i / n * 360, cx = w * Math.cos(a * DEG), cz = w * Math.sin(a * DEG), len = 2 * Math.PI * w / n * 0.56, ry = a + 90 + (F.rnd() - 0.5) * 16;
    addBox(F, { x0: cx - len, x1: cx + len, z0: cz - 6, z1: cz + 6, h: hb, rot: ry, c: 0xbca494 });
    if (hm > 0) addBox(F, { x0: cx - len + 3, x1: cx + len - 3, z0: cz - 3.5, z1: cz + 3.5, y0: hb, h: hb + hm, rot: ry, c: 0xd0bcaa });
    if (hc > 0) addBox(F, { x0: cx - len + 7, x1: cx + len - 7, z0: cz - 2, z1: cz + 2, y0: hb + hm, h: hb + hm + hc, rot: ry, c: 0xbca494 });
  }
  // a backdrop ring of 12 mesas far behind the rim (fogged), and a wide skirt of ground under them
  for (let i = 0; i < 12; i++) { const a = (i + F.rnd() * 0.6) / 12 * 360, r = 270 + F.rnd() * 60, ww = 30 + F.rnd() * 30, hh = 40 + F.rnd() * 50, cx = r * Math.cos(a * DEG), cz = r * Math.sin(a * DEG); addBox(F, { x0: cx - ww / 2, x1: cx + ww / 2, z0: cz - ww / 3, z1: cz + ww / 3, h: hh, rot: a + 90, c: 0xd4c4ac }); }
  F.quad([-345, -0.2, -345], [345, -0.2, -345], [345, -0.2, 345], [-345, -0.2, 345], [0, 1, 0], 0xc8a46c);
  // the mega landmark: a colossal buried card, half sunk and tilted, 64 m tall, on the far side of the map from the start (view only)
  { const sa = Math.atan2(map.gate.z - map.spawn.z, map.gate.x - map.spawn.x) + 2.6, mx = 250 * Math.cos(sa), mz = 250 * Math.sin(sa), yaw = sa / DEG + 90;
    addTilt(F, mx, -6, mz, 24, 3, 64, yaw, 20, 0xe6dcc0); addTilt(F, mx, -6, mz, 20, 3.5, 60, yaw, 20, 0x4a4250, 2); }
  const fadeU = { cam: { value: new T.Vector3() }, pl: { value: new T.Vector3() } }; group.userData.fade = fadeU;
  group.add(B.mesh(false, fadeU), F.mesh(true, fadeU), G.mesh(false));
  return group;
}

