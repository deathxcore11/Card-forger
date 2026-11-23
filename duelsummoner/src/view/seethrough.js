// The see-through camera for scenery and props (spectacle spec section 2). View only: nothing here reads or writes sim state.
//  - dsDither: one 4 x 4 Bayer pattern locked to buffer pixels, never animated (written with float maths, so it needs no bit operations and works on WebGL 1 and 2 alike).
//  - the porthole: merged architecture (pylons, walls, pillars, the rim, cliffs) gets a screen-space hole round the duelist, sized to the duelist on screen.
//  - the corridor: instanced scenery (trees, boulders, bushes) is faded whole, per instance, in the vertex shader from uniforms: no per-frame upload.
//  - nearKeep: everything but the ground thins out as it nears the lens.
const T = window.THREE;

export const SEE = {
  cam: { value: new T.Vector3() },            // the UNSHAKEN camera eye
  duelist: { value: new T.Vector3() },        // the smoothed duelist chest
  hole: { value: new T.Vector3() },           // x, y: duelist chest in buffer pixels; z: its view depth in m
  holeR: { value: new T.Vector2(1, 1) },      // 0.9 and 1.3 times the duelist's height on screen, in buffer pixels
  feetY: { value: 0 },
  near: { value: new T.Vector2(0.8, 2.4) },   // scenery is gone under x metres from the lens and solid from y
  on: true                                    // a debug switch (the porthole off, for the silhouette test)
};

export const DITHER_GLSL = `
float bayer4(highp vec2 fc, vec2 off) {
  highp vec2 p = mod(floor(fc) + off, 4.0);
  float x0 = mod(p.x, 2.0), x1 = floor(p.x * 0.5), y0 = mod(p.y, 2.0), y1 = floor(p.y * 0.5);
  float v = 8.0 * abs(y0 - x0) + 4.0 * y0 + 2.0 * abs(y1 - x1) + y1;
  return (v + 0.5) / 16.0;
}
#define DS_FADE(keep) if ((keep) < 0.999 && bayer4(gl_FragCoord.xy, vec2(0.0)) >= (keep)) discard;
`;

const NEAR_GLSL = `
uniform vec2 uNear;
float nearKeep(float viewZ) { return floor(clamp((viewZ - uNear.x) / (uNear.y - uNear.x), 0.0, 1.0) * 4.0 + 0.5) / 4.0; }
`;

// merged map pieces and props: the screen-space porthole plus the near fade
export function seeMap(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = sh => {
    if (prev) prev(sh);
    sh.uniforms.uHole = SEE.hole; sh.uniforms.uHoleR = SEE.holeR; sh.uniforms.uFeetY = SEE.feetY; sh.uniforms.uNear = SEE.near;
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying float vViewZ; varying float vWY;\nvoid main() {')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvViewZ = -mvPosition.z; vWY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', `varying float vViewZ; varying float vWY;
uniform highp vec3 uHole; uniform highp vec2 uHoleR; uniform highp float uFeetY;
${DITHER_GLSL}${NEAR_GLSL}
float holeKeep() {
  highp vec2 q = (gl_FragCoord.xy - uHole.xy) / uHoleR;
  float d = dot(q, q);
  float front = step(vViewZ, uHole.z - 0.8) * step(uFeetY + 0.4, vWY);
  float k = d < 0.55 ? 0.25 : (d < 1.0 ? 0.5 : 1.0);
  return mix(1.0, k, front);
}
void main() {
  { float k = min(holeKeep(), nearKeep(vViewZ)); DS_FADE(k) }`);
  };
  mat.needsUpdate = true;
  return mat;
}

// instanced scenery: whole-instance fade in the vertex shader. bound: { c: [x, y, z] model-space centre, r: radius, keep0 }. tree: { c2, r2, top } adds the canopy sphere and an XZ trunk test chosen by aPart.
export function seeInstanced(mat, bound, tree) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = sh => {
    if (prev) prev(sh);
    sh.uniforms.uCam = SEE.cam; sh.uniforms.uDuelist = SEE.duelist; sh.uniforms.uNear = SEE.near;
    sh.uniforms.uBoundC = { value: new T.Vector3(...bound.c) }; sh.uniforms.uBoundR = { value: bound.r }; sh.uniforms.uKeep0 = { value: bound.keep0 === undefined ? 0.25 : bound.keep0 };
    if (tree) { sh.uniforms.uTrunkTop = { value: tree.top }; }
    sh.vertexShader = sh.vertexShader.replace('void main() {', `uniform highp vec3 uCam; uniform highp vec3 uDuelist; uniform vec3 uBoundC; uniform float uBoundR; uniform float uKeep0;
${tree ? 'uniform float uTrunkTop; attribute float aPart;' : ''}
varying float vKeep; varying float vViewZ;
float dsKeep(float gap) { return floor((uKeep0 + (1.0 - uKeep0) * clamp(gap / 3.0, 0.0, 1.0)) * 8.0 + 0.5) / 8.0; }
void main() {`).replace('#include <begin_vertex>', `#include <begin_vertex>
{
#ifdef USE_INSTANCING
  mat4 inst = instanceMatrix;
#else
  mat4 inst = mat4(1.0);
#endif
  float s = length(inst[0].xyz);
  highp vec3 d = uDuelist - uCam;
  highp vec3 c = (modelMatrix * (inst * vec4(uBoundC, 1.0))).xyz;
  float t = clamp(dot(c - uCam, d) / dot(d, d), 0.0, 0.92);
  float gap = length(c - (uCam + d * t)) - uBoundR * s;
  float kCanopy = dsKeep(gap);
  ${tree ? `
  highp vec3 b = (modelMatrix * (inst * vec4(0.0, 0.0, 0.0, 1.0))).xyz;
  float tt = clamp(dot(b.xz - uCam.xz, d.xz) / max(dot(d.xz, d.xz), 0.0001), 0.0, 0.92);
  float gapT = length(b.xz - (uCam.xz + d.xz * tt)) - (0.55 * s + 0.35);
  float lineY = uCam.y + d.y * tt;
  bool inSpan = lineY > b.y - 0.5 && lineY < b.y + uTrunkTop * s;
  float kTrunk = inSpan ? floor((0.5 + 0.5 * clamp(gapT / 3.0, 0.0, 1.0)) * 8.0 + 0.5) / 8.0 : 1.0;
  vKeep = aPart > 0.5 ? kCanopy : kTrunk;` : 'vKeep = kCanopy;'}
}`).replace('#include <project_vertex>', '#include <project_vertex>\nvViewZ = -mvPosition.z;');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', `varying float vKeep; varying float vViewZ;
${DITHER_GLSL}${NEAR_GLSL}
void main() {
  { float k = min(vKeep, nearKeep(vViewZ)); DS_FADE(k) }`);
  };
  mat.needsUpdate = true;
  return mat;
}

const V = new T.Vector3(), V2 = new T.Vector3();
// once a frame, after the camera has moved and before the shake: the corridor and porthole uniforms, from the unshaken camera and the smoothed duelist
export function updateSee(camera, ip, renderer) {
  SEE.cam.value.copy(camera.position);
  SEE.duelist.value.set(ip.x, ip.y + 1.0, ip.z);
  camera.updateMatrixWorld();
  const size = renderer.getDrawingBufferSize(V2.set(0, 0)), bw = size.x, bh = size.y;     // V2 is reused below, so read the numbers first
  V.set(ip.x, ip.y + 1.0, ip.z).project(camera); const cx = (V.x + 1) / 2 * bw, cy = (V.y + 1) / 2 * bh;
  V.set(ip.x, ip.y + 1.9, ip.z).project(camera); const top = (V.y + 1) / 2 * bh;
  V.set(ip.x, ip.y, ip.z).project(camera); const bot = (V.y + 1) / 2 * bh;
  const hpx = Math.max(8, Math.abs(top - bot));
  V.set(ip.x, ip.y + 1.0, ip.z).applyMatrix4(camera.matrixWorldInverse);
  SEE.hole.value.set(SEE.on ? cx : -1e5, cy, -V.z);
  SEE.holeR.value.set(0.9 * hpx, 1.3 * hpx); SEE.feetY.value = ip.y;
}
