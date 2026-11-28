// Loader for the owner's baked low-poly models (EWV1 / EWV2: flat colour per face, no texture). Everything is optional:
// if a file is missing the game keeps its placeholder shape. Files live in assets/models/ and are kept out of the public repo.
const T = window.THREE;

function b64ToBytes(text) {
  const s = atob(text.replace(/\s+/g, '')), a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
}

// Returns { solid: BufferGeometry (vertex-coloured), glow: BufferGeometry|null, size:{x,y,z}, min, max, nostrils:[[x,y,z],...] } in model units.
export function decodeEwv(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'EWV1' && magic !== 'EWV2') throw new Error('bad model magic ' + magic);
  const vc = dv.getUint16(4, true), tc = dv.getUint16(6, true);
  const min = [dv.getFloat32(8, true), dv.getFloat32(12, true), dv.getFloat32(16, true)];
  const max = [dv.getFloat32(20, true), dv.getFloat32(24, true), dv.getFloat32(28, true)];
  let off = 32;
  const pos = new Float32Array(vc * 3);
  for (let i = 0; i < vc * 3; i++, off += 2) { const a = i % 3; pos[i] = min[a] + dv.getUint16(off, true) / 65535 * (max[a] - min[a]); }
  const idx = new Uint16Array(tc * 3);
  for (let i = 0; i < tc * 3; i++, off += 2) idx[i] = dv.getUint16(off, true);
  const col = new Uint16Array(tc);
  for (let i = 0; i < tc; i++, off += 2) col[i] = dv.getUint16(off, true);
  let glowBits = null, nostrils = [];
  if (magic === 'EWV2') {
    const gb = Math.ceil(tc / 8); glowBits = bytes.subarray(off, off + gb); off += gb;
    for (let k = 0; k < 2 && off + 12 <= bytes.length; k++, off += 12) nostrils.push([dv.getFloat32(off, true), dv.getFloat32(off + 4, true), dv.getFloat32(off + 8, true)]);   // zero emitters is fine
  }
  const build = wantGlow => {
    const p = [], c = [];
    for (let f = 0; f < tc; f++) {
      const isGlow = glowBits ? ((glowBits[f >> 3] >> (f & 7)) & 1) === 1 : false;
      if (isGlow !== wantGlow) continue;
      const v = col[f], r = (v & 31) / 31, g = ((v >> 5) & 31) / 31, b = ((v >> 10) & 31) / 31;
      for (let k = 0; k < 3; k++) { const vi = idx[f * 3 + k] * 3; p.push(pos[vi], pos[vi + 1], pos[vi + 2]); c.push(r, g, b); }
    }
    if (!p.length) return null;
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(p, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(c, 3));
    geo.computeVertexNormals();                                   // non-indexed, so each face keeps its own flat normal
    return geo;
  };
  return { solid: build(false), glow: glowBits ? build(true) : null, min, max, size: { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] }, nostrils };
}

export async function loadModel(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return decodeEwv(b64ToBytes(await r.text()));
  } catch (e) { return null; }
}

export async function loadPuffTexture(url) {
  const make = img => { const t = new T.Texture(img); t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; };
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (r.ok) {
      const img = new Image(); img.src = 'data:image/png;base64,' + (await r.text()).replace(/\s+/g, '');
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      return make(img);
    }
  } catch (e) { /* fall through to a drawn puff */ }
  const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
  x.fillStyle = '#fff'; for (const [cx, cy, rr] of [[8, 8, 6], [5, 9, 4], [11, 9, 4], [8, 5, 4]]) { x.beginPath(); x.arc(cx, cy, rr, 0, 7); x.fill(); }
  return make(c);
}


// ---- EWV3: block-built models (the block look, owner 27 Nov). Byte layout: app art/DS/block-look/FORMAT.md (kept out of the repo, like the models).
// Faces are merged axis-aligned quads in whole half-blocks; parts carry a parent and a pivot; the palette is exact 24-bit with a glow bit;
// emitters are halos and smoke puffs; level 1 (swarm enemies only) is a half-detail far copy.
export function decodeEwv3(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let o = 0;
  const u8 = () => dv.getUint8(o++), u16 = () => { const v = dv.getUint16(o, true); o += 2; return v; }, i16 = () => { const v = dv.getInt16(o, true); o += 2; return v; }, u32 = () => { const v = dv.getUint32(o, true); o += 4; return v; }, f32 = () => { const v = dv.getFloat32(o, true); o += 4; return v; };
  if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'EWV3') throw new Error('not EWV3');
  o = 4;
  const version = u16(); u16(); const voxel = f32(), hover = version >= 2 ? { amp: f32(), speed: f32() } : null, nPal = u16(), nParts = u16(), nEm = u16(), nLv = u16(), H = voxel / 2;       // version 2 adds the baked motion: a hover for the whole model and one hint per part
  const palette = []; for (let i = 0; i < nPal; i++) palette.push({ r: u8() / 255, g: u8() / 255, b: u8() / 255, glow: (u8() & 1) === 1 });
  const parts = []; for (let i = 0; i < nParts; i++) { const n = u8(); let name = ''; for (let k = 0; k < n; k++) name += String.fromCharCode(u8()); const pt = { name, parent: i16(), pivot: [i16() * H, i16() * H, i16() * H] }; if (version >= 2) pt.motion = { kind: u8(), axis: u8(), amp: f32(), speed: f32(), phase: f32() }; parts.push(pt); }
  const emitters = []; for (let i = 0; i < nEm; i++) emitters.push({ kind: u8(), part: i16(), pos: [i16() * H, i16() * H, i16() * H], rgb: [u8() / 255, u8() / 255, u8() / 255], size: u16() * H });
  const levels = [];
  for (let l = 0; l < nLv; l++) {
    const scale = u8(), ps = [];
    for (let i = 0; i < nParts; i++) {
      const n = u32(), S = { p: [], n: [], c: [] }, G = { p: [], n: [], c: [] };
      for (let q = 0; q < n; q++) {
        const org = [i16(), i16(), i16()], nc = u8(), du = u16(), dw = u16(), pi = u8(), d = nc >> 1, s = nc & 1 ? -1 : 1, u = (d + 1) % 3, w = (d + 2) % 3, P = palette[pi] || palette[0], B = P.glow ? G : S;
        const cs = s > 0 ? [[0, 0], [du, 0], [du, dw], [0, dw]] : [[0, 0], [0, dw], [du, dw], [du, 0]], V = cs.map(([a, c]) => { const v = org.slice(); v[u] += a; v[w] += c; return [v[0] * H, v[1] * H, v[2] * H]; });
        for (const k of [0, 1, 2, 0, 2, 3]) { B.p.push(V[k][0], V[k][1], V[k][2]); B.n.push(d === 0 ? s : 0, d === 1 ? s : 0, d === 2 ? s : 0); B.c.push(P.r, P.g, P.b); }
      }
      const geo = b => { if (!b.p.length) return null; const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(b.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(b.n, 3)); g.setAttribute('color', new T.Float32BufferAttribute(b.c, 3)); return g; };
      ps.push({ solid: geo(S), glow: geo(G), quads: n });
    }
    levels.push({ scale, parts: ps });
  }
  if (o !== bytes.byteLength) throw new Error('EWV3: trailing bytes ' + (bytes.byteLength - o));
  // the model's box in metres (level 0, parts at their pivots, no motion)
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  levels[0].parts.forEach((pp, i) => { const pv = parts[i].pivot; for (const gg of [pp.solid, pp.glow]) if (gg) { const a = gg.attributes.position.array; for (let k = 0; k < a.length; k += 3) for (let j = 0; j < 3; j++) { const v = a[k + j] + pv[j]; if (v < mn[j]) mn[j] = v; if (v > mx[j]) mx[j] = v; } } });
  return { version, voxel, hover, palette, parts, emitters, levels, min: mn, max: mx, size: { x: mx[0] - mn[0], y: mx[1] - mn[1], z: mx[2] - mn[2] } };
}

let _bm = null;
export function blockMats() { return _bm || (_bm = { solid: new T.MeshLambertMaterial({ vertexColors: true }), glow: new T.MeshBasicMaterial({ vertexColors: true }) }); }

// one model as a tree of part groups: each group sits at its pivot minus its parent's pivot and holds that part's meshes. Returns { root, p: { name: group, root: inner }, model }:
// the game places and turns root; the animator moves only the inner groups (p.root bobs and sways inside it).
export function blockGroup(model, level = 0, mats) {
  const M = mats || blockMats(), outer = new T.Group(), root = new T.Group(), p = { root }, L = model.levels[Math.min(level, model.levels.length - 1)];
  const groups = model.parts.map((pt, i) => { const g = new T.Group(); g.name = pt.name; const sh = L.parts[i]; if (sh.solid) g.add(new T.Mesh(sh.solid, M.solid)); if (sh.glow) g.add(new T.Mesh(sh.glow, M.glow)); p[pt.name] = g; return g; });
  model.parts.forEach((pt, i) => { const par = pt.parent >= 0 ? model.parts[pt.parent] : null, g = groups[i]; g.position.set(pt.pivot[0] - (par ? par.pivot[0] : 0), pt.pivot[1] - (par ? par.pivot[1] : 0), pt.pivot[2] - (par ? par.pivot[2] : 0)); (par ? groups[pt.parent] : root).add(g); });
  for (const g of groups.concat([root])) g.userData.rest = { pos: g.position.clone(), scale: g.scale.clone() };
  outer.add(root); return { root: outer, p, model };
}

// all parts of one level merged into one buffer for instancing, with the part index per vertex (aPart) and the parts placed at their pivots (no motion)
export function blockMerged(model, level = 0) {
  const L = model.levels[Math.min(level, model.levels.length - 1)], pos = [], nor = [], col = [], part = [];
  L.parts.forEach((sh, i) => { const pv = model.parts[i].pivot; for (const gg of [sh.solid, sh.glow]) if (gg) { const a = gg.attributes.position.array, n = gg.attributes.normal.array, c = gg.attributes.color.array; for (let k = 0; k < a.length; k += 3) { pos.push(a[k] + pv[0], a[k + 1] + pv[1], a[k + 2] + pv[2]); nor.push(n[k], n[k + 1], n[k + 2]); col.push(c[k], c[k + 1], c[k + 2]); part.push(i); } } });
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setAttribute('aPart', new T.Float32BufferAttribute(part, 1));
  return g;
}

// the part animator hook: per model id, a few sines per part (numbers from the block-look recipes' M.anim; their offsets are in blocks, so they are scaled by the voxel size).
// The format does not carry motion yet; when it does (kind, axis, amp, speed per part) this table is filled from the file instead.
const rot = (g, ax, a) => { if (g) g.rotation[ax] = a; };
const lift = (g, dy) => { if (g) g.position.y = g.userData.rest.pos.y + dy; };
export const BLOCK_ANIM = {
  husk: (p, t, v) => { const a = Math.sin(t * 3); rot(p.armL, 'x', 0.4 * a); rot(p.armR, 'x', -0.4 * a); rot(p.root, 'z', 0.07 * a); rot(p.head, 'z', 0.12 * Math.sin(t * 1.5)); lift(p.root, 0.6 * Math.abs(a) * v); },
  kaelRide: (p, t) => { rot(p.armL, 'z', 1.15 + 0.1 * Math.sin(t * 3)); rot(p.armR, 'z', -1.0 + 0.1 * Math.sin(t * 3 + 1)); rot(p.armL, 'x', 0.2); rot(p.torso, 'z', 0.06 * Math.sin(t * 2)); rot(p.head, 'y', -1.1); rot(p.scarf, 'x', -0.9 + 0.25 * Math.sin(t * 9)); rot(p.scarf, 'y', 0.3 * Math.sin(t * 7)); if (p.legs) p.legs.scale.y = 0.9; },
  chestSealed: (p, t, v, s) => { rot(p.lid, 'x', s && s.open ? -1.25 : 0); }
};
// one animator for every version 2 model, from its baked hints (FORMAT.md version 2). With a = speed * time + phase, about the part's axis through its pivot:
// 1 flap: 0.15 * sign(amp) + amp * sin(a) | 2 sway: amp * sin(a) | 3 open: amp * max(0, sin(a))^2 | 4 spin: speed * time | 5 pulse: scale 1 + amp * max(0, sin(a)) | 6 bob: amp blocks * sin(a) along the axis.
// The whole model rises and falls by hoverAmp half-blocks * sin(hoverSpeed * time). A chest's open state (state.open) overrides its lid's open motion.
const AX = ['x', 'y', 'z'];
export function animateHints(bg, t, state) {
  const m = bg.model, H = m.hover; if (H && H.amp && bg.p.root) bg.p.root.position.y = bg.p.root.userData.rest.pos.y + H.amp * m.voxel / 2 * Math.sin(H.speed * t);
  for (const pt of m.parts) { const M = pt.motion, g = bg.p[pt.name]; if (!M || !M.kind || !g) continue; const ax = AX[M.axis] || 'x', s = Math.sin(M.speed * t + M.phase);
    if (M.kind === 1) g.rotation[ax] = 0.15 * Math.sign(M.amp) + M.amp * s;
    else if (M.kind === 2) g.rotation[ax] = M.amp * s;
    else if (M.kind === 3) g.rotation[ax] = state && state.open !== undefined ? (state.open ? M.amp : 0) : M.amp * Math.max(0, s) ** 2;
    else if (M.kind === 4) g.rotation[ax] = M.speed * t;
    else if (M.kind === 5) g.scale.copy(g.userData.rest.scale).multiplyScalar(1 + M.amp * Math.max(0, s));
    else if (M.kind === 6) g.position[ax] = g.userData.rest.pos[ax] + M.amp * m.voxel * s; }
}
export function animateBlocks(id, bg, t, state) { if (bg.model.version >= 2) { animateHints(bg, t, state); return; } const f = BLOCK_ANIM[id]; if (f) f(bg.p, t, bg.model.voxel, state); }       // version 1 files carry no motion: the hand-copied table above

// the block models, loaded once behind ?blocks=1 (files in assets/models/blocks/, kept out of the repo). A missing file is skipped and the current look stays.
export const BLOCKS = {};
export const blocksOn = typeof location !== 'undefined' && !/[?&]blocks=0/.test(location.search);
// the map kits (structures, far silhouettes, dressing, enemies), baked by the asset tool and listed in assets/models/maps/index.json; loaded by id for the map being played, in every look
export async function loadMapModels(ids) {
  await Promise.all(ids.filter(id => !BLOCKS[id]).map(async id => { try { const r = await fetch('assets/models/maps/' + id + '.ewv3'); if (!r.ok) return; BLOCKS[id] = decodeEwv3(new Uint8Array(await r.arrayBuffer())); } catch (e) { console.warn('map model', id, e.message); } }));
  return BLOCKS;
}
export async function loadBlocks(ids) {
  if (!blocksOn) return BLOCKS;
  await Promise.all(ids.map(async id => { try { const r = await fetch('assets/models/blocks/' + id + '.ewv3', { cache: 'no-store' }); if (!r.ok) return; BLOCKS[id] = decodeEwv3(new Uint8Array(await r.arrayBuffer())); } catch (e) { console.warn('block model', id, e.message); } }));
  return BLOCKS;
}


// ---- the swarm swing: instanced block enemies move their parts in the vertex shader from the part hints (the part index is on every vertex, the pivots and hints are uniforms).
// Version 1 files carry no hints, so a few are copied from the recipes' M.anim (kind 2 = sway; axis 0 x, 1 y, 2 z; amp in radians; speed in radians a second).
const HINTS_V1 = { husk: { armL: [2, 0, 0.4, 3, 0], armR: [2, 0, -0.4, 3, 0], head: [2, 2, 0.12, 1.5, 0] } };
export function partHints(model, id) { return model.parts.map(pt => { if (pt.motion) return pt.motion; const h = (HINTS_V1[id] || {})[pt.name]; return h ? { kind: h[0], axis: h[1], amp: h[2], speed: h[3], phase: h[4] } : { kind: 0, axis: 0, amp: 0, speed: 0, phase: 0 }; }); }
const SWING_GLSL = [
  '{ int pi = int(aPart + 0.5); vec4 M = uSwMot[0]; vec3 P = uSwPiv[0], K = uSwAx[0]; float PH = uSwPh[0];',
  '  for (int j = 1; j < 8; j++) if (j == pi) { M = uSwMot[j]; P = uSwPiv[j]; K = uSwAx[j]; PH = uSwPh[j]; }',
  '  float off = 0.0;',
  '#ifdef USE_INSTANCING',
  '  off = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.61;',
  '#endif',
  '  float s = sin(uSwT * M.z + PH + off); int kd = int(M.x + 0.5);',
  '  if (kd == 1) transformed = P + swRot(transformed - P, K, 0.15 * sign(M.y) + M.y * s);',
  '  else if (kd == 2) transformed = P + swRot(transformed - P, K, M.y * s);',
  '  else if (kd == 3) transformed = P + swRot(transformed - P, K, M.y * max(0.0, s) * max(0.0, s));',
  '  else if (kd == 4) transformed = P + swRot(transformed - P, K, M.z * uSwT);',
  '  else if (kd == 5) transformed = P + (transformed - P) * (1.0 + M.y * max(0.0, s));',
  '  else if (kd == 6) transformed += K * M.w * s; }'
].join('\n');
const SWING_HEAD = 'attribute float aPart; uniform float uSwT; uniform vec3 uSwPiv[8]; uniform vec4 uSwMot[8]; uniform vec3 uSwAx[8]; uniform float uSwPh[8];\n' +
  'vec3 swRot(vec3 v, vec3 k, float a) { float c = cos(a), s = sin(a); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }\n';
// fit: the Matrix4 the merged geometry was moved by (uniform scale and turns), so the pivots and axes follow it. clock: a shared { value } in seconds.
export function blockSwing(mat, model, id, fit, clock) {
  const N = 8, H = partHints(model, id), piv = [], mot = [], ph = [], ax = [], Q = new T.Matrix3().setFromMatrix4(fit), fitScale = new T.Vector3().setFromMatrixColumn(fit, 0).length();
  for (let i = 0; i < N; i++) { const pt = model.parts[i], h = H[i]; if (!pt || !h) { piv.push(new T.Vector3()); mot.push(new T.Vector4()); ph.push(0); ax.push(new T.Vector3(1, 0, 0)); continue; }
    piv.push(new T.Vector3(pt.pivot[0], pt.pivot[1], pt.pivot[2]).applyMatrix4(fit)); ax.push(new T.Vector3(h.axis === 0 ? 1 : 0, h.axis === 1 ? 1 : 0, h.axis === 2 ? 1 : 0).applyMatrix3(Q).normalize());
    mot.push(new T.Vector4(h.kind, h.amp, h.speed, h.amp * model.voxel * fitScale)); ph.push(h.phase); }       // w: a bob's distance in metres after the fit
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r);
    Object.assign(sh.uniforms, { uSwT: clock, uSwPiv: { value: piv }, uSwMot: { value: mot }, uSwAx: { value: ax }, uSwPh: { value: ph } });
    sh.vertexShader = SWING_HEAD + sh.vertexShader.replace('#include <morphtarget_vertex>', '#include <morphtarget_vertex>\n' + SWING_GLSL);
  };
  mat.customProgramCacheKey = () => 'blockswing';
  return mat;
}
