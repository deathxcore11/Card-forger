// Small life on the ground of the open world (owner, 28 Nov: environments and map feel): block tufts, stones, flowers, shards and glow caps, themed per map (FEEL in groundfx.js).
// View only. One instanced draw. A 64 x 64 grid of 1.25 m cells wraps round the duelist: a cell keeps its tuft while it is within 40 m, and cells that come into range are filled a few
// hundred a frame, so nothing hitches. Everything sways with the one wind field, bends and flattens as the card rides through it, and shrinks to nothing at the edge of the range.
// Nothing stands on a structure, a park piece, a steep face, under water or inside a solid prop, and nothing is taller than about a metre (it never hides a pickup or a warning ring).
import { GLSL, engineUniforms, E } from './engine.js';
import { feelFor } from './groundfx.js';
const T = window.THREE;
const N = 64, CELL = 1.25, R = 38, PER_FRAME = 420;
const hash = (x, z, s) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(s | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vn = (x, z, s) => { const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); return (hash(xi, zi, s) * (1 - u) + hash(xi + 1, zi, s) * u) * (1 - v) + (hash(xi, zi + 1, s) * (1 - u) + hash(xi + 1, zi + 1, s) * u) * v; };

function tuftGeometry() {       // eight thin block blades of mixed height round a centre; y runs 0 (root) to 1 (tip of the tallest)
  const pos = [], nor = [], blades = [[0, 0, 0.04, 1], [0.16, 0.06, 0.03, 0.74], [-0.13, 0.14, 0.03, 0.62], [0.06, -0.18, 0.03, 0.52], [-0.17, -0.1, 0.03, 0.4], [0.22, -0.12, 0.03, 0.58], [-0.04, 0.24, 0.03, 0.46], [0.12, 0.2, 0.03, 0.34]];
  const F = [[[1, 0, 0], [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]]], [[-1, 0, 0], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]], [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]], [[0, 0, -1], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]], [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]]];
  for (const [bx, bz, w, h] of blades) for (const [n, q] of F) for (const k of [0, 1, 2, 0, 2, 3]) { const c = q[k]; pos.push(bx + (c[0] - 0.5) * w * 2, c[1] * h, bz + (c[2] - 0.5) * w * 2); nor.push(n[0], n[1], n[2]); }
  return { pos, nor };
}

export class GroundLife {
  constructor(scene) {
    const G = tuftGeometry(), g = this.geo = new T.InstancedBufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(G.pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(G.nor, 3));
    const M = N * N; this.iPos = new Float32Array(M * 3); this.iScl = new Float32Array(M * 4); this.iCol = new Float32Array(M * 3); this.iTip = new Float32Array(M * 4); this.key = new Int32Array(M * 2).fill(0x7fffffff);
    for (const [n, a, k] of [['iPos', this.iPos, 3], ['iScl', this.iScl, 4], ['iCol', this.iCol, 3], ['iTip', this.iTip, 4]]) { const b = new T.InstancedBufferAttribute(a, k); b.setUsage(T.DynamicDrawUsage); g.setAttribute(n, b); }
    g.instanceCount = M;
    this.u = Object.assign({ uPl: E.pl, uR: { value: R }, uLit: { value: new T.Color(1, 1, 1) }, uPSp: { value: 0 } }, engineUniforms(), T.UniformsUtils.clone(T.UniformsLib.fog));
    this.mat = new T.ShaderMaterial({ uniforms: this.u, fog: true,
      vertexShader: GLSL.slice(0, GLSL.indexOf('float bayer()')) + `
attribute vec3 iPos; attribute vec4 iScl; attribute vec3 iCol; attribute vec4 iTip; uniform vec3 uPl; uniform float uR; uniform float uPSp; varying vec3 vC; varying float vL;
#include <fog_pars_vertex>
void main() {
  float top = position.y, cs = cos(iScl.w * 6.2832), sn = sin(iScl.w * 6.2832); vec2 d = iPos.xz - uPl.xz; float l = length(d), fade = (1.0 - smoothstep(uR * 0.72, uR, l)) * (0.12 + 0.88 * smoothstep(1.6, 5.5, length(iPos - cameraPosition)));       // nothing looms in front of a low camera: a tuft right at the lens shrinks away
  vec3 p = vec3(position.x * cs - position.z * sn, position.y, position.x * sn + position.z * cs) * vec3(iScl.x, iScl.y, iScl.x) * fade;
  vec3 w = iPos + p; vec2 wd = normalize(uWind.xy + 0.0001);
  float bend = (sin(uT * 1.9 + iScl.w * 40.0 + iPos.x * 0.35) * 0.05 + gust(iPos.xz) * 0.3) * top * top * iScl.z;
  w.xz += wd * bend; w.y -= abs(bend) * 0.3 * iScl.y;
  float k = (1.0 - smoothstep(0.5, 2.0, l)) * step(0.01, iScl.z) * (0.45 + 0.55 * clamp(uPSp / 9.0, 0.0, 1.0));       // the card parts and flattens what it rides through, more at speed
  w.xz += (l > 0.001 ? d / l : vec2(1.0, 0.0)) * k * 0.4 * top; w.y -= k * 0.65 * iScl.y * top;
  float tip = step(0.58, top / max(0.001, 1.0));
  vC = mix(iCol, iTip.rgb, smoothstep(0.35, 0.75, top)); vL = (0.72 + 0.28 * max(0.0, dot(normal, normalize(vec3(0.5, 0.8, 0.3))))) * (0.8 + 0.2 * top); vC = vC * vL; vL = iTip.a * smoothstep(0.45, 0.8, top) * tip;
  vec4 mvPosition = viewMatrix * vec4(w, 1.0); gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
      fragmentShader: `uniform vec3 uLit; uniform float uT; varying vec3 vC; varying float vL;
#include <fog_pars_fragment>
void main() { gl_FragColor = vec4(vC * uLit + vC * vL * 0.9, 1.0);
  #include <fog_fragment>
}` });
    this.mesh = new T.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.visible = false; scene.add(this.mesh);
    this.map = null; this.F = null; this.cx = 0x7fffffff; this.cz = 0; this.pending = false; this.px = 0; this.pz = 0;
  }
  // a new stage: the map, its theme, the two height reads (drawn ground, walked ground) and a test for solid props
  setMap(map, th, viewH, walkH, blocked) {
    this.map = map && map.big ? map : null; this.mesh.visible = !!this.map; this.key.fill(0x7fffffff); this.iScl.fill(0); this.geo.attributes.iScl.needsUpdate = true; this.cx = 0x7fffffff; if (!this.map) return;
    const F = this.F = feelFor(th).life, N2 = th.now || {}, t = N2.groundTint, hm = N2.hemi || [0xffffff, 0, 0.8], sk = N2.sun || { k: 0.6 }; this.viewH = viewH; this.walkH = walkH; this.blocked = blocked; this.seed = (map.seed | 0) ^ 0x51ed;
    this.tot = 0; for (const k of F.kinds) this.tot += k[0];
    const L = Math.max(0.42, Math.min(1.05, hm[2] * 0.62 + sk.k * 0.5)), c = new T.Color(hm[0]).lerp(new T.Color(0xffffff), 0.55).multiplyScalar(L); if (t) c.lerp(new T.Color(t[0]), t[1] * 0.5); this.u.uLit.value.copy(c);
  }
  _fill(i, gx, gz) {
    const F = this.F, s = this.seed, o3 = i * 3, o4 = i * 4; this.key[i * 2] = gx; this.key[i * 2 + 1] = gz; this.iScl[o4] = this.iScl[o4 + 1] = 0;
    const clump = vn(gx / 7, gz / 7, s + 3) * 0.65 + vn(gx / 2.3, gz / 2.3, s + 5) * 0.35, chance = F.d * Math.max(0, Math.min(1.6, (clump - 0.3) * 3.2));       // life gathers in drifts with bare ground between
    if (hash(gx, gz, s) >= chance) return;
    const x = Math.round(((gx + 0.15 + 0.7 * hash(gx, gz, s + 1)) * CELL) / 0.24) * 0.24 + 0.12, z = Math.round(((gz + 0.15 + 0.7 * hash(gx, gz, s + 2)) * CELL) / 0.24) * 0.24 + 0.12, y = this.viewH(x, z);
    if (this.map.waterY !== undefined && y < this.map.waterY + 0.06) {       // open water: now and then something floats (a pad, a leaf, a pale bloom), flat on the surface
      const W = F.float; if (!W || hash(gx, gz, s + 17) > W[0] * Math.min(1.5, clump * 2) || y > this.map.waterY - 0.25) return; const sh = 0.9 + 0.2 * hash(gx, gz, s + 11), a = W[1], b = W[2];
      this.iPos[o3] = x; this.iPos[o3 + 1] = this.map.waterY + 0.01; this.iPos[o3 + 2] = z; this.iScl[o4] = W[3] * (0.7 + 0.6 * hash(gx, gz, s + 9)); this.iScl[o4 + 1] = W[4]; this.iScl[o4 + 2] = 0; this.iScl[o4 + 3] = hash(gx, gz, s + 13);
      this.iCol[o3] = ((a >> 16) & 255) / 255 * sh; this.iCol[o3 + 1] = ((a >> 8) & 255) / 255 * sh; this.iCol[o3 + 2] = (a & 255) / 255 * sh; this.iTip[o4] = ((b >> 16) & 255) / 255 * sh; this.iTip[o4 + 1] = ((b >> 8) & 255) / 255 * sh; this.iTip[o4 + 2] = (b & 255) / 255 * sh; this.iTip[o4 + 3] = W[5]; return; }
    if (Math.abs(this.viewH(x + 0.7, z) - this.viewH(x - 0.7, z)) > 0.5 || Math.abs(this.viewH(x, z + 0.7) - this.viewH(x, z - 0.7)) > 0.5) return;       // not on a steep face
    if (Math.abs(this.walkH(x, z) - y) > 0.2 || this.blocked(x, z)) return;       // not on a structure or a park piece, not inside a prop
    let pick = hash(gx, gz, s + 7) * this.tot, K = F.kinds[0]; for (const k of F.kinds) { if (pick < k[0]) { K = k; break; } pick -= k[0]; }
    const hh = K[4] + (K[5] - K[4]) * hash(gx, gz, s + 9) * (0.55 + 0.45 * clump * 1.5), sh = 0.9 + 0.2 * hash(gx, gz, s + 11);
    this.iPos[o3] = x; this.iPos[o3 + 1] = Math.round(y / 0.06) * 0.06 - 0.03; this.iPos[o3 + 2] = z;
    this.iScl[o4] = K[3]; this.iScl[o4 + 1] = hh; this.iScl[o4 + 2] = K[6]; this.iScl[o4 + 3] = hash(gx, gz, s + 13);
    const a = K[1], b = K[2]; this.iCol[o3] = ((a >> 16) & 255) / 255 * sh; this.iCol[o3 + 1] = ((a >> 8) & 255) / 255 * sh; this.iCol[o3 + 2] = (a & 255) / 255 * sh;
    this.iTip[o4] = ((b >> 16) & 255) / 255 * sh; this.iTip[o4 + 1] = ((b >> 8) & 255) / 255 * sh; this.iTip[o4 + 2] = (b & 255) / 255 * sh; this.iTip[o4 + 3] = K[7];
  }
  // a prop was smashed or the ground was hit: whatever stands within r is flattened for good (until the cell leaves the range)
  flatten(x, z, r) { if (!this.map) return; let ch = false; for (let i = 0; i < N * N; i++) { if (!this.iScl[i * 4 + 1]) continue; const dx = this.iPos[i * 3] - x, dz = this.iPos[i * 3 + 2] - z; if (dx * dx + dz * dz < r * r) { this.iScl[i * 4 + 1] *= 0.25; this.iScl[i * 4 + 2] = 0; ch = true; } } if (ch) this.geo.attributes.iScl.needsUpdate = true; }
  update(px, pz, dt) {
    if (!this.map) return; const sp = dt > 0 ? Math.hypot(px - this.px, pz - this.pz) / dt : 0; this.u.uPSp.value += (Math.min(30, sp) - this.u.uPSp.value) * 0.2; this.px = px; this.pz = pz;
    const cx = Math.floor(px / CELL), cz = Math.floor(pz / CELL); if (cx === this.cx && cz === this.cz && !this.pending) return; this.cx = cx; this.cz = cz;
    let n = 0, more = false; const H = N / 2;
    for (let j = -H; j < H && !more; j++) for (let i = -H; i < H; i++) { const gx = cx + i, gz = cz + j, s = ((gx % N) + N) % N + (((gz % N) + N) % N) * N; if (this.key[s * 2] === gx && this.key[s * 2 + 1] === gz) continue; if (n >= PER_FRAME) { more = true; break; } this._fill(s, gx, gz); n++; }
    this.pending = more; if (n) for (const k of ['iPos', 'iScl', 'iCol', 'iTip']) this.geo.attributes[k].needsUpdate = true;
  }
}

// Life in the air: a few block birds (or fireflies, or star moths) that circle near the duelist, each on its own slow loop, wings beating. View only; three boxes a flyer, one instanced draw.
// When the duelist rides far from a flyer's loop it is given a new loop ahead, out of sight above or in the mist, so there is always something alive in the sky.
export class SkyLife {
  constructor(scene) { this.max = 16; this.m = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ fog: true }), this.max * 3); this.m.frustumCulled = false; this.d = new T.Object3D(); this.c = new T.Color(); for (let i = 0; i < this.max * 3; i++) this.m.setColorAt(i, this.c.setHex(0xffffff)); this.m.count = 0; scene.add(this.m); this.list = []; this.F = null; this.t = 0; }
  setMap(map, th) { const F = this.F = map && map.big ? feelFor(th).fauna : null; this.list.length = 0; this.m.count = 0; if (!F) return; const night = th.time === 'night', dimK = F.glow ? 1 : night ? 0.45 : th.time === 'evening' ? 0.8 : 1;
    for (let i = 0; i < Math.min(this.max, F.n); i++) { this.list.push({ cx: 1e9, cz: 0, r: 0, h: 0, a: 0, w: 0, ph: i * 2.4, s: F.size * (0.8 + 0.4 * ((i * 0.618) % 1)) });
      this.m.setColorAt(i * 3, this.c.setHex(F.c[0]).multiplyScalar(dimK)); this.m.setColorAt(i * 3 + 1, this.c.setHex(F.c[1 + i % (F.c.length - 1)]).multiplyScalar(dimK)); this.m.setColorAt(i * 3 + 2, this.c.setHex(F.c[1 + i % (F.c.length - 1)]).multiplyScalar(dimK)); }
    this.m.instanceColor.needsUpdate = true; this.m.count = this.list.length * 3; }
  update(px, pz, dt, ground) { const F = this.F; if (!F) return; this.t += dt; const d = this.d;
    for (let i = 0; i < this.list.length; i++) { const b = this.list[i], far = (b.cx - px) * (b.cx - px) + (b.cz - pz) * (b.cz - pz);
      if (far > 95 * 95) { const q = (i * 0.7548 + this.t * 0.37) % 1, a = q * 6.2832, rr = b.cx > 1e8 ? 12 + 50 * ((i * 0.618) % 1) : 70; b.cx = px + Math.cos(a) * rr; b.cz = pz + Math.sin(a) * rr; b.r = F.r[0] + (F.r[1] - F.r[0]) * ((i * 0.414) % 1); b.h = F.h[0] + (F.h[1] - F.h[0]) * ((i * 0.732) % 1); b.w = (i % 2 ? 1 : -1) * F.speed / Math.max(2, b.r); b.gy = ground(b.cx, b.cz); }
      b.a += b.w * dt; const sg = b.w > 0 ? 1 : -1, x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r, y = Math.max(b.gy, ground(x, z)) + b.h + Math.sin(this.t * 0.6 + b.ph) * (F.bob || 1), fx = -Math.sin(b.a) * sg, fz = Math.cos(b.a) * sg, yaw = -Math.atan2(fz, fx), s = b.s, fl = Math.sin(this.t * F.flap + b.ph) * 0.75, L = s * 0.42;
      d.rotation.order = 'YXZ'; d.rotation.set(0, yaw, 0); d.position.set(x, y, z); d.scale.set(s * 0.9, s * 0.26, s * 0.3); d.updateMatrix(); this.m.setMatrixAt(i * 3, d.matrix);
      for (const sd of [-1, 1]) { const lz = Math.cos(fl) * sd * L, ly = Math.sin(fl) * L; d.rotation.set(-sd * fl, yaw, 0); d.position.set(x + lz * Math.sin(yaw), y + ly, z + lz * Math.cos(yaw)); d.scale.set(s * 0.5, s * 0.08, s * 0.84); d.updateMatrix(); this.m.setMatrixAt(i * 3 + (sd < 0 ? 1 : 2), d.matrix); } }
    this.m.instanceMatrix.needsUpdate = true; }
}
