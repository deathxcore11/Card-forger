// Everything that moves in the scene: duelist, field monsters, the swarm (instanced per kind), elites and the boss,
// telegraphs and effects, pickups. Positions are blended between the last two sim ticks so any refresh rate looks smooth.
import { CFG } from '../data/config.js';
import { KIND_LIST, BOSS_COLORS as BC } from '../data/enemies.js';
import { MONSTERS, FUSIONS, formOf } from '../data/cards.js';
import { MAP } from '../data/map.js';
import { SCALE, summonSize } from '../data/scale.js';
import { DuelistRig } from './rig.js';
import { actorLit, setStains, setSkyTint, setTele } from './engine.js';
import { Ribbon } from './ribbon.js';
import { OwnEffects } from './ownfx.js';
import { RAMP, ELEMENTS } from '../data/fxramp.js';
import { Signatures } from './signature.js';
import { seeActor } from './seethrough.js';
import { ownColour } from './fxcolour.js';
import { statusLit, statusAttr } from './status.js';
import { creatureGeometry, creatureLit } from './creatures.js';
import { PICKUP_COLORS } from '../data/pickups.js';
import { makeCreature } from './creature.js';

const T = window.THREE;
const lambert = (color, extra, k) => actorLit(new T.MeshLambertMaterial(Object.assign({ color, flatShading: true }, extra || {})), k || 1);
const basic = (color, extra) => new T.MeshBasicMaterial(Object.assign({ color }, extra || {}));
const lerp = (a, b, t) => a + (b - a) * t;
const pl = (a, b, t) => (Math.abs(b - a) > 3 ? b : a + (b - a) * t);                // do not blend across a teleport
const turnLerp = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };


// Experience gem: a 6-sided crystal, prism body with a pointed 6-face tip and a flat chipped base (22 triangles, flat colours).
function gemGeometry() {
  const R = 0.5, yb = 0, ym = 0.55, yt = 1.05, n = 6, ring = (y, r, chip) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2 + 0.3, k = chip && i === 2 ? 0.7 : 1; return [Math.cos(a) * r * k, y, Math.sin(a) * r * k]; });
  const base = ring(yb, R * 0.8, true), mid = ring(ym, R, false), tip = [0, yt, 0], pos = [], col = [];
  const light = new T.Vector3(0.4, 0.8, 0.45).normalize(), dark = new T.Color(PICKUP_COLORS.xpUnder), midc = new T.Color(PICKUP_COLORS.xp), lit = new T.Color(PICKUP_COLORS.xpTip);
  const tri = (a, b, c) => {
    const u = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), v = new T.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]), nrm = u.cross(v).normalize();
    const cx = (a[0] + b[0] + c[0]) / 3, cz = (a[2] + b[2] + c[2]) / 3; if (nrm.x * cx + nrm.z * cz < 0 && Math.abs(nrm.y) < 0.99 && nrm.y > -0.99) nrm.negate();
    const d = nrm.dot(light), colr = d > 0.55 ? lit : d > 0.05 ? midc : dark;
    for (const p of [a, b, c]) { pos.push(p[0], p[1], p[2]); col.push(colr.r, colr.g, colr.b); }
  };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tri(base[i], base[j], mid[j]); tri(base[i], mid[j], mid[i]);        // side
    tri(mid[i], mid[j], tip);                                           // pointed tip
  }
  for (let i = 1; i < n - 1; i++) tri(base[0], base[i + 1], base[i]);   // flat base
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  return geo;
}
const SWAY_T = { value: 0 };
const SC_SCARAB = [1.04, 0.52, 1.3];
const DANGER = new T.Color(1.0, 0.231, 0.188), EDGE = new T.Color(1.0, 0.851, 0.831);       // #ff3b30 and the pale edge #ffd9d4
// every non-own effect and every enemy warning writes stencil bit 2 where it draws; the own-effect fills test it (view/ownfx.js), so an own effect can never be drawn over a warning
const WARN = o => Object.assign(o, { stencilWrite: true, stencilRef: 4, stencilFunc: T.AlwaysStencilFunc, stencilWriteMask: 0x04, stencilFuncMask: 0xff, stencilFail: T.KeepStencilOp, stencilZFail: T.KeepStencilOp, stencilZPass: T.ReplaceStencilOp });
function instanced(geo, material, max) {
  const m = new T.InstancedMesh(geo, material, max);
  m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(T.DynamicDrawUsage);
  // upload only what is drawn: nothing at all while the mesh has no instances, and only the first `count` matrices otherwise (the rest of the buffer is never read). A mesh that is empty frame after frame costs no upload.
  const im = m.instanceMatrix; Object.defineProperty(im, 'needsUpdate', { get() { return false; }, set(v) { if (v === true && m.count > 0) { this.version++; this.updateRange.offset = 0; this.updateRange.count = m.count * 16; } } });
  return m;
}
const flat = geo => { geo.rotateX(-Math.PI / 2); return geo; };

function playerMesh(color) {
  const g = new T.Group();
  const robe = new T.Mesh(new T.CylinderGeometry(0.35, 0.65, 1.3, 6), lambert(color || 0x3c2a66)); robe.position.y = 0.65;
  const head = new T.Mesh(new T.BoxGeometry(0.45, 0.45, 0.45), lambert(0xe8c39a)); head.position.y = 1.55;
  const disk = new T.Mesh(new T.BoxGeometry(0.9, 0.08, 0.35), lambert(0xd8b24a)); disk.position.set(-0.55, 1.0, 0.1);
  const lean = new T.Group(); lean.add(robe, head, disk); g.add(lean); g.userData.body = robe; g.userData.lean = lean; g.userData.squash = 0;
  return g;
}

// ---- field monster meshes: the owner's models when loaded, simple original shapes otherwise ----
function wingMesh(color, span) {
  const wg = new T.BufferGeometry(), s = span;
  wg.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0.3, s, 0.3, -0.3, 0, 0, -0.5, 0, 0, 0.3, 0, 0, -0.5, -s, 0.3, -0.3], 3)); wg.computeVertexNormals();
  return new T.Mesh(wg, lambert(color, { side: T.DoubleSide }));
}
function cone(r, h, color) { const m = new T.Mesh(new T.ConeGeometry(r, h, 5), lambert(color)); m.rotation.x = Math.PI / 2; return m; }

const PLACEHOLDER = {
  'ember-wyvern': () => { const g = new T.Group(); g.add(cone(0.4, 1.4, 0xd9502a), wingMesh(0xf0913a, 1.5)); return g; },
  'cinder-hatchling': () => { const g = new T.Group(); const b = new T.Mesh(new T.IcosahedronGeometry(0.4, 0), lambert(0x3a3438)); b.position.y = 0.4; const c = cone(0.18, 0.5, 0xff7a20); c.position.set(0, 0.5, 0.4); g.add(b, c); return g; },
  'rune-apprentice': () => { const g = new T.Group(); const b = new T.Mesh(new T.ConeGeometry(0.4, 1.2, 6), lambert(0x6a4aa8)); const h = new T.Mesh(new T.OctahedronGeometry(0.28, 0), lambert(0xe8c39a)); h.position.y = 0.8; g.add(b, h); return g; },
  'sigil-familiar': () => { const g = new T.Group(); g.add(new T.Mesh(new T.OctahedronGeometry(0.4, 0), lambert(0xa57bff))); return g; },
  'twinflare-tyrant': () => { const g = new T.Group(); g.add(cone(0.7, 2.2, 0xb02a1a), wingMesh(0xff7a20, 2.6)); return g; },
  'astral-magus': () => { const g = new T.Group(); const b = new T.Mesh(new T.ConeGeometry(0.6, 1.8, 6), lambert(0x4a2a8a)); const o = new T.Mesh(new T.OctahedronGeometry(0.35, 0), basic(0xd8b0ff)); o.position.y = 1.2; g.add(b, o); return g; }
};

function modelGroup(model, targetSize, axis, glowColor) {
  const g = new T.Group(), s = targetSize / (axis === 'max' ? Math.max(model.size.x, model.size.y, model.size.z) : model.size[axis]);       // size from the SCALE table, in metres
  const root = new T.Group(); root.scale.setScalar(s);
  root.position.set(-(model.min[0] + model.max[0]) / 2 * s, -model.min[1] * s, -(model.min[2] + model.max[2]) / 2 * s);
  const solid = new T.Mesh(model.solid, lambert(0xffffff, { vertexColors: true, side: T.DoubleSide }));
  root.add(solid);
  if (model.glow) { const glow = new T.Mesh(model.glow, basic(glowColor || 0xff7319, { side: T.DoubleSide })); root.add(glow); g.userData.glow = glow; }
  g.add(root); g.userData.model = model; g.userData.scale = s; g.userData.root = root;
  return g;
}

// how much of an own area's true radius its lingering ground mark covers, by screen tier 1..5 (the ramp is measured as claimed screen share, test/browser-share.mjs)
const STK = [0, 1.0, 0.95, 1.0, 1.0, 1.0], STCAP = [0, 6, 6, 8, 10, 24];       // and the largest true radius a mark follows, so one huge cone cannot paint the screen
export class Actors {
  constructor(scene, assets, fx) {
    this.scene = scene; this.assets = assets || {}; this.fx = fx;
    this.sig = new Signatures(); this.sigRun = []; this._growSeen = new WeakMap(); this._marks = []; this._skyLight = false; this.vt = 0; this.fusionAt = undefined; this.ghosts = []; this._pg = true; this._pvy = 0; this._wasSwarm = new Uint8Array(CFG.enemy.max); this.burnMax = new Float32Array(CFG.enemy.max); this.hitRow = new Int8Array(CFG.enemy.max).fill(-1); this._tierSeen = new WeakMap(); this._stains = []; this._lead = null; this._skyOn = false; this.tier5 = false; this.labStatus = new Uint8Array(CFG.enemy.max); this._fc = new T.Color(); this.flashBright = ['fire', 'ice', 'lightning', 'poison', 'wind', 'earth', 'light', 'dark'].map(n => new T.Color(RAMP[n][1])); this.flashNeutral = new T.Color(0xf3e3c2); this.arcT = new Float32Array(CFG.enemy.max); this.spawnAge = new Float32Array(CFG.enemy.max); this._dustBudget = 0; this._ghostFresh = false;       // labStatus: the lab sets an element status code on a body (1 ice shell, 2 venom, 3 gust, 4 mire, 5 reveal, 6 shred) until the sim wires those elements
    this._white = new T.Color(0x666666); this._black = new T.Color(0x000000);
    this.player = playerMesh(); scene.add(this.player);
    this.rig = null; this.rigs = {};                                          // the skinned duelists, for each GLB present in assets/models (duelist-<id>-anim.glb)
    for (const id of ['kael', 'mira']) if (assets && assets[id]) { const r = new DuelistRig(assets[id], { yaw: Number((/[?&]rigyaw=([-\d.]+)/.exec(location.search) || [])[1]) || 0 }); r.group.visible = false; scene.add(r.group); this.rigs[id] = r; }
    if (Object.keys(this.rigs).length) this.player.visible = false;
    this.d = new T.Object3D(); this.col = new T.Color(); this.white = new T.Color(0xffffff);
    this._plain = new T.Color(1, 1, 1); this._blue = new T.Color(1.06, 1.06, 1.06); this._gold = new T.Color(1.12, 1.12, 1.12);       // a bigger gem is only bigger and a touch lighter: gold and violet are never XP colours
    this.monsters = new Map(); this.specials = new Map(); this.chests = new Map();

    // the swarm: one instanced mesh per kind (+ eyes for the ground swarmers)
    this.kinds = KIND_LIST.map(K => {
      const cg = creatureGeometry(K.id), geo = cg || (K.id === 3 ? new T.BoxGeometry(1.1, 1.1, 1.1) : K.id === 4 ? new T.IcosahedronGeometry(0.8, 0) : new T.OctahedronGeometry(0.75, 0));
      geo.computeBoundingBox(); const bb = geo.boundingBox, mat = lambert(0xffffff, cg ? { vertexColors: true, side: T.DoubleSide } : null, 0.3); if (cg) creatureLit(mat); statusLit(mat, bb.min.y, bb.max.y);
      const body = instanced(geo, mat, CFG.enemy.max); statusAttr(geo, CFG.enemy.max);
      body.instanceColor = new T.InstancedBufferAttribute(new Float32Array(CFG.enemy.max * 3), 3);
      const eye = !cg && K.eye ? instanced(new T.BoxGeometry(0.5, 0.12, 0.1), basic(0xe0a040), CFG.enemy.max) : null;
      scene.add(body); if (eye) scene.add(eye);
      return { K, body, eye, base: cg ? new T.Color(1, 1, 1) : new T.Color(K.color), boost: cg ? 2.4 : 1, fxArr: geo.attributes.aFx.array, fxNow: false, fxPrev: false };
    });    // Toll Shades: a tall violet-black hooded silhouette with a glowing eye line and a gold bell (stand-in look until the art arrives)
    this.shadeBody = instanced(new T.ConeGeometry(0.9, 3.0, 7), seeActor(basic(0x1d1030)), 24); this.shadeHood = instanced(new T.ConeGeometry(0.5, 1.0, 6), seeActor(basic(0x0b0716)), 24);
    this.shadeEye = instanced(new T.BoxGeometry(0.34, 0.07, 0.1), basic(0xc07bff), 24); this.shadeBell = instanced(new T.ConeGeometry(0.17, 0.3, 6), basic(0xe8c56a), 24);
    scene.add(this.shadeBody, this.shadeHood, this.shadeEye, this.shadeBell);
    this.marks = instanced(new T.OctahedronGeometry(0.22, 0), basic(0xc090ff), CFG.enemy.max); scene.add(this.marks);
    this.orbit = instanced(new T.CylinderGeometry(0.17, 0.17, 0.05, 12), basic(0xffd23f), 10); this.orbit.count = 0; scene.add(this.orbit);          // the Coin Rite: ten coins circling the duelist
    this.crests = instanced(new T.OctahedronGeometry(0.3, 0), basic(0xffd23f), 24); scene.add(this.crests); this.aceCol = new T.Color(1, 0.86, 0.5);          // the star crest of an Ace monster, and its gold tint

    this.cards = instanced(new T.BoxGeometry(0.5, 0.05, 0.7), basic(0xf3e3c2), CFG.card.max + 64);
    this.fire = instanced(new T.OctahedronGeometry(0.3, 0), basic(0xffb040), CFG.card.max + 64);
    this.lob = instanced(new T.IcosahedronGeometry(0.4, 0), basic(0xffb340), 16);       // amber, never the orange-red that is reserved for enemy attacks
    const glow = () => basic(0xffc860, { transparent: true, opacity: 0.32, blending: T.AdditiveBlending, depthWrite: false });
    this.lobGlow = instanced(new T.IcosahedronGeometry(0.4, 0), glow(), 16); this.fireGlow = instanced(new T.OctahedronGeometry(0.3, 0), glow(), CFG.card.max + 64); scene.add(this.lobGlow, this.fireGlow);
    this.bolts = instanced(new T.OctahedronGeometry(0.25, 0), basic(0xa57bff), 64);
    this.bolt2 = instanced(new T.BoxGeometry(0.2, 0.2, 1.4), basic(0xe0e8ff), 48);
    scene.add(this.cards, this.fire, this.lob, this.bolts, this.bolt2);
    this.pk = [gemGeometry(), new T.CylinderGeometry(0.3, 0.3, 0.08, 10), new T.OctahedronGeometry(0.34, 0)].map((geo, i) => {
      const m = i === 0 ? instanced(geo, lambert(0xffffff, { vertexColors: true, emissive: 0x1a5f73 }), CFG.xp.max) : instanced(geo, basic([PICKUP_COLORS.xp, PICKUP_COLORS.coin, PICKUP_COLORS.heart][i]), CFG.xp.max);
      if (i === 0) m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(CFG.xp.max * 3), 3);
      if (i === 1) geo.rotateX(Math.PI / 2); scene.add(m); return m;
    });
    this.btrap = instanced(new T.BoxGeometry(1.2, 0.06, 1.7), basic(0x8a3ad8), 8); scene.add(this.btrap);

    // telegraphs and effects (flat, drawn on the ground)
    const ghost = c => basic(c, WARN(Object.assign({ transparent: true, opacity: 0.5, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 })));       // pulled toward the lens so a flat warning does not sink into a 20 cm bump of the designed ground
    this.teleLine = instanced(new T.BoxGeometry(1, 0.05, 1), ghost(0xffffff), 64); this.teleLine.instanceColor = new T.InstancedBufferAttribute(new Float32Array(64 * 3), 3);
    this.teleDisc = instanced(flat(new T.CircleGeometry(1, 28)), ghost(0xffffff), 128); this.teleDisc.instanceColor = new T.InstancedBufferAttribute(new Float32Array(128 * 3), 3);
    this.fxRing = instanced(flat(new T.RingGeometry(0.82, 1, 28)), ghost(0xffffff), 64); this.fxRing.instanceColor = new T.InstancedBufferAttribute(new Float32Array(64 * 3), 3);
    this.teleRing = instanced(flat(new T.RingGeometry(0.955, 1, 40)), ghost(0xffffff), 64); this.teleRing.instanceColor = new T.InstancedBufferAttribute(new Float32Array(64 * 3), 3);       // the thin pale outline of a blast circle
    for (const m of [this.teleLine, this.teleDisc, this.fxRing, this.teleRing]) m.layers.enable(3);       // layer 3 = enemy warnings: the Tablebreak priority mask draws only these
    scene.add(this.teleLine, this.teleDisc, this.fxRing, this.teleRing);
    // soft contact shadows: a dark radial blob under the duelist, summons and swarm enemies (cheap: one instanced quad, no shadow maps)
    { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(30,18,8,0.62)'); gr.addColorStop(0.45, 'rgba(30,18,8,0.52)'); gr.addColorStop(0.8, 'rgba(30,18,8,0.18)'); gr.addColorStop(1, 'rgba(30,18,8,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
      const tx = new T.CanvasTexture(cv); this.shadow = instanced(flat(new T.PlaneGeometry(2, 2)), new T.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), CFG.enemy.max + 16); scene.add(this.shadow); }
    this.own = new OwnEffects(scene);       // the player's ground areas (rings, fans) through the own-effect material: ink rule, solid rim, keyhole, governor (view/ownfx.js)
    this.ribbon = new Ribbon(scene);       // the rune bolts of the Spellcaster summons: the lightning ribbon, one draw (view/ribbon.js)
    this.fans = new Map();                                       // one mesh per arc angle, made on demand
    this.sand = null; this.sandR = -1;
    this.puffs = [];
  }

  // an own effect takes its colour from the effect ramp by the element the sim names (bright tone); with no element it is the neutral card tone, never gold, XP cyan or violet, except a summon or seal effect, which keeps its violet
  _ownHex(o) { if (o.el && RAMP[o.el]) return ownColour(o.el); const c = o.color || 0, r = (c >> 16) & 255, gg = (c >> 8) & 255, b = c & 255; return (b > 200 && r > 120 && r < 230 && gg < 170) ? c : 0xf3e3c2; }
  // the hit flash takes the hitting element's bright tone (peak mix 0.6, never pure white); a hit with no element flashes the neutral card tone. The view learns the element from the hit event (the sim sends only the flags).
  // Death looks (spectacle spec 3.0): the kill event carries no element, but the hit that caused it was reported just before it, so the last hits of the frame (x, z, element mask) are kept and the nearest one names the element.
  // A fire kill leaves a ghost body that burns away bottom-up as a 6 step screen-door; a lightning kill leaves a 2 frame flat ink silhouette with a pale outline. View only: the pool of 48 is drawn in the enemy's own instanced mesh, so no extra draw.
  corpse(kind, x, z) {
    const H = this._hits; if (!H || !H.length) return; let best = -1, bd = 16; for (let i = 0; i < H.length; i += 3) { const dx = H[i] - x, dz = H[i + 1] - z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = i; } }
    if (best < 0) return; const el = H[best + 2], type = (el & 1) ? 7 : (el & 2) ? 8 : 0; if (!type) return;       // bit 0 fire, bit 1 lightning
    this.sig.note(type === 7 ? 'fire' : 'lightning', this.fx.tick, x, z);
    const e = this.lastEn; if (!e) return; let face = 0, size = 1, y = NaN; for (let i = 0; i < e.max; i++) if (!e.alive[i] && e.x[i] === x && e.z[i] === z && e.kind[i] === kind) { face = e.face[i]; size = e.size[i]; y = e.y[i]; break; } if (y !== y) return;
    const P = this.corpses || (this.corpses = []), c = { kind, x, y, z, face, size, type, t: 0, seed: Math.random() };
    if (P.length >= 48) P.shift(); P.push(c);
  }
  _corpses(dt, counts) {
    const P = this.corpses; if (!P || !P.length) return; const d = this.d;
    for (let n = P.length - 1; n >= 0; n--) {
      const c = P[n], dur = c.type === 7 ? 0.5 : 0.267; c.t += dt; if (c.t >= dur) { P.splice(n, 1); continue; }       // lightning: the ink silhouette holds 4 frames (67 ms), then cracks into 4 falling shards over 200 ms
      const k = this.kinds[c.kind], K = k.K, idx = counts[c.kind]; if (idx >= CFG.enemy.max) continue;
      const sc = K.id === 5 ? SC_SCARAB : K.scale, mg = c.size;
      d.position.set(c.x, c.y + (K.id === 3 ? 0.7 : K.id === 2 ? 1.2 : 0.85), c.z); d.rotation.set(0, c.face, 0); d.scale.set(sc[0] * mg, sc[1] * mg, sc[2] * mg); d.updateMatrix();
      k.body.setMatrixAt(idx, d.matrix); k.body.setColorAt(idx, k.base);
      const step = c.type === 7 ? Math.floor(c.t / dur * 6) / 6 : (c.t < 0.067 ? 0 : 1), o3 = idx * 4, fa = k.fxArr;
      if (c.type === 8 && step === 1 && !c.cracked) { c.cracked = true; this.fx.burstEl(c.x, c.y + 0.9, c.z, 4, 2, 2.2, 1.2, 0.8, 0.22, 20); }
      fa[o3] = step; fa[o3 + 1] = 0; fa[o3 + 2] = c.seed; fa[o3 + 3] = c.type; k.fs += (idx + 1) * (7 + step * 31 + c.type); k.cs += (idx + 1) * 5; k.fxNow = true;
      if (k.eye) { d.position.set(c.x, c.y + 1.05, c.z); d.scale.set(0.001, 0.001, 0.001); d.updateMatrix(); k.eye.setMatrixAt(idx, d.matrix); }
      counts[c.kind]++;
    }
  }
  // Signature moments (spec 3.0): Cinder Card (fire) and Sky Seal (lightning), on a spike of kills (view/signature.js). World parts only: the card goes through the own-effect material, the seal through the lightning ribbon;
  // the screen parts (hit-stop 80 / 100 ms, one flash at the landing, one 2-tone impact frame) go through the director as a class B moment, so a moment that loses the screen still draws its world part. The impact frame is chosen from sim ticks.
  _signatures(g, dt, tier) {
    const fx = this.fx, hit = this.ownCtx ? this.sig.check(fx.tick, tier >= 2, fx.blocked) : null;
    if (hit) {
      const gm = fx.moment('sig-' + hit.el, 'B', { hitstop: hit.el === 'fire' ? 0.08 : 0.10 });
      if (gm.world) this.sigRun.push({ el: hit.el, x: hit.x, z: hit.z, y: g.p.y, t: 0, bolts: 0, cards: 0, screen: gm.screen, impactTick: fx.tick + (hit.el === 'fire' ? 4 : 12) });
      (this.sigLog || (this.sigLog = [])).push([fx.tick, hit.el, gm.screen, gm.world]);
    }
    const R = this.sigRun, rb = this.ribbon, SEG = (x, y, z, x2, y2, z2, w, seed, dur, amp) => rb.see({ x, y, z, x2, y2, z2, w, seed, dur, amp, t: 0, el: 'lightning' });
    for (let n = R.length - 1; n >= 0; n--) {
      const s = R[n]; s.t = this.sigHold !== undefined ? this.sigHold : s.t + dt; if (s.t >= (s.el === 'fire' ? 6 : 4)) { R.splice(n, 1); continue; }
      if (!s.impacted && fx.tick >= s.impactTick) { s.impacted = true; if (s.screen && !fx.rm_) this.impactFrame = s.el; }       // one frame, 2 tones, skipped when Reduce motion is on
      if (s.el === 'fire') {
        // a card rectangle (5 by 7) laid on the ground with a dark border line and, at first, the lava cracks inside; the flame wall rises along its four edges 40 m tall and burns away from the bottom up over 0.8 s; embers fall for 2 s more
        const oc = ownColour('fire'), sx = 6, sz = 8.4;
        this.own.card(s.x, s.y, s.z, sx, sz, 0x6b3a18, s.t < 0.9 ? 1 : 0, 0, 0);
        if (s.t < 0.8) this.own.wall(s.x, s.y, s.z, 7.2, 40, oc, s.t / 0.8, 0, sx, sz);
        if (s.t < 2.8) for (let k = Math.min(6, Math.floor(dt * 140 + Math.random())); k > 0; k--) { const a = Math.random() * 6.2832, c = Math.cos(a), sn = Math.sin(a), m = Math.max(Math.abs(c) / sx, Math.abs(sn) / sz); this.fx.sparkEl(s.x + c / m * 0.95, s.y + 6 + Math.random() * 28, s.z + sn / m * 0.95, (Math.random() - 0.5) * 1.5, -(3 + Math.random() * 3), (Math.random() - 0.5) * 1.5, 0, 0.2 + Math.random() * 0.12, 1.6); }
      } else {
        // the seal is ruler-straight: an exact hexagon of six thick segments drawn corner to corner in order over 6 frames, four clean card rectangles with one diagonal stroke each, each snapping on with a 1-frame bright fill;
        // then the trunk (wide at the top, jagged, three side branches), the gated flash at the landing and a six-pointed star on the ground that fades over 2 s
        const cx = s.x, cz = s.z, py = s.y + 30, hx = [], FR = 1 / 60;
        for (let i = 0; i < 6; i++) hx.push(cx + Math.cos(i / 6 * 6.2832) * 14, cz + Math.sin(i / 6 * 6.2832) * 14);
        while (s.bolts < Math.min(6, Math.floor(s.t / FR) + 1)) { const i = s.bolts++, j = (i + 1) % 6; SEG(hx[i * 2], py, hx[i * 2 + 1], hx[j * 2], py, hx[j * 2 + 1], 1.3, 7 + i, 1.4, 0); }
        const t0 = 0.12;
        while (s.cards < 4 && s.t >= t0 + s.cards * 0.04) { const k = s.cards++, a = 0.7854 + k * 1.5708, ux = Math.cos(a), uz = Math.sin(a), vx = -uz, vz = ux, mx = cx + ux * 6.5, mz = cz + uz * 6.5, cn = [[-1.5, -2.1], [1.5, -2.1], [1.5, 2.1], [-1.5, 2.1]], P = q => [mx + ux * q[0] + vx * q[1], mz + uz * q[0] + vz * q[1]];
          for (let e = 0; e < 4; e++) { const p0 = P(cn[e]), p1 = P(cn[(e + 1) % 4]); SEG(p0[0], py, p0[1], p1[0], py, p1[1], 0.8, 31 + k * 5 + e, 1.2, 0); }
          const d0 = P(cn[0]), d1 = P(cn[2]); SEG(d0[0], py, d0[1], d1[0], py, d1[1], 0.8, 31 + k * 5 + 4, 1.2, 0); }
        for (let k = 0; k < 4; k++) { const tk = t0 + k * 0.04; if (s.t >= tk && s.t < tk + 0.02) { const a = 0.7854 + k * 1.5708; this.own.card(cx + Math.cos(a) * 6.5, py, cz + Math.sin(a) * 6.5, 1.5, 2.1, RAMP.lightning[0], 1, 1, a); } }
        if (s.t >= 0.3 && !s.trunk) {
          s.trunk = true; SEG(cx, py + 40, cz, cx, s.y, cz, 2.2, 99, 0.9, 1);
          for (let b = 0; b < 3; b++) { const h = [py + 24, py + 6, py - 12][b], sd = b % 2 ? -1 : 1; SEG(cx, h, cz, cx + sd * (7 + b * 2), h - 9, cz + (b - 1) * 5, 0.9, 120 + b, 0.7, 1); }
          this.fx.burstEl(cx, s.y + 0.5, cz, 24, 2, 8, 8, 0.4, 0.5, 14); this.fx.flash(0.4, RAMP.lightning[1]);
          const T0 = [90, 210, 330], T1 = [270, 30, 150], P = (d, r) => [cx + Math.cos(d * Math.PI / 180) * r, cz + Math.sin(d * Math.PI / 180) * r];
          for (const T of [T0, T1]) for (let i = 0; i < 3; i++) { const p0 = P(T[i], 5), p1 = P(T[(i + 1) % 3], 5); SEG(p0[0], s.y + 0.25, p0[1], p1[0], s.y + 0.25, p1[1], 0.8, 140 + i, 2.0, 0); }
        }
      }
    }
  }  hitAt(x, z, flags) { const el = flags >> 1; if (el) { const H = this._hits || (this._hits = []); if (H.length < 900) H.push(x, z, el); } const e = this.lastEn; if (!e) return; const ROW = [[1, 0], [2, 2], [4, 1], [8, 3], [16, 4], [32, 5], [64, 6], [128, 7]]; let row = -1; for (const [bit, r] of ROW) if (el & bit) { row = r; break; } let best = -1, bd = 1.44; for (let i = 0; i < e.max; i++) { if (!e.alive[i]) continue; const dx = e.x[i] - x, dz = e.z[i] - z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = i; } } if (best >= 0) this.hitRow[best] = row; }
  _flashCol(i, base, boost) { const r = this.hitRow[i]; return this._fc.copy(base).lerp(r >= 0 ? this.flashBright[r] : this.flashNeutral, 0.6).multiplyScalar(boost || 1); }
  // Reach look tiers (spec 1.4): at +50% and +100% an own area effect steps up a tier: a thicker rim (ownfx), particles along its edge, and a lingering ground ring. The footprint is always the true sim size. The tier effects play once per effect record (a restarted pooled record counts as new).
  _tierFx(o, tier) {
    const prev = this._tierSeen.get(o); this._tierSeen.set(o, o.t); if (prev !== undefined && o.t >= prev) return; const el = o.el, row = ({ fire: 0, ice: 1, lightning: 2, poison: 3, wind: 4, earth: 5, light: 6, dark: 7 })[el], fx = this.fx, n = 14 * tier, hex = this._ownHex(o), arc = o.type === 'fan' ? (o.arc || 360) * Math.PI / 360 : Math.PI, ang0 = o.type === 'fan' ? Math.atan2(o.dz, o.dx) : 0;
    for (let k = 0; k < n; k++) { const a = o.type === 'fan' ? ang0 - arc + (k / (n - 1)) * arc * 2 : (k / n) * 6.2832, x = o.x + Math.cos(a) * o.r, z = o.z + Math.sin(a) * o.r; if (row !== undefined) fx.sparkEl(x, o.y + 0.3, z, Math.cos(a) * 1.5, 2.2 + tier, Math.sin(a) * 1.5, row, 0.14, 0.55); else fx.spark(x, o.y + 0.3, z, Math.cos(a) * 1.5, 2.2 + tier, Math.sin(a) * 1.5, hex, 0.14, 0.55); }
    fx.ring(o.x, o.y + 0.05, o.z, o.r, hex, 0.5 + 0.4 * tier);
  }
  // Growth through the tiers is measured in claimed screen share, not fill (the ink rule keeps painted-over fill near 5%): Tier 2 leaves ground marks that last 8 s (the stain map holds the 6 newest), Tier 3 adds knee-to-waist rims of the
  // element's silhouette on the edge of every round area, Tier 4 makes them mid-height walls (a third of the Tier 5 height) and tints the sky at 10%. The footprint is never enlarged: the wall stands on the true rule radius.
  _grow(o, s, rch) {
    if (s < 2 || !(o.r >= 2)) return;
    const el = o.el || 'fire', L = RAMP[el] || RAMP.fire, oc = ownColour(el), ground = el === 'dark' ? [L[0], L[1]] : el === 'ice' ? [L[2], L[0]] : [L[3], oc];
    const prev = this._growSeen.get(o); this._growSeen.set(o, o.t);
    if (prev === undefined || o.t < prev) { const M = this._marks; M.push({ x: o.x, z: o.z, r: Math.min(o.r, STCAP[s]) * STK[s], hex: ground[0], hexK: ground[1], t: 0 }); if (M.length > 6) M.shift(); }
    this._lead = this._lead || el;
    if (s >= 3 && o.type !== 'fan') this.own.wall(o.x, o.y, o.z, o.r, s >= 4 ? (24 + 40 * Math.min(1, rch / 1.5)) / 3 : 1.4, oc, 1, ELEMENTS.indexOf(el));
    if (s >= 4) this._skyLight = true;
  }
  // Tier 5 (spec 1.4): every large own area is stamped into the stain map and gets a hollow giant at its TRUE rule radius, 16 m tall at Reach +0% up to 40 m at +150%, its top rising and falling slowly at 0.5 Hz; the footprint is never enlarged
  _tier5(o, rch) { const el = o.el || 'fire', L = RAMP[el] || RAMP.fire, oc = ownColour(el); this._lead = this._lead || el; const ground = el === "dark" ? [L[0], L[1]] : el === "ice" ? [L[2], L[0]] : [L[3], oc]; this._stains.push({ x: o.x, z: o.z, r: Math.min(o.r, STCAP[5]) * STK[5], hex: ground[0], hexK: ground[1] }); const h = 24 + 40 * Math.min(1, rch / 1.5) + 1.5 * Math.sin(performance.now() / 1000 * Math.PI); this.own.wall(o.x, o.y, o.z, o.r, h, oc, 1, ELEMENTS.indexOf(el));
    const row = ({ fire: 0, ice: 1, lightning: 2, poison: 3, wind: 4, earth: 5, light: 6, dark: 7 })[el] || 0, dt = Math.min(0.05, this._dt || 0.016), n = Math.min(10, Math.floor(dt * 260 + Math.random()));       // the tongues break off as ember cards and sparks that rise and die
    for (let k = 0; k < n; k++) { const a = Math.random() * 6.2832, x = o.x + Math.cos(a) * o.r, z = o.z + Math.sin(a) * o.r; this.fx.sparkEl(x, o.y + h * (0.05 + Math.random() * 0.5), z, (Math.random() - 0.5) * 2, 3 + Math.random() * 4, (Math.random() - 0.5) * 2, row, 0.18 + Math.random() * 0.14, 1.2 + Math.random()); } }
  // the enemy a chain jump reached gets the crawling outline for 300 ms (the nearest live enemy to the bolt's end point, within 1.5 m)
  _arcAt(g, x, z) { const e = g.en; let best = -1, bd = 2.25; for (let i = 0; i < e.max; i++) { if (!e.alive[i]) continue; const dx = e.x[i] - x, dz = e.z[i] - z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = i; } } if (best >= 0) this.arcT[best] = 0.3; }
  _fan(arc, max) {
    let f = this.fans.get(arc);
    if (!f) {
      const geo = flat(new T.CircleGeometry(1, 20, Math.PI / 2 - arc * Math.PI / 360, arc * Math.PI / 180));
      f = instanced(geo, basic(0xffffff, WARN({ transparent: true, opacity: 0.5, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 })), max || 16);
      f.instanceColor = new T.InstancedBufferAttribute(new Float32Array((max || 16) * 3), 3); f.layers.enable(3); this.scene.add(f); this.fans.set(arc, f);
    }
    return f;
  }

  _monsterMesh(id, form) {
    const A = this.assets;
    let g;
    const size = summonSize(!!FUSIONS[id], form);                      // metres: form 1 / 2 / 3 = 0.5x / 1x / 2x the duelist, Fusions 2x to 3x
    let modelled = true;
    if (id === 'ember-wyvern' && form === 0 && A.wyvernPrep) { const cr = makeCreature(A.wyvernPrep, size); cr.root.rotation.y = Math.PI; g = cr.group; g.userData.crit = cr; modelled = true; }          // rigged and animated: wings beat, tail sways
    else if (id === 'ember-wyvern' && A.wyvern) { g = modelGroup(A.wyvern, size, 'max'); g.userData.fly = true; }
    else if (id === 'cinder-hatchling' && A.hatchling) { g = modelGroup(A.hatchling, size, 'max', 0xff7319); g.userData.walk = true; g.userData.puffs = true; }
    else if (id === 'twinflare-tyrant' && A.tyrant) { g = modelGroup(A.tyrant, size, 'max', 0xff7319); g.userData.fly = true; g.userData.glowPeriod = 1.2; g.userData.breath = true; }
    else if (id === 'rune-apprentice') { g = A.apprentice ? modelGroup(A.apprentice, size, 'y') : PLACEHOLDER[id](); modelled = !!A.apprentice; g.userData.walk = true; this._attachStaff(g, !!A.apprentice, size); }
    else { modelled = false; g = PLACEHOLDER[id](); if (id === 'ember-wyvern' || id === 'twinflare-tyrant') g.userData.fly = true; if (id === 'cinder-hatchling') g.userData.walk = true; }
    g.userData.formIdx = form; g.userData.size = size; g.scale.setScalar(modelled ? 1 : size / 1.4);      // placeholder shapes are about 1.4 m tall at scale 1
    this.scene.add(g); return g;
  }

  // code-built staff in the right hand (the -X hand facing +Z): wood shaft, iron collar with four rivets, blue crystal cube with a cyan spiral rune
  _attachStaff(g, hasModel, bodyH) {
    const staff = new T.Group(), s = hasModel ? g.userData.scale : 1, L = 1.15 * (bodyH || 1.7) / s, u = ((bodyH || 1.7) / 1.7) / s;           // the staff is 1.15 times the figure's height (the crystal top is at most 1.3x), thickness in proportion
    const shaft = new T.Mesh(new T.CylinderGeometry(0.055 * u, 0.065 * u, L, 6), lambert(0x7a4a26)); shaft.position.y = L / 2; staff.add(shaft);
    const collar = new T.Mesh(new T.CylinderGeometry(0.1 * u, 0.1 * u, 0.12 * u, 8), lambert(0x5a5650)); collar.position.y = L; staff.add(collar);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, rv = new T.Mesh(new T.BoxGeometry(0.035 * u, 0.035 * u, 0.035 * u), lambert(0x9a968c)); rv.position.set(Math.cos(a) * 0.105 * u, L, Math.sin(a) * 0.105 * u); staff.add(rv); }
    const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d'); x.fillStyle = '#3a6cff'; x.fillRect(0, 0, 16, 16); x.strokeStyle = '#bff8ff'; x.lineWidth = 1; x.beginPath();
    for (let a = 0; a < 12; a += 0.2) { const r = 0.6 + a * 0.55, px = 8 + Math.cos(a) * r, py = 8 + Math.sin(a) * r; if (a === 0) x.moveTo(px, py); else x.lineTo(px, py); } x.stroke();
    const tex = new T.Texture(c); tex.magFilter = tex.minFilter = T.NearestFilter; tex.needsUpdate = true;
    const crystal = new T.Mesh(new T.BoxGeometry(0.3 * u, 0.3 * u, 0.3 * u), [0, 1, 2, 3, 4, 5].map(f => (f === 4 ? new T.MeshBasicMaterial({ map: tex }) : new T.MeshBasicMaterial({ color: 0x3a6cff }))));
    crystal.position.y = L + 0.26 * u; crystal.rotation.y = 0.3; staff.add(crystal);
    const hand = hasModel ? [-0.325, -0.016, -0.008] : [-0.5 / (hasModel ? 1 : 1), 0.5, 0.1];
    staff.position.set(hand[0], hand[1] - 0.0, hand[2]);
    staff.rotation.z = -0.06;
    (g.userData.root || g).add(staff); g.userData.staff = staff; g.userData.crystal = crystal;
    if (hasModel) { const m0 = g.userData.model, minY = m0.min[1], hh = m0.size.y; g.traverse(o => { if (o.isMesh && o.geometry === m0.solid) { const mat = o.material = o.material.clone(); mat.onBeforeCompile = sh => { sh.uniforms.uSwayT = SWAY_T; sh.uniforms.uSwayMin = { value: minY }; sh.uniforms.uSwayH = { value: hh }; sh.vertexShader = sh.vertexShader.replace('void main() {', 'uniform float uSwayT; uniform float uSwayMin; uniform float uSwayH;\nvoid main() {').replace('#include <begin_vertex>', '#include <begin_vertex>\n{ float f = 1.0 - (position.y - uSwayMin) / (uSwayH * 0.3); if (f > 0.0) transformed.x += sin(uSwayT * 2.0 + position.y * 6.0) * 0.012 * f; }'); }; mat.needsUpdate = true; } }); g.userData.sway = true; }       // the robe sway runs in the vertex shader from one time uniform: no per-frame vertex loop and no upload
  }

  _specialMesh(sp) {
    const g = new T.Group(), r = sp.radius;
    if (sp.kind === 'warden') {
      const body = new T.Mesh(new T.BoxGeometry(1.8, 2.6, 1.4), lambert(BC.warden.body)); body.position.y = 1.3;
      const head = new T.Mesh(new T.BoxGeometry(0.9, 0.8, 0.9), lambert(BC.warden.head)); head.position.y = 3.0;
      const shield = new T.Mesh(new T.BoxGeometry(2.6, 3.0, 0.3), lambert(BC.warden.shield)); shield.position.set(0, 1.6, 1.0);
      g.add(body, head, shield);
    } else if (sp.kind === 'idol') {
      const body = new T.Mesh(new T.OctahedronGeometry(0.95, 0), lambert(BC.idol.body)); body.position.y = 1.0; body.scale.set(0.8, 1.2, 1.4);
      const e1 = cone(0.18, 0.7, BC.idol.ear), e2 = cone(0.18, 0.7, BC.idol.ear); e1.rotation.x = e2.rotation.x = 0; e1.position.set(-0.3, 2.1, 0.5); e2.position.set(0.3, 2.1, 0.5);
      g.add(body, e1, e2);
    } else {
      const robe = new T.Mesh(new T.ConeGeometry(1.5, 4.2, 7), lambert(BC.pharaoh.robe)); robe.position.y = 2.1;
      const head = new T.Mesh(new T.BoxGeometry(0.9, 1.0, 0.9), lambert(BC.pharaoh.head)); head.position.y = 4.5;
      const crown = new T.Mesh(new T.ConeGeometry(0.7, 0.9, 5), lambert(BC.pharaoh.crown)); crown.position.y = 5.3;
      const blade = new T.Mesh(new T.BoxGeometry(0.2, 0.2, 4.2), lambert(BC.pharaoh.blade)); blade.position.set(1.3, 2.6, 2.0);
      g.add(robe, head, crown, blade);
    }
    g.userData.parts = g.children.slice();
    const ref = SCALE.engineRef[sp.kind === 'idol' ? 'idol' : sp.kind], base = (sp.size || ref) / ref; g.userData.base = base; g.scale.setScalar(base);
    if (sp.role === 'elite' || sp.role === 'captain') {                      // elite rim glow: a slightly larger gold back-face shell behind every part
      for (const part of g.userData.parts) { if (!part.geometry) continue; const rim = new T.Mesh(part.geometry, new T.MeshBasicMaterial({ color: 0xffc94a, side: T.BackSide })); rim.position.copy(part.position); rim.rotation.copy(part.rotation); rim.scale.copy(part.scale).multiplyScalar(1.09); g.add(rim); }
    }
    this.scene.add(g); return g;
  }

  _chestMesh() {
    const g = new T.Group();
    const b = new T.Mesh(new T.BoxGeometry(1.6, 1.0, 1.1), lambert(0x7a5a3a)); b.position.y = 0.5;
    const lid = new T.Mesh(new T.BoxGeometry(1.7, 0.4, 1.2), lambert(0x9a7a4a)); lid.position.y = 1.2;
    const s1 = new T.Mesh(new T.OctahedronGeometry(0.25, 0), basic(0xe8c56a)), s2 = s1.clone(); s1.position.set(-0.45, 0.8, 0.62); s2.position.set(0.45, 0.8, 0.62);
    g.add(b, lid, s1, s2); g.userData.seals = [s1, s2]; g.scale.setScalar(SCALE.chest);        // larger than life so it reads from the gameplay camera
    this.scene.add(g); return g;
  }

  // easeOutBack: the summon pop
  _pop(u) { if (u >= 1) return 1; if (u <= 0) return 0; const c1 = 1.9, c3 = c1 + 1, v = u - 1; return 1 + c3 * v * v * v + c1 * v * v; }

  // a monster mesh has just been made: summon pop, or the form-change moment, or the delayed landing of a Fusion
  _enter(mesh, m, formSwap, g, x, z) {
    const ud = mesh.userData, fx = this.fx, y = mesh.position.y; ud.base = mesh.scale.x; ud.lv = m.level; ud.pulse = -9;
    if (this.fusionAt !== undefined && this.vt - this.fusionAt < 0.6) { ud.born = this.fusionAt + 1.0; ud.shock = 1; return; }
    ud.born = this.vt;
    if (formSwap) { fx.moment('formswap', 'A', { flash: 0.55, shake: 0.3 }); fx.ring(x, y, z, 4, 0xffffff, 0.55); fx.ring(x, y, z, 2.4, 0xffd56a, 0.4); fx.burst(x, y + 1, z, 36, 0xffe9a0, 6, 5, 0.3, 0.7, 6); }
    else { fx.ring(x, y, z, 2.4, 0xffd56a, 0.5); fx.burst(x, y + 0.5, z, 18, 0xffd56a, 2.5, 5, 0.22, 0.8, 4); }
  }
  _shock(ud, x, y, z) {
    const fx = this.fx; ud.shock = 0; fx.moment('arrival', 'A', { flash: 0.65, shake: 0.7 }); fx.ring(x, y, z, 9, 0xffffff, 0.7); fx.ring(x, y, z, 5, 0xffb060, 0.5); fx.burst(x, y + 1, z, 60, 0xfff0c0, 9, 6, 0.32, 0.9, 7); fx.beam(x, y, z, 0xfff0c0, 0.9);
  }

  update(g, a, cam, head, dt) {
    this._dt = dt;
    dt = dt || 0.016; this.vt += dt;
    const d = this.d, p = g.p, e = g.en, t = g.t, fx = this.fx;
    if (this.fusionAt !== undefined && this.vt - this.fusionAt > 1.8) { this.fusionAt = undefined; }
    // hide anything standing between the camera and the duelist's head, or right at the camera
    const sx = head.x - cam.x, sy = head.y - cam.y, sz = head.z - cam.z, sl2 = sx * sx + sy * sy + sz * sz || 1;
    const blocked = (x, y, z, r) => {
      const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z; let u = (dx * sx + dy * sy + dz * sz) / sl2;
      if (u < -0.02 || u > 0.97) return dx * dx + dy * dy + dz * dz < 3 * 3;
      if (u > 0.84) return false;                                // enemies right at the duelist stay visible
      u = Math.max(0, u); const qx = dx - sx * u, qy = dy - sy * u, qz = dz - sz * u;
      return qx * qx + qy * qy + qz * qz < r * r;
    };

    // duelist
    const px = pl(p.px, p.x, a), py = pl(p.py, p.y, a), pz = pl(p.pz, p.z, a);
    this.player.position.set(px, py, pz);
    { const want = turnLerp(p.pface, p.face, a); if (this._by === undefined || g.t < 0.1) this._by = want; let d = want - this._by; d -= Math.PI * 2 * Math.round(d / (Math.PI * 2)); this._by += Math.max(-1, Math.min(1, d)) * Math.min(1, dt * 14) * (Math.abs(d) > 0.02 ? 1 : 0) + (Math.abs(d) <= 0.02 ? d : 0); this.player.rotation.y = this._by; }       // the body turns to the move direction over about 0.1 s, never a snap
    this.player.userData.body.scale.y = p.sliding ? 0.55 : 1; this.player.rotation.x = p.sliding ? -0.5 : 0;
    this.player.visible = !(g.over && !g.won); this.player.scale.setScalar(g.oaths.small ? 0.5 : 1);                 // Small Oath: half size
    { const want = this.rigs[g.duelist] || null; if (want !== this.rig) { if (this.rig) this.rig.group.visible = false; this.rig = want; if (want) want.group.visible = true; } }       // the rig of the duelist being played; the others sleep (no mixer work)
    if (this.rig) {
      const R = this.rig, ct = g.cardT, thrown = this._ct !== undefined && ct > this._ct + 0.01; this._ct = ct;
      R.group.position.copy(this.player.position); R.group.rotation.order = 'YXZ'; R.group.rotation.y = this.player.rotation.y + R.yaw; { const yr = this._yr = (this._yr || 0) + (((this._ly === undefined ? this.player.rotation.y : this._ly) - this.player.rotation.y) / Math.max(dt, 0.004) - (this._yr || 0)) * Math.min(1, dt * 10); this._ly = this.player.rotation.y; const dy = Math.max(-2.5, Math.min(2.5, yr)); R.group.rotation.z = p.grounded && !p.sliding && !fx.rm_ ? Math.max(-0.2, Math.min(0.2, (dy > 0 ? Math.max(0, dy - 0.5) : Math.min(0, dy + 0.5)) * 0.1)) * Math.min(1, Math.hypot(p.vx || 0, p.vz || 0) / 5) : 0; }       // a sharp turn at speed banks the body into it, up to 11 degrees R.group.scale.setScalar(g.oaths.small ? 0.5 : 1); this.player.visible = false;
      R.update(p, g, dt, thrown);
      if (thrown && g.aimX !== undefined) { const ay = Math.atan2(g.aimX - p.x, g.aimZ - p.z); if (!(this._aimT > 0)) this._aimYs = ay; this._aimY = ay; this._aimT = 0.9; }       // one aim, followed slowly while throws keep coming, faded out over 0.4 s after the last
      let tw = 0; if (this._aimT > 0) { this._aimT -= dt; let da = this._aimY - this._aimYs; da -= Math.PI * 2 * Math.round(da / (Math.PI * 2)); this._aimYs += da * Math.min(1, dt / 0.3); let d = this._aimYs - this.player.rotation.y; d -= Math.PI * 2 * Math.round(d / (Math.PI * 2)); tw = Math.max(-0.785, Math.min(0.785, d)) * Math.min(1, Math.max(0, this._aimT) / 0.4); }       // torso aim at the throw target, capped at 45 degrees
      this._tw = (this._tw || 0) + (tw - (this._tw || 0)) * Math.min(1, dt / 0.3); R.twist(this._tw);
    }
    {   // lean into movement, landing squash, dash trail, slide dust
      const ud = this.player.userData, lean = ud.lean, sp = Math.sqrt((p.vx || 0) * (p.vx || 0) + (p.vz || 0) * (p.vz || 0));
      const want = p.sliding || fx.rm_ ? 0 : Math.min(0.28, sp * 0.03);
      lean.rotation.x += (want - lean.rotation.x) * Math.min(1, dt * 12);
      if (!p.grounded) this._pvy = p.vy;
      if (p.grounded && !this._pg && this._pvy < -5) { ud.squash = 0.16; fx.burst(px, py + 0.1, pz, 8, 0xd8c08a, 2.2, 1.2, 0.22, 0.5, 6); if (this._pvy < -9) { fx.shake(Math.min(0.22, -this._pvy * 0.012)); fx.ring(px, py + 0.05, pz, 1.3, 0xd8c08a, 0.18); fx.burst(px, py + 0.1, pz, 14, 0xd8c08a, 3.2, 1.6, 0.3, 0.6, 8); } }       // a heavy landing kicks the camera and throws a ring of dust
      if (p.dashT > 0 && !this._pd) { fx.shake(0.07); fx.ring(px, py + 0.05, pz, 1.0, 0x9fe8ff, 0.14); }       // dash start
      this._pd = p.dashT > 0;
      this._pg = p.grounded;
      if (ud.squash > 0) { ud.squash = Math.max(0, ud.squash - dt); const k = ud.squash / 0.16 * 0.28; lean.scale.set(1 + k * 0.5, 1 - k, 1 + k * 0.5); } else if (lean.scale.y !== 1) lean.scale.set(1, 1, 1);
      if (p.dashT > 0) for (let k = 0; k < 2; k++) fx.spark(px + (Math.random() - 0.5) * 0.4, py + 0.4 + Math.random() * 1.0, pz + (Math.random() - 0.5) * 0.4, 0, 0.3, 0, 0x9fe8ff, 0.4, 0.3);
      else if (p.sliding && Math.random() < 0.7) fx.spark(px, py + 0.1, pz, (Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2, 0xc9b184, 0.25, 0.4);
    }

    // monsters on the field
    const live = this._live || (this._live = new Set()); live.clear();
    g.field.monsters.forEach((m, k) => {
      if (!m) return; live.add(m);
      let mesh = this.monsters.get(m); const form = formOf(m.id, m.level);
      let formSwap = false;
      if (mesh && mesh.userData.formIdx !== form) { this.scene.remove(mesh); mesh = null; formSwap = true; }          // crossing level 5 or 10 swaps the model
      const x = pl(m.px, m.x, a), z = pl(m.pz, m.z, a);
      if (!mesh) { mesh = this._monsterMesh(m.id, form); this.monsters.set(m, mesh); mesh.position.set(x, heightGround(x, z), z); this._enter(mesh, m, formSwap, g, x, z); }
      let y = pl(m.py, m.y, a);
      const ud = mesh.userData;
      if (ud.walk) y = heightGround(x, z) + Math.abs(Math.sin(t * 7 + k)) * 0.08;      // the Hatchling walks beside you
      else y += 0;
      mesh.position.set(x, y, z);
      const tgt = g.faceOf[m.id];
      const wantFace = tgt !== undefined && t - (g.faceT || 0) < 3 ? tgt : Math.atan2(p.x - x, p.z - z) + Math.PI;
      mesh.rotation.y = turnLerp(mesh.rotation.y, wantFace, 0.2);
      if (ud.crit) {                                                        // a rigged creature plays its own clips: arrive when summoned, attack when its cooldown restarts, else it hovers
        let trig = null; if (!ud.arrived && this.vt >= ud.born) { ud.arrived = true; trig = 'arrive'; }
        if (m.cd > (m._lastCdV || 0) + 0.2) trig = 'attack';
        ud.crit.update('fly', dt, trig);
      }
      if (ud.fly) { mesh.rotation.z = Math.sin(t * 5 + k) * 0.18; mesh.rotation.x = Math.sin(t * 3.3 + k) * 0.08; mesh.position.y += Math.sin(t * 4 + k) * 0.08; }
      if (ud.walk) mesh.rotation.z = Math.sin(t * 7 + k) * 0.06;
      if (m.cd > (m._lastCdV || 0) + 0.2) { m._atkAt = t; if (ud.breath) this._breath(mesh, m, g); }
      m._lastCdV = m.cd;
      if (ud.glow) { const per = ud.glowPeriod || 1.6, lo = ud.glowPeriod ? 0.6 : 0.7, atk = t - (m._atkAt || -9) < 0.3 ? 0.5 : 0; ud.glow.material.color.setRGB(1, 0.45, 0.1).multiplyScalar(Math.min(1.5, lo + (1 - lo) * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 / per)) + atk)); }
      if (ud.staff) {                                                   // idle bob, robe sway, staff raises on cast
        const cast = t - (g.castAt || -9) < 0.3; ud.staff.rotation.x = cast ? -0.7 : 0; mesh.position.y += Math.sin(t * Math.PI * 2 * 0.6) * 0.02;
        if (ud.sway) SWAY_T.value = t;
      }
      if (ud.puffs) this._emitPuffs(mesh, m, g);
      // summon pop, attack squash and stretch, level-up pulse
      const su = this._pop((this.vt - ud.born) / 0.45); mesh.visible = this.vt >= ud.born && !blocked(x, y + ud.size * 0.5, z, ud.size * 0.5);      // a big summon never hides the duelist
      if (ud.shock && this.vt >= ud.born) this._shock(ud, x, y, z);
      let sxz = 1, sy = 1; const as = t - (m._atkAt || -9);
      if (as >= 0 && as < 0.1) { const k = 1 - as / 0.1; sxz = 1 + 0.14 * k; sy = 1 - 0.16 * k; } else if (as >= 0.1 && as < 0.22) { const k = 1 - (as - 0.1) / 0.12; sxz = 1 - 0.08 * k; sy = 1 + 0.12 * k; }
      if (m.level > ud.lv) { ud.lv = m.level; ud.pulse = this.vt; fx.ring(x, y, z, 2.6, 0xc9a3ff, 0.45); fx.burst(x, y + 0.8, z, 14, 0xd9b8ff, 2, 4, 0.2, 0.7, 3); }
      const pu = this.vt - ud.pulse; if (pu >= 0 && pu < 0.35) { const k = Math.sin(pu / 0.35 * Math.PI) * 0.18; sxz += k; sy += k; }
      if (fx.rm_) { sxz = 1; sy = 1; }
      const half = g.oaths.small ? 0.5 : 1;
      mesh.scale.set(ud.base * sxz * su * half, ud.base * sy * su * half, ud.base * sxz * su * half);
    });
    for (const [m, mesh] of this.monsters) if (!live.has(m)) {
      this.monsters.delete(m);
      if (this.fusionAt !== undefined && this.vt - this.fusionAt < 0.6) { mesh.userData.g0 = this.vt; mesh.userData.sx = mesh.position.x; mesh.userData.sz = mesh.position.z; this.ghosts.push(mesh); this._ghostFresh = true; }
      else this.scene.remove(mesh);
    }
    this._updateGhosts();
    this._updatePuffs(g.t, cam); this._updateFlames(g.t);

    // Toll Shades
    { let n = 0; const sk = SCALE.shade.h / 3.4;
      for (const s of g.shades) {
        const x = pl(s.px, s.x, a), y = lerp(s.py, s.y, a), z = pl(s.pz, s.z, a), age = g.t - s.born, rise = Math.min(1, age / 0.7), bob = Math.sin(t * 2 + n) * 0.15;
        d.position.set(x, y + 1.5 * sk * rise - (1 - rise) * 2, z); d.rotation.set(0, s.face, 0); d.scale.set(sk, sk * rise, sk); d.updateMatrix(); this.shadeBody.setMatrixAt(n, d.matrix);
        d.position.set(x, y + 3.2 * sk * rise + bob * 0.3 - (1 - rise) * 2, z); d.scale.set(sk, sk * rise, sk); d.updateMatrix(); this.shadeHood.setMatrixAt(n, d.matrix);
        d.position.set(x + Math.sin(s.face) * 0.35 * sk, y + 2.9 * sk * rise + bob * 0.3 - (1 - rise) * 2, z + Math.cos(s.face) * 0.35 * sk); d.scale.set(sk, sk, sk); d.updateMatrix(); this.shadeEye.setMatrixAt(n, d.matrix);
        d.position.set(x - Math.cos(s.face) * 0.95 * sk, y + 1.5 * sk * rise + Math.sin(t * 5 + n) * 0.08 - (1 - rise) * 2, z + Math.sin(s.face) * 0.95 * sk); d.rotation.set(0, s.face, Math.sin(t * 5 + n) * 0.5); d.scale.set(sk, sk, sk); d.updateMatrix(); this.shadeBell.setMatrixAt(n, d.matrix);
        if (Math.random() < dt * 1.5) fx.spark(x, y + 2.5, z, 0, 0.6, 0, 0xc07bff, 0.18, 0.6);
        n++;
      }
      for (const mm of [this.shadeBody, this.shadeHood, this.shadeEye, this.shadeBell]) { mm.count = n; mm.instanceMatrix.needsUpdate = true; }
    }
    // swarm
    this.lastEn = e; this._dustBudget = 4; const counts = this._counts || (this._counts = this.kinds.map(() => 0)); counts.fill(0); for (const kk of this.kinds) { kk.fxNow = false; kk.cs = 0; kk.fs = 0; } const mc = this._mc || (this._mc = { n: 0 }); mc.n = 0; let cc = 0;
    for (let i = 0; i < e.max; i++) {
      if (!e.alive[i]) { this._wasSwarm[i] = 0; continue; }
      if (!this._wasSwarm[i]) { this._wasSwarm[i] = 1; this.spawnAge[i] = 0; if (this._dustBudget > 0) { this._dustBudget--; fx.burst(e.x[i], e.y[i] + 0.1, e.z[i], 3, 0xb09a6a, 1.5, 1.5, 0.2, 0.45, 5); } }
      this.spawnAge[i] += dt; const sage = this.spawnAge[i], rise = sage < 0.35 ? 1 - sage / 0.35 : 0;
      const k = this.kinds[e.kind[i]], K = k.K, n = counts[e.kind[i]];
      const x = pl(e.px[i], e.x[i], a), y = pl(e.py[i], e.y[i], a), z = pl(e.pz[i], e.z[i], a);
      if (blocked(x, y + 0.9, z, 2.4)) continue;
      const hit = e.flash[i] > 0; let bob; if (K.fly) bob = Math.sin(t * 9 + i) * 0.08; else { const bp = this._bp || (this._bp = new Float32Array(e.max * 3)), j3 = i * 3; if (sage < 0.02) { bp[j3] = i; bp[j3 + 1] = x; bp[j3 + 2] = z; } const spd = Math.min(14, Math.hypot(x - bp[j3 + 1], z - bp[j3 + 2]) / Math.max(dt, 0.004)); bp[j3 + 1] = x; bp[j3 + 2] = z; bp[j3] += spd / 1.3 * dt * Math.PI; bob = Math.abs(Math.sin(bp[j3])) * 0.15 * Math.min(1, spd / 1.5); }       // the hop follows ground speed (one hop per 1.3 m), and stops when the enemy stands
      let sc = K.scale, pulse = 1; if (K.id === 5) sc = SC_SCARAB;       // the Tomb Scarab is drawn 1.3x so it can be picked out of a crowd (the sim hitbox is unchanged)
      if (K.id === 4 && e.st[i] === 1) pulse = 1 + 0.25 * Math.sin(t * 30);                        // Sand Bloat swelling before it bursts
      const face = turnLerp(e.pface[i], e.face[i], a);
      const grow = 1 - rise * 0.6;
      d.position.set(x, y + (K.id === 3 ? 0.7 : K.id === 2 ? 1.2 : 0.85) + bob - rise * 1.1, z); d.rotation.set(hit && !fx.rm_ ? 0.32 : 0, face, 0);
      const mgs = e.size[i];                                                    // merged past the cap: bigger, up to 1.5x
      d.scale.set(sc[0] * pulse * grow * mgs * (hit ? 1.2 : 1), sc[1] * pulse * grow * mgs * (hit ? 0.85 : 1), sc[2] * pulse * grow * mgs * (hit ? 1.2 : 1)); d.updateMatrix();
      k.body.setMatrixAt(n, d.matrix); k.body.setColorAt(n, hit ? this._flashCol(i, e.ace[i] ? this.aceCol : k.base, k.boost) : (e.ace[i] ? this.aceCol : k.base)); if (hit) k.cs += (n + 1) * (7 + this.hitRow[i] + 3); else { this.hitRow[i] = -1; if (e.ace[i]) k.cs += (n + 1) * 3; }
      { const bn = e.burn[i]; let bf = 0; if (bn > 0) { if (this.burnMax[i] < bn) this.burnMax[i] = bn; const bm = this.burnMax[i]; bf = Math.max(0.02, Math.min(1, (bm - bn) / 0.4 + 0.02, bn / (0.35 * bm))); } else this.burnMax[i] = 0;
        let ar = 0; if (this.arcT[i] > 0) { this.arcT[i] -= dt; ar = 1; } const fa = k.fxArr, o3 = n * 4, lc = this.labStatus[i]; fa[o3] = bf; fa[o3 + 1] = ar; fa[o3 + 2] = (i * 0.6180339) % 1; fa[o3 + 3] = lc; k.fs += (n + 1) * (bf * 13 + ar * 7 + lc * 3); if (bf > 0 || ar > 0 || lc > 0) k.fxNow = true; }
      if (k.eye) {
        d.position.set(x + Math.sin(face) * 0.62 * sc[0], y + 1.05 + bob, z + Math.cos(face) * 0.62 * sc[0]); d.scale.set(1, 1, 1); d.updateMatrix(); k.eye.setMatrixAt(n, d.matrix);
      }
      counts[e.kind[i]]++;
      if (e.ace[i] && cc < 24) { d.position.set(x, y + 2.1 * mgs + 0.4 + Math.sin(t * 3 + i) * 0.08, z); d.rotation.set(0, t * 2.4 + i, 0); d.scale.set(1, 1.5, 1); d.updateMatrix(); this.crests.setMatrixAt(cc++, d.matrix); }
      if (e.mark[i] > 0) { d.position.set(x, y + 2.3 + Math.sin(t * 4) * 0.1, z); d.rotation.set(0, t * 3, 0); d.scale.set(1, 1.4, 1); d.updateMatrix(); this.marks.setMatrixAt(mc.n++, d.matrix); }
    }
    this._corpses(dt, counts); if (this._hits) this._hits.length = 0;
    this.kinds.forEach((k, i) => { k.body.count = counts[i]; k.body.instanceMatrix.needsUpdate = true; if (k.cs !== k.csPrev || counts[i] !== k.cPrev) k.body.instanceColor.needsUpdate = true; k.csPrev = k.cs; k.cPrev = counts[i]; { const a = k.body.geometry.attributes.aFx; if ((k.fxNow || k.fxPrev) && (k.fs !== k.fsPrev || counts[i] !== k.fcPrev || k.fxNow !== k.fxPrev)) { a.updateRange.offset = 0; a.updateRange.count = counts[i] * 4; a.needsUpdate = true; } k.fsPrev = k.fs; k.fcPrev = counts[i]; k.fxPrev = k.fxNow; } if (k.eye) { k.eye.count = counts[i]; k.eye.instanceMatrix.needsUpdate = true; } });
    this.marks.count = mc.n; this.marks.instanceMatrix.needsUpdate = true; this.crests.count = cc; this.crests.instanceMatrix.needsUpdate = true;

    // elites and the boss
    const spLive = this._spLive || (this._spLive = new Set()); spLive.clear();
    for (const sp of g.sp) {
      if (!sp.alive) continue; spLive.add(sp);
      let mesh = this.specials.get(sp); if (!mesh) { mesh = this._specialMesh(sp); mesh.traverse(o => { if (o.material && !o.material._seeActor) { o.material._seeActor = true; seeActor(o.material); } }); this.specials.set(sp, mesh); mesh.userData.born = this.vt; fx.ring(sp.x, sp.y, sp.z, 5, 0xe8b84a, 0.7); fx.burst(sp.x, sp.y + 1, sp.z, 24, 0xe8b84a, 4, 6, 0.3, 0.8, 6); fx.moment('special', 'B', { shake: 0.25 }); }
      mesh.scale.setScalar((0.3 + 0.7 * this._pop((this.vt - mesh.userData.born) / 0.6)) * mesh.userData.base);
      const x = pl(sp.px, sp.x, a), y = pl(sp.py, sp.y, a), z = pl(sp.pz, sp.z, a);
      mesh.position.set(x, y, z); mesh.rotation.y = turnLerp(sp.pface, sp.face, a);
      mesh.rotation.z = sp.dead ? Math.PI / 2 : 0; mesh.position.y = y + (sp.dead ? 0.8 : 0);
      mesh.userData.parts.forEach(m => { if (m.material && m.material.color) m.material.emissive = sp.flash > 0 ? this._white : this._black; });
    }
    for (const [sp, mesh] of this.specials) if (!spLive.has(sp)) { this.scene.remove(mesh); this.specials.delete(sp); }

    // chests
    const chLive = this._chLive || (this._chLive = new Set()); chLive.clear();
    for (const c of g.chests) { if (c.open) continue; chLive.add(c); let m = this.chests.get(c); if (!m) { m = this._chestMesh(); this.chests.set(c, m); } m.position.set(c.x, c.y + Math.abs(Math.sin(t * 2 + c.x)) * 0.12, c.z); m.userData.seals.forEach((s, i) => { s.rotation.y = t * 2 + i; }); if (Math.random() < dt * 3) fx.spark(c.x + (Math.random() - 0.5) * 1.6, c.y + 1.2 + Math.random(), c.z + (Math.random() - 0.5), 0, 0.6, 0, 0xffe08a, 0.22, 0.5); }
    for (const [c, m] of this.chests) if (!chLive.has(c)) {
      if (c.open) { const q = m.position; fx.beam(q.x, q.y, q.z, 0xffe9a0, 0.9); fx.ring(q.x, q.y, q.z, 3.5, 0xffd56a, 0.5); fx.burst(q.x, q.y + 1, q.z, 26, 0xffd56a, 3, 5, 0.25, 0.9, 6); fx.cards(q.x, q.y + 0.5, q.z, 3); }
      this.scene.remove(m); this.chests.delete(c);
    }

    // projectiles
    const s = g.shots; let nc = 0, nf = 0, nl = 0, nh = 0, ngl = 0, ngf = 0;
    for (let i = 0; i < s.max; i++) {
      if (!s.alive[i]) continue;
      d.position.set(pl(s.px[i], s.x[i], a), pl(s.py[i], s.y[i], a), pl(s.pz[i], s.z[i], a)); d.scale.set(1, 1, 1);
      const k = s.kind[i];
      { const ex = d.position.x - cam.x, ey = d.position.y - cam.y, ez = d.position.z - cam.z; if (ex * ex + ey * ey + ez * ez < 6.25) continue; }       // a shot within 2.5 m of the camera is not drawn (it would fill the frame)
      if (k === 0) { d.rotation.set(0, Math.atan2(s.vx[i], s.vz[i]) + t * 14, 0); d.updateMatrix(); this.cards.setMatrixAt(nc++, d.matrix); }
      else if (k === 2) { d.rotation.set(t * 5, t * 4, 0); d.updateMatrix(); this.lob.setMatrixAt(nl++, d.matrix); d.scale.set(1.9, 1.9, 1.9); d.updateMatrix(); this.lobGlow.setMatrixAt(ngl++, d.matrix); }
      else if (k === 3) { if (nh < 64) { d.rotation.set(t * 9, t * 11, 0); d.updateMatrix(); this.bolts.setMatrixAt(nh++, d.matrix); } }       // homing bolts have their own mesh (violet)
      else { d.rotation.set(0, t * 12, 0); d.updateMatrix(); this.fire.setMatrixAt(nf++, d.matrix); d.scale.set(1.9, 1.9, 1.9); d.updateMatrix(); this.fireGlow.setMatrixAt(ngf++, d.matrix); }
    }
    this.bolts.count = nh; this.bolts.instanceMatrix.needsUpdate = true; this.lobGlow.count = ngl; this.fireGlow.count = ngf; this.lobGlow.instanceMatrix.needsUpdate = this.fireGlow.instanceMatrix.needsUpdate = true;
    { const S = this.shadow, dd = this.d; let ns = 0;       // contact shadows follow the ground under everything that walks
      const put = (x, z, r, y) => { if (ns >= S.instanceMatrix.count) return; const gy = heightGround(x, z), up = y === undefined ? 0 : Math.max(0, y - gy); dd.position.set(x, gy + 0.07, z); dd.rotation.set(0, 0, 0); dd.scale.setScalar(r * Math.max(0.3, 1 / (1 + up * 0.4))); dd.updateMatrix(); S.setMatrixAt(ns++, dd.matrix); };      // a shadow under everything, smaller (so lighter) the higher it is
      if (this.rig && !(g.over && !g.won)) put(px, pz, 0.95);
      for (const m of g.field.monsters) if (m) { const me = this.monsters.get(m); if (me && me.visible && !me.userData.crit) put(me.position.x, me.position.z, 0.85 * (me.userData.size || 1), me.userData.fly ? me.position.y - 0.5 : undefined); }
      const e = g.en, cp = cam; for (let i = 0; i < e.max; i++) if (e.alive[i]) { const dx = e.x[i] - cp.x, dz = e.z[i] - cp.z; if (dx * dx + dz * dz < 3600) put(e.x[i], e.z[i], 0.75 + KIND_LIST[e.kind[i]].radius * 1.2, e.y[i]); }
      S.count = ns; S.instanceMatrix.needsUpdate = true; }
    { const O = this.orbit; if (g.frenzyT > 0) { const dd = this.d; O.count = 10; for (let k = 0; k < 10; k++) { const an = this.vt * 3 + k * 0.6283; dd.position.set(px + Math.cos(an) * 1.8, p.y + 1.1 + Math.sin(this.vt * 4 + k) * 0.15, pz + Math.sin(an) * 1.8); dd.rotation.set(Math.PI / 2, 0, an + this.vt * 5); dd.scale.set(1, 1, 1); dd.updateMatrix(); O.setMatrixAt(k, dd.matrix); } O.instanceMatrix.needsUpdate = true; } else O.count = 0; }
    this.cards.count = nc; this.fire.count = nf; this.lob.count = nl;
    this.cards.instanceMatrix.needsUpdate = this.fire.instanceMatrix.needsUpdate = this.lob.instanceMatrix.needsUpdate = true;
    let nb = 0;
    for (const b of g.eb) { if (!b.on) continue; d.position.set(lerp(b.px, b.x, a), b.y, lerp(b.pz, b.z, a)); d.rotation.set(0, Math.atan2(b.vx, b.vz), 0); d.scale.set(1, 1, 1); d.updateMatrix(); this.bolt2.setMatrixAt(nb++, d.matrix); }
    this.bolt2.count = nb; this.bolt2.instanceMatrix.needsUpdate = true;

    // pickups: crystals glow in a slow pulse and bob, coins spin
    this.pk[0].material.emissiveIntensity = 0.75 + 0.3 * Math.sin(t * 4);
    const m = g.pick, pc = [0, 0, 0];
    for (let i = 0; i < m.max; i++) {
      if (!m.alive[i]) continue; const kk = m.kind[i];
      if (kk === 0) {                                          // crystal: tilted 20 degrees, one turn per 2.5 s, bobs 6 cm; size and tint by value
        const v = m.val[i], sz = (v >= 20 ? 0.5 : v >= 5 ? 0.35 : 0.25) * SCALE.pickup, col = v >= 20 ? this._gold : v >= 5 ? this._blue : this._plain;
        d.position.set(m.x[i], m.y[i] + 0.12 + Math.sin(t * 3 + i) * 0.1, m.z[i]); d.rotation.set(0.35, t * Math.PI * 2 / 2.5 + i, 0); d.scale.setScalar(sz * (1 + 0.1 * Math.sin(t * 4 + i))); d.updateMatrix();
        this.pk[0].setMatrixAt(pc[0], d.matrix); this.pk[0].setColorAt(pc[0], col); pc[0]++; continue;
      }
      d.position.set(m.x[i], m.y[i] + Math.sin(t * 3 + i) * 0.1, m.z[i]); d.rotation.set(0, t * 3, 0); d.scale.setScalar(SCALE.pickup); d.updateMatrix(); this.pk[kk].setMatrixAt(pc[kk]++, d.matrix);
    }
    if (Math.random() < dt * 25) { const j = Math.floor(Math.random() * m.max); if (m.alive[j]) fx.spark(m.x[j], m.y[j] + 0.9, m.z[j], 0, 0.7, 0, m.kind[j] === 1 ? 0xffe08a : m.kind[j] === 2 ? 0xff9aa8 : 0xe6c8ff, 0.16, 0.4); }
    this.pk.forEach((mm, i) => { mm.count = pc[i]; mm.instanceMatrix.needsUpdate = true; if (i === 0) mm.instanceColor.needsUpdate = true; });
    let nt = 0; for (const tr of g.btraps) { if (!tr.on) continue; d.position.set(tr.x, tr.y + 0.05, tr.z); d.rotation.set(0, 0.2, 0); d.scale.set(1, 1, 1); d.updateMatrix(); this.btrap.setMatrixAt(nt++, d.matrix); }
    this.btrap.count = nt; this.btrap.instanceMatrix.needsUpdate = true;

    this._telegraphs(g);
    this._sand(g);
  }

  _updateGhosts() {                                              // the two parents of a Fusion spiral into each other before the new monster lands
    if (!this.ghosts.length) return;
    if (this._ghostFresh) { let cx = 0, cz = 0; for (const m of this.ghosts) { cx += m.userData.sx; cz += m.userData.sz; } this._gc = [cx / this.ghosts.length, cz / this.ghosts.length]; this._ghostFresh = false; }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const m = this.ghosts[i], ud = m.userData, u = (this.vt - ud.g0) / 1.0;
      if (u >= 1) { this.scene.remove(m); this.ghosts.splice(i, 1); continue; }
      const dx = ud.sx - this._gc[0], dz = ud.sz - this._gc[1], r0 = Math.sqrt(dx * dx + dz * dz) + 0.6, ang = Math.atan2(dz, dx) + u * u * 12, r = r0 * (1 - u);
      m.position.set(this._gc[0] + Math.cos(ang) * r, m.position.y + 0.02, this._gc[1] + Math.sin(ang) * r); m.rotation.y += 0.5; m.scale.setScalar((ud.base || 1) * (1 - u * 0.7));
      if (this.fx.rm_ === false && Math.random() < 0.5) this.fx.spark(m.position.x, m.position.y + 0.5, m.position.z, 0, 0.5, 0, 0xffd56a, 0.3, 0.4);
    }
  }

  _telegraphs(g) {
    const d = this.d, col = this.col;
    let nl = 0, nd = 0, nr2 = 0; const fanN = new Map(); setTele(g.tele, g.p.x, g.p.z);
    for (const o of g.tele) {
      if (!o.on) continue;
      const f = Math.min(1, o.t / o.dur);
      // enemy warnings (spec 2.5): exact danger red, unlit, at the true sim footprint, a thin pale edge, and a fill that follows the tell timer (it grows with the wind-up, so an early tell is mostly outline)
      if (o.type === 0) {                                       // marked lane: pale edges for the whole footprint, a red fill that runs out from the caster with the timer
        const yaw = Math.atan2(o.dx, o.dz), fl = Math.max(0.05, o.len * f);
        if (nl + 3 <= 64) {
          d.position.set(o.x + o.dx * fl / 2, o.y + 0.08, o.z + o.dz * fl / 2); d.rotation.set(0, yaw, 0); d.scale.set(o.w, 1, fl); d.updateMatrix(); this.teleLine.setMatrixAt(nl, d.matrix); this.teleLine.setColorAt(nl, DANGER); nl++;
          for (const sd of [-1, 1]) { const ox = Math.cos(yaw) * sd * o.w / 2, oz = -Math.sin(yaw) * sd * o.w / 2; d.position.set(o.x + o.dx * o.len / 2 + ox, o.y + 0.1, o.z + o.dz * o.len / 2 + oz); d.rotation.set(0, yaw, 0); d.scale.set(0.12, 1, o.len); d.updateMatrix(); this.teleLine.setMatrixAt(nl, d.matrix); this.teleLine.setColorAt(nl, EDGE); nl++; }
        }
      } else if (o.type === 1) {                                // blast circle: a thin pale outline at the true radius, a red fill that grows to it
        d.rotation.set(0, 0, 0); d.position.set(o.x, o.y + 0.1, o.z); d.scale.set(o.r, 1, o.r); d.updateMatrix(); if (nr2 < 64) { this.teleRing.setMatrixAt(nr2, d.matrix); this.teleRing.setColorAt(nr2, EDGE); nr2++; }
        d.position.y = o.y + 0.12; d.scale.set(Math.max(0.05, o.r * f), 1, Math.max(0.05, o.r * f)); d.updateMatrix(); this.teleDisc.setMatrixAt(nd, d.matrix); this.teleDisc.setColorAt(nd, DANGER); nd++;
      } else {
        const fan = this._fan(Math.round(o.arc)), n = fanN.get(fan) || 0, rf = Math.max(0.05, o.r * f);
        d.position.set(o.x, o.y + 0.1, o.z); d.rotation.set(0, Math.atan2(o.dx, o.dz), 0); d.scale.set(rf, 1, rf); d.updateMatrix();
        fan.setMatrixAt(n, d.matrix); fan.setColorAt(n, DANGER); fanN.set(fan, n + 1);
      }
    }    this.teleLine.count = nl; this.teleDisc.count = nd; this.teleRing.count = nr2; this.teleRing.instanceMatrix.needsUpdate = true; this.teleRing.instanceColor.needsUpdate = true;
    for (const mm of [this.teleLine, this.teleDisc]) { mm.instanceMatrix.needsUpdate = true; mm.instanceColor.needsUpdate = true; }
    // effects: expanding rings and fading fans
    let nr = 0; this._stains.length = 0; this._lead = null; this.own.begin(); const rch = g.mods.reach || 0, tier = rch >= 1.0 ? 2 : rch >= 0.5 ? 1 : 0, stier = this.tier5 ? 5 : rch >= 1.0 ? 4 : rch >= 0.7 ? 3 : rch >= 0.3 ? 2 : 1; this.own.tier = tier; this._skyLight = false;       // stier: the five screen tiers, from Reach (Tier 5 is the Overtime one)
    for (const o of g.fx) {
      if (!o.on) continue;
      if (o.type === 'bolt') { if (this.ribbon.see(o) && o.el === 'lightning') this._arcAt(g, o.x2, o.z2); continue; }
      const f = Math.min(1, o.t / o.dur), fade = 1 - f;
      if (o.type === 'wake') { if (this.ownCtx) this.own.card((o.ax + o.bx) / 2, o.y, (o.az + o.bz) / 2, o.r, o.hw, 0xff8a30, 0, 0, Math.atan2(o.dz, o.dx)); continue; }       // the Ember Wake: the sim's rectangle itself (half length r, half width hw), lit from the Wyvern to the line's end
      if (o.owner === 0 && this.ownCtx) { if (!this.own.hideAll) { if (tier > 0) this._tierFx(o, tier); if (this.tier5 && o.r >= 8) this._tier5(o, rch); else this._grow(o, stier, rch); } if (o.type === 'ring') this.own.area(o.x, o.y + 0.15, o.z, o.r * (0.35 + 0.65 * f), this._ownHex(o), false, 0, 1, 0, 0.4 + 0.6 * fade); else this.own.area(o.x, o.y + 0.15, o.z, o.r, this._ownHex(o), true, o.dx, o.dz, o.arc / 2, 0.3 + 0.7 * fade); continue; }
      if (o.type === 'ring') {
        d.rotation.set(0, 0, 0); d.position.set(o.x, o.y + 0.15, o.z); const r = o.r * (0.35 + 0.65 * f); d.scale.set(r, 1, r); d.updateMatrix();
        this.fxRing.setMatrixAt(nr, d.matrix); this.fxRing.setColorAt(nr, col.setHex(o.color).multiplyScalar(0.4 + 0.6 * fade)); nr++;
      } else {
        const fan = this._fan(Math.round(o.arc)), n = fanN.get(fan) || 0;
        d.position.set(o.x, o.y + 0.15, o.z); d.rotation.set(0, Math.atan2(o.dx, o.dz), 0); d.scale.set(o.r, 1, o.r); d.updateMatrix();
        fan.setMatrixAt(n, d.matrix); fan.setColorAt(n, col.setHex(o.color).multiplyScalar(0.3 + 0.7 * fade)); fanN.set(fan, n + 1);
      }
    }
    if (this.capBurst) { const cb = this.capBurst; cb.t += this._dt || 0.016; const u = cb.t / 0.7; if (u >= 1) this.capBurst = null; else this.own.area(cb.x, cb.y + 0.15, cb.z, 6 * (1 - (1 - u) * (1 - u)) + 0.3, cb.hex, false, 0, 1, 0, 1 - u * 0.5); }
    { const dtm = this._dt || 0.016, M = this._marks; for (let i = M.length - 1; i >= 0; i--) { M[i].t += dtm; if (M[i].t > 8) M.splice(i, 1); else if (stier >= 2 && !this.own.hideAll) this._stains.push(M[i]); } if (this._stains.length > 6) this._stains.length = 6; }
    this._signatures(g, this._dt || 0.016, tier);
    if (this.tier5 && this._lead) { const L = RAMP[this._lead] || RAMP.fire; if (this._stains.length >= 6) this._stains.length = 5; this._stains.push({ x: g.p.x, z: g.p.z, r: 11, hex: L[3], hexK: ownColour(this._lead) }); setStains(this._stains); setSkyTint(L[3], L[2], 0.45); this._skyOn = true; } else if (this._stains.length) { setStains(this._stains); if (this._skyLight && this._lead) { const L = RAMP[this._lead] || RAMP.fire; setSkyTint(L[3], L[2], 0.1); this._skyOn = true; } else if (this._skyOn) { setSkyTint(0, 0, 0); this._skyOn = false; } this._stainOn = true; } else if (this._skyOn || this._stainOn) { setStains([]); setSkyTint(0, 0, 0); this._skyOn = false; this._stainOn = false; }
    this.ribbon.tick(); if (this.ownCtx && this.ownExtra) this.ownExtra(this.own); if (this.ownCtx) { const c = this.ownCtx; this.own.end(c.camera, g.p, c.renderer.internalSize ? { w: c.renderer.internalSize.x, h: c.renderer.internalSize.y } : { w: 960, h: 540 }, this._dt); }
    this.fxRing.count = nr; this.fxRing.instanceMatrix.needsUpdate = true; this.fxRing.instanceColor.needsUpdate = true;
    for (const [fan, mesh] of this.fans) { mesh.count = fanN.get(mesh) || 0; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
  }

  _sand(g) {
    const b = g.boss, on = b.state === 'active' && b.phase === 3 && b.sandR !== undefined;
    if (!on) { if (this.sand) this.sand.visible = false; return; }
    if (!this.sand) { this.sand = new T.Mesh(new T.RingGeometry(10, 33, 48), basic(0xe8b84a, { transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false })); this.sand.rotation.x = -Math.PI / 2; this.sand.position.y = 0.12; this.scene.add(this.sand); }
    this.sand.visible = true;
    const ac = (g.map && g.map.arena && g.map.arena.center) || { x: 0, z: 0 };
    this.sand.position.x = ac.x; this.sand.position.z = ac.z; this.sand.position.y = (g.sp[0] ? g.sp[0].y : 0) + 0.12;
    if (Math.abs(b.sandR - this.sandR) > 0.4) { this.sandR = b.sandR; this.sand.geometry.dispose(); this.sand.geometry = new T.RingGeometry(b.sandR, 33, 48); }
  }

  // ---- Hatchling nose smoke: 2 nostrils, a puff every 0.35 s, 8 puffs each, half-transparent for the last 40% ----
  _emitPuffs(mesh, m, g) {
    const ud = mesh.userData; if (!this.assets.puff || !ud.model || !ud.model.nostrils.length) return;
    m._puff = m._puff || { t: 0, pool: [], burst: 0 };
    const S = m._puff, s = ud.scale;
    S.t -= 1 / 60;
    if (m.cd > (m._lastCd || 0) + 0.2) S.burst = 3;                // it just attacked
    m._lastCd = m.cd;
    const spawn = (nIdx) => {
      let pf = S.pool.find(q => !q.on);
      if (!pf) { if (S.pool.length >= 8) return; const sp = new T.Sprite(new T.SpriteMaterial({ map: this.assets.puff, color: 0xdddddd, transparent: true, depthWrite: false })); this.scene.add(sp); pf = { sp, on: false }; S.pool.push(pf); this.puffs.push(pf); }
      const nos = ud.model.nostrils[nIdx], v = new T.Vector3(nos[0], nos[1], nos[2]).applyMatrix4(ud.root.matrixWorld);
      Object.assign(pf, { on: true, born: g.t, x: v.x, y: v.y, z: v.z, side: nIdx === 0 ? -1 : 1, yaw: mesh.rotation.y, s });
      pf.sp.visible = true;
    };
    if (S.t <= 0) { S.t = 0.35; spawn(0); spawn(1); }
    if (S.burst > 0) { S.burst--; spawn(S.burst % 2); }
  }
  // Twinflare Tyrant fire breath: a few flame puffs fly forward from the snout (front of the model), fading to half opacity
  _breath(mesh, m, g) {
    if (!this.assets.puff) return;
    this.flames = this.flames || [];
    const fwd = new T.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion), origin = mesh.position.clone().add(fwd.clone().multiplyScalar(1.6)).add(new T.Vector3(0, 0.3, 0));
    for (let k = 0; k < 7; k++) {
      let f = this.flames.find(q => !q.on);
      if (!f) { const sp = new T.Sprite(new T.SpriteMaterial({ map: this.assets.puff, color: 0xff8a30, transparent: true, depthWrite: false })); this.scene.add(sp); f = { sp, on: false }; this.flames.push(f); }
      f.on = true; f.born = g.t + k * 0.03; f.o = origin; f.dir = fwd.clone().add(new T.Vector3((k % 3 - 1) * 0.12, (k % 2) * 0.05, 0)).normalize(); f.sp.visible = true;
    }
  }
  _updateFlames(now) {
    for (const f of this.flames || []) {
      if (!f.on) continue; const u = (now - f.born) / 0.45;
      if (u < 0) { f.sp.visible = false; continue; } f.sp.visible = true;
      if (u >= 1) { f.on = false; f.sp.visible = false; continue; }
      f.sp.position.copy(f.o).addScaledVector(f.dir, 1 + u * 9); const s = 0.25 + u * 0.8; f.sp.scale.set(s, s, 1); f.sp.material.opacity = u < 0.6 ? 1 : 0.5;
    }
  }
  _updatePuffs(now) {
    for (const pf of this.puffs) {
      if (!pf.on) continue;
      const u = (now - pf.born) / 1.4;
      if (u >= 1) { pf.on = false; pf.sp.visible = false; continue; }
      const s = pf.s, rise = 0.32 * s * u, drift = 0.1 * s * u, wob = Math.sin(u * 9 + pf.side) * 0.04 * s;
      pf.sp.position.set(pf.x + Math.sin(pf.yaw) * drift + Math.cos(pf.yaw) * wob, pf.y + rise, pf.z + Math.cos(pf.yaw) * drift - Math.sin(pf.yaw) * wob);
      const size = (0.05 + 0.11 * u) * s; pf.sp.scale.set(size, size, 1);
      pf.sp.material.opacity = u < 0.6 ? 1 : 0.5;                // half-transparent blend, no smooth fade
    }
  }
}

import { heightAt } from '../sim/terrain.js';
function heightGround(x, z) { const h = heightAt(x, z); return h >= 50 ? 0 : h; }




























