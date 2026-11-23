// Chase camera: 7 m behind, 3 m above, over the right shoulder. Yaw is free, pitch is limited,
// it pulls in when terrain is behind it and never goes under the floor.
import { CFG } from '../data/config.js';
import { heightAt } from '../sim/terrain.js';
import { clamp } from '../core/util.js';

const C = CFG.cam;
const ARM = Math.sqrt(C.back * C.back + C.up * C.up), BASE = Math.atan2(C.up, C.back);

// is this point inside a tree trunk or a boulder (with a little room)? the spring pulls the camera in before it
function hitProp(col, x, y, z) {
  if (!col) return false;
  const i0 = Math.floor((x - 3) / col.CELL), i1 = Math.floor((x + 3) / col.CELL), j0 = Math.floor((z - 3) / col.CELL), j1 = Math.floor((z + 3) / col.CELL);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = col.grid.get(i * 4096 + j); if (!a) continue; for (let n = 0; n < a.length; n++) { const c = a[n], dx = x - c.x, dz = z - c.z, rr = c.r + 0.45; if (dx * dx + dz * dz < rr * rr && y < c.top) return true; } }
  return false;
}

export class ChaseCamera {
  constructor(camera) { this.camera = camera; this.t = 1; this.py = 0; this.ready = false; this.pos = { x: 0, y: 0, z: 0 }; this.sx = 0; this.sz = 0; this.lag = true; this.zoom = 1; this.zoomTo = 1; this.cols = null; this.spd = 1; this.lx = 0; this.lz = 0; }
  reset() { this.ready = false; this.t = 1; }

  update(p, yaw, pitch, dt) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
    this.zoom += (this.zoomTo - this.zoom) * Math.min(1, dt * 1.6);               // pulls back and up for big bosses so they fit
    const mv = Math.hypot(p.x - this.lx, p.z - this.lz) / Math.max(dt, 1e-3); this.lx = p.x; this.lz = p.z;      // fast play pulls the camera back by up to a quarter so the whole map reads
    this.spd += ((1 + 0.25 * clamp((Math.min(mv, 60) - 9) / 9, 0, 1)) - this.spd) * Math.min(1, dt * 1.5);
    const a = BASE + clamp(pitch, C.pitchMin, C.pitchMax), back = Math.cos(a) * ARM * this.zoom * this.spd, up = Math.sin(a) * ARM * this.zoom * this.spd;
    if (!this.ready) { this.py = p.y; this.sx = p.x; this.sz = p.z; this.ready = true; }
    // gentle horizontal follow lag (about 55 ms); a jump of more than 3 m is a teleport and snaps
    if (!this.lag || Math.abs(p.x - this.sx) > 3 || Math.abs(p.z - this.sz) > 3) { this.sx = p.x; this.sz = p.z; }
    else { const k = Math.min(1, dt * 18); this.sx += (p.x - this.sx) * k; this.sz += (p.z - this.sz) * k; }
    this.py += (p.y - this.py) * Math.min(1, dt * 14);           // smooth the vertical follow over steps
    const px = this.sx + rx * C.shoulder, py = this.py + C.headY, pz = this.sz + rz * C.shoulder;
    const tx = px - fx * back, ty = py + up, tz = pz - fz * back;
    // march from the pivot toward the wanted position; stop before the first solid sample
    let free = 1;
    const steps = 28;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, sx = px + (tx - px) * t, sy = py + (ty - py) * t, sz = pz + (tz - pz) * t;
      if (heightAt(sx, sz) > sy - 0.2 || hitProp(this.cols, sx, sy, sz)) { free = (i - 1) / steps; break; }
    }
    if (free < 1) free = Math.max(C.minDist / ARM, free - C.margin / ARM);   // keep clear of the wall only when one is in the way
    if (free < this.t) this.t = free;                              // pull in at once
    else this.t = Math.min(free, this.t + dt * 4);                 // ease back out
    const t = Math.min(this.t, free);
    let x = px + (tx - px) * t, y = py + (ty - py) * t, z = pz + (tz - pz) * t;
    y = Math.max(y, heightAt(x, z) + C.floorGap, C.floorGap);
    this.camera.position.set(x, y, z);
    let ly = py + 0.2; this.camera.lookAt(px + fx * 6, ly, pz + fz * 6);        // aim past the duelist so the shoulder offset reads
    // safe area: the duelist's feet stay above the hotbar (the bottom quarter of the screen) however steeply the camera looks down or however close the spring pulls it in
    const dx = this.sx - x, dy = this.py - y, dz = this.sz - z, dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, th = Math.tan(this.camera.fov * Math.PI / 360);
    for (let k = 0; k < 8; k++) {
      this.camera.updateMatrixWorld(); const v = this.camera.matrixWorldInverse.elements, fy = this.py + 0.9;
      const cx = v[0] * this.sx + v[4] * fy + v[8] * this.sz + v[12], cy = v[1] * this.sx + v[5] * fy + v[9] * this.sz + v[13], cz = v[2] * this.sx + v[6] * fy + v[10] * this.sz + v[14];
      if (cz > -0.1) break; const ndc = cy / (-cz * th);
      if (ndc >= -0.32) break;
      ly -= (-0.32 - ndc) * dist * th; this.camera.lookAt(px + fx * 6, ly, pz + fz * 6);
    }
    this.pos.x = x; this.pos.y = y; this.pos.z = z;
  }
}

