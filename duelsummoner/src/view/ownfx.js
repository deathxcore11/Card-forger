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

function material(kind) {
  const area = kind === 'area';
  return new T.ShaderMaterial({ glslVersion: T.GLSL3, side: T.DoubleSide, depthTest: true, depthWrite: false, transparent: true, fog: false, blending: T.NoBlending,
    stencilWrite: true, stencilRef: 0, stencilFunc: T.EqualStencilFunc, stencilFuncMask: 0x05, stencilWriteMask: 0x00, stencilFail: T.KeepStencilOp, stencilZFail: T.KeepStencilOp, stencilZPass: T.KeepStencilOp,
    uniforms: OWN.uni,
    vertexShader: `precision highp float; precision highp int; ${COMMON}
in vec4 iA; in vec4 iB; in vec4 iC;
out vec2 vLocal; out vec3 vWP; out vec3 vN; out vec3 vV; out float vViewDist; flat out float vKeep; flat out vec3 vCol; flat out vec4 vB; flat out float vFade;
void main() {
  vec3 c0 = iA.xyz; float rad = iA.w;
  vec4 vc = viewMatrix * vec4(c0, 1.0); float vz = -vc.z;
  float frac = ${area ? '(iB.z > -0.99 ? acos(clamp(iB.z, -1.0, 1.0)) / 3.1416 : 1.0)' : '1.0'};
  float cover = coverOf(rad, vz) * frac;
  vKeep = min(clamp(uInk / max(cover, 0.001), 0.125, 1.0), uGov);
  vCol = iC.rgb; vB = iB; vFade = iC.a;
  ${area ? `vec3 w = vec3(c0.x + position.x * rad, c0.y + 0.12, c0.z + position.z * rad); vLocal = position.xz; vN = vec3(0.0, 1.0, 0.0);`
         : `vec3 w = c0 + position * rad; vLocal = position.xz; vN = normalize(position);`}
  vWP = w; vec4 vp = viewMatrix * vec4(w, 1.0); vViewDist = -vp.z; vV = normalize(-vp.xyz); vN = normalize(mat3(viewMatrix) * vN);
  gl_Position = projectionMatrix * vp;
}`,
    fragmentShader: GLSL + COMMON + `
in vec2 vLocal; in vec3 vWP; in vec3 vN; in vec3 vV; in float vViewDist; flat in float vKeep; flat in vec3 vCol; flat in vec4 vB; flat in float vFade; out vec4 oc;
void main() {
  float vr = length(vLocal); float fw = fwidth(vr) * 2.0, fa = fwidth(vWP.x + vWP.z);       // derivatives first, before any branch or discard
  float dpx = distance(gl_FragCoord.xy, uHole.xy); bool hole = dpx < uHole.z; float bay = bayer();
  ${area ? `
  if (vr > 1.0) discard;
  float edge = 1.0 - vr; float rimW = max(fw, 0.004) * uRimK;
  if (vB.z > -0.99) { vec2 dn = normalize(vLocal + 1e-5); float ca = dot(dn, vB.xy); if (ca < vB.z) discard; float ang = acos(clamp(ca, -1.0, 1.0)), half_ = acos(clamp(vB.z, -1.0, 1.0)); edge = min(edge, (half_ - ang) * vr); }
  bool rim = edge < rimW, ink = edge < rimW * 0.5;
  bool ringOnly = vB.w < 0.5; float band = max(fw * 3.0, min(0.06, fw * 6.0)); if (ringOnly && edge > band) discard;       // a plain ring is a thin solid band, never a fill` : `
  float fr = 1.0 - abs(dot(normalize(vN), normalize(vV))); bool rim = fr > 0.6, ink = fr > 0.8; bool ringOnly = false;
  if ((vViewDist < uHole.w || vViewDist < 8.0) && vWP.y > uFeetY + 1.5) discard;       // the camera-side cap: the tall wall is a far-side thing`}
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
    this.A = mk('area', quad, MAXA); this.V = mk('vol', dome, MAXV); this.recs = [];
  }
  setSpellEffects(name) { this.setting = SPELL_FX[name] ? name : 'auto'; }
  begin() { this.A.n = 0; this.V.n = 0; this.recs.length = 0; this.dropped = 0; }
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
  // per frame, after begin() and the area() / volume() calls: the camera values, the keyhole, the two sums and the governor, then the uploads
  end(camera, duelist, size, dt) {
    const u = OWN.uni, set = SPELL_FX[this.setting], cm = camera.matrixWorldInverse, e = cm.elements, H = size.h, W = size.w;
    u.uRimK.value = 1 + 0.8 * (this.tier || 0); u.uProjY.value = 1 / Math.tan(camera.fov * Math.PI / 360); u.uAspect.value = W / H; u.uInk.value = set.ink;
    // the duelist's chest on screen: keyhole radius = max(12% of H, 0.9 x the duelist's on-screen height)
    const cx = duelist.x, cy = duelist.y + 0.9, cz = duelist.z, vx = e[0] * cx + e[4] * cy + e[8] * cz + e[12], vy = e[1] * cx + e[5] * cy + e[9] * cz + e[13], vz = -(e[2] * cx + e[6] * cy + e[10] * cz + e[14]);
    const f = u.uProjY.value, sx = (vx * f / u.uAspect / Math.max(vz, 0.5) * 0.5 + 0.5) * W, sy = (vy * f / Math.max(vz, 0.5) * 0.5 + 0.5) * H, hPx = 1.8 * f / Math.max(vz, 0.5) * 0.5 * H;
    u.uHole.value.set(sx, sy, Math.max(0.12 * H, 0.9 * hPx), vz); u.uFeetY.value = duelist.y;
    // the sums: rasterised = every fill and volume's screen cover, kept = cover x keep. A discarded pixel is still rasterised, so this is the true fill cost.
    const r = this.recs, cov = [], inkk = []; let ras = 0;
    for (let i = 0; i < r.length; i += 7) { const dx = r[i] - camera.position.x, dy = r[i + 1] - camera.position.y, dz = r[i + 2] - camera.position.z, vzz = Math.max(Math.abs(dx * e[2] + dy * e[6] + dz * e[10]), 0.5), rN = r[i + 3] * f / vzz, cover = Math.min(1, 3.1416 * rN * rN / ((4 * u.uAspect.value) || 1)) * r[i + 4]; if (!r[i + 5]) continue; ras += cover; cov.push(cover); inkk.push(Math.min(Math.max(set.ink / Math.max(cover, 0.001), 0.125), 1)); }
    const keptAt = gv => { let k = 0; for (let j = 0; j < cov.length; j++) k += cov[j] * Math.min(inkk[j], gv); return k; };
    // the governor: the largest cap on every fill keep that brings the kept sum to its limit (bisection; it may go below the 12.5% floor), then smoothed over 0.3 s
    let target = 1; if (keptAt(1) > set.kept) { let lo = 0.0, hi = 1.0; for (let it = 0; it < 14; it++) { const mid = (lo + hi) / 2; if (keptAt(mid) > set.kept) hi = mid; else lo = mid; } target = Math.max(0.005, lo); }
    const kk = 1 - Math.exp(-(dt || 0.016) / 0.3); this.gov += (target - this.gov) * kk; u.uGov.value = Math.max(0.005, Math.min(1, this.gov));
    this.rasterSum = ras; this.keptSum = keptAt(this.gov); this.keptRaw = keptAt(1);    for (const s of [this.A, this.V]) { s.g.instanceCount = s.n; s.m.visible = s.n > 0; if (s.n > 0) { s.buf.updateRange.offset = 0; s.buf.updateRange.count = s.n * STRIDE; s.buf.needsUpdate = true; } }
    this.nArea = this.A.n; this.nVol = this.V.n;
  }
  get readout() { return { areas: this.nArea, volumes: this.nVol, rasterSum: +this.rasterSum.toFixed(2), keptSum: +this.keptSum.toFixed(3), keptRaw: +(this.keptRaw || 0).toFixed(2), governor: +this.gov.toFixed(2), dropped: this.dropped }; }
}
