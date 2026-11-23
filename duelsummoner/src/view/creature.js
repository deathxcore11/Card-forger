// Creatures: any Meshy rig whose bones have no names (Bone_000 ... Bone_035) is labelled from its rest pose into canonical parts
// (wingL/R, legL/R, tail, neck, head, spine), and a clip set is written once against those parts: idle, fly, walk, attack, breath, hurt, arrive, defeat.
// Clips are made from small functions of time, so loops close exactly (the period divides the duration). Rotations are about the MODEL's axes
// (F forward, U up, R right) applied to a bone around its own joint, so nobody needs to know a bone's local axes.
import { prepareRig, instantiateRig } from './rig.js';
const T = window.THREE;

// ------------------------------------------------------------------ the classifier
// Labels come from where bones sit, not what they are called: a branching bone low in the body with side chains that point down is the hips (legs),
// a chain that points away from the head is the tail, side chains above the hips are wings, one chain going up and forward is neck and head.
export function classifyCreature(root) {
  root.updateMatrixWorld(true);
  const bones = []; root.traverse(o => { if (o.isBone) bones.push(o); });
  const kids = b => b.children.filter(c => c.isBone), pos = b => b.getWorldPosition(new T.Vector3());
  const top = bones.find(b => !(b.parent && b.parent.isBone)); if (!top) return null;
  const chainFrom = b => { const out = [b]; let cur = b; while (kids(cur).length === 1) { cur = kids(cur)[0]; out.push(cur); } return out; };      // down a single-child run
  // the first bone with several children is the hips
  let hips = top; while (kids(hips).length === 1) hips = kids(hips)[0];
  const hp = pos(hips), parts = { top, hips, spine: [], neck: [], head: null, wingL: [], wingR: [], wingL2: [], wingR2: [], legL: [], legR: [], tail: [], armL: [], armR: [], other: [] };
  const spineBones = []; { let b = top; while (b !== hips) { spineBones.push(b); b = kids(b)[0]; } spineBones.push(hips); } parts.spine = spineBones;
  // measure the body: the widest the bones reach sideways sets what counts as "to the side"
  let reach = 0; for (const b of bones) reach = Math.max(reach, Math.abs(pos(b).x - hp.x)); const side = Math.max(0.08, reach * 0.12);
  const lateralOf = ch => { const e = pos(ch[ch.length - 1]); return e.x - hp.x; };
  const sideName = x => (x < 0 ? 'L' : 'R');                                      // the model's negative x is its left (Meshy facing +z)
  let chestChain = null;
  for (const c of kids(hips)) {
    const ch = chainFrom(c), e = pos(ch[ch.length - 1]), last = ch[ch.length - 1], branches = kids(last).length > 1;
    if (branches) { chestChain = ch; continue; }                                    // runs up to the next branch: the spine to the chest
    const dx = e.x - hp.x, dy = e.y - hp.y, dz = e.z - hp.z;
    if (Math.abs(dx) > reach * 0.6) { const k = 'wing' + sideName(dx); if (parts[k].length) parts[k + '2'] = ch; else parts[k] = ch; }        // reaching out as far as anything: a wing (a butterfly has a front and a hind wing on each side)
    else if (Math.abs(dx) > side) parts['leg' + sideName(dx)] = ch;                                  // off to one side of the hips
    else if (Math.hypot(dx, dz) > reach * 0.1) parts.tail = ch;                                      // centred and trailing away
    else parts.other.push(ch);
  }
  if (chestChain) {
    parts.spine.push(...chestChain); const chest = chestChain[chestChain.length - 1], cp = pos(chest);
    for (const c of kids(chest)) {
      const ch = chainFrom(c), e = pos(ch[ch.length - 1]), dx = e.x - cp.x, dy = e.y - cp.y;
      if (Math.abs(dx) > reach * 0.6) { const k = 'wing' + sideName(dx); if (parts[k].length) parts[k + '2'] = ch; else parts[k] = ch; }                  // reaches out as far as anything: a wing
      else if (Math.abs(dx) > side * 1.5 && dy < -Math.abs(dx) * 0.6) parts['arm' + sideName(dx)] = ch;                                          // lateral and hanging down: an arm
      else { parts.head = ch[ch.length - 1]; parts.neck = ch.slice(0, -1); }
    }
  }
  parts.chest = chestChain ? chestChain[chestChain.length - 1] : hips; parts.unit = Math.max(0.05, pos(parts.chest).distanceTo(hp));                // a body-length yardstick, for clips that must work at any size
  // facing: from the tail tip toward the head, on the ground plane; with no tail, from the hips toward the head
  const tailTip = parts.tail.length ? pos(parts.tail[parts.tail.length - 1]) : null, headP = parts.head ? pos(parts.head) : pos(parts.chest);
  let F = tailTip ? new T.Vector3(hp.x - tailTip.x, 0, hp.z - tailTip.z) : new T.Vector3(headP.x - hp.x, 0, headP.z - hp.z);
  if (F.lengthSq() < 1e-6) F.set(0, 0, 1); F.normalize();
  const U = new T.Vector3(0, 1, 0), R = new T.Vector3().crossVectors(U, F).normalize();
  parts.axes = { F, U, R, B: F.clone().negate(), D: U.clone().negate(), L: R.clone().negate() };
  parts.count = { wingL2: parts.wingL2.length, wingR2: parts.wingR2.length, wingL: parts.wingL.length, wingR: parts.wingR.length, legL: parts.legL.length, legR: parts.legR.length, tail: parts.tail.length, neck: parts.neck.length, spine: parts.spine.length };
  return parts;
}

// ------------------------------------------------------------------ the engine: functions of time -> bone deltas -> a clip
// fn(t, c) fills c with: c.rot(bone, 'F'|'U'|'R', degrees) (about the model's axes), c.hipsY(m), c.hipsFwd(m), c.hipsSide(m)
export function creatureClip(built, parts, name, duration, fn, opts = {}) {
  const root = built.root, fps = opts.fps || 30, n = Math.max(2, Math.round(duration * fps) + 1), A = parts.axes, D2R = Math.PI / 180;
  root.updateMatrixWorld(true);
  const bones = []; root.traverse(o => { if (o.isBone) bones.push(o); });
  const restLocal = new Map(bones.map(b => [b, b.quaternion.clone()])), restPos = new Map(bones.map(b => [b, b.position.clone()])), parentOf = b => (b.parent && b.parent.isBone ? b.parent : null);
  const order = []; const seen = new Set(); const visit = b => { if (seen.has(b)) return; const p = parentOf(b); if (p) visit(p); seen.add(b); order.push(b); }; bones.forEach(visit);
  const restParentWorld = new Map(); for (const b of bones) restParentWorld.set(b, b.parent ? b.parent.getWorldQuaternion(new T.Quaternion()) : new T.Quaternion());
  const topBone = parts.top, topParentInv = topBone.parent ? topBone.parent.getWorldQuaternion(new T.Quaternion()).invert() : new T.Quaternion(), parentWorldM = topBone.parent ? topBone.parent.matrixWorld.clone() : new T.Matrix4(), parentInvM = parentWorldM.clone().invert();
  const times = [], vals = new Map(), topPos = [], used = new Set();
  const ax = a => (a === 'F' ? A.F : a === 'U' ? A.U : A.R);
  const tmpQ = new T.Quaternion();
  for (let f = 0; f < n; f++) {
    const t = Math.min(duration, f / fps); times.push(t);
    const deltas = new Map(), c = { y: 0, fwd: 0, side: 0, rot(b, axis, deg) { if (!b) return; let l = deltas.get(b); if (!l) deltas.set(b, l = []); l.push([axis, deg]); }, hipsY(v) { this.y += v; }, hipsFwd(v) { this.fwd += v; }, hipsSide(v) { this.side += v; } };
    fn(t, c);
    const posed = new Map();
    for (const b of order) {
      const p = parentOf(b), pq = p ? posed.get(p) : null;
      // where the bone would be if it just followed its parent
      let follow = p ? pq.clone().multiply(restLocal.get(b)) : (() => { const q = topParentInv.clone().invert().multiply(restLocal.get(b)); return q; })();
      const d = deltas.get(b);
      if (d) { const dq = new T.Quaternion(); for (const [a, deg] of d) { tmpQ.setFromAxisAngle(ax(a), deg * D2R); dq.premultiply(tmpQ); } follow = dq.multiply(follow); }
      posed.set(b, follow);
      if (d) { const parentW = p ? pq : topParentInv.clone().invert(); const loc = parentW.clone().invert().multiply(follow); let arr = vals.get(b); if (!arr) vals.set(b, arr = []); arr.push(loc.x, loc.y, loc.z, loc.w); used.add(b); }
    }
    // the body: the whole thing moves by an offset in the model's frame, applied to the top bone's position
    const off = new T.Vector3().addScaledVector(A.U, c.y).addScaledVector(A.F, c.fwd).addScaledVector(A.R, c.side).applyQuaternion(topParentInv);          // model units, into the parent's frame
    const rp = restPos.get(topBone); topPos.push(rp.x + off.x, rp.y + off.y, rp.z + off.z);
  }
  const tracks = [];
  for (const [b, arr] of vals) { if (arr.length / 4 === n) tracks.push(new T.QuaternionKeyframeTrack(b.name + '.quaternion', times, arr)); else if (arr.length) { /* a bone gets a delta on only some frames: fill with rest */ } }
  // bones that had a delta only on some frames would break the track; make every used bone key every frame
  for (const b of used) if (!vals.has(b) || vals.get(b).length / 4 !== n) throw new Error('creature clip ' + name + ': uneven track for ' + b.name);
  tracks.push(new T.VectorKeyframeTrack(topBone.name + '.position', times, topPos));
  return new T.AnimationClip(name, duration, tracks);
}

// ------------------------------------------------------------------ the clip set. Angles are degrees; the flap and sway use the same period as the clip length so loops close.
const TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos;
const ease = u => u * u * (3 - 2 * u), pulse = (t, a, b, c, d) => (t < a ? 0 : t < b ? ease((t - a) / (b - a)) : t < c ? 1 : t < d ? 1 - ease((t - c) / (d - c)) : 0);   // 0 -> 1 between a and b, hold to c, back to 0 at d
const chainRot = (c, chain, axis, fn) => { for (let i = 0; i < chain.length; i++) c.rot(chain[i], axis, fn(i, chain.length)); };
const sideSign = { L: -1, R: 1 };                                                     // for a rotation about F that lifts the wing on each side

export function creatureClips(built, parts) {
  const P = parts, out = new Map(), mk = (name, dur, fn) => { try { out.set(name, creatureClip(built, parts, name, dur, fn)); } catch (e) { console.error('creature clip failed', name, e); } };
  const wings = (c, up, spread, ph, lag) => {                                          // up: degrees the wing root lifts; spread: extra bend per joint; ph: phase; lag: joint lag in radians
    for (const s of ['L', 'R']) { const ch = P['wing' + s]; ch.forEach((b, i) => { const a = (i === 0 ? 1 : 0.7 - i * 0.12) * up(ph - i * lag) + spread * i; c.rot(b, 'F', sideSign[s] * a); }); }
  };
  const legsTucked = (c, deg) => { for (const s of ['L', 'R']) P['leg' + s].forEach((b, i) => c.rot(b, 'R', i === 0 ? -deg : i === 1 ? deg * 1.2 : -deg * 0.4)); };
  const tailSway = (c, a, ph, pitchA) => P.tail.forEach((b, i) => { c.rot(b, 'U', a * sin(ph - i * 0.5) * (0.5 + i * 0.15)); c.rot(b, 'R', pitchA * sin(ph * 1 - i * 0.6 + 1.2)); });
  const neckS = (c, a, ph) => P.neck.forEach((b, i) => c.rot(b, 'R', a * sin(ph - i * 0.5)));

  mk('idle', 2.4, (t, c) => {                                                         // breathing, a slow tail sway, wings settling
    const ph = TAU * t / 2.4; c.hipsY(0.012 * sin(ph)); P.spine.forEach(b => c.rot(b, 'R', 1.4 * sin(ph + 0.4)));
    tailSway(c, 7, ph, 3); neckS(c, 3, ph + 0.8); wings(c, p => 4 * sin(p), 0, ph, 0.5);
  });
  mk('fly', 0.8, (t, c) => {                                                          // a hover with a full wing beat: down fast, up slow, tips lagging, the body rising on the downstroke
    const ph = TAU * t / 0.8, beat = p => 52 * sin(p) + 8, bob = sin(ph - 0.5);
    wings(c, beat, 14, ph, 0.55); c.hipsY(0.10 * bob); P.spine.forEach(b => c.rot(b, 'R', 3 * sin(ph + 1.0)));
    tailSway(c, 9, ph * 1, 12); neckS(c, 5, ph - 0.7); legsTucked(c, 32);
  });
  mk('walk', 0.9, (t, c) => {                                                         // wings folded, legs alternate, the body bobs twice a cycle
    const ph = TAU * t / 0.9; c.hipsY(0.025 * sin(2 * ph));
    for (const s of ['L', 'R']) { const k = s === 'L' ? 0 : Math.PI; P['leg' + s].forEach((b, i) => c.rot(b, 'R', (i === 0 ? 24 : i === 1 ? -16 : 10) * sin(ph + k + i * 0.35))); }
    wings(c, () => -62, -8, ph, 0); tailSway(c, 11, ph, 3); neckS(c, 4, ph + 1.2);
  });
  mk('attack', 0.7, (t, c) => {                                                       // anticipation: coil back; lunge: neck and body shoot forward; bite snaps; recover
    const coil = pulse(t, 0.0, 0.18, 0.2, 0.2), lunge = pulse(t, 0.18, 0.3, 0.38, 0.7), snap = pulse(t, 0.3, 0.38, 0.4, 0.55);
    c.hipsFwd(-0.1 * coil + 0.4 * lunge); c.hipsY(0.06 * lunge); P.spine.forEach(b => c.rot(b, 'R', -8 * coil + 12 * lunge));
    P.neck.forEach((b, i) => c.rot(b, 'R', 24 * coil - 40 * lunge)); if (P.head) c.rot(P.head, 'R', -20 * snap + 8 * coil);
    wings(c, () => 30 * lunge + 10 * coil, 0, 0, 0); tailSway(c, 18 * lunge, 1.0, 6 * lunge); legsTucked(c, 18 * lunge);
  });
  mk('breath', 1.1, (t, c) => {                                                       // neck rears back, holds, then throws forward as the breath leaves
    const back = pulse(t, 0.0, 0.4, 0.5, 0.52), fwd = pulse(t, 0.5, 0.62, 0.8, 1.1);
    P.neck.forEach(b => c.rot(b, 'R', 34 * back - 30 * fwd)); if (P.head) c.rot(P.head, 'R', 14 * back - 12 * fwd); c.hipsFwd(-0.08 * back + 0.14 * fwd);
    wings(c, () => 26 * (back + fwd), 0, 0, 0); P.spine.forEach(b => c.rot(b, 'R', -4 * back + 6 * fwd)); tailSway(c, 8, 1, 4);
  });
  mk('hurt', 0.35, (t, c) => {                                                        // a hit from the front: snap back, wings flinch, tail whips, settle
    const k = pulse(t, 0.0, 0.07, 0.1, 0.35), ph = TAU * t / 0.35;
    c.hipsFwd(-0.16 * k); c.hipsY(-0.04 * k); P.spine.forEach(b => c.rot(b, 'R', 10 * k)); P.neck.forEach(b => c.rot(b, 'R', 16 * k)); wings(c, () => -22 * k, 0, 0, 0); tailSway(c, 22 * k, ph * 2, 0);
  });
  mk('arrive', 0.8, (t, c) => {                                                       // summoned: crouch low with wings shut, burst up and open them, overshoot, settle
    const crouch = 1 - ease(Math.min(1, t / 0.25)), burst = pulse(t, 0.25, 0.4, 0.45, 0.8);
    c.hipsY(-0.25 * crouch + 0.22 * burst); wings(c, () => -70 * crouch + 60 * burst, 0, 0, 0); P.neck.forEach(b => c.rot(b, 'R', 14 * crouch - 12 * burst)); legsTucked(c, 25 * crouch);
  });
  mk('defeat', 1.4, (t, c) => {                                                       // wings fold, body sinks and tips, head drops; stays down
    const k = ease(Math.min(1, t / 1.0));
    c.hipsY(-0.35 * k); c.hipsFwd(0.05 * k); P.spine.forEach(b => c.rot(b, 'R', 14 * k)); P.neck.forEach(b => c.rot(b, 'R', 32 * k)); wings(c, () => -88 * k, 0, 0, 0); legsTucked(c, 40 * k); tailSway(c, 0, 0, 0); P.tail.forEach(b => c.rot(b, 'R', -6 * k));
  });
  if (P.wingL.length && P.wingR.length) {                                              // anything with wings can also flutter and perch (butterflies, moths, small fliers)
    const u = P.unit, W2 = (c, a, ph) => { for (const s of ['L', 'R']) { const ch = P['wing' + s + '2']; ch.forEach((b, i) => c.rot(b, 'F', sideSign[s] * (a(ph - 0.9 - i * 0.3) * (i === 0 ? 1 : 0.6)))); } };
    mk('flutter', 0.36, (t, c) => {                                                    // a fast beat, front and hind wings a little apart, the body riding the beat and swaying
      const ph = TAU * t / 0.36, a = p => 62 * sin(p) + 6; wings(c, a, 8, ph, 0.5); W2(c, a, ph); c.hipsY(0.14 * u * sin(ph - 0.4)); P.spine.forEach(b => c.rot(b, 'R', 6 * sin(ph + 1.0))); c.rot(P.head, 'R', 5 * sin(ph - 1.0));
    });
    mk('glide', 1.8, (t, c) => {                                                       // wings held up and shallow, one slow beat now and then
      const ph = TAU * t / 1.8, a = p => 26 + 14 * sin(p); wings(c, a, 4, ph, 0.4); W2(c, a, ph); c.hipsY(0.05 * u * sin(ph - 0.5));
    });
    mk('perch', 3.0, (t, c) => {                                                       // resting: wings slowly lift and close, a tiny body breath
      const ph = TAU * t / 3.0, a = p => 28 + 24 * sin(p); wings(c, a, 4, ph, 0.25); W2(c, a, ph); c.hipsY(0.01 * u * sin(ph * 2)); P.neck.forEach(b => c.rot(b, 'R', 2 * sin(ph)));
    });
  }
  return out;
}

// ------------------------------------------------------------------ loading: read the file once, then make as many creatures as the game needs
export async function loadCreature(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) return null;
    const prep = await prepareRig(await r.arrayBuffer(), { creature: true }), first = instantiateRig(prep, { creature: true }), parts = classifyCreature(first.root);
    if (!parts) return null; prep.creatureClips = creatureClips(first, parts); return prep;                  // clips address bones by name, so every instance shares them
  } catch (e) { console.error('creature load failed', url, e); return null; }
}
export function makeCreature(prep, size) {
  const built = instantiateRig(prep, { creature: true }), parts = classifyCreature(built.root); return new CreatureRig(built, parts, prep.creatureClips, { height: size });
}

// ------------------------------------------------------------------ the runtime: one mixer per creature
export class CreatureRig {
  constructor(built, parts, clips, { height = 1 } = {}) {
    this.root = built.root; this.parts = parts; this.clips = clips; this.mixer = new T.AnimationMixer(this.root); this.acts = new Map(); this.cur = null; this.hold = 0;
    this.group = new T.Group(); this.group.add(this.root);
    // the size the game asks for is the biggest dimension of the model
    const box = new T.Box3().setFromObject(this.root), s = box.getSize(new T.Vector3()); this.dim = Math.max(s.x, s.y, s.z) || 1; this.setSize(height);
  }
  setSize(m) { this.root.scale.setScalar(m / this.dim); }
  _act(name) { let a = this.acts.get(name); if (!a) { const c = this.clips.get(name); if (!c) return null; a = this.mixer.clipAction(c); this.acts.set(name, a); } return a; }
  play(name, { fade = 0.15, once = false } = {}) {
    const a = this._act(name); if (!a) return false; if (this.cur === a) return true;
    a.reset(); a.setLoop(once ? T.LoopOnce : T.LoopRepeat, Infinity); a.clampWhenFinished = once; a.fadeIn(fade).play(); if (this.cur) this.cur.fadeOut(fade); this.cur = a; this.curName = name; this.hold = once && name !== 'defeat' ? a.getClip().duration - 0.1 : 0; return true;
  }
  // state: 'idle' | 'fly' | 'walk'; trigger: a one-shot name or null
  update(state, dt, trigger) {
    if (trigger) this.play(trigger, { fade: 0.06, once: true }); else if (this.hold > 0) this.hold -= dt; else this.play(state, { fade: state === 'idle' ? 0.2 : 0.12 });
    this.mixer.update(dt);
  }
}
