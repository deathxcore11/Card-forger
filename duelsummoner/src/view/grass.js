// Blade grass (engine plan, wind and grass): single-triangle blades built in code, drawn as ONE instanced draw. View only; nothing here touches the sim.
//
// How it fills the ground without per-frame uploads: a fixed grid of patch slots (1.5 m cells) that wraps round the duelist in the vertex shader, so the same slots always cover the 60 m square around them and a cell
// keeps the same patch while it is in view. Which cells grow grass, and how thick, comes from a density map baked once per stage from the generator (meadow noise, never on the road, pools, the start, the gate, boss rings,
// encounters or the arena, never on a slope). Each slot is a patch of up to 24 blades; thin on bare sand, full in the meadows. Beyond 18 m patches thin out at random (a dither, not a fade) and are gone by 28 m.
// Blades are 0.16 to 0.44 m tall (nothing hides a pickup, a warning ring or an enemy's feet), widen with distance so none is thinner than a game pixel, lean with the one gust field, and part round the duelist.
const T = window.THREE;
import { MAP } from '../data/map.js';
import { heightAt } from '../sim/terrain.js';
import { bakeTufts, grassRadius } from '../gen/tufts.js';
import { GLSL, engineUniforms, E, MASK } from './engine.js';

const BLADES = 7, CHUNK = 32;
export function detailLevel() { const q = new URLSearchParams(location.search).get('detail'); if (q === 'low' || q === 'medium' || q === 'high') return q; const sv = typeof window !== 'undefined' && window.__dsDetail; if (sv === 'low' || sv === 'medium' || sv === 'high') return sv; const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0 || (typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches); return touch ? 'medium' : 'high'; }       // touch devices default to Medium; ?detail=high overrides

// Grass tufts (see gen/tufts.js for where they may stand): the whole stage is baked once into world-space instances and cut into 32 m chunks, so three culls the chunks off screen and nothing is uploaded while playing.
// A tuft is a handful of single-triangle blades. The vertex shader scales a tuft to nothing over the last 20% of the draw radius (a scale fade, never a pop) and the radius reaches past the fog start.
// Each tuft's base is the ground height at its own x,z (baked from the same height function the mesh uses); the blades sink 4 cm into it so none ever floats.
function bladeGeometry() {
  const pos = [], bl = [], rnd = (() => { let a = 12345; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  for (let i = 0; i < BLADES; i++) { const a = rnd() * 6.2832, r = Math.sqrt(rnd()) * 0.26, yaw = rnd() * 6.2832, h2 = rnd(); for (const [cx, cy] of [[-1, 0], [1, 0], [0, 1]]) { pos.push(cx, cy, 0); bl.push(Math.cos(a) * r, Math.sin(a) * r, yaw, h2); } }
  return { pos, bl };
}
export function buildGrass(map, stageIndex, S, theme, level, fogNear) {
  level = level || detailLevel(); if (level === 'low') return null;
  const R = grassRadius(fogNear), col = h => new T.Color(h), tufts = bakeTufts(map, S, heightAt, level === 'medium' ? 150 : 190), n = tufts.length / 4;
  const u = Object.assign({ uPl: E.pl, uR: { value: R }, uShT: MASK.tex, uShB: MASK.box, uShK: MASK.k,
    uC0: { value: col(theme.bladeCols[0]).multiplyScalar(0.75) }, uC1: { value: col(theme.bladeCols[1]) }, uC2: { value: col(theme.grass ? theme.grass[0] : 0x3f6e4e) }, uC3: { value: col(theme.grass ? theme.grass[1] : 0x74ae72) } }, engineUniforms(), T.UniformsUtils.clone(T.UniformsLib.fog));
  const mat = new T.ShaderMaterial({ uniforms: u, fog: true, side: T.DoubleSide,
    vertexShader: GLSL.slice(0, GLSL.indexOf('float bayer()')) + `
    uniform vec3 uPl; uniform float uR; uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform sampler2D uShT; uniform vec4 uShB; uniform float uShK;
    attribute vec4 aBl; attribute vec4 aT; varying vec3 vCol;
    #include <fog_pars_vertex>
    void main() {
      float cy = position.y, side = position.x, hh = aBl.w;
      vec2 root = aT.xz + aBl.xy;
      float dist = length(aT.xz - cameraPosition.xz);
      float fade = 1.0 - smoothstep(uR * 0.8, uR, dist);
      float height = (0.16 + 0.28 * hh) * mix(0.8, 1.15, aT.w) * fade;
      vec2 away = root - uPl.xz; float pr = length(away), push = clamp(1.0 - pr / 1.5, 0.0, 1.0); push *= push;
      height *= (1.0 - 0.45 * push) * smoothstep(1.2, 2.4, length(cameraPosition - vec3(root.x, aT.y, root.y)));
      float width = 0.075 * (1.0 + dist * 0.03);
      vec2 sd = vec2(cos(aBl.z), sin(aBl.z));
      float g = gust(aT.xz), bend = cy * cy * ((0.08 + 0.92 * g) * 0.2 + sin(uT * 5.0 + aT.x * 2.1 + aT.z * 1.7 + aBl.x * 6.0) * 0.015 * g);
      vec2 wd = normalize(uWind.xy), lean = wd * bend + normalize(away + 1e-4) * push * 0.4 * cy;
      vec3 wp = vec3(root.x + sd.x * side * width * 0.5 * (1.0 - cy) + lean.x, aT.y - 0.04 * (1.0 - cy) + cy * height, root.y + sd.y * side * width * 0.5 * (1.0 - cy) + lean.y);
      float zone = N(aT.xz * 0.02 + 0.3).a, tone = step(0.32, zone + (hh - 0.5) * 0.35);
      vec3 base = mix(mix(uC0, uC1, hh), uC2, tone);
      vCol = mix(base, mix(uC3, uC1, hh * 0.7), tone * smoothstep(0.35, 1.0, cy) * 0.75) * mix(0.74, 1.08, cy);
      { vec2 sp = root - normalize(uWind.xy) * (0.12 + 0.88 * g) * 0.6; vCol *= 1.0 - uShK * smoothstep(0.42, 0.58, texture2D(uShT, (sp - uShB.xy) / uShB.zw).r); }
      vec4 mvPosition = viewMatrix * vec4(wp, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
    fragmentShader: `varying vec3 vCol;
    #include <fog_pars_fragment>
    void main() { gl_FragColor = vec4(vCol, 1.0);
      #include <fog_fragment>
    }` });
  const bg = bladeGeometry(), group = new T.Group(), chunks = new Map();
  for (let k = 0; k < n; k++) { const x = tufts[k * 4], z = tufts[k * 4 + 2], key = Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK); let c = chunks.get(key); if (!c) { c = []; chunks.set(key, c); } c.push(k); }
  const geos = []; let tris = 0;
  for (const idx of chunks.values()) {
    const g = new T.InstancedBufferGeometry(), arr = new Float32Array(idx.length * 4); let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9, maxy = -1e9, miny = 1e9;
    idx.forEach((k, q) => { for (let c = 0; c < 4; c++) arr[q * 4 + c] = tufts[k * 4 + c]; const x = tufts[k * 4], y = tufts[k * 4 + 1], z = tufts[k * 4 + 2]; minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); maxy = Math.max(maxy, y); miny = Math.min(miny, y); });
    g.setAttribute('position', new T.Float32BufferAttribute(bg.pos, 3)); g.setAttribute('aBl', new T.Float32BufferAttribute(bg.bl, 4)); g.setAttribute('aT', new T.InstancedBufferAttribute(arr, 4)); g.instanceCount = idx.length;
    const cxm = (minx + maxx) / 2, czm = (minz + maxz) / 2, cym = (miny + maxy) / 2; g.boundingSphere = new T.Sphere(new T.Vector3(cxm, cym + 0.3, czm), Math.hypot(maxx - minx, maxz - minz, maxy - miny + 1) / 2 + 1);
    const m = new T.Mesh(g, mat); m.renderOrder = 1; m.frustumCulled = true; group.add(m); geos.push(g); tris += idx.length * BLADES;
  }
  group.userData.tris = tris; group.userData.tufts = n; group.userData.radius = R; group.userData.baked = tufts; group.geometry = { dispose() { for (const g of geos) g.dispose(); mat.dispose(); } };
  return group;
}
