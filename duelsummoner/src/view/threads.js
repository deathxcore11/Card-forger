// Ley Threads: thin crimson ribbons of light that drift through the world toward the Gate, so the stage itself says where to go (no HUD arrow).
// Three steps by distance: far (an occasional high thread, like weather), mid (a thread every second at head height), near (a steady stream hugging
// the ground). View only: no sim state, no sim RNG. Flat additive ribbons, no bloom, a deliberate low flicker.
import { heightAt } from '../sim/terrain.js';

const T = window.THREE, SEG = 14;
const FAR = 150, MID = 90, NEAR = 40;                                       // metres from the Gate: below FAR threads start, below MID they get frequent, below NEAR they hug the ground

export class LeyThreads {
  constructor(scene, quality = 6) {
    this.max = quality; this.list = []; this.t = 0; this.acc = 0; this.on = true; this.strength = 1;
    this.colour = new T.Color(0xe01c3c);
    this.mat = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide });
    this.group = new T.Group(); scene.add(this.group); this.rng = 12345;
    for (let i = 0; i < this.max; i++) {
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(SEG * 2 * 3), 3)); g.setAttribute('color', new T.BufferAttribute(new Float32Array(SEG * 2 * 4), 4));
      const idx = []; for (let s = 0; s < SEG - 1; s++) { const a = s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
      const m = new T.Mesh(g, this.mat); m.frustumCulled = false; m.visible = false; this.group.add(m);
      this.list.push({ mesh: m, alive: false, trail: [], x: 0, z: 0, h: 0, life: 0, spd: 0, w: 0, dx: 0, dz: 0, lat: 0 });
    }
  }
  rnd() { this.rng = (this.rng * 1664525 + 1013904223) >>> 0; return this.rng / 4294967296; }
  setColour(hex) { this.colour.set(hex); }
  // gate: { x, z } or null; player: { x, y, z }; dt seconds; show: false hides them (boss fight, menus)
  update(gate, player, dt, camera, show) {
    this.t += dt;
    const live = this.on && show && gate;
    let d = 1e9, dx = 0, dz = 0;
    if (gate) { dx = gate.x - player.x; dz = gate.z - player.z; d = Math.hypot(dx, dz); }
    if (live && d < FAR && d > 6) {
      const step = d < NEAR ? 0.22 : d < MID ? 0.9 : 3.2;                   // seconds between threads
      this.acc += dt;
      if (this.acc >= step / this.strength) { this.acc = 0; this._spawn(player, dx / d, dz / d, d); }
    }
    const cam = camera ? camera.position : null;
    for (const th of this.list) {
      if (!th.alive) { th.mesh.visible = false; continue; }
      th.life -= dt; th.dist += th.spd * dt;
      th.x += th.dx * th.spd * dt; th.z += th.dz * th.spd * dt;
      const ground = Math.abs(th.x) < 190 && Math.abs(th.z) < 190 ? heightAt(th.x, th.z) : 0, y = ground + th.h + Math.sin(th.dist * 0.18 + th.lat) * 0.35;
      const head = [th.x, y, th.z], t1 = th.trail[1];                          // trail points are 0.8 m apart whatever the frame rate; the head point moves every frame
      if (!t1 || (t1[0] - head[0]) ** 2 + (t1[2] - head[2]) ** 2 >= 0.64) { th.trail.unshift(head); if (th.trail.length > SEG) th.trail.pop(); } else th.trail[0] = head;
      if (th.life <= 0 || !live) { th.alive = false; th.mesh.visible = false; continue; }
      this._shape(th, cam);
    }
  }
  _spawn(p, ux, uz, d) {
    const th = this.list.find(t => !t.alive); if (!th) return;
    const near = d < NEAR, mid = d < MID, side = (this.rnd() - 0.5) * (near ? 10 : 22), back = 2 + this.rnd() * 10, ahead = near ? 3 + this.rnd() * 14 : 0;
    const px = -uz, pz = ux;                                                 // sideways from the line to the Gate
    th.x = p.x + px * side + ux * (ahead - back); th.z = p.z + pz * side + uz * (ahead - back);
    th.dx = ux + px * (this.rnd() - 0.5) * 0.06; th.dz = uz + pz * (this.rnd() - 0.5) * 0.06; const l = Math.hypot(th.dx, th.dz); th.dx /= l; th.dz /= l;
    th.h = near ? 0.35 + this.rnd() * 0.5 : mid ? 1.4 + this.rnd() * 1.6 : 8 + this.rnd() * 9;     // far threads ride high, near ones hug the ground
    th.spd = (near ? 26 : 20) + this.rnd() * 8; th.w = near ? 0.26 : 0.38; th.life = near ? 1.8 : 3; th.dist = 0; th.lat = this.rnd() * 6; th.alive = true; th.trail.length = 0; th.mesh.visible = true;
    th.far = d >= MID;
  }
  _shape(th, cam) {
    const pos = th.mesh.geometry.attributes.position, col = th.mesh.geometry.attributes.color, tr = th.trail, c = this.colour, fl = 0.85 + 0.15 * Math.sin(this.t * 17 + th.lat * 3);
    const fade = Math.min(1, th.life / 0.5, (3 - th.life) / 0.25 + 0.2) * this.strength;
    for (let s = 0; s < SEG; s++) {
      const q = tr[Math.min(s, tr.length - 1)], prev = tr[Math.min(s + 1, tr.length - 1)], next = tr[Math.min(Math.max(s - 1, 0), tr.length - 1)];
      let tx = next[0] - prev[0], ty = next[1] - prev[1], tz = next[2] - prev[2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      let vx = 0, vy = 1, vz = 0; if (cam) { vx = cam.x - q[0]; vy = cam.y - q[1]; vz = cam.z - q[2]; const vl = Math.hypot(vx, vy, vz) || 1; vx /= vl; vy /= vl; vz /= vl; }
      let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx; const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;   // across the thread, facing the camera
      const taper = 1 - s / SEG, w = th.w * (0.25 + taper * 0.75), a = taper * taper * fade * fl * (th.far ? 0.55 : 1);
      pos.setXYZ(s * 2, q[0] + sx * w, q[1] + sy * w, q[2] + sz * w); pos.setXYZ(s * 2 + 1, q[0] - sx * w, q[1] - sy * w, q[2] - sz * w);
      col.setXYZW(s * 2, c.r, c.g, c.b, Math.min(1, a * 1.15)); col.setXYZW(s * 2 + 1, c.r, c.g, c.b, Math.min(1, a * 1.15));
    }
    pos.needsUpdate = true; col.needsUpdate = true;
  }
}
