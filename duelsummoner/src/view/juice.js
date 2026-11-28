// The loud layer of attack effects. View only: it reads the sim's effect records (ring, fan, bolt) and the hit and kill events, and draws each element's own look on top of them.
// The vocabulary is the Fusion Lab's: neon block bits with a glow halo and white sparkles, solid debris that bounces, soft glow flashes, rings whose bits shoot outward,
// three-layer slash arcs for melee, spikes that rise out of the ground, jagged zaps, thick two-layer beams, and one own shape per element
// (fire columns and meteor streaks, ice spike rings, lightning pillars, poison bubbles, wind swirls, earth spikes and rubble, light rays, dark motes that fall inward).
// A short indigo scorch under each blast keeps the neon readable on pale sand and snow.
// Comfort: nothing fills the screen, nothing strobes; every piece is short and fades. Pools are fixed, so a horde costs no more than the pool.
const T = window.THREE;
// per element: core colour, neon body colour, and how its bits move (up: start lift, g: gravity (negative rises), drag, spread speed (negative falls inward), life, size)
export const EL = {
  fire: { a: 0xfff2a8, b: 0xff6a1a, up: 3.6, g: -6, drag: 1.6, sp: 3.4, life: 0.6, size: 0.44 },
  ice: { a: 0xf2fdff, b: 0x7fe9ff, up: 4.4, g: 16, drag: 0.4, sp: 4.8, life: 0.65, size: 0.36 },
  lightning: { a: 0xffffff, b: 0xfff04a, up: 2.2, g: 4, drag: 3.2, sp: 9.5, life: 0.24, size: 0.3 },
  poison: { a: 0xd6ff8a, b: 0x39ff14, up: 1.6, g: -2.6, drag: 2.2, sp: 2.4, life: 0.9, size: 0.44 },
  wind: { a: 0xffffff, b: 0xc8fff0, up: 0.8, g: -1, drag: 0.8, sp: 7.5, life: 0.42, size: 0.28 },
  earth: { a: 0xffd890, b: 0xd59a4a, up: 5.4, g: 22, drag: 0.2, sp: 4.4, life: 0.75, size: 0.5 },
  light: { a: 0xffffff, b: 0xfff3b0, up: 6.2, g: -3, drag: 2.4, sp: 2.6, life: 0.5, size: 0.34 },
  dark: { a: 0xe0b8ff, b: 0x8a4cff, up: 1.0, g: 0, drag: 1.2, sp: -4.2, life: 0.5, size: 0.4 },
};
const BIT = { 1: 'fire', 2: 'lightning', 4: 'ice', 8: 'poison', 16: 'wind', 32: 'earth', 64: 'light', 128: 'dark' };
const NP = 3000, NB = 40, NR = 48, NS = 20, NK = 200, NF = 48, NM = 220, ST = 13, SCORCH = 0x140a2c;
let seed = 1; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const add = (geo, n, opts) => { const m = new T.InstancedMesh(geo, new T.MeshBasicMaterial(Object.assign({ color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }, opts || {})), n); m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(n * 3), 3); m.frustumCulled = false; m.count = 0; m.renderOrder = 6; return m; };
const free = (list, n) => list.find(q => !q.on) || list[(rnd() * n) | 0];
export class Juice {
  constructor(scene, heightAt, shake) {
    this.h = heightAt || (() => 0); this.shake = shake || (() => {}); this.d = new T.Object3D(); this.c = new T.Color(); this.c2 = new T.Color(); this.seen = new WeakMap(); this.amount = 1;
    const box = new T.BoxGeometry(1, 1, 1);
    // bits: a solid bright block (reads on any ground) and, for the neon ones, an added halo block round it
    this.pm = add(box, NP, { transparent: false, blending: T.NormalBlending, depthWrite: true }); scene.add(this.pm);
    this.hm = add(box, NP, { opacity: 0.32 }); scene.add(this.hm);
    this.p = new Float32Array(NP * ST); this.pcol = new Float32Array(NP * 6); this.ph = 0;       // x y z vx vy vz g drag life age size spin glow | colour a, colour b
    // beams: a white core in a coloured sleeve
    this.bm = add(box, NB * 2, { blending: T.NormalBlending, opacity: 0.92 }); scene.add(this.bm); this.b = []; for (let i = 0; i < NB; i++) this.b.push({ on: false });
    // shock rings, ground glow discs, and the indigo scorch under them
    const rg = new T.RingGeometry(0.8, 1, 44); rg.rotateX(-Math.PI / 2); this.rm = add(rg, NR, { side: T.DoubleSide }); scene.add(this.rm);
    const dg = new T.CircleGeometry(1, 30); dg.rotateX(-Math.PI / 2); this.dm = add(dg, NR, { side: T.DoubleSide, opacity: 0.55 }); scene.add(this.dm);
    this.km = add(dg, NR, { side: T.DoubleSide, blending: T.NormalBlending, opacity: 0.42 }); this.km.renderOrder = 5; scene.add(this.km); this.r = []; for (let i = 0; i < NR; i++) this.r.push({ on: false });
    // LED rings: a neon ring under every summon and the card, breathing with the beat
    const lg = new T.RingGeometry(0.84, 1, 36); lg.rotateX(-Math.PI / 2); this.lm = add(lg, 24, { side: T.DoubleSide, depthTest: false }); scene.add(this.lm); this.ln = 0; this.lp = 0;
    // swipes: a crescent swept through the fan
    const sg = new T.RingGeometry(0.5, 1, 20, 1, -0.6, 1.2); sg.rotateX(-Math.PI / 2); this.sm = add(sg, NS, { side: T.DoubleSide }); scene.add(this.sm); this.s = []; for (let i = 0; i < NS; i++) this.s.push({ on: false });
    // spikes: blocks that shoot up out of the ground, hold, and sink
    this.xm = add(box, NK, { transparent: false, blending: T.NormalBlending, depthWrite: true }); scene.add(this.xm); this.xh = add(box, NK, { opacity: 0.4 }); scene.add(this.xh); this.k = []; for (let i = 0; i < NK; i++) this.k.push({ on: false });
    // motes: small glowing blocks that float round the duelist and swell with the beat (the vision look)
    this.mm = add(box, NM, { opacity: 0.8 }); for (let i = 0; i < NM; i++) this.mm.setColorAt(i, this.c.setHSL((i * 0.618) % 1, 0.8, 0.6)); this.mm.instanceColor.needsUpdate = true; scene.add(this.mm);
    // flashes: soft round glows
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const tex = new T.CanvasTexture(cv); this.f = []; for (let i = 0; i < NF; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, blending: T.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0 })); sp.visible = false; sp.renderOrder = 7; scene.add(sp); this.f.push({ sp, l: 0 }); } this.fi = 0;
  }
  // one bit. glow: 1 draws the halo too. delay: seconds before it appears
  _p(x, y, z, vx, vy, vz, g, drag, life, size, ca, cb, glow, delay) { const i = this.ph, o = i * ST, P = this.p; this.ph = (i + 1) % NP; P[o] = x; P[o + 1] = y; P[o + 2] = z; P[o + 3] = vx; P[o + 4] = vy; P[o + 5] = vz; P[o + 6] = g; P[o + 7] = drag; P[o + 8] = life; P[o + 9] = -(delay || 0); P[o + 10] = size; P[o + 11] = rnd() * 6.28; P[o + 12] = glow ? 1 : 0; const C = this.pcol, q = i * 6; this.c.setHex(ca); C[q] = this.c.r; C[q + 1] = this.c.g; C[q + 2] = this.c.b; this.c.setHex(cb); C[q + 3] = this.c.r; C[q + 4] = this.c.g; C[q + 5] = this.c.b; }
  _style(el, color) { return EL[el] || { a: 0xffffff, b: color || 0xffc060, up: 3, g: 9, drag: 1, sp: 4, life: 0.45, size: 0.26 }; }
  _n(n) { return Math.max(1, Math.round(n * this.amount)); }
  flash(x, y, z, hex, size, life) { const f = this.f[this.fi]; this.fi = (this.fi + 1) % NF; f.l = f.L = life || 0.2; f.s = size; f.sp.position.set(x, y, z); f.sp.material.color.setHex(hex); f.sp.visible = true; }
  spike(x, z, w, h, hex, life, delay) { const o = free(this.k, NK); o.on = true; o.t = -(delay || 0); o.dur = life; o.x = x; o.z = z; o.y = this.h(x, z); o.w = w; o.hh = h; o.hex = hex; o.yaw = rnd() * 3; }
  // n bits of an element thrown out from a point; k scales speed and size. One in five is a white sparkle.
  burst(x, y, z, el, n, k, color) { const S = this._style(el, color); n = this._n(n); k = k || 1;
    for (let i = 0; i < n; i++) { const a = rnd() * 6.2832, s = Math.abs(S.sp) * (0.35 + rnd() * 0.75) * k, inw = S.sp < 0, ox = inw ? Math.cos(a) * 1.8 * k : 0, oz = inw ? Math.sin(a) * 1.8 * k : 0, w = rnd() < 0.2;
      this._p(x + ox + (rnd() - 0.5) * 0.3, y + rnd() * 0.5, z + oz + (rnd() - 0.5) * 0.3, Math.cos(a) * s * (inw ? -1 : 1), S.up * (0.5 + rnd()) * (0.7 + 0.3 * k), Math.sin(a) * s * (inw ? -1 : 1), S.g, S.drag, S.life * (0.7 + rnd() * 0.6), S.size * (0.7 + rnd() * 0.7) * (0.8 + 0.2 * k), w ? 0xffffff : S.a, w ? 0xffffff : S.b, 1); } }
  // solid rubble: tumbles, bounces, never glows
  debris(x, y, z, n, hex, sp, size) { n = this._n(n); for (let i = 0; i < n; i++) { const a = rnd() * 6.2832, s = (sp || 4) * (0.4 + rnd() * 0.8); this._p(x + (rnd() - 0.5) * 0.5, y + rnd() * 0.8, z + (rnd() - 0.5) * 0.5, Math.cos(a) * s, 4 + rnd() * 6, Math.sin(a) * s, 24, 0.2, 0.45 + rnd() * 0.35, (size || 0.3) * (0.6 + rnd() * 0.8), hex, hex, 0); } }
  // a ring of bits that shoots outward along the ground to radius r over the ring's life
  wave(x, y, z, r, el, color, life, n) { const S = this._style(el, color); n = this._n(n || Math.min(46, 10 + r * 7)); const v = r / life;
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832 + rnd() * 0.2, w = rnd() < 0.2; this._p(x + Math.cos(a) * 0.3, y + 0.25, z + Math.sin(a) * 0.3, Math.cos(a) * v, 1 + rnd() * 2.5, Math.sin(a) * v, 3, 0, life * (0.85 + rnd() * 0.3), S.size * (0.8 + rnd() * 0.5), w ? 0xffffff : S.a, w ? 0xffffff : S.b, 1); } }
  // a jagged line of standing bits with a flash at the far end
  zap(x, y, z, x2, y2, z2, hex) { const dx = x2 - x, dy = y2 - y, dz = z2 - z, L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, n = Math.max(5, Math.min(40, Math.round(L * 2.2 * this.amount))); let ox = 0, oy = 0, oz = 0;
    for (let i = 0; i <= n; i++) { const t = i / n; if (i % 2 === 0) { ox = (rnd() - 0.5) * 1.1; oy = (rnd() - 0.5) * 0.8; oz = (rnd() - 0.5) * 1.1; } const e = Math.sin(t * Math.PI), w = i % 3 === 0; this._p(x + dx * t + ox * e, y + dy * t + oy * e, z + dz * t + oz * e, 0, 0, 0, 0, 0, 0.16 + rnd() * 0.08, 0.3, w ? 0xffffff : hex, w ? 0xffffff : hex, 1); }
    this.flash(x2, y2, z2, hex, 3.4, 0.2); }
  beam(x, y, z, x2, y2, z2, el, color, w) { const S = this._style(el, color), thin = el === 'lightning' || (w && w < 0.3);
    if (thin) { this.zap(x, y, z, x2, y2, z2, S.b); this.zap(x, y + 0.2, z, x2, y2, z2, S.b); }
    const o = free(this.b, NB); Object.assign(o, { on: true, t: 0, dur: thin ? 0.14 : 0.26, x, y, z, x2, y2, z2, a: 0xffffff, b: S.b, w: thin ? 0.22 : (w || (el === 'light' ? 0.9 : 0.6)) });
    const dx = x2 - x, dy = y2 - y, dz = z2 - z, L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, n = this._n(Math.min(30, 4 + L * 1.5));
    if (!thin) for (let i = 0; i < n; i++) { const f = rnd(), wv = rnd() < 0.3; this._p(x + dx * f, y + dy * f + rnd() * 0.4, z + dz * f, (rnd() - 0.5) * 3, 1.5 + rnd() * 3, (rnd() - 0.5) * 3, 7, S.drag, 0.25 + rnd() * 0.3, S.size * 0.8, wv ? 0xffffff : S.a, wv ? 0xffffff : S.b, 1); }
    this.flash(x, y, z, S.b, 2.2, 0.14); this.flash(x2, y2, z2, S.b, thin ? 3 : 4.4, 0.22); this.burst(x2, y2, z2, el, thin ? 10 : 22, 1.3, color); this.ring(x2, this.h(x2, z2) + 0.12, z2, thin ? 1.2 : 1.8, el, color, 0.24); }
  ring(x, y, z, r, el, color, dur, scorch) { const S = this._style(el, color), o = free(this.r, NR); Object.assign(o, { on: true, t: 0, dur: dur || 0.38, x, y, z, r, a: S.a, b: S.b, sc: scorch ? 1 : 0 }); }
  // melee: three layered arcs of bits fly through the fan, the middle one white, under a bright crescent
  swipe(x, y, z, r, dx, dz, arc, el, color) { const S = this._style(el, color), o = free(this.s, NS), half = Math.min(3.1, (arc || 90) * Math.PI / 360); Object.assign(o, { on: true, t: 0, dur: 0.22, x, y, z, r, yaw: Math.atan2(-dz, dx), arc: half, a: S.a, b: S.b });
    const a0 = Math.atan2(dz, dx);
    for (let j = 0; j < 3; j++) { const rr = r * (0.55 + 0.22 * j), n = this._n(9 + j * 5); for (let i = 0; i < n; i++) { const a = a0 - half + 2 * half * (n > 1 ? i / (n - 1) : 0.5), ca = Math.cos(a), sa = Math.sin(a), tv = 5 + j * 2.4, hex = j === 1 ? 0xffffff : S.b;
        this._p(x + ca * rr, y + 0.5 + j * 0.45 + rnd() * 0.2, z + sa * rr, -sa * tv + ca * 2.4, 0.8 + rnd() * 1.6, ca * tv + sa * 2.4, 3, 0.6, 0.22 + (i / n) * 0.14, 0.42 - j * 0.07, hex, hex, 1, (i / n) * 0.06); } }
    this.flash(x + dx * r * 0.7, y + 1, z + dz * r * 0.7, S.b, r * 1.5, 0.16); }
  motes(px, py, pz, t, pulse, v, cx, cy, cz) { if (v < 0.03) { this.mm.count = 0; return; } const d = this.d; for (let i = 0; i < NM; i++) { const u = i / NM, a = u * 40 + t * 0.12 * (i % 2 ? 1 : -1), r = 6 + ((i * 37) % 240) / 6, y = ((u * 13 + t * 0.02 * (1 + (i % 5))) % 1) * 20, x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r, my = Math.max(py, this.h(x, z)) + 0.6 + y, cd = Math.abs(x - cx) + Math.abs(my - cy) + Math.abs(z - cz), s = (0.1 + (i % 4) * 0.05) * (1 + 0.5 * pulse) * v * Math.min(1, Math.max(0, (cd - 3) / 5)); d.position.set(x, my, z); d.rotation.set(t + i, t * 0.7 + i, 0); d.scale.set(s, s, s); d.updateMatrix(); this.mm.setMatrixAt(i, d.matrix); } this.mm.count = NM; this.mm.instanceMatrix.needsUpdate = true; }
  ledBegin(pulse) { this.ln = 0; this.lp = pulse; }
  led(x, y, z, r, hex) { if (this.ln >= 24) return; const d = this.d, k = 0.92 + 0.16 * this.lp; d.rotation.set(0, 0, 0); d.position.set(x, y + 0.3, z); d.scale.set(r * k, 1, r * k); d.updateMatrix(); this.lm.setMatrixAt(this.ln, d.matrix); this.lm.setColorAt(this.ln, this.c.setHex(hex).multiplyScalar(0.45 + 0.55 * this.lp)); this.ln++; }
  ledEnd() { this.lm.count = this.ln; this.lm.instanceMatrix.needsUpdate = true; this.lm.instanceColor.needsUpdate = true; }
  // a blast on the ground: flash, scorch, shock ring, a wave of bits, and the element's own shape
  blast(x, y, z, r, el, color, dur) { const S = this._style(el, color), big = r >= 4, gy = this.h(x, z), A = this.amount;
    this.ring(x, y + 0.1, z, r, el, color, Math.max(0.32, dur), 1); this.flash(x, gy + 1, z, S.b, Math.min(14, r * 2.4), Math.min(0.4, Math.max(0.2, dur))); this.wave(x, gy, z, r, el, color, Math.max(0.3, dur));
    if (el === 'fire') { const n = this._n(big ? 34 : 14); for (let i = 0; i < n; i++) { const a = rnd() * 6.2832, rr = r * 0.45 * rnd(), w = rnd() < 0.2; this._p(x + Math.cos(a) * rr, gy + 0.2, z + Math.sin(a) * rr, Math.cos(a) * 1.2, 5 + rnd() * (big ? 10 : 6), Math.sin(a) * 1.2, -4, 1.4, 0.5 + rnd() * 0.5, 0.4 + rnd() * 0.4, w ? 0xffffff : 0xffd060, w ? 0xffffff : S.b, 1, rnd() * 0.12); }
      if (big) { for (let q = 0; q < this._n(10); q++) this._p(x + 5 - q * 0.45, gy + 11 - q * 1.0, z - q * 0.15, -42, -92, 0, 0, 0, 0.12, 0.7 - q * 0.04, q < 3 ? 0xffffff : 0xffd060, q < 3 ? 0xffffff : S.b, 1); this.debris(x, gy, z, 10, 0x3a2418, 6, 0.3); this.shake(0.2); } }
    else if (el === 'ice') { const n = Math.round((big ? 12 : 6) * A); for (let j = 0; j < n; j++) { const a = (j / n) * 6.2832 + rnd() * 0.4, rr = r * (big ? 0.92 : 0.6 + rnd() * 0.3); this.spike(x + Math.cos(a) * rr, z + Math.sin(a) * rr, 0.5 + rnd() * 0.3, 1.4 + rnd() * (big ? 2.6 : 1.4), j % 3 ? S.b : 0xffffff, big ? 1.1 : 0.6, j * 0.012); } this.burst(x, gy + 0.6, z, el, big ? 22 : 10, 1.2); if (big) this.shake(0.14); }
    else if (el === 'lightning') { this.spike(x, z, 0.4, 16, 0xffffff, 0.14); this.spike(x + 0.4, z + 0.2, 0.24, 16, S.b, 0.2); this.burst(x, gy + 0.8, z, el, big ? 20 : 12, 1.4); this.flash(x, gy + 5, z, 0xffffff, 5, 0.12); if (r >= 2.4) this.shake(0.1); }
    else if (el === 'poison') { const n = this._n(big ? 46 : 16); for (let i = 0; i < n; i++) { const a = rnd() * 6.2832, rr = r * Math.sqrt(rnd()), w = rnd() < 0.15; this._p(x + Math.cos(a) * rr, gy + 0.15, z + Math.sin(a) * rr, 0, 1.2 + rnd() * 2.2, 0, -1.5, 0.6, 0.6 + rnd() * 0.7, 0.28 + rnd() * 0.36, w ? 0xffffff : S.a, w ? 0xffffff : S.b, 1, rnd() * (big ? 1.2 : 0.4)); } }
    else if (el === 'wind') { const n = this._n(big ? 40 : 18); for (let i = 0; i < n; i++) { const a = rnd() * 6.2832, rr = r * (0.3 + rnd() * 0.7), v = 9 + rnd() * 5; this._p(x + Math.cos(a) * rr, gy + 0.3 + rnd() * (big ? 5 : 2.2), z + Math.sin(a) * rr, -Math.sin(a) * v, 2.4, Math.cos(a) * v, 0, 1.2, 0.42, 0.26, i % 4 ? S.b : 0xffffff, i % 4 ? S.b : 0xffffff, 1, rnd() * 0.15); } if (big) this.shake(0.18); }
    else if (el === 'earth') { const n = Math.round((big ? 9 : 5) * A); for (let j = 0; j < n; j++) { const a = rnd() * 6.2832, rr = r * 0.7 * Math.sqrt(rnd()); this.spike(x + Math.cos(a) * rr, z + Math.sin(a) * rr, 0.7 + rnd() * 0.5, 1 + rnd() * 1.8, j % 3 ? S.b : 0x6a5030, 0.9, j * 0.02); } this.debris(x, gy, z, big ? 16 : 9, 0x8a6238, 5, 0.34); this.shake(big ? 0.16 : 0.08); }
    else if (el === 'light') { const n = Math.round((big ? 10 : 5) * A); for (let j = 0; j < n; j++) { const a = (j / n) * 6.2832, rr = r * 0.55; this.spike(x + Math.cos(a) * rr, z + Math.sin(a) * rr, 0.16, 5 + rnd() * 3, j % 2 ? S.b : 0xffffff, 0.3, j * 0.02); } this.burst(x, gy + 0.6, z, el, big ? 22 : 10, 1.2); }
    else if (el === 'dark') { const n = this._n(big ? 44 : 18); for (let i = 0; i < n; i++) { const a = rnd() * 6.2832, rr = r * (0.8 + rnd() * 0.3); this._p(x + Math.cos(a) * rr, gy + 0.4 + rnd() * 2, z + Math.sin(a) * rr, -Math.cos(a) * rr * 2.2, 0.5, -Math.sin(a) * rr * 2.2, 0, 0, 0.42, 0.34, i % 5 ? S.b : 0xe0b8ff, i % 5 ? S.b : 0xffffff, 1, rnd() * 0.1); } if (big) this.shake(0.22); }
    else this.burst(x, gy + 0.5, z, el, Math.min(30, 8 + r * 4), 1.1, color); }
  // one sim effect record, the first time it is seen (a pooled record that restarts counts as new)
  rec(o) { const prev = this.seen.get(o); this.seen.set(o, o.t); if (prev !== undefined && o.t >= prev) return; if (o.owner !== 0 || o.dur >= 1 || o.type === 'wake') return; const el = o.el, col = o.color;
    if (o.type === 'bolt') { this.beam(o.x, o.y, o.z, o.x2, o.y2, o.z2, el, col, o.w ? o.w * 2.4 : 0); return; }
    if (o.type === 'fan') { this.swipe(o.x, o.y, o.z, o.r, o.dx, o.dz, o.arc, el, col); return; }
    if (o.type === 'ring' && !o.vr) this.blast(o.x, o.y, o.z, o.r, el, col, o.dur); }
  hit(x, y, z, mask, crit) { let el = null; for (const b in BIT) if (mask & b) { el = BIT[b]; break; } this.burst(x, y, z, el, crit ? 12 : 5, crit ? 1.4 : 1, 0xffe6b0); if (crit) { const S = this._style(el, 0xffe6b0); this.flash(x, y + 0.3, z, S.b, 3, 0.16); this.ring(x, this.h(x, z) + 0.12, z, 1.4, el, 0xffe6b0, 0.2); } }
  kill(x, y, z, hex) { this.flash(x, y + 0.6, z, 0xfff0d0, 2.6, 0.18); this.debris(x, y, z, 5, hex, 4.5, 0.22); const n = this._n(5); for (let i = 0; i < n; i++) { const a = rnd() * 6.2832, s = 3 + rnd() * 4; this._p(x, y + 0.6, z, Math.cos(a) * s, 4 + rnd() * 4, Math.sin(a) * s, 16, 0.4, 0.4 + rnd() * 0.2, 0.22, 0xffffff, 0xffe6b0, 1); } this.ring(x, this.h(x, z) + 0.1, z, 1.5, null, hex, 0.24); }
  update(dt) { const d = this.d, c = this.c, c2 = this.c2, P = this.p, C = this.pcol; let n = 0, nh = 0;
    for (let i = 0; i < NP; i++) { const o = i * ST, life = P[o + 8]; if (life <= 0) continue; const age = (P[o + 9] += dt); if (age < 0) continue; if (age >= life) { P[o + 8] = 0; continue; } const k = Math.max(0, 1 - P[o + 7] * dt); P[o + 3] *= k; P[o + 5] *= k; P[o + 4] = P[o + 4] * k - P[o + 6] * dt; P[o] += P[o + 3] * dt; P[o + 1] += P[o + 4] * dt; P[o + 2] += P[o + 5] * dt;
      const g = this.h(P[o], P[o + 2]) + 0.08; if (P[o + 1] < g) { P[o + 1] = g; P[o + 4] *= -0.45; P[o + 3] *= 0.7; P[o + 5] *= 0.7; }
      const u = age / life, s = P[o + 10] * Math.min(1, (1 - u) * 2.5); d.position.set(P[o], P[o + 1], P[o + 2]); d.rotation.set(age * 7 + P[o + 11], age * 5, 0); d.scale.set(s, s, s); d.updateMatrix(); this.pm.setMatrixAt(n, d.matrix);
      const q = i * 6; c.setRGB(C[q], C[q + 1], C[q + 2]); c2.setRGB(C[q + 3], C[q + 4], C[q + 5]); c.lerp(c2, Math.min(1, u * 2.2)); this.pm.setColorAt(n, c); n++;
      if (P[o + 12]) { d.scale.set(s * 2.1, s * 2.1, s * 2.1); d.updateMatrix(); this.hm.setMatrixAt(nh, d.matrix); this.hm.setColorAt(nh, c2); nh++; } }
    this.pm.count = n; this.hm.count = nh; for (const m of [this.pm, this.hm]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    n = 0; for (const o of this.b) { if (!o.on) continue; o.t += dt; const f = o.t / o.dur; if (f >= 1) { o.on = false; continue; } const dx = o.x2 - o.x, dy = o.y2 - o.y, dz = o.z2 - o.z, L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, fade = 1 - f;
      for (let k = 0; k < 2; k++) { const w = o.w * (k ? 0.45 : 1) * fade; d.position.set(o.x + dx / 2, o.y + dy / 2, o.z + dz / 2); d.rotation.set(0, 0, 0); d.lookAt(o.x2, o.y2, o.z2); d.scale.set(w, w, L); d.updateMatrix(); this.bm.setMatrixAt(n, d.matrix); this.bm.setColorAt(n, c.setHex(k ? o.a : o.b)); n++; } }
    this.bm.count = n; this.bm.instanceMatrix.needsUpdate = true; this.bm.instanceColor.needsUpdate = true;
    n = 0; let nk = 0; for (const o of this.r) { if (!o.on) continue; o.t += dt; const f = o.t / o.dur; if (f >= 1) { o.on = false; continue; } const e = 1 - (1 - f) * (1 - f), r = o.r * (0.2 + 0.8 * e), fade = 1 - f; d.rotation.set(0, 0, 0); d.position.set(o.x, o.y, o.z); d.scale.set(r, 1, r); d.updateMatrix(); this.rm.setMatrixAt(n, d.matrix); this.rm.setColorAt(n, c.setHex(o.b).lerp(c2.setHex(o.a), fade * 0.6).multiplyScalar(fade)); d.position.y -= 0.03; d.updateMatrix(); this.dm.setMatrixAt(n, d.matrix); this.dm.setColorAt(n, c.setHex(o.b).multiplyScalar(fade * fade * 0.5)); n++;
      if (o.sc) { const kr = o.r * 1.08 * Math.min(1, fade * 3); d.position.y -= 0.02; d.scale.set(kr, 1, kr); d.updateMatrix(); this.km.setMatrixAt(nk, d.matrix); this.km.setColorAt(nk, c.setHex(SCORCH)); nk++; } }
    this.rm.count = this.dm.count = n; this.km.count = nk; for (const m of [this.rm, this.dm, this.km]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    n = 0; for (const o of this.s) { if (!o.on) continue; o.t += dt; const f = o.t / o.dur; if (f >= 1) { o.on = false; continue; } const fade = 1 - f, sweep = (f - 0.5) * 2 * Math.max(0, o.arc - 0.6); d.rotation.set(0, o.yaw + sweep, 0); d.position.set(o.x, o.y + 0.7, o.z); d.scale.set(o.r, 1, o.r); d.updateMatrix(); this.sm.setMatrixAt(n, d.matrix); this.sm.setColorAt(n, c.setHex(o.b).lerp(c2.setHex(o.a), fade).multiplyScalar(0.3 + 0.7 * fade)); n++; }
    this.sm.count = n; this.sm.instanceMatrix.needsUpdate = true; this.sm.instanceColor.needsUpdate = true;
    n = 0; for (const o of this.k) { if (!o.on) continue; o.t += dt; if (o.t < 0) continue; const f = o.t / o.dur; if (f >= 1) { o.on = false; continue; } const up = Math.min(1, o.t / 0.07) * (f > 0.7 ? (1 - f) / 0.3 : 1), hh = Math.max(0.01, o.hh * up); d.rotation.set(0, o.yaw, 0); d.position.set(o.x, o.y + hh / 2 - 0.15, o.z); d.scale.set(o.w, hh, o.w); d.updateMatrix(); this.xm.setMatrixAt(n, d.matrix); this.xm.setColorAt(n, c.setHex(o.hex)); d.scale.set(o.w * 1.9, hh * 1.03, o.w * 1.9); d.updateMatrix(); this.xh.setMatrixAt(n, d.matrix); this.xh.setColorAt(n, c); n++; }
    this.xm.count = this.xh.count = n; for (const m of [this.xm, this.xh]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    const fk = 0.5 + 0.5 * this.amount; for (const f of this.f) { if (f.l <= 0) continue; f.l -= dt; const k = Math.max(0, f.l / f.L); f.sp.material.opacity = k * 0.85 * fk; f.sp.scale.setScalar(f.s * (1.3 - k * 0.3)); if (f.l <= 0) f.sp.visible = false; } }
}
