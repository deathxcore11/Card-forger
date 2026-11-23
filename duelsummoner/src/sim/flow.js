// Flow field for ground enemies: a breadth-first walk outward from the duelist over 2 m cells.
// A step is allowed when the climb is gentle (ramps) and drops of any size are allowed (enemies jump off ledges).
import { MAP } from '../data/map.js';
import { CFG } from '../data/config.js';
import { buildCells, WALL, heightAt } from './terrain.js';

const MAX_CLIMB = 0.72, LANE_CLIMB = 0.62, NEAR = 3, FAR = 32000;     // LANE_CLIMB: the step a walker can make between two 1 m samples (a little over its 0.55 m step-up)

export class Flow {
  constructor() {
    this.cells = buildCells(CFG.path.cell);
    this.W = CFG.path.span;
    this.dist = new Int16Array(this.W * this.W);
    this.queue = new Int32Array(this.W * this.W);
    this.ox = 0; this.oz = 0; this.valid = false; this.col = null; this._buildPass();
  }
  // A per-edge pass mask from the 1 m lanes: bit 0 +x, 1 -x, 2 +z, 3 -z is set when a walker standing in this cell can step across that edge, because some 1 m lane
  // along it climbs no more than a walker's step (drops are always fine). The old test compared whole-cell heights, so every 1:2 ramp read as a wall.
  _buildPass() {
    const c = this.cells, n = c.n, s = c.size; this.pass = new Uint8Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x0 = i * s - MAP.half, z0 = j * s - MAP.half; let m = 0;
      for (let d = 0; d < 4; d++) {
        let ok = false;
        for (let k = 0; k < s && !ok; k++) {        // a lane runs across this cell in the direction of travel and one sample into the next: no step in it may climb more than a walker's step (this also catches a cliff inside the cell)
          let prev = -1e9, good = true;
          for (let t = 0; t <= s && good; t++) {
            let x, z; if (d === 0) { x = x0 + t + 0.5; z = z0 + k + 0.5; } else if (d === 1) { x = x0 + s - t - 0.5; z = z0 + k + 0.5; } else if (d === 2) { x = x0 + k + 0.5; z = z0 + t + 0.5; } else { x = x0 + k + 0.5; z = z0 + s - t - 0.5; }
            const h = heightAt(x, z); if (h >= 50 || (prev > -1e8 && h - prev > LANE_CLIMB)) good = false; prev = h;
          }
          if (good) ok = true;
        }
        if (ok) m |= 1 << d;
      }
      this.pass[j * n + i] = m;
    }
  }
  rebuild() { this.cells = buildCells(CFG.path.cell); this._buildPass(); this.stamp(); this.valid = false; }
  // every solid prop (inflated by an enemy's radius) is a wall in the flow field, so a horde goes round a trunk or a boulder, not through it
  stamp() {
    const col = this.col, c = this.cells; if (!col) return; const size = c.size, n = c.n, pad = 0.7 + size * 0.35;
    for (const o of col.list) {
      const rr = o.r + pad, i0 = Math.max(0, Math.floor((o.x - rr + MAP.half) / size)), i1 = Math.min(n - 1, Math.floor((o.x + rr + MAP.half) / size)), j0 = Math.max(0, Math.floor((o.z - rr + MAP.half) / size)), j1 = Math.min(n - 1, Math.floor((o.z + rr + MAP.half) / size));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const cx = (i + 0.5) * size - MAP.half - o.x, cz = (j + 0.5) * size - MAP.half - o.z; if (cx * cx + cz * cz < rr * rr) c.h[j * n + i] = WALL; }
    }
  }                    // after a new map is loaded
  _cell(v) { return Math.floor((v + MAP.half) / this.cells.size); }
  update(px, pz) {
    const c = this.cells, n = c.n, W = this.W, dist = this.dist, q = this.queue, h = c.h;
    const pcx = Math.max(0, Math.min(n - 1, this._cell(px))), pcz = Math.max(0, Math.min(n - 1, this._cell(pz)));
    this.ox = Math.max(0, Math.min(n - W, pcx - (W >> 1))); this.oz = Math.max(0, Math.min(n - W, pcz - (W >> 1)));
    const sx = pcx - this.ox, sz = pcz - this.oz;
    // First pass honours the climb limit everywhere. If that leaves the duelist boxed in (standing on a roof),
    // run again letting enemies path to the foot of the wall right beside them.
    let reached = this._fill(sx, sz, false);
    if (reached < 400) this._fill(sx, sz, true);
    this.valid = true;
  }
  _fill(sx, sz, lenient) {
    const c = this.cells, n = c.n, W = this.W, dist = this.dist, q = this.queue, h = c.h;
    dist.fill(FAR);
    let head = 0, tail = 0;
    dist[sz * W + sx] = 0; q[tail++] = sz * W + sx;
    while (head < tail) {
      const b = q[head++], bx = b % W, bz = (b / W) | 0, db = dist[b];
      const hb = h[(bz + this.oz) * n + bx + this.ox];
      for (let k = 0; k < 4; k++) {
        const ax = bx + (k === 0 ? 1 : k === 1 ? -1 : 0), az = bz + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (ax < 0 || az < 0 || ax >= W || az >= W) continue;
        const a = az * W + ax;
        if (dist[a] !== FAR) continue;
        const ha = h[(az + this.oz) * n + ax + this.ox];
        if (ha >= 50) continue;                                   // solid boundary
        const dirAB = k === 0 ? 1 : k === 1 ? 0 : k === 2 ? 3 : 2;           // from a back toward b (a is the farther cell)
        if (!((this.pass[(az + this.oz) * n + ax + this.ox] >> dirAB) & 1) && !(lenient && db < NEAR)) continue;           // no 1 m lane a walker can climb (except right beside the duelist)
        dist[a] = db + 1; q[tail++] = a;
      }
    }
    return tail;
  }
  // Writes the centre of the next cell toward the duelist into out.{x,z}; returns false if there is no route.
  next(x, z, out) {
    if (!this.valid) return false;
    const W = this.W, c = this.cells, size = c.size;
    const lx = this._cell(x) - this.ox, lz = this._cell(z) - this.oz;
    if (lx < 0 || lz < 0 || lx >= W || lz >= W) return false;
    const d = this.dist[lz * W + lx];
    if (d >= FAR) return false;
    let best = d, bx = lx, bz = lz;
    const here = c.h[(lz + this.oz) * c.n + lx + this.ox];
    for (let k = 0; k < 4; k++) {
      const ax = lx + (k === 0 ? 1 : k === 1 ? -1 : 0), az = lz + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (ax < 0 || az < 0 || ax >= W || az >= W) continue;
      const da = this.dist[az * W + ax];
      if (!((this.pass[(lz + this.oz) * c.n + lx + this.ox] >> k) & 1) && da >= NEAR) continue;   // never walk into a wall
      if (da < best) { best = da; bx = ax; bz = az; }
    }
    if (best >= d) return false;
    out.x = (bx + this.ox) * size - MAP.half + size / 2; out.z = (bz + this.oz) * size - MAP.half + size / 2;
    return true;
  }
}
export { WALL };




