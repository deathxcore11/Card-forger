// The open desert drawn as it is: the playable square (within the boundary line) sampled on a 2 m grid at true heights, and the same dune sheet carrying on past the line for 222 m on every side (a coarser grid, no collision),
// fading into the haze. There is no wall, no bank and no table plane: the line itself is a thin dark strip lying on the sand. Flat-shaded facets.
// Ground look: warm orange sand, the sun side of every dune lighter, the lee side deeper; fine ripple streaks run along the wind (a tiling streak map, view only); the blocks are plaster and sandstone with banded steep sides.
import { Builder } from './mapMesh.js';
import { vnoise, groundAt, duneH, blockProf, LINE } from '../gen/open/terrain.js';
import { addDressing } from './openDressing.js';
const T = window.THREE;
const mixc = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
const dim = (c, k) => ((Math.min(255, Math.round(((c >> 16) & 255) * k)) << 16) | (Math.min(255, Math.round(((c >> 8) & 255) * k)) << 8) | Math.min(255, Math.round((c & 255) * k)));
const LIT = 0xf2bc66, MID = 0xe3a04b, LEE = 0xb26b2e, TINT_A = 0xdf9a45, TINT_B = 0xeaac58, LINE_COL = 0x2a1a10;

// the ripple streak map: long thin pale and dark lines along u (the wind), repeating every 24 m by 12 m
function streakTex() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const c = cv.getContext('2d'); c.fillStyle = '#ebebeb'; c.fillRect(0, 0, 512, 256);
  let s = 12345; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let k = 0; k < 260; k++) { const y = r() * 256, x = r() * 512, len = 60 + r() * 220, light = r() < 0.5, a = 0.06 + r() * 0.14; c.strokeStyle = light ? 'rgba(255,255,255,' + a * 1.4 + ')' : 'rgba(150,150,150,' + a + ')'; c.lineWidth = 1 + (r() < 0.25 ? 1 : 0); for (const ox of [-512, 0, 512]) { c.beginPath(); c.moveTo(x + ox, y); c.lineTo(x + ox + len, y + (r() - 0.5) * 2); c.stroke(); } }
  const tex = new T.CanvasTexture(cv); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.anisotropy = 4; return tex;
}

export function buildOpen(map, look) {
  const group = new T.Group(), B = new Builder(), O = new Builder(), D = new Builder(), blocks = map.blocks || [], wind = map.dune ? map.dune.wind : 0, cw = Math.cos(wind), sw = Math.sin(wind);
  // under a block the view ground is the plain dune (the box drawn by openDressing hides it), so the 2 m grid leaves no teeth round the foot
  const near = [], gh = (x, z) => { for (const b of blocks) { const dx = x - b.cx, dz = z - b.cz, R = Math.max(b.rx, b.rz) * 1.3 + 3; if (dx * dx + dz * dz < R * R && blockProf(b, x, z) > 0.05) return duneH(map.dune, x, z); } return groundAt(map, x, z); };
  const colour = (cx, cz, cy, nx, ny, nz) => {
        const e = 3, gx = (groundAt(map, cx + e, cz) - groundAt(map, cx - e, cz)) / (2 * e), gz = (groundAt(map, cx, cz + e) - groundAt(map, cx, cz - e)) / (2 * e), sh = Math.max(-1, Math.min(1, (-gx * 0.8 - gz * 0.55) * 4.2));       // the slope over a 6 m window (not the facet), so a dune reads as one lit side and one shaded side                       // the sun is on the +x +z side: windward faces are lit, lee faces are in shade
    const base = mixc(TINT_A, TINT_B, vnoise(77, cx / 110, cz / 110));                          // one slow tint across the map, no blotches
    let g = sh > 0 ? mixc(base, LIT, sh) : mixc(base, LEE, -sh * 0.9); return dim(g, 0.97 + 0.05 * Math.max(0, Math.min(1, (cy - 1) / 8)));
  };
  const tri = (Bd, a, b, c) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    Bd.tri(a, b, c, [nx, ny, nz], colour((a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3, (a[1] + b[1] + c[1]) / 3, nx, ny, nz)); };
  // a grid patch: xs and zs are the grid lines; heights come from the one ground function (cached per vertex)
  const patch = (Bd, xs, zs) => {
    const nx = xs.length, nz = zs.length, V = new Float32Array(nx * nz); for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) V[j * nx + i] = gh(xs[i], zs[j]);
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = [xs[i], V[j * nx + i], zs[j]], b = [xs[i + 1], V[j * nx + i + 1], zs[j]], c = [xs[i + 1], V[(j + 1) * nx + i + 1], zs[j + 1]], d = [xs[i], V[(j + 1) * nx + i], zs[j + 1]];
      if (Math.abs(a[1] - c[1]) < Math.abs(b[1] - d[1])) { tri(Bd, a, b, c); tri(Bd, a, c, d); } else { tri(Bd, a, b, d); tri(Bd, b, c, d); }       // the cut follows the smaller height change
    }
  };
  const lin = (a, b, st) => { const o = []; for (let v = a; v <= b + 1e-6; v += st) o.push(v); return o; };
  patch(B, lin(-LINE, LINE, 2), lin(-LINE, LINE, 2));                                           // the playable square, 2 m cells
  const FAR = 400, SO = 6, SA = 4, east = lin(LINE, FAR, SO), west = east.map(v => -v).reverse(), along = lin(-LINE, LINE, SA), tall = lin(-FAR - 2, FAR + 2, SA);     // beyond the line: 6 m cells outward, 4 m along the edge
  patch(O, east, tall); patch(O, west, tall); patch(O, along, east); patch(O, along, west);
  // the boundary line: a thin dark strip lying on the sand along the four sides, following the ground
  { const w = 0.07, lift = 0.05; for (let s = 0; s < 4; s++) { const horiz = s < 2, sg = s % 2 ? 1 : -1; for (let t = -LINE; t < LINE; t += 2) { const p = (u, v) => horiz ? [u, groundAt(map, u, v) + lift, v] : [v, groundAt(map, v, u) + lift, u];
      const a = p(t, sg * (LINE - w)), b = p(t + 2, sg * (LINE - w)), c = p(t + 2, sg * (LINE + w)), d = p(t, sg * (LINE + w)); B.quad(a, b, c, d, [0, 1, 0], LINE_COL); } } }
  addDressing(D, map);
  const fadeU = { cam: { value: new T.Vector3() }, pl: { value: new T.Vector3() } }; group.userData.fade = fadeU;
  const tex = streakTex(), meshes = [B.mesh(false, fadeU), O.mesh(false, fadeU), D.mesh(false, fadeU)];
  for (const m of meshes.slice(0, 2)) { const p = m.geometry.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); uv[i * 2] = (x * cw + z * sw) / 24; uv[i * 2 + 1] = (-x * sw + z * cw) / 12; } m.geometry.setAttribute('uv', new T.BufferAttribute(uv, 2)); m.material.map = tex; m.material.needsUpdate = true; }
  group.add(...meshes); group.userData.tris = (B.pos.length + O.pos.length + D.pos.length) / 9 | 0;
  return group;
}
