// Ambient life: butterflies drifting over the Stage 1 meadows. View only (no sim state, no sim random numbers). Each one wanders around a flower clump, now and then lands on a
// flower and rests with its wings slowly opening and closing, then takes off; when enemies come close it drifts away and returns later. Cheap by design: one shared clip
// set, one mixer each, a hard cap, and anything far from the camera neither updates nor draws.
import { makeCreature } from './creature.js';
import { SCALE } from '../data/scale.js';
const T = window.THREE;
const SIZE = SCALE.ambient.butterfly, MAX = 10, NEAR_DRAW = 70, FLEE_R = 11, TAU = Math.PI * 2;

export class Ambient {
  constructor(scene, prep) { this.scene = scene; this.prep = prep; this.list = []; this.seed = 7; }
  rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  clear() { for (const b of this.list) this.scene.remove(b.rig.group); this.list.length = 0; }
  // spots: [[x, y, z], ...] flower positions; keep one butterfly per clump, clumps at least 18 m apart
  setSpots(spots, stage, seedText) {
    this.clear(); if (!this.prep || !spots || !spots.length || stage !== 0) return;
    let h = 2166136261; for (const ch of String(seedText || 'x')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } this.seed = h >>> 0;
    const homes = []; for (let tries = 0; tries < spots.length * 3 && homes.length < MAX; tries++) { const s = spots[Math.floor(this.rnd() * spots.length)]; if (homes.every(o => (o[0] - s[0]) ** 2 + (o[2] - s[2]) ** 2 > 18 * 18)) homes.push(s); }
    for (const hm of homes) {
      const rig = makeCreature(this.prep, SIZE * (0.8 + this.rnd() * 0.5)); rig.root.rotation.y = -Math.atan2(rig.parts.axes.F.x, rig.parts.axes.F.z); rig.play('flutter', { fade: 0 }); this.scene.add(rig.group);       // the model's front points along +z
      this.list.push({ rig, home: hm, x: hm[0], z: hm[2], y: hm[1] + 1.0, ph: this.rnd() * TAU, spd: 0.5 + this.rnd() * 0.5, rad: 2.5 + this.rnd() * 3.5, state: 'fly', t: this.rnd() * 6, face: 0, away: 0, perch: null });
    }
  }
  // camera: for culling; player and the enemy arrays: for drifting away from a fight
  update(dt, camera, enemies) {
    const cx = camera.position.x, cz = camera.position.z;
    for (const b of this.list) {
      const dxc = b.x - cx, dzc = b.z - cz, far = dxc * dxc + dzc * dzc > NEAR_DRAW * NEAR_DRAW;
      b.rig.group.visible = !far; if (far) continue;                              // off-screen ones stop costing anything
      b.t += dt; let threat = 0;
      if (enemies) for (let i = 0; i < enemies.max; i++) { if (!enemies.alive[i]) continue; const ex = enemies.x[i] - b.x, ez = enemies.z[i] - b.z; if (ex * ex + ez * ez < FLEE_R * FLEE_R) { threat = 1; b.fx = -ex; b.fz = -ez; break; } }
      if (threat) { b.away = 4; if (b.state === 'perch') { b.state = 'fly'; b.rig.play('flutter', { fade: 0.08 }); } }
      let tx, tz, ty;
      if (b.away > 0) {                                                          // drift away from the fight, rising, for a few seconds
        b.away -= dt; const l = Math.hypot(b.fx || 1, b.fz || 0) || 1; b.x += (b.fx || 1) / l * 3.2 * dt; b.z += (b.fz || 0) / l * 3.2 * dt; b.y += 0.5 * dt; b.face = Math.atan2(b.fx || 1, b.fz || 0);
        b.rig.play('flutter', { fade: 0.1 }); if (b.away <= 0) { b.home = [b.x, b.home[1], b.z]; }
      } else if (b.state === 'perch') {
        b.y += (b.perch.y - b.y) * Math.min(1, dt * 3); b.x += (b.perch.x - b.x) * Math.min(1, dt * 2); b.z += (b.perch.z - b.z) * Math.min(1, dt * 2);
        if (b.t > b.perchEnd) { b.state = 'fly'; b.t = 0; b.rig.play(this.rnd() < 0.4 ? 'glide' : 'flutter', { fade: 0.15 }); }
      } else {
        b.ph += dt * b.spd; const ox = Math.cos(b.ph) * b.rad + Math.cos(b.ph * 2.3) * b.rad * 0.3, oz = Math.sin(b.ph * 1.3) * b.rad;        // a lazy looping path around the clump
        tx = b.home[0] + ox; tz = b.home[2] + oz; ty = b.home[1] + 1.0 + Math.sin(b.ph * 3.1) * 0.35;
        const nx = b.x + (tx - b.x) * Math.min(1, dt * 1.4), nz = b.z + (tz - b.z) * Math.min(1, dt * 1.4); if (Math.hypot(nx - b.x, nz - b.z) > 1e-4) b.face = Math.atan2(nx - b.x, nz - b.z); b.x = nx; b.z = nz; b.y += (ty - b.y) * Math.min(1, dt * 2);
        if (b.t > 6 + this.rnd() * 6 && this.rnd() < dt * 0.5) { const s = this.near(b); if (s) { b.state = 'perch'; b.perch = { x: s[0], y: s[1] + 0.15, z: s[2] }; b.perchEnd = b.t + 4 + this.rnd() * 5; b.rig.play('perch', { fade: 0.3 }); } }
      }
      b.rig.group.position.set(b.x, b.y, b.z); b.rig.group.rotation.y = b.face;
      b.rig.update(null, dt, null);                                              // state keeps the current clip
    }
  }
  near(b) { return b.home; }                                                      // land on the flowers at home
}
