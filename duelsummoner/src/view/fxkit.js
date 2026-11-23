// The effect kit (spectacle build order, step 5): the one ramp texture and the GLSL ES 3.00 pieces the effect shaders share. View only.
//
// There is ONE noise texture, the 64 x 64 one in view/engine.js (the sky, water, wind and grass already read it): this file re-exports it instead of making a second copy. There is ONE clock and ONE gust field there too, and the one
// Bayer function (bayer()). What this file adds is the 8 x 8 RGBA8 ramp (a row per element, five tones per row, made in code from data/fxramp.js) and the `ramp(row, tone)` lookup.
//
// three r128 takes ES 3.00 text: a ShaderMaterial with glslVersion = THREE.GLSL3 gets '#version 300 es' added and the old names mapped (the blit quad in view/post already runs this way). The lab compiles a texelFetch shader on the
// ramp and reads a pixel back to prove it on this browser (fxProbe below).
import { RAMP, ELEMENTS } from '../data/fxramp.js';
import { E, GLSL } from './engine.js';
const T = window.THREE;

function buildRamp() {
  const d = new Uint8Array(8 * 8 * 4);
  ELEMENTS.forEach((el, row) => { const r = RAMP[el]; for (let tone = 0; tone < 8; tone++) { const c = r[Math.min(tone, 4)], o = (row * 8 + tone) * 4; d[o] = (c >> 16) & 255; d[o + 1] = (c >> 8) & 255; d[o + 2] = c & 255; d[o + 3] = 255; } });
  const tex = new T.DataTexture(d, 8, 8, T.RGBAFormat, T.UnsignedByteType); tex.minFilter = tex.magFilter = T.NearestFilter; tex.generateMipmaps = false; tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping; tex.needsUpdate = true; return tex;
}
export const FX = { ramp: { value: buildRamp() }, noise: E.noise, time: E.T };

// GLSL ES 3.00 chunks for effect shaders (write them as the body of a ShaderMaterial with glslVersion GLSL3)
export const RAMP_GLSL = 'uniform sampler2D uRamp;\nvec3 ramp(int row, int tone) { return texelFetch(uRamp, ivec2(tone, row), 0).rgb; }\n';
export const SHARED_GLSL = GLSL.slice(0, GLSL.indexOf('float bayer()'));        // noise lookup N(), hsh(), the one gust(), skyBase() (the Bayer function needs gl_FragCoord, so fragment shaders take it from engine.GLSL whole)
export function fxUniforms() { return { uRamp: FX.ramp, uN: E.noise, uT: E.T, uWind: E.wind }; }

// proof that this browser compiles ES 3.00 text with texelFetch on the ramp: draw a 1 pixel quad into a 1 x 1 target and read the colour back; returns the colour of (fire, core) as a hex number, or null on failure
export function fxProbe(renderer) {
  try {
    const rt = new T.WebGLRenderTarget(1, 1), sc = new T.Scene(), cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mat = new T.ShaderMaterial({ glslVersion: T.GLSL3, uniforms: { uRamp: FX.ramp }, vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D uRamp; out vec4 o; vec3 ramp(int row, int tone) { return texelFetch(uRamp, ivec2(tone, row), 0).rgb; } void main() { o = vec4(ramp(0, 0), 1.0); }' });
    sc.add(new T.Mesh(new T.PlaneGeometry(2, 2), mat)); const prev = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.render(sc, cam);
    const px = new Uint8Array(4); renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, px); renderer.setRenderTarget(prev); rt.dispose(); mat.dispose(); return (px[0] << 16) | (px[1] << 8) | px[2];
  } catch (e) { return null; }
}
