// The loud layer of attack effects. View only: it reads the sim's effect records (ring, fan, bolt) and the hit and kill events, and draws each element's own look on top of them:
// glowing block particles with their own motion (fire rises, ice shards fall, poison bubbles, lightning sparks, wind streaks, earth chunks, light rays, dark motes that fall inward),
// thick two-layer beams, a bright swept crescent for a melee swipe, a shock ring with a ground flash, and a block shatter on a kill.
// Comfort: nothing fills the screen, nothing strobes; every piece is short and fades. Pools are fixed, so a horde costs no more than the pool.
const T = window.THREE;
// per element: core colour, body colour, and how its particles move (up: start lift, g: gravity (negative rises), drag, spread speed, life, size)
export const EL = {
  fire: { a: 0xfff2a8, b: 0xff6a1a, up: 3.2, g: -5, drag: 1.6, sp: 3.2, life: 0.55, size: 0.42 },
  ice: { a: 0xf2fdff, b: 0x4fd4ff, up: 4.2, g: 16, drag: 0.4, sp: 4.6, life: 0.6, size: 0.36 },
  lightning: { a: 0xffffff, b: 0x6fb8ff, up: 2.0, g: 4, drag: 3.2, sp: 9.0, life: 0.22, size: 0.3 },
  poison: { a: 0xd6ff8a, b: 0x39ff14, up: 1.4, g: -2.4, drag: 2.2, sp: 2.2, life: 0.8, size: 0.44 },
  wind: { a: 0xffffff, b: 0x9ff2e0, up: 0.8, g: -1, drag: 0.8, sp: 7.0, life: 0.4, size: 0.28 },
  earth: { a: 0xffd890, b: 0xb5723a, up: 5.2, g: 22, drag: 0.2, sp: 4.2, life: 0.7, size: 0.5 },
  light: { a: 0xffffff, b: 0xffd86a, up: 6.0, g: -3, drag: 2.4, sp: 2.4, life: 0.5, size: 0.34 },
  dark: { a: 0xe0b8ff, b: 0xb26bff, up: 1.0, g: 0, drag: 1.2, sp: -4.0, life: 0.5, size: 0.4 },
};
const ELS = ['fire', 'lightning', 'ice', 'poison', 'wind', 'earth', 'light', 'dark'], BIT = { 1: 'fire', 2: 'lightning', 4: 'ice', 8: 'poison', 16: 'wind', 32: 'earth', 64: 'light', 128: 'dark' };
const NP = 2400, NB = 40, NR = 40, NS = 20;
let seed = 1; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const add = (geo, n, opts) => { const m = new T.InstancedMesh(geo, new T.MeshBasicMaterial(Object.assign({ color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }, opts || {})), n); m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(n * 3), 3); m.frustumCulled = false; m.count = 0; m.renderOrder = 6; return m; };
export class Juice {
  constructor(scene, heightAt) {
    this.h = heightAt || (() => 0); this.d = new T.Object3D(); this.c = new T.Color(); this.c2 = new T.Color(); this.seen = new WeakMap(); this.amount = 1;
    // particles: little glowing blocks
    this.pm = add(new T.BoxGeometry(1, 1, 1), NP, { transparent: false, blending: T.NormalBlending, depthWrite: true });       // solid bright blocks: they read on pale sand and on snow, where an added glow would wash out to white scene.add(this.pm);
    this.p = new Float32Array(NP * 12); this.pcol = new Float32Array(NP * 6); this.ph = 0;       // x y z vx vy vz g drag life age size spin | colour a, colour b
    // beams: a white core in a coloured sleeve
    this.bm = add(new T.BoxGeometry(1, 1, 1), NB * 2, { blending: T.NormalBlending, opacity: 0.9 }); scene.add(this.bm); this.b = []; for (let i = 0; i < NB; i++) this.b.push({ on: false });
    // shock rings and ground flashes
    const rg = new T.RingGeometry(0.82, 1, 40); rg.rotateX(-Math.PI / 2); this.rm = add(rg, NR, { side: T.DoubleSide }); scene.add(this.rm);
    const dg = new T.CircleGeometry(1, 28); dg.rotateX(-Math.PI / 2); this.dm = add(dg, NR, { side: T.DoubleSide, opacity: 0.5 }); scene.add(this.dm); this.r = []; for (let i = 0; i < NR; i++) this.r.push({ on: false });
    // LED rings: a neon ring under every summon and the card, breathing with the beat
    const lg = new T.RingGeometry(0.86, 1, 36); lg.rotateX(-Math.PI / 2); this.lm = add(lg, 24, { side: T.DoubleSide, depthTest: false }); scene.add(this.lm); this.ln = 0; this.lp = 0;
    // swipes: a quarter crescent, swept through the fan
    const sg = new T.RingGeometry(0.55, 1, 20, 1, -0.6, 1.2); sg.rotateX(-Math.PI / 2); this.sm = add(sg, NS, { side: T.DoubleSide }); scene.add(this.sm); this.s = []; for (let i = 0; i < NS; i++) this.s.push({ on: false });
  }
  _p(x, y, z, vx, vy, vz, g, drag, life, size, ca, cb) { const i = this.ph, o = i * 12, P = this.p; this.ph = (i + 1) % NP; P[o] = x; P[o + 1] = y; P[o + 2] = z; P[o + 3] = vx; P[o + 4] = vy; P[o + 5] = vz; P[o + 6] = g; P[o + 7] = drag; P[o + 8] = life; P[o + 9] = 0; P[o + 10] = size; P[o + 11] = rnd() * 6.28; const C = this.pcol, q = i * 6; this.c.setHex(ca); C[q] = this.c.r; C[q + 1] = this.c.g; C[q + 2] = this.c.b; this.c.setHex(cb); C[q + 3] = this.c.r; C[q + 4] = this.c.g; C[q + 5] = this.c.b; }
  _style(el, color) { return EL[el] || { a: 0xffffff, b: color || 0xffc060, up: 3, g: 9, drag: 1, sp: 4, life: 0.45, size: 0.22 }; }
  // n particles of an element thrown out from a point; k scales speed and size
  burst(x, y, z, el, n, k, color) { const S = this._style(el, color); n = Math.round(n * this.amount); k = k || 1;
    for (let i = 0; i < n; i++) { const a = rnd() * 6.2832, s = Math.abs(S.sp) * (0.35 + rnd() * 0.75) * k, inw = S.sp < 0, ox = inw ? Math.cos(a) * 1.6 * k : 0, oz = inw ? Math.sin(a) * 1.6 * k : 0;
      this._p(x + ox + (rnd() - 0.5) * 0.3, y + rnd() * 0.5, z + oz + (rnd() - 0.5) * 0.3, Math.cos(a) * s * (inw ? -1 : 1), S.up * (0.5 + rnd()) * (0.7 + 0.3 * k), Math.sin(a) * s * (inw ? -1 : 1), S.g, S.drag, S.life * (0.7 + rnd() * 0.6), S.size * (0.7 + rnd() * 0.7) * (0.8 + 0.2 * k), S.a, S.b); } }
  beam(x, y, z, x2, y2, z2, el, color, w) { const S = this._style(el, color); let o = this.b.find(q => !q.on); if (!o) o = this.b[(Math.random() * NB) | 0]; Object.assign(o, { on: true, t: 0, dur: el === 'lightning' ? 0.16 : 0.24, x, y, z, x2, y2, z2, a: S.a, b: S.b, w: w || (el === 'light' ? 0.8 : 0.55) });
    const dx = x2 - x, dy = y2 - y, dz = z2 - z, L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, n = Math.min(26, Math.round(L * 1.4 * this.amount));
    for (let i = 0; i < n; i++) { const f = rnd(); this._p(x + dx * f, y + dy * f, z + dz * f, (rnd() - 0.5) * 2.4, S.up * 0.4 * rnd(), (rnd() - 0.5) * 2.4, S.g * 0.5, S.drag, S.life * 0.8, S.size * 0.8, S.a, S.b); }
    this.burst(x2, y2, z2, el, 22, 1.3, color); this.ring(x2, this.h(x2, z2) + 0.12, z2, 1.5, el, color, 0.22); }
  ring(x, y, z, r, el, color, dur) { const S = this._style(el, color); let o = this.r.find(q => !q.on); if (!o) o = this.r[(Math.random() * NR) | 0]; Object.assign(o, { on: true, t: 0, dur: dur || 0.38, x, y, z, r, a: S.a, b: S.b }); }
  swipe(x, y, z, r, dx, dz, arc, el, color) { const S = this._style(el, color); let o = this.s.find(q => !q.on); if (!o) o = this.s[(Math.random() * NS) | 0]; Object.assign(o, { on: true, t: 0, dur: 0.2, x, y, z, r, yaw: Math.atan2(-dz, dx), arc: Math.min(3.1, (arc || 90) * Math.PI / 360), a: S.a, b: S.b });
    const n = Math.round(14 * this.amount), a0 = Math.atan2(dz, dx); for (let i = 0; i < n; i++) { const a = a0 + (rnd() - 0.5) * 2 * o.arc, rr = r * (0.6 + rnd() * 0.4); this._p(x + Math.cos(a) * rr, y + 0.5 + rnd() * 0.6, z + Math.sin(a) * rr, Math.cos(a) * 5, S.up * 0.5, Math.sin(a) * 5, S.g, S.drag + 1, S.life * 0.7, S.size, S.a, S.b); } }
  ledBegin(pulse) { this.ln = 0; this.lp = pulse; }
  led(x, y, z, r, hex) { if (this.ln >= 24) return; const d = this.d, k = 0.92 + 0.16 * this.lp; d.rotation.set(0, 0, 0); d.position.set(x, y + 0.3, z); d.scale.set(r * k, 1, r * k); d.updateMatrix(); this.lm.setMatrixAt(this.ln, d.matrix); this.lm.setColorAt(this.ln, this.c.setHex(hex).multiplyScalar(0.45 + 0.55 * this.lp)); this.ln++; }
  ledEnd() { this.lm.count = this.ln; this.lm.instanceMatrix.needsUpdate = true; this.lm.instanceColor.needsUpdate = true; }
  // one sim effect record, the first time it is seen (a pooled record that restarts counts as new)
  rec(o) { const prev = this.seen.get(o); this.seen.set(o, o.t); if (prev !== undefined && o.t >= prev) return; if (o.owner !== 0 || o.dur >= 1 || o.type === 'wake') return; const el = o.el, col = o.color;
    if (o.type === 'bolt') { this.beam(o.x, o.y, o.z, o.x2, o.y2, o.z2, el, col, o.w ? o.w * 2.4 : 0); return; }
    if (o.type === 'fan') { this.swipe(o.x, o.y, o.z, o.r, o.dx, o.dz, o.arc, el, col); return; }
    if (o.type === 'ring' && !o.vr) { const y = o.y; this.ring(o.x, y + 0.1, o.z, o.r, el, col, Math.max(0.3, o.dur)); const n = Math.min(60, 14 + Math.round(o.r * 8)); const S = this._style(el, col);
      for (let i = 0; i < Math.round(n * this.amount); i++) { const a = (i / n) * 6.2832 + rnd() * 0.3, rr = o.r * (0.25 + rnd() * 0.75); this._p(o.x + Math.cos(a) * rr, y + 0.15, o.z + Math.sin(a) * rr, Math.cos(a) * Math.abs(S.sp) * 0.5, S.up * (0.6 + rnd() * 0.8), Math.sin(a) * Math.abs(S.sp) * 0.5, S.g, S.drag, S.life * (0.8 + rnd() * 0.5), S.size * (0.8 + rnd() * 0.6), S.a, S.b); } } }
  hit(x, y, z, mask, crit) { let el = null; for (const b in BIT) if (mask & b) { el = BIT[b]; break; } this.burst(x, y, z, el, crit ? 12 : 5, crit ? 1.4 : 1, 0xffe6b0); if (crit) this.ring(x, this.h(x, z) + 0.12, z, 1.3, el, 0xffe6b0, 0.2); }
  kill(x, y, z, hex) { const n = Math.round(10 * this.amount); for (let i = 0; i < n; i++) { const a = rnd() * 6.2832, s = 2 + rnd() * 4.5; this._p(x + (rnd() - 0.5) * 0.5, y + rnd() * 0.9, z + (rnd() - 0.5) * 0.5, Math.cos(a) * s, 3.5 + rnd() * 4.5, Math.sin(a) * s, 20, 0.3, 0.55 + rnd() * 0.3, 0.2 + rnd() * 0.16, 0xffffff, hex); } this.ring(x, this.h(x, z) + 0.1, z, 1.4, null, hex, 0.22); }
  update(dt) { const d = this.d, c = this.c, c2 = this.c2, P = this.p, C = this.pcol; let n = 0;
    for (let i = 0; i < NP; i++) { const o = i * 12, life = P[o + 8]; if (life <= 0) continue; const age = (P[o + 9] += dt); if (age >= life) { P[o + 8] = 0; continue; } const k = Math.max(0, 1 - P[o + 7] * dt); P[o + 3] *= k; P[o + 5] *= k; P[o + 4] = P[o + 4] * k - P[o + 6] * dt; P[o] += P[o + 3] * dt; P[o + 1] += P[o + 4] * dt; P[o + 2] += P[o + 5] * dt;
      const g = this.h(P[o], P[o + 2]) + 0.06; if (P[o + 1] < g) { P[o + 1] = g; P[o + 4] *= -0.35; P[o + 3] *= 0.6; P[o + 5] *= 0.6; }
      const u = age / life, s = P[o + 10] * (u < 0.15 ? 0.5 + u / 0.3 : 1 - (u - 0.15) / 0.85 * 0.85); d.position.set(P[o], P[o + 1], P[o + 2]); d.rotation.set(0, P[o + 11] + age * 3, 0); d.scale.set(s, s, s); d.updateMatrix(); this.pm.setMatrixAt(n, d.matrix);
      const q = i * 6; c.setRGB(C[q], C[q + 1], C[q + 2]); c2.setRGB(C[q + 3], C[q + 4], C[q + 5]); c.lerp(c2, Math.min(1, u * 2.2)); this.pm.setColorAt(n, c); n++; }
    this.pm.count = n; this.pm.instanceMatrix.needsUpdate = true; this.pm.instanceColor.needsUpdate = true;
    n = 0; for (const o of this.b) { if (!o.on) continue; o.t += dt; const f = o.t / o.dur; if (f >= 1) { o.on = false; continue; } const dx = o.x2 - o.x, dy = o.y2 - o.y, dz = o.z2 - o.z, L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, fade = 1 - f;
      for (let k = 0; k < 2; k++) { const w = o.w * (k ? 0.45 : 1) * fade; d.position.set(o.x + dx / 2, o.y + dy / 2, o.z + dz / 2); d.rotation.set(0, 0, 0); d.lookAt(o.x2, o.y2, o.z2); d.scale.set(w, w, L); d.updateMatrix(); this.bm.setMatrixAt(n, d.matrix); this.bm.setColorAt(n, c.setHex(k ? o.a : o.b)); n++; } }
    this.bm.count = n; this.bm.instanceMatrix.needsUpdate = true; this.bm.instanceColor.needsUpdate = true;
    n = 0; for (const o of this.r) { if (!o.on) continue; o.t += dt; const f = o.t / o.dur; if (f >= 1) { o.on = false; continue; } const e = 1 - (1 - f) * (1 - f), r = o.r * (0.2 + 0.8 * e), fade = 1 - f; d.rotation.set(0, 0, 0); d.position.set(o.x, o.y, o.z); d.scale.set(r, 1, r); d.updateMatrix(); this.rm.setMatrixAt(n, d.matrix); this.rm.setColorAt(n, c.setHex(o.b).lerp(c2.setHex(o.a), fade * 0.6).multiplyScalar(fade * 0.8)); d.position.y -= 0.03; d.updateMatrix(); this.dm.setMatrixAt(n, d.matrix); this.dm.setColorAt(n, c.setHex(o.b).multiplyScalar(fade * fade * 0.3)); n++; }
    this.rm.count = this.dm.count = n; for (const m of [this.rm, this.dm]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    n = 0; for (const o of this.s) { if (!o.on) continue; o.t += dt; const f = o.t / o.dur; if (f >= 1) { o.on = false; continue; } const fade = 1 - f, sweep = (f - 0.5) * 2 * Math.max(0, o.arc - 0.6); d.rotation.set(0, o.yaw + sweep, 0); d.position.set(o.x, o.y + 0.7, o.z); d.scale.set(o.r, 1, o.r); d.updateMatrix(); this.sm.setMatrixAt(n, d.matrix); this.sm.setColorAt(n, c.setHex(o.b).lerp(c2.setHex(o.a), fade).multiplyScalar(0.3 + 0.7 * fade)); n++; }
    this.sm.count = n; this.sm.instanceMatrix.needsUpdate = true; this.sm.instanceColor.needsUpdate = true; }
}
void ELS;
