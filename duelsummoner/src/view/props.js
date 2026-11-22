// Map life: vases, Witness Stones, the Relic Broker, Shrines of Tribute and Card Chests. Each has its own silhouette (shape before colour).
import { ENCOUNTERS as E } from '../data/encounters.js';
import { ITEMS } from '../data/items.js';

const T = window.THREE;
const lambert = (c, x) => new T.MeshLambertMaterial(Object.assign({ color: c, flatShading: true }, x || {}));
const basic = (c, x) => new T.MeshBasicMaterial(Object.assign({ color: c }, x || {}));
const RARITY = { common: 0xb9b2a2, rare: 0x5b9bd5, epic: 0xa974e0, legendary: 0xe8b84a };

export class Props {
  constructor(scene) {
    this.scene = scene; this.world = null; this.group = new T.Group(); scene.add(this.group);
    this.d = new T.Object3D();
  }
  _clear() { this.scene.remove(this.group); this.group = new T.Group(); this.scene.add(this.group); this.parts = null; }

  _build(world) {
    this._clear(); this.world = world;
    const G = this.group, P = this.parts = { stones: [], broker: null, shrines: [], chests: [] };
    // vases: instanced; banded ones are taller with a gold band
    const vg = new T.CylinderGeometry(0.3, 0.38, 0.8, 8); vg.translate(0, 0.4, 0);
    const bg = new T.CylinderGeometry(0.34, 0.42, 1.05, 8); bg.translate(0, 0.52, 0);
    this.vases = new T.InstancedMesh(vg, lambert(0xc9965a), 128); this.banded = new T.InstancedMesh(bg, lambert(0xe3b34c, { emissive: 0x3a2808 }), 64);
    for (const m of [this.vases, this.banded]) { m.frustumCulled = false; m.count = 0; G.add(m); }

    for (const s of world.stones) {                                    // ring of four tall slabs round a low offering pedestal
      const g = new T.Group(); g.position.set(s.x, s.y, s.z);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4, slab = new T.Mesh(new T.BoxGeometry(0.8, 3.4, 0.4), lambert(0x9aa0a8)); slab.position.set(Math.cos(a) * 2.4, 1.7, Math.sin(a) * 2.4); slab.rotation.y = -a + Math.PI / 2; g.add(slab); }
      const ped = new T.Mesh(new T.CylinderGeometry(0.7, 0.9, 0.7, 8), lambert(0xb8b0a0)); ped.position.y = 0.35; g.add(ped);
      const gem = new T.Mesh(new T.OctahedronGeometry(0.32, 0), basic(0xffe07a)); gem.position.y = 1.4; g.add(gem);
      G.add(g); P.stones.push({ s, g, gem });
    }
    if (world.broker) {                                                // lantern, folded canopy, three plinths
      const b = world.broker, g = new T.Group(); g.position.set(b.x, b.y, b.z);
      for (const [x, z] of [[-2.2, -1.2], [2.2, -1.2], [-2.2, 1.2], [2.2, 1.2]]) { const pole = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 3, 5), lambert(0x6a4a2a)); pole.position.set(x, 1.5, z); g.add(pole); }
      const canopy = new T.Mesh(new T.ConeGeometry(3.4, 1.2, 4), lambert(0xa8442a)); canopy.position.y = 3.6; canopy.rotation.y = Math.PI / 4; g.add(canopy);
      const lamp = new T.Mesh(new T.BoxGeometry(0.35, 0.5, 0.35), basic(0xffd060)); lamp.position.set(0, 2.6, 0); g.add(lamp);
      const plinths = [];
      for (let k = 0; k < 3; k++) {
        const pl = new T.Mesh(new T.BoxGeometry(0.9, 0.8, 0.9), lambert(0xc8b890)); pl.position.set(-1.6 + k * 1.6, 0.4, 0.4); g.add(pl);
        const it = new T.Mesh(new T.OctahedronGeometry(0.3, 0), basic(RARITY[ITEMS[b.stock[k].id].rarity])); it.position.set(-1.6 + k * 1.6, 1.3, 0.4); g.add(it); plinths.push(it);
      }
      G.add(g); P.broker = { g, plinths };
    }
    for (const s of world.shrines) {                                   // low basin with a filling ring on the floor
      const g = new T.Group(); g.position.set(s.x, s.y, s.z);
      const basin = new T.Mesh(new T.CylinderGeometry(1.4, 1.8, 0.5, 10), lambert(0x6a5a3a)); basin.position.y = 0.25; g.add(basin);
      const water = new T.Mesh(new T.CylinderGeometry(1.1, 1.1, 0.05, 10), basic(0x5fd2a8, { transparent: true, opacity: 0.8 })); water.position.y = 0.5; g.add(water);
      const track = new T.Mesh(new T.RingGeometry(E.shrines.radius - 0.25, E.shrines.radius, 48), basic(0x2a4a3a, { transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false })); track.rotation.x = -Math.PI / 2; track.position.y = 0.1; g.add(track);
      const fill = new T.Mesh(new T.RingGeometry(E.shrines.radius - 0.25, E.shrines.radius, 48, 1, 0, 0.01), basic(0x7fffc8, { side: T.DoubleSide, depthWrite: false })); fill.rotation.x = -Math.PI / 2; fill.position.y = 0.12; g.add(fill);
      G.add(g); P.shrines.push({ s, g, fill, water, lastP: -1 });
    }
    if (world.altar) {                                                  // stepped altar with two bowls: Banish and Tribute
      const a = world.altar, g = new T.Group(); g.position.set(a.x, a.y, a.z);
      for (let k = 0; k < 3; k++) { const st = new T.Mesh(new T.BoxGeometry(3.2 - k * 0.8, 0.35, 2.2 - k * 0.5), lambert(0xb0a28a)); st.position.y = 0.18 + k * 0.35; g.add(st); }
      for (const [x, col] of [[-0.6, 0xe8c56a], [0.6, 0xa060e0]]) { const bowl = new T.Mesh(new T.CylinderGeometry(0.4, 0.25, 0.3, 8), lambert(0x7a6a50)); bowl.position.set(x, 1.3, 0); g.add(bowl); const flame = new T.Mesh(new T.OctahedronGeometry(0.22, 0), basic(col)); flame.position.set(x, 1.7, 0); g.add(flame); }
      G.add(g); P.altar = { a, g };
    }
    for (const c of world.cchests) {
      const g = new T.Group(); g.position.set(c.x, c.y, c.z);
      const body = new T.Mesh(new T.BoxGeometry(1.5, 0.9, 1.0), lambert(0x7a5a3a)); body.position.y = 0.45; g.add(body);
      const lid = new T.Mesh(new T.BoxGeometry(1.6, 0.35, 1.1), lambert(0x9a7a4a)); lid.position.y = 1.05; g.add(lid);
      const trim = new T.Mesh(new T.BoxGeometry(1.7, 0.18, 1.2), basic(RARITY[c.rarity])); trim.position.y = 0.8; g.add(trim);
      G.add(g); P.chests.push({ c, g });
    }
  }

  update(g) {
    if (this.world !== g.world) this._build(g.world);
    const P = this.parts, d = this.d, t = g.t;
    let n = 0, b = 0;
    for (const v of g.world.vases) {
      if (!v.alive) continue; d.position.set(v.x, v.y, v.z); d.rotation.set(0, v.x * 3, 0); d.scale.set(1, 1, 1); d.updateMatrix();
      if (v.banded) this.banded.setMatrixAt(b++, d.matrix); else this.vases.setMatrixAt(n++, d.matrix);
    }
    this.vases.count = n; this.banded.count = b; this.vases.instanceMatrix.needsUpdate = this.banded.instanceMatrix.needsUpdate = true;
    for (const o of P.stones) { o.gem.visible = !o.s.used; o.gem.rotation.y = t * 2; o.gem.position.y = 1.4 + Math.sin(t * 2) * 0.1; }
    if (P.broker) P.broker.plinths.forEach((m, k) => { const st = g.world.broker.stock[k]; m.visible = !st.sold; m.rotation.y = t * 2 + k; m.position.y = 1.3 + Math.sin(t * 2 + k) * 0.06; });
    for (const o of P.shrines) {
      const p = o.s.charge / E.shrines.hold;
      if (Math.abs(p - o.lastP) > 0.008) { o.lastP = p; o.fill.geometry.dispose(); o.fill.geometry = new T.RingGeometry(E.shrines.radius - 0.25, E.shrines.radius, 48, 1, 0, Math.max(0.01, p * Math.PI * 2)); }
      o.water.material.color.setHex(o.s.done ? 0x555555 : p > 0 ? 0xbfffe8 : 0x5fd2a8);
    }
    for (const o of P.chests) o.g.visible = !o.c.open;
    if (P.altar) P.altar.g.children.forEach(m => { if (m.geometry && m.geometry.type === 'OctahedronGeometry') m.rotation.y = t * 2; });
  }
}
