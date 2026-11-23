// Stand-in creatures v2 (view only): the swarm kinds as recognisable low-poly creatures built in code from boxes, prisms and diamonds, replacing the octahedron, cube and icosahedron stand-ins. Same sim, same hitboxes,
// same one instanced draw per kind; these are placeholders until Randall's real models arrive. Flat faceted, 60 to 160 triangles a body, enemy palette only (dust 4a4034 6e604c 9a8a70, grave 2a3038 4a5260 7a8290, amber eyes
// e0a040), a darker underside on every part. Each vertex carries aJ = (leg swing sign, leg weight, bob weight): the vertex shader (creatureLit) turns that into a walk, so there is no CPU animation and no upload.
//
// Everything is designed in metres on the ground (+z forward, y up), then divided by the kind's draw scale, because the CPU matrix multiplies by K.scale and lifts the body by the kind's offset.
const T = window.THREE;
const C = { dd: 0x4a4034, dm: 0x6e604c, dl: 0x9a8a70, gd: 0x2a3038, gm: 0x4a5260, gl: 0x7a8290, eye: 0xe0a040, ink: 0x1d1a16 };
const GAIN = 1.3;       // the palette tones read dark under the Lambert light at game camera: one lift for every part keeps the palette's hue and its light-to-dark order
const mul = (h, k) => { k *= GAIN; const r = Math.min(255, Math.round(((h >> 16) & 255) * k)), g = Math.min(255, Math.round(((h >> 8) & 255) * k)), b = Math.min(255, Math.round((h & 255) * k)); return [r / 255, g / 255, b / 255]; };

class Build {
  constructor(sc, off) { this.sc = sc; this.off = off; this.pos = []; this.col = []; this.aj = []; }
  v(p, c, j) { this.pos.push(p[0] / this.sc[0], (p[1] - this.off) / this.sc[1], p[2] / this.sc[2]); this.col.push(c[0], c[1], c[2]); this.aj.push(j[0], j[1], j[2]); }
  tri(a, b, c, col, J) { const j = J || [0, 0, 0.6]; this.v(a, col, jx(a, j)); this.v(b, col, jx(b, j)); this.v(c, col, jx(c, j)); }
  // a box centred at (x, y, z) in metres, size w x h x d; colours: top, side, bottom; leg = { sign, hip, len } swings about the hip height
  box(x, y, z, w, h, d, base, leg, bob) {
    const hx = w / 2, hy = h / 2, hz = d / 2, top = mul(base, 1.18), side = mul(base, 1), bot = mul(base, 0.58), J = leg ? { leg } : null, jb = bob === undefined ? 0.6 : bob;
    const P = (sx, sy, sz) => [x + sx * hx, y + sy * hy, z + sz * hz], q = (a, b, c, d, col) => { this.q4(a, b, c, d, col, J, jb); };
    q(P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), top); q(P(-1, -1, 1), P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), bot);
    q(P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), mul(base, 1.05)); q(P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), mul(base, 0.85));
    q(P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), mul(base, 0.95)); q(P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), mul(base, 0.9));
  }
  q4(a, b, c, d, col, J, jb) { const j = J ? J : null; const mk = p => { if (!j) return [0, 0, jb]; const w = Math.max(0, Math.min(1, (j.leg.hip - p[1]) / j.leg.len)); return [j.leg.sign, w, jb * (1 - w * 0.5)]; }; this.vv(a, col, mk(a)); this.vv(b, col, mk(b)); this.vv(c, col, mk(c)); this.vv(a, col, mk(a)); this.vv(c, col, mk(c)); this.vv(d, col, mk(d)); }
  vv(p, c, j) { this.v(p, c, j); }
  // a triangular prism along x: profile points (y, z) at half width hw, centred at x; for horns, tails, shell ridges and spikes
  prism(x, hw, prof, base, leg) {
    const J = leg ? { leg } : null, P = (sx, pr) => [x + sx * hw, pr[0], pr[1]], a = prof[0], b = prof[1], c = prof[2], col = mul(base, 1), top = mul(base, 1.15), bot = mul(base, 0.6);
    this.q4(P(-1, a), P(-1, b), P(-1, c), P(-1, c), mul(base, 0.9), J, 0.6); this.q4(P(1, c), P(1, b), P(1, a), P(1, a), mul(base, 0.95), J, 0.6);
    this.q4(P(-1, a), P(1, a), P(1, b), P(-1, b), top, J, 0.6); this.q4(P(-1, b), P(1, b), P(1, c), P(-1, c), col, J, 0.6); this.q4(P(-1, c), P(1, c), P(1, a), P(-1, a), bot, J, 0.6);
  }
  // an elongated diamond (8 triangles): the Glass Seer's shards
  diamond(x, y, z, rx, ytop, ybot, rz, base, bobw) {
    const t = [x, y + ytop, z], b = [x, y - ybot, z], p = [[x - rx, y, z], [x, y, z + rz], [x + rx, y, z], [x, y, z - rz]], top = mul(base, 1.2), bot = mul(base, 0.6), J = [0, 0, bobw === undefined ? 1 : bobw];
    for (let i = 0; i < 4; i++) { const a = p[i], c = p[(i + 1) % 4]; this.tri(t, a, c, i % 2 ? mul(base, 1.05) : top, J); this.tri(b, c, a, i % 2 ? bot : mul(base, 0.7), J); }
  }
  geometry() {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3)); g.setAttribute('aJ', new T.Float32BufferAttribute(this.aj, 3));
    g.computeVertexNormals(); g.computeBoundingBox(); g.userData.tris = this.pos.length / 9; return g;
  }
}
// aJ for a plain triangle: a vertex that belongs to no leg keeps (0, 0, bob)
function jx(p, j) { return j; }

// ---- the seven kinds. sc = the kind's draw scale (data/enemies.js), off = the lift the CPU adds (0.85, golem 0.7, seer 1.2) ----
const MAKERS = {
  husk(b) {                                                     // a hunched two-legged shambler: bowed torso, forward head with an amber eye, long arms that swing
    b.box(-0.2, 0.3, 0, 0.3, 0.6, 0.32, C.dd, { sign: 1, hip: 0.6, len: 0.6 }, 0.5); b.box(0.2, 0.3, 0, 0.3, 0.6, 0.32, C.dd, { sign: -1, hip: 0.6, len: 0.6 }, 0.5);
    b.box(0, 1.05, -0.05, 0.7, 0.75, 0.5, C.dm); b.box(0, 1.62, 0.22, 0.42, 0.4, 0.42, C.dl); b.box(0, 1.66, 0.46, 0.3, 0.08, 0.05, C.eye, null, 1);
    b.box(-0.5, 0.95, 0.12, 0.2, 0.75, 0.22, C.dl, { sign: -1, hip: 1.3, len: 0.75 }, 0.8); b.box(0.5, 0.95, 0.12, 0.2, 0.75, 0.22, C.dl, { sign: 1, hip: 1.3, len: 0.75 }, 0.8);
  },
  runner(b) {                                                   // a lean four-legged beast: long body, low head with an amber eye, ears, a flicking tail
    const L = (x, z, s) => b.box(x, 0.22, z, 0.14, 0.44, 0.14, C.dm, { sign: s, hip: 0.44, len: 0.44 }, 0.4);
    L(-0.17, 0.4, 1); L(0.17, 0.4, -1); L(-0.17, -0.4, -1); L(0.17, -0.4, 1);
    b.box(0, 0.58, 0, 0.42, 0.34, 1.05, C.dl); b.box(0, 0.74, 0.7, 0.3, 0.3, 0.4, C.dl); b.box(0, 0.72, 0.92, 0.2, 0.2, 0.12, C.dd); b.box(0, 0.8, 0.9, 0.22, 0.06, 0.04, C.eye, null, 1);
    b.prism(-0.1, 0.04, [[0.9, 0.62], [0.9, 0.78], [1.12, 0.66]], C.dl); b.prism(0.1, 0.04, [[0.9, 0.62], [0.9, 0.78], [1.12, 0.66]], C.dl);
    b.prism(0, 0.05, [[0.55, -0.5], [0.7, -0.5], [0.62, -0.95]], C.dd);
  },
  seer(b) {                                                     // a floating shard creature: a tall crystal body with one amber eye facet, three orbiting shards
    b.diamond(0, 1.35, 0, 0.42, 1.1, 1.0, 0.42, C.gl, 1);
    b.diamond(-0.62, 0.85, 0.1, 0.16, 0.34, 0.3, 0.16, C.gm, 1); b.diamond(0.6, 1.05, -0.1, 0.18, 0.4, 0.34, 0.18, C.gm, 1); b.diamond(0.0, 0.5, 0.5, 0.14, 0.3, 0.26, 0.14, C.gd, 1);
    b.tri([-0.26, 1.42, 0.3], [0.26, 1.42, 0.3], [0, 1.1, 0.4], mul(C.eye, 1), [0, 0, 1]); b.tri([0.26, 1.42, 0.3], [0, 1.78, 0.34], [-0.26, 1.42, 0.3], mul(C.eye, 1.1), [0, 0, 1]);
  },
  golem(b) {                                                    // a broad horned brute: huge arms, a low head with two horns, shoulder plates
    b.box(-0.36, 0.45, 0, 0.42, 0.9, 0.46, C.gd, { sign: 1, hip: 0.9, len: 0.9 }, 0.5); b.box(0.36, 0.45, 0, 0.42, 0.9, 0.46, C.gd, { sign: -1, hip: 0.9, len: 0.9 }, 0.5);
    b.box(0, 1.3, 0, 1.2, 0.95, 0.8, C.gm); b.box(0, 1.55, 0.5, 0.5, 0.4, 0.42, C.gl);
    b.prism(-0.28, 0.07, [[1.7, 0.5], [1.7, 0.7], [2.15, 0.62]], C.gl); b.prism(0.28, 0.07, [[1.7, 0.5], [1.7, 0.7], [2.15, 0.62]], C.gl);
    b.box(-0.88, 1.1, 0.12, 0.42, 1.05, 0.4, C.gm, { sign: -1, hip: 1.62, len: 1.05 }, 0.8); b.box(0.88, 1.1, 0.12, 0.42, 1.05, 0.4, C.gm, { sign: 1, hip: 1.62, len: 1.05 }, 0.8);
    b.box(-0.62, 1.8, 0, 0.5, 0.18, 0.7, C.gl); b.box(0.62, 1.8, 0, 0.5, 0.18, 0.7, C.gl);
  },
  bloat(b) {                                                    // a round swollen body on four short legs with a small mouth bump
    const L = (x, z, s) => b.box(x, 0.15, z, 0.2, 0.3, 0.2, C.dl, { sign: s, hip: 0.3, len: 0.3 }, 0.3);
    L(-0.4, 0.35, 1); L(0.4, 0.35, -1); L(-0.4, -0.35, -1); L(0.4, -0.35, 1);
    const ph = (1 + Math.sqrt(5)) / 2, R = 0.78, V = [[-1, ph, 0], [1, ph, 0], [-1, -ph, 0], [1, -ph, 0], [0, -1, ph], [0, 1, ph], [0, -1, -ph], [0, 1, -ph], [ph, 0, -1], [ph, 0, 1], [-ph, 0, -1], [-ph, 0, 1]].map(v => { const l = Math.hypot(...v); return [v[0] / l * R, 0.95 + v[1] / l * R * 0.9, v[2] / l * R]; });
    const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    F.forEach(f => { const cy = (V[f[0]][1] + V[f[1]][1] + V[f[2]][1]) / 3; b.tri(V[f[0]], V[f[1]], V[f[2]], mul(cy > 0.95 ? C.dm : C.dd, 1), [0, 0, 1]); });
    b.box(0, 0.95, 0.78, 0.3, 0.2, 0.14, C.dd, null, 1);
  },
  hunter(b) {                                                   // a tall thin stalker: long legs, narrow torso, small head with an amber eye, very long arms, a spiked back
    b.box(-0.14, 0.55, 0, 0.12, 1.1, 0.14, C.gm, { sign: 1, hip: 1.1, len: 1.1 }, 0.4); b.box(0.14, 0.55, 0, 0.12, 1.1, 0.14, C.gm, { sign: -1, hip: 1.1, len: 1.1 }, 0.4);
    b.box(0, 1.5, -0.04, 0.34, 0.7, 0.24, C.gd); b.box(0, 2.05, 0.1, 0.24, 0.26, 0.26, C.gl); b.box(0, 2.08, 0.25, 0.18, 0.05, 0.04, C.eye, null, 1);
    b.box(-0.28, 1.25, 0.18, 0.1, 0.95, 0.1, C.gm, { sign: -1, hip: 1.7, len: 0.95 }, 0.8); b.box(0.28, 1.25, 0.18, 0.1, 0.95, 0.1, C.gm, { sign: 1, hip: 1.7, len: 0.95 }, 0.8);
    b.prism(0, 0.05, [[1.2, -0.12], [1.85, -0.12], [1.9, -0.42]], C.gl); b.prism(0, 0.05, [[1.0, -0.12], [1.35, -0.12], [1.3, -0.34]], C.gl);
  },
  scarab(b) {                                                   // a low beetle: a domed shell with a ridge, a head with two mandibles, three stub legs a side
    for (let k = 0; k < 3; k++) { const z = -0.3 + k * 0.3; b.box(-0.34, 0.1, z, 0.34, 0.08, 0.1, C.gd, { sign: k % 2 ? 1 : -1, hip: 0.14, len: 0.1 }, 0.3); b.box(0.34, 0.1, z, 0.34, 0.08, 0.1, C.gd, { sign: k % 2 ? -1 : 1, hip: 0.14, len: 0.1 }, 0.3); }
    b.box(0, 0.22, -0.05, 0.62, 0.22, 0.95, C.gm); b.prism(0, 0.3, [[0.33, -0.5], [0.33, 0.42], [0.5, -0.05]], C.gl);
    b.box(0, 0.24, 0.55, 0.34, 0.2, 0.26, C.gd); b.prism(-0.1, 0.04, [[0.2, 0.7], [0.32, 0.7], [0.26, 0.94]], C.gl); b.prism(0.1, 0.04, [[0.2, 0.7], [0.32, 0.7], [0.26, 0.94]], C.gl);
    b.box(-0.1, 0.32, 0.66, 0.06, 0.06, 0.04, C.eye, null, 1); b.box(0.1, 0.32, 0.66, 0.06, 0.06, 0.04, C.eye, null, 1);
  }
};
const SPEC = { 0: ['husk', [1, 1.25, 1], 0.85], 1: ['runner', [0.7, 1.0, 0.7], 0.85], 2: ['seer', [0.8, 1.8, 0.8], 1.2], 3: ['golem', [1.5, 1.3, 1.5], 0.7], 4: ['bloat', [1.3, 1.1, 1.3], 0.85], 5: ['scarab', [0.8, 0.4, 1.0], 0.85], 6: ['hunter', [0.95, 1.5, 0.95], 0.85] };
export function creatureGeometry(kindId) { const s = SPEC[kindId]; if (!s) return null; const b = new Build(s[1], s[2]); MAKERS[s[0]](b); return b.geometry(); }

// the walk, in the vertex shader (no CPU animation, no upload). Phase = distance travelled along the facing / stride (so a creature that stands still stands still), quantised to 6 poses a cycle (about 12 a second at run speed, toy-like),
// plus an offset per instance slot so a crowd is out of step. aJ.x = leg sign, aJ.y = leg weight (0 at the hip, 1 at the foot), aJ.z = bob weight. A constant forward lean comes with the bob.
export function creatureLit(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = sh => {
    if (prev) prev(sh);
    sh.vertexShader = 'attribute vec3 aJ;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
 { vec3 ip_ = instanceMatrix[3].xyz; vec2 fw_ = normalize(instanceMatrix[2].xz + vec2(1e-5)); float s_ = length(instanceMatrix[2].xyz), sy_ = length(instanceMatrix[1].xyz);
   float ph_ = floor((dot(ip_.xz, fw_) / 1.5 + float(gl_InstanceID) * 0.37) * 6.0) / 6.0 * 6.2832; float sw_ = sin(ph_), ab_ = abs(sw_);
   transformed.y += aJ.z * 0.07 * ab_ / max(sy_, 0.3); transformed.z += aJ.x * aJ.y * sw_ * 0.3 / max(s_, 0.3) + aJ.z * (transformed.y + 0.8) * 0.05; transformed.y += aJ.x * aJ.y * max(sw_ * aJ.x, 0.0) * 0.1 / max(sy_, 0.3); }
#endif`);
  };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : null; mat.customProgramCacheKey = () => (key ? key() : '') + 'creature';
  return mat;
}
