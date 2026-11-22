// Builds one flat-shaded, vertex-coloured mesh from the same primitives the collision uses.
import { MAP } from '../data/map.js';

const T = window.THREE, DEG = Math.PI / 180;

class Builder {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.seed = 12345; }
  rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  // quad a,b,c,d (any winding); `out` is a vector pointing away from the solid so we can face it correctly
  quad(a, b, c, d, out, color) { this.tri(a, b, c, out, color); this.tri(a, c, d, out, color); }
  tri(a, b, c, out, color) {
    let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz); if (l < 1e-9) return;
    nx /= l; ny /= l; nz /= l;
    if (nx * out[0] + ny * out[1] + nz * out[2] < 0) { const t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz; }
    const j = 0.9 + this.rnd() * 0.2, r = ((color >> 16) & 255) / 255 * j, g = ((color >> 8) & 255) / 255 * j, bl = (color & 255) / 255 * j;
    [a, b, c].forEach(p => { this.pos.push(p[0], p[1], p[2]); this.nor.push(nx, ny, nz); this.col.push(r, g, bl); });
  }
  mesh() {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3));
    return new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
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

function addCyl(B, p) {
  const y0 = p.y0 || 0, n = 8, pt = (a, y) => [p.x + p.r * Math.cos(a), y, p.z + p.r * Math.sin(a)];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2, m = (a + b) / 2;
    B.tri([p.x, p.h, p.z], pt(a, p.h), pt(b, p.h), [0, 1, 0], p.c);
    B.quad(pt(a, y0), pt(b, y0), pt(b, p.h), pt(a, p.h), [Math.cos(m), 0, Math.sin(m)], p.c);
  }
}

export function buildMapMesh(map) {
  const B = new Builder();
  // desert floor: a coarse patchwork so movement reads
  const R = 215, cell = 16;
  for (let x = -R; x < R; x += cell) for (let z = -R; z < R; z += cell) {
    const t = B.rnd(), col = t < 0.4 ? 0xd2b27a : t < 0.75 ? 0xc9a56c : 0xbf9a62;
    B.quad([x, 0, z], [x + cell, 0, z], [x + cell, 0, z + cell], [x, 0, z + cell], [0, 1, 0], col);
  }
  map.prims.forEach(p => { if (p.t === 'box') addBox(B, p); else if (p.t === 'ramp') addRamp(B, p); else if (p.t === 'ring') addRing(B, p); else addCyl(B, p); });
  // cliff wall around the edge of the world
  const n = 56, w = MAP.boundaryR + 6;
  for (let i = 0; i < n; i++) {
    const a = i / n * 360, cx = w * Math.cos(a * DEG), cz = w * Math.sin(a * DEG), len = 2 * Math.PI * w / n * 0.56;
    addBox(B, { x0: cx - len, x1: cx + len, z0: cz - 6, z1: cz + 6, h: MAP.wallTop * (0.8 + B.rnd() * 0.4), rot: a + 90, c: i % 2 ? 0x8a6a45 : 0x9a7650 });
  }
  return B.mesh();
}
