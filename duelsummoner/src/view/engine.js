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
  pl: { value: new T.Vector3() }, tintC: { value: new T.Color(0, 0, 0) }, tintA: { value: 0 }, flameC: { value: new T.Color(0, 0, 0) }, skyMode: { value: 0 }, mist: { value: new T.Color(0x7fae9c) }, glow: { value: new T.Color(0x4f7f88) }, star: { value: new T.Color(0xe8eef8) }, moonL: { value: new T.Color(0xe4eaf2) }, moonD: { value: new T.Color(0x04060b) }, ash: { value: new T.Color(0x9c9078) },
  sunD: { value: new T.Vector3(0.5, 0.8, 0.3).normalize() }, sunK: { value: new T.Color(0xffe2b0) }
};
let gustT = 0;
export function setSkyTint(hex, flameHex, a) { E.tintC.value.setHex(hex || 0); E.flameC.value.setHex(flameHex || 0); E.tintA.value = a || 0; }       // Tier 5: the dome tints toward the lead element and its lowest quarter runs a stepped flame band
export function updateEngine(dt, look) {
  E.T.value += dt; gustT += dt;
  E.wind.value.z = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(gustT * 0.31)) + 0.2 * (0.5 + 0.5 * Math.sin(gustT * 0.83 + 1.7));       // a slow overall strength; the travelling fronts come from the noise field in gust()
  if (look) { const d = look.dome; E.skyT.value.setHex(d.top); E.skyM.value.setHex(d.mid); E.skyH.value.setHex(d.hor); E.skyG.value.setHex(d.gnd); E.cldL.value.setHex(d.cldL); E.cldS.value.setHex(d.cldS); E.cover.value = d.cover; E.sunOn.value = d.sun ? 1 : 0; E.skyMode.value = d.mode || 0; if (d.mist) E.mist.value.setHex(d.mist); if (d.glow) E.glow.value.setHex(d.glow); }
}
// GLSL shared by the engine shaders. N() reads the noise at a normalised coordinate; gust() is the ONE wind field (grass, trees, water, particles); skyBase() is the banded sky gradient the dome, the fog and the water agree on;
// bayer() is the one 4x4 ordered-dither threshold (sky, fog and haze only: amendment 1).
export const GLSL = `
uniform sampler2D uN; uniform float uT; uniform vec3 uWind; uniform vec3 uSkyT; uniform vec3 uSkyH; uniform vec3 uSkyG; uniform vec3 uSunD; uniform vec3 uSunK;
vec4 N(vec2 u) { return texture2D(uN, u); }
float hsh(vec2 t) { return texture2D(uN, (floor(t) + 0.5) / 64.0).b; }
float gust(vec2 p) {                                       // a travelling front: a sharp leading edge, a long tail behind it, broken into patches by the noise, crossing the ground at about 9 m/s with 40 m between fronts
  vec2 d = normalize(uWind.xy);
  float s = dot(p, d) * 0.025 - uT * 0.22 + 0.35 * (N(p * 0.013).r - 0.5), ph = fract(s);
  float front = smoothstep(0.0, 0.05, ph) * (1.0 - smoothstep(0.05, 0.5, ph));
  float gp = smoothstep(0.25, 0.65, N(p * 0.015 + 0.2).a);
  return mix(0.15, 1.0, front * gp) * uWind.z;
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

// ---- wind on instanced scenery: bends each instance along the gust direction by its height, read from the one gust() field at the instance's own spot (grass: tip lean and flutter; trees: a slow lean that lags the front).
// k = { h: height that counts as full bend (m), lean: metres of lean at full height in a full gust, flut: flutter in metres }. View only; vertex shader, so no per-frame upload.
export function windify(mat, k) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = sh => {
    if (prev) prev(sh); const u = engineUniforms(); for (const n in u) sh.uniforms[n] = u[n];
    sh.vertexShader = GLSL.slice(0, GLSL.indexOf('float bayer()')) + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
 { mat3 im_ = mat3(modelMatrix * instanceMatrix); vec3 ip_ = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; float g_ = gust(ip_.xz), hh_ = clamp(transformed.y / ${k.h.toFixed(2)}, 0.0, 1.0); hh_ *= hh_;
  float fl_ = sin(uT * 4.3 + ip_.x * 1.7 + ip_.z * 2.3 + transformed.x * 3.0) * ${k.flut.toFixed(3)} * g_;
  vec2 wd_ = normalize(uWind.xy); vec3 dw_ = vec3(wd_.x, 0.0, wd_.y) * (0.12 + 0.88 * g_) * ${k.lean.toFixed(3)} * hh_ + vec3(fl_ * hh_, 0.0, -fl_ * hh_);
  transformed += vec3(dot(im_[0], dw_), dot(im_[1], dw_), dot(im_[2], dw_)) / max(dot(im_[0], im_[0]), 1e-4); }
#endif`);
  };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : null; mat.customProgramCacheKey = () => (key ? key() : '') + 'windify' + k.h + k.lean + k.flut;
  return mat;
}

// ---- the shadow mask and the fog, on the ground and wall materials (engine plan step 8). The mask is baked once per stage (view/scenery.js) as tree, boulder and bush shadows on a top-down texture; the shader reads it at the pixel's own
// spot, nudged by the gust so the shadows sway with the canopies, and darkens the ground by a stepped amount; cloud shadows come from the same noise as the sky clouds, drifting with the wind. Fog is one formula here: height-dense low, capped
// (0.55 on far pieces so the rim keeps its silhouette) and quantised into 8 bands with the Bayer offset (dither is allowed on fog). Everything is view only and costs no extra draws.
const blackTex = new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, T.RGBAFormat); blackTex.needsUpdate = true;
export const MASK = { tex: { value: blackTex }, box: { value: new T.Vector4(-232, -232, 464, 464) }, k: { value: 0 }, ck: { value: 0 } };
// the stain map (spec 6.7, Tier 5): up to 6 stamped discs the ground shader recolours in an element's tone while the ground's own pattern stays visible (a mix, never a solid fill), ragged at the edge, 30% calmer inside 3 m of the duelist (the quiet eye)
export const STAIN = { a: { value: Array.from({ length: 6 }, () => new T.Vector4()) }, c: { value: Array.from({ length: 6 }, () => new T.Color()) }, k: { value: Array.from({ length: 6 }, () => new T.Color()) }, n: { value: 0 } };
export function setStains(list) { const n = Math.min(6, list.length); for (let i = 0; i < n; i++) { STAIN.a.value[i].set(list[i].x, list[i].z, list[i].r, 0); STAIN.c.value[i].setHex(list[i].hex); STAIN.k.value[i].setHex(list[i].hexK || list[i].hex); } STAIN.n.value = n; }
export function setShadeMask(tex, look) { MASK.tex.value = tex || blackTex; const d = look && look.dome; MASK.k.value = tex && d ? (d.shade || 0) : 0; MASK.ck.value = d && d.cover > 0.02 ? 0.12 : 0; }
// terrain blending: the ground tone is chosen per pixel from two octaves of the shared noise plus a fine ragged term, so the borders between the three sand tones wander instead of running along the 8 m cells (hard borders, no cross-fade)
const TERRAIN = `#include <color_fragment>
 { vec2 q = vWP.xz; float tn = N(q * 0.008 + 0.3).a * 0.65 + N(q * 0.022 + 0.6).r * 0.35 + (N(q * 0.35).g - 0.5) * 0.14 + (N(q * 1.1 + 0.2).r - 0.5) * 0.05;
   diffuseColor.rgb *= tn < 0.4 ? uS2 : tn < 0.6 ? uS0 : uS1; }`;
export function groundLit(mat, cap = 1, sand = null) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = sh => {
    if (prev) prev(sh); const u = engineUniforms(); for (const n in u) sh.uniforms[n] = u[n]; sh.uniforms.uStainA = STAIN.a; sh.uniforms.uStainC = STAIN.c; sh.uniforms.uStainK = STAIN.k; sh.uniforms.uStainN = STAIN.n; sh.uniforms.uPl = E.pl; sh.uniforms.uMask = MASK.tex; sh.uniforms.uMaskB = MASK.box; sh.uniforms.uMaskK = MASK.k; sh.uniforms.uCloudK = MASK.ck; sh.uniforms.uCover = E.cover; if (sand) { sh.uniforms.uS0 = { value: new T.Color(sand[0]) }; sh.uniforms.uS1 = { value: new T.Color(sand[1]) }; sh.uniforms.uS2 = { value: new T.Color(sand[2]) }; }
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = GLSL + (sand ? 'uniform vec3 uS0; uniform vec3 uS1; uniform vec3 uS2;\n' : '') + 'uniform vec4 uStainA[6]; uniform vec3 uStainC[6]; uniform vec3 uStainK[6]; uniform int uStainN; uniform vec3 uPl; uniform sampler2D uMask; uniform vec4 uMaskB; uniform float uMaskK; uniform float uCloudK; uniform float uCover; varying vec3 vWP;\n' + (sand ? sh.fragmentShader.replace('#include <color_fragment>', TERRAIN) : sh.fragmentShader).replace('#include <fog_fragment>', `#ifdef USE_FOG
 { vec2 wxz = vWP.xz; float gg = gust(wxz); vec2 wd = normalize(uWind.xy), sp = wxz - wd * (0.12 + 0.88 * gg) * 0.6;
  float tm = smoothstep(0.42, 0.58, texture2D(uMask, (sp - uMaskB.xy) / uMaskB.zw).r);
  float cn = N(wxz * 0.012 + uWind.xy * uT * 0.0012).r * 0.62 + N(wxz * 0.032 + 3.0).a * 0.38, cs = step(1.0 - uCover, cn);
  gl_FragColor.rgb *= 1.0 - uMaskK * tm - uCloudK * cs;
  float quiet = 0.3 + 0.7 * smoothstep(1.5, 4.5, length(wxz - uPl.xz)); float luma = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
  for (int si = 0; si < 6; si++) { if (si >= uStainN) break; float sd = length(wxz - uStainA[si].xy) / uStainA[si].z + (N(wxz * 0.35).g - 0.5) * 0.14; if (sd < 1.0) { float cd = N(wxz * 0.09).g, crack = smoothstep(0.80, 0.93, cd), pls = 0.5 + 0.5 * sin(uT * 1.1 + floor(wxz.x * 0.09) * 1.7 + floor(wxz.y * 0.09) * 2.3); vec3 plate = uStainC[si] * (0.45 + 0.7 * luma), ck = min(uStainK[si] * (1.0 + 0.35 * pls), vec3(1.0)); gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(plate, ck, crack), (0.64 + 0.3 * crack) * quiet); } }
  float fd = smoothstep(fogNear, fogFar, fogDepth) * mix(1.3, 0.8, clamp(vWP.y / 30.0, 0.0, 1.0));
  fd = clamp(floor(fd * 8.0 + bayer()) / 8.0, 0.0, ${cap.toFixed(2)}); gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fd); }
#endif`);
  };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : null; mat.customProgramCacheKey = () => (key ? key() : '') + 'groundlit' + cap + (sand ? 's' : '');
  return mat;
}

// ---- the sky dome (engine plan step 2): a banded gradient in direction space (bands 12 with the dither, so a band edge is an ordered-dither pattern), a sun disc with a stepped glow, and clouds from the one noise texture
// (two cover levels, a lit and a shade colour, scrolling with the wind, fading toward the horizon). The dither is allowed on sky only (amendment 1). Stage 2 and 3 have no sun and no clouds.
export function makeSky() {
  const u = Object.assign({ uTintC: E.tintC, uTintA: E.tintA, uFlameC: E.flameC, uMode: E.skyMode, uMist: E.mist, uGlow: E.glow, uStar: E.star, uMoonL: E.moonL, uMoonD: E.moonD, uAsh: E.ash, uCover: E.cover, uSunOn: E.sunOn, uDither: E.dither, uSkyM: E.skyM, uCldL: E.cldL, uCldS: E.cldS, uDisc: E.disc }, engineUniforms());
  const mat = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, depthTest: true, depthFunc: T.LessEqualDepth, fog: false, uniforms: u,
    vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: GLSL + `
    uniform vec3 uTintC; uniform float uTintA; uniform vec3 uFlameC; uniform float uMode; uniform vec3 uMist; uniform vec3 uGlow; uniform vec3 uStar; uniform vec3 uMoonL; uniform vec3 uMoonD; uniform vec3 uAsh;
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
      if (uMode > 0.5 && uMode < 1.5 && d.y > 0.0) {
        float az = atan(d.z, d.x) / 6.2832 * 3.0;
        float b1 = smoothstep(0.05, 0.0, abs(d.y - 0.075)) * smoothstep(0.38, 0.7, N(vec2(az + uT * 0.004, 0.31)).r);
        float b2 = smoothstep(0.04, 0.0, abs(d.y - 0.17)) * smoothstep(0.42, 0.74, N(vec2(az * 1.3 - uT * 0.003, 0.67)).a) * 0.7;
        float mb = floor(max(b1, b2) * 3.0 + 0.5 + th * uDither * 0.8) / 3.0;
        c = mix(c, uMist, mb * 0.6);
        float gs = max(dot(d, normalize(vec3(-0.6, 0.14, -0.5))), 0.0);
        c += uGlow * (floor(pow(gs, 14.0) * 4.0 + 0.5 + th * uDither) / 4.0) * 0.5;
      }
      if (uMode > 1.5 && d.y > 0.0) {
        vec2 sc = floor(vec2(atan(d.z, d.x) * 573.0, asin(clamp(d.y, -1.0, 1.0)) * 573.0));
        vec2 so = floor(sc / 64.0).yx * vec2(23.0, 37.0);
        float h1 = hsh(sc + so), h2 = hsh(sc + so + vec2(11.0, 29.0)), h3 = hsh(sc + so + vec2(41.0, 7.0)), h4 = hsh(sc.yx + so);
        if (h1 > 0.93 && h2 > 0.93 && h3 > 0.93) { float tw = h4 > 0.5 ? 0.65 + 0.35 * sin(uT * (0.5 + h4) + h1 * 40.0) : 1.0; c = mix(c, uStar, (0.55 + 0.45 * h3) * tw * smoothstep(0.02, 0.2, d.y)); }
        vec3 ed = normalize(vec3(-0.85, 0.5, -0.25)), ex = normalize(cross(ed, vec3(0.0, 1.0, 0.0))), ey = cross(ed, ex);
        float a = acos(clamp(dot(d, ed), -1.0, 1.0)), R = 0.075;
        if (a < R + 0.05) {
          float phi = atan(dot(d, ey), dot(d, ex)) / 6.2832 * 28.0, fi = floor(phi), fr = phi - fi, len = 0.012 + 0.03 * hsh(vec2(fi + 3.0, 5.0)) * hsh(vec2(fi * 0.5 + 9.0, 2.0));
          if (a < R - 0.004) c = uMoonD;
          if (abs(a - R) < 0.0042) c = uMoonL;
          else if (a > R && a < R + len && abs(fr - 0.5) < 0.14 * (1.0 - (a - R) / len)) c = uAsh;
        }
      }
      if (uTintA > 0.0 && d.y > 0.0) { c = mix(c, uTintC, uTintA); float az3 = atan(d.z, d.x) / 6.2832 * 42.0, cell3 = floor(az3), cf3 = fract(az3), nh3 = N(vec2(cell3 * 0.173, floor(uT * 8.0) / 64.0 * 3.0)).r, lim3 = 0.03 + 0.2 * (0.3 + 0.7 * nh3) * (1.0 - 1.5 * abs(cf3 - 0.5)); if (d.y < lim3) c = mix(c, uFlameC, d.y < lim3 * 0.45 ? 0.95 : (d.y < lim3 * 0.8 ? 0.8 : 0.62)); }
      c = mix(c, uSkyG, smoothstep(0.0, -0.1, d.y));
      gl_FragColor = vec4(c, 1.0);
    }` });
  const m = new T.Mesh(new T.SphereGeometry(500, 24, 12), mat); m.frustumCulled = false; m.renderOrder = 100; return m;       // the sky is drawn LAST among the opaque draws, at depth 1 with LEQUAL, so it only shades the pixels nothing else covered (spec 2.12 d)
}
