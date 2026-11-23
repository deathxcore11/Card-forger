// Water (engine plan step 1): the summoning pools. One opaque draw for every pool: summed-sine normals, the banded sky reflected with a Fresnel mix, a wobbled bed colour that darkens with depth, banded sun glitter that twinkles per world texel,
// foam that laps at the rim, and ripples (8 analytic sources: the duelist and up to 7 others). Opaque on purpose: no depth read, no scene copy, no blending, so it never hides a pickup, a warning ring or the duelist's feet (they draw over it).
// Everything is evaluated per world texel (1/8 m) so the pattern does not swim when the camera moves. The pool stays flat and walkable (the sim never sees it).
import { E, GLSL, engineUniforms } from './engine.js';
const T = window.THREE, SIDES = 40, RINGS = [0, 0.45, 0.7, 0.85, 0.93, 1.0], Y = 0.06, DEPTH = 0.55;

export const RIP = new Float32Array(32);                                    // 8 ripple sources: x, z, age (s), strength
let ripI = 0;
export function ripple(x, z, s) { RIP[ripI * 4] = x; RIP[ripI * 4 + 1] = z; RIP[ripI * 4 + 2] = 0; RIP[ripI * 4 + 3] = s; ripI = (ripI + 1) & 7; }
export function ageRipples(dt) { for (let i = 0; i < 8; i++) if (RIP[i * 4 + 3] > 0) { RIP[i * 4 + 2] += dt; if (RIP[i * 4 + 2] > 3.2) RIP[i * 4 + 3] = 0; } }

const VS = `
#include <fog_pars_vertex>
attribute float aD; varying vec3 vW; varying float vD; uniform float uT;
void main() {
  float bob = 0.035 * sin(uT * 0.64); vec3 wp = position; wp.y += bob; vW = wp; vD = aD + bob;
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0); gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FS = `
#include <fog_pars_fragment>
${GLSL}
varying vec3 vW; varying float vD; uniform vec4 uRip[8]; uniform vec3 uWatS; uniform vec3 uWatD; uniform vec3 uWatL; uniform vec3 uEye;
void main() {
  vec2 p = (floor(vW.xz * 8.0) + 0.5) / 8.0; float dep = max(vD, 0.0);
  float g = gust(p), amp = 0.45 + 0.9 * g; vec2 gr = vec2(0.0); float ph;
  ph = dot(vec2(1.7, 0.6), p) - uT * 1.9; gr += 0.022 * vec2(1.7, 0.6) * cos(ph);
  ph = dot(vec2(-0.8, 2.4), p) - uT * 2.6; gr += 0.014 * vec2(-0.8, 2.4) * cos(ph);
  ph = dot(vec2(3.6, -1.7), p) - uT * 3.8; gr += 0.008 * vec2(3.6, -1.7) * cos(ph);
  ph = dot(vec2(4.6, 3.9), p) - uT * 4.9; gr += 0.005 * vec2(4.6, 3.9) * cos(ph);
  gr *= amp; float rf = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4 s = uRip[i]; if (s.w <= 0.0) continue;
    vec2 dv = p - s.xy; float r = length(dv), fr = 1.1 * s.z + 0.15; if (r > fr || r < fr - 1.9) continue;
    float e = s.w * exp(-0.6 * s.z) * smoothstep(fr - 1.9, fr, r), a = 9.0 * (r - fr), k = smoothstep(0.04, 0.2, e);
    gr += dv / max(r, 0.05) * e * 0.22 * cos(a); rf += k * (step(0.5, sin(a)) - 0.6 * step(sin(a), -0.5));
  }
  vec3 n = normalize(vec3(-gr.x, 1.0, -gr.y)), V = normalize(vW - uEye);
  vec2 bp = p - gr * dep * 3.0; float h = hsh(floor(bp * 8.0));
  vec3 bed = uWatS * (0.85 + 0.3 * h) * 0.9;                                                  // the bed: a wobbled lookup (refraction), a little texel variation
  bed = mix(bed, uWatL, (1.0 - smoothstep(0.0, 0.27, dep)) * 0.75);                          // within about 0.8 m of the rim the lit bed shows through
  vec3 c = mix(bed, uWatS, (1.0 - exp(-dep * 2.6)) * 0.6); c = mix(c, uWatD, 1.0 - exp(-dep * 1.05));
  vec3 Rf = reflect(V, n); Rf.y = abs(Rf.y) + 0.02; Rf = normalize(Rf);
  vec3 rc = skyBase(Rf);
  float F0 = 0.07; c = mix(c, rc, 0.5 * (F0 + (1.0 - F0) * pow(1.0 - max(dot(n, -V), 0.0), 4.0)));
  float tw = hsh(floor(p * 8.0) + floor(uT * 10.0) * vec2(7.0, 3.0)), lobe = pow(max(dot(normalize(Rf.xz + 1e-5), normalize(uSunD.xz)), 0.0), 18.0) * smoothstep(0.0, 0.5, 1.0 - Rf.y);
  c += uWatL * (step(1.0 - lobe * (0.55 + 0.5 * g), tw) * 0.9 + step(0.9985, tw) * 0.25);      // sun glitter: a band toward the sun, twinkling per texel, in the light tone of the sky
  c += uWatS * 0.16 * step(0.55, g);                                                           // a gust shows as a paler patch
  float fn = N(p * 0.19 + vec2(4.0, 2.0) / 512.0 * uT).r, lap = 0.5 + 0.5 * sin(uT * 1.4 + dep * 18.0 + fn * 4.0);
  float fb = N(p * 0.45 + vec2(9.0, 5.0) / 512.0 * uT).g;                                       // a thin broken line (1 to 2 game pixels) that laps in and out at the rim
  float foam = step(abs(dep + (fn - 0.5) * 0.05 - (0.04 + 0.05 * lap)), 0.017) * step(0.26, fb);
  c *= 1.0 + max(rf, -1.0) * step(rf, 0.0) * 0.3; foam = max(foam, clamp(rf, 0.0, 1.0) * 0.55);
  c = mix(c, mix(uWatL, vec3(0.86, 0.94, 0.9), 0.55), foam);
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`;

export function buildWater(pools, look) {
  const pos = [], dep = [], idx = []; let base = 0;
  for (const p of pools) {
    pos.push(p.x, Y + (p.y || 0), p.z); dep.push(DEPTH);
    for (let ri = 1; ri < RINGS.length; ri++) for (let s = 0; s < SIDES; s++) { const a = s / SIDES * Math.PI * 2, r = p.r * RINGS[ri]; pos.push(p.x + Math.cos(a) * r, Y + (p.y || 0), p.z + Math.sin(a) * r); dep.push(DEPTH * Math.min(1, (1 - RINGS[ri]) * p.r / 1.6)); }
    const ring = k => base + 1 + (k - 1) * SIDES;
    for (let s = 0; s < SIDES; s++) idx.push(base, ring(1) + s, ring(1) + (s + 1) % SIDES);
    for (let ri = 1; ri < RINGS.length - 1; ri++) for (let s = 0; s < SIDES; s++) { const a = ring(ri) + s, b = ring(ri) + (s + 1) % SIDES, c = ring(ri + 1) + s, d = ring(ri + 1) + (s + 1) % SIDES; idx.push(a, c, b, b, c, d); }
    base += 1 + (RINGS.length - 1) * SIDES;
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('aD', new T.Float32BufferAttribute(dep, 1)); g.setIndex(idx);
  const u = T.UniformsUtils.merge([T.UniformsLib.fog, engineUniforms(), { uRip: { value: [] }, uWatS: { value: new T.Color(look.water[0]) }, uWatD: { value: new T.Color(look.water[1]) }, uWatL: { value: new T.Color(look.water[2]) }, uEye: { value: new T.Vector3() } }]);
  u.uRip.value = []; for (let i = 0; i < 8; i++) u.uRip.value.push(new T.Vector4());
  const mat = new T.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: FS, fog: true, side: T.DoubleSide });
  const mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; mesh.userData.update = cam => { u.uEye.value.copy(cam); for (let i = 0; i < 8; i++) u.uRip.value[i].set(RIP[i * 4], RIP[i * 4 + 1], RIP[i * 4 + 2], RIP[i * 4 + 3]); };
  mesh.userData.pools = pools.length; return mesh;
}

