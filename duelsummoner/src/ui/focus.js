// The focus engine (menus-spec 3.1 and 3.2). Pure logic: no DOM, no clock of its own (every call that needs time takes `now` in ms), so the same file runs in Node, the browser and QuickJS.
// A screen is described as a layer: { id, nodes: [{ id, x, y, w, h, region, disabled }], regions: { name: { kind: 'grid'|'list'|'tabs'|'value', next: { up, down, left, right }, pages?: { page, count } } } }.
// move(dir, now) returns { type: 'move'|'page'|'edge'|'clamp'|'none', id, page? }.
export const DIRS = ['up', 'down', 'left', 'right'];
const V = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const cx = n => n.x + n.w / 2, cy = n => n.y + n.h / 2;

// geometry: the nearest enabled node whose centre lies in a 90 degree cone in the direction, scored by distance along the axis plus twice the distance across it
function geoNext(nodes, from, dir) {
  const [dx, dy] = V[dir]; let best = null, bs = Infinity;
  for (const n of nodes) {
    if (n === from || n.disabled) continue;
    const ax = (cx(n) - cx(from)) * dx + (cy(n) - cy(from)) * dy, cross = Math.abs((cx(n) - cx(from)) * dy) + Math.abs((cy(n) - cy(from)) * dx);
    if (ax <= 0.5 || cross > ax * 1.0 + from.w / 2) continue;
    const s = ax + 2 * cross; if (s < bs) { bs = s; best = n; }
  }
  return best;
}

export class Focus {
  constructor() { this.stack = []; this.memory = new Map(); this.grace = { until: 0, button: null }; }
  get layer() { return this.stack[this.stack.length - 1] || null; }
  node(id) { const L = this.layer; return L ? L.nodes.find(n => n.id === id) || null : null; }
  // open a screen or a sheet. A sheet traps the ring; `opener` is the id to return to. The ring lands on the remembered item, else `first`, else the first enabled item.
  open(layer, opts) {
    const o = opts || {}, top = this.layer; this.stack.push(Object.assign({ opener: o.opener || (top && top.focus) || null, focus: null }, layer));
    const L = this.layer, key = o.memoryKey || L.id, mem = this.memory.get(key), ok = id => id && L.nodes.some(n => n.id === id && !n.disabled);
    L.focus = ok(mem) ? mem : ok(o.first) ? o.first : (L.nodes.find(n => !n.disabled) || {}).id || null; L.memoryKey = key; return L.focus;
  }
  // close the top layer ([B] on a sheet): the ring returns to what opened it; a repeat of the same button within 100 ms is ignored
  close(now, button) {
    const L = this.stack.pop(); if (!L) return null; this.memory.set(L.memoryKey, L.focus); this.grace = { until: (now || 0) + 100, button: button || null };
    const T = this.layer; if (T && L.opener) { const n = T.nodes.find(x => x.id === L.opener && !x.disabled); if (n) T.focus = n.id; } return T ? T.focus : null;
  }
  // true when a press of `button` at `now` should be ignored (it is the echo of the press that closed a layer)
  ignored(button, now) { return this.grace.button === button && now < this.grace.until; }
  set(id) { const L = this.layer; if (L && this.node(id) && !this.node(id).disabled) { L.focus = id; this.memory.set(L.memoryKey, id); } return L ? L.focus : null; }
  move(dir) {
    const L = this.layer; if (!L) return { type: 'none', id: null };
    const cur = this.node(L.focus); if (!cur) { const f = L.nodes.find(n => !n.disabled); if (f) L.focus = f.id; return { type: 'move', id: L.focus }; }
    const reg = (L.regions && L.regions[cur.region]) || { kind: 'grid' }, same = L.nodes.filter(n => n.region === cur.region);
    const go = n => { L.focus = n.id; this.memory.set(L.memoryKey, n.id); return { type: 'move', id: n.id }; };
    if (reg.kind === 'tabs' && (dir === 'left' || dir === 'right')) { const tabs = same.filter(n => !n.disabled), i = tabs.indexOf(cur); return go(tabs[(i + (dir === 'right' ? 1 : tabs.length - 1)) % tabs.length]); }       // tabs wrap
    if (reg.kind === 'value' && (dir === 'left' || dir === 'right')) return { type: 'clamp', id: cur.id, step: dir === 'right' ? 1 : -1 };       // the control steps its own value and clamps at the ends
    const g = geoNext(same, cur, dir); if (g) return go(g);
    if (reg.pages && (dir === 'down' || dir === 'up')) {         // lists and grids do not wrap: past the last row turns the page and lands on its top row; up from the top turns back
      const p = reg.pages; if (dir === 'down' && p.page < p.count - 1) return { type: 'page', id: cur.id, page: p.page + 1, land: 'top' };
      if (dir === 'up' && p.page > 0) return { type: 'page', id: cur.id, page: p.page - 1, land: 'bottom' };
    }
    const next = reg.next && reg.next[dir];                       // between regions: the screen's focus order, to the remembered item of the target region, else the nearest one
    if (next) { const tgt = L.nodes.filter(n => n.region === next && !n.disabled); if (tgt.length) { const memo = tgt.find(n => n.id === (L.regionMemory || {})[next]) || tgt.slice().sort((a, b) => (Math.abs(cx(a) - cx(cur)) + Math.abs(cy(a) - cy(cur))) - (Math.abs(cx(b) - cx(cur)) + Math.abs(cy(b) - cy(cur))))[0]; (L.regionMemory = L.regionMemory || {})[cur.region] = cur.id; return go(memo); } }
    return { type: 'edge', id: cur.id };
  }
}

// Held-direction repeat: first after 300 ms, then every 90 ms, every 60 ms once held for 1 s. poll(now) returns how many moves are due.
export class Repeater {
  constructor() { this.dir = null; this.t0 = 0; this.nextAt = 0; }
  press(dir, now) { this.dir = dir; this.t0 = now; this.nextAt = now + 300; return 1; }       // the press itself moves once
  release() { this.dir = null; }
  poll(now) { if (!this.dir) return 0; let n = 0; while (this.nextAt <= now && n < 20) { n++; this.nextAt += (this.nextAt - this.t0) < 1000 ? 90 : 60; } return n; }
}
// The first d-pad source seen on a device (HAT axis or DPAD keys) wins; the other is ignored, so a pad that sends both never moves twice.
export class DpadSource {
  constructor() { this.by = new Map(); }
  accept(device, source) { if (!this.by.has(device)) this.by.set(device, source); return this.by.get(device) === source; }
}
// left stick and HAT axes: edge detection at 0.5 (returns 'up'|'down'|'left'|'right' on the frame the axis crosses, else null)
export function axisEdge(prev, cur, thr) { const t = thr || 0.5; if (Math.abs(cur) >= t && Math.abs(prev) < t) return cur < 0 ? -1 : 1; return 0; }
