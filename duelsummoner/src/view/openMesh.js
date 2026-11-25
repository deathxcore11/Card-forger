// The open desert drawn as it is: 840 m of heightfield (the playable ground about 720 m across, ringed by steep mountains) cut into 84 m chunks. Each chunk has a coarse ground mesh (6 m cells) that is always there within 520 m
// and a fine one (2 m cells, true heights) built the first time the camera comes within 120 m (and freed again beyond 380 m), plus its own mesh of dressing (cacti, dead trees, beams, pots, blocks) shown within 340 m. Cracks between fine and coarse chunks
// are hidden by a 3 m skirt round every chunk. One material is shared by all of them. Flat-shaded facets.
// Ground look: pale cream sand on the sun side of every dune, orange on the lee side; fine ripple streaks along the wind (a tiling streak map, view only); steep faces (mountains, blocks) are banded sandstone, lit and shaded.
import { Builder } from './mapMesh.js';
import { vnoise, groundAt, duneH, blockProf, viewH } from '../gen/open/terrain.js';
import { addDressing } from './openDressing.js';
import { Q as WQ, LC as WLC } from '../gen/world/world.js';
const T = window.THREE;
const mixc = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
const dim = (c, k) => ((Math.min(255, Math.round(((c >> 16) & 255) * k)) << 16) | (Math.min(255, Math.round(((c >> 8) & 255) * k)) << 8) | Math.min(255, Math.round((c & 255) * k)));
const LIT = 0xfbeab4, LEE = 0xd0832f, TINT_A = 0xf1c773, TINT_B = 0xf6d489;       // sunlit slopes pale cream (never white), flat sand warm yellow, lee slopes orange
const ROCK = 0xd49a60, ROCK_LIT = 0xf0c394, ROCK_SH = 0xa56a3e;                  // mountain faces: banded sandstone, sun side light, shade side deep warm brown
const CH = 84, HALF = 420, NCH = 10, NEAR_ON = 120, NEAR_OFF = 150, FAR_MAX = 1100, DRESS_ON = 340, DRESS_OFF = 370;

// the ripple streak map: long thin pale and dark lines along u (the wind), repeating every 24 m by 12 m
function streakTex() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const c = cv.getContext('2d'); c.fillStyle = '#ebebeb'; c.fillRect(0, 0, 512, 256);
  let s = 12345; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let k = 0; k < 260; k++) { const y = r() * 256, x = r() * 512, len = 60 + r() * 220, light = r() < 0.5, a = 0.09 + r() * 0.2; c.strokeStyle = light ? 'rgba(255,255,255,' + a * 1.4 + ')' : 'rgba(150,150,150,' + a + ')'; c.lineWidth = 1 + (r() < 0.25 ? 1 : 0); for (const ox of [-512, 0, 512]) { c.beginPath(); c.moveTo(x + ox, y); c.lineTo(x + ox + len, y + (r() - 0.5) * 2); c.stroke(); } }
  const tex = new T.CanvasTexture(cv); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.anisotropy = 4; return tex;
}

// the far range must stay a readable pale shape: on the upper faces of the mountains (more than about 34 m up) the fog is capped at 60 percent, so they never fade to the colour of the sky; the dunes keep the normal fog
function mountainFog(mat) {
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.onBeforeCompile = sh => { if (prev) prev(sh); if (!sh.fragmentShader.includes('0.0, 1.00);')) return; sh.fragmentShader = sh.fragmentShader.replace('0.0, 1.00);', '0.0, mix(1.0, 0.6, smoothstep(34.0, 46.0, vWP.y)));'); };
  mat.customProgramCacheKey = () => key() + 'mtnfog';
}

export function buildOpen(map, look) {
  const BIG = !!map.big, CHK = BIG ? 64 : CH;       // the big world is cut into 64 m chunks made when the camera nears them
  const group = new T.Group(), blocks = map.blocks || [], wind = map.dune ? map.dune.wind : 0, cw = Math.cos(wind), sw = Math.sin(wind);
  // under a block (wherever its rise has started, so the ground is continuous at its foot and no cone of ramp is left standing beside the wall) the view ground is the plain dune; the box drawn by openDressing hides it
  const gh = (x, z) => viewH(map, x, z);
  const sandColour = (cx, cz, cy) => {
    const e = 3, gx = (groundAt(map, cx + e, cz) - groundAt(map, cx - e, cz)) / (2 * e), gz = (groundAt(map, cx, cz + e) - groundAt(map, cx, cz - e)) / (2 * e), sh = Math.max(-1, Math.min(1, (-gx * 0.8 - gz * 0.55) * 4.2));       // the slope over a 6 m window (not the facet), so a dune reads as one lit side and one shaded side
    const base = mixc(TINT_A, TINT_B, vnoise(77, cx / 110, cz / 110));                          // one slow tint across the map, no blotches
    const g = sh > 0 ? mixc(base, LIT, sh) : mixc(base, LEE, -sh * 0.9); return dim(g, 0.97 + 0.05 * Math.max(0, Math.min(1, (cy - 1) / 8)));
  };
  const colour = (cx, cz, cy, nx, ny, nz) => {
    const ang = Math.acos(Math.max(0, Math.min(1, ny))) * 57.29578;
    if (ang > 24) {                                                                            // mountain faces: banded rock, lit on the sun side
      const t = ang >= 36 ? 1 : (ang - 24) / 12, sh = Math.max(-1, Math.min(1, nx * 0.8 + nz * 0.55)), band = [0.86, 0.94, 1.0][((Math.round(cy / 4) % 3) + 3) % 3];
      let g = sh >= 0 ? mixc(ROCK, ROCK_LIT, sh * 0.9) : mixc(ROCK, ROCK_SH, -sh * 0.9); g = dim(g, band * (0.92 + 0.12 * vnoise(61, cx / 18, cz / 18)));
      return t >= 1 ? g : mixc(sandColour(cx, cz, cy), g, t);
    }
    return sandColour(cx, cz, cy);
  };
  const tri = (Bd, a, b, c) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    Bd.tri(a, b, c, [nx, ny, nz], colour((a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3, (a[1] + b[1] + c[1]) / 3, nx, ny, nz)); };
  // one chunk's ground at a cell size, with a 3 m skirt all round
  const grid = (Bd, x0, z0, step) => {
    const n = Math.round(CHK / step), V = new Float32Array((n + 1) * (n + 1)); for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) V[j * (n + 1) + i] = gh(x0 + i * step, z0 + j * step);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const xa = x0 + i * step, za = z0 + j * step, a = [xa, V[j * (n + 1) + i], za], b = [xa + step, V[j * (n + 1) + i + 1], za], c = [xa + step, V[(j + 1) * (n + 1) + i + 1], za + step], d = [xa, V[(j + 1) * (n + 1) + i], za + step];
      if (Math.abs(a[1] - c[1]) < Math.abs(b[1] - d[1])) { tri(Bd, a, b, c); tri(Bd, a, c, d); } else { tri(Bd, a, b, d); tri(Bd, b, c, d); }       // the cut follows the smaller height change
    }
    const sk = (p, q, out) => { const col = dim(sandColour((p[0] + q[0]) / 2, (p[2] + q[2]) / 2, p[1]), 0.8); Bd.quad(p, q, [q[0], q[1] - 3, q[2]], [p[0], p[1] - 3, p[2]], out, col); };
    for (let i = 0; i < n; i++) { const xa = x0 + i * step; sk([xa, V[i], z0], [xa + step, V[i + 1], z0], [0, 0, -1]); sk([xa, V[n * (n + 1) + i], z0 + CHK], [xa + step, V[n * (n + 1) + i + 1], z0 + CHK], [0, 0, 1]); }
    for (let j = 0; j < n; j++) { const za = z0 + j * step; sk([x0, V[j * (n + 1)], za], [x0, V[(j + 1) * (n + 1)], za + step], [-1, 0, 0]); sk([x0 + CHK, V[j * (n + 1) + n], za], [x0 + CHK, V[(j + 1) * (n + 1) + n], za + step], [1, 0, 0]); }
  };
  const fadeU = { cam: { value: new T.Vector3() }, pl: { value: new T.Vector3() } }; group.userData.fade = fadeU;
  const tex = streakTex(); let shared = null, tris = 0;
  const meshOf = (Bd, streaks) => {                                                            // every chunk mesh shares one material
    const m = Bd.mesh(false, fadeU); if (!shared) { shared = m.material; shared.map = tex; mountainFog(shared); shared.needsUpdate = true; } else { m.material.dispose(); m.material = shared; }
    if (streaks) { const p = m.geometry.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); uv[i * 2] = (x * cw + z * sw) / 24; uv[i * 2 + 1] = (-x * sw + z * cw) / 12; } m.geometry.setAttribute('uv', new T.BufferAttribute(uv, 2)); }
    tris += Bd.pos.length / 9 | 0; m.geometry.computeBoundingSphere(); return m;
  };
  let dshared = null; const dmesh = Bd => { const m = Bd.mesh(false, fadeU); if (!dshared) dshared = m.material; else { m.material.dispose(); m.material = dshared; } return m; };
  const chunks = [];
  for (let cj = 0; cj < (BIG ? 0 : NCH); cj++) for (let ci = 0; ci < NCH; ci++) {
    const x0 = -HALF + ci * CH, z0 = -HALF + cj * CH, c = { x0, z0, cx: x0 + CH / 2, cz: z0 + CH / 2, far: null, near: null, dress: null, nearOn: false };
    const F = new Builder(); grid(F, x0, z0, 6); c.far = meshOf(F, true); c.far.visible = false; group.add(c.far);
    const D = new Builder(); addDressing(D, map, (x, z) => x >= x0 && x < x0 + CH && z >= z0 && z < z0 + CH);
    if (D.pos.length) { c.dress = dmesh(D); c.dress.geometry.computeBoundingSphere(); c.dress.visible = false; tris += D.pos.length / 9 | 0; group.add(c.dress); }
    chunks.push(c);
  }
  // the controller: a tiny always-drawn mesh whose onBeforeRender sees the camera and shows each chunk at the right detail
  const ctl = new T.Mesh(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0, 0.01, 0, 0.01, 0, 0], 3)), new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false })); ctl.frustumCulled = false;
  let built = 0; const stats = group.userData.stats = { near: 0, far: 0, dress: 0, builtNear: 0 };
  // ---- the big world: chunks and landmarks are made as the camera comes near and dropped behind it
  const bigChunks = new Map(), lmMeshes = new Map(), HZ = 0xe8d6b0, FARB = 520, FREEB = 700, LM_ON = 330, LM_MAX = 2600;
  const tintB = B => ({ quad: (a, b, c, d, nrm, col) => B.quad(a, b, c, d, nrm, mixc(col, HZ, 0.5)), tri: (a, b, c, nrm, col) => B.tri(a, b, c, nrm, mixc(col, HZ, 0.5)) });
  const subMap = (qx, qz) => { const C = map.cell(qx, qz); return { dress: map.dressCell(qx, qz), blocks: C.blocks, gate: map.gate, spawn: map.spawn, far: {}, viewFn: map.viewFn, dune: map.dune }; };
  const bigUpdate = (cam, budget) => {
    const ci0 = Math.floor(cam.x / CHK), cj0 = Math.floor(cam.z / CHK), R = Math.ceil(FARB / CHK) + 1; let made = 0, dm = 0; const stats2 = stats; stats2.near = 0; stats2.far = 0; stats2.dress = 0;
    for (let r = 0; r <= R; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; const ci = ci0 + dx, cj = cj0 + dz, key = (ci + 600) * 1200 + (cj + 600); let c = bigChunks.get(key);
      const x0 = ci * CHK, z0 = cj * CHK; if (!c) { if (made >= budget.far || Math.hypot(Math.max(0, Math.abs(cam.x - x0 - CHK / 2) - CHK / 2), Math.max(0, Math.abs(cam.z - z0 - CHK / 2) - CHK / 2)) > FARB) continue; if (map.outer(x0 + 32, z0 + 32)) continue;
        const F = new Builder(); grid(F, x0, z0, 8); c = { x0, z0, cx: x0 + CHK / 2, cz: z0 + CHK / 2, far: meshOf(F, true), near: null, dress: null, dressBuilt: false, nearOn: false, key }; c.far.visible = false; group.add(c.far); bigChunks.set(key, c); made++; }
    }
    for (const c of bigChunks.values()) {
      const dx = Math.max(0, Math.abs(cam.x - c.cx) - CHK / 2), dz = Math.max(0, Math.abs(cam.z - c.cz) - CHK / 2), d = Math.sqrt(dx * dx + dz * dz);
      if (d > FREEB) { group.remove(c.far); c.far.geometry.dispose(); if (c.near) { group.remove(c.near); c.near.geometry.dispose(); } if (c.dress) { group.remove(c.dress); c.dress.geometry.dispose(); } bigChunks.delete(c.key); continue; }
      const wantNear = c.nearOn ? d < NEAR_OFF : d < NEAR_ON;
      if (wantNear && !c.near && built < budget.near) { const N = new Builder(); grid(N, c.x0, c.z0, 2); c.near = meshOf(N, true); group.add(c.near); built++; stats.builtNear++; }
      if (c.near && !wantNear && d > 380) { group.remove(c.near); c.near.geometry.dispose(); c.near = null; }
      c.nearOn = wantNear && !!c.near; if (c.near) c.near.visible = c.nearOn; c.far.visible = !c.nearOn && d < FARB + 40;
      if (!c.dressBuilt && d < DRESS_ON && dm < budget.dress) { dm++; c.dressBuilt = true; const qx = Math.floor(c.x0 / WQ), qz = Math.floor(c.z0 / WQ), D = new Builder(); addDressing(D, subMap(qx, qz), (x, z) => x >= c.x0 && x < c.x0 + CHK && z >= c.z0 && z < c.z0 + CHK); if (D.pos.length) { c.dress = dmesh(D); c.dress.geometry.computeBoundingSphere(); c.dress.visible = false; tris += D.pos.length / 9 | 0; group.add(c.dress); } }
      if (c.dress) c.dress.visible = c.dress.visible ? d < DRESS_OFF : d < DRESS_ON;
      if (c.nearOn) stats.near++; else if (c.far.visible) stats.far++; if (c.dress && c.dress.visible) stats.dress++;
    }
    // the landmarks: tall blocks that stand out of the haze, drawn tinted toward the horizon colour (no fog) once they are too far for their chunk
    const l0x = Math.floor((cam.x - LM_MAX) / WLC), l1x = Math.floor((cam.x + LM_MAX) / WLC), l0z = Math.floor((cam.z - LM_MAX) / WLC), l1z = Math.floor((cam.z + LM_MAX) / WLC);
    for (let j = l0z; j <= l1z; j++) for (let i = l0x; i <= l1x; i++) { const b = map.landmark(i, j); if (!b) continue; const key = (i + 64) * 256 + (j + 64); let m = lmMeshes.get(key); const d = Math.hypot(b.cx - cam.x, b.cz - cam.z);
      if (!m && d < LM_MAX && budget.lm > 0 && map.inside(b.cx, b.cz)) { budget.lm--; const D = new Builder(); addDressing(tintB(D), { dress: {}, blocks: [b], gate: { x: 1e9, z: 1e9 }, spawn: map.spawn, far: {}, viewFn: map.viewFn, dune: map.dune }, () => true); m = dmesh(D); m.geometry.computeBoundingSphere(); m.material = lmMat(m.material); group.add(m); lmMeshes.set(key, m); }
      if (m) m.visible = d > LM_ON && d < LM_MAX + 200; }
    for (const [k, m] of lmMeshes) { const i = Math.floor(k / 256) - 64, j = (k % 256) - 64, b = map.landmark(i, j); if (b && Math.hypot(b.cx - cam.x, b.cz - cam.z) > LM_MAX + 600) { group.remove(m); m.geometry.dispose(); lmMeshes.delete(k); } }
    built = 0;
  };
  let lmM = null; const lmMat = m => { if (!lmM) { lmM = m.clone(); lmM.fog = false; } m.dispose(); return lmM; };
  const update = cam => {
    if (BIG) { bigUpdate(cam, { far: 6, near: 3, dress: 2, lm: 3 }); return; }
    let nn = 0, nf = 0, nd = 0;
    for (const c of chunks) {
      const dx = Math.max(0, Math.abs(cam.x - c.cx) - CH / 2), dz = Math.max(0, Math.abs(cam.z - c.cz) - CH / 2), d = Math.sqrt(dx * dx + dz * dz);
      const wantNear = c.nearOn ? d < NEAR_OFF : d < NEAR_ON;
      if (wantNear && !c.near && built < 6) { const N = new Builder(); grid(N, c.x0, c.z0, 2); c.near = meshOf(N, true); group.add(c.near); built++; stats.builtNear++; }       // at most 6 fine meshes are built in one frame
      if (c.near && !wantNear && d > 380) { group.remove(c.near); c.near.geometry.dispose(); c.near = null; }       // a fine mesh far behind the duelist is freed
      c.nearOn = wantNear && !!c.near; if (c.near) c.near.visible = c.nearOn; c.far.visible = !c.nearOn && d < FAR_MAX;
      if (c.dress) c.dress.visible = c.dress.visible ? d < DRESS_OFF : d < DRESS_ON;
      if (c.nearOn) nn++; else if (c.far.visible) nf++; if (c.dress && c.dress.visible) nd++;
    }
    built = 0; stats.near = nn; stats.far = nf; stats.dress = nd;
  };
  ctl.onBeforeRender = (r, sc, cam) => update(cam.position); group.add(ctl); group.userData.update = update;
  if (BIG) { for (let k = 0; k < 2; k++) bigUpdate({ x: map.spawn.x, z: map.spawn.z }, { far: 400, near: 40, dress: 40, lm: 40 }); group.userData.bigChunks = bigChunks; }
  else update({ x: map.spawn.x, z: map.spawn.z });
  group.userData.tris = tris; group.userData.chunks = BIG ? bigChunks.size : chunks.length;
  return group;
}
