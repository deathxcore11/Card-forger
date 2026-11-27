// Map life: vases, Witness Stones, the Relic Broker, Shrines of Tribute and Card Chests. Each has its own silhouette (shape before colour).
import { ENCOUNTERS as E } from '../data/encounters.js';
import { seeMap } from './seethrough.js';
import { ITEMS } from '../data/items.js';
import { BLOCKS, blockGroup, animateBlocks } from './models.js';

const T = window.THREE;
const lambert = (c, x) => new T.MeshLambertMaterial(Object.assign({ color: c, flatShading: true }, x || {}));
const basic = (c, x) => new T.MeshBasicMaterial(Object.assign({ color: c }, x || {}));
const RARITY = { common: 0xb9b2a2, rare: 0x5b9bd5, epic: 0xa974e0, legendary: 0xe8b84a };

// Draw-call cut: the static pieces of one prop (a stone ring, a stall, a shrine basin, a chest) merge into two meshes, one lit and one unlit, with the colours baked into vertices.
// Animated pieces (gems, flames, the filling ring, water) and transparent ones stay as they are.
function bake(g) {
  const lit = [], unlit = [], kill = [];
  for (const m of g.children) {
    if (!m.isMesh || m.userData.dyn || m.material.transparent || m.geometry.type === 'OctahedronGeometry' || m.isInstancedMesh) continue;
    m.updateMatrix(); const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); geo.applyMatrix4(m.matrix); (m.material.type === 'MeshBasicMaterial' ? unlit : lit).push([geo, m.material.color]); kill.push(m);
  }
  const make = (list, basicMat) => {
    if (!list.length) return; const pos = [], nor = [], col = [];
    for (const [geo, c] of list) { const p = geo.attributes.position, n = geo.attributes.normal; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); if (n) nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); } }
    const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); if (nor.length) bg.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); bg.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.add(new T.Mesh(bg, seeMap(basicMat ? new T.MeshBasicMaterial({ vertexColors: true }) : new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }))));
  };
  for (const m of kill) { g.remove(m); m.geometry.dispose(); }
  make(lit, false); make(unlit, true);
}

export class Props {
  constructor(scene) {
    this.scene = scene; this.world = null; this.group = new T.Group(); scene.add(this.group);
    this.d = new T.Object3D();
  }
  _clear() { this.scene.remove(this.group); this.group = new T.Group(); this.scene.add(this.group); this.parts = null; }

  _build(world) {
    this._clear(); this.world = world;
    const G = this.group, P = this.parts = { stones: [], wagers: [], broker: null, shrines: [], chests: [] };
    // vases: instanced; banded ones are taller with a gold band
    const vg = new T.CylinderGeometry(0.3, 0.38, 0.8, 8); vg.translate(0, 0.4, 0);
    const bg = new T.CylinderGeometry(0.34, 0.42, 1.05, 8); bg.translate(0, 0.52, 0);
    this.vases = new T.InstancedMesh(vg, lambert(0xc9965a), 1024); this.banded = new T.InstancedMesh(bg, lambert(0xe3b34c, { emissive: 0x3a2808 }), 256);
    for (const m of [this.vases, this.banded]) { m.frustumCulled = false; m.count = 0; G.add(m); }

    this.gems = new T.InstancedMesh(new T.OctahedronGeometry(1, 0), new T.MeshBasicMaterial({ color: 0xffffff }), 256); this.gems.instanceColor = new T.InstancedBufferAttribute(new Float32Array(256 * 3), 3); this.gems.frustumCulled = false; this.gems.count = 0; G.add(this.gems);
    this.G = G; this.chestMeshes = []; this._chestN = -1; this._seen = new Set(); this._sync(world);
  }
  // the stones, the broker, the shrines and the altar: made once each, the first time they are in the world (the big desert hands them over as the duelist nears them)
  _sig(w) { return (w.wagers || []).length * 65536 + w.stones.length * 4096 + w.shrines.length * 4 + (w.broker ? 1 : 0) + (w.altar ? 2 : 0); }
  _sync(world) {
    const G = this.G, P = this.parts, seen = this._seen; this._sigV = this._sig(world);
    for (const s of world.stones) {                                    // ring of four tall slabs round a low offering pedestal
      if (seen.has(s)) continue; seen.add(s);
      const g = new T.Group(); g.position.set(s.x, s.y, s.z);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4, slab = new T.Mesh(new T.BoxGeometry(0.8, 3.4, 0.4), lambert(0x9aa0a8)); slab.position.set(Math.cos(a) * 2.4, 1.7, Math.sin(a) * 2.4); slab.rotation.y = -a + Math.PI / 2; g.add(slab); }
      const ped = new T.Mesh(new T.CylinderGeometry(0.7, 0.9, 0.7, 8), lambert(0xb8b0a0)); ped.position.y = 0.35; g.add(ped);
      const gem = new T.Mesh(new T.OctahedronGeometry(0.32, 0), basic(0xffe07a)); gem.position.y = 1.4; g.add(gem);
      gem.userData.dyn = true; gem.visible = false; bake(g); G.add(g); P.stones.push({ s, g, gem });
    }
    if (world.broker && !P.broker) {                                                // lantern, folded canopy, three plinths
      const b = world.broker, g = new T.Group(); g.position.set(b.x, b.y, b.z);
      for (const [x, z] of [[-2.2, -1.2], [2.2, -1.2], [-2.2, 1.2], [2.2, 1.2]]) { const pole = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 3, 5), lambert(0x6a4a2a)); pole.position.set(x, 1.5, z); g.add(pole); }
      const canopy = new T.Mesh(new T.ConeGeometry(3.4, 1.2, 4), lambert(0xa8442a)); canopy.position.y = 3.6; canopy.rotation.y = Math.PI / 4; g.add(canopy);
      const lamp = new T.Mesh(new T.BoxGeometry(0.35, 0.5, 0.35), basic(0xffd060)); lamp.position.set(0, 2.6, 0); g.add(lamp);
      const plinths = [];
      for (let k = 0; k < 3; k++) {
        const pl = new T.Mesh(new T.BoxGeometry(0.9, 0.8, 0.9), lambert(0xc8b890)); pl.position.set(-1.6 + k * 1.6, 0.4, 0.4); g.add(pl);
        const it = new T.Mesh(new T.OctahedronGeometry(0.3, 0), basic(RARITY[ITEMS[b.stock[k].id].rarity])); it.position.set(-1.6 + k * 1.6, 1.3, 0.4); g.add(it); plinths.push(it); it.userData.dyn = true; it.visible = false;
      }
      bake(g); G.add(g); P.broker = { g, plinths };
    }
    for (const s of world.wagers || []) {                              // the Wager Shrine: two leaning dark slabs round a low brazier and an ember gem, in orange (never red, never violet)
      if (seen.has(s)) continue; seen.add(s); const g = new T.Group(); g.position.set(s.x, s.y, s.z);
      for (let k = 0; k < 2; k++) { const a = k * Math.PI + 0.5, slab = new T.Mesh(new T.BoxGeometry(0.9, 3.0, 0.5), lambert(0x4a3f36)); slab.position.set(Math.cos(a) * 1.6, 1.5, Math.sin(a) * 1.6); slab.rotation.set(0, -a + Math.PI / 2, (k ? 1 : -1) * 0.12); g.add(slab); }
      const br = new T.Mesh(new T.CylinderGeometry(0.8, 1.1, 0.55, 8), lambert(0x6a4a32)); br.position.y = 0.28; g.add(br); const gem = new T.Mesh(new T.OctahedronGeometry(0.34, 0), basic(0xff9a3c)); gem.position.y = 1.5; g.add(gem); gem.userData.dyn = true; gem.visible = false; bake(g); G.add(g); P.wagers.push({ s, g });
    }
    for (const s of world.shrines) {                                   // low basin with a filling ring on the floor
      if (seen.has(s)) continue; seen.add(s);
      const g = new T.Group(); g.position.set(s.x, s.y, s.z); const rc = RARITY[s.best] || 0x7fffc8, dim = (h, f) => (((h >> 16 & 255) * f) << 16) | (((h >> 8 & 255) * f) << 8) | ((h & 255) * f);      // the circle takes the colour of the best blessing on offer
      const basin = new T.Mesh(new T.CylinderGeometry(1.4, 1.8, 0.5, 10), lambert(0x6a5a3a)); basin.position.y = 0.25; g.add(basin);
      const water = new T.Mesh(new T.CylinderGeometry(1.1, 1.1, 0.05, 10), basic(rc)); water.position.y = 0.5; g.add(water);
      const track = new T.Mesh(new T.RingGeometry(E.shrines.radius - 0.6, E.shrines.radius, 48), basic(dim(rc, 0.75), { side: T.DoubleSide })); track.rotation.x = -Math.PI / 2; track.position.y = 0.1; g.add(track);
      const fill = new T.Mesh(new T.RingGeometry(E.shrines.radius - 0.6, E.shrines.radius, 48, 1, 0, 0.01), basic(rc, { side: T.DoubleSide, depthWrite: false })); fill.rotation.x = -Math.PI / 2; fill.position.y = 0.12; g.add(fill);
      fill.userData.dyn = water.userData.dyn = track.userData.dyn = true; track.renderOrder = 1; fill.renderOrder = 2; bake(g); G.add(g); P.shrines.push({ s, g, fill, water, lastP: -1 });       // the track stays out of the bake and draws first, the progress band over it (0.6 m wide)
    }
    if (world.altar && !P.altar) {                                                  // stepped altar with two bowls: Banish and Tribute
      const a = world.altar, g = new T.Group(); g.position.set(a.x, a.y, a.z);
      for (let k = 0; k < 3; k++) { const st = new T.Mesh(new T.BoxGeometry(3.2 - k * 0.8, 0.35, 2.2 - k * 0.5), lambert(0xb0a28a)); st.position.y = 0.18 + k * 0.35; g.add(st); }
      for (const [x, col] of [[-0.6, 0xe8c56a], [0.6, 0xa060e0]]) { const bowl = new T.Mesh(new T.CylinderGeometry(0.4, 0.25, 0.3, 8), lambert(0x7a6a50)); bowl.position.set(x, 1.3, 0); g.add(bowl); const flame = new T.Mesh(new T.OctahedronGeometry(0.22, 0), basic(col)); flame.position.set(x, 1.7, 0); flame.visible = false; g.add(flame); }
      bake(g); G.add(g); P.altar = { a, g };
    }
  }
  // All Card Chests (and Trophy Chests, which are pale wood with the lid thrown open) share two meshes, one lit and one unlit, rebuilt when a chest appears. An opened chest is hidden by
  // collapsing its own vertices in the shader (aHide), so the whole set is two draws however many chests there are. Only a Trophy Chest's light pillar is a mesh of its own (neutral gold, never the tier).
  _rebuildChests(world) {
    for (const m of this.chestMeshes) { this.G.remove(m); if (m.geometry) m.geometry.dispose(); } this.chestMeshes = []; this._chestN = world.cchests.length; this.chestRange = [];
    const OPEN = !!this.openMap;       // the open desert: a warm wood chest with a lit top, readable from 30 m
    const lit = { pos: [], nor: [], col: [], hide: [] }, unlit = { pos: [], nor: [], col: [], hide: [] }, M = new T.Matrix4(), R = new T.Matrix4(), col = new T.Color();
    world.cchests.forEach((c, ci) => {
      if (BLOCKS.chestSealed && !c.trophy) { const bg = blockGroup(BLOCKS.chestSealed), s = 1.5 / BLOCKS.chestSealed.size.x; bg.root.scale.setScalar(s); bg.root.position.set(c.x, c.y, c.z); { const S = this._spawn; bg.root.rotation.y = S ? Math.atan2(S.x - c.x, S.z - c.z) : 0; } bg.root.userData.bc = { c, bg }; animateBlocks('chestSealed', bg, 0, { open: !!c.open }); this.G.add(bg.root); this.chestMeshes.push(bg.root); this.chestRange[ci] = []; return; }       // the block look (?blocks=1): the sealed chest facing the spawn (nothing new stored), its lid opens when the chest does
      const piece = (geo, x, y, z, hex, un, rx, when) => {       // when: 'c' shows only while closed, 'o' only while open, none always
        const hv = when === 'c' ? (c.open ? 1 : 0) : when === 'o' ? (c.open ? 0 : 1) : 0; M.makeTranslation(c.x + x, c.y + y, c.z + z); if (rx) { R.makeRotationX(rx); M.multiply(R); } const g2 = geo.toNonIndexed(); g2.applyMatrix4(M); col.setHex(hex); const o = un ? unlit : lit, st = o.pos.length / 3, p = g2.attributes.position, n = g2.attributes.normal; for (let i = 0; i < p.count; i++) { o.pos.push(p.getX(i), p.getY(i), p.getZ(i)); if (n) o.nor.push(n.getX(i), n.getY(i), n.getZ(i)); o.col.push(col.r, col.g, col.b); o.hide.push(hv); } return [un ? 1 : 0, st, p.count, when || '']; };
      const lid = c.trophy ? piece(new T.BoxGeometry(1.6, 0.35, 1.1), 0, 1.25, -0.55, 0xeee4c8, false, -1.1) : piece(new T.BoxGeometry(1.6, 0.35, 1.1), 0, 1.05, 0, OPEN ? 0xc98a4a : 0x2a2026, false, 0, 'c');
      this.chestRange[ci] = [piece(new T.BoxGeometry(1.5, 0.9, 1.0), 0, 0.45, 0, c.trophy ? 0xd9cdb0 : OPEN ? 0xb4703a : 0x2a2026, false), lid, piece(new T.BoxGeometry(1.7, 0.18, 1.2), 0, 0.8, 0, 0xe0b765, true)];       // an opened chest keeps its body and its gold band
      if (!c.trophy) { this.chestRange[ci].push(piece(new T.BoxGeometry(1.6, 0.35, 1.1), 0, 1.25, -0.55, OPEN ? 0xc98a4a : 0x2a2026, false, -1.1, 'o'));       // the lid thrown back
        const ch = [piece(new T.BoxGeometry(0.14, 1.4, 1.14), -0.45, 0.78, 0, 0xe0b765, true, 0, 'c'), piece(new T.BoxGeometry(0.14, 1.4, 1.14), 0.45, 0.78, 0, 0xe0b765, true, 0, 'c')]; this.chestRange[ci].push(...ch); if (OPEN) this.chestRange[ci].push(piece(new T.BoxGeometry(1.5, 0.06, 1.0), 0, 1.24, 0, 0xf6d9a2, false, 0, 'c')); }       // black lacquer body with two gold chains (gold is reserved for things you can use)
      if (c.trophy) { const beam = new T.Mesh(new T.CylinderGeometry(0.28, 0.5, 18, 8, 1, true), basic(0xffd27a, { transparent: true, opacity: 0.4, depthWrite: false, side: T.DoubleSide })); beam.position.set(c.x, c.y + 9, c.z); this.G.add(beam); this.chestMeshes.push(beam); beam.userData.c = c; }
    });
    const hide = (mat) => { mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('void main() {', 'attribute float aHide;\nvoid main() {').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed *= 1.0 - aHide;'); }; return mat; };
    for (const [o, mat] of [[lit, hide(new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }))], [unlit, hide(new T.MeshBasicMaterial({ vertexColors: true }))]]) {
      if (!o.pos.length) continue; const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(o.pos, 3)); if (o.nor.length) bg.setAttribute('normal', new T.Float32BufferAttribute(o.nor, 3)); bg.setAttribute('color', new T.Float32BufferAttribute(o.col, 3)); bg.setAttribute('aHide', new T.Float32BufferAttribute(o.hide, 1));
      const m = new T.Mesh(bg, mat); m.frustumCulled = false; m.userData.set = o === lit ? 0 : 1; this.G.add(m); this.chestMeshes.push(m);
    }
    this.chestOpen = world.cchests.map(c => !!c.open);
  }
  _syncChests(world, t) {
    const sets = [null, null]; for (const m of this.chestMeshes) if (m.userData.set !== undefined) sets[m.userData.set] = m;
    world.cchests.forEach((c, ci) => { const open = !!c.open; if (open === this.chestOpen[ci]) return; this.chestOpen[ci] = open; for (const [which, st, n, when] of this.chestRange[ci]) { const m = sets[which]; if (!m) continue; const a = m.geometry.attributes.aHide, hv = when === 'c' ? (open ? 1 : 0) : when === 'o' ? (open ? 0 : 1) : 0; for (let i = 0; i < n; i++) a.array[st + i] = hv; a.needsUpdate = true; } });
    for (const m of this.chestMeshes) if (m.userData.bc) animateBlocks('chestSealed', m.userData.bc.bg, t, { open: !!m.userData.bc.c.open });
    for (const m of this.chestMeshes) if (m.userData.c) { m.visible = !m.userData.c.open; m.material.opacity = (0.3 + 0.12 * Math.sin(t * 3)) * (this.cam ? Math.max(0.1, Math.min(1, (Math.hypot(this.cam.x - m.position.x, this.cam.z - m.position.z) - 3) / 12)) : 1); }
  }

  update(g) {
    this._spawn = g.map && g.map.world && g.map.world.spawn;
    if (this.world !== g.world) { this._build(g.world); this._known = null; } else if (this._sigV !== this._sig(g.world)) this._sync(g.world);
    const P = this.parts, d = this.d, t = g.t;
    { const px = g.p.x, pz = g.p.z, R2 = 420 * 420, vis = (o, g2) => { g2.visible = (o.x - px) * (o.x - px) + (o.z - pz) * (o.z - pz) < R2; }; for (const o of P.stones) vis(o.s, o.g); for (const o of P.wagers) vis(o.s, o.g); for (const o of P.shrines) vis(o.s, o.g); if (P.broker) vis(g.world.broker, P.broker.g); if (P.altar) vis(P.altar.a, P.altar.g); }       // the big desert has hundreds of them: only the near ones are drawn
    let n = 0, b = 0, vk = 0; for (const v of g.world.vases) if (v.alive) vk += v.banded ? 1000 : 1;
    if (vk !== this._vk || this._vw !== g.world) { this._vk = vk; this._vw = g.world;       // the vases are re-laid and re-uploaded only when one breaks
    for (const v of g.world.vases) {
      if (!v.alive) continue; d.position.set(v.x, v.y, v.z); d.rotation.set(0, v.x * 3, 0); d.scale.set(1, 1, 1); d.updateMatrix();
      if (v.banded) this.banded.setMatrixAt(b++, d.matrix); else this.vases.setMatrixAt(n++, d.matrix);
    }
    this.vases.count = n; this.banded.count = b; this.vases.instanceMatrix.needsUpdate = this.banded.instanceMatrix.needsUpdate = true; }
    let ng = 0, gsig = 0; const gc = new T.Color(), gem = (x, y, z, ry, sc, hex) => { if (ng >= 256) return; d.position.set(x, y, z); d.rotation.set(0, ry, 0); d.scale.setScalar(sc); d.updateMatrix(); this.gems.setMatrixAt(ng, d.matrix); this.gems.setColorAt(ng, gc.setHex(hex)); gsig = gsig * 31 + hex + ng | 0; ng++; };
    for (const o of P.wagers) { const u = o.s.used; gem(o.s.x, o.s.y + (u ? 1.0 : 1.5 + Math.sin(t * 2.6) * 0.12), o.s.z, t * 2.2, 0.34 * (u ? 0.7 : 1), u ? 0x5a5560 : 0xff9a3c); }
    for (const o of P.stones) {                                                       // a used stone stays where it is and changes colour: gold and bobbing when ready, still and grey once spent
      const used = o.s.used; gem(o.s.x, o.s.y + (used ? 1.1 : 1.4 + Math.sin(t * 2) * 0.1), o.s.z, used ? 0.6 : t * 2, 0.32 * (used ? 0.8 : 1), used ? 0x6a6872 : 0xffe07a);
    }
    if (g.world.relic && !g.world.relic.taken) { const R = g.world.relic; gem(R.x, R.y + 1.7 + Math.sin(t * 2.4) * 0.15, R.z, t * 2.4, 0.6, 0xffffff); }
    if (P.broker) P.broker.plinths.forEach((m, k) => { const st = g.world.broker.stock[k], b = g.world.broker; if (!st.sold) gem(b.x - 1.6 + k * 1.6, b.y + 1.3 + Math.sin(t * 2 + k) * 0.06, b.z + 0.4, t * 2 + k, 0.3, RARITY[ITEMS[st.id].rarity]); });
    for (const o of P.shrines) {
      const p = o.s.charge / E.shrines.hold;
      if (Math.abs(p - o.lastP) > 0.008) { o.lastP = p; o.fill.geometry.dispose(); o.fill.geometry = new T.RingGeometry(E.shrines.radius - 0.6, E.shrines.radius, 48, 1, 0, Math.max(0.01, p * Math.PI * 2)); }
      { const rc = RARITY[o.s.best] || 0x5fd2a8, lift = h => (((h >> 16 & 255) + 255) >> 1 << 16) | (((h >> 8 & 255) + 255) >> 1 << 8) | (((h & 255) + 255) >> 1); o.water.material.color.setHex(o.s.done ? 0x555555 : p > 0 ? lift(rc) : rc); }       // the basin keeps the rarity colour, brighter while you charge it
    }
    this.openMap = !!(g.map && g.map.open); if (this._chestN !== g.world.cchests.length) this._rebuildChests(g.world);       // chests that appear mid-run (an Ace's Trophy Chest) rebuild the shared meshes
    this._syncChests(g.world, t);
    if (P.altar) { const a = P.altar.a; gem(a.x - 0.6, a.y + 1.7, a.z, t * 2, 0.22, 0xe8c56a); gem(a.x + 0.6, a.y + 1.7, a.z, t * 2, 0.22, 0xa060e0); }
    this.gems.count = ng; this.gems.instanceMatrix.needsUpdate = true; if (gsig !== this._gsig) { this._gsig = gsig; this.gems.instanceColor.needsUpdate = true; }       // the gems bob every frame, but their colours only change when one is used
  }
}
