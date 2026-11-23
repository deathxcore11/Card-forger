// Ley Threads: thin ribbons of light that drift through the world toward the Gate, so the stage itself says where to go (no HUD arrow).
// Three steps by distance: far (an occasional high thread, like weather), mid (a thread every second at head height), near (a steady stream hugging
// the ground). Each thread is a near-white core inside a violet halo over a thin dark under-stroke, about 3 screen pixels wide wherever it is, never nearer
// than 4 m to the camera (fading out between 9 m and 4 m) and always ahead of the duelist toward the Gate. View only: no sim state, no sim RNG.
import { heightAt } from '../sim/terrain.js';
import { LEY } from '../data/config.js';

const T = window.THREE, SEG = 12, SPACING = 0.4;                            // a trail is under 5 m long
const FAR = 150, MID = 90, NEAR = 40;                                       // metres from the Gate: below FAR threads start, below MID they get frequent, below NEAR they hug the ground
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class LeyThreads {
  constructor(scene, quality = 6) {
    this.max = quality; this.list = []; this.t = 0; this.acc = 0; this.on = true; this.strength = 1;
    this.core = new T.Color(LEY.core); this.halo = new T.Color(LEY.halo); this.under = new T.Color(LEY.under);
    this.matAdd = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending });
    this.matUnder = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide });
    this.group = new T.Group(); scene.add(this.group); this.rng = 12345;
    const mk = (strips, mat) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(SEG * 2 * strips * 3), 3)); g.setAttribute('color', new T.BufferAttribute(new Float32Array(SEG * 2 * strips * 4), 4));
      const idx = []; for (let k = 0; k < strips; k++) for (let s = 0; s < SEG - 1; s++) { const a = (k * SEG + s) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
      const m = new T.Mesh(g, mat); m.frustumCulled = false; m.visible = false; m.renderOrder = 3; this.group.add(m); return m; };
    for (let i = 0; i < this.max; i++) this.list.push({ mesh: mk(1, this.matAdd), under: mk(2, this.matUnder), alive: false, trail: [], x: 0, z: 0, h: 0, gy: 0, gr: 0, life: 0, spd: 0, dx: 0, dz: 0, lat: 0 });
  }
  rnd() { this.rng = (this.rng * 1664525 + 1013904223) >>> 0; return this.rng / 4294967296; }
  _show(th, v) { th.mesh.visible = v; th.under.visible = v; }
  // gate: { x, z } or null; player: { x, y, z }; dt seconds; show: false hides them (boss fight, menus)
  update(gate, player, dt, camera, show) {
    this.t += dt;
    const live = this.on && show && gate;
    let d = 1e9, dx = 0, dz = 0;
    if (gate) { dx = gate.x - player.x; dz = gate.z - player.z; d = Math.hypot(dx, dz); }
    if (live && d < FAR && d > 6) {
      const step = d < NEAR ? 0.35 : d < MID ? 0.9 : 3.2;                   // seconds between threads
      this.acc += dt;
      if (this.acc >= step / this.strength) { this.acc = 0; this._spawn(player, dx / d, dz / d, d); }
    }
    if (camera) { camera.getWorldDirection(this._f || (this._f = new T.Vector3())); }
    const cam = camera ? camera.position : null, pxk = camera ? 2 * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, (typeof innerHeight === 'number' ? innerHeight : 720)) : 0.002;
    for (const th of this.list) {
      if (!th.alive) { this._show(th, false); continue; }
      th.life -= dt; th.x += th.dx * th.spd * dt; th.z += th.dz * th.spd * dt;
      const ground = Math.abs(th.x) < 190 && Math.abs(th.z) < 190 ? heightAt(th.x, th.z) : 0;
      if (ground >= 50 || Math.abs(ground - th.gr) > 1.5) { th.alive = false; this._show(th, false); continue; }       // a step over 1.5 m (a pylon, a ledge) ends the thread instead of climbing it
      th.gr = ground; th.gy += (ground - th.gy) * Math.min(1, dt * 5);                                            // the height is low-passed, so a thread never zigzags up a wall
      th.dist = (th.dist || 0) + th.spd * dt; const y = th.gy + th.h + Math.sin(th.dist * 0.18 + th.lat) * 0.25;
      const head = [th.x, y, th.z], t1 = th.trail[1];
      if (!t1 || (t1[0] - head[0]) ** 2 + (t1[2] - head[2]) ** 2 >= SPACING * SPACING) { th.trail.unshift(head); if (th.trail.length > SEG) th.trail.pop(); } else th.trail[0] = head;
      if (th.life <= 0 || !live) { th.alive = false; this._show(th, false); continue; }
      this._shape(th, cam, pxk);
    }
  }
  _spawn(p, ux, uz, d) {
    const th = this.list.find(t => !t.alive); if (!th) return;
    const near = d < NEAR, mid = d < MID, sign = this.rnd() < 0.5 ? -1 : 1, side = sign * (2 + this.rnd() * (near ? 7 : 14)), ahead = 4 + this.rnd() * 14;      // 4 to 18 m ahead toward the Gate, never within 2 m sideways of the duelist
    const px = -uz, pz = ux;
    th.x = p.x + px * side + ux * ahead; th.z = p.z + pz * side + uz * ahead;
    th.dx = ux + px * (this.rnd() - 0.5) * 0.06; th.dz = uz + pz * (this.rnd() - 0.5) * 0.06; const l = Math.hypot(th.dx, th.dz); th.dx /= l; th.dz /= l;
    th.h = near ? 0.35 + this.rnd() * 0.5 : mid ? 1.4 + this.rnd() * 1.6 : 8 + this.rnd() * 9;     // far threads ride high, near ones hug the ground
    const g0 = Math.abs(th.x) < 190 && Math.abs(th.z) < 190 ? heightAt(th.x, th.z) : 0; if (g0 >= 50) return;
    th.gy = th.gr = g0; th.spd = (near ? 26 : 20) + this.rnd() * 8; th.life = near ? 1.8 : 3; th.dist = 0; th.lat = this.rnd() * 6; th.alive = true; th.trail.length = 0; this._show(th, true);
    th.far = d >= MID;
  }
  _shape(th, cam, pxk) {
    const A = th.mesh.geometry.attributes, pos = A.position, col = A.color, U = th.under.geometry.attributes, upos = U.position, ucol = U.color, tr = th.trail, fl = 0.85 + 0.15 * Math.sin(this.t * 17 + th.lat * 3);
    const fade = Math.min(1, th.life / 0.5, (3 - th.life) / 0.25 + 0.2) * this.strength, maxA = LEY.maxAlpha;
    for (let s = 0; s < SEG; s++) {
      const q = tr[Math.min(s, tr.length - 1)], prev = tr[Math.min(s + 1, tr.length - 1)], next = tr[Math.min(Math.max(s - 1, 0), tr.length - 1)];
      let tx = next[0] - prev[0], ty = next[1] - prev[1], tz = next[2] - prev[2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      let vx = 0, vy = 1, vz = 0, dist = 50, depth = 50; if (cam) { vx = cam.x - q[0]; vy = cam.y - q[1]; vz = cam.z - q[2]; dist = Math.hypot(vx, vy, vz) || 1; depth = Math.max(0.5, -(vx * this._f.x + vy * this._f.y + vz * this._f.z)); vx /= dist; vy /= dist; vz /= dist; }
      let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx; const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;   // across the thread, facing the camera
      const taper = 1 - s / SEG, tw = 0.35 + taper * 0.65, near = sstep(4, 9, dist), a = taper * fade * fl * near * (th.far ? 0.75 : 1);
      const wc = Math.min(0.2, 0.5 * LEY.corePx * pxk * depth * tw), wh = Math.min(0.3, 0.5 * LEY.haloPx * pxk * depth * tw), wu = Math.min(0.4, 0.5 * LEY.underPx * pxk * depth * tw);       // sized by depth along the view axis, so the pixel width holds out to the screen edges
      const put = (P, i, w, sg) => P.setXYZ(i, q[0] + sx * w * sg, q[1] + sy * w * sg, q[2] + sz * w * sg);
      put(pos, s * 2, wh, 1); put(pos, s * 2 + 1, wh, -1); put(upos, s * 2, wu, 1); put(upos, s * 2 + 1, wu, -1); put(upos, (SEG + s) * 2, wc, 1); put(upos, (SEG + s) * 2 + 1, wc, -1);
      const ah = Math.min(maxA, a * 0.5), ac = Math.min(LEY.coreAlpha, a * 1.1), au = Math.min(maxA, a * 0.55);       // the core is drawn with normal blending (additive white vanishes on bright sand), so it can be bright
      col.setXYZW(s * 2, this.halo.r, this.halo.g, this.halo.b, ah); col.setXYZW(s * 2 + 1, this.halo.r, this.halo.g, this.halo.b, ah);
      ucol.setXYZW((SEG + s) * 2, this.core.r, this.core.g, this.core.b, ac); ucol.setXYZW((SEG + s) * 2 + 1, this.core.r, this.core.g, this.core.b, ac);
      ucol.setXYZW(s * 2, this.under.r, this.under.g, this.under.b, au); ucol.setXYZW(s * 2 + 1, this.under.r, this.under.g, this.under.b, au);
    }
    pos.needsUpdate = col.needsUpdate = upos.needsUpdate = ucol.needsUpdate = true;
  }
}
