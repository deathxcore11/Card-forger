// Graph search primitives: Dial bucket queue, Dijkstra / BFS over CSR graphs, reverse CSR,
// and an implicit layer-0 walk search used before the full graph exists.
import { F } from './map.js';

export const INF = 0x3FFFFFFF;

export class Dial {
  constructor(B = 256) { this.B = B; this.mask = B - 1; this.head = new Int32Array(B).fill(-1); this.cap = 1 << 16; this.node = new Int32Array(this.cap); this.nxt = new Int32Array(this.cap); this.free = -1; this.used = 0; this.count = 0; this.cur = 0; }
  reset() { this.head.fill(-1); this.free = -1; this.used = 0; this.count = 0; this.cur = 0; }
  push(d, v) {
    let e;
    if (this.free >= 0) { e = this.free; this.free = this.nxt[e]; }
    else { if (this.used >= this.cap) { const n2 = new Int32Array(this.cap * 2); n2.set(this.node); this.node = n2; const x2 = new Int32Array(this.cap * 2); x2.set(this.nxt); this.nxt = x2; this.cap *= 2; } e = this.used++; }
    const b = d & this.mask; this.node[e] = v; this.nxt[e] = this.head[b]; this.head[b] = e; this.count++;
  }
  pop() { // returns node, sets this.cur to its distance
    while (this.head[this.cur & this.mask] < 0) this.cur++;
    const b = this.cur & this.mask; const e = this.head[b]; this.head[b] = this.nxt[e];
    this.nxt[e] = this.free; this.free = e; this.count--; return this.node[e];
  }
}
const dialPool = new Dial(256);

// g: {n, off, to, cost, cls}. clsMask: bit (1<<cls) allowed. srcs: array of node ids (or [node, d0] pairs).
export function dijkstra(g, srcs, clsMask, maxD = INF, wantParent = false, blocked = null, out = null) {
  const dist = out || new Int32Array(g.n); dist.fill(INF);
  const par = wantParent ? new Int32Array(g.n).fill(-1) : null;
  const q = dialPool; q.reset();
  for (const s of srcs) { const v = Array.isArray(s) ? s[0] : s, d0 = Array.isArray(s) ? s[1] : 0; if (blocked && blocked[v >> 1]) continue; if (d0 < dist[v]) { dist[v] = d0; q.push(d0, v); } }
  const { off, to, cost, cls } = g;
  while (q.count) {
    const u = q.pop(); const d = q.cur; if (d !== dist[u]) continue; if (d > maxD) break;
    for (let e = off[u]; e < off[u + 1]; e++) {
      if (!((clsMask >> cls[e]) & 1)) continue;
      const v = to[e]; if (blocked && blocked[v >> 1]) continue;
      const nd = d + cost[e];
      if (nd < dist[v] && nd <= maxD) { dist[v] = nd; if (par) par[v] = u; q.push(nd, v); }
    }
  }
  return wantParent ? { dist, par } : dist;
}

export function bfsReach(g, srcs, clsMask) {
  const seen = new Uint8Array(g.n); const q = new Int32Array(g.n); let h = 0, t = 0;
  for (const s of srcs) if (!seen[s]) { seen[s] = 1; q[t++] = s; }
  const { off, to, cls } = g;
  while (h < t) { const u = q[h++]; for (let e = off[u]; e < off[u + 1]; e++) { if (!((clsMask >> cls[e]) & 1)) continue; const v = to[e]; if (!seen[v]) { seen[v] = 1; q[t++] = v; } } }
  return seen;
}

export function reverseCSR(g) {
  const n = g.n; const cnt = new Int32Array(n + 1);
  for (let e = 0; e < g.m; e++) cnt[g.to[e] + 1]++;
  for (let i = 0; i < n; i++) cnt[i + 1] += cnt[i];
  const off = cnt.slice(); const pos = cnt.slice();
  const to = new Int32Array(g.m), cost = new Uint8Array(g.m), cls = new Uint8Array(g.m);
  for (let u = 0; u < n; u++) for (let e = g.off[u]; e < g.off[u + 1]; e++) { const v = g.to[e]; const k = pos[v]++; to[k] = u; cost[k] = g.cost[e]; cls[k] = g.cls[e]; }
  return { n, m: g.m, off, to, cost, cls };
}

// Iterative Tarjan SCC over allowed classes. Returns {comp Int32Array (-1 for isolated non-nodes), count}.
export function tarjan(g, clsMask, isNode) {
  const n = g.n; const index = new Int32Array(n).fill(-1), low = new Int32Array(n), comp = new Int32Array(n).fill(-1);
  const onStack = new Uint8Array(n); const stack = new Int32Array(n); let sp = 0;
  const cs = new Int32Array(n), ce = new Int32Array(n); let idx = 0, count = 0;
  for (let s = 0; s < n; s++) {
    if (index[s] >= 0 || !isNode[s]) continue;
    let top = 0; cs[0] = s; ce[0] = g.off[s]; index[s] = low[s] = idx++; stack[sp++] = s; onStack[s] = 1;
    while (top >= 0) {
      const u = cs[top]; let e = ce[top];
      let pushed = false;
      while (e < g.off[u + 1]) {
        if (!((clsMask >> g.cls[e]) & 1)) { e++; continue; }
        const v = g.to[e]; e++;
        if (index[v] < 0) { ce[top] = e; top++; cs[top] = v; ce[top] = g.off[v]; index[v] = low[v] = idx++; stack[sp++] = v; onStack[v] = 1; pushed = true; break; }
        else if (onStack[v] && index[v] < low[u]) low[u] = index[v];
      }
      if (pushed) continue;
      ce[top] = e;
      if (low[u] === index[u]) { let w; do { w = stack[--sp]; onStack[w] = 0; comp[w] = count; } while (w !== u); count++; }
      top--;
      if (top >= 0) { const p = cs[top]; if (low[u] < low[p]) low[p] = low[u]; }
    }
  }
  return { comp, count };
}

// Implicit layer-0 walk Dijkstra (before the full graph exists). rise: max step in cm.
// allowed(i) gates cells; pen(i) adds cost on entering i. Returns {dist, par}.
const N8 = [[1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [-1, 1, 14], [1, -1, 14], [-1, -1, 14]];
export function walkSearch(m, src, { rise = 70, allowed = null, pen = null, target = -1, maxD = INF, excl = F.PONLY } = {}) {
  const N = m.N, h = m.h0, fl = m.flags; const n = N * N;
  const dist = new Int32Array(n).fill(INF), par = new Int32Array(n).fill(-1);
  const ok = (i) => (fl[i] & F.WALK) && !(fl[i] & excl) && (!allowed || allowed(i));
  const q = dialPool; q.reset();
  for (const s of (Array.isArray(src) ? src : [src])) { if (!ok(s)) continue; dist[s] = 0; q.push(0, s); }
  while (q.count) {
    const u = q.pop(); const d = q.cur; if (d !== dist[u]) continue; if (u === target || d > maxD) break;
    const x = u % N, z = (u / N) | 0;
    for (let k = 0; k < 8; k++) {
      const [dx, dz, c] = N8[k]; const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= N || zz >= N) continue;
      const v = zz * N + xx; if (!ok(v) || Math.abs(h[v] - h[u]) > rise) continue;
      if (k >= 4) { const a = z * N + xx, b = zz * N + x; if (!ok(a) || !ok(b) || Math.abs(h[a] - h[u]) > rise || Math.abs(h[b] - h[u]) > rise) continue; }
      const nd = d + c + (pen ? pen(v) : 0);
      if (nd < dist[v]) { dist[v] = nd; par[v] = u; q.push(nd, v); }
    }
  }
  return { dist, par };
}

export function pathFrom(par, target) { const p = []; for (let v = target; v >= 0; v = par[v]) p.push(v); return p.reverse(); }

