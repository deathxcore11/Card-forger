// Hand-made animation clips written as a few key poses, so they cost no credits and are tuned in code. A key pose says where each limb points
// ("the right arm points up and forward") and the engine works out the bone rotations, so no one has to know the rig's bone axes.
// Directions are in the model's own frame: F forward, B back, U up, D down, L the duelist's left, R the duelist's right, mixed with weights.
// Frames are made at 30 per second with easing between keys. Only bones a clip mentions get tracks (the rest keep what other clips set).
const T = window.THREE;

const AIM_BONES = ['Spine', 'Spine01', 'Spine02', 'neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
const CHILD = { Spine: 'Spine01', Spine01: 'Spine02', Spine02: 'neck', neck: 'Head', Head: 'head_end', LeftShoulder: 'LeftArm', LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand', LeftHand: 'LeftHandMiddle1', RightShoulder: 'RightArm', RightArm: 'RightForeArm', RightForeArm: 'RightHand', RightHand: 'RightHandMiddle1', LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', LeftFoot: 'LeftToeBase', RightUpLeg: 'RightLeg', RightLeg: 'RightFoot', RightFoot: 'RightToeBase' };
const UPPER_BONES = ['Spine', 'Spine01', 'Spine02', 'neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'];
const ease = u => u * u * (3 - 2 * u);

// Canonical bone names -> this rig's bones. Meshy rigs come with different naming (Kael: Spine02, neck; Mira: mixamorig:Spine2, Neck), so every
// clip is written against the canonical names and each rig is looked up once here. A bone the rig lacks is simply skipped.
const norm = s => String(s).replace(/^mixamorig[_:]?/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ALIAS = { Spine01: ['spine01', 'spine1'], Spine02: ['spine02', 'spine2'], neck: ['neck'], head_end: ['headend', 'headtopend'], headfront: ['headfront'], LeftToeBase: ['lefttoebase'], RightToeBase: ['righttoebase'] };
export function boneMap(root) {
  const byNorm = new Map(); root.traverse(o => { if (o.isBone) byNorm.set(norm(o.name), o); });
  const want = [...AIM_BONES, 'Hips', 'head_end', 'headfront', 'LeftHandMiddle1', 'RightHandMiddle1', 'LeftToeBase', 'RightToeBase'], map = {};
  for (const c of want) { const keys = ALIAS[c] || [norm(c)]; for (const k of keys) { const o = byNorm.get(k); if (o) { map[c] = o; break; } } }
  // some rigs number the spine from the top (Kael: Spine02 is the lowest, Spine the highest), so the three spine bones are assigned by depth in the hierarchy, lowest first
  const sp = [...byNorm.entries()].filter(([k]) => /^spine(0?[0-2])?$/.test(k)).map(([, o]) => o), depth = o => { let d = 0; for (let q = o; q.parent; q = q.parent) d++; return d; };
  if (sp.length === 3) { sp.sort((a, b) => depth(a) - depth(b)); map.Spine = sp[0]; map.Spine01 = sp[1]; map.Spine02 = sp[2]; }
  return map;
}

export function makeAxes(root, map) {                                             // F, U, R from the rest skeleton: up is +Y, right runs from the left shoulder to the right
  map = map || boneMap(root); const get = n => map[n], w = o => o.getWorldPosition(new T.Vector3());
  root.updateMatrixWorld(true);
  const U = new T.Vector3(0, 1, 0), R = w(get('RightShoulder')).sub(w(get('LeftShoulder'))); R.y = 0; R.normalize();
  const F = new T.Vector3().crossVectors(R, U).normalize();
  const head = get('Head'), nose = get('headfront'); if (nose) { const f = w(nose).sub(w(head)); f.y = 0; if (f.lengthSq() > 1e-6 && f.normalize().dot(F) < 0) F.negate(); }
  return { F, B: F.clone().negate(), U, D: U.clone().negate(), R, L: R.clone().negate() };
}
const dirOf = (axes, spec) => { const v = new T.Vector3(); for (const [k, s] of Object.entries(spec)) v.addScaledVector(axes[k], s); return v.normalize(); };

// built: the rig from buildRig. keys: [{ t, aim: { Bone: { F: 1, U: .5 } }, hipsY: metres, hipsRot: [x, y, z degrees], hipsFwd: metres }].
export function procClip(built, name, duration, keys, opts = {}) {
  const root = built.root, map = boneMap(root), fps = opts.fps || 30, n = Math.max(2, Math.round(duration * fps) + 1), axes = makeAxes(root, map);
  const get = nm => map[nm], canon = new Map(Object.entries(map).map(([k, o]) => [o.name, k]));
  root.updateMatrixWorld(true); const rest = {};
  for (const b of AIM_BONES) { const o = get(b), c = get(CHILD[b]); if (!o) continue; const q = o.getWorldQuaternion(new T.Quaternion()), p = o.getWorldPosition(new T.Vector3()); rest[b] = { o, q, dir: c ? c.getWorldPosition(new T.Vector3()).sub(p).normalize() : new T.Vector3(0, 1, 0), parent: o.parent && o.parent.isBone ? (canon.get(o.parent.name) || null) : null }; }
  const hips = get('Hips'), hipsRest = hips.position.clone(), hipsRestQ = hips.getWorldQuaternion(new T.Quaternion());
  const hipsParentInv = hips.parent ? hips.parent.getWorldQuaternion(new T.Quaternion()).invert() : new T.Quaternion();
  const used = new Set(); for (const k of keys) for (const b of Object.keys(k.aim || {})) used.add(b);
  const order = AIM_BONES.filter(b => rest[b]);
  const bones = new Set(opts.bones || used);
  const times = [], vals = {}, hipsPos = [], hipsQ = []; for (const b of bones) vals[b] = [];
  const at = t => { let i = 0; while (i < keys.length - 2 && t >= keys[i + 1].t) i++; const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)], span = b.t - a.t, u = span > 0 ? ease(Math.min(1, Math.max(0, (t - a.t) / span))) : 1; return { a, b, u }; };
  const zero = [0, 0, 0], D2R = Math.PI / 180;
  for (let f = 0; f < n; f++) {
    const t = Math.min(duration, f / fps); times.push(t); const { a, b, u } = at(t);
    const ra = a.hipsRot || zero, rb = b.hipsRot || zero, hRot = ra.map((v, i) => v + (rb[i] - v) * u);
    const hY = (a.hipsY || 0) + ((b.hipsY || 0) - (a.hipsY || 0)) * u, hF = (a.hipsFwd || 0) + ((b.hipsFwd || 0) - (a.hipsFwd || 0)) * u;
    // the rotation about the model's right axis (pitch) uses the character's own right, so "lean forward" means forward for him
    const pitch = new T.Quaternion().setFromAxisAngle(axes.R, hRot[0] * D2R), yaw = new T.Quaternion().setFromAxisAngle(axes.U, hRot[1] * D2R), roll = new T.Quaternion().setFromAxisAngle(axes.F, hRot[2] * D2R);
    const hipsWorldQ = yaw.multiply(pitch).multiply(roll).multiply(hipsRestQ);
    const hl = hipsParentInv.clone().multiply(hipsWorldQ);
    hipsPos.push(hipsRest.x + axes.F.x * hF, hipsRest.y + hY, hipsRest.z + axes.F.z * hF); hipsQ.push(hl.x, hl.y, hl.z, hl.w);
    const posed = {};
    for (const bn of order) {
      const r = rest[bn], pq = r.parent ? (posed[r.parent] || (rest[r.parent] ? rest[r.parent].q : hipsWorldQ)) : hipsWorldQ;
      let wq;
      const A = a.aim && a.aim[bn], B = b.aim && b.aim[bn];
      if (A || B) { const d = dirOf(axes, A || B).lerp(dirOf(axes, B || A), u).normalize(); wq = new T.Quaternion().setFromUnitVectors(r.dir, d).multiply(r.q); }
      else { const parentRest = r.parent && rest[r.parent] ? rest[r.parent].q : hipsRestQ; wq = pq.clone().multiply(parentRest.clone().invert()).multiply(r.q); }      // follows its parent
      posed[bn] = wq;
      if (bones.has(bn)) { const loc = pq.clone().invert().multiply(wq); vals[bn].push(loc.x, loc.y, loc.z, loc.w); }
    }
  }
  const tracks = [];
  for (const bn of bones) if (vals[bn] && vals[bn].length && map[bn]) tracks.push(new T.QuaternionKeyframeTrack(map[bn].name + '.quaternion', times, vals[bn]));
  if (!opts.noHips) { tracks.push(new T.VectorKeyframeTrack(hips.name + '.position', times, hipsPos)); tracks.push(new T.QuaternionKeyframeTrack(hips.name + '.quaternion', times, hipsQ)); }
  return new T.AnimationClip(name, duration, tracks);
}

// ------------------------------------------------------------------ the clips: key poses to tune. Legs: both feet planted unless a key says otherwise.
const arm = (side, spec, fore) => ({ [side + 'Arm']: spec, [side + 'ForeArm']: fore || spec });
const stand = { Spine: { U: 1 }, ...arm('Right', { R: 0.35, D: 1 }), ...arm('Left', { L: 0.35, D: 1 }), Head: { U: 1 }, LeftUpLeg: { D: 1 }, LeftLeg: { D: 1 }, RightUpLeg: { D: 1 }, RightLeg: { D: 1 } };
const crouch = { LeftUpLeg: { F: 0.8, D: 0.8 }, LeftLeg: { B: 0.8, D: 1 }, RightUpLeg: { F: 0.8, D: 0.8 }, RightLeg: { B: 0.8, D: 1 } };
const ARMS_UP = { ...arm('Right', { U: 1, R: 0.25 }, { U: 1, R: 0.1 }), ...arm('Left', { U: 1, L: 0.25 }, { U: 1, L: 0.1 }) };
export const PROC = {
  hurt: { dur: 0.45, keys: [{ t: 0, aim: stand }, { t: 0.07, hipsY: -0.04, hipsRot: [-14, 0, 0], aim: { ...stand, Spine: { U: 1, B: 0.3 }, Spine02: { U: 1, B: 0.5 }, Head: { U: 1, B: 0.6 }, ...arm('Right', { R: 1, U: 0.7, F: 0.4 }), ...arm('Left', { L: 1, D: 0.2, B: 0.3 }) } }, { t: 0.45, aim: stand }] },
  throw_card: { dur: 0.5, upper: true, keys: [{ t: 0, aim: stand }, { t: 0.12, aim: { ...stand, Spine02: { U: 1, L: 0.3 }, ...arm('Right', { R: 0.5, B: 0.8, U: 0.3 }, { R: 0.7, U: 0.5, B: 0.3 }) } }, { t: 0.24, aim: { ...stand, Spine02: { U: 1, R: 0.25, F: 0.1 }, ...arm('Right', { F: 1, R: 0.3, U: 0.1 }, { F: 1, R: 0.2 }) } }, { t: 0.5, aim: stand }] },
  land_light: { dur: 0.45, keys: [{ t: 0, aim: stand }, { t: 0.12, hipsY: -0.22, hipsRot: [10, 0, 0], aim: { ...stand, ...crouch, Spine: { U: 1, F: 0.3 } } }, { t: 0.45, aim: stand }] },
  land_heavy: { dur: 0.9, keys: [{ t: 0, aim: stand }, { t: 0.14, hipsY: -0.5, hipsRot: [18, 0, 0], aim: { ...stand, ...crouch, Spine: { U: 1, F: 0.8 }, ...arm('Right', { F: 0.4, D: 1 }), ...arm('Left', { L: 0.5, D: 1 }) } }, { t: 0.5, hipsY: -0.48, hipsRot: [16, 0, 0], aim: { ...stand, ...crouch, Spine: { U: 1, F: 0.8 } } }, { t: 0.9, aim: stand }] },
  dash: { dur: 0.4, keys: [{ t: 0, aim: stand }, { t: 0.08, hipsY: -0.12, hipsRot: [32, 0, 0], aim: { ...stand, Spine: { U: 1, F: 0.6 }, Head: { F: 1, U: 0.3 }, ...arm('Right', { B: 1, D: 0.4 }), ...arm('Left', { B: 1, D: 0.4 }), LeftUpLeg: { B: 0.9, D: 0.8 }, LeftLeg: { B: 0.4, D: 1 }, RightUpLeg: { F: 0.9, D: 0.5 }, RightLeg: { B: 0.8, D: 0.6 } } }, { t: 0.3, hipsY: -0.1, hipsRot: [28, 0, 0], aim: { ...stand, Spine: { U: 1, F: 0.6 }, ...arm('Right', { B: 1, D: 0.4 }), ...arm('Left', { B: 1, D: 0.4 }) } }, { t: 0.4, aim: stand }] },
  slide: { dur: 0.8, keys: [{ t: 0, aim: stand }, { t: 0.15, hipsY: -0.55, hipsRot: [-45, 0, 0], aim: { ...stand, LeftUpLeg: { F: 1, D: 0.2 }, LeftLeg: { F: 1, D: 0.2 }, RightUpLeg: { F: 0.5, D: 0.3, R: 0.3 }, RightLeg: { B: 0.8, D: 0.6 }, Spine: { U: 1, B: 0.5 }, ...arm('Right', { R: 0.9, B: 0.4, D: 0.3 }), ...arm('Left', { F: 0.7, U: 0.5 }) } }, { t: 0.6, hipsY: -0.55, hipsRot: [-45, 0, 0], aim: { ...stand, LeftUpLeg: { F: 1, D: 0.2 }, LeftLeg: { F: 1, D: 0.2 }, RightUpLeg: { F: 0.5, D: 0.3, R: 0.3 }, RightLeg: { B: 0.8, D: 0.6 }, Spine: { U: 1, B: 0.5 } } }, { t: 0.8, aim: stand }] },
  summon: { dur: 1.2, keys: [{ t: 0, aim: stand }, { t: 0.3, hipsY: -0.1, aim: { ...stand, Spine: { U: 1, F: 0.5 }, ...arm('Right', { F: 0.6, D: 1 }, { F: 0.7, D: 0.9 }), ...arm('Left', { L: 0.6, D: 0.5 }) } }, { t: 0.45, hipsY: -0.18, aim: { ...stand, Spine: { U: 1, F: 0.7 }, ...arm('Right', { F: 0.5, D: 1 }, { D: 1, F: 0.3 }) } }, { t: 1.0, hipsY: 0.02, hipsRot: [-8, 0, 0], aim: { ...stand, Spine: { U: 1, B: 0.2 }, ...arm('Right', { U: 1, F: 0.3 }, { U: 1, F: 0.2 }), ...arm('Left', { L: 0.7, U: 0.4 }), Head: { U: 1, B: 0.4 } } }, { t: 1.2, aim: stand }] },
  fusion: { dur: 1.6, keys: [{ t: 0, aim: stand }, { t: 0.5, aim: { ...stand, ...arm('Right', { R: 1, U: 0.15 }), ...arm('Left', { L: 1, U: 0.15 }) } }, { t: 0.9, hipsRot: [-12, 0, 0], aim: { ...stand, Spine: { U: 1, B: 0.25 }, Head: { U: 1, B: 0.5 }, ...arm('Right', { U: 1, L: 0.1 }, { U: 1, L: 0.3 }), ...arm('Left', { U: 1, R: 0.1 }, { U: 1, R: 0.3 }) } }, { t: 1.4, hipsRot: [-14, 0, 0], aim: { ...stand, Spine: { U: 1, B: 0.3 }, Head: { U: 1, B: 0.6 }, ...arm('Right', { U: 1, L: 0.1 }, { U: 1, L: 0.3 }), ...arm('Left', { U: 1, R: 0.1 }, { U: 1, R: 0.3 }) } }, { t: 1.6, aim: stand }] },
  tribute: { dur: 1.4, keys: [{ t: 0, aim: stand }, { t: 0.35, hipsRot: [10, 0, 0], aim: { ...stand, Spine: { U: 1, F: 0.35 }, Head: { F: 0.8, D: 0.6 }, ...arm('Right', { F: 0.8, D: 0.5, L: 0.3 }, { F: 0.4, U: 0.8, L: 0.6 }), ...arm('Left', { F: 0.3, D: 1 }) } }, { t: 1.1, hipsRot: [8, 0, 0], aim: { ...stand, Spine: { U: 1, F: 0.3 }, Head: { F: 0.8, D: 0.6 }, ...arm('Right', { R: 0.8, F: 0.4, D: 0.2 }, { R: 1, F: 0.3 }), ...arm('Left', { L: 0.4, D: 1 }) } }, { t: 1.4, aim: stand }] },
  victory: { dur: 2.5, keys: [{ t: 0, aim: stand }, { t: 0.3, hipsY: -0.08, aim: { ...stand, ...arm('Right', { R: 0.5, D: 1 }) } }, { t: 0.6, hipsY: 0.08, hipsRot: [-6, 0, 0], aim: { ...stand, Spine: { U: 1, B: 0.15 }, ...arm('Right', { U: 1, R: 0.2 }, { U: 1 }), Head: { U: 1, B: 0.2 } } }, { t: 1.5, hipsY: 0.02, aim: { ...stand, Spine: { U: 1, B: 0.1 }, ...arm('Right', { U: 1, R: 0.3 }, { U: 1, R: 0.1 }), ...arm('Left', { U: 1, L: 0.5 }, { U: 1, L: 0.3 }), Head: { U: 1, F: 0.2 } } }, { t: 2.5, aim: { ...stand, ...arm('Right', { U: 1, R: 0.3 }, { U: 1, R: 0.1 }) } }] },
  level_up: { dur: 1.2, keys: [{ t: 0, aim: stand }, { t: 0.25, hipsY: -0.3, hipsRot: [15, 0, 0], aim: { ...stand, ...crouch, Spine: { U: 1, F: 0.5 }, ...arm('Right', { B: 0.7, D: 0.6 }), ...arm('Left', { B: 0.7, D: 0.6 }) } }, { t: 0.55, hipsY: 0.12, hipsRot: [-8, 0, 0], aim: { ...stand, Spine: { U: 1, B: 0.2 }, ...ARMS_UP, Head: { U: 1, B: 0.5 } } }, { t: 1.2, aim: stand }] },
  open_chest: { dur: 1.5, keys: [{ t: 0, aim: stand }, { t: 0.4, hipsY: -0.55, hipsRot: [14, 0, 0], aim: { ...stand, LeftUpLeg: { F: 0.9, D: 0.6 }, LeftLeg: { B: 0.9, D: 1 }, RightUpLeg: { F: 0.1, D: 1, R: 0.2 }, RightLeg: { B: 0.3, D: 1 }, Spine: { U: 1, F: 0.4 }, ...arm('Right', { F: 0.9, D: 0.4 }), ...arm('Left', { F: 0.9, D: 0.4 }) } }, { t: 0.9, hipsY: -0.55, hipsRot: [14, 0, 0], aim: { ...stand, LeftUpLeg: { F: 0.9, D: 0.6 }, LeftLeg: { B: 0.9, D: 1 }, RightUpLeg: { F: 0.1, D: 1, R: 0.2 }, RightLeg: { B: 0.3, D: 1 }, Spine: { U: 1, F: 0.3 }, ...arm('Right', { F: 0.5, U: 0.9 }, { U: 1, F: 0.3 }), ...arm('Left', { F: 0.5, U: 0.9 }, { U: 1, F: 0.3 }) } }, { t: 1.5, aim: stand }] },
  shrine_channel: { dur: 3, keys: [{ t: 0, aim: { ...stand, ...arm('Right', { F: 0.8, R: 0.3, U: 0.1 }), ...arm('Left', { F: 0.8, L: 0.3, U: 0.1 }) } }, { t: 1.5, hipsY: -0.03, aim: { ...stand, Spine: { U: 1, F: 0.1 }, ...arm('Right', { F: 1, R: 0.2, U: 0.2 }), ...arm('Left', { F: 1, L: 0.2, U: 0.2 }) } }, { t: 3, aim: { ...stand, ...arm('Right', { F: 0.8, R: 0.3, U: 0.1 }), ...arm('Left', { F: 0.8, L: 0.3, U: 0.1 }) } }] },
  cast_spell: { dur: 0.9, keys: [{ t: 0, aim: stand }, { t: 0.25, aim: { ...stand, Spine: { U: 1, B: 0.15 }, ...arm('Right', { F: 0.4, U: 0.6, R: 0.3 }), ...arm('Left', { F: 0.4, U: 0.6, L: 0.3 }) } }, { t: 0.45, hipsY: -0.06, aim: { ...stand, Spine: { U: 1, F: 0.3 }, ...arm('Right', { F: 1, R: 0.1 }), ...arm('Left', { F: 1, L: 0.1 }) } }, { t: 0.9, aim: stand }] },
  taunt: { dur: 1.5, keys: [{ t: 0, aim: stand }, { t: 0.35, aim: { ...stand, Spine: { U: 1, F: 0.1 }, ...arm('Right', { F: 1, U: 0.1 }, { F: 1, U: 0.1 }) } }, { t: 0.9, aim: { ...stand, Spine: { U: 1, B: 0.1 }, ...arm('Right', { F: 0.7, R: 0.4, U: 0.4 }, { F: 0.4, U: 1 }) } }, { t: 1.5, aim: stand }] }
};

// Builds every clip above for a rig, keyed by name. The caller keeps any real clip of the same name.
export function buildProcClips(built) {
  const out = new Map();
  for (const [name, c] of Object.entries(PROC)) {
    try {
      const bones = c.upper ? UPPER_BONES : AIM_BONES;
      out.set(name, procClip(built, name, c.dur, c.keys, c.upper ? { bones, noHips: true } : { bones }));
    } catch (e) { console.error('proc clip failed', name, e); }
  }
  return out;
}
