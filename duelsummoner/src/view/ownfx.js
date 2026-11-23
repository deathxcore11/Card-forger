// The own-effect material (spectacle spec 2.5 and 6.3, build step 7). One instanced draw for every ground area the player owns (discs, rings, fans) and one for volumes (domes and walls), both with
//   - the INK RULE: an effect paints at most uInk of the screen in fill however big it grows (fill keep = uInk / screen cover, floored at 12.5% and capped by the governor), stippled with the one Bayer function,
//   - a SOLID RIM in the effect's colour with a 1 art pixel ink edge, never dithered (except 50% inside the keyhole),
//   - the KEYHOLE: inside a screen circle round the duelist's chest fills are 0% and rims 50%; plus the stencil test (NOTEQUAL 1) so nothing paints over the duelist's own pixels,
//   - the CAMERA-SIDE CAP (volumes): anything nearer the camera than the duelist, or within 8 m of the camera, is cut above 1.5 m over the feet,
//   - blending OFF, depth test on, depth write off,
//   - the GOVERNOR: two sums worked out on the CPU each frame from the records (the rasterised sum and the kept sum); over its limit uGovernor drops, smoothed over 0.3 s.
// Owner tags (0 player, 1 enemy, 2 world): only owner 0 comes here; enemy and world effects keep their own draws and are never thinned. View only; it reads the sim's effect records and never writes the sim.
import { GLSL } from './engine.js';
const T = window.THREE, STRIDE = 12, MAXA = 96, MAXV = 32;

// settings rows of spec 2.5: ink share, kept-sum limit (screens), rasterised limit (screens)
export const SPELL_FX = { auto: { ink: 0.05, kept: 0.35, raster: 5.0 }, full: { ink: 0.08, kept: 0.5, raster: 5.0 }, soft: { ink: 0.025, kept: 0.2, raster: 5.0 } };

const COMMON = `
uniform float uRimK; uniform float uProjY; uniform float uAspect; uniform float uInk; uniform float uGov; uniform vec4 uHole; uniform float uFeetY;
float coverOf(float rad, float viewZ) { float rN = rad * uProjY / max(viewZ, 0.5); return clamp(3.1416 * rN * rN / (4.0 * uAspect), 0.0, 1.0); }
`;

// A hollow giant (Tier 5) is drawn from the element's own silhouette (no fill, no stipple: trees and creatures behind stay clean; the gaps are see-through). The wall is a ring of columns about 1.8 m wide, warped so the spacing is uneven:
//   fire (and every element not listed): flame tongues in 4 shapes (centred, leaning left, leaning right, twin tip), width and height from the shared noise, a slow lean with the gust, tips that break into floating bands, three hard tone steps
//   ice  (1): faceted shards of mixed size in two layers, two flat facets each (light and body), a pale tip, the ring flaring outward with height
//   dark (7): black void slabs with a thin moon-white edge, wisps in the gaps that run down toward the base, a slight outward flare
// The camera-side arc is cut to 1.5 m; the cut rises smoothly with depth so the side arcs stand at full height. The far ring is lower (55%), so the player is inside it.
const WALL_GLSL = `
  { float H = vB.x, el = vB.y, y = vWP.y - vY0, dd = vViewDist - uHole.w;
    float cutH = 1.5 + 120.0 * smoothstep(-4.0, 0.0, dd);
    if ((vViewDist < 8.0 && vWP.y > uFeetY + 1.5) || vWP.y > uFeetY + cutH) discard;
    float hm = mix(1.0, 0.55, smoothstep(0.0, vRad * 1.6, dd)), y01 = y / H, u = wAng * wCols; u += 0.35 * sin(u * 0.83 + 1.3) + 0.25 * sin(u * 2.1);
    float cell = floor(u), cf = fract(u), h1 = hsh(vec2(cell, 3.0)), h2 = hsh(vec2(cell, 7.0)), h3 = hsh(vec2(cell, 11.0)), eH = fyy / H;
    float low = N(vec2(wAng * 2.0, 0.6)).g, nh = N(vec2(cell * 0.173 + 0.31, floor(uT * 8.0) / 64.0 * 3.0)).r;
    vec3 tone = vCol; bool hit = false;
    if (el > 6.5) {
      float lh = (0.28 + 0.42 * h1) * (0.75 + 0.25 * low) * hm * mix(1.0, 0.4, smoothstep(0.0, vRad * 1.2, dd)), c = 0.35 + 0.3 * h2, hw = 0.13 + 0.09 * h3, top = lh * (1.0 - 0.18 * (cf - c) / hw), ax = abs(cf - c);
      if (ax < hw && y01 < top) { hit = true; tone = vec3(0.05, 0.045, 0.07); if (hw - ax < fu * 1.1 || top - y01 < eH * 1.2) tone = vec3(0.85, 0.89, 0.96); }
      else { float xs = ax - hw; if (xs > 0.0 && abs(xs - 0.05) < fu * 0.9 && y01 < 0.7 * lh && fract(y01 * 7.0 - uT * 0.9 + h3 * 3.0) < 0.3) { hit = true; tone = vec3(0.85, 0.89, 0.96); } }
    } else if (el > 0.5) {
      for (int L = 0; L < 2; L++) {
        float uu = u + (L == 1 ? 0.5 + 0.2 * h3 : 0.0), cl = floor(uu), cx = fract(uu), a1 = hsh(vec2(cl, 3.0 + float(L) * 14.0)), a2 = hsh(vec2(cl, 7.0 + float(L) * 14.0)), a3 = hsh(vec2(cl, 11.0 + float(L) * 14.0));
        float lh = (0.15 + 0.85 * pow(a1, 1.6)) * hm * (L == 1 ? 0.7 : 1.0), c = 0.3 + 0.4 * a2, hw = 0.1 + 0.18 * a3, tt = y01 / max(lh, 0.01), cc = c + 0.18 * tt * (a2 - 0.5), ax = abs(cx - cc), w = hw * (1.0 - tt);
        if (tt < 1.0 && ax < w) { hit = true; vec3 lt = min(vCol * 1.3, vec3(1.0)); tone = cx < cc ? lt : vCol * 0.8; if (tt > 0.86) tone = vec3(0.94, 0.98, 1.0); if (L == 1) tone *= 0.82; if (w - ax < fu * 1.1) tone = vec3(0.118, 0.118, 0.165); break; }
      }
    } else {
      // fire: each tongue is a curved flame: an S-curve spine that sways, a body tongue in the element colour, a narrower hot tongue nested inside it (bright, with a pale core at the root), and a small tip that breaks off above it.
      // Three stepped poses a second apart, out of phase per tongue, move the edge and the sway. The dark ink edge runs on the outer silhouette only.
      for (int L = 0; L < 2; L++) {
        float uu = u + (L == 1 ? 0.5 + 0.2 * h3 : 0.0), cl = floor(uu), cx = fract(uu), g1 = hsh(vec2(cl, 3.0 + float(L) * 14.0)), g2 = hsh(vec2(cl, 7.0 + float(L) * 14.0)), g3 = hsh(vec2(cl, 11.0 + float(L) * 14.0)), nz = N(vec2(cl * 0.173 + 0.31 + float(L) * 0.4, floor(uT * 8.0) / 64.0 * 3.0)).r;
        float lh = (0.25 + 0.75 * nz) * (0.7 + 0.3 * low) * hm * (L == 1 ? 0.65 : 1.0), tt = y01 / max(lh, 0.01);
        if (tt > 1.1) continue;
        float pose = mod(floor(uT + g3 * 3.0), 3.0), ph = g1 * 6.2832, lean = (sin(uT * 0.9 + wAng * 18.0) * 0.5 + 0.35) * 0.35 + (g2 - 0.5) * 0.3;
        float spine = 0.3 + 0.4 * g2 + lean * tt + 0.13 * sin(tt * 5.0 + ph + pose * 2.1) * tt, wb = (0.16 + 0.3 * g2) * (1.0 + (pose - 1.0) * 0.18), s = tt / 0.84;
        float w = s < 1.0 ? pow(1.0 - s, 1.2) * wb : -1.0, ax = abs(cx - spine);
        float tw = (tt > 0.9 && g3 > 0.35 && pose != 1.0) ? 0.055 * (1.1 - tt) / 0.2 - abs(cx - (spine + 0.04 * (pose - 1.0))) : -1.0;       // the detached tip
        float e = max(w - ax, tw);
        if (e > 0.0) {
          hit = true; tone = vCol;
          float si = tt / 0.55, wi = si < 1.0 ? pow(1.0 - si, 1.2) * wb * 0.5 : -1.0;
          if (wi - ax > 0.0) { tone = min(vCol * 1.3, vec3(1.0)); if (tt < 0.12) tone = vec3(1.0, 0.96, 0.78); }
          if (L == 1) tone *= 0.85;
          if (e < fu * 1.1) tone = vec3(0.118, 0.118, 0.165);
          break;
        }
      }
    }
    if (!hit) discard;
    oc = vec4(tone, 1.0); return; }`;
function material(kind) {
  const area = kind === 'area', wall = kind === 'wall';
  return new T.ShaderMaterial({ glslVersion: T.GLSL3, side: T.DoubleSide, depthTest: true, depthWrite: false, transparent: true, fog: false, blending: T.NoBlending,
    stencilWrite: true, stencilRef: 0, stencilFunc: T.EqualStencilFunc, stencilFuncMask: 0x05, stencilWriteMask: 0x00, stencilFail: T.KeepStencilOp, stencilZFail: T.KeepStencilOp, stencilZPass: T.KeepStencilOp,
    uniforms: OWN.uni,
    vertexShader: `precision highp float; precision highp int; ${COMMON}
in vec4 iA; in vec4 iB; in vec4 iC;
out vec2 vLocal; out vec3 vWP; out vec3 vN; out vec3 vV; out float vViewDist; flat out float vKeep; flat out vec3 vCol; flat out vec4 vB; flat out float vFade; flat out float vY0; flat out float vRad;
void main() {
  vec3 c0 = iA.xyz; float rad = iA.w;
  vec4 vc = viewMatrix * vec4(c0, 1.0); float vz = -vc.z;
  float frac = ${area ? '(iB.z > -0.99 ? acos(clamp(iB.z, -1.0, 1.0)) / 3.1416 : 1.0)' : '1.0'};
  float cover = coverOf(rad, vz) * frac;
  vKeep = min(clamp(uInk / max(cover, 0.001), 0.125, 1.0), uGov);
  vCol = iC.rgb; vB = iB; vFade = iC.a; vY0 = c0.y; vRad = rad;
  ${area ? `vec3 w = vec3(c0.x + position.x * rad, c0.y + 0.12, c0.z + position.z * rad); vLocal = position.xz; vN = vec3(0.0, 1.0, 0.0);`
         : wall ? `float fl = iB.y > 6.5 ? 0.12 : (iB.y > 0.5 ? 0.35 : 0.0); vec3 w = vec3(c0.x + position.x * rad * (1.0 + fl * position.y), c0.y + position.y * iB.x, c0.z + position.z * rad * (1.0 + fl * position.y)); vLocal = position.xz; vN = normalize(vec3(position.x, 0.0, position.z));`
         : `vec3 w = c0 + position * rad; vLocal = position.xz; vN = normalize(position);`}
  vWP = w; vec4 vp = viewMatrix * vec4(w, 1.0); vViewDist = -vp.z; vV = normalize(-vp.xyz); vN = normalize(mat3(viewMatrix) * vN);
  gl_Position = projectionMatrix * vp;
}`,
    fragmentShader: GLSL + COMMON + `
in vec2 vLocal; in vec3 vWP; in vec3 vN; in vec3 vV; in float vViewDist; flat in float vKeep; flat in vec3 vCol; flat in vec4 vB; flat in float vFade; flat in float vY0; flat in float vRad; out vec4 oc;
void main() {
  float vr = length(vLocal); float fw = fwidth(vr) * 2.0, fa = fwidth(vWP.x + vWP.z);       // derivatives first, before any branch or discard
  
  ${wall ? 'float wAng = atan(vLocal.y, vLocal.x) / 6.2832 + 0.5, wCols = max(10.0, floor(vRad * 6.2832 / (1.8 + 0.07 * vB.x))), fu = min(fwidth(wAng * wCols), 0.5), fyy = fwidth(vWP.y);' : ''}
  float dpx = distance(gl_FragCoord.xy, uHole.xy); bool hole = dpx < uHole.z; float bay = bayer();
  ${area ? `
  if (vr > 1.0) discard;
  float edge = 1.0 - vr; float rimW = max(fw, 0.004) * uRimK;
  if (vB.z > -0.99) { vec2 dn = normalize(vLocal + 1e-5); float ca = dot(dn, vB.xy); if (ca < vB.z) discard; float ang = acos(clamp(ca, -1.0, 1.0)), half_ = acos(clamp(vB.z, -1.0, 1.0)); edge = min(edge, (half_ - ang) * vr); }
  bool rim = edge < rimW, ink = edge < rimW * 0.5;
  bool ringOnly = vB.w < 0.5; float band = max(fw * 3.0, min(0.06, fw * 6.0)); if (ringOnly && edge > band) discard;       // a plain ring is a thin solid band, never a fill` : `
  float fr = 1.0 - abs(dot(normalize(vN), normalize(vV))); bool rim = fr > 0.6, ink = fr > 0.8; bool ringOnly = false;
  ${wall ? WALL_GLSL : ''}`}
  vec3 col = vCol;
  if (ringOnly && !rim) { if (hole && bay > 0.5) discard; oc = vec4(col * (0.6 + 0.4 * vFade), 1.0); return; }
  if (rim) { if (hole && bay > 0.5) discard; oc = vec4(ink ? vec3(0.118, 0.118, 0.165) : col, 1.0); return; }
  if (hole) discard;
  if (bay >= vKeep * vFade) discard;
  oc = vec4(col * 0.8, 1.0);
}` });
}

export const OWN = { uni: { uRimK: { value: 1 }, uProjY: { value: 1.7 }, uAspect: { value: 1.78 }, uInk: { value: 0.05 }, uGov: { value: 1 }, uHole: { value: new T.Vector4(0, 0, 0, 12) }, uFeetY: { value: 0 } } };

export class OwnEffects {
  constructor(scene) {
    this.setting = 'auto'; this.rasterSum = 0; this.keptSum = 0; this.gov = 1; this.nArea = 0; this.nVol = 0; this.dropped = 0;
    const mk = (kind, geo, max) => {
      const buf = new T.InstancedInterleavedBuffer(new Float32Array(max * STRIDE), STRIDE, 1); buf.setUsage(T.DynamicDrawUsage);
      const g = new T.InstancedBufferGeometry(); g.index = geo.index; g.setAttribute('position', geo.attributes.position);
      g.setAttribute('iA', new T.InterleavedBufferAttribute(buf, 4, 0)); g.setAttribute('iB', new T.InterleavedBufferAttribute(buf, 4, 4)); g.setAttribute('iC', new T.InterleavedBufferAttribute(buf, 4, 8)); g.instanceCount = 0;
      const m = new T.Mesh(g, material(kind)); m.frustumCulled = false; m.renderOrder = 5; m.visible = false; scene.add(m); return { buf, g, m, max, n: 0, arr: buf.array };
    };
    const quad = new T.PlaneGeometry(2, 2); quad.rotateX(-Math.PI / 2);
    const dome = new T.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);       // a dome: the upper half of a sphere
    const cyl = new T.CylinderGeometry(1, 1, 1, 56, 1, true); cyl.translate(0, 0.5, 0);
    this.A = mk('area', quad, MAXA); this.V = mk('vol', dome, MAXV); this.W = mk('wall', cyl, 16); this.recs = [];
  }
  setSpellEffects(name) { this.setting = SPELL_FX[name] ? name : 'auto'; }
  begin() { this.A.n = 0; this.V.n = 0; this.W.n = 0; this.recs.length = 0; this.dropped = 0; }
  // a ground area: disc, ring or fan. dx,dz the fan direction (unit), halfArcDeg 0 for a full circle, filled false for a plain ring. colour as 0xRRGGBB, fade 0..1
  area(x, y, z, r, hex, filled, dx, dz, halfArcDeg, fade) {
    const s = this.A; if (s.n >= s.max) { this.dropped++; return; } const a = s.arr, o = s.n++ * STRIDE;
    a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = r; a[o + 4] = dx || 0; a[o + 5] = dz || 1; a[o + 6] = halfArcDeg > 0 && halfArcDeg < 179 ? Math.cos(halfArcDeg * Math.PI / 180) : -1; a[o + 7] = filled ? 1 : 0;
    a[o + 8] = ((hex >> 16) & 255) / 255; a[o + 9] = ((hex >> 8) & 255) / 255; a[o + 10] = (hex & 255) / 255; a[o + 11] = fade === undefined ? 1 : fade;
    this.recs.push(x, y, z, r, a[o + 6] > -0.99 ? Math.acos(a[o + 6]) / Math.PI : 1, filled ? 1 : 0, 0);
  }
  volume(x, y, z, r, hex, fade) {
    const s = this.V; if (s.n >= s.max) { this.dropped++; return; } const a = s.arr, o = s.n++ * STRIDE;
    a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = r; a[o + 4] = 0; a[o + 5] = 0; a[o + 6] = -1; a[o + 7] = 1; a[o + 8] = ((hex >> 16) & 255) / 255; a[o + 9] = ((hex >> 8) & 255) / 255; a[o + 10] = (hex & 255) / 255; a[o + 11] = fade === undefined ? 1 : fade;
    this.recs.push(x, y, z, r, 1, 1, 1);
  }
  // a hollow giant (Tier 5): a wall of height h at the true rule radius r, a solid top and base line and a sparse fill; the camera-side part is cut to 1.5 m by the shader
  wall(x, y, z, r, h, hex, fade, el) {
    const s = this.W; if (s.n >= s.max) { this.dropped++; return; } const a = s.arr, o = s.n++ * STRIDE;
    a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = r; a[o + 4] = h; a[o + 5] = el || 0; a[o + 6] = -1; a[o + 7] = 1; a[o + 8] = ((hex >> 16) & 255) / 255; a[o + 9] = ((hex >> 8) & 255) / 255; a[o + 10] = (hex & 255) / 255; a[o + 11] = fade === undefined ? 1 : fade;
    this.recs.push(x, y, z, r, 0.4, 1, 1);
  }
  // per frame, after begin() and the area() / volume() calls: the camera values, the keyhole, the two sums and the governor, then the uploads
  end(camera, duelist, size, dt) {
    const u = OWN.uni, set = SPELL_FX[this.setting], cm = camera.matrixWorldInverse, e = cm.elements, H = size.h, W = size.w;
    u.uRimK.value = 1 + 0.8 * (this.tier || 0); u.uProjY.value = 1 / Math.tan(camera.fov * Math.PI / 360); u.uAspect.value = W / H; u.uInk.value = set.ink;
    // the duelist's chest on screen: keyhole radius = max(12% of H, 0.9 x the duelist's on-screen height)
    const cx = duelist.x, cy = duelist.y + 0.9, cz = duelist.z, vx = e[0] * cx + e[4] * cy + e[8] * cz + e[12], vy = e[1] * cx + e[5] * cy + e[9] * cz + e[13], vz = -(e[2] * cx + e[6] * cy + e[10] * cz + e[14]);
    const f = u.uProjY.value, sx = (vx * f / u.uAspect.value / Math.max(vz, 0.5) * 0.5 + 0.5) * W, sy = (vy * f / Math.max(vz, 0.5) * 0.5 + 0.5) * H, hPx = 1.8 * f / Math.max(vz, 0.5) * 0.5 * H;
    u.uHole.value.set(sx, sy, this.noHole ? 0 : Math.max(0.12 * H, 0.9 * hPx), vz); u.uFeetY.value = duelist.y;
    // the sums: rasterised = every fill and volume's screen cover, kept = cover x keep. A discarded pixel is still rasterised, so this is the true fill cost.
    const r = this.recs, cov = [], inkk = []; let ras = 0;
    for (let i = 0; i < r.length; i += 7) { const dx = r[i] - camera.position.x, dy = r[i + 1] - camera.position.y, dz = r[i + 2] - camera.position.z, vzz = Math.max(Math.abs(dx * e[2] + dy * e[6] + dz * e[10]), 0.5), rN = r[i + 3] * f / vzz, cover = Math.min(1, 3.1416 * rN * rN / ((4 * u.uAspect.value) || 1)) * r[i + 4]; if (!r[i + 5]) continue; ras += cover; cov.push(cover); inkk.push(Math.min(Math.max(set.ink / Math.max(cover, 0.001), 0.125), 1)); }
    const keptAt = gv => { let k = 0; for (let j = 0; j < cov.length; j++) k += cov[j] * Math.min(inkk[j], gv); return k; };
    // the governor: the largest cap on every fill keep that brings the kept sum to its limit (bisection; it may go below the 12.5% floor), then smoothed over 0.3 s
    let target = 1; if (keptAt(1) > set.kept) { let lo = 0.0, hi = 1.0; for (let it = 0; it < 14; it++) { const mid = (lo + hi) / 2; if (keptAt(mid) > set.kept) hi = mid; else lo = mid; } target = Math.max(0.005, lo); }
    const kk = 1 - Math.exp(-(dt || 0.016) / 0.3); this.gov += (target - this.gov) * kk; u.uGov.value = Math.max(0.005, Math.min(1, this.gov));
    this.rasterSum = ras; this.keptSum = keptAt(this.gov); this.keptRaw = keptAt(1);    for (const s of [this.A, this.V, this.W]) { s.g.instanceCount = s.n; s.m.visible = s.n > 0 && !(s === this.W && this.hideWalls); if (s.n > 0) { s.buf.updateRange.offset = 0; s.buf.updateRange.count = s.n * STRIDE; s.buf.needsUpdate = true; } }
    this.nArea = this.A.n; this.nVol = this.V.n + this.W.n;
  }
  get readout() { return { areas: this.nArea, volumes: this.nVol, rasterSum: +this.rasterSum.toFixed(2), keptSum: +this.keptSum.toFixed(3), keptRaw: +(this.keptRaw || 0).toFixed(2), governor: +this.gov.toFixed(2), dropped: this.dropped }; }
}








