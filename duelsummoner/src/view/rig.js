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

// Builds { root, clips: Map(name -> AnimationClip), bones: Map(name -> Bone), height } from a GLB buffer. texSize shrinks the texture (the file's is 2048 px or more).
export async function buildRig(buf, { texSize = 512 } = {}) {
  const glb = parseGlb(buf), J = glb.json, nodes = J.nodes, skin = J.skins && J.skins[0], jointSet = new Set(skin ? skin.joints : []);
  const names = nodes.map((n, i) => clean(n.name || 'node' + i)), seen = new Set(); names.forEach((n, i) => { let m = n, k = 1; while (seen.has(m)) m = n + '_' + (k++); names[i] = m; seen.add(m); });
  const objs = nodes.map((n, i) => { const o = jointSet.has(i) ? new T.Bone() : new T.Object3D(); o.name = names[i]; if (n.matrix) new T.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale); else { if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale); } return o; });
  nodes.forEach((n, i) => (n.children || []).forEach(c => objs[i].add(objs[c])));
  const root = new T.Group(); for (const ni of J.scenes[J.scene || 0].nodes) root.add(objs[ni]);
  // the mesh
  let skinned = null;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].mesh === undefined) continue;
    const p = J.meshes[nodes[i].mesh].primitives[0], at = p.attributes, geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(accessor(glb, at.POSITION), 3)); if (at.NORMAL !== undefined) geo.setAttribute('normal', new T.BufferAttribute(accessor(glb, at.NORMAL), 3)); else geo.computeVertexNormals();
    if (at.TEXCOORD_0 !== undefined) geo.setAttribute('uv', new T.BufferAttribute(accessor(glb, at.TEXCOORD_0), 2));
    if (at.JOINTS_0 !== undefined) { geo.setAttribute('skinIndex', new T.BufferAttribute(new Uint16Array(accessor(glb, at.JOINTS_0)), 4)); geo.setAttribute('skinWeight', new T.BufferAttribute(accessor(glb, at.WEIGHTS_0), 4)); }
    if (p.indices !== undefined) geo.setIndex(new T.BufferAttribute(accessor(glb, p.indices), 1));
    let map = null; const mat = J.materials && J.materials[p.material], tex = mat && mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorTexture;
    if (tex !== undefined && J.images) {
      const im = J.images[J.textures[tex.index].source], v = J.bufferViews[im.bufferView], blob = new Blob([glb.bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength)], { type: im.mimeType });
      const bmp = await createImageBitmap(blob), c = document.createElement('canvas'); c.width = c.height = texSize; c.getContext('2d').drawImage(bmp, 0, 0, texSize, texSize);
      map = new T.CanvasTexture(c); map.flipY = false;
    }
    const material = new T.MeshLambertMaterial(map ? { map, side: T.DoubleSide, skinning: true } : { color: 0xcccccc, side: T.DoubleSide, skinning: true })   // three r128: a skinned material must say so;
    skinned = new T.SkinnedMesh(geo, material); skinned.frustumCulled = false; skinned.name = names[i];
    objs[i].add(skinned);
    if (skin) { root.updateMatrixWorld(true); const ibm = accessor(glb, skin.inverseBindMatrices), inv = skin.joints.map((_, k) => new T.Matrix4().fromArray(ibm, k * 16)); skinned.bind(new T.Skeleton(skin.joints.map(j => objs[j]), inv), skinned.matrixWorld); }
  }
  const clips = readClips(glb, names);
  for (const [k, c] of buildProcClips({ root })) if (!clips.has(k)) clips.set(k, c);                       // hand-keyed clips fill every name a real clip does not
  const box = new T.Box3().setFromObject(root);
  return { root, clips, height: box.max.y - box.min.y, skinned };
}

import { CLIPS, UPPER, JUMP_CUT, locomotion } from './rigstate.js';
import { buildProcClips } from './procclips.js';
export { CLIPS, UPPER, locomotion };

export class DuelistRig {
  constructor(built, { yaw = 0, height = 1.8 } = {}) {
    this.root = built.root; this.clips = built.clips; this.mixer = new T.AnimationMixer(this.root); this.actions = new Map(); this.cur = null; this.upperAct = null; this.upperT = 0;
    this.yaw = yaw; this.scale = height / (built.height || 1.8); this.root.scale.setScalar(this.scale); this.prev = { landT: 0, airUsed: 0 };
    this.group = new T.Group(); this.group.add(this.root); this.missing = new Set();
    this._lowerCache = new Map(); this._upperCache = new Map();
  }
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
    const pr = this.prev; if (p.grounded && !pr.wasGrounded && pr.fallV < -9) { pr.landT = 0.5; pr.landHeavy = true; } else if (p.grounded && !pr.wasGrounded && pr.fallV < -4) { pr.landT = 0.3; pr.landHeavy = false; }
    if (!p.grounded) pr.fallV = p.vy; if (pr.landT > 0) pr.landT -= dt; if (p.airUsed > pr.airUsed) { pr.airJump = 0.5; } pr.airUsed = p.airUsed || 0; if (pr.airJump > 0) pr.airJump -= dt; pr.wasGrounded = p.grounded;
    if (this.holdUntil && performance.now() < this.holdUntil) { this.mixer.update(dt); return; }              // a one-shot (hurt, level up, summon...) is playing
    const want = locomotion(p, g, { landT: pr.landT, landHeavy: pr.landHeavy, airJump: pr.airJump > 0 });
    const upperOn = this.upperT > 0; const part = upperOn && this.has('throw_card') && !['defeat', 'victory', 'slide', 'dash'].includes(want.clip) ? 'lower' : 'all';
    const key = want.clip + '|' + part;
    if (key !== this.cur) { const prevAct = this.curAct; const a = this._play(want.clip, { loop: want.loop, speed: want.speed || 1, part }); if (a) { if (prevAct && prevAct !== a) prevAct.fadeOut(0.15); this.curAct = a; this.cur = key; } }
    else if (this.curAct && want.speed) this.curAct.timeScale = want.speed;
    if (thrown && this.has('throw_card')) { const u = this._play('throw_card', { loop: false, fade: 0.05, part: 'upper' }); if (u) { if (this.upperAct && this.upperAct !== u) this.upperAct.fadeOut(0.1); this.upperAct = u; this.upperT = 0.7; this.cur = null; } }
    if (this.upperT > 0) { this.upperT -= dt; if (this.upperT <= 0 && this.upperAct) { this.upperAct.fadeOut(0.15); this.upperAct = null; this.cur = null; } }
    this.mixer.update(dt);
  }
  // one-shot actions the view triggers from sim events: hurt, level_up, summon, fusion, tribute, open_chest...
  once(name) { const a = this._play(name, { loop: false, fade: 0.08 }); if (a) { if (this.curAct && this.curAct !== a) this.curAct.fadeOut(0.08); this.curAct = a; this.cur = '@' + name; this.holdUntil = performance.now() + a.getClip().duration * 1000; } return !!a; }
}

// extras: [{ url, rename: { 'land_heavy': 'land_heavy' }, seconds: { land_heavy: 0.9 } }] - clips exported from Meshy one at a time, merged by bone name
export async function loadRig(url, opts, extras = []) {
  try { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) return null; const built = await buildRig(await r.arrayBuffer(), opts);
    for (const ex of extras) { try { const rr = await fetch(ex.url, { cache: 'no-store' }); if (!rr.ok) continue; const g = parseGlb(await rr.arrayBuffer()); for (const [k, c] of readClips(g, cleanNames(g.json))) { if (ex.seconds && ex.seconds[k]) retime(c, ex.seconds[k]); built.clips.set(built.clips.has(k) && !ex.replace ? k + '_meshy' : k, c); } } catch (e) { /* optional */ } }
    return built; } catch (e) { console.error('rig load failed', e); return null; }
}
