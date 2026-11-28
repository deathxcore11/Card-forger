// What makes each map's ground a place of its own (owner, 28 Nov: "really work on environments and map feel"). View only; nothing here touches the sim.
// One table, FEEL, keyed by the map theme: the ground's material pattern (drawn in the ground shader on the 24 cm block grid: speckle, two kinds of patches, cracks or tile joints,
// slow lit veins or specks, a wind sweep), the low mist that lies in the hollows (drawn in the screen pass from the depth), the weather in the air, and the small life on the ground
// (src/view/groundlife.js). Colours are the theme's own family; violet b26bff stays reserved for summons, so no ground uses it.
const T = window.THREE;
const mixc = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };

// pattern: a (patch A colour, size in m, cover 0..1), b (patch B), crack [colour, cell size m, strength, only inside A], glow [colour, kind 0 veins 1 specks 2 none, strength], speck, sweep
// mist: [colour, depth in m, strength]; weather: kind fall | rise | blow | rain, colours, share of the air motes it takes, speed
// fauna: flyers near the duelist (count, body and wing colours, size, height and loop radius ranges, speed, wing beat; glow = fireflies and moths that light at night too)
// life: per 1.25 m cell chance, float (what drifts on open water: chance, colours, width, height, glow), and the kinds: [weight, base colour, tip colour, width, min height, max height, sway, glow]
export const FEEL = {
  desert: { fauna: { n: 7, c: [0x4a3424, 0x6a4a30, 0x3a2a20], size: 1.5, h: [14, 30], r: [14, 34], speed: 6, flap: 2.2 }, a: [0xb9803f, 15, 0.36], b: [0xdcc08a, 6, 0.2], crack: [0x7a4c24, 2.6, 0.85, 1], glow: [0xffe6a0, 1, 0.5], speck: 0.08, sweep: 0.7,
    mist: [0xf2cf9a, 3.2, 0.3], weather: { kind: 'blow', c: [0xf6dfae, 0xe2b877], share: 0.7, speed: 9 },
    life: { d: 0.3, kinds: [[5, 0x9a7a3a, 0xd9b45a, 1, 0.3, 0.7, 1, 0], [3, 0x8f6c44, 0xb08a5a, 2.4, 0.1, 0.2, 0, 0], [1, 0xd8cdb4, 0xf4ecd8, 1.6, 0.08, 0.16, 0, 0], [1, 0x6f7a3a, 0xff8a5a, 0.8, 0.3, 0.5, 0.8, 0]] } },
  'ashen-orchard': { fauna: { n: 8, c: [0x18121a, 0x241a22, 0xff6a1a], size: 1.1, h: [8, 22], r: [10, 26], speed: 7, flap: 5 }, a: [0x2a2024, 13, 0.42], b: [0x9a8f8a, 5, 0.22], crack: [0x140c10, 2.2, 0.9, 1], glow: [0xff5a20, 0, 1.25], speck: 0.09, sweep: 0.3,
    mist: [0x5c4654, 4, 0.42], weather: { kind: 'rise', c: [0xff7a3a, 0xffc060, 0x8a8284], share: 0.75, speed: 1.6 },
    life: { d: 0.26, kinds: [[4, 0x1c1418, 0x3a2c2c, 1, 0.25, 0.8, 0.3, 0], [3, 0x6e6460, 0x9a8f8a, 2.6, 0.08, 0.18, 0, 0], [2, 0x2a1c1c, 0xff6a1a, 0.8, 0.2, 0.45, 0.5, 0.9], [1, 0x3a3034, 0x57494c, 1.8, 0.2, 0.4, 0, 0]] } },
  'dawn-causeway': { fauna: { n: 9, c: [0xfff6ee, 0xffffff, 0xffc8dc], size: 1.6, h: [10, 26], r: [14, 36], speed: 5, flap: 2 }, a: [0xf2bccb, 12, 0.36], b: [0xfff0c4, 5, 0.26], crack: [0xe2b040, 3.4, 0.7, 0], glow: [0xffd870, 0, 0.35], speck: 0.07, sweep: 0.3,
    mist: [0xffd9e4, 3, 0.36], weather: { kind: 'blow', c: [0xff9ac4, 0xffd0e0, 0xfff0c0], share: 0.7, speed: 2.6 },
    life: { d: 0.3, float: [0.4, 0x6ab88a, 0xffb0d0, 3.0, 0.07, 0.2], kinds: [[4, 0x7fc49a, 0xb8e8c0, 1, 0.25, 0.6, 1, 0], [3, 0x6aa884, 0xff8fc0, 0.9, 0.3, 0.55, 0.9, 0.15], [2, 0x6aa884, 0xfff2a8, 0.9, 0.25, 0.45, 0.9, 0.2], [1, 0xe8d2c8, 0xfff6ee, 2.2, 0.08, 0.16, 0, 0]] } },
  'frostbound-archive': { fauna: { n: 6, c: [0xeef4fc, 0xffffff, 0xc8d8ec], size: 1.4, h: [10, 24], r: [12, 30], speed: 5.5, flap: 2.6 }, a: [0x8fbfe6, 14, 0.4], b: [0xffffff, 6, 0.24], crack: [0xe6faff, 3, 0.85, 1], glow: [0x9fe6ff, 1, 0.7], speck: 0.06, sweep: 0.8,
    mist: [0xe2f2ff, 2.6, 0.4], weather: { kind: 'fall', c: [0xffffff, 0xdff2ff], share: 0.8, speed: 2.2 },
    life: { d: 0.22, kinds: [[4, 0x7fc8f0, 0xd8f6ff, 0.9, 0.3, 0.9, 0, 0.25], [3, 0xb8c8dc, 0xeef6ff, 1, 0.2, 0.45, 0.7, 0], [3, 0xdfe8f4, 0xffffff, 2.6, 0.1, 0.22, 0, 0], [1, 0xd8c8a8, 0xf4ead0, 1.8, 0.04, 0.07, 0, 0]] } },
  'kite-steppe': { fauna: { n: 12, c: [0x5a4630, 0xff5a4a, 0xffd24a, 0x4ac8ff, 0xffffff], size: 1.5, h: [12, 34], r: [12, 40], speed: 8, flap: 1.6 }, a: [0x5c8a36, 16, 0.5], b: [0xdcc65a, 7, 0.26], crack: [0x8a6a3a, 5, 0.0, 0], glow: [0xf4f4e0, 2, 0], speck: 0.12, sweep: 1.4,
    mist: [0xe8f0b0, 2.2, 0.16], weather: { kind: 'blow', c: [0xf4f4e0, 0xdcc65a, 0xb8d070], share: 0.75, speed: 13 },
    life: { d: 0.72, kinds: [[8, 0x4f7e30, 0x9cc450, 1, 0.3, 0.75, 1.3, 0], [4, 0x7a8e36, 0xe6d470, 1, 0.4, 0.85, 1.3, 0], [1, 0x4f7e30, 0xff5a4a, 0.8, 0.35, 0.6, 1, 0], [1, 0x4f7e30, 0xffffff, 0.8, 0.3, 0.55, 1, 0], [1, 0x8a7a5a, 0xa89a78, 2.2, 0.1, 0.2, 0, 0]] } },
  sporefen: { fauna: { n: 16, c: [0xcaff7a, 0x8aff5a, 0x40ffc8], size: 0.22, h: [0.8, 3.2], r: [2, 9], speed: 1.2, flap: 14, glow: 1, bob: 0.5 }, a: [0x26341f, 12, 0.4], b: [0x7aa838, 5, 0.3], crack: [0x18220f, 3, 0.0, 0], glow: [0x39ff14, 1, 1.5], speck: 0.14, sweep: 0.1,
    mist: [0x4c8f6c, 4.6, 0.55], weather: { kind: 'rise', c: [0x8aff5a, 0x40ffc8, 0xe8ff9a], share: 0.8, speed: 0.5 },
    life: { d: 0.5, float: [0.5, 0x2f6a36, 0x8fd060, 3.4, 0.07, 0.25], kinds: [[4, 0x2f5a26, 0x6fae3a, 1.1, 0.3, 0.8, 0.6, 0], [3, 0xd8d0b8, 0x40ffc8, 1.5, 0.2, 0.5, 0.15, 1], [2, 0xd8d0b8, 0xff9a3a, 1.3, 0.15, 0.35, 0.15, 0.7], [2, 0x3a4a2a, 0x5a7a3a, 2.4, 0.1, 0.2, 0, 0], [1, 0x2f5a26, 0xe8ff9a, 0.8, 0.4, 0.8, 0.8, 0.5]] } },
  'starless-vault': { fauna: { n: 14, c: [0xdfe8ff, 0x7fb0ff, 0xfff0b0], size: 0.3, h: [1.5, 9], r: [3, 14], speed: 1.4, flap: 9, glow: 1, bob: 0.8 }, a: [0x1a1630, 18, 0.34], b: [0x3a3654, 7, 0.22], crack: [0x0a0814, 3.0, 0.9, 0], glow: [0x7fb0ff, 1, 1.6], speck: 0.12, sweep: 0,
    mist: [0x1c1c48, 5, 0.5], weather: { kind: 'fall', c: [0x7fb0ff, 0xdfe8ff, 0x55608a], share: 0.75, speed: 0.6 },
    life: { d: 0.2, kinds: [[3, 0x3a4a8a, 0x9fc4ff, 0.8, 0.3, 1.0, 0, 0.9], [4, 0x2a2840, 0x45425e, 2.4, 0.1, 0.24, 0, 0], [2, 0x22203a, 0x3a3654, 1.6, 0.25, 0.5, 0, 0], [1, 0x3a3654, 0xfff0b0, 0.6, 0.25, 0.4, 0, 1]] } },
  'stormglass-flats': { fauna: { n: 8, c: [0x5a6670, 0x8a98a4, 0xdcecf4], size: 1.2, h: [9, 24], r: [14, 34], speed: 10, flap: 4 }, a: [0x33424f, 15, 0.42], b: [0xaab6be, 6, 0.22], crack: [0xdcecf4, 2.8, 0.85, 1], glow: [0xfff04a, 0, 1.0], speck: 0.1, sweep: 0.3,
    mist: [0x6c7c94, 3.2, 0.38], weather: { kind: 'rain', c: [0xbfd4e6, 0xe8f4ff, 0xfff04a], share: 0.8, speed: 26 },
    life: { d: 0.24, kinds: [[4, 0x5a7a90, 0xd8f0ff, 0.8, 0.25, 0.9, 0, 0.3], [3, 0x6a7680, 0x94a0a8, 2.4, 0.1, 0.2, 0, 0], [2, 0x8a8478, 0xc8c0b0, 0.7, 0.3, 0.7, 0.15, 0], [1, 0x4a5a6a, 0xfff04a, 0.6, 0.3, 0.6, 0, 1]] } }
};
FEEL.ash = FEEL['ashen-orchard'];
export const feelFor = th => (th && FEEL[th.id]) || FEEL.desert;

// ---- the ground pattern (uniforms shared by every ground chunk; a new stage only changes the values)
const GU = { uGA: { value: new T.Color() }, uGB: { value: new T.Color() }, uGC: { value: new T.Color() }, uGG: { value: new T.Color() }, uGP: { value: new T.Vector4(14, 0.6, 6, 0.7) }, uGQ: { value: new T.Vector4(0.1, 0.5, 0, 0.5) }, uGR: { value: new T.Vector4(3, 2, 0, 1) }, uTrk: { value: Array.from({ length: 32 }, () => new T.Vector3(0, 0, 0)) } };
// the card leaves a track on the ground it rides: the last 32 points (one every 1.1 m), each fading over about ten seconds
let trkI = 0, trkX = 1e9, trkZ = 1e9;
export function groundTrack(x, z, grounded, dt) { const A = GU.uTrk.value, k = Math.max(0, 1 - dt * 0.11); for (const q of A) q.z *= k; if (!grounded) { trkX = 1e9; return; } const dx = x - trkX, dz = z - trkZ; if (dx * dx + dz * dz < 1.2) return; trkX = x; trkZ = z; trkI = (trkI + 1) % 32; A[trkI].set(x, z, 1); }
export function clearTracks() { for (const q of GU.uTrk.value) q.z = 0; trkX = 1e9; }
export function setGroundFeel(th) {
  const F = feelFor(th), t = th && th.now && th.now.groundTint, tint = c => (t ? mixc(c, t[0], t[1] * 0.8) : c), night = th && th.time === 'night';
  GU.uGA.value.setHex(tint(F.a[0])); GU.uGB.value.setHex(tint(F.b[0])); GU.uGC.value.setHex(tint(F.crack[0])); GU.uGG.value.setHex(F.glow[0]);
  GU.uGP.value.set(F.a[1], 1 - F.a[2] * 0.55 - 0.22, F.b[1], 1 - F.b[2] * 0.55 - 0.22);       // cover to a noise threshold (the two-octave noise sits mostly between 0.25 and 0.75)
  GU.uGQ.value.set(F.speck, F.crack[2], F.glow[1] === 2 ? 0 : F.glow[2] * (night ? 1.5 : 1), F.sweep);
  GU.uGR.value.set(F.crack[1], F.glow[1], 0, F.crack[3]);
}
export function groundPattern(mat, lite) {       // lite (Low detail): no cracks, veins or card track
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.onBeforeCompile = sh => {
    if (prev) prev(sh); if (!sh.fragmentShader.includes('#include <color_fragment>') || !sh.fragmentShader.includes('varying vec3 vWP;')) return; Object.assign(sh.uniforms, GU);
    sh.fragmentShader = sh.fragmentShader.replace('varying vec3 vWP;', `varying vec3 vWP; uniform vec3 uGA; uniform vec3 uGB; uniform vec3 uGC; uniform vec3 uGG; uniform vec4 uGP; uniform vec4 uGQ; uniform vec4 uGR; uniform vec3 uTrk[32];
` + (lite ? '#define GP_LITE\n' : '') + `float gh21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float gvn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gh21(i), gh21(i + vec2(1.0, 0.0)), f.x), mix(gh21(i + vec2(0.0, 1.0)), gh21(i + vec2(1.0, 1.0)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{ vec3 gn = normalize(cross(dFdx(vWP), dFdy(vWP))); float flt = step(0.6, abs(gn.y));
  vec2 cell = floor(vWP.xz / 0.24 + 0.001), cp = (cell + 0.5) * 0.24; float gd = length(vWP - cameraPosition), nearK = 1.0 - smoothstep(60.0, 150.0, gd), midK = 1.0 - smoothstep(110.0, 260.0, gd);
  float h = gh21(cell);
  float nA = gvn(cp / uGP.x) * 0.7 + gvn(cp / (uGP.x * 0.31) + 17.0) * 0.3 + (h - 0.5) * 0.05 * nearK;
  float nB = gvn(cp / uGP.z + 41.0) * 0.7 + gvn(cp / (uGP.z * 0.37) + 7.0) * 0.3 + (h - 0.5) * 0.05 * nearK;
  float inA = step(uGP.y, nA), inA2 = step(uGP.y + 0.035, nA), inB = step(uGP.w, nB) * (1.0 - inA), inB2 = step(uGP.w + 0.03, nB) * (1.0 - inA);
  vec3 g = diffuseColor.rgb;
  g = mix(g, uGA * 1.12, inA * 0.6 * flt); g = mix(g, uGA, inA2 * 0.8 * flt);                 // a patch has a paler rim one step wide, so it reads as a layer set into the ground
  g = mix(g, uGB * 0.93, inB * 0.55 * flt); g = mix(g, uGB, inB2 * 0.75 * flt);
  float crack = 0.0;
#ifndef GP_LITE
  if (uGQ.y > 0.0 || (uGQ.z > 0.0 && uGR.y < 0.5)) { vec2 q = cp / uGR.x, qi = floor(q), qf = fract(q); float d1 = 9.0, d2 = 9.0;
    for (int yy = -1; yy <= 1; yy++) for (int xx = -1; xx <= 1; xx++) { vec2 o = vec2(float(xx), float(yy)), r = o + vec2(gh21(qi + o), gh21(qi + o + 57.0)) - qf; float d = dot(r, r); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    crack = (1.0 - step(0.2 / uGR.x, sqrt(d2) - sqrt(d1))) * mix(1.0, inA, uGR.w) * flt * midK; g = mix(g, uGC, crack * uGQ.y); }
#endif
  g *= 1.0 + (h - 0.5) * 2.0 * uGQ.x * nearK; g *= 1.0 - 0.16 * step(0.975, h) * nearK + 0.14 * step(h, 0.02) * nearK;       // speckle, and a rare darker or paler block
  if (flt < 0.5) g *= 0.95 + 0.1 * gh21(vec2(floor(vWP.y / 0.24), 3.0)) * nearK;                // step sides show their layers
  float sw = gust(cp) * uGQ.w * flt; g = mix(g, min(g * 1.3 + 0.03, vec3(1.0)), clamp(sw * 0.55, 0.0, 0.6));       // the wind crosses the ground as a pale front (sand, spindrift, a wave in the grass)
#ifndef GP_LITE
  if (gd < 80.0 && flt > 0.5) { float tk = 0.0; for (int ti = 0; ti < 32; ti++) { vec3 q = uTrk[ti]; vec2 dd = cp - q.xy; tk = max(tk, q.z * step(dot(dd, dd), 0.24)); } g *= 1.0 - 0.26 * tk; }       // the card's track
#endif
  diffuseColor.rgb = g;
  if (uGQ.z > 0.0) { float pl = 0.55 + 0.45 * sin(uT * 0.8 + gvn(cp / 11.0) * 9.0), gl = uGR.y < 0.5 ? crack * pl : step(0.9935, h) * flt * nearK * (0.5 + 0.5 * sin(uT * 1.3 + h * 400.0));
    totalEmissiveRadiance += uGG * gl * uGQ.z; }
}`);
  };
  mat.customProgramCacheKey = () => key() + 'gpat' + (lite ? 'l' : '');
  return mat;
}

// ---- the low mist: read by the screen pass. x = the height it lies under (the duelist's ground + depth), y = depth, z = strength, w = time
export const MIST = { p: new T.Vector4(0, 3, 0, 0), c: new T.Color(0xffffff) };
export const MIST_GLSL = 'if (uMist.z > 0.0) { float mz = texture(tDepth, vUv).x; if (mz < 0.99999) { vec4 m4 = uInvVP * vec4(vUv / uTBinfo.zw * 2.0 - 1.0, mz * 2.0 - 1.0, 1.0); vec3 mp = m4.xyz / m4.w; float md = length(mp.xz - uRip.xy), mn = 0.5 + 0.5 * sin(mp.x * 0.07 + uMist.w * 0.23 + sin(mp.z * 0.05 - uMist.w * 0.14) * 2.2), mk = clamp((uMist.x + (mn - 0.5) * uMist.y - mp.y) / uMist.y, 0.0, 1.0) * uMist.z * (0.5 + 0.5 * mn) * smoothstep(7.0, 30.0, md); c = mix(c, uMistC, floor(mk * 6.0 + 0.5) / 6.0); } } ';
export function setMist(th, groundY, t, on) { const F = feelFor(th), night = th && th.time === 'night'; MIST.c.setHex(night ? mixc(F.mist[0], 0x0c1030, 0.55) : F.mist[0]); MIST.p.set(groundY + F.mist[1] * 0.35, F.mist[1], on ? F.mist[2] : 0, t); }

// ---- open water (the causeway's lagoon, the fen): the flat sheet gets a moving block pattern: slow bright swells, dark troughs, sparkles, all on a 48 cm grid so it stays in the block look
export function waterFeel(mat, glint) {
  const U = { uWG: { value: new T.Color(glint) } };
  mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, { uWT: WT });
    sh.vertexShader = 'varying vec3 vWW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `varying vec3 vWW; uniform vec3 uWG; uniform float uWT;
float wh21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float wvn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(wh21(i), wh21(i + vec2(1.0, 0.0)), f.x), mix(wh21(i + vec2(0.0, 1.0)), wh21(i + vec2(1.0, 1.0)), f.x), f.y); }
` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{ vec2 cell = floor(vWW.xz / 0.48), cp = (cell + 0.5) * 0.48; float gd = length(vWW - cameraPosition), nk = 1.0 - smoothstep(90.0, 220.0, gd);
  float a = wvn(cp / 5.0 + vec2(uWT * 0.11, uWT * 0.05)), b = wvn(cp / 1.9 - vec2(uWT * 0.08, -uWT * 0.13)), n = a * 0.6 + b * 0.4;
  vec3 w = diffuseColor.rgb; w = mix(w, w * 0.78, step(n, 0.36) * nk); w = mix(w, mix(w, uWG, 0.5), step(0.6, n) * nk); w = mix(w, uWG, step(0.71, n) * 0.55 * nk);
  float sp = step(0.988, wh21(cell + floor(uWT * 1.5 + wh21(cell) * 7.0))) * nk; w = mix(w, vec3(1.0), sp * 0.8);
  diffuseColor.rgb = w; }`); };
  return mat;
}
export const WT = { value: 0 };
