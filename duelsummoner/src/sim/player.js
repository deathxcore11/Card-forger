// Duelist movement: run, jump, dash (no damage while it lasts), slide (gains speed downhill).
import { CFG } from '../data/config.js';
import { atan2, cos, exp, sin } from './dmath.js';
import { heightAt, moveXZ, WALL } from './terrain.js';
import { breakVasesNear } from './world.js';

export function makePlayer() {
  return { x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, pface: 0, vx: 0, vz: 0, vy: 0, hp: CFG.player.hp, maxHp: CFG.player.hp, face: 0, grounded: true,
    sliding: false, slideSpeed: 0, dashT: 0, dashCd: 0, dashDx: 0, dashDz: 1 };
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
  const fx = -sin(cmd.yaw), fz = -cos(cmd.yaw), rx = -fz, rz = fx;
  let mx = fx * cmd.f + rx * cmd.r, mz = fz * cmd.f + rz * cmd.r;
  const ml = Math.sqrt(mx * mx + mz * mz), hasInput = ml > 0.001, speed = C.speed * (1 + g.mods.move);
  if (hasInput) { mx /= ml; mz /= ml; p.face = atan2(mx, mz); }

  p.dashCd = Math.max(0, p.dashCd - dt);
  if (cmd.dash && p.dashCd <= 0 && p.dashT <= 0) {
    p.dashT = C.dashTime; p.dashCd = C.dashCd * (1 - g.mods.dashCd); p.sliding = false;
    p.dashDx = hasInput ? mx : fx; p.dashDz = hasInput ? mz : fz;
    breakVasesNear(g, p.x + p.dashDx * 2, p.z + p.dashDz * 2, 3);                 // dashing through vases breaks them
  }

  let moveX, moveZ;
  if (p.dashT > 0) {
    const sp = C.dashDist * (1 + g.mods.dash) / C.dashTime, use = Math.min(dt, p.dashT);
    p.dashT -= dt;
    moveX = p.dashDx * sp * use; moveZ = p.dashDz * sp * use;
    p.vx = p.dashDx * C.speed * 0.25; p.vz = p.dashDz * C.speed * 0.25;   // short tail so the dash stays about 4 m
  } else {
    const hs = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
    if (!cmd.slide || !p.grounded) p.sliding = false;
    else if (!p.sliding && hasInput && hs >= S.minStart) { p.sliding = true; p.slideSpeed = hs; }
    if (p.sliding) {
      let hx = p.vx / (hs || 1), hz = p.vz / (hs || 1);
      if (hasInput) {                                         // steer the slide gently toward the input
        const a = atan2(hx, hz), b = atan2(mx, mz);
        let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        const na = a + Math.max(-S.turn * dt, Math.min(S.turn * dt, d));
        hx = sin(na); hz = cos(na);
      }
      let dh = heightAt(p.x + hx * S.probe, p.z + hz * S.probe) - p.y;
      if (dh > 0.6) dh = 0;                                   // a wall, not a slope
      const slope = dh / S.probe;
      p.slideSpeed = Math.max(0, Math.min(S.max, p.slideSpeed + (-slope * S.downhill - S.friction) * dt));
      if (p.slideSpeed < S.keepMin) p.sliding = false;
      p.vx = hx * p.slideSpeed; p.vz = hz * p.slideSpeed;
      p.face = atan2(hx, hz);
    } else {
      const k = 1 - exp(-dt * (p.grounded ? C.groundAccel : C.airAccel));
      p.vx += (mx * speed * (hasInput ? 1 : 0) - p.vx) * k;
      p.vz += (mz * speed * (hasInput ? 1 : 0) - p.vz) * k;
    }
    moveX = p.vx * dt; moveZ = p.vz * dt;
  }
  const blocked = moveXZ(p, moveX, moveZ, C.radius, C.stepUp);
  if (blocked && !p.grounded && hasInput && mantle(p, mx, mz, C, heightAt, WALL)) { p.mantled = (p.mantled || 0) + 1; g.emit('mantle', p.x, p.y, p.z); }                  // the air jump that was nearly enough
  if (blocked & 1) p.vx = 0;
  if (blocked & 2) p.vz = 0;

  // vertical
  const jumpV = Math.sqrt(2 * CFG.gravity * C.jumpHeight);
  let h = heightAt(p.x, p.z);
  if (p.grounded) {
    if (h > p.y || p.y - h <= 0.5) p.y = h; else p.grounded = false;
  }
  if (p.grounded) { p.airUsed = 0; p.coyote = C.coyote; } else p.coyote = Math.max(0, (p.coyote || 0) - dt);
  const press = !!cmd.jump && !p.jumpWas;
  p.jumpBuf = press ? C.jumpBuffer : Math.max(0, (p.jumpBuf || 0) - dt);
  if ((cmd.jump && p.grounded) || (p.jumpBuf > 0 && (p.grounded || p.coyote > 0))) { p.vy = jumpV; p.grounded = false; p.sliding = false; p.coyote = 0; p.jumpBuf = 0; p.canCut = true; }
  else if (press && !p.grounded && (p.airUsed || 0) < g.mods.airJumps) { p.vy = jumpV; p.airUsed = (p.airUsed || 0) + 1; p.canCut = true; }
  if (!cmd.jump && p.canCut && p.vy > 0) { p.vy *= C.jumpCut; p.canCut = false; }                 // variable jump height
  if (p.vy <= 0) p.canCut = false;
  p.jumpWas = !!cmd.jump;
  if (!p.grounded) {
    p.y += p.vy * dt - 0.5 * CFG.gravity * dt * dt; p.vy -= CFG.gravity * dt;   // exact for constant gravity
    if (p.y <= h) { p.y = h; if (p.vy < 0) { p.vy = 0; p.grounded = true; } else p.vy = 0; }
  }
}

