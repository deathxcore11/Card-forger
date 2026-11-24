// A skinned, animated duelist from a Meshy GLB: a small GLB reader (no loader library), a clip name map, a state machine driven by what the sim says
// the duelist is doing, and an upper-body layer so a card throw plays while the legs keep running. View only: nothing here feeds the sim.
// Clip names are the ones in design/kael-motion-prompts.md. Until a clip exists the current Meshy clips stand in (see FALLBACK).
const T = window.THREE;

// ------------------------------------------------------------------ GLB reader
const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export function parseGlb(buf) {
  const dv = new DataView(buf); if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not a GLB');
  let o = 12, json = null, bin = null;
  while (o < buf.byteLength) { const len = dv.getUint32(o, true), type = dv.getUint32(o + 4, true); const chunk = buf.slice(o + 8, o + 8 + len); if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(chunk)); else if (type === 0x004E4942) bin = chunk; o += 8 + len + ((4 - (len % 4)) % 4) * 0; }
  return { json, bin };
}
function accessor(glb, i) {
  const a = glb.json.accessors[i], v = glb.json.bufferViews[a.bufferView], Ctor = COMP[a.componentType], n = NCOMP[a.type], off = (v.byteOffset || 0) + (a.byteOffset || 0);
  const stride = v.byteStride && v.byteStride !== Ctor.BYTES_PER_ELEMENT * n ? v.byteStride : 0, out = new Ctor(a.count * n);
  if (!stride) { out.set(new Ctor(glb.bin.slice(off, off + a.count * n * Ctor.BYTES_PER_ELEMENT))); }
  else { const dv = new DataView(glb.bin); for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) { const at = off + k * stride + c * Ctor.BYTES_PER_ELEMENT; out[k * n + c] = a.componentType === 5126 ? dv.getFloat32(at, true) : a.componentType === 5125 ? dv.getUint32(at, true) : a.componentType === 5123 ? dv.getUint16(at, true) : dv.getUint8(at); } }
  return out;
}
const clean = s => String(s).replace(/[^A-Za-z0-9_]/g, '_');                       // three reserves . : / [ ] in track names


// Reads the animations of a GLB into AnimationClips. The hips lose their sideways and forward travel so the game, not the clip, moves the duelist.
export function readClips(glb, names) {
  const J = glb.json, hips = J.nodes.findIndex(n => /hips/i.test(n.name || '')), clips = new Map();
  for (const an of J.animations || []) {
    const tracks = [];
    for (const ch of an.channels) {
      const s = an.samplers[ch.sampler], times = accessor(glb, s.input), vals = accessor(glb, s.output), nm = names[ch.target.node];
      if (ch.target.path === 'translation') { const v = Float32Array.from(vals); if (ch.target.node === hips) for (let k = 0; k < v.length; k += 3) { v[k] = vals[0]; v[k + 2] = vals[2]; } tracks.push(new T.VectorKeyframeTrack(nm + '.position', times, v)); }
      else if (ch.target.path === 'rotation') tracks.push(new T.QuaternionKeyframeTrack(nm + '.quaternion', times, vals));
      else if (ch.target.path === 'scale') tracks.push(new T.VectorKeyframeTrack(nm + '.scale', times, vals));
    }
    clips.set(an.name, new T.AnimationClip(an.name, -1, tracks));
  }
  return clips;
}
export function cleanNames(J) { const names = J.nodes.map((n, i) => clean(n.name || 'node' + i)), seen = new Set(); names.forEach((n, i) => { let m = n, k = 1; while (seen.has(m)) m = n + '_' + (k++); names[i] = m; seen.add(m); }); return names; }
// speed a clip up or down to a new length (a Meshy clip came out 1.97 s long and the game wants 0.9 s)
export function retime(clip, seconds) { const k = seconds / clip.duration; for (const tr of clip.tracks) for (let i = 0; i < tr.times.length; i++) tr.times[i] *= k; clip.duration = seconds; return clip; }


// A small detached piece (a hair clip, a quill, a buckle) must move as one rigid thing with the bone it mostly belongs to. Meshy leaves a little
// weight on the arm or the shoulder, so the piece wobbles when she reaches. Find each small island of the mesh and give all of it to its main bone.
export function snapSmallIslands(geo, maxTris = 80, minShare = 0.6) {
  const pos = geo.attributes.position, idx = geo.index.array, sj = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  const id = new Map(), rep = new Uint32Array(pos.count); for (let i = 0; i < pos.count; i++) { const k = pos.getX(i).toFixed(4) + ',' + pos.getY(i).toFixed(4) + ',' + pos.getZ(i).toFixed(4); if (!id.has(k)) id.set(k, id.size); rep[i] = id.get(k); }
  const par = new Uint32Array(id.size); for (let i = 0; i < par.length; i++) par[i] = i; const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < idx.length; t += 3) { par[find(rep[idx[t + 1]])] = find(rep[idx[t]]); par[find(rep[idx[t + 2]])] = find(rep[idx[t]]); }
  const isl = new Map(); for (let t = 0; t < idx.length; t += 3) { const r = find(rep[idx[t]]); let o = isl.get(r); if (!o) isl.set(r, o = { tris: 0, verts: new Set() }); o.tris++; for (let k = 0; k < 3; k++) o.verts.add(idx[t + k]); }
  let snapped = 0;
  for (const o of isl.values()) {
    if (o.tris > maxTris) continue; const share = new Map(); for (const v of o.verts) for (let k = 0; k < 4; k++) { const w = sw.array[v * 4 + k]; if (w > 0) share.set(sj.array[v * 4 + k], (share.get(sj.array[v * 4 + k]) || 0) + w); }
    let best = -1, bw = 0; for (const [j, w] of share) if (w > bw) { bw = w; best = j; } if (best < 0 || bw / o.verts.size < minShare) continue;
    for (const v of o.verts) { sj.setXYZW(v, best, 0, 0, 0); sw.setXYZW(v, 1, 0, 0, 0); } snapped++;
  }
  return snapped;
}

// The Carved Cards re-bake: de-index the first primitive so every triangle has its own three vertices (position, skin index, skin weight copied), give them the triangle's colour from the face colour list
// (palette hex list plus one byte per triangle, in index-buffer order), flat normals for the light, and smoothed 'hnormal' for the outline hulls (flat normals would crack them open).
function faceColourMesh(glb, p, fc) {
  const at = p.attributes, pos = accessor(glb, at.POSITION), idx = accessor(glb, p.indices), jt = accessor(glb, at.JOINTS_0), wt = accessor(glb, at.WEIGHTS_0), col = Uint8Array.from(atob(fc.index), c => c.charCodeAt(0)), nT = idx.length / 3;
  if (col.length !== nT) { console.warn('face colour list has ' + col.length + ' faces, the model has ' + nT + ': using the texture'); return null; }
  const pal = fc.palette.map(h => { const v = parseInt(String(h).replace('#', ''), 16); return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]; });
  const P = new Float32Array(nT * 9), C = new Float32Array(nT * 9), Nf = new Float32Array(nT * 9), H = new Float32Array(nT * 9), SI = new Uint16Array(nT * 12), SW = new Float32Array(nT * 12), acc = new Float32Array(pos.length);
  for (let f = 0; f < nT; f++) {       // area-weighted vertex normals for the hulls
    const a = idx[f * 3], b = idx[f * 3 + 1], c = idx[f * 3 + 2], ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2], vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const k of [a, b, c]) { acc[k * 3] += nx; acc[k * 3 + 1] += ny; acc[k * 3 + 2] += nz; }
  }
  for (let f = 0; f < nT; f++) {
    const col3 = pal[Math.min(col[f], pal.length - 1)], tri = [idx[f * 3], idx[f * 3 + 1], idx[f * 3 + 2]], a = tri[0], b = tri[1], c = tri[2];
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2], vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l;
    for (let k = 0; k < 3; k++) {
      const v = tri[k], o = f * 9 + k * 3; P[o] = pos[v * 3]; P[o + 1] = pos[v * 3 + 1]; P[o + 2] = pos[v * 3 + 2]; C[o] = col3[0]; C[o + 1] = col3[1]; C[o + 2] = col3[2]; Nf[o] = nx; Nf[o + 1] = ny; Nf[o + 2] = nz;
      const al = Math.sqrt(acc[v * 3] ** 2 + acc[v * 3 + 1] ** 2 + acc[v * 3 + 2] ** 2) || 1; H[o] = acc[v * 3] / al; H[o + 1] = acc[v * 3 + 1] / al; H[o + 2] = acc[v * 3 + 2] / al;
      for (let j = 0; j < 4; j++) { SI[f * 12 + k * 4 + j] = jt[v * 4 + j]; SW[f * 12 + k * 4 + j] = wt[v * 4 + j]; }
    }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(Nf, 3)); g.setAttribute('hnormal', new T.BufferAttribute(H, 3)); g.setAttribute('color', new T.BufferAttribute(C, 3));
  g.setAttribute('skinIndex', new T.BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new T.BufferAttribute(SW, 4)); g.userData.faceColour = true; return g;
}
// Builds { root, clips: Map(name -> AnimationClip), bones: Map(name -> Bone), height } from a GLB buffer. texSize shrinks the texture (the file's is 2048 px or more).
// Two steps so a creature can be made many times cheaply: prepareRig reads the file once (async: the texture is decoded and shrunk once); instantiateRig then makes
// a new set of bones and a new skin that share the same geometry, material and texture (sync, so a monster can be made in the middle of a frame).
export async function prepareRig(buf, opts = {}) {
  const { texSize = 512 } = opts, glb = parseGlb(buf), J = glb.json, skin = J.skins && J.skins[0], names = cleanNames(J), meshes = [];
  for (let i = 0; i < J.nodes.length; i++) {
    if (J.nodes[i].mesh === undefined) continue;
    const p = J.meshes[J.nodes[i].mesh].primitives[0], at = p.attributes; let geo = new T.BufferGeometry();
    if (opts.facecol && meshes.length === 0 && p.indices !== undefined && at.JOINTS_0 !== undefined) { const fm = faceColourMesh(glb, p, opts.facecol); if (fm) { meshes.push({ node: i, geo: fm, material: actorLit(new T.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: T.DoubleSide, skinning: true })) }); continue; } }       // a face colour list: no texture at all, one flat colour per triangle
    geo.setAttribute('position', new T.BufferAttribute(accessor(glb, at.POSITION), 3)); if (at.NORMAL !== undefined) geo.setAttribute('normal', new T.BufferAttribute(accessor(glb, at.NORMAL), 3)); else geo.computeVertexNormals();
    if (at.TEXCOORD_0 !== undefined) geo.setAttribute('uv', new T.BufferAttribute(accessor(glb, at.TEXCOORD_0), 2));
    if (at.JOINTS_0 !== undefined) { geo.setAttribute('skinIndex', new T.BufferAttribute(new Uint16Array(accessor(glb, at.JOINTS_0)), 4)); geo.setAttribute('skinWeight', new T.BufferAttribute(accessor(glb, at.WEIGHTS_0), 4)); }
    if (p.indices !== undefined) geo.setIndex(new T.BufferAttribute(accessor(glb, p.indices), 1));
    if (at.JOINTS_0 !== undefined && p.indices !== undefined) geo.userData.snapped = snapSmallIslands(geo);
    let map = null; const mat = J.materials && J.materials[p.material], tex = mat && mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorTexture;
    if (tex !== undefined && J.images) {
      const im = J.images[J.textures[tex.index].source], v = J.bufferViews[im.bufferView], blob = new Blob([glb.bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength)], { type: im.mimeType });
      const bmp = await createImageBitmap(blob), c = document.createElement('canvas'); c.width = c.height = texSize; c.getContext('2d').drawImage(bmp, 0, 0, texSize, texSize);
      map = new T.CanvasTexture(c); map.flipY = false;
    }
    if (!geo.attributes.hnormal) geo.setAttribute('hnormal', geo.attributes.normal);
    const material = actorLit(new T.MeshLambertMaterial(map ? { map, side: T.DoubleSide, skinning: true } : { color: 0xcccccc, side: T.DoubleSide, skinning: true }));          // three r128: a skinned material must say so
    meshes.push({ node: i, geo, material });
  }
  const ibm = skin ? accessor(glb, skin.inverseBindMatrices) : null;
  return { glb, J, skin, names, meshes, ibm, clips: readClips(glb, names) };
}
export function instantiateRig(prep, opts = {}) {
  const { J, skin, names, meshes, ibm } = prep, nodes = J.nodes, jointSet = new Set(skin ? skin.joints : []);
  const objs = nodes.map((n, i) => { const o = jointSet.has(i) ? new T.Bone() : new T.Object3D(); o.name = names[i]; if (n.matrix) new T.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale); else { if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale); } return o; });
  nodes.forEach((n, i) => (n.children || []).forEach(c => objs[i].add(objs[c])));
  const root = new T.Group(); for (const ni of J.scenes[J.scene || 0].nodes) root.add(objs[ni]);
  let skinned = null;
  for (const m of meshes) {
    skinned = new T.SkinnedMesh(m.geo, m.material); skinned.frustumCulled = false; skinned.name = names[m.node]; objs[m.node].add(skinned);
    if (skin) { root.updateMatrixWorld(true); const inv = skin.joints.map((_, k) => new T.Matrix4().fromArray(ibm, k * 16)); skinned.bind(new T.Skeleton(skin.joints.map(j => objs[j]), inv), skinned.matrixWorld); }
  }
  const clips = new Map(prep.clips);                                                // shared clip objects: they address bones by name, so any instance can play them
  if (!opts.creature) for (const [k, c] of buildProcClips({ root })) if (!clips.has(k)) clips.set(k, c);              // hand-keyed clips fill every name a real clip does not
  const box = new T.Box3().setFromObject(root);
  return { root, clips, height: box.max.y - box.min.y, skinned };
}
export async function buildRig(buf, opts = {}) { return instantiateRig(await prepareRig(buf, opts), opts); }

import { CLIPS, UPPER, JUMP_CUT, locomotion } from './rigstate.js';
import { actorLit } from './engine.js';
import { buildProcClips, makeAxes } from './procclips.js';
export { CLIPS, UPPER, locomotion };

// crossfade seconds: about 0.12 for movement, shorter for snappy actions, longer into idle. Nothing ever cuts.
const FADE = { default: 0.12, idle_cards: 0.2, select_fidget: 0.2, dash: 0.06, slide: 0.1, hurt: 0.08, throw_card: 0.1, land_light: 0.1, land_heavy: 0.1, jump_rise: 0.1, jump_apex: 0.1, fall_loop: 0.12, air_jump: 0.1, defeat: 0.15, victory: 0.2 };
const LOCO = ['idle_cards', 'walk', 'run'], WALK_STRIDE = 2.88, RUN_STRIDE = 5.67;   // metres per cycle of the Meshy walk (1.03 s at about 2.8 m/s) and run (0.63 s at about 9 m/s)
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

// The duelist through anything solid (spectacle 2.8). Per skinned mesh: a 50% white checker where the duelist is behind something (depth GREATER, not over its own pixels),
// and a 2 tone outline (white 1 art pixel inside, ink 1 art pixel outside; an art pixel is 1/540 of the screen height) drawn everywhere the body itself is not. The body writes stencil 1.
// Extras are marked userData.extra and sit as siblings of the body mesh, sharing its geometry and skeleton, so they cost one draw each and no extra animation work.
const INK = 0x1e1e2a;
// stencil bit 0 = the body's own pixels, bit 1 = the silhouette's area (marked by a colourless pass), so the outline hulls draw only outside both
function stencilOutside(m) { m.stencilWrite = true; m.stencilFunc = T.NotEqualStencilFunc; m.stencilRef = 1; m.stencilFuncMask = 1; m.stencilWriteMask = 0; }
function stencilClear(m) { m.stencilWrite = true; m.stencilFunc = T.EqualStencilFunc; m.stencilRef = 0; m.stencilFuncMask = 3; m.stencilWriteMask = 0; }
function maskMaterial() {
  const m = new T.MeshBasicMaterial({ side: T.DoubleSide, fog: false, depthTest: true, depthFunc: T.GreaterDepth, depthWrite: false, colorWrite: false }); m.skinning = true;
  m.stencilWrite = true; m.stencilFunc = T.EqualStencilFunc; m.stencilRef = 2; m.stencilFuncMask = 1; m.stencilWriteMask = 2; m.stencilZPass = T.ReplaceStencilOp; return m;
}
function hullMaterial(artPx, color) {
  const m = new T.MeshBasicMaterial({ color, side: T.BackSide, fog: false, depthTest: false, depthWrite: false }); m.skinning = true; stencilClear(m);
  m.onBeforeCompile = sh => { sh.vertexShader = 'attribute vec3 hnormal;\n' + sh.vertexShader.replace('#include <project_vertex>', 'vec4 mvPosition = vec4(transformed, 1.0); mvPosition = modelViewMatrix * mvPosition; mat4 sm = skinWeight.x * boneMatX + skinWeight.y * boneMatY + skinWeight.z * boneMatZ + skinWeight.w * boneMatW; sm = bindMatrixInverse * sm * bindMatrix; vec3 nv = normalize(normalMatrix * (sm * vec4(hnormal, 0.0)).xyz);\n mvPosition.xyz += nv * (-mvPosition.z) * (' + artPx.toFixed(1) + ' * 2.0 / (projectionMatrix[1][1] * 540.0)); gl_Position = projectionMatrix * mvPosition;'); };
  return m;
}
function silhouetteMaterial() {
  const m = new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide, fog: false, depthTest: true, depthFunc: T.GreaterDepth, depthWrite: false }); m.skinning = true; stencilOutside(m);
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n if (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 1.0) discard;'); };
  return m;
}
export function addDuelistExtras(root) {
  const bodies = []; root.traverse(o => { if (o.isSkinnedMesh && !o.userData.extra) bodies.push(o); });
  const sil = silhouetteMaterial(), white = hullMaterial(1, 0xffffff), ink = hullMaterial(2, INK), mask = maskMaterial(), extras = [];
  for (const b of bodies) {
    b.renderOrder = 8;       // the body is drawn after every other opaque thing, so its stencil mark is written only on pixels that really show it (a later wall would not clear the mark)
    const m = b.material; m.stencilWrite = true; m.stencilFunc = T.AlwaysStencilFunc; m.stencilRef = 1; m.stencilZPass = T.ReplaceStencilOp;       // the body marks its own pixels
    for (const [mat, order, kind] of [[mask, 8.5, 'mask'], [sil, 9, 'sil'], [ink, 10, 'ink'], [white, 11, 'white']]) {
      const s = new T.SkinnedMesh(b.geometry, mat); s.bind(b.skeleton, b.bindMatrix); s.frustumCulled = false; s.renderOrder = order; s.userData.extra = kind; s.name = b.name + '_' + kind;
      b.parent.add(s); extras.push(s);
    }
  }
  return { bodies, extras, sil, white, ink };
}
function makeMarker() {         // a white chevron above the head, pointing down; shown when the duelist is hidden from the camera
  const g = new T.ConeGeometry(0.22, 0.5, 4); g.rotateX(Math.PI); const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: 0xffffff, fog: false, depthTest: false, depthWrite: false }));
  m.renderOrder = 12; m.userData.extra = 'marker'; m.visible = false; m.frustumCulled = false; return m;
}

export class DuelistRig {
  constructor(built, { yaw = 0, height = 1.8 } = {}) {
    this.root = built.root; this.clips = built.clips; this.mixer = new T.AnimationMixer(this.root); this.actions = new Map(); this.cur = null; this.upperAct = null; this.upperT = 0;
    this.yaw = yaw; this.scale = height / (built.height || 1.8); this.root.scale.setScalar(this.scale); this.prev = { landT: 0, airUsed: 0 };
    this.group = new T.Group(); this.group.add(this.root); this.missing = new Set();
    this.see = addDuelistExtras(this.root); this.marker = makeMarker(); this.group.add(this.marker); this.marker.position.y = 2.55;
    this._lowerCache = new Map(); this._upperCache = new Map();
  }
  forward() { if (!this._F) this._F = makeAxes(this.root).F.clone(); const f = this._F.clone(); f.applyQuaternion(this.group.quaternion); return f; }     // the model's front in the world
  has(name) { return (CLIPS[name] || []).some(n => this.clips.has(n)); }
  _clip(name, part) {                                                       // part: 'all' | 'lower' | 'upper'
    const real = (CLIPS[name] || [name]).find(n => this.clips.has(n)); if (!real) { this.missing.add(name); return null; }
    let c = this.clips.get(real); const cut = JUMP_CUT[name] && real === 'Regular_Jump' ? JUMP_CUT[name] : null;
    const key = real + '|' + part + '|' + (cut ? cut.join('-') : ''); const cache = part === 'upper' ? this._upperCache : this._lowerCache; if (part !== 'all' && cache.has(key)) return cache.get(key);
    if (cut) c = T.AnimationUtils.subclip(c, name, Math.round(cut[0] * 30), Math.round(cut[1] * 30), 30);
    if (part !== 'all') { const keep = t => (UPPER.test(t.name.split('.')[0]) ? part === 'upper' : part === 'lower'); c = new T.AnimationClip(c.name + '_' + part, c.duration, c.tracks.filter(keep)); cache.set(key, c); }
    return c;
  }
  _play(name, { loop = true, speed = 1, fade = 0.15, part = 'all' } = {}) {
    const clip = this._clip(name, part); if (!clip) return null;
    const key = clip.uuid; let a = this.actions.get(key); if (!a) { a = this.mixer.clipAction(clip); this.actions.set(key, a); }
    a.reset(); a.setLoop(loop ? T.LoopRepeat : T.LoopOnce, Infinity); a.clampWhenFinished = !loop; a.timeScale = speed; a.enabled = true; a.setEffectiveWeight(1); a.fadeIn(fade).play(); return a;
  }
  // call every frame with the sim's player and game, the frame time, and whether a card was just thrown
  update(p, g, dt, thrown) {
    if (this.debugHold) return;                                                // a test is posing the rig by hand
    if (this._twSaved) { for (const [b, q] of this._twSaved) b.quaternion.copy(q); this._twSaved = null; }       // take last frame's torso twist off first: the mixer only writes a bone whose clip value changed, so on a held pose the twist would pile up frame after frame and snap back later
    const pr = this.prev; if (p.grounded && !pr.wasGrounded && pr.fallV < -9) { pr.landT = 0.5; pr.landHeavy = true; } else if (p.grounded && !pr.wasGrounded && pr.fallV < -4) { pr.landT = 0.3; pr.landHeavy = false; }
    if (!p.grounded) pr.fallV = p.vy; if (pr.landT > 0) pr.landT -= dt; if (p.airUsed > pr.airUsed) { pr.airJump = 0.5; } pr.airUsed = p.airUsed || 0; if (pr.airJump > 0) pr.airJump -= dt; pr.wasGrounded = p.grounded;
    const hasThrow = this.has('throw_card');
    if (thrown && hasThrow) this.overlay('throw_card', { fadeIn: 0.12, fadeOut: 0.25, weight: 0.6, gap: 0.3, speed: 0.6 });       // a throw is a soft arm flick laid over the run: the run arms never drop out, the clip never restarts while it plays
    this._overlays();
    if (this.holdUntil && performance.now() < this.holdUntil) { this.mixer.update(dt); return; }              // a one-shot (summon, level up...) is playing
    const want = locomotion(p, g, { landT: pr.landT, landHeavy: pr.landHeavy, airJump: pr.airJump > 0 });
    const sp = Math.hypot(p.vx || 0, p.vz || 0), locoNow = LOCO.includes(want.clip) && this.has('idle_cards') && this.has('walk') && this.has('run');
    this._loco(sp, dt, locoNow, this.upperT > 0);
    if (locoNow) { if (this.curAct) { this.curAct.fadeOut(0.15); this.curAct = null; } this.cur = 'loco'; this.mixer.update(dt); return; }       // a finished one-shot fades out when running resumes, so it no longer blends half and half with the run                      // the blend plays the legs and the torso; the throw layer (if any) plays the arms
    const part = this.upperT > 0 && hasThrow && !['defeat', 'victory', 'slide', 'dash'].includes(want.clip) ? 'lower' : 'all';
    const key = want.clip + '|' + part;
    if (key !== this.cur) { const prevAct = this.curAct; const act = this._play(want.clip, { loop: want.loop, speed: want.speed || 1, part, fade: FADE[want.clip] || FADE.default }); if (act) { if (prevAct && prevAct !== act) prevAct.fadeOut(0.15); this.curAct = act; this.cur = key; } }
    else if (this.curAct && want.speed) this.curAct.timeScale = want.speed;
    this.mixer.update(dt);
  }
  // upper-body aim: after the clips have played, turn the spine chain about the world's up axis by 'yaw' (the body keeps its move direction; only the torso looks at the target)
  twist(yaw) {
    if (!this._sp) { const all = []; this.root.traverse(o => { if (o.isBone && /spine|chest/i.test(o.name)) all.push(o); }); const depth = o => { let d = 0; for (let q = o; q.parent; q = q.parent) d++; return d; }; all.sort((a, b) => depth(a) - depth(b)); this._sp = all.slice(0, 3); }
    if (!this._sp.length || Math.abs(yaw) < 1e-3) return;
    this._twSaved = this._sp.map(b => [b, b.quaternion.clone()]);
    this.group.updateMatrixWorld(true);
    const qy = new T.Quaternion(), qp = new T.Quaternion(), up = new T.Vector3(0, 1, 0), per = yaw / this._sp.length;
    for (const b of this._sp) { b.parent.getWorldQuaternion(qp); qy.setFromAxisAngle(up, per); b.quaternion.premultiply(qp).premultiply(qy).premultiply(qp.clone().invert()); b.updateMatrixWorld(true); }
  }
  // idle, walk and run are one blend: weights follow ground speed and the walk and run share one foot phase, so feet do not slide and nothing switches.
  // Two sets (legs and hips, arms and torso) so a card throw can take the arms and torso while the legs keep running.
  _loco(sp, dt, on, throwing) {
    if (!this.L) {
      if (!(this.has('idle_cards') && this.has('walk') && this.has('run'))) return;
      const mk = (n, part) => { const a = this._play(n, { loop: true, fade: 0, part }); a.setEffectiveWeight(0); return a; };
      this.L = { idleL: mk('idle_cards', 'lower'), walkL: mk('walk', 'lower'), runL: mk('run', 'lower'), idleU: mk('idle_cards', 'upper'), walkU: mk('walk', 'upper'), runU: mk('run', 'upper') };
      for (const k of ['walkL', 'runL', 'walkU', 'runU']) this.L[k].timeScale = 0; this.lw = { idle: 0, walk: 0, run: 0, up: 1 }; this.ph = 0;
    }
    const L = this.L, lw = this.lw; let ti = 0, tw = 0, tr = 0;
    if (on) { const wi = clamp01(1 - (sp - 0.4) / 1.0), wr = clamp01((sp - 4.5) / 4); ti = wi; tr = (1 - wi) * wr; tw = (1 - wi) * (1 - wr); }
    const k = on ? Math.min(1, dt * 12) : Math.min(1, dt / 0.12);
    if (this._rs < 0.15) { this._rs += dt; const f = Math.min(1, this._rs / 0.15); lw.idle = ti * f; lw.walk = tw * f; lw.run = tr * f; }       // after a one-shot the blend comes in linearly over 0.15 s while the one-shot fades out, so the two always add up to a whole
    else { lw.idle += (ti - lw.idle) * k; lw.walk += (tw - lw.walk) * k; lw.run += (tr - lw.run) * k; }
    lw.up += ((throwing ? 0 : 1) - lw.up) * Math.min(1, dt / 0.06);
    for (const n of ['idle', 'walk', 'run']) { const w = lw[n], al = L[n + 'L'], au = L[n + 'U']; al.enabled = w > 0.002; al.setEffectiveWeight(w); au.enabled = w * lw.up > 0.002; au.setEffectiveWeight(w * lw.up); }
    if (on && sp > 0.3) { const rs = lw.run / ((lw.walk + lw.run) || 1); const stride = WALK_STRIDE + (RUN_STRIDE - WALK_STRIDE) * rs, nat = 1 / (L.walkL.getClip().duration + (L.runL.getClip().duration - L.walkL.getClip().duration) * rs); this.ph = (this.ph + Math.max(0.7 * nat, Math.min(1.4 * nat, sp / stride)) * dt) % 1; }       // cycles per second follow ground speed but stay within 0.7 to 1.4 of the clip's own rate, so the legs never blur or crawl
    const wd = L.walkL.getClip().duration, rd = L.runL.getClip().duration; L.walkL.time = L.walkU.time = this.ph * wd; L.runL.time = L.runU.time = this.ph * rd;
  }
  // an additive flinch (hurt, a small hit): laid on top of whatever is playing as the difference from the standing pose, so it never interrupts a run or a jump
  // Every flinch and flick has an envelope (fades in over fadeIn, out over fadeOut, never under 0.08 s), a gap before it may fire again (0.4 s for a hurt), and is never restarted while it still plays.
  overlay(name, o = {}) {
    const src = this.clips.get(name); if (!src) return false; if (!this._add) this._add = new Map();
    const gap = (o.gap === undefined ? (name === 'hurt' ? 0.4 : 0.2) : o.gap) * 1000, now = performance.now(); if (!this._ovT) this._ovT = {}; if (now - (this._ovT[name] || 0) < gap) return false;
    if (name !== 'hurt' && (now - (this._ovT.hurt || 0) < 100 || (this._ovList || []).some(x => x.hurt))) return false;       // a flick never lands on a flinch that has just started or is still playing: two arm kicks in one frame read as a twitch
    let c = this._add.get(name); if (!c) { c = T.AnimationUtils.makeClipAdditive(src.clone(), 0, src, 30); this._add.set(name, c); }
    const a = this.mixer.clipAction(c), L = this._ovList || (this._ovList = []); if (L.some(x => x.a === a)) return false;
    if (name === 'hurt') for (const x of L) x.kt = 0.4;       // a throw flick already playing gives way to the flinch
    this._ovT[name] = now; a.blendMode = T.AdditiveAnimationBlendMode; a.reset(); a.setLoop(T.LoopOnce, 1); a.clampWhenFinished = false; a.setEffectiveWeight(0); a.enabled = true; const sp = o.speed || (name === 'hurt' ? 0.6 : 1); a.timeScale = sp; a.play();
    L.push({ a, sp, k: 1, hurt: name === 'hurt', dur: c.duration, fin: Math.max(0.08, o.fadeIn || (name === 'hurt' ? 0.16 : 0.08)), fout: Math.max(0.08, o.fadeOut || (name === 'hurt' ? 0.25 : 0.15)), w: o.weight === undefined ? (name === 'hurt' ? 0.55 : 1) : o.weight }); return true;
  }
  _overlays() {
    const L = this._ovList; if (!L || !L.length) return;
    for (let i = L.length - 1; i >= 0; i--) { const x = L[i], t = x.a.time / x.sp, dur = x.dur / x.sp; if (t >= dur - 0.001) { x.a.stop(); L.splice(i, 1); continue; } const e = Math.min(1, t / x.fin) * Math.min(1, (dur - t) / x.fout); if (x.kt !== undefined) x.k += (x.kt - x.k) * 0.15; x.a.setEffectiveWeight(x.w * x.k * Math.max(0, e)); }
  }
  // one-shot actions the view triggers from sim events: hurt, level_up, summon, fusion, tribute, open_chest...
  once(name) { this._rs = 0; if (this.L) for (const k of Object.keys(this.L)) this.L[k].fadeOut(0.15);       // the run blend gives way while the one-shot fades in, so the two never add up
    const a = this._play(name, { loop: false, fade: 0.15 }); if (a) { if (this.curAct && this.curAct !== a) this.curAct.fadeOut(0.15); this.curAct = a; this.cur = '@' + name; this.holdUntil = performance.now() + a.getClip().duration * 1000; } return !!a; }
}

// extras: [{ url, rename: { 'land_heavy': 'land_heavy' }, seconds: { land_heavy: 0.9 } }] - clips exported from Meshy one at a time, merged by bone name
// the face colour list lives beside the model (model.glb -> model.facecol.json); a model without one keeps its texture
export async function loadFaceColours(url) { try { const r = await fetch(url.replace(/\.glb$/, '.facecol.json'), { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch (e) { return null; } }
export async function loadRig(url, opts, extras = []) {
  try { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) return null; opts = Object.assign({}, opts, { facecol: await loadFaceColours(url) }); const built = await buildRig(await r.arrayBuffer(), opts);
    if (opts && opts.retime) for (const [k, s] of Object.entries(opts.retime)) { const c = built.clips.get(k); if (c) retime(c, s); }        // Meshy's own clips can be too long for the game
    for (const ex of extras) { try { const rr = await fetch(ex.url, { cache: 'no-store' }); if (!rr.ok) continue; const g = parseGlb(await rr.arrayBuffer()); for (const [k, c] of readClips(g, cleanNames(g.json))) { if (ex.seconds && ex.seconds[k]) retime(c, ex.seconds[k]); built.clips.set(built.clips.has(k) && !ex.replace ? k + '_meshy' : k, c); } } catch (e) { /* optional */ } }
    return built; } catch (e) { console.error('rig load failed', e); return null; }
}
