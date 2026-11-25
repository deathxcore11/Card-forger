// Duelist movement: run, jump, dash (no damage while it lasts), slide (gains speed downhill).
import { CFG } from '../data/config.js';
import { sealDash } from './seals.js';
import { K } from '../data/tuning.js';
import { atan2, cos, exp, sin } from './dmath.js';
import { heightAt, moveXZ, WALL } from './terrain.js';
import { breakVasesNear } from './world.js';
import { resolveColliders } from './colliders.js';
import { procEvent } from './procs.js';
import { laneFactor, LANE } from './lanes.js';

export function makePlayer() {
  return { x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, pface: 0, vx: 0, vz: 0, vy: 0, hp: CFG.player.hp, maxHp: CFG.player.hp, face: 0, grounded: true,
    sliding: false, slideSpeed: 0, dashT: 0, dashCd: 0, dashDx: 0, dashDz: 1, chain: 0, hopped: false, landT: 0, sinceDash: 99, decayN: 0, decay0: 0 };
}

export const isDashing = p => p.dashT > 0;

// cmd: { f, r (-1..1), yaw, jump, dash, slide }. Forward is relative to the camera yaw, on the ground plane only.
// Auto-mantle: a jump that comes up just short of a ledge still gets you onto it. Pushing into a wall in the air, with its top within reach above your feet and you not falling hard,
// lifts you onto the top and one step in. Always on (no input, no skill), so early game with no double jump never punishes a jump that was nearly right.
export function mantle(p, dirx, dirz, C, heightAtFn, wall) {
  if (p.grounded || p.vy < -4 || (!dirx && !dirz)) return false;
  const reach = C.radius + 0.35, top = heightAtFn(p.x + dirx * reach, p.z + dirz * reach), rise = top - p.y;
  if (top >= wall || rise <= 0.05 || rise > C.mantle) return false;
  p.x += dirx * (C.radius + 0.3); p.z += dirz * (C.radius + 0.3); p.y = top; p.vy = 0; p.grounded = true; return true;
}
export function updatePlayer(g, dt, cmd) {
  const p = g.p, C = CFG.player, S = C.slide;
  if (g.oaths.still) cmd.dash = false;                                   // Still Oath: no dash
  g.camYaw = cmd.yaw; const fx = -sin(cmd.yaw), fz = -cos(cmd.yaw), rx = -fz, rz = fx;
  let mx = fx * cmd.f + rx * cmd.r, mz = fz * cmd.f + rz * cmd.r;
  const ml = Math.sqrt(mx * mx + mz * mz), hasInput = ml > 0.001; let speed = C.speed * (1 + g.mods.move) * (g.windT > 0 ? 2 : 1) * (1 + (g.buf ? g.buf.haste : 0));
  if (hasInput) { mx /= ml; mz /= ml; p.face = atan2(mx, mz); if (g.big) speed *= laneFactor(g, mx, mz); }

  p.dashCd = Math.max(0, p.dashCd - dt);
  if (p.grounded) { if (p.landT < 255) p.landT++; } else p.landT = 0;                      // ticks on the ground since landing (1 on the first grounded tick)
  if (p.dashT > 0) p.sinceDash = 0; else if (p.sinceDash < 255) p.sinceDash++;
  if (cmd.dash && p.dashCd <= 0 && p.dashT <= 0) {
    p.dashT = C.dashTime; p.dashCd = C.dashCd * (1 - g.mods.dashCd); p.sliding = false; sealDash(g); if (g.procs && g.procs.length) procEvent(g, 'dash');
    p.dashDx = hasInput ? mx : fx; p.dashDz = hasInput ? mz : fz;
    breakVasesNear(g, p.x + p.dashDx * 2, p.z + p.dashDz * 2, 3);                 // dashing through vases breaks them
  }

  let moveX, moveZ;
  if (p.dashT > 0) {
    const sp = C.dashDist * (1 + g.mods.dash) / C.dashTime, use = Math.min(dt, p.dashT);
    p.dashT -= dt; if (p.dashT < 1e-6) p.dashT = 0;                          // exactly 9 ticks at 60 Hz (0.15 minus nine ticks is a hair above zero in floating point, which made a tenth)
    moveX = p.dashDx * sp * use; moveZ = p.dashDz * sp * use;
    const tail = hasInput ? speed : C.speed * C.dashTail;                     // the dash ends at run speed if the stick is held, else at a short tail so it stays about 4 m
    p.vx = p.dashDx * tail; p.vz = p.dashDz * tail;
  } else {
    const hs = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
    if (!cmd.slide || !p.grounded) p.sliding = false;
    else if (!p.sliding && hasInput && hs >= S.minStart) { p.sliding = true; p.slideSpeed = p.sinceDash <= K.hopWindow ? Math.min(K.hopCap * speed, Math.max(hs, K.hopDashSlide * speed)) : hs; }       // a dash into a slide starts it at 1.25x run speed
    if (p.sliding) {
      let hx = p.vx / (hs || 1), hz = p.vz / (hs || 1);
      if (hasInput) {                                         // steer the slide gently toward the input
        const a = atan2(hx, hz), b = atan2(mx, mz);
        let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        const na = a + Math.max(-S.turn * dt, Math.min(S.turn * dt, d));
        hx = sin(na); hz = cos(na);
      }
      let dh = heightAt(p.x + hx * S.probe, p.z + hz * S.probe) - p.y;
      if (dh > 0.9) dh = 0;                                   // a wall, not a slope (a 1:2 ramp over the probe is 0.6)
      const slope = dh / S.probe;
      p.slideSpeed = Math.max(0, Math.min(Math.min(S.max, K.hopSlideDown * speed), p.slideSpeed + (-slope * S.downhill - S.friction * (g.big ? LANE.slideFriction : 1)) * dt));
      if (slope > -0.05 && p.slideSpeed > K.hopCap * speed) p.slideSpeed = Math.max(K.hopCap * speed, p.slideSpeed - (K.hopSlideDown - K.hopCap) * speed / K.hopDecayTicks);       // on a downward slope a slide may reach 2.0x run speed; on the flat it falls to 1.6x over 18 ticks
      if (p.slideSpeed < S.keepMin) p.sliding = false;
      p.vx = hx * p.slideSpeed; p.vz = hz * p.slideSpeed;
      p.face = atan2(hx, hz);
    } else if (!p.grounded && hs > speed * 1.001 && hasInput && (p.vx * mx + p.vz * mz) / hs >= K.hopAirCone) {
      // carried speed (above run speed) is kept in the air while the stick is within 60 degrees of the travel direction; the velocity turns toward the stick at most 120 degrees a second
      const a = atan2(p.vx, p.vz), b = atan2(mx, mz); let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      const lim = K.hopAirTurn * dt, na = a + (d > lim ? lim : d < -lim ? -lim : d); p.vx = sin(na) * hs; p.vz = cos(na) * hs; p.decayN = 0;
    } else {
      const k = 1 - exp(-dt * (p.grounded ? C.groundAccel : C.airAccel));
      const over = p.grounded && hasInput && hs > speed * 1.001;                                // on the ground, speed above run speed falls to run speed over hopDecayTicks, not at once
      if (over) { if (p.decayN === 0) p.decay0 = hs - speed; p.decayN++; } else p.decayN = 0;
      p.vx += (mx * speed * (hasInput ? 1 : 0) - p.vx) * k;
      p.vz += (mz * speed * (hasInput ? 1 : 0) - p.vz) * k;
      if (over) { const m = Math.max(speed, hs - p.decay0 / (K.hopDecayTicks * (g.big ? LANE.carry : 1)) * p.decayN), vn = Math.sqrt(p.vx * p.vx + p.vz * p.vz); if (vn > 1e-9 && vn < m) { p.vx *= m / vn; p.vz *= m / vn; } }
    }
    moveX = p.vx * dt; moveZ = p.vz * dt;
  }
  const blocked = moveXZ(p, moveX, moveZ, C.radius, C.stepUp);
  resolveColliders(g.colliders, p, C.radius);                                        // trunks and big boulders are solid: slide along them
  if (blocked && !p.grounded && hasInput && mantle(p, mx, mz, C, heightAt, WALL)) { p.mantled = (p.mantled || 0) + 1; g.emit('mantle', p.x, p.y, p.z); }                  // the air jump that was nearly enough
  if (blocked & 1) p.vx = 0;
  if (blocked & 2) p.vz = 0;
  if (blocked) { p.chain = 0; p.hopped = false; const w = Math.sqrt(p.vx * p.vx + p.vz * p.vz); if (w > speed) { p.vx *= speed / w; p.vz *= speed / w; } }       // a wall takes the bonus away

  // vertical
  const jumpV = Math.sqrt(2 * CFG.gravity * C.jumpHeight * (1 + g.mods.jumpH));
  let h = heightAt(p.x, p.z);
  if (p.grounded) {
    if (h > p.y || p.y - h <= 0.5) { if (h - p.y > K.hopStep) { p.chain = 0; p.hopped = false; const w = Math.sqrt(p.vx * p.vx + p.vz * p.vz); if (w > speed) { p.vx *= speed / w; p.vz *= speed / w; } } p.y = h; } else p.grounded = false;       // a step up of more than 0.5 m takes the bonus away
  }
  if (p.grounded) { p.airUsed = 0; p.coyote = C.coyote; } else p.coyote = Math.max(0, (p.coyote || 0) - dt);
  const press = !!cmd.jump && !p.jumpWas;
  p.jumpBuf = press ? C.jumpBuffer : Math.max(0, (p.jumpBuf || 0) - dt);
  if ((cmd.jump && p.grounded) || (p.jumpBuf > 0 && (p.grounded || p.coyote > 0))) {
    // a slide hop: slide held within hopWindow ticks of landing, or out of a slide. The horizontal speed is kept and 8% of run speed is added, up to 1.6x run speed. Any other jump leaves the speed alone and ends the chain.
    const hs2 = Math.sqrt(p.vx * p.vx + p.vz * p.vz), slideHop = p.grounded && hs2 > 1e-6 && p.landT <= K.hopWindow && (cmd.slide || p.sliding);
    if (slideHop) { const ns = Math.min(K.hopCap * speed, hs2 + K.hopGain * speed); p.vx *= ns / hs2; p.vz *= ns / hs2; p.chain = (p.hopped && p.landT <= K.hopWindow) ? p.chain + 1 : 1; p.hopped = true; g.emit('hop', p.chain, ns, 0); } else { p.chain = 0; p.hopped = false; }
    p.vy = jumpV; p.grounded = false; p.sliding = false; p.coyote = 0; p.jumpBuf = 0; p.canCut = true;
  }
  else if (press && !p.grounded && (p.airUsed || 0) < g.mods.airJumps) { p.vy = jumpV; p.airUsed = (p.airUsed || 0) + 1; p.canCut = true; }
  if (!cmd.jump && p.canCut && p.vy > 0) { p.vy *= C.jumpCut; p.canCut = false; }                 // variable jump height
  if (p.vy <= 0) p.canCut = false;
  p.jumpWas = !!cmd.jump;
  if (!p.grounded) {
    p.y += p.vy * dt - 0.5 * CFG.gravity * dt * dt; p.vy -= CFG.gravity * dt;   // exact for constant gravity
    if (p.y <= h) { p.y = h; if (p.vy < 0) { p.vy = 0; p.grounded = true; } else p.vy = 0; }
  }
}

