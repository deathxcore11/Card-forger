// Game-feel effects. View only: nothing here reads or changes the rules, everything is fed from the sim's event queue and from
// state changes the view notices. Every pool is fixed size and allocated once (particles 4000, damage numbers 64, rings 48,
// beams 4, flipping cards 12), so steady state allocates nothing per frame.
const T = window.THREE;

const ELEM_COL = [null, '#ff9a3a', '#8fe8ff', '#9fd8ff', '#9be86a', '#c8f0d0', '#c9a46a', '#fff2a0', '#c08aff'];
export const POOL = { particles: 4000, numbers: 64, rings: 48, beams: 4, cards: 12 };

export class Fx {
  constructor(scene, settings) {
    this.scene = scene; this.settings = settings || { reduceMotion: false, shake: 100 };
    this.d = new T.Object3D(); this.col = new T.Color(); this.v = new T.Vector3();
    this.trauma = 0; this.stop = 0; this.flashA = 0; this.flashShown = -1; this.push = 0; this.pushMax = 2;
    this.avgDmg = 3;
    this.shakeOff = { x: 0, y: 0, z: 0, roll: 0 };

    // particles: one instanced mesh, ring-buffer slots
    const N = POOL.particles; this.N = N; this.head = 0;
    this.pos = new Float32Array(N * 3); this.vel = new Float32Array(N * 3); this.age = new Float32Array(N); this.life = new Float32Array(N);
    this.size = new Float32Array(N); this.grav = new Float32Array(N); this.rgb = new Float32Array(N * 3); this.on = new Uint8Array(N);
    this.pm = new T.InstancedMesh(new T.OctahedronGeometry(0.5, 0), new T.MeshBasicMaterial({ color: 0xffffff }), N);
    this.pm.instanceColor = new T.InstancedBufferAttribute(new Float32Array(N * 3), 3); this.pm.instanceMatrix.setUsage(T.DynamicDrawUsage);
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
    this.cp = new Float32Array(C * 3); this.cage = new Float32Array(C); this.clife = new Float32Array(C); this.cspin = new Float32Array(C);
    this.cm = new T.InstancedMesh(new T.BoxGeometry(0.7, 0.04, 1.0), new T.MeshBasicMaterial({ color: 0xf3e3c2 }), C); this.cm.frustumCulled = false; this.cm.count = 0; scene.add(this.cm);

    // damage numbers: sprites with their own tiny canvas, text drawn only when one is spawned
    const M = POOL.numbers; this.M = M; this.nh = 0; this.nsp = []; this.nctx = []; this.ntex = [];
    this.nx = new Float32Array(M * 3); this.nage = new Float32Array(M).fill(-1); this.nbig = new Uint8Array(M); this.nvx = new Float32Array(M);
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
  shake(a) { const s = this.shakeScale; if (s > 0) this.trauma = Math.min(1, this.trauma + a * s); }
  hitstop(sec) { if (!this.rm_) this.stop = Math.max(this.stop, sec); }
  flash(a) { if (!this.rm_) this.flashA = Math.max(this.flashA, a); }

  burst(x, y, z, n, hex, speed, up, size, life, grav) {
    const c = this.col.setHex(hex);
    for (let k = 0; k < n; k++) {
      const i = this.head, j = i * 3; this.head = (this.head + 1) % this.N;
      const a = Math.random() * 6.2832, r = Math.random() * speed, u = (0.3 + Math.random()) * up;
      this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z;
      this.vel[j] = Math.cos(a) * r; this.vel[j + 1] = u; this.vel[j + 2] = Math.sin(a) * r;
      this.age[i] = 0; this.life[i] = life * (0.7 + Math.random() * 0.6); this.size[i] = size * (0.6 + Math.random() * 0.8); this.grav[i] = grav;
      const shade = 0.75 + Math.random() * 0.5; this.rgb[j] = c.r * shade; this.rgb[j + 1] = c.g * shade; this.rgb[j + 2] = c.b * shade; this.on[i] = 1;
    }
  }
  // one particle with an explicit velocity (trails, dust)
  spark(x, y, z, vx, vy, vz, hex, size, life) {
    const i = this.head, j = i * 3, c = this.col.setHex(hex); this.head = (this.head + 1) % this.N;
    this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z; this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz;
    this.age[i] = 0; this.life[i] = life; this.size[i] = size; this.grav[i] = 0; this.rgb[j] = c.r; this.rgb[j + 1] = c.g; this.rgb[j + 2] = c.b; this.on[i] = 1;
  }
  ring(x, y, z, r, hex, life) {
    const i = this.rh, j = i * 3, c = this.col.setHex(hex); this.rh = (this.rh + 1) % this.R;
    this.rp[j] = x; this.rp[j + 1] = y; this.rp[j + 2] = z; this.rr[i] = r; this.rage[i] = 0; this.rlife[i] = life; this.rcol[j] = c.r; this.rcol[j + 1] = c.g; this.rcol[j + 2] = c.b; this.ron[i] = 1;
  }
  beam(x, y, z, hex, life) {
    for (let i = 0; i < this.beams.length; i++) if (this.bage[i] < 0) {
      const m = this.beams[i]; m.position.set(x, y + 20, z); m.material.color.setHex(hex); m.visible = true; this.bage[i] = 0; this.blife[i] = life; return;
    }
  }
  cards(x, y, z, n) {
    for (let k = 0; k < n; k++) { const i = this.ch, j = i * 3; this.ch = (this.ch + 1) % this.C; this.cp[j] = x + (k - (n - 1) / 2) * 0.9; this.cp[j + 1] = y + 0.8; this.cp[j + 2] = z; this.cage[i] = -k * 0.12; this.clife[i] = 1.1; this.cspin[i] = 6 + k; }
  }
  // flags from the sim's hit event: bit 0 crit, bits 1+ the element mask (fire 1, lightning 2, ice 4, poison 8, wind 16, earth 32, light 64, dark 128)
  number(x, y, z, value, flags) {
    if (this.numBudget < 1) return; this.numBudget -= 1;
    const big = flags === undefined || flags === null ? value > this.avgDmg * 2.2 + 1 : (flags & 1) === 1; this.avgDmg += (value - this.avgDmg) * 0.05;
    const el = flags ? flags >> 1 : 0, col = ELEM_COL[el & 1 ? 1 : el & 2 ? 2 : el & 4 ? 3 : el & 8 ? 4 : el & 16 ? 5 : el & 32 ? 6 : el & 64 ? 7 : el & 128 ? 8 : 0];
    const i = this.nh, j = i * 3; this.nh = (this.nh + 1) % this.M;
    const ctx = this.nctx[i]; ctx.clearRect(0, 0, 128, 48); ctx.font = 'bold ' + (big ? 38 : 28) + 'px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const s = String(Math.max(1, Math.round(value)));
    ctx.lineWidth = 6; ctx.strokeStyle = '#1a0a20'; ctx.strokeText(s, 64, 24); ctx.fillStyle = col || (big ? '#ffd23a' : '#fff6e0'); ctx.fillText(s, 64, 24);
    this.ntex[i].needsUpdate = true;
    this.nx[j] = x + (Math.random() - 0.5) * 0.8; this.nx[j + 1] = y; this.nx[j + 2] = z + (Math.random() - 0.5) * 0.8; this.nvx[i] = (Math.random() - 0.5) * 1.2; this.nage[i] = 0; this.nbig[i] = big ? 1 : 0;
    const sp = this.nsp[i]; sp.visible = true; sp.material.opacity = 1;
  }

  // ---- per frame ----
  update(dt, camera) {
    this.numBudget = Math.min(8, this.numBudget + dt * 60);
    const d = this.d, c = this.col;
    // particles
    let n = 0;
    for (let i = 0; i < this.N; i++) {
      if (!this.on[i]) continue;
      const j = i * 3, a = (this.age[i] += dt), life = this.life[i];
      if (a >= life) { this.on[i] = 0; continue; }
      this.vel[j + 1] -= this.grav[i] * dt;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      if (this.pos[j + 1] < 0.05 && this.grav[i] > 0) { this.pos[j + 1] = 0.05; this.vel[j + 1] *= -0.3; this.vel[j] *= 0.6; this.vel[j + 2] *= 0.6; }
      const f = 1 - a / life, s = this.size[i] * (f < 0.35 ? f / 0.35 : 1);
      d.position.set(this.pos[j], this.pos[j + 1], this.pos[j + 2]); d.rotation.set(a * 5, a * 3, 0); d.scale.setScalar(s); d.updateMatrix();
      this.pm.setMatrixAt(n, d.matrix); this.pm.setColorAt(n, c.setRGB(this.rgb[j], this.rgb[j + 1], this.rgb[j + 2])); n++;
    }
    this.pm.count = n; this.pm.instanceMatrix.needsUpdate = true; this.pm.instanceColor.needsUpdate = true;
    // rings
    n = 0;
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
      d.position.set(this.cp[j], this.cp[j + 1] + u * 2.4, this.cp[j + 2]); d.rotation.set(a * this.cspin[i], u * 2, 0); d.scale.setScalar(1 - u * u * 0.6); d.updateMatrix(); this.cm.setMatrixAt(n++, d.matrix);
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
      const k = Math.max(0.6, Math.min(2.2, dist * 0.09)) * pop * (this.nbig[i] ? 1.35 : 1);
      sp.position.set(x, y, z); sp.scale.set(2.2 * k, 0.825 * k, 1); sp.material.opacity = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
    }
    // screen shake offsets, decaying
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    const sh = this.trauma * this.trauma * 0.4, t = performance.now() * 0.05;
    this.shakeOff.x = Math.sin(t * 1.3) * sh; this.shakeOff.y = Math.sin(t * 1.7 + 1) * sh * 0.8; this.shakeOff.z = Math.sin(t * 1.1 + 2) * sh; this.shakeOff.roll = Math.sin(t * 1.9) * sh * 0.05;
    // full-screen white flash (form change, fusion)
    this.flashA = Math.max(0, this.flashA - dt * 2.2);
    if (this.fxFlash) { const q = Math.round(this.flashA * 50) / 50; if (q !== this.flashShown) { this.flashShown = q; this.fxFlash.style.opacity = q; } }
  }
  applyShake(camera) { const s = this.shakeOff; if (this.trauma <= 0) return; camera.position.x += s.x; camera.position.y += s.y; camera.position.z += s.z; camera.rotation.z += s.roll; }
}


