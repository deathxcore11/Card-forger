// Far silhouettes (world v3 section 7): 3 to 5 huge, simple shapes 430 to 560 m from the stage start (past the fog wall, inside the 600 m camera reach), picked by the seed from the desert list.
// They only need to read in the fog: one low-detail mesh group each, sandstone and violet shade, no collision, no props. Stand-in voxel shapes until the asset tool's kits arrive.
import { BLOCKS, blockMerged } from './models.js';
const T = window.THREE, _sz = new T.Vector3();
let SAND = 0xc9925e, SHADE = 0x7d5a78, DARK = 0x5e4560;
let FOGC = 0xe8c9a0, HAZE = 0.55;
const mat = c => new T.MeshBasicMaterial({ color: new T.Color(c).lerp(new T.Color(FOGC), HAZE), fog: false });       // past the fog wall: pre-mixed toward the fog colour so it reads as a hazy silhouette, never a sharp prop
const VIOLET = 0x4a3a78;
function shaded(geo, c) { const lit = new T.Color(c).lerp(new T.Color(FOGC), HAZE), dk = new T.Color(c).lerp(new T.Color(VIOLET), 0.6).lerp(new T.Color(FOGC), HAZE * 0.8), n = geo.attributes.normal, col = new Float32Array(n.count * 3); for (let i = 0; i < n.count; i++) { const k = n.getX(i) * 0.7 + n.getZ(i) * 0.7 + n.getY(i) * 0.4 > 0 ? lit : dk; col[i * 3] = k.r; col[i * 3 + 1] = k.g; col[i * 3 + 2] = k.b; } geo.setAttribute('color', new T.BufferAttribute(col, 3)); return new T.MeshBasicMaterial({ vertexColors: true, fog: false }); }       // the sun side warm, the shade side violet, both carried by the haze
function box(g, w, h, d, x, y, z, c, ry, rz) { const geo = new T.BoxGeometry(w, h, d), m = new T.Mesh(geo, shaded(geo, c)); m.position.set(x, y, z); if (ry) m.rotation.y = ry; if (rz) m.rotation.z = rz; g.add(m); return m; }
// each maker builds about 20 to 60 m tall at scale 1 (then scaled up 2 to 3 times)
const MAKERS = {
  cardSpire(g) { const m = box(g, 16, 70, 2.5, 0, 33, 0, SAND, 0, 0.22); box(g, 12, 50, 2.8, 0, 33, 0, SHADE, 0, 0.22); return 'a colossal tilted stone card spire'; },
  ribcage(g) { for (let k = 0; k < 7; k++) { const z = (k - 3) * 9, h = 18 + 10 * Math.sin(k / 6 * Math.PI); for (const s of [-1, 1]) box(g, 3, h, 3, s * 9, h / 2, z, k % 2 ? SAND : SHADE, 0, -s * 0.35); } box(g, 4, 4, 64, 0, 2, 0, DARK); return 'a half-buried ribcage of stone arches'; },
  sunkenGate(g) { box(g, 8, 40, 8, -16, 18, 0, SAND); box(g, 8, 40, 8, 16, 18, 0, SAND); box(g, 44, 8, 10, 0, 40, 0, SHADE); box(g, 24, 4, 4, 0, 33, 0, DARK); return 'a sunken gate'; },
  colossusHead(g) { box(g, 30, 26, 28, 0, 10, 0, SAND, 0.4, 0.25); box(g, 8, 6, 3, -6, 14, 14, DARK, 0.4, 0.25); box(g, 8, 6, 3, 6, 14, 14, DARK, 0.4, 0.25); box(g, 34, 6, 30, 0, 26, 0, SHADE, 0.4, 0.25); return 'a broken colossus head'; },
  mesaCity(g) { for (let k = 0; k < 5; k++) { const w = 60 - k * 10; box(g, w, 9, w * 0.8, k * 2, 4.5 + k * 9, 0, k % 2 ? SHADE : SAND); } for (let k = 0; k < 6; k++) box(g, 5, 7, 5, -18 + k * 7, 49, 0, DARK); return 'a terraced mesa city'; },
  aqueduct(g) { for (let k = 0; k < 14; k++) { box(g, 4, 26, 4, k * 14, 13, 0, k % 3 ? SAND : SHADE); } box(g, 200, 5, 6, 91, 28, 0, SAND); return 'a long aqueduct running off into the dunes'; }
};
export const FAR_KINDS = Object.keys(MAKERS);
// a baked far silhouette: its own colours carried toward the fog by the haze, no lighting, no collision
function farModel(g, id, theme) { const geo = blockMerged(BLOCKS[id]).clone(), c = geo.attributes.color, f = new T.Color(FOGC), tmp = new T.Color(); for (let i = 0; i < c.count; i++) { tmp.setRGB(c.getX(i), c.getY(i), c.getZ(i)).lerp(f, HAZE * 0.8); c.setXYZ(i, tmp.r, tmp.g, tmp.b); } const m = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, fog: false })); m.scale.setScalar(0.4); g.add(m); return (theme && theme.farNames && theme.farNames[id]) || id; }       /* (scaled 0.4 then by the group: its real 80 to 200 m size reads huge at 450 m) */
// seed: the run seed; at: the stage start { x, z }; groundY(x, z): the ground height for the base
export function addFarSilhouettes(scene, seed, at, groundY, fogColor, theme) {
  if (theme && theme.farColours) { SAND = theme.farColours.sun; SHADE = theme.farColours.shade; DARK = theme.farColours.dark; }
  if (fogColor !== undefined) FOGC = fogColor;
  let s = (seed >>> 0) ^ 0x5f3759df; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  let kinds = (theme && theme.far ? theme.far.filter(k => MAKERS[k] || BLOCKS[k]) : FAR_KINDS).slice(); if (!kinds.length) kinds = FAR_KINDS.slice();       // a map's own baked far kits when they are loaded       // (a map whose own far kits have not landed yet uses the stand-in shapes in its own colours) for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const n = 3 + Math.floor(rnd() * 3), group = new T.Group(), list = []; const a0 = rnd() * Math.PI * 2;
  for (let k = 0; k < n; k++) {
    const a = a0 + k * (Math.PI * 2 / n) + (rnd() - 0.5) * 0.6, d = 430 + rnd() * 130,       /* inside the camera's 600 m reach, past the fog wall */ x = at.x + Math.cos(a) * d, z = at.z + Math.sin(a) * d, g = new T.Group();
    const what = MAKERS[kinds[k]] ? MAKERS[kinds[k]](g) : farModel(g, kinds[k], theme); const sc = 2 + rnd(); g.scale.setScalar(sc); new T.Box3().setFromObject(g).getSize(_sz); g.position.set(x, (groundY(x, z) || 0) - _sz.y * (0.15 + rnd() * 0.1), z);       // half buried: 15 to 25% of its height under the sand
    if (MAKERS[kinds[k]]) { const drift = new T.Mesh(new T.SphereGeometry(1, 16, 8), new T.MeshBasicMaterial({ color: new T.Color(0xe0b47e).lerp(new T.Color(FOGC), HAZE), fog: false })); drift.scale.set(_sz.x * 0.75 + 20, _sz.y * 0.12 + 6, _sz.z * 0.75 + 20); drift.position.set(x, (groundY(x, z) || 0) - 2, z); group.add(drift); }       // a soft sand drift round its foot g.rotation.y = rnd() * Math.PI * 2; g.userData.far = what;
    group.add(g); list.push({ kind: kinds[k], what, x: Math.round(x), z: Math.round(z) });
  }
  if (theme && theme.farRange && BLOCKS[theme.farRange]) for (let k = 0; k < 5; k++) { const a = a0 + (k + 0.5) * (Math.PI * 2 / 5) + (rnd() - 0.5) * 0.4, d = 620 + rnd() * 80, x = at.x + Math.cos(a) * d, z = at.z + Math.sin(a) * d, g = new T.Group(); farModel(g, theme.farRange, theme); g.scale.setScalar(2.2); g.rotation.y = -a + Math.PI / 2; new T.Box3().setFromObject(g).getSize(_sz); g.position.set(x, (groundY(x, z) || 0) - _sz.y * 0.1, z); group.add(g); list.push({ kind: theme.farRange, x: Math.round(x), z: Math.round(z) }); }       // the mountain wall: the baked range in five arcs behind the landmarks, turned to face the start
  group.name = 'farSilhouettes'; scene.add(group); return { group, list };
}
