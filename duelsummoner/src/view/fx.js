// Game-feel effects. View only: nothing here reads or changes the rules, everything is fed from the sim's event queue and from
// state changes the view notices. Every pool is fixed size and allocated once (particles 4000, damage numbers 64, rings 48,
// beams 4, flipping cards 12), so steady state allocates nothing per frame.
const T = window.THREE;
import { RAMP } from '../data/fxramp.js';
import { FX } from './fxkit.js';
import { StopBudget, FlashGate, ShakeBudget, MomentDirector } from './director.js';

// damage number colours by element, from the one effect ramp (bright tone): fire, lightning, ice, poison, wind, earth, light, dark (index = bit + 1, as the hit flags carry them)
const hexStr = c => '#' + c.toString(16).padStart(6, '0');
const ELEM_COL = [null, ...['fire', 'lightning', 'ice', 'poison', 'wind', 'earth', 'light', 'dark'].map(e => hexStr(RAMP[e][1]))];
// a card back in two flat tones (no texture, no gold): a dark ink border slab and a raised slate face, in the 5:7 card shape, with a small diamond facet on the face
function cardBack() {
  const parts = [[new T.BoxGeometry(0.46, 0.03, 0.64), [0.11, 0.1, 0.09]], [new T.BoxGeometry(0.34, 0.05, 0.52), [0.29, 0.32, 0.38]], [new T.BoxGeometry(0.12, 0.07, 0.16), [0.11, 0.1, 0.09]]], pos = [], col = [], nor = [];
  for (const [g0, c] of parts) { const g1 = g0.toNonIndexed(), p = g1.attributes.position.array, n = g1.attributes.normal.array; for (let i = 0; i < p.length; i += 3) { pos.push(p[i], p[i + 1], p[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]); col.push(c[0], c[1], c[2]); } }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); return g;
}
export const POOL = { particles: 4096, numbers: 64, rings: 48, beams: 4, cards: 12 };

export class Fx {
  constructor(scene, settings) {
    this.scene = scene; this.settings = settings || { reduceMotion: false, shake: 100 };
    this.d = new T.Object3D(); this.col = new T.Color(); this.v = new T.Vector3();
    this.trauma = 0; this.stop = 0; this.flashA = 0; this.flashShown = -1; this.push = 0; this.pushMax = 2;
    this.avgDmg = 3; this.tick = 0; this.stage = 0; this.camDist = 12; this.blocked = false; this.stopB = new StopBudget(); this.flashG = new FlashGate(); this.shakeB = new ShakeBudget(); this.dir = new MomentDirector(); this.stopLog = [];
    this.shakeOff = { x: 0, y: 0, z: 0, roll: 0 };

    // particles: ONE instanced draw, worked out on the GPU (spectacle spec 6.4). A particle is written once, at spawn, into one interleaved buffer of 15 floats (spawn position and birth time, velocity and life,
    // gravity, drag, size and ramp row, an explicit colour used when the row is negative); the vertex shader finds its place from the clock, so nothing is uploaded per frame except the slots spawned that frame.
    const N = POOL.particles; this.N = N; this.head = 0; this.pt = 0; this.pdie = new Float32Array(N).fill(-1); this._lo = N; this._hi = -1; this._wrap = false;
    this.pbuf = new T.InstancedInterleavedBuffer(new Float32Array(N * 15), 15, 1); this.pbuf.setUsage(T.DynamicDrawUsage);
    const pg = new T.InstancedBufferGeometry(); pg.setAttribute('position', new T.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3)); pg.setIndex([0, 1, 2, 0, 2, 3]);
    pg.setAttribute('iP0', new T.InterleavedBufferAttribute(this.pbuf, 4, 0)); pg.setAttribute('iV0', new T.InterleavedBufferAttribute(this.pbuf, 4, 4)); pg.setAttribute('iK', new T.InterleavedBufferAttribute(this.pbuf, 4, 8)); pg.setAttribute('iC', new T.InterleavedBufferAttribute(this.pbuf, 3, 12)); pg.instanceCount = N;
    this.puni = { uTime: { value: 0 }, uRamp: FX.ramp };
    this.pm = new T.Mesh(pg, new T.ShaderMaterial({ uniforms: this.puni, fog: false, stencilWrite: true, stencilRef: 0, stencilFunc: T.EqualStencilFunc, stencilFuncMask: 0x04, stencilWriteMask: 0x00, stencilFail: T.KeepStencilOp, stencilZFail: T.KeepStencilOp, stencilZPass: T.KeepStencilOp,       // a particle never paints over an enemy warning (stencil bit 2)

      vertexShader: 'attribute vec4 iP0; attribute vec4 iV0; attribute vec4 iK; attribute vec3 iC; uniform float uTime; varying vec3 vCol; varying float vU; varying float vRow;\n' +
        'void main() { float t = uTime - iP0.w, u = t / iV0.w; if (t < 0.0 || u >= 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }\n' +
        ' float e = iK.y > 0.0 ? (1.0 - exp(-iK.y * t)) / iK.y : t; vec3 p = iP0.xyz + iV0.xyz * e; p.y -= 0.5 * iK.x * t * t; if (iK.x > 0.0) p.y = max(p.y, 0.05);\n' +
        ' float sz = iK.z * (u < 0.65 ? 1.0 : (1.0 - u) / 0.35); sz = ceil(sz * 16.0) / 16.0; vec4 c = viewMatrix * vec4(p, 1.0); float dd = -c.z; sz = min(sz, 0.03 * dd / projectionMatrix[1][1]) * smoothstep(2.0, 6.0, dd);\n' +
        ' if (-c.z < 2.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }\n' +
        ' c.xy += position.xy * sz; vU = u; vRow = iK.w; vCol = iC; gl_Position = projectionMatrix * c; }',
      fragmentShader: 'uniform sampler2D uRamp; varying vec3 vCol; varying float vU; varying float vRow;\n' +
        'void main() { vec3 c = vRow >= 0.0 ? texture2D(uRamp, vec2((floor(vU * 4.0) + 0.5) / 8.0, (vRow + 0.5) / 8.0)).rgb : vCol; gl_FragColor = vec4(c, 1.0); }' }));
    this.pm.frustumCulled = false; this.pm.count = 0; scene.add(this.pm);
    // rings (flat, additive)
    const R = POOL.rings; this.R = R; this.rh = 0;
    this.rp = new Float32Array(R * 3); this.rr = new Float32Array(R); this.rage = new Float32Array(R); this.rlife = new Float32Array(R); this.rcol = new Float32Array(R * 3); this.ron = new Uint8Array(R);
    const rg = new T.RingGeometry(0.8, 1, 32); rg.rotateX(-Math.PI / 2);
    this.rm = new T.InstancedMesh(rg, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }), R);
    this.rm.instanceColor = new T.InstancedBufferAttribute(new Float32Array(R * 3), 3); this.rm.frustumCulled = false; this.rm.count = 0; scene.add(this.rm);

    // light beams (chest opening, fusion landing)
    this.beams = []; this.bage = new Float32Array(POOL.beams).fill(-1); this.blife = new Float32Array(POOL.beams);
    for (let i = 0; i < POOL.beams; i++) {
      const m = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 40, 10, 1, true), new T.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      m.visible = false; scene.add(m); this.beams.push(m);
    }

    // flipping cards that rise out of an opened chest
    const C = POOL.cards; this.C = C; this.ch = 0;
    this.cdx = new Float32Array(C); this.cdz = new Float32Array(C); this.cp = new Float32Array(C * 3); this.cage = new Float32Array(C); this.clife = new Float32Array(C); this.cspin = new Float32Array(C);
    this.cm = new T.InstancedMesh(cardBack(), new T.MeshBasicMaterial({ vertexColors: true }), C); this.cm.frustumCulled = false; this.cm.count = 0; scene.add(this.cm);

    // damage numbers: sprites with their own tiny canvas, text drawn only when one is spawned
    const M = POOL.numbers; this.M = M; this.nh = 0; this.nsp = []; this.nctx = []; this.ntex = [];
    this.nval = new Float32Array(M); this.nx = new Float32Array(M * 3); this.nage = new Float32Array(M).fill(-1); this.nbig = new Uint8Array(M); this.nvx = new Float32Array(M);
    for (let i = 0; i < M; i++) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 48; const ctx = c.getContext('2d');
      const tex = new T.Texture(c); tex.magFilter = tex.minFilter = T.NearestFilter; tex.generateMipmaps = false;
      const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false })); sp.visible = false; sp.renderOrder = 10; scene.add(sp);
      this.nsp.push(sp); this.nctx.push(ctx); this.ntex.push(tex);
    }
    this.numBudget = 0;
    this.hurtEl = document.getElementById('flash'); this.fxFlash = document.getElementById('fxflash'); this.lowEl = document.getElementById('lowhp');
  }

  get rm_() { return !!this.settings.reduceMotion; }
  get shakeScale() { return this.settings.reduceMotion ? 0 : Math.max(0, Math.min(100, this.settings.shake)) / 100; }

  // ---- triggers ----
  // The big-moment budgets (spec 4.2, view/director.js). Hit-stop is decided from the sim tick only (this.tick, set by main), so every player and every replay gets the same stops at the same ticks; the wait itself is
  // applied for everyone (Reduce motion changes what the screen shows, not whether the stop happens). A flash or shake the budget refuses is dropped, never queued.
  shake(a, hurt) { const s = this.shakeScale; if (s > 0) { const ok = this.shakeB.ask(performance.now(), a * s, hurt); if (ok > 0) this.trauma = Math.min(1, this.trauma + ok); } }
  hitstop(sec) { const ok = this.stopB.ask(this.tick, sec); if (ok > 0) { this.stop = Math.max(this.stop, ok); this.stopLog.push([this.tick, +ok.toFixed(3)]); if (this.stopLog.length > 200) this.stopLog.shift(); } }
  flash(a, hex) { if (this.rm_) return; const ok = this.flashG.ask(performance.now(), a, this.stage); if (ok > 0) { this.flashA = Math.max(this.flashA, ok); if (this.fxFlash) this.fxFlash.style.backgroundColor = '#' + (hex || 0xf3e3c2).toString(16).padStart(6, '0'); } }       // the colour is an element's bright tone, never white; strength is capped by the stage luminance
  // one big moment through the director: parts = { hitstop, shake, flash, hex }; a moment that loses the screen keeps only its world parts (the caller draws those itself)
  // Settings > Big moments: Gentle (chosen, or forced by Reduce motion) skips the impact frames (signature moments), the Tablebreak shift and the boss-fall flash, and halves hit-stop; Full plays them all. this.gentle is set from the setting.
  moment(id, cls, parts, o) { const g = this.dir.request(id, cls, this.tick, Object.assign({ blocked: this.blocked }, o || {})); if (this.gentle && (id === 'tablebreak' || id.startsWith('sig-'))) g.screen = false; if (g.screen && parts) { if (parts.hitstop) this.hitstop(parts.hitstop * (this.gentle ? 0.5 : 1)); if (parts.shake) this.shake(parts.shake); if (parts.flash && !(this.gentle && id === 'gatedown')) this.flash(parts.flash, parts.hex); } return g; }

  // one particle into the ring buffer: written once; the GPU does the rest (see the constructor). row >= 0 takes its colour from the effect ramp by age; row < 0 uses the explicit colour (r, g, b)
  _spawn(x, y, z, vx, vy, vz, life, grav, drag, size, row, r, g, b) {
    const i = this.head, o = i * 15, a = this.pbuf.array; if (i < this._lo) this._lo = i; if (i > this._hi) this._hi = i; this.head = (this.head + 1) % this.N; if (this.head === 0) this._wrap = true;
    a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = this.pt; a[o + 4] = vx; a[o + 5] = vy; a[o + 6] = vz; a[o + 7] = life; a[o + 8] = grav; a[o + 9] = drag; a[o + 10] = size; a[o + 11] = row; a[o + 12] = r; a[o + 13] = g; a[o + 14] = b; this.pdie[i] = this.pt + life;
  }
  burst(x, y, z, n, hex, speed, up, size, life, grav) {
    const c = this.col.setHex(hex);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.2832, r = Math.random() * speed, u = (0.3 + Math.random()) * up, shade = 0.75 + Math.random() * 0.5;
      this._spawn(x, y, z, Math.cos(a) * r, u, Math.sin(a) * r, life * (0.7 + Math.random() * 0.6), grav, 0, size * (0.6 + Math.random() * 0.8), -1, c.r * shade, c.g * shade, c.b * shade);
    }
  }
  // a burst in an element's own ramp row (0 fire, 1 ice, 2 lightning, 3 poison, 4 wind, 5 earth, 6 light, 7 dark): the colour steps core, bright, body, shade over the particle's life
  burstEl(x, y, z, n, row, speed, up, size, life, grav) {
    for (let k = 0; k < n; k++) { const a = Math.random() * 6.2832, r = Math.random() * speed, u = (0.3 + Math.random()) * up; this._spawn(x, y, z, Math.cos(a) * r, u, Math.sin(a) * r, life * (0.7 + Math.random() * 0.6), grav, 0, size * (0.6 + Math.random() * 0.8), row, 0, 0, 0); }
  }
  // one particle with an explicit velocity (trails, dust)
  spark(x, y, z, vx, vy, vz, hex, size, life) { const c = this.col.setHex(hex); this._spawn(x, y, z, vx, vy, vz, life, 0, 0, size, -1, c.r, c.g, c.b); }
  sparkEl(x, y, z, vx, vy, vz, row, size, life) { this._spawn(x, y, z, vx, vy, vz, life, 0, 0, size, row, 0, 0, 0); }  ring(x, y, z, r, hex, life) {
    const i = this.rh, j = i * 3, c = this.col.setHex(hex); this.rh = (this.rh + 1) % this.R;
    this.rp[j] = x; this.rp[j + 1] = y; this.rp[j + 2] = z; this.rr[i] = r; this.rage[i] = 0; this.rlife[i] = life; this.rcol[j] = c.r; this.rcol[j + 1] = c.g; this.rcol[j + 2] = c.b; this.ron[i] = 1;
  }
  beam(x, y, z, hex, life) {
    for (let i = 0; i < this.beams.length; i++) if (this.bage[i] < 0) {
      const m = this.beams[i]; m.position.set(x, y + 20, z); m.material.color.setHex(hex); m.visible = true; this.bage[i] = 0; this.blife[i] = life; return;
    }
  }
  // a ring of n flipping cards that bursts outward from (x, y, z) to radius R and rises (the Cap Burst)
  cardRing(x, y, z, n, R) { for (let k = 0; k < n; k++) { const i = this.ch, j = i * 3, a = k / n * 6.2832; this.ch = (this.ch + 1) % this.C; this.cp[j] = x; this.cp[j + 1] = y + 0.8; this.cp[j + 2] = z; this.cdx[i] = Math.cos(a) * R; this.cdz[i] = Math.sin(a) * R; this.cage[i] = 0; this.clife[i] = 0.9; this.cspin[i] = 7 + (k % 3); } }
  cards(x, y, z, n) {
    for (let k = 0; k < n; k++) { const i = this.ch, j = i * 3; this.ch = (this.ch + 1) % this.C; this.cp[j] = x + (k - (n - 1) / 2) * 0.9; this.cp[j + 1] = y + 0.8; this.cp[j + 2] = z; this.cage[i] = -k * 0.12; this.clife[i] = 1.1; this.cspin[i] = 6 + k; this.cdx[i] = 0; this.cdz[i] = 0; }
  }
  // flags from the sim's hit event: bit 0 crit, bits 1+ the element mask (fire 1, lightning 2, ice 4, poison 8, wind 16, earth 32, light 64, dark 128)
  number(x, y, z, value, flags) {
    // hits on one target within 150 ms merge into one number: the total is redrawn on the number that is still fresh
    for (let i = 0; i < this.M; i++) {
      if (this.nage[i] < 0 || this.nage[i] > 0.4) continue;
      const j = i * 3, dx = this.nx[j] - x, dz = this.nx[j + 2] - z;
      if (dx * dx + dz * dz < 2.25) { this.nage[i] = Math.min(this.nage[i], 0.12); this.nval[i] += value; if (flags & 1) this.nbig[i] = 1; this._paint(i, this.nval[i], this.nbig[i], flags); return; }
    }    let live = 0; for (let k = 0; k < this.M; k++) if (this.nage[k] >= 0) live++; if (live >= 16) return;         // at most 16 numbers on screen
    if (this.numBudget < 1) return; this.numBudget -= 1;
    const big = flags === undefined || flags === null ? value > this.avgDmg * 2.2 + 1 : (flags & 1) === 1; this.avgDmg += (value - this.avgDmg) * 0.05; if (this.dmgMode === 'off' || (this.dmgMode === 'big' && !big)) return;       // Settings > Damage numbers: Off, Big hits (crits and hits well above the average) or All
    const el = flags ? flags >> 1 : 0, col = ELEM_COL[el & 1 ? 1 : el & 2 ? 2 : el & 4 ? 3 : el & 8 ? 4 : el & 16 ? 5 : el & 32 ? 6 : el & 64 ? 7 : el & 128 ? 8 : 0];
    const i = this.nh, j = i * 3; this.nh = (this.nh + 1) % this.M;
    this.nval[i] = value; this._paintAt = null;
    const ctx = this.nctx[i]; ctx.clearRect(0, 0, 128, 48); ctx.font = 'bold ' + (big ? 38 : 28) + 'px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const s = String(Math.max(1, Math.round(value)));
    ctx.lineWidth = 6; ctx.strokeStyle = '#1a0a20'; ctx.strokeText(s, 64, 24); ctx.fillStyle = col || (big ? '#e8f6ff' : '#fff6e0'); ctx.fillText(s, 64, 24); if (big) this._star(ctx, 64 - ctx.measureText(s).width / 2 - 12, 24);
    this.ntex[i].needsUpdate = true;
    this.nlane = ((this.nlane || 0) + 1) % 5;       // five side lanes in turn, plus a little height per lane, so numbers from the same spot never sit on each other
    this.nx[j] = x + (Math.random() - 0.5) * 0.15; this.nx[j + 1] = y + this.nlane * 0.3; this.nx[j + 2] = z + (Math.random() - 0.5) * 0.15; this.nvx[i] = (Math.random() - 0.5) * 0.3;  this.nage[i] = 0; this.nbig[i] = big ? 1 : 0;   // numbers from one spot stack upward instead of spreading sideways
    const sp = this.nsp[i]; sp.visible = true; sp.material.opacity = 1;
  }

  _underHud(px, py) {                                                      // a number never draws over a HUD panel (rects read twice a second)
    const now = performance.now(); if (!this._hudR || now - this._hudT > 500) { this._hudT = now; this._hudR = ['topleft', 'topright', 'zones', 'minimap', 'stats', 'itemsList'].map(id => { const e = document.getElementById(id); return e && e.offsetWidth ? e.getBoundingClientRect() : null; }).filter(Boolean); }
    for (const r of this._hudR) if (px > r.left && px < r.right && py > r.top && py < r.bottom) return true; return false;
  }
  _paint(i, value, big, flags) {                                           // redraw a damage number with its new total
    const ctx = this.nctx[i], el = flags ? flags >> 1 : 0, col = ELEM_COL[el & 1 ? 1 : el & 2 ? 2 : el & 4 ? 3 : el & 8 ? 4 : el & 16 ? 5 : el & 32 ? 6 : el & 64 ? 7 : el & 128 ? 8 : 0], s = String(Math.max(1, Math.round(value)));
    ctx.clearRect(0, 0, 128, 48); ctx.font = 'bold ' + (big ? 38 : 28) + 'px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = '#1a0a20'; ctx.strokeText(s, 64, 24); ctx.fillStyle = col || (big ? '#e8f6ff' : '#fff6e0'); ctx.fillText(s, 64, 24); if (big) this._star(ctx, 64 - ctx.measureText(s).width / 2 - 12, 24); this.ntex[i].needsUpdate = true;
  }
  _star(ctx, x, y) {                                                       // the crit mark: an upright four-point star, ice-white with an ink outline (gold means coin)
    ctx.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? 3.4 : 9.5, a = k * Math.PI / 4 - Math.PI / 2; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath();
    ctx.lineWidth = 3; ctx.strokeStyle = '#1a0a20'; ctx.stroke(); ctx.fillStyle = '#e8f6ff'; ctx.fill();
  }
  // ---- per frame ----
  update(dt, camera) {
    this.numBudget = Math.min(8, this.numBudget + dt * 60);
    // particles: the GPU moves them; here only the clock, the one upload of the slots spawned this frame, and the live count (the tests and the lab read it)
    this.pt += dt; this.puni.uTime.value = this.pt;
    if (this._hi >= 0) { const b = this.pbuf; if (this._wrap) b.updateRange.count = -1; else { b.updateRange.offset = this._lo * 15; b.updateRange.count = (this._hi - this._lo + 1) * 15; } b.needsUpdate = true; this._lo = this.N; this._hi = -1; this._wrap = false; }
    let n = 0; for (let i = 0; i < this.N; i++) if (this.pdie[i] > this.pt) n++;
    this.pm.count = n;    // rings
    n = 0; const d = this.d, c = this.col;
    for (let i = 0; i < this.R; i++) {
      if (!this.ron[i]) continue; const j = i * 3, a = (this.rage[i] += dt), u = a / this.rlife[i];
      if (u >= 1) { this.ron[i] = 0; continue; }
      const r = this.rr[i] * (1 - (1 - u) * (1 - u)) + 0.2, fade = 1 - u;
      d.rotation.set(0, 0, 0); d.position.set(this.rp[j], this.rp[j + 1] + 0.12, this.rp[j + 2]); d.scale.set(r, 1, r); d.updateMatrix();
      this.rm.setMatrixAt(n, d.matrix); this.rm.setColorAt(n, c.setRGB(this.rcol[j] * fade, this.rcol[j + 1] * fade, this.rcol[j + 2] * fade)); n++;
    }
    this.rm.count = n; this.rm.instanceMatrix.needsUpdate = true; this.rm.instanceColor.needsUpdate = true;
    // beams
    for (let i = 0; i < this.beams.length; i++) {
      if (this.bage[i] < 0) continue; const a = (this.bage[i] += dt), u = a / this.blife[i], m = this.beams[i];
      if (u >= 1) { this.bage[i] = -1; m.visible = false; continue; }
      const w = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85; m.material.opacity = 0.3 * w; m.scale.set(0.35 + 0.5 * w, 1, 0.35 + 0.5 * w);
    }
    // cards
    n = 0;
    for (let i = 0; i < this.C; i++) {
      if (this.clife[i] === 0) continue; const a = (this.cage[i] += dt);
      if (a < 0) continue; if (a >= this.clife[i]) { this.cage[i] = -1; this.clife[i] = 0; continue; }
      const j = i * 3, u = a / this.clife[i];
      const ue = 1 - (1 - u) * (1 - u), arc = this.cdx[i] || this.cdz[i] ? Math.sin(u * Math.PI) * 1.8 : u * 2.4; d.position.set(this.cp[j] + this.cdx[i] * ue, this.cp[j + 1] + arc, this.cp[j + 2] + this.cdz[i] * ue); d.rotation.set(a * this.cspin[i], u * 2, 0); d.scale.setScalar(1 - u * u * 0.6); d.updateMatrix(); this.cm.setMatrixAt(n++, d.matrix);
    }
    this.cm.count = n; this.cm.instanceMatrix.needsUpdate = true;
    // damage numbers
    const cp = camera.position;
    for (let i = 0; i < this.M; i++) {
      if (this.nage[i] < 0) continue; const a = (this.nage[i] += dt), life = this.nbig[i] ? 0.95 : 0.7, sp = this.nsp[i];
      if (a >= life) { this.nage[i] = -1; sp.visible = false; continue; }
      const j = i * 3, u = a / life, pop = u < 0.12 ? 0.6 + u / 0.12 * 0.7 : 1.3 - (u - 0.12) * 0.35;
      const x = this.nx[j] + this.nvx[i] * a, y = this.nx[j + 1] + a * 1.6 * (1 - u * 0.5), z = this.nx[j + 2];
      const dist = Math.sqrt((x - cp.x) * (x - cp.x) + (y - cp.y) * (y - cp.y) + (z - cp.z) * (z - cp.z));
      // a number is a fixed share of the screen height wherever it stands: about 2% for a normal hit and 3% for a crit (22 px and 32 px at 1080p, at most 4% in the pop), never behind the camera or closer than 2 m
      const fov = camera.fov * Math.PI / 180, hw = (this.nbig[i] ? 0.03 : 0.02) * 2 * dist * Math.tan(fov / 2) * pop;
      sp.visible = dist >= 2; sp.scale.set(hw * 2.667, hw, 1);
      sp.position.set(x, y, z);
      { const T = window.THREE, v = this._nv || (this._nv = new T.Vector3()); v.set(x, y, z).project(camera); if (v.z >= 1 || Math.abs(v.x) > 0.96 || Math.abs(v.y) > 0.96) sp.visible = false; else if (sp.visible && this._underHud((v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight)) sp.visible = false; }       // hidden when off screen or over a HUD panel (never pinned to an edge); never down behind the hotbar
      sp.material.opacity = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
    }
    // screen shake offsets, decaying
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    this.trauma = this.shakeB.limit(performance.now(), dt, this.trauma);
    const sh = this.trauma * this.trauma * 0.4, t = performance.now() * 0.038;
    this.shakeOff.x = Math.sin(t * 1.3) * sh; this.shakeOff.y = Math.sin(t * 1.7 + 1) * sh * 0.8; this.shakeOff.z = Math.sin(t * 1.1 + 2) * sh; this.shakeOff.roll = Math.sin(t * 1.9) * Math.min(sh * 0.05, 0.0105);
    // full-screen white flash (form change, fusion)
    this.flashA = Math.max(0, this.flashA - dt * 2.2);
    if (this.fxFlash) { const q = Math.round(this.flashA * 50) / 50; if (q !== this.flashShown) { this.flashShown = q; this.fxFlash.style.opacity = q; } }
  }
  applyShake(camera) { const s = this.shakeOff; if (this.trauma <= 0) return; const lim = Math.min(0.25, 0.02 * this.camDist), l = Math.hypot(s.x, s.y, s.z), k = l > lim ? lim / l : 1; camera.position.x += s.x * k; camera.position.y += s.y * k; camera.position.z += s.z * k; camera.rotation.z += s.roll; }       // shake never moves the eye more than 0.25 m
}







