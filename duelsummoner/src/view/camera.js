// Chase camera: 7 m behind, 3 m above, over the right shoulder. Yaw is free, pitch is limited,
// it pulls in when terrain is behind it and never goes under the floor.
import { CFG } from '../data/config.js';
import { heightAt } from '../sim/terrain.js';
import { clamp } from '../core/util.js';

const C = CFG.cam;
const ARM = Math.sqrt(C.back * C.back + C.up * C.up), BASE = Math.atan2(C.up, C.back);

export class ChaseCamera {
  constructor(camera) { this.camera = camera; this.t = 1; this.py = 0; this.ready = false; this.pos = { x: 0, y: 0, z: 0 }; this.sx = 0; this.sz = 0; this.lag = true; }
  reset() { this.ready = false; this.t = 1; }

  update(p, yaw, pitch, dt) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
    const a = BASE + clamp(pitch, C.pitchMin, C.pitchMax), back = Math.cos(a) * ARM, up = Math.sin(a) * ARM;
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
      if (heightAt(sx, sz) > sy - 0.2) { free = (i - 1) / steps; break; }
    }
    if (free < 1) free = Math.max(C.minDist / ARM, free - C.margin / ARM);   // keep clear of the wall only when one is in the way
    if (free < this.t) this.t = free;                              // pull in at once
    else this.t = Math.min(free, this.t + dt * 4);                 // ease back out
    const t = Math.min(this.t, free);
    let x = px + (tx - px) * t, y = py + (ty - py) * t, z = pz + (tz - pz) * t;
    y = Math.max(y, heightAt(x, z) + C.floorGap, C.floorGap);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(px + fx * 6, py + 0.2, pz + fz * 6);        // aim past the duelist so the shoulder offset reads
    this.pos.x = x; this.pos.y = y; this.pos.z = z;
  }
}
