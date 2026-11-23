// Blade grass (engine plan, wind and grass): single-triangle blades built in code, drawn as ONE instanced draw. View only; nothing here touches the sim.
//
// How it fills the ground without per-frame uploads: a fixed grid of patch slots (1.5 m cells) that wraps round the duelist in the vertex shader, so the same slots always cover the 60 m square around them and a cell
// keeps the same patch while it is in view. Which cells grow grass, and how thick, comes from a density map baked once per stage from the generator (meadow noise, never on the road, pools, the start, the gate, boss rings,
// encounters or the arena, never on a slope). Each slot is a patch of up to 24 blades; thin on bare sand, full in the meadows. Beyond 18 m patches thin out at random (a dither, not a fade) and are gone by 28 m.
// Blades are 0.16 to 0.44 m tall (nothing hides a pickup, a warning ring or an enemy's feet), widen with distance so none is thinner than a game pixel, lean with the one gust field, and part round the duelist.
const T = window.THREE;
import { MAP } from '../data/map.js';
import { heightAt } from '../sim/terrain.js';
import { roadPath, roadDist, poolSpots } from '../gen/road.js';
import { strHash, noise2 } from '../gen/scatter.js';
import { GLSL, engineUniforms, E, MASK } from './engine.js';

const CELL = 1.2, BLADES = 36, HALF = 232, MN = 256;
export function detailLevel() { const q = new URLSearchParams(location.search).get('detail'); if (q === 'low' || q === 'medium' || q === 'high') return q; const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0 || (typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches); return touch ? 'medium' : 'high'; }       // touch devices default to Medium; ?detail=high overrides

// density map: R = how thick (0 none, 255 full), G = ground height (0 to 4 m)
export function bakeDensity(map, S) {
  const d = new Uint8Array(MN * MN * 4), seed = strHash(String(map.hash || map.key || 'x')), pat = noise2(seed ^ 0xA11CE), R = (MAP && MAP.boundaryR ? MAP.boundaryR : 195) * 0.94, road = roadPath(map);
  const keep = [{ x: map.spawn.x, z: map.spawn.z, r: 9 }, { x: map.gate.x, z: map.gate.z, r: 12 }]; if (map.arena) keep.push({ x: map.arena.center.x, z: map.arena.center.z, r: 17 });
  for (const p of poolSpots(map)) keep.push({ x: p.x, z: p.z, r: p.r + 3.5 });
  for (const b of map.bossRings || []) keep.push({ x: b.x, z: b.z, r: (b.r || 14) + 3 });
  for (const e of map.encounters || []) keep.push({ x: e.x, z: e.z, r: 5 });
  const sz = 2 * HALF / MN;
  for (let j = 0; j < MN; j++) for (let i = 0; i < MN; i++) {
    const x = -HALF + (i + 0.5) * sz, z = -HALF + (j + 0.5) * sz, o = (j * MN + i) * 4; if (x * x + z * z > R * R) continue;
    const h = heightAt(x, z); if (h > 2.5 || Math.abs(heightAt(x + 1.6, z) - h) > 0.3 || Math.abs(heightAt(x, z + 1.6) - h) > 0.3) continue;
    if (roadDist(road, x, z) < 5.2) continue;       // the road strip is 4.5 m wide: keep 1 m either side clear, plus the 1.8 m cell the filtered density map bleeds across
     let bad = false; for (const k of keep) { const dx = x - k.x, dz = z - k.z; if (dx * dx + dz * dz < k.r * k.r) { bad = true; break; } } if (bad) continue;
    const m = pat(x * 0.03 + 40, z * 0.03 + 9), mm = pat(x * 0.012 + 7, z * 0.012 + 70);       // meadows: the same noise the flowers use, plus a broad one
    d[o] = Math.round(255 * Math.min(1, 0.16 + Math.max(0, m - 0.42) * 3.2 + Math.max(0, mm - 0.5) * 1.5)); d[o + 1] = Math.round(h / 4 * 255); d[o + 3] = 255;
  }
  for (const s of (S && S.trees || []).flat()) {                                  // thicker at the feet of trees and rocks, as the old tufts were
    const i = Math.floor((s[0] + HALF) / sz), j = Math.floor((s[2] + HALF) / sz), r = 3; for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= MN || jj >= MN) continue; const o = (jj * MN + ii) * 4; if (d[o] > 0 && di * di + dj * dj <= r * r) d[o] = Math.max(d[o], 190); }
  }
  const tex = new T.DataTexture(d, MN, MN, T.RGBAFormat); tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping; tex.minFilter = tex.magFilter = T.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true; return tex;
}

function bladeGeometry(slots) {
  const g = new T.InstancedBufferGeometry(), pos = [], bl = [], rnd = (() => { let a = 12345; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  for (let i = 0; i < BLADES; i++) { const rx = (rnd() - 0.5) * CELL * 1.05, rz = (rnd() - 0.5) * CELL * 1.05, yaw = rnd() * 6.2832, h2 = rnd(); for (const [cx, cy] of [[-1, 0], [1, 0], [0, 1]]) { pos.push(cx, cy, 0); bl.push(rx, rz, yaw, h2); } }
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('aBl', new T.Float32BufferAttribute(bl, 4)); g.setAttribute('aSlot', new T.InstancedBufferAttribute(Float32Array.from({ length: slots }, (_, i) => i), 1)); g.instanceCount = slots; return g;
}

export function buildGrass(map, stageIndex, S, theme, level) {
  level = level || detailLevel(); if (level === 'low') return null;
  const W = level === 'medium' ? 22 : 32, col = h => new T.Color(h);
  const u = Object.assign({ uMask: { value: bakeDensity(map, S) }, uBox: { value: new T.Vector4(-HALF, -HALF, 2 * HALF, 2 * HALF) }, uPl: E.pl, uW: { value: W }, uR: { value: W * CELL * 0.47 }, uShT: MASK.tex, uShB: MASK.box, uShK: MASK.k,
    uC0: { value: col(theme.bladeCols[0]).multiplyScalar(0.75) }, uC1: { value: col(theme.bladeCols[1]) }, uC2: { value: col(theme.grass ? theme.grass[0] : 0x3f6e4e) }, uC3: { value: col(theme.grass ? theme.grass[1] : 0x74ae72) } }, engineUniforms(), T.UniformsUtils.clone(T.UniformsLib.fog));
  const mat = new T.ShaderMaterial({ uniforms: u, fog: true, side: T.DoubleSide,
    vertexShader: GLSL.slice(0, GLSL.indexOf('float bayer()')) + `
    uniform sampler2D uMask; uniform vec4 uBox; uniform vec3 uPl; uniform float uW; uniform float uR; uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform sampler2D uShT; uniform vec4 uShB; uniform float uShK;
    attribute vec4 aBl; attribute float aSlot; varying vec3 vCol;
    #include <fog_pars_vertex>
    void main() {
      float W = uW, CELL = ${CELL.toFixed(2)};
      vec2 org = floor(uPl.xz / CELL) - floor(W * 0.5), slot = vec2(mod(aSlot, W), floor(aSlot / W));
      vec2 cell = org + mod(slot - org, W), centre = (cell + 0.5) * CELL;
      vec2 hc = cell + floor(cell / 64.0).yx * vec2(23.0, 37.0);
      float h1 = hsh(hc), h2 = hsh(hc + vec2(13.0, 5.0)), dist = length(centre - uPl.xz);
      vec4 m = texture2D(uMask, (centre - uBox.xy) / uBox.zw);
      float present = step(h1, m.r) * step(smoothstep(uR * 0.62, uR, dist), h2);
      float cy = position.y, side = position.x, hh = aBl.w;
      float height = (0.16 + 0.28 * hh) * mix(0.75, 1.0, m.r) * present;
      vec2 root = centre + aBl.xy;
      float gy = m.g * 4.0;
      vec2 away = root - uPl.xz; float pr = length(away), push = clamp(1.0 - pr / 1.5, 0.0, 1.0); push *= push;
      height *= (1.0 - 0.45 * push) * smoothstep(1.2, 2.4, length(cameraPosition - vec3(root.x, 0.0, root.y)));
      float width = 0.075 * (1.0 + dist * 0.06);
      vec2 sd = vec2(cos(aBl.z), sin(aBl.z));
      float g = gust(centre), bend = cy * cy * ((0.08 + 0.92 * g) * 0.2 + sin(uT * 5.0 + centre.x * 2.1 + centre.y * 1.7 + aBl.x * 6.0) * 0.015 * g);
      vec2 wd = normalize(uWind.xy), lean = wd * bend + normalize(away + 1e-4) * push * 0.4 * cy;
      vec3 wp = vec3(root.x + sd.x * side * width * 0.5 * (1.0 - cy) + lean.x, gy + cy * height, root.y + sd.y * side * width * 0.5 * (1.0 - cy) + lean.y);
      float zone = N(centre * 0.02 + 0.3).a, tone = step(0.32, zone + (hh - 0.5) * 0.35);
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
  const mesh = new T.Mesh(bladeGeometry(W * W), mat); mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.userData.tris = W * W * BLADES; return mesh;
}


