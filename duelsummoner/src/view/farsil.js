// Far silhouettes (world v3 section 7): 3 to 5 huge, simple shapes 430 to 560 m from the stage start (past the fog wall, inside the 600 m camera reach), picked by the seed from the desert list.
// They only need to read in the fog: one low-detail mesh group each, sandstone and violet shade, no collision, no props. Stand-in voxel shapes until the asset tool's kits arrive.
const T = window.THREE;
const SAND = 0xc9925e, SHADE = 0x7d5a78, DARK = 0x5e4560;
let FOGC = 0xe8c9a0, HAZE = 0.55;
const mat = c => new T.MeshBasicMaterial({ color: new T.Color(c).lerp(new T.Color(FOGC), HAZE), fog: false });       // past the fog wall: pre-mixed toward the fog colour so it reads as a hazy silhouette, never a sharp prop
function box(g, w, h, d, x, y, z, c, ry, rz) { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); if (ry) m.rotation.y = ry; if (rz) m.rotation.z = rz; g.add(m); return m; }
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
// seed: the run seed; at: the stage start { x, z }; groundY(x, z): the ground height for the base
export function addFarSilhouettes(scene, seed, at, groundY, fogColor) {
  if (fogColor !== undefined) FOGC = fogColor;
  let s = (seed >>> 0) ^ 0x5f3759df; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const kinds = FAR_KINDS.slice(); for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const n = 3 + Math.floor(rnd() * 3), group = new T.Group(), list = []; const a0 = rnd() * Math.PI * 2;
  for (let k = 0; k < n; k++) {
    const a = a0 + k * (Math.PI * 2 / n) + (rnd() - 0.5) * 0.6, d = 430 + rnd() * 130,       /* inside the camera's 600 m reach, past the fog wall */ x = at.x + Math.cos(a) * d, z = at.z + Math.sin(a) * d, g = new T.Group();
    const what = MAKERS[kinds[k]](g); g.scale.setScalar(2 + rnd()); g.position.set(x, (groundY(x, z) || 0) - 6, z); g.rotation.y = rnd() * Math.PI * 2; g.userData.far = what;
    group.add(g); list.push({ kind: kinds[k], what, x: Math.round(x), z: Math.round(z) });
  }
  group.name = 'farSilhouettes'; scene.add(group); return { group, list };
}
