// A transform for building kits: every kit is written in local coordinates around its own centre, then placed by a 90-degree
// rotation (0 to 3 turns) and an offset. Emits the same primitives the collision and the mesh read (data/map.js).
// A palette function tints colours per stage (warm ruins, cool catacombs, gold and black vault).
export class Kit {
  constructor(out, ox, oz, rot, tint) { this.out = out; this.ox = ox; this.oz = oz; this.rot = rot & 3; this.tint = tint || (c => c); }
  pt(x, z) {                                                    // (x, z) -> (-z, x) per quarter turn, then move
    let a = x, b = z; for (let i = 0; i < this.rot; i++) { const t = a; a = -b; b = t; }
    return [a + this.ox, b + this.oz];
  }
  push(p) { p.c = this.tint(p.c); this.out.push(p); }
  box(x0, z0, x1, z1, h, c, o) {
    o = o || {};
    if (o.rot) {                                                // a tilted slab: keep its extents, turn the slab
      const [cx, cz] = this.pt((x0 + x1) / 2, (z0 + z1) / 2), hw = (x1 - x0) / 2, hd = (z1 - z0) / 2;
      this.push(Object.assign({ t: 'box', x0: cx - hw, z0: cz - hd, x1: cx + hw, z1: cz + hd, h, c }, o, { rot: (o.rot + 90 * this.rot) % 360 })); return;
    }
    const [ax, az] = this.pt(x0, z0), [bx, bz] = this.pt(x1, z1);
    this.push(Object.assign({ t: 'box', x0: Math.min(ax, bx), z0: Math.min(az, bz), x1: Math.max(ax, bx), z1: Math.max(az, bz), h, c }, o));
  }
  ramp(axis, a0, a1, b0, b1, h0, h1, c, o) {
    const bm = (b0 + b1) / 2, hw = (b1 - b0) / 2;
    const S = axis === 'x' ? this.pt(a0, bm) : this.pt(bm, a0), E = axis === 'x' ? this.pt(a1, bm) : this.pt(bm, a1);
    const nx = Math.abs(E[0] - S[0]) > Math.abs(E[1] - S[1]), ax = nx ? 'x' : 'z', i = nx ? 0 : 1, j = nx ? 1 : 0;
    this.push(Object.assign({ t: 'ramp', axis: ax, a0: S[i], a1: E[i], b0: S[j] - hw, b1: S[j] + hw, h0, h1, c }, o));
  }
  ring(r0, r1, a0, a1, h, c, o) {
    o = o || {}; const [cx, cz] = this.pt(o.cx || 0, o.cz || 0), d = this.rot * 90;
    let s = a0 + d, e = a1 + d; while (s >= 360) { s -= 360; e -= 360; }
    const one = (u, v) => this.push(Object.assign({ t: 'ring', cx, cz, r0, r1, a0: u, a1: v, h, c }, o, { cx, cz }));
    if (e > 360) { one(s, 360); one(0, e - 360); } else one(s, e);
  }
  cyl(x, z, r, h, c, o) { const [px, pz] = this.pt(x, z); this.push(Object.assign({ t: 'cyl', x: px, z: pz, r, h, c }, o)); }
}
