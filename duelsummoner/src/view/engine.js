// The shared engine pieces (engine plan, amendment 4: one of each, shared by water, sky, wind and the spectacle effects): the noise texture, the clock, the one gust field, the sky gradient and the Bayer function.
// Everything here is view only. The noise is built from an integer hash so every device gets the same bits (0 KB on disk).
const T = window.THREE;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
function hash2(x, y) { let h = (Math.imul(x, 0x9E3779B1) ^ Math.imul(y, 0x85EBCA77)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D) >>> 0; h ^= h >>> 12; return (h >>> 0) / 4294967296; }
// 64 x 64 RGBA8, REPEAT, LINEAR. R = value noise (2 octaves), G = cell distance, B = white hash, A = second value noise. All four tile.
function buildNoise() {
  const n = 64, d = new Uint8Array(n * n * 4);
  const val = (x, y, per, seed) => { const fx = x * per / n, fy = y * per / n, ix = Math.floor(fx), iy = Math.floor(fy); let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const r = (i, j) => hash2(i % per + seed * 131, j % per + seed * 17); return (r(ix, iy) * (1 - tx) + r(ix + 1, iy) * tx) * (1 - ty) + (r(ix, iy + 1) * (1 - tx) + r(ix + 1, iy + 1) * tx) * ty; };
  const per = 6, cs = n / per, pts = []; for (let j = 0; j < per; j++) for (let i = 0; i < per; i++) pts.push([(i + 0.15 + 0.7 * hash2(i + 71, j + 13)) * cs, (j + 0.15 + 0.7 * hash2(i + 29, j + 57)) * cs]);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const o = (y * n + x) * 4;
    d[o] = cl(((0.62 * val(x, y, 8, 1) + 0.38 * val(x, y, 16, 2)) - 0.5) * 1.7 + 0.5, 0, 1) * 255;
    let m = 1e9; for (const p of pts) { let dx = Math.abs(x + 0.5 - p[0]), dy = Math.abs(y + 0.5 - p[1]); dx = Math.min(dx, n - dx); dy = Math.min(dy, n - dy); m = Math.min(m, dx * dx + dy * dy); }
    d[o + 1] = cl(Math.sqrt(m) / (cs * 0.78), 0, 1) * 255; d[o + 2] = hash2(x + 977, y + 131) * 255;
    d[o + 3] = cl(((0.6 * val(x, y, 4, 3) + 0.4 * val(x, y, 8, 4)) - 0.5) * 1.7 + 0.5, 0, 1) * 255;
  }
  const tex = new T.DataTexture(d, n, n, T.RGBAFormat, T.UnsignedByteType); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.minFilter = tex.magFilter = T.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true; return tex;
}
// the uniform bus: shared by every engine shader, updated once a frame by updateEngine()
export const E = {
  noise: { value: buildNoise() }, T: { value: 0 }, wind: { value: new T.Vector3(1, 0.4, 0.5) },       // wind: x,y = direction on the ground, z = strength (0 to 1)
  skyM: { value: new T.Color(0x4fc6d8) }, cldL: { value: new T.Color(0xffffff) }, cldS: { value: new T.Color(0x8fc0da) }, disc: { value: new T.Color(0xfff3b8) }, cover: { value: 0.55 }, sunOn: { value: 1 }, dither: { value: 1 },
  skyT: { value: new T.Color(0x8fb2cc) }, skyH: { value: new T.Color(0xe8d6b0) }, skyG: { value: new T.Color(0xd9c29a) },
  sunD: { value: new T.Vector3(0.5, 0.8, 0.3).normalize() }, sunK: { value: new T.Color(0xffe2b0) }
};
let gustT = 0;
export function updateEngine(dt, look) {
  E.T.value += dt; gustT += dt;
  E.wind.value.z = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(gustT * 0.31)) + 0.2 * (0.5 + 0.5 * Math.sin(gustT * 0.83 + 1.7));       // a slow overall strength; the travelling fronts come from the noise field in gust()
  if (look) { const d = look.dome; E.skyT.value.setHex(d.top); E.skyM.value.setHex(d.mid); E.skyH.value.setHex(d.hor); E.skyG.value.setHex(d.gnd); E.cldL.value.setHex(d.cldL); E.cldS.value.setHex(d.cldS); E.cover.value = d.cover; E.sunOn.value = d.sun ? 1 : 0; }
}
// GLSL shared by the engine shaders. N() reads the noise at a normalised coordinate; gust() is the ONE wind field (grass, trees, water, particles); skyBase() is the banded sky gradient the dome, the fog and the water agree on;
// bayer() is the one 4x4 ordered-dither threshold (sky, fog and haze only: amendment 1).
export const GLSL = `
uniform sampler2D uN; uniform float uT; uniform vec3 uWind; uniform vec3 uSkyT; uniform vec3 uSkyH; uniform vec3 uSkyG; uniform vec3 uSunD; uniform vec3 uSunK;
vec4 N(vec2 u) { return texture2D(uN, u); }
float hsh(vec2 t) { return texture2D(uN, (floor(t) + 0.5) / 64.0).b; }
float gust(vec2 p) {
  float f = smoothstep(0.3, 0.78, N(p * 0.011 - vec2(30.0, 10.0) / 512.0 * uT).r);
  return f * (0.72 + 0.28 * sin(dot(p, uWind.xy) * 0.12 - uT * 1.2)) * uWind.z;
}
vec3 skyBase(vec3 d) {
  float k = floor(sqrt(max(d.y, 0.0)) * 12.0 + 0.5) / 12.0;
  vec3 c = mix(uSkyH, uSkyT, k);
  float s = max(dot(d, uSunD), 0.0); c += uSunK * pow(s, 6.0) * 0.18 * (1.0 - 0.5 * k);
  return mix(c, uSkyG, smoothstep(0.0, -0.1, d.y));
}
float bayer() { vec2 f = floor(gl_FragCoord.xy); float x0 = mod(f.x, 2.0), x1 = floor(mod(f.x, 4.0) / 2.0), y0 = mod(f.y, 2.0), y1 = floor(mod(f.y, 4.0) / 2.0); return (abs(x0 - y0) * 8.0 + y0 * 4.0 + abs(x1 - y1) * 2.0 + y1 + 0.5) / 16.0; }
`;
export function engineUniforms() { return { uN: E.noise, uT: E.T, uWind: E.wind, uSkyT: E.skyT, uSkyH: E.skyH, uSkyG: E.skyG, uSunD: E.sunD, uSunK: E.sunK }; }

// ---- the actor light (per stage, in look.js): a flat fill and a soft key from above and behind the camera, added to ACTORS ONLY (duelist, summons, enemies, bosses), never to scenery or the floor.
// It is added in the material's own fragment shader, so the floor under an actor is untouched. Stage 1's values are zero, so its picture is exactly today's. k scales it (enemies a little weaker).
export const ACTOR = { lift: { value: new T.Color(0, 0, 0) }, key: { value: new T.Color(0, 0, 0) } };
export function setActorLight(a) { if (a) { ACTOR.lift.value.setRGB(a.lift[0], a.lift[1], a.lift[2]); ACTOR.key.value.setRGB(a.key[0], a.key[1], a.key[2]); } else { ACTOR.lift.value.setRGB(0, 0, 0); ACTOR.key.value.setRGB(0, 0, 0); } }
export function actorLit(mat, k = 1) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = sh => {
    if (prev) prev(sh); sh.uniforms.uALift = ACTOR.lift; sh.uniforms.uAKey = ACTOR.key;
    sh.vertexShader = 'varying vec3 vANormal;\n' + sh.vertexShader.replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\n vANormal = transformedNormal;');       // r128's Lambert has no normal in the fragment: send the view-space one
    sh.fragmentShader = 'uniform vec3 uALift; uniform vec3 uAKey; varying vec3 vANormal;\n' + sh.fragmentShader.replace('#include <envmap_fragment>', '#include <envmap_fragment>\n outgoingLight += (uALift * (0.55 + 0.45 * dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))) + uAKey * diffuseColor.rgb * max(dot(normalize(vANormal), vec3(0.0, 0.62, 0.78)), 0.0)) * ' + k.toFixed(2) + ';');
  };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : null; mat.customProgramCacheKey = () => (key ? key() : '') + 'actorlit' + k.toFixed(2);
  return mat;
}

// ---- the sky dome (engine plan step 2): a banded gradient in direction space (bands 12 with the dither, so a band edge is an ordered-dither pattern), a sun disc with a stepped glow, and clouds from the one noise texture
// (two cover levels, a lit and a shade colour, scrolling with the wind, fading toward the horizon). The dither is allowed on sky only (amendment 1). Stage 2 and 3 have no sun and no clouds.
export function makeSky() {
  const u = Object.assign({ uCover: E.cover, uSunOn: E.sunOn, uDither: E.dither, uSkyM: E.skyM, uCldL: E.cldL, uCldS: E.cldS, uDisc: E.disc }, engineUniforms());
  const mat = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, depthTest: false, fog: false, uniforms: u,
    vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: GLSL + `
    uniform float uCover; uniform float uSunOn; uniform float uDither; uniform vec3 uSkyM; uniform vec3 uCldL; uniform vec3 uCldS; uniform vec3 uDisc; varying vec3 vD;
    void main() {
      vec3 d = normalize(vD); float th = bayer() - 0.5;
      float k = floor(sqrt(max(d.y, 0.0)) * 12.0 + 0.5 + th * uDither) / 12.0;
      vec3 c = k < 0.4 ? mix(uSkyH, uSkyM, k / 0.4) : mix(uSkyM, uSkyT, (k - 0.4) / 0.6);
      float s = max(dot(d, uSunD), 0.0);
      if (uSunOn > 0.5) { c += uSunK * (floor(pow(s, 6.0) * 4.0 + 0.5 + th * uDither) / 4.0) * 0.22 * (1.0 - 0.5 * k); c = mix(c, uDisc, step(0.9985, s)); }
      if (uCover > 0.02 && d.y > 0.02) {
        vec2 p = d.xz / (d.y + 0.22) * 1.6 + uWind.xy * uT * 0.004;
        float n = N(p * 0.07).r * 0.62 + N(p * 0.19 + 3.0).a * 0.38, cv = floor(smoothstep(1.0 - uCover, 1.0 - uCover + 0.22, n) * 3.0 + 0.5 + th * uDither * 0.8) / 3.0;
        float lit = N(p * 0.07 + vec2(0.03, -0.02)).r; vec3 cc = mix(uCldS, uCldL, step(lit, n + 0.02));
        c = mix(c, cc, cv * smoothstep(0.02, 0.2, d.y) * 0.95);
      }
      c = mix(c, uSkyG, smoothstep(0.0, -0.1, d.y));
      gl_FragColor = vec4(c, 1.0);
    }` });
  const m = new T.Mesh(new T.SphereGeometry(500, 24, 12), mat); m.frustumCulled = false; m.renderOrder = -10; return m;
}
