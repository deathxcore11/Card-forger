// The composite path (spectacle spec 6.2, build step 10), behind the Detail setting: ON at Medium and High, OFF at Low (and with ?composite=0). View only.
//
// What is built here: the scene is drawn into the internal target as before (alpha is the free mask: the world clears to alpha 1, and a glow pixel, such as a lightning core, writes alpha 0). Three small passes then
// run at 1/4 internal size: a bright pass that keeps only the colour of glow pixels (so bright sand never blooms), and a separable blur. The final blit adds that glow back in STEPS (6 levels, no smooth halo) and carries the
// screen terms the spec moves into the composite: world dim, colour drain, screen edge and the flash colour (all at 0 until a moment drives them). 3 extra draws, no extra upload.
// What is NOT built yet (open): the offset (distortion) pass, the protected-actor alpha of 0.5 (so the world dim would still touch actors: dim stays at 0), and the priority pass after the composite.
const T = window.THREE;
const VS = 'out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BRIGHT = 'precision highp float; uniform sampler2D tScene; uniform vec2 uTexel; in vec2 vUv; layout(location = 0) out vec4 o; void main() { vec3 a = vec3(0.0); for (int k = 0; k < 4; k++) { vec2 d = vec2(float(k & 1), float(k >> 1)) * 2.0 - 1.0; vec4 s = texture(tScene, vUv + d * uTexel * 0.5); a += s.rgb * (1.0 - smoothstep(0.1, 0.4, s.a)); } o = vec4(a * 0.25, 1.0); }';
const BLUR = 'precision highp float; uniform sampler2D tIn; uniform vec2 uDir; in vec2 vUv; layout(location = 0) out vec4 o; void main() { vec3 c = texture(tIn, vUv).rgb * 0.2270; c += (texture(tIn, vUv + uDir).rgb + texture(tIn, vUv - uDir).rgb) * 0.3162; c += (texture(tIn, vUv + uDir * 2.0).rgb + texture(tIn, vUv - uDir * 2.0).rgb) * 0.0703; o = vec4(c, 1.0); }';

export class Composite {
  constructor(renderer) {
    this.r = renderer; this.on = true; this.rt = []; this.scene = new T.Scene(); this.cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mk = fs => new T.ShaderMaterial({ glslVersion: T.GLSL3, depthTest: false, depthWrite: false, vertexShader: VS, fragmentShader: fs, uniforms: { tScene: { value: null }, tIn: { value: null }, uTexel: { value: new T.Vector2() }, uDir: { value: new T.Vector2() } } });
    this.mBright = mk(BRIGHT); this.mBlur = mk(BLUR); this.quad = new T.Mesh(new T.PlaneGeometry(2, 2), this.mBright); this.quad.frustumCulled = false; this.scene.add(this.quad);
  }
  resize(bw, bh) {
    for (const t of this.rt) t.dispose(); this.w = Math.max(1, Math.ceil(bw / 4)); this.h = Math.max(1, Math.ceil(bh / 4));
    this.rt = [0, 1].map(() => new T.WebGLRenderTarget(this.w, this.h, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false }));
  }
  // sceneTex: the internal scene target's texture. Returns the glow texture (1/4 size), or null when the composite is off.
  run(sceneTex, bw, bh) {
    if (!this.on || !this.rt.length) return null;
    const r = this.r, prev = r.getRenderTarget(), q = this.quad, A = this.rt[0], B = this.rt[1];
    q.material = this.mBright; this.mBright.uniforms.tScene.value = sceneTex; this.mBright.uniforms.uTexel.value.set(1 / bw, 1 / bh); r.setRenderTarget(A); r.render(this.scene, this.cam);
    q.material = this.mBlur; this.mBlur.uniforms.tIn.value = A.texture; this.mBlur.uniforms.uDir.value.set(1 / this.w, 0); r.setRenderTarget(B); r.render(this.scene, this.cam);
    this.mBlur.uniforms.tIn.value = B.texture; this.mBlur.uniforms.uDir.value.set(0, 1 / this.h); r.setRenderTarget(A); r.render(this.scene, this.cam);
    r.setRenderTarget(prev); return A.texture;
  }
}
