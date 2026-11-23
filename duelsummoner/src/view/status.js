// Status looks on the swarm bodies (spectacle spec 6.6), live for fire and lightning. One extra instance attribute per enemy kind, aFx = (burn 0..1, arc 0 or 1, seed); the body fragment shader reads it:
//   burn: an ember band climbs from the feet to 45% of the body height with a ragged top edge (noise, 8 pictures a second) in the fire ramp (bright at the feet, body above), and sinks as the burn timer runs out;
//   arc:  a crawling blue-white outline (stepped bands moving up the rim) in the lightning ramp for 300 ms on every enemy a chain jump reached.
// No new draw: the status is in the body material. The attribute is uploaded only on frames where some enemy of the kind has a status, plus the one frame that clears it.
import { E } from './engine.js';
import { RAMP } from '../data/fxramp.js';
const T = window.THREE;

export function statusAttr(geo, max) { const a = new T.InstancedBufferAttribute(new Float32Array(max * 4), 4); a.setUsage(T.DynamicDrawUsage); geo.setAttribute('aFx', a); return a; }

export function statusLit(mat, ymin, ymax) {
  const prev = mat.onBeforeCompile, col = h => new T.Color(h);
  mat.onBeforeCompile = sh => {
    if (prev) prev(sh);
    sh.uniforms.uN = E.noise; sh.uniforms.uT = E.T; sh.uniforms.uFireB = { value: col(RAMP.fire[1]) }; sh.uniforms.uFireM = { value: col(RAMP.fire[2]) }; sh.uniforms.uFireS = { value: col(RAMP.fire[3]) }; sh.uniforms.uEl = { value: ['ice', 'poison', 'wind', 'earth', 'light', 'dark'].flatMap(n => [col(RAMP[n][1]), col(RAMP[n][2]), col(RAMP[n][0]), col(RAMP[n][3])]) }; sh.uniforms.uArcB = { value: col(RAMP.lightning[1]) }; sh.uniforms.uArcC = { value: col(RAMP.lightning[0]) };
    sh.vertexShader = 'attribute vec4 aFx; varying vec4 vFx; varying float vYh;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vFx = aFx; vYh = clamp((position.y - ' + ymin.toFixed(3) + ') / ' + (ymax - ymin).toFixed(3) + ', 0.0, 1.0);');
    sh.fragmentShader = 'uniform sampler2D uN; uniform float uT; uniform vec3 uFireB; uniform vec3 uFireM; uniform vec3 uFireS; uniform vec3 uArcB; uniform vec3 uArcC; uniform vec3 uEl[24]; varying vec4 vFx; varying float vYh;\n' + sh.fragmentShader.replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', `{ float y = vYh;
  if (vFx.x > 0.0 && vFx.w < 6.5) { float nb = texture2D(uN, vec2(fract(vFx.z * 7.0) + y * 0.25, floor(uT * 8.0) / 64.0)).r; float top = vFx.x * 0.45 + nb * 0.15; if (y < top) outgoingLight = y < 0.04 ? uFireB : (y > top - 0.07 ? uFireS : uFireM); }
  if (vFx.y > 0.0) { float rim = 1.0 - abs(normalize(vANormal).z); float crawl = step(0.5, fract(y * 5.0 + uT * 5.0 + vFx.z * 9.0)); if (rim > 0.5) outgoingLight = crawl > 0.5 ? uArcC : uArcB; }
  if (vFx.w > 0.5) { int code = int(vFx.w + 0.5); float rimE = 1.0 - abs(normalize(vANormal).z), sx = vFx.z;
    if (code == 1) { int b = rimE > 0.66 ? 2 : rimE > 0.33 ? 1 : 0; outgoingLight = mix(outgoingLight * 0.55, uEl[b == 0 ? 2 : b == 1 ? 0 : 1], 0.8); float cell = fract(sin(dot(floor(vec2(y * 18.0, rimE * 9.0)) + floor(uT * 6.0) + sx * 17.0, vec2(12.9898, 78.233))) * 43758.5); if (cell > 0.96) outgoingLight = uEl[2]; }
    else if (code == 2) { if (fract(y * 3.0 + uT * 0.8 + sx) < 0.3) outgoingLight = uEl[4]; }
    else if (code == 3) { if (rimE > 0.7) outgoingLight = uEl[8]; if (fract(y * 6.0 - uT * 4.0 + sx * 9.0) < 0.12) outgoingLight = mix(outgoingLight, uEl[10], 0.7); }
    else if (code == 4) { if (y < 0.4 + 0.1 * fract(sx * 5.0)) outgoingLight = mix(outgoingLight * 0.6, uEl[13], 0.7); }
    else if (code == 5) { if (rimE > 0.75) outgoingLight = uEl[16]; if (fract(y * 4.0 + sx) < 0.08) outgoingLight = uEl[18]; }
    else if (code == 7) { float bn = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715)))), thr = vFx.x * 1.2; if (y < thr - bn * 0.25) discard; outgoingLight = y < thr + 0.07 ? uFireB : outgoingLight * (1.0 - 0.45 * vFx.x); }
    else if (code == 8) { if (vFx.x > 0.4) discard; outgoingLight = rimE > 0.45 ? uArcC : vec3(0.118, 0.118, 0.165); }
    else if (code == 6) { if (fract(y * 4.0 + sx * 3.0) < 0.2 && rimE < 0.6) outgoingLight = uEl[20] * 0.25; if (rimE > 0.8) outgoingLight = uEl[21]; } } }
  gl_FragColor = vec4( outgoingLight, diffuseColor.a );`);
  };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : null; mat.customProgramCacheKey = () => (key ? key() : '') + 'status' + ymin.toFixed(2) + ymax.toFixed(2);
  return mat;
}

