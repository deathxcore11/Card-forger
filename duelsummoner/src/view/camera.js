// Chase camera: 7 m behind, 3 m above, over the right shoulder. Yaw is free, pitch is limited,
// it pulls in when terrain is behind it and never goes under the floor.
import { CFG } from '../data/config.js';
import { heightAt, camGround } from '../sim/terrain.js';
import { clamp } from '../core/util.js';

const C = CFG.cam;
const ARM = Math.sqrt(C.back * C.back + C.up * C.up), BASE = Math.atan2(C.up, C.back);

// is this point inside a tree trunk or a boulder (with a little room)? the spring pulls the camera in before it
// a sphere of 0.3 m: the ground (and every wall prim) at the point and at four points round it
function solidAt(x, y, z) { const r = 0.3; return camGround(x, z) > y - 0.2 || camGround(x + r, z) > y - 0.2 || camGround(x - r, z) > y - 0.2 || camGround(x, z + r) > y - 0.2 || camGround(x, z - r) > y - 0.2; }
function hitProp(col, x, y, z) {
  if (!col) return false;
  const i0 = Math.floor((x - 3) / col.CELL), i1 = Math.floor((x + 3) / col.CELL), j0 = Math.floor((z - 3) / col.CELL), j1 = Math.floor((z + 3) / col.CELL);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = col.grid.get(i * 4096 + j); if (!a) continue; for (let n = 0; n < a.length; n++) { const c = a[n]; if (c.r < 2.0) continue; const dx = x - c.x, dz = z - c.z, rr = c.r + 0.85;       // trunks and rocks under 2 m only fade (see seethrough.js): they never pull the camera in
       if (dx * dx + dz * dz < rr * rr && y < c.top) return true; } }
  return false;
}

const OLD = () => typeof window !== 'undefined' && !!window.__camOld;       // test switch: the camera as it was before the crest easing
export class ChaseCamera {
  constructor(camera) { this.camera = camera; this.t = 1; this.py = 0; this.ready = false; this.pos = { x: 0, y: 0, z: 0 }; this.sx = 0; this.sz = 0; this.lag = true; this.zoom = 1; this.zoomTo = 1; this.cols = null; this.fovK = 1; this.spd = 1; this.lx = 0; this.lz = 0; }
  reset() { this.ready = false; this.t = 1; this.ready0 = false; }

  update(p, yaw, pitch, dt) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
    { const out = this.zoomTo > this.zoom, rate = this.zoomRate ? this.zoomRate : (out ? 1.6 : 0.7); if (Math.abs(this.zoomTo / this.zoom - 1) >= 0.05 || this.zoomTo === 1) this.zoom += (this.zoomTo - this.zoom) * Math.min(1, dt * rate); }       // out 1.6 a second, in 0.7 (0.5 both ways under Reduce motion); changes under 5% are ignored               // pulls back and up for big bosses so they fit
    const mvx = (p.x - this.lx) / Math.max(dt, 1e-3), mvz = (p.z - this.lz) / Math.max(dt, 1e-3), mv = Math.hypot(mvx, mvz); this.lx = p.x; this.lz = p.z;
    { const la = this.lookAhead || 0, k0 = mv > 0.5 && mv < 60 ? la * Math.min(1, mv / 14) / mv : 0, kk = Math.min(1, dt * 3); this.lax = (this.lax || 0) + (mvx * k0 - (this.lax || 0)) * kk; this.laz = (this.laz || 0) + (mvz * k0 - (this.laz || 0)) * kk; }       // the feel table: the view looks ahead along the travel, up to lookAhead m at cruise speed      // fast play pulls the camera back by up to a quarter so the whole map reads
    this.spd += ((1 + 0.25 * clamp((Math.min(mv, 60) - 9) / 9, 0, 1)) - this.spd) * Math.min(1, dt * 1.5);
    const a0 = BASE + clamp(pitch, C.pitchMin, C.pitchMax) + 0.2 * clamp((this.zoom - 1) / Math.max(0.01, (this.zoomCap || 1.78) - 1), 0, 1), aFloor = Math.max(a0, 0), lookUp = (aFloor - a0) * 8;      // the arm never goes below the pivot: looking up tilts the look target instead, so the camera cannot sink under a ledge
    const sc = this.zoom * this.spd * this.fovK;
    if (!this.ready) { this.py = p.y; this.sx = p.x; this.sz = p.z; this.ready = true; this.swing = 0; this.ys = 0; this.ysSide = 0; this.ysT = 0; this.rise = 0; this.pb = false; this.pbT = 0; }
    // gentle horizontal follow lag (about 55 ms); a jump of more than 3 m is a teleport and snaps
    if (!this.lag || Math.abs(p.x - this.sx) > 3 || Math.abs(p.z - this.sz) > 3) { this.sx = p.x; this.sz = p.z; this.ready0 = false; this.rise = 0; this.py = p.y; }       // a teleport resyncs the height limiter too
    else { const k = Math.min(1, this.lagT ? dt / this.lagT : dt * 18); this.sx += (p.x - this.sx) * k; this.sz += (p.z - this.sz) * k; }       // the follow lag (the feel table's cam.lag)
    this.py += (p.y - this.py) * Math.min(1, dt * 14);           // smooth the vertical follow over steps
    const px = this.sx + rx * C.shoulder + (this.lax || 0), py = this.py + C.headY, pz = this.sz + rz * C.shoulder + (this.laz || 0);
    const wanted = (ang, ys) => { const back = Math.cos(ang) * ARM * sc, up = Math.sin(ang) * ARM * sc, cs = Math.cos(ys), sn = Math.sin(ys), dx = fx * cs - fz * sn, dz = fx * sn + fz * cs; return [px - dx * back, py + up, pz - dz * back, Math.hypot(back, up)]; };       // ys: the arm is yawed round the duelist by this much (the sideways swing)
    // march from the pivot toward a wanted position; report the first solid sample, how many samples are solid and whether the end itself is
    const march = (ang, ys = this.ys) => {
      const [tx, ty, tz, len] = wanted(ang, ys); let first = -1, solidN = 0, endSolid = false, props = 0;
      for (let i = 1; i <= 40; i++) { const t = i / 40, sx = px + (tx - px) * t, sy = py + (ty - py) * t, sz = pz + (tz - pz) * t, ground = solidAt(sx, sy, sz), prop = !ground && hitProp(this.cols, sx, sy, sz); if (ground || prop) { solidN++; if (prop) props++; if (first < 0) first = i; if (i === 40) endSolid = true; } }
      return { free: first < 0 ? 1 : (first - 1) / 40, first, solidN, endSolid, len, tx, ty, tz, terrainOnly: props === 0 };
    };
    const rayClear = (ex, ey, ez, qx, qy, qz) => { for (let i = 1; i < 10; i++) { const t = i / 10; if (solidAt(ex + (qx - ex) * t, ey + (qy - ey) * t, ez + (qz - ez) * t)) return false; } return true; };
    let ang = aFloor + this.swing, m = march(ang), free = m.free;
    if (m.first >= 0) {
      // pass behind a thin blocker: the wanted position is free and the blocked span is 8 m or less (10 m once inside it): the camera stays at full distance and the porthole opens the blocker.
      // It needs a view: at least 3 of 4 rays from the camera to points 4 m round the duelist (left, right, ahead, behind) must be clear. The choice is held for 0.5 s.
      this.pbT -= dt;
      if (this.pbT <= 0) {
        const span = m.solidN / 40 * m.len; let pb = false;
        if (!m.endSolid && span <= (this.pb ? 10 : 8)) { let clear = 0; for (const [dx, dz] of [[rx, rz], [-rx, -rz], [fx, fz], [-fx, -fz]]) if (rayClear(m.tx, m.ty, m.tz, px + dx * 4, py - 0.4, pz + dz * 4)) clear++; pb = clear >= 3; }
        this.pb = pb; this.pbT = 0.5;
      }
      if (this.pb && !m.endSolid) free = 1;
    } else { this.pb = false; this.pbT = Math.min(this.pbT, 0); }
    // otherwise pull in, but swing the arm up first (up to 0.5 rad, at most 1 rad a second, eased) so the camera looks over the blocker before it closes in under 4 m
    // player camera input always wins: while the yaw is being turned, the swing eases back to nothing
    const turning = this.lastYaw !== undefined && Math.abs(yaw - this.lastYaw) / Math.max(dt, 1e-3) > 0.6; this.lastYaw = yaw; this.ysT -= dt;
    let ysTo = this.ys, swingTo = 0;
    if (free < 1) {
      // sideways swing first: yaw the arm round the duelist (up to 0.5 rad) toward the freer side, keeping the side it chose for 1 s so it never flips back and forth
      const lenAt = ys => { const mm = march(aFloor + this.swing, ys); return mm.first < 0 ? 99 : mm.free * mm.len; };
      if (turning) ysTo = 0; else if (lenAt(0) >= 4.0) ysTo = 0; else {
        if (this.ysT <= 0) { const l = lenAt(0.5), r = lenAt(-0.5); this.ysSide = Math.abs(l - r) < 0.5 && this.ysSide ? this.ysSide : (l >= r ? 1 : -1); this.ysT = 1.0; }
        ysTo = 0.5 * this.ysSide; for (let k = 1; k <= 5; k++) { const ys = 0.1 * k * this.ysSide; if (lenAt(ys) >= 4.0) { ysTo = ys; break; } }
      }
    } else if (this.ys !== 0) { if (turning) ysTo = 0; else { ysTo = 0; const m0 = march(aFloor + this.swing, 0); if (m0.first >= 0) ysTo = this.ys; } }       // it eases back once the blocker is clear
    { const d = ysTo - this.ys, rate = turning ? 2.0 : (Math.abs(ysTo) > Math.abs(this.ys) ? 1.0 : 0.5); this.ys += Math.sign(d) * Math.min(Math.abs(d), dt * rate); if (Math.abs(this.ys) < 1e-4) this.ys = 0; }
    if (free < 1) {
      swingTo = 0.5; for (let sw = 0; sw <= 0.5001; sw += 0.1) { const mm = march(aFloor + sw); if (mm.first < 0 || (mm.free * mm.len) >= 4.0) { swingTo = sw; break; } }
      const dsw = swingTo - this.swing; this.swing += Math.sign(dsw) * Math.min(Math.abs(dsw), dt * (dsw > 0 ? 1.0 : 0.5)) ; this.swing *= 1;
      ang = aFloor + this.swing; m = march(ang, this.ys); free = m.free;
      if (m.first >= 0 && this.pb && !m.endSolid) free = 1;
    } else { this.swing = Math.max(0, this.swing - dt * 0.5); }
    const armLen = m.len; if (free < 1) free = Math.max(C.minDist / armLen, free - C.margin / armLen);   // keep clear of the wall only when one is in the way
    if (free < 1) this.lastTerr = m.terrainOnly;
    if (free < 1 && m.terrainOnly && !OLD()) free = Math.max(free, 0.6);       // a dune crest behind the duelist never pulls the camera closer than 60% of its distance: the camera rises over the crest instead (below)
    if (free < this.t) {                                           // pull in: about 0.06 s when the eye is in the clear, at once when it is already inside something
      const cur = this.t, cx0 = px + (this.lastTx - px) * cur, cy0 = py + (this.lastTy - py) * cur, cz0 = pz + (this.lastTz - pz) * cur;
      if (this.lastTx === undefined || ((solidAt(cx0, cy0, cz0) || hitProp(this.cols, cx0, cy0, cz0)) && !(m.terrainOnly && !OLD() && !hitProp(this.cols, cx0, cy0, cz0)))) this.t = free;       // inside a wall or a prop: at once; inside a dune crest: eased (the eye is held above the ground by the floor below) else this.t += (free - this.t) * Math.min(1, dt / (m.terrainOnly && !OLD() ? 0.5 : 0.06));       // 0.3 s over a dune crest, 0.06 s against a wall or a prop
    } else this.t = Math.min(free, this.t + dt * (this.lastTerr && !OLD() ? 1.4 : 2.5));               // ease back out over about 0.7 s after a crest, 0.4 s after a wall
    this.lastTx = m.tx; this.lastTy = m.ty; this.lastTz = m.tz;
    { const q = this.t, qx = px + (m.tx - px) * q, qy = py + (m.ty - py) * q, qz = pz + (m.tz - pz) * q; if (q > free && (hitProp(this.cols, qx, qy, qz) || (solidAt(qx, qy, qz) && !(m.terrainOnly && !OLD())))) this.t = free; }       // the smoothed pull-in never carries the eye into a wall or the ground: then it goes straight to the free point
    const t = this.t < free ? this.t : Math.max(free, Math.min(this.t, free + (this.t - free))), tx = m.tx, ty = m.ty, tz = m.tz;
    let x = px + (tx - px) * t, y = py + (ty - py) * t, z = pz + (tz - pz) * t;
    // pinned against something tall at the minimum distance: rise over it, looking down at the duelist. The rise is smoothed to at most 6 m a second (0.1 m a frame), never a 1 m jump
    let need = 0; for (; need < 9 && (solidAt(x, y + need, z) || hitProp(this.cols, x, y + need, z)); need += 0.25);
    { const h = Math.hypot(x - px, z - pz), room = py + 1.73 * h - y; if (need > room) need = Math.max(0, room); }       // the rise never makes the view steeper than about 60 degrees: past that the camera stays where it is and the porthole and the silhouette show the duelist
    const dr = need - this.rise; this.rise += Math.sign(dr) * Math.min(Math.abs(dr), dt * 5); y += this.rise;
    if (this.cy === undefined || this.cy !== this.cy || !this.ready0) { this.cy = y; this.ready0 = true; }
    else { const lim = dt * 5; this.cy += Math.max(-lim, Math.min(lim, y - this.cy)); }       // the eye's height changes by at most 6 m a second (0.1 m a frame), whatever pulled it
    y = this.cy; const floor = Math.max(camGround(x, z) + C.floorGap, C.floorGap); const D0 = this.dbg || (this.dbg = {}); D0.floorHit = y < floor; D0.need = need; D0.t = this.t; D0.free = free; D0.ys = this.ys; D0.pb = this.pb; D0.swing = this.swing; D0.rise = this.rise; D0.floor = floor; D0.yb = y; if (y < floor) { y = floor; this.cy = y; }       // never under the ground, even if that is faster
    this.camera.position.set(x, y, z);
    let ly = py + 0.2 + lookUp; this.camera.lookAt(px + fx * 6, ly, pz + fz * 6);        // aim past the duelist so the shoulder offset reads
    // safe area: the duelist's feet stay above the hotbar (the bottom quarter of the screen) however steeply the camera looks down or however close the spring pulls it in
    const dx = this.sx - x, dy = this.py - y, dz = this.sz - z, dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, th = Math.tan(this.camera.fov * Math.PI / 360);
    for (let k = 0; k < 8; k++) {
      this.camera.updateMatrixWorld(); const v = this.camera.matrixWorldInverse.elements, fy = this.py + 0.9;
      const cx = v[0] * this.sx + v[4] * fy + v[8] * this.sz + v[12], cy = v[1] * this.sx + v[5] * fy + v[9] * this.sz + v[13], cz = v[2] * this.sx + v[6] * fy + v[10] * this.sz + v[14];
      if (cz > -0.1) break; const ndc = cy / (-cz * th);
      if (ndc >= -0.32) break;
      ly -= (-0.32 - ndc) * dist * th; this.camera.lookAt(px + fx * 6, ly, pz + fz * 6);
    }
    {   // pitch smoothing: what the player asked for passes straight through; the part the blockers add (the pitch of the actual eye minus the pitch of the unblocked eye) goes through a
        // critically damped spring (omega 16) with its rate limited to 50 degrees a second, so a pull-in never snaps the view
      const v = this._dv || (this._dv = this.camera.position.clone()); this.camera.getWorldDirection(v); const now = Math.asin(Math.max(-1, Math.min(1, v.y)));
      const [ix, iy, iz] = wanted(aFloor, 0), ideal = Math.atan2(py + 0.2 + lookUp - iy, Math.hypot(px + fx * 6 - ix, pz + fz * 6 - iz)), c = now - ideal;
      if (this.cS === undefined || !this.ready0) { this.cS = c; this.cV = 0; }
      else { const w = 16, acc = w * w * (c - this.cS) - 2 * w * this.cV; this.cV += acc * dt; let step = this.cV * dt; const lim = 0.52 * dt; step = Math.max(-lim, Math.min(lim, step)); this.cS += step; if (step !== this.cV * dt) this.cV = step / dt; }
      const dp = ideal + this.cS - now; if (Math.abs(dp) > 1e-5) this.camera.rotateX(dp);
    }
    this.pos.x = x; this.pos.y = y; this.pos.z = z;
  }
}


