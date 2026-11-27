// Trick poses (feel pass, 27 Nov): every trick has its own card and body pose, readable from the play camera. View only: it reads the ride state.
// board: the card's turn under the duelist (roll about its long axis, pitch about its short axis, an extra yaw, a lift); body: the rider's tilt and lift;
// parts: rotations for the block rider's parts (legs, torso, head, armL, armR), applied after the idle motion.
const TAU = 6.283185307179586, ease = k => k * k * (3 - 2 * k);
export function trickPose(rd) {
  const P = { roll: 0, pitch: 0, yaw: 0, lift: 0, bodyLift: 0, bodyPitch: 0, bodyRoll: 0, bodyYaw: 0, parts: {}, trail: 0, crouch: 0 };
  const parts = P.parts, set = (name, ax, v) => { (parts[name] || (parts[name] = {}))[ax] = v; };
  // specials: one big pose each, and a gold card trail
  if (rd.specialT > 0) { const k = 1 - rd.specialT / 0.9, s = Math.sin(k * Math.PI); P.trail = 1; P.bodyLift = 0.5 * s;
    switch (rd.specialName) {
      case 'Royal Flush': P.yaw = ease(k) * TAU * 2; P.lift = 0.6 * s; set('armL', 'z', 2.6); set('armR', 'z', -2.6); set('legs', 'x', 0.3); break;       // the card spins twice flat under a spread-eagle rider
      case 'Full House': P.roll = ease(k) * TAU * 2; P.lift = 0.4 * s; P.crouch = 0.8; set('armL', 'x', -1.2); set('armR', 'x', -1.2); break;       // a double kickflip, the rider tucked and hugging
      case 'Straight Flush': P.bodyPitch = Math.PI * s; P.bodyLift = 1.2 * s; P.pitch = 0.3 * s; set('armL', 'z', 3.0); set('armR', 'z', -3.0); break;       // a handstand on the card
      default: P.pitch = ease(k) * TAU * 2; P.yaw = ease(k) * TAU; P.lift = 0.5 * s; set('armL', 'x', -1.6); set('armR', 'x', 1.6); set('head', 'y', 0.8);       // Four of a Kind: a double nose-over-tail spin with a half turn
    }
    return P; }
  // flips: the card turns under the duelist, the rider jumps it with arms up and legs tucked
  if (rd.flipT > 0) { const k = 1 - rd.flipT / 0.42, d = rd.flipDir || 0, e = ease(k);
    if (d === 0 || d === 4) P.roll = e * TAU * (d === 4 ? -1 : 1);       // Card Flip / Heel Card: about the long axis
    else if (d === 2 || d === 6) P.pitch = e * TAU * (d === 6 ? -1 : 1);       // Deal Flip / Fan Flip: about the short axis
    else { P.roll = e * TAU * (d < 4 ? 1 : -1); P.yaw = e * Math.PI * (d === 1 || d === 5 ? 1 : -1); }       // the diagonals: a flip with a half spin of the card
    P.lift = -0.15 * Math.sin(k * Math.PI); P.bodyLift = 0.45 * Math.sin(k * Math.PI); P.crouch = 0.5;
    set('armL', 'z', 1.9); set('armR', 'z', -1.9); set('legs', 'x', 0.45); return P; }
  // grabs: the card is pulled up to the hand that holds it
  if (rd.grabbing) { const n = rd.grabName; P.lift = 0.35; P.crouch = 0.7;
    if (n === 'Hand Grab') { P.pitch = 0.45; P.bodyPitch = 0.45; set('armR', 'x', -1.4); set('armL', 'z', 1.6); }       // nose
    else if (n === 'Seal Grab') { P.roll = 0.45; P.bodyRoll = 0.35; set('armR', 'z', -0.4); set('armR', 'x', -0.6); set('armL', 'z', 2.2); }       // side
    else if (n === 'Joker Grab') { P.pitch = -0.45; P.bodyPitch = -0.35; set('armL', 'x', 1.3); set('armR', 'z', -1.8); }       // tail
    else { P.lift = 0.5; P.roll = -0.3; set('armL', 'x', -1.2); set('armR', 'x', -1.2); set('legs', 'x', 0.5); }       // Crown Grab: both hands, knees tucked
    return P; }
  // grinds: a stance each
  if (rd.grind) { const n = rd.grind.name;
    if (n === 'Edge Grind') { P.crouch = 0.8; set('armL', 'z', 1.0); set('armR', 'z', -1.0); }       // low and square
    else if (n === 'Rim Ride') { P.bodyYaw = 0.7; P.bodyRoll = 0.15; set('legs', 'z', 0.35); set('armL', 'z', 1.8); set('armR', 'x', -0.4); }       // one-foot: turned, one leg off
    else if (n === 'Spine Slide') { P.roll = 0.5; P.bodyRoll = -0.25; set('armL', 'z', 2.2); set('armR', 'z', -0.5); }       // the card tipped on its edge
    else { P.yaw = Math.PI / 2; P.bodyYaw = Math.PI / 2; set('armL', 'z', 1.5); set('armR', 'z', -1.5); }       // Lip Slide: the card across the rail
    P.bodyRoll += Math.max(-1, Math.min(1, rd.bal || 0)) * 0.35; return P; }
  // manual: nose up, leaning back, arms out for balance
  if (rd.manual) { P.pitch = -0.35; P.bodyPitch = -0.25 + Math.max(-1, Math.min(1, rd.bal || 0)) * 0.2; set('armL', 'z', 1.6); set('armR', 'z', -1.6); return P; }
  if (rd.wall) { P.roll = 0.7 * (rd.wall.nx || rd.wall.nz || 1); P.bodyRoll = 0.4; set('armL', 'z', 1.4); return P; }       // a wall ride: the card on its edge against the face
  if (rd.crouch > 0) P.crouch = Math.min(1, rd.crouch / 0.35);
  return P;
}
