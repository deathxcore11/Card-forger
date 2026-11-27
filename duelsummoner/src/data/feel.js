// The feel pass (owner, 27 Nov): every number that decides how getting around, riding, tricks, hits and the camera feel, in one table.
// applyFeel() writes them into the sim and view settings they drive; the ?debug slider panel (view/feelpanel.js) edits this table live.
// design/feel-v2.md holds the final table. Values here are starting points; sliders move them.
import { CFG } from './config.js';
import { K } from './tuning.js';
import { RIDE, POINTS } from '../sim/ride.js';

export const FEEL = {
  foot: {
    top: 9,               // m/s run speed
    accelT: 0.15,         // seconds to reach top speed from a stand
    stopT: 0.10,          // seconds to stop when the stick is let go
    air: 0.8,             // air control, a fraction of the ground's
    coyote: 0.12,         // s a jump still counts after leaving a ledge
    buffer: 0.15,         // s a jump press is remembered before landing
    jumpH: 2.2,           // m, a full held jump (a tap is half)
    hopWindow: 0.1,       // s after landing in which a jump keeps the speed and adds the hop gain
    hopGain: 0.05,        // fraction added per chained hop
    hopCap: 16            // m/s, the most a hop chain carries
  },
  ride: {
    cruise: 14,           // m/s the card settles to on the flat
    push: 18,             // m/s with the stick held forward
    top: 30,              // m/s downhill
    turnLow: 4.2,         // rad/s carve at low speed (8 m/s and under)
    turnHigh: 1.5,        // rad/s carve at top speed: a wide arc
    headOn: 60,           // degrees: a wall met more square than this bails; a glancing one deflects
    deflectKeep: 0.85,    // speed kept off a glancing wall
    crouchMax: 0.35,      // s of crouch for the highest ollie
    ollieLo: 1.2,         // m, a tapped ollie
    ollieHi: 2.6,         // m, a full crouch
    magnet: 2.8,          // m: rails snap within this when airborne or on an ollie near one (27 Nov: wider and forgiving)
    wallMin: 10,          // m/s to ride a wall
    wallT: 1.2,           // s a wall ride lasts at most
    wallSink: 1.2,        // m/s the card slides down a wall while riding it
    gravity: 28
  },
  trick: {
    landTol: 30,          // degrees off straight that still lands
    bailT: 0.6,           // s a bail lasts
    repeat: 0.75,         // each repeat of the same trick in one combo is worth this much of the last
    flip: 300, grab: 200, grabPerSecond: 420, spin180: 260, grind: 120, grindPerSecond: 160, manualPerSecond: 90, revert: 180, wallRide: 220,
    meterPerPoint: 1 / 2500,       // the special meter fills by banked combo points
    bigAirT: 0.75,        // s of air that counts as Big Air (a full-crouch ollie on the flat gives about 0.86 s)
    specialMul: 3         // a special is worth this many times the trick it builds on
  },
  hit: {
    knock: 14,            // m/s an enemy is thrown when the card rides through it
    knockUp: 7,           // m/s up
    trickKill: 120,       // points a ridden-through enemy adds to the combo
    hitstop: 0.04         // s of hit-stop on a slam kill
  },
  cam: {
    fovMin: 70, fovMax: 85,       // degrees (vertical feel) from cruise to top speed
    lag: 0.12,            // s the chase arm trails
    lookAhead: 4,         // m ahead along the travel
    speedLines: 18        // m/s where speed lines start
  }
};

// write the table into what it drives (called at load and by the slider panel)
export function applyFeel() {
  const F = FEEL.foot, R = FEEL.ride, T = FEEL.trick, P = CFG.player;
  P.speed = F.top; P.groundAccel = 3 / F.accelT; P.groundStop = 3 / F.stopT; P.airAccel = P.groundAccel * F.air; P.coyote = F.coyote; P.jumpBuffer = F.buffer; P.jumpHeight = F.jumpH;
  P.hop = { win: F.hopWindow, gain: F.hopGain, cap: F.hopCap };       // (the tuning table K is frozen, so the hop chain reads these from the player settings)
  Object.assign(RIDE, { pushTo: R.cruise, pushMax: R.push, top: R.top, crouchMax: R.crouchMax, popLo: R.ollieLo, popHi: R.ollieHi, snap: R.magnet, gravity: R.gravity, landTol: T.landTol * Math.PI / 180, bailT: T.bailT,
    turnLow: R.turnLow, turnHigh: R.turnHigh, headOn: R.headOn, deflectKeep: R.deflectKeep, wallMin: R.wallMin, wallT: R.wallT, wallSink: R.wallSink, repeat: T.repeat, specialMul: T.specialMul, meterPerPoint: T.meterPerPoint, bigAirT: T.bigAirT, knock: { points: FEEL.hit.trickKill, hop: 5.5 } });
  Object.assign(POINTS, { flip: T.flip, grab: T.grab, grabPerSecond: T.grabPerSecond, spin180: T.spin180, grind: T.grind, grindPerSecond: T.grindPerSecond, manualPerSecond: T.manualPerSecond, revert: T.revert, wallRide: T.wallRide });
}
applyFeel();
