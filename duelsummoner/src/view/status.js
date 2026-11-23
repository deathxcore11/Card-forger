// Status looks on the swarm bodies (spectacle spec 6.6), live for fire and lightning. One extra instance attribute per enemy kind, aFx = (burn 0..1, arc 0 or 1, seed); the body fragment shader reads it:
//   burn: an ember band climbs from the feet to 45% of the body height with a ragged top edge (noise, 8 pictures a second) in the fire ramp (bright at the feet, body above), and sinks as the burn timer runs out;
//   arc:  a crawling blue-white outline (stepped bands moving up the rim) in the lightning ramp for 300 ms on every enemy a chain jump reached.
// No new draw: the status is in the body material. The attribute is uploaded only on frames where some enemy of the kind has a status, plus the one frame that clears it.
import { E } from './engine.js';
import { RAMP } from '../data/fxramp.js';
const T = window.THREE;

export function statusAttr(geo, max) { const a = new T.InstancedBufferAttribute(new Float32Array(max * 3), 3); a.setUsage(T.DynamicDrawUsage); geo.setAttribute('aFx', a); return a; }

export function statusLit(mat, half) {
  const prev = mat.onBeforeCompile, col = h => new T.Color(h);
  mat.onBeforeCompile = sh => {
    if (prev) prev(sh);
    sh.uniforms.uN = E.noise; sh.uniforms.uT = E.T; sh.uniforms.uFireB = { value: col(RAMP.fire[1]) }; sh.uniforms.uFireM = { value: col(RAMP.fire[2]) }; sh.uniforms.uArcB = { value: col(RAMP.lightning[1]) }; sh.uniforms.uArcC = { value: col(RAMP.lightning[0]) };
    sh.vertexShader = 'attribute vec3 aFx; varying vec3 vFx; varying float vYh;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vFx = aFx; vYh = clamp(position.y / ' + (2 * half).toFixed(3) + ' + 0.5, 0.0, 1.0);');
    sh.fragmentShader = 'uniform sampler2D uN; uniform float uT; uniform vec3 uFireB; uniform vec3 uFireM; uniform vec3 uArcB; uniform vec3 uArcC; varying vec3 vFx; varying float vYh;\n' + sh.fragmentShader.replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', `{ float y = vYh;
  if (vFx.x > 0.0) { float nb = texture2D(uN, vec2(fract(vFx.z * 7.0) + y * 0.25, floor(uT * 8.0) / 64.0)).r; if (y < vFx.x * 0.45 + nb * 0.15) outgoingLight = y < 0.1 ? uFireB : uFireM; }
  if (vFx.y > 0.0) { float rim = 1.0 - abs(normalize(vANormal).z); float crawl = step(0.5, fract(y * 5.0 + uT * 5.0 + vFx.z * 9.0)); if (rim > 0.5) outgoingLight = crawl > 0.5 ? uArcC : uArcB; } }
  gl_FragColor = vec4( outgoingLight, diffuseColor.a );`);
  };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : null; mat.customProgramCacheKey = () => (key ? key() : '') + 'status' + half;
  return mat;
}
