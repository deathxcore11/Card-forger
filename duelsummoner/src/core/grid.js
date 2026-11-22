// Uniform spatial hash over the x/z plane, rebuilt every tick with a counting sort (no allocation).
export class SpatialGrid {
  constructor(cell, half, maxItems) {
    this.cs = cell; this.half = half; this.n = Math.ceil((half * 2) / cell);
    this.start = new Int32Array(this.n * this.n + 1);
    this.items = new Int32Array(maxItems);
    this.cellOf = new Int32Array(maxItems);
  }
  _c(v) { let c = Math.floor((v + this.half) / this.cs); return c < 0 ? 0 : c >= this.n ? this.n - 1 : c; }
  rebuild(count, xs, zs, alive) {
    const n = this.n, start = this.start;
    start.fill(0);
    for (let i = 0; i < count; i++) {
      if (!alive[i]) { this.cellOf[i] = -1; continue; }
      const c = this._c(zs[i]) * n + this._c(xs[i]);
      this.cellOf[i] = c; start[c + 1]++;
    }
    for (let c = 0; c < n * n; c++) start[c + 1] += start[c];
    const fill = this._fill || (this._fill = new Int32Array(n * n));
    fill.fill(0);
    for (let i = 0; i < count; i++) {
      const c = this.cellOf[i]; if (c < 0) continue;
      this.items[start[c] + fill[c]++] = i;
    }
  }
  // Fill out[] with indices whose cell lies within r of (x,z); returns how many. Callers do the exact distance test.
  query(x, z, r, out) {
    const n = this.n, c0 = this._c(x - r), c1 = this._c(x + r), r0 = this._c(z - r), r1 = this._c(z + r);
    let k = 0;
    for (let cz = r0; cz <= r1; cz++) for (let cx = c0; cx <= c1; cx++) {
      const c = cz * n + cx;
      for (let s = this.start[c], e = this.start[c + 1]; s < e && k < out.length; s++) out[k++] = this.items[s];
    }
    return k;
  }
}
