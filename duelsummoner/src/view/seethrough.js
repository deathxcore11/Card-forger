// The see-through camera for scenery and props (spectacle spec section 2). View only: nothing here reads or writes sim state.
//  - dsDither: one 4 x 4 Bayer pattern locked to buffer pixels, never animated (written with float maths, so it needs no bit operations and works on WebGL 1 and 2 alike).
//  - the porthole: merged architecture (pylons, walls, pillars, the rim, cliffs) gets a screen-space hole round the duelist, sized to the duelist on screen.
//  - the corridor: instanced scenery (trees, boulders, bushes) is faded whole, per instance, in the vertex shader from uniforms: no per-frame upload.
//  - nearKeep: everything but the ground thins out as it nears the lens.
const T = window.THREE;
import { blocksOn } from './models.js';

export const SEE = {
  cam: { value: new T.Vector3() },            // the UNSHAKEN camera eye
  duelist: { value: new T.Vector3() },        // the smoothed duelist chest
  hole: { value: new T.Vector3() },           // x, y: duelist chest in buffer pixels; z: its view depth in m
  holeR: { value: new T.Vector2(1, 1) },      // 0.9 and 1.3 times the duelist's height on screen, in buffer pixels
  feetY: { value: 0 },
  near: { value: new T.Vector2(0.8, 5.0) },   // scenery is gone under 5 m from the lens (a cactus or post beside the camera never fills a corner)
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
float nearKeep(float viewZ) { return viewZ < uNear.y ? 0.0 : 1.0; }       // a piece right at the lens is simply gone (no grey dither wall across the screen)
`;

// merged map pieces and props: the screen-space porthole plus the near fade
export function seeMap(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = sh => {
    if (prev) prev(sh);
    sh.uniforms.uHole = SEE.hole; sh.uniforms.uHoleR = SEE.holeR; sh.uniforms.uFeetY = SEE.feetY; sh.uniforms.uNear = SEE.near; sh.uniforms.uCam = SEE.cam; sh.uniforms.uDuelist = SEE.duelist;
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying float vViewZ; varying float vWY; varying vec3 vSeeWP;\nvoid main() {')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvViewZ = -mvPosition.z; vSeeWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWY = vSeeWP.y;');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', `varying float vViewZ; varying float vWY; varying vec3 vSeeWP; uniform highp vec3 uCam; uniform highp vec3 uDuelist;
uniform highp vec3 uHole; uniform highp vec2 uHoleR; uniform highp float uFeetY;
${DITHER_GLSL}${NEAR_GLSL}
float holeKeep() {
  highp vec2 q = (gl_FragCoord.xy - uHole.xy) / uHoleR;
  float d = q.x * q.x + (q.y > 0.0 ? q.y * q.y * 0.12 : q.y * q.y);       // the hole reaches up the screen above the duelist (a post or pole standing between camera and rider thins all the way up), not down into the ground
  float front = step(vViewZ, uHole.z - 0.8) * step(uFeetY + 0.4, vWY);
  float k = d < 0.45 ? 0.25 : (d < 0.8 ? 0.5 : 1.0);       // only the part round the duelist thins
  return mix(1.0, k, front);
}
void main() {
  { highp vec3 dd = uDuelist - uCam; float tt = clamp(dot(vSeeWP - uCam, dd) / max(dot(dd, dd), 0.0001), 0.0, 1.0); float gap = length(vSeeWP - (uCam + dd * tt)); float corridor = (tt < 0.9 && gap < 2.2 + (1.0 - tt) * 3.5) ? ${blocksOn ? '0.0' : '0.25'} : 1.0;
    float k = min(min(holeKeep(), nearKeep(vViewZ)), corridor); DS_FADE(k) }`);       // and anything on the line from the camera to the duelist (a kicker, a post) thins along that line
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
  float s = max(length(inst[0].xyz), max(length(inst[1].xyz), length(inst[2].xyz)));       // the largest axis: a squashed or stretched boulder is bounded by its tallest side
  highp vec3 d = uDuelist - uCam;
  highp vec3 c = (modelMatrix * (inst * vec4(uBoundC, 1.0))).xyz;
  float t = clamp(dot(c - uCam, d) / dot(d, d), 0.0, 0.92);
  float gap = length(c - (uCam + d * t)) - uBoundR * s - 0.9;       // the line is the duelist's chest: widen it by half a duelist so the head and feet clear the solid too
  float kCanopy = dsKeep(gap);
  ${tree ? `
  highp vec3 b = (modelMatrix * (inst * vec4(0.0, 0.0, 0.0, 1.0))).xyz;
  float tt = clamp(dot(b.xz - uCam.xz, d.xz) / max(dot(d.xz, d.xz), 0.0001), 0.0, 0.92);
  float gapT = length(b.xz - (uCam.xz + d.xz * tt)) - (0.55 * s + 0.35) - 0.9;
  float lineY = uCam.y + d.y * tt;
  float span = clamp((b.y + uTrunkTop * s - lineY) / 1.5, 0.0, 1.0) * clamp((lineY - (b.y - 0.5)) / 1.5, 0.0, 1.0);       // the span ends in 1.5 m ramps, so a sight line leaving the top of the trunk never pops
  float kTrunk = floor((mix(1.0, 0.5 + 0.5 * clamp(gapT / 3.0, 0.0, 1.0), span)) * 8.0 + 0.5) / 8.0;
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

// big enemies, elites, bosses and the Toll Shades: the same screen-space porthole as the map pieces, but instance aware, with a solid edge. A fragment in front of the duelist (nearer the lens, above the feet) and inside the hole circle
// keeps 3% in the inner circle and 6% in the outer ring (the one Bayer pattern); grazing faces (the silhouette of a faceted body) always stay solid, so the threat still reads. Warnings are a separate layer and are never touched.
export function seeActor(mat) {
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : null;
  mat.onBeforeCompile = sh => {
    if (prev) prev(sh);
    sh.uniforms.uHole = SEE.hole; sh.uniforms.uHoleR = SEE.holeR; sh.uniforms.uFeetY = SEE.feetY;
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec3 vVP; varying float vWY2;\nvoid main() {')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvVP = mvPosition.xyz;\n#ifdef USE_INSTANCING\nvWY2 = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y;\n#else\nvWY2 = (modelMatrix * vec4(transformed, 1.0)).y;\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', `varying vec3 vVP; varying float vWY2;
uniform highp vec3 uHole; uniform highp vec2 uHoleR; uniform highp float uFeetY;
${DITHER_GLSL}
void main() {
  { highp vec2 q = (gl_FragCoord.xy - uHole.xy) / uHoleR; float d = dot(q, q), front = step(-vVP.z, uHole.z - 0.8) * step(uFeetY + 0.3, vWY2);
    vec3 nn = normalize(cross(dFdx(vVP), dFdy(vVP))); float rim = step(0.92, 1.0 - abs(nn.z)); float k = max(mix(1.0, d < 0.55 ? 0.03 : (d < 1.0 ? 0.0625 : 1.0), front), rim); DS_FADE(k) }`);
  };
  mat.customProgramCacheKey = () => (prevKey ? prevKey() : '') + 'seeactor';
  mat.needsUpdate = true;
  return mat;
}
const V = new T.Vector3(), V2 = new T.Vector3();
// once a frame, after the camera has moved and before the shake: the corridor and porthole uniforms, from the unshaken camera and the smoothed duelist
export function updateSee(camera, ip, renderer) {
  SEE.cam.value.copy(camera.position);
  SEE.duelist.value.set(ip.x, ip.y + 1.0, ip.z);
  camera.updateMatrixWorld();
  const size = renderer.internalSize ? V2.copy(renderer.internalSize) : renderer.getDrawingBufferSize(V2.set(0, 0)), bw = size.x, bh = size.y;     // V2 is reused below, so read the numbers first
  V.set(ip.x, ip.y + 1.0, ip.z).project(camera); const cx = (V.x + 1) / 2 * bw, cy = (V.y + 1) / 2 * bh;
  V.set(ip.x, ip.y + 1.9, ip.z).project(camera); const top = (V.y + 1) / 2 * bh;
  V.set(ip.x, ip.y, ip.z).project(camera); const bot = (V.y + 1) / 2 * bh;
  const hpx = Math.max(8, Math.abs(top - bot));
  V.set(ip.x, ip.y + 1.0, ip.z).applyMatrix4(camera.matrixWorldInverse);
  SEE.hole.value.set(SEE.on ? cx : -1e5, cy, -V.z);
  SEE.holeR.value.set(0.9 * hpx, 1.3 * hpx); SEE.feetY.value = ip.y;
}





