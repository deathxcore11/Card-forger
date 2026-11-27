// The rider on the card, posed in code bone by bone (owner, 27 Nov: "animate like he's on it"). View only: it reads the ride state.
// The rig's mixer runs first (its Idle clip); this layer then turns bones about axes given in the rider's own frame (x right, y up, z forward of the stance),
// so every number below reads the same whatever each bone's rest orientation is. Every target is blended over about 0.12 s, so no pose pops.
const T = window.THREE;
const qA = new T.Quaternion(), qP = new T.Quaternion(), qPi = new T.Quaternion(), qF = new T.Quaternion(), qY = new T.Quaternion(), vAx = new T.Vector3(), UP = new T.Vector3(0, 1, 0);
const AX = { x: new T.Vector3(1, 0, 0), y: new T.Vector3(0, 1, 0), z: new T.Vector3(0, 0, 1) };
// the channels: each is an angle in radians, blended
const KEYS = ['side', 'hipsDrop', 'thighL', 'thighR', 'kneeL', 'kneeR', 'spreadL', 'spreadR', 'spineX', 'spineZ', 'twist', 'armL', 'armR', 'armFwdL', 'armFwdR', 'elbowL', 'elbowR', 'headY', 'lift'];
export const POSE_TUNE = { side: 1.15, sign: { thigh: -1, knee: 1, spread: 1, arm: 1, spineX: 1 } };       // side-on angle; signs found by eye from the play camera
export function makeRidePose() { const s = {}; for (const k of KEYS) s[k] = 0; return { cur: s, bones: null, landT: 0, wasG: true, lastH: null, lean: 0 }; }
function bonesOf(R) { const b = {}; R.root.traverse(o => { if (o.isBone) b[o.name] = o; }); return b; }
// the target pose for this frame, from the ride state
function target(rd, p, st, dt) {
  const S = POSE_TUNE.sign, t = {}; for (const k of KEYS) t[k] = 0;
  const crouch = Math.min(1, (rd.crouch || 0) / 0.6), land = st.landT > 0 ? Math.sin(Math.PI * (1 - st.landT / 0.3)) : 0;
  // base stance: side-on across the card, feet at shoulder width, knees bent about 30 degrees, hips low, arms out, the head toward travel
  t.side = POSE_TUNE.side; t.headY = -POSE_TUNE.side * 0.85; t.thighL = t.thighR = 0.45 + 0.55 * crouch + 0.5 * land; t.kneeL = t.kneeR = 0.6 + 0.9 * crouch + 0.8 * land; t.hipsDrop = 0.12 + 0.18 * crouch + 0.16 * land;
  t.spreadL = t.spreadR = 0.22; t.armL = t.armR = 1.05 - 0.6 * land; t.elbowL = t.elbowR = 0.25; t.spineX = 0.18 + 0.2 * crouch;
  // lean into a carve: hips and shoulders tilt toward the turn, up to about 20 degrees
  t.spineZ = st.lean;
  if (rd.flipT > 0) { const k = Math.sin(Math.PI * (1 - rd.flipT / 0.42)); t.thighL = t.thighR = 1.5 * k + 0.6; t.kneeL = t.kneeR = 2.1 * k + 0.6; t.hipsDrop = 0.12 + 0.5 * k; t.armL = t.armR = 0.6; t.spineX = 0.5; }       // a flip: knees to the chest, the feet hover just over the card and catch it
  else if (rd.grabbing) { const n = rd.grabName; t.thighL = t.thighR = 1.2; t.kneeL = t.kneeR = 1.7; t.spineX = 0.75; t.hipsDrop = 0.3;
    if (n === 'Melon' || n === 'Method') { t.armL = 0.2; t.armFwdL = -0.9; t.elbowL = 0.2; t.armR = 1.3; } else { t.armR = 0.2; t.armFwdR = n === 'Nosegrab' ? 1.1 : 0.9; t.elbowR = 0.2; t.armL = 1.3; }       // the hand reaches the card's edge: back hand for a Melon and a Method, front hand for an Indy and a Nosegrab
    if (n === 'Method') t.spineZ += 0.35; }
  if (Math.abs(rd.spin || 0) > 0.2 && !p.grounded) t.twist = Math.max(-0.7, Math.min(0.7, (rd.spinVel || 0) * 0.08));       // a spin: the shoulders lead, the hips follow
  if (rd.grind) { t.armL = t.armR = 1.4; t.kneeL = t.kneeR = 0.9; t.thighL = t.thighR = 0.6; t.spineZ = Math.max(-1, Math.min(1, rd.bal || 0)) * 0.2; }       // a grind: arms wide, balanced
  if (rd.manual) { t.spineX = -0.25; t.armL = t.armR = 1.3; t.armFwdL = t.armFwdR = 0.4; t.thighL = 0.2; t.kneeL = 0.3; }       // a manual: back on the tail, arms forward for balance
  if (p.grounded && !rd.grind && !rd.manual) { const sw = Math.sin(st.t * 1.6) * 0.05; t.spineZ += sw; t.armL += sw; t.armR -= sw; }       // idle sway, never a stiff stand
  return t;
}
// rotate bone b by angle a about the rider-frame axis ax (with the stance's side turn optionally included in the frame)
function turn(b, ax, a, frame) {
  if (!b || !a) return; b.parent.getWorldQuaternion(qP); qPi.copy(qP).invert(); vAx.copy(AX[ax]).applyQuaternion(frame); qA.setFromAxisAngle(vAx, a);
  b.quaternion.premultiply(qP).premultiply(qA).premultiply(qPi);
}
// apply after the rig's own update. R: the rig; rd: the ride; p: the player; st: makeRidePose(); dt: seconds
export function applyRidePose(R, rd, p, st, dt, t) {
  if (!st.bones) st.bones = bonesOf(R); const B = st.bones; st.t = t;
  if (p.grounded && !st.wasG) st.landT = 0.3; st.wasG = p.grounded; if (st.landT > 0) st.landT = Math.max(0, st.landT - dt);
  if (st.lastH !== null) { let d = rd.heading - st.lastH; d = Math.atan2(Math.sin(d), Math.cos(d)); const want = Math.max(-0.35, Math.min(0.35, -d / Math.max(dt, 0.004) * 0.09)); st.lean += (want - st.lean) * Math.min(1, dt * 9); } st.lastH = rd.heading;
  rd.spinVel = st.lastSpin === undefined ? 0 : ((rd.spin || 0) - st.lastSpin) / Math.max(dt, 0.004); st.lastSpin = rd.spin || 0;
  const tg = target(rd, p, st, dt), k = Math.min(1, dt / 0.12), c = st.cur; for (const key of KEYS) c[key] += (tg[key] - c[key]) * k;
  const S = POSE_TUNE.sign; R.group.updateMatrixWorld(true); R.group.getWorldQuaternion(qF);
  turn(B.Hips, 'y', c.side, qF); qY.setFromAxisAngle(UP, c.side); qF.multiply(qY);       // the stance: the hips turn side-on; every later axis is in the turned frame
  turn(B.Spine, 'x', S.spineX * c.spineX, qF); turn(B.Spine, 'z', c.spineZ, qF); turn(B.Spine01, 'y', c.twist, qF);
  turn(B.neck, 'y', c.headY * 0.4, qF); turn(B.Head, 'y', c.headY * 0.6, qF);
  turn(B.LeftUpLeg, 'x', S.thigh * c.thighL, qF); turn(B.RightUpLeg, 'x', S.thigh * c.thighR, qF); turn(B.LeftUpLeg, 'z', -S.spread * c.spreadL, qF); turn(B.RightUpLeg, 'z', S.spread * c.spreadR, qF);
  turn(B.LeftLeg, 'x', S.knee * c.kneeL, qF); turn(B.RightLeg, 'x', S.knee * c.kneeR, qF); turn(B.LeftFoot, 'x', -S.knee * c.kneeL * 0.5, qF); turn(B.RightFoot, 'x', -S.knee * c.kneeR * 0.5, qF);
  turn(B.LeftArm, 'z', S.arm * c.armL, qF); turn(B.RightArm, 'z', -S.arm * c.armR, qF); turn(B.LeftArm, 'x', -c.armFwdL, qF); turn(B.RightArm, 'x', -c.armFwdR, qF); turn(B.LeftForeArm, 'y', c.elbowL, qF); turn(B.RightForeArm, 'y', -c.elbowR, qF);
  R.group.position.y += -c.hipsDrop + c.lift;
}
