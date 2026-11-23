// The lightning ribbon (spectacle spec 6.5): one static strip of 17 points by 2 sides, drawn instanced, one instance per bolt. The zigzag is summed from midpoint displacement in the vertex shader (closed form, no history),
// the bolt picks a new shape every 50 ms while it is thin, and the instance data is written once, when the sim first shows the bolt. Nothing is uploaded after that. View only: the sim keeps sending each bolt with both end
// points and a seed (the 'bolt' effect entries); this file only draws them. Colours come from the one effect ramp (row 2, lightning: blue-white core, electric body, indigo shade, ink edge).
import { GLSL } from './engine.js';
import { FX } from './fxkit.js';
import { ROW } from '../data/fxramp.js';
const T = window.THREE, POOL = 64, STRIDE = 13;

export class Ribbon {
  constructor(scene) {
    this.t0 = performance.now(); this.head = 0; this.last = -1e9; this.seen = new WeakMap(); this.uni = { uTime: { value: 0 }, uStepHz: { value: 20 }, uRamp: FX.ramp };
    const pos = [], idx = []; for (let k = 0; k <= 16; k++) for (const s of [-1, 1]) pos.push(k / 16, s, 0); for (let k = 0; k < 16; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.buf = new T.InstancedInterleavedBuffer(new Float32Array(POOL * STRIDE).fill(0), STRIDE, 1); this.buf.setUsage(T.DynamicDrawUsage); for (let i = 0; i < POOL; i++) this.buf.array[i * STRIDE + 7] = -1e6;       // birth far in the past: every slot starts dead
    const g = new T.InstancedBufferGeometry(); g.setAttribute('aTS', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    g.setAttribute('iA', new T.InterleavedBufferAttribute(this.buf, 4, 0)); g.setAttribute('iB', new T.InterleavedBufferAttribute(this.buf, 4, 4)); g.setAttribute('iC', new T.InterleavedBufferAttribute(this.buf, 4, 8)); g.setAttribute('iCore', new T.InterleavedBufferAttribute(this.buf, 1, 12)); g.instanceCount = POOL;
    const mat = new T.ShaderMaterial({ glslVersion: T.GLSL3, uniforms: this.uni, depthWrite: true, side: T.DoubleSide, fog: false,
      vertexShader: `precision highp float; precision highp int;
in vec3 aTS; in vec4 iA; in vec4 iB; in vec4 iC; in float iCore; uniform float uTime; uniform float uStepHz;
out vec2 vUV; out float vU; flat out int vRow; flat out float vCore;
uint h(uint x) { x ^= x >> 16; x *= 0x7feb352dU; x ^= x >> 15; x *= 0x846ca68bU; x ^= x >> 16; return x; }
float r1(uint s, int L, uint j) { return float(h(s ^ (uint(L) * 0x9e3779b9U) ^ (j * 0x85ebca6bU)) & 0xffffU) / 32767.5 - 1.0; }
vec3 bolt(float t, uint s, vec3 a, vec3 b, vec3 n1, vec3 n2, float amp) {
  vec2 o = vec2(0.0); float w = 1.0;
  for (int L = 0; L < 4; L++) { float u = t * float(1 << L); uint j = uint(u); float hat = 1.0 - abs(2.0 * fract(u) - 1.0); o += hat * w * vec2(r1(s, L, j), r1(s + 77U, L, j)); w *= 0.5; }
  return mix(a, b, t) + (n1 * o.x + n2 * o.y) * amp;
}
void main() {
  float age = uTime - iB.w, u = age / iC.y;
  if (age < 0.0 || u >= 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float hz = iA.w > 0.2 ? 0.0 : uStepHz; uint s = uint(iC.x) + uint(age * hz) * 7919U;
  vec3 d = iB.xyz - iA.xyz; float len = max(length(d), 0.001); vec3 dir = d / len;
  vec3 n1 = normalize(cross(dir, abs(dir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))), n2 = cross(dir, n1);
  float amp = min(len * 0.16, 1.2) * iC.w, t = aTS.x, e = t < 0.99 ? 0.03125 : -0.03125;
  vec3 p = bolt(t, s, iA.xyz, iB.xyz, n1, n2, amp), q = bolt(t + e, s, iA.xyz, iB.xyz, n1, n2, amp);
  vec3 side = normalize(cross(normalize((q - p) * sign(e)), cameraPosition - p));
  p += side * aTS.y * iA.w * 0.5 * (1.0 - 0.6 * t);
  vUV = vec2(t * len, aTS.y); vU = u; vRow = int(iC.z); vCore = iCore;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
      fragmentShader: GLSL.replace(/#version.*\n/, '') + `
uniform sampler2D uRamp; out vec4 oc; in vec2 vUV; in float vU; flat in int vRow; flat in float vCore;
void main() {
  float a = abs(vUV.y);
  if (vU > 0.6 && bayer() < (vU - 0.6) * 2.5) discard;
  int tone = (a < 0.3 && vCore > 0.5) ? 0 : a < 0.7 ? 2 : 4;
  oc = vec4(texelFetch(uRamp, ivec2(tone, vRow), 0).rgb, (tone < 4 && vCore > 0.5) ? 0.0 : 1.0);
}` });
    this.mesh = new T.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; scene.add(this.mesh); this._dirty = false;
  }
  // called every frame from the view: sets the clock and shows any sim bolt not seen before (a restarted pooled entry counts as new)
  tick() { const t = this.uni.uTime.value = (performance.now() - this.t0) / 1000; this.mesh.visible = t - this.last < 2; if (this._dirty) { this.buf.needsUpdate = true; this._dirty = false; } }
  see(o) {
    const prev = this.seen.get(o); this.seen.set(o, o.t); if (prev !== undefined && o.t >= prev) return false;
    this.last = this.uni.uTime.value; const i = this.head, k = i * STRIDE, a = this.buf.array, now = this.uni.uTime.value - (o.t || 0); this.head = (this.head + 1) % POOL;
    a[k] = o.x; a[k + 1] = o.y; a[k + 2] = o.z; a[k + 3] = o.w || 0.14; a[k + 4] = o.x2; a[k + 5] = o.y2; a[k + 6] = o.z2; a[k + 7] = now; a[k + 8] = o.seed || 1; a[k + 9] = o.dur || 0.15; a[k + 10] = ROW.LIGHTNING; a[k + 11] = 1; a[k + 12] = 1;
    this.buf.updateRange.count = -1; this._dirty = true; return true;
  }
}
