// The open terrain (preview) drawn as it is: the heightfield sampled on a 2 m grid with the vertices at true heights, so every slope is a real slope and there are no steps. Flat-shaded facets.
// Walkable ground gets the stage's ground colour with slow large-scale tint variation; faces steeper than 50 degrees get the banded cliff colour (one tone per horizontal band, so the bands run level along every cliff); the steep edge bank is the same cliff colour.
import { Builder } from './mapMesh.js';
import { vnoise } from '../gen/open/terrain.js';
const T = window.THREE;
const mixc = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
const dim = (c, k) => ((Math.min(255, Math.round(((c >> 16) & 255) * k)) << 16) | (Math.min(255, Math.round(((c >> 8) & 255) * k)) << 8) | Math.min(255, Math.round((c & 255) * k)));

export function buildOpen(map, look) {
  const SIM = 400, HALF = 200, S = 360, OFF = 20, H = map.heights, G = 2, NV = S / G + 1, B = new Builder(), F = new Builder(), group = new T.Group();
  const lo = OFF + 2, hi = OFF + S - 3, cell = (i, j) => H[Math.max(lo, Math.min(hi, j)) * SIM + Math.max(lo, Math.min(hi, i))];
  const hv = (x, z) => { const fx = x + HALF - 0.5, fz = z + HALF - 0.5, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j; return (cell(i, j) * (1 - u) + cell(i + 1, j) * u) * (1 - v) + (cell(i, j + 1) * (1 - u) + cell(i + 1, j + 1) * u) * v; };
  const V = new Float32Array(NV * NV); for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) V[j * NV + i] = hv(-S / 2 + i * G, -S / 2 + j * G);
  const sand = look.sand, rim = look.rim[1], tones = [0.64, 0.78, 0.9];
  const colour = (cx, cz, cy, ny) => {
    const ang = Math.acos(Math.max(0, Math.min(1, ny))) * 57.29578;                          // the face's angle from flat, degrees
    const n1 = vnoise(77, cx / 60, cz / 60), n2 = vnoise(91, cx / 19, cz / 19);
    let g = mixc(mixc(sand[0], sand[2], n1), sand[1], 0.4 + 0.3 * n2); g = mixc(g, rim, (ang > 15 ? Math.min(0.35, (ang - 15) / 60) : 0)); g = mixc(g, 0xfff2d0, Math.min(0.55, Math.max(0, cy - 1.5) / 12 * 0.6)); if (cy < 0.4) g = dim(g, 0.9 + 0.1 * Math.max(0, cy) / 0.4);       // higher ground is lighter, basins a little darker
    if (ang <= 36) return g;
    const band = Math.round(cy / 1.4), cl = dim(rim, tones[((band % 3) + 3) % 3]);
    return ang >= 50 ? cl : mixc(g, cl, (ang - 36) / 14);
  };
  const tri = (a, b, c) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    B.tri(a, b, c, [nx, ny, nz], dim(colour((a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3, (a[1] + b[1] + c[1]) / 3, ny), Math.max(0.64, Math.min(1.3, 1 + 1.5 * (nx * 0.8 + nz * 0.55))))); };       // hillshade: facets facing the sun are lighter, the others darker, so a 15 degree slope reads from above
  for (let j = 0; j < NV - 1; j++) for (let i = 0; i < NV - 1; i++) {
    const x0 = -S / 2 + i * G, z0 = -S / 2 + j * G, x1 = x0 + G, z1 = z0 + G, a = [x0, V[j * NV + i], z0], b = [x1, V[j * NV + i + 1], z0], c = [x1, V[(j + 1) * NV + i + 1], z1], d = [x0, V[(j + 1) * NV + i], z1];
    if (Math.abs(a[1] - c[1]) < Math.abs(b[1] - d[1])) { tri(a, b, c); tri(a, c, d); } else { tri(a, b, d); tri(b, c, d); }       // the cut follows the smaller height change
  }
  // the outer face of the bank: a plain straight cliff from the rim down to the sand
  for (let s = 0; s < NV - 1; s++) for (const [ax, az, bx, bz, out] of [[-S / 2 + s * G, -S / 2, -S / 2 + (s + 1) * G, -S / 2, [0, 0, -1]], [-S / 2 + s * G, S / 2, -S / 2 + (s + 1) * G, S / 2, [0, 0, 1]], [-S / 2, -S / 2 + s * G, -S / 2, -S / 2 + (s + 1) * G, [-1, 0, 0]], [S / 2, -S / 2 + s * G, S / 2, -S / 2 + (s + 1) * G, [1, 0, 0]]]) {
    const ia = out[2] ? s : out[0] < 0 ? 0 : NV - 1, ja = out[2] ? (out[2] < 0 ? 0 : NV - 1) : s, ib = out[2] ? s + 1 : ia, jb = out[2] ? ja : s + 1, ha = V[ja * NV + ia], hb = V[jb * NV + ib], top = Math.max(ha, hb);
    B.quad([ax, -0.2, az], [bx, -0.2, bz], [bx, hb, bz], [ax, ha, az], out, dim(rim, tones[((Math.round(top / 1.4) % 3) + 3) % 3]));
  }
  F.seed = 777; F.quad([-345, -0.2, -345], [345, -0.2, -345], [345, -0.2, 345], [-345, -0.2, 345], [0, 1, 0], look.skirt);
  const fadeU = { cam: { value: new T.Vector3() }, pl: { value: new T.Vector3() } }; group.userData.fade = fadeU;
  group.add(B.mesh(false, fadeU), F.mesh(true, fadeU)); group.userData.tris = B.pos.length / 9 | 0;
  return group;
}
