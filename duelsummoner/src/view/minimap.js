// The minimap and the full map: a height-shaded picture of the stage (north up), under a fog of war. Unexplored ground is hidden; the Gate, chests, stones, the broker and enemies
// show only on explored ground. The same drawing serves the small round disc in the corner and the big map screen.
import { MAP } from '../data/map.js';
import { heightAt, WALL } from '../sim/terrain.js';
import { exploredAt } from '../sim/fog.js';

const SIZE = 168, TEX = 220;

function paintBase(size, map) {
  const base = document.createElement('canvas'); base.width = base.height = size;
  const tex = document.createElement('canvas'); tex.width = tex.height = TEX;
  const tc = tex.getContext('2d'), img = tc.createImageData(TEX, TEX), span = MAP.half * 2 / TEX;
  const v2 = map && map.heights, TIER = [[168, 138, 88], [196, 166, 108], [214, 190, 132], [226, 208, 158], [236, 224, 186], [244, 238, 214]];
  for (let j = 0; j < TEX; j++) for (let i = 0; i < TEX; i++) {
    const x = -MAP.half + (i + 0.5) * span, z = -MAP.half + (j + 0.5) * span, h = heightAt(x, z), o = (j * TEX + i) * 4;
    let r, g, b;
    if (h >= WALL) { r = 40; g = 28; b = 22; }
    else if (v2) {                                                                         // a designed map: tiers as tones (a step every 3 m), cliffs as dark lines, the arena bright, ramps and the road in their own tone, pits dark
      const t = TIER[Math.max(0, Math.min(5, Math.floor(h / 3) + 1))]; r = t[0]; g = t[1]; b = t[2]; if (h < -0.3) { r *= 0.6; g *= 0.6; b *= 0.6; }
      let cliff = 0; for (const [dx, dz] of [[span, 0], [0, span], [-span, 0], [0, -span]]) { const q = heightAt(x + dx, z + dz); if (q < WALL && Math.abs(q - h) > 1.6) cliff = 1; else if (q >= WALL && h < WALL) cliff = 2; }
      if (cliff === 1) { r *= 0.38; g *= 0.34; b *= 0.3; } else if (cliff === 2) { r = 70; g = 52; b = 40; }
      const k = (Math.floor(z + MAP.half)) * 400 + Math.floor(x + MAP.half), fl = map.cellFlags[k]; if (fl & 8) { r = 210; g = 150; b = 90; } else if (fl & 256) { r = Math.min(255, r + 30); g = Math.min(255, g + 30); b = Math.min(255, b + 40); }
    }
    else { const k = Math.min(1, h / 30); r = 150 + k * 100; g = 115 + k * 105; b = 70 + k * 100; if (h > 0) { r *= 0.92; g *= 0.92; b *= 0.92; } }
    img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
  }  tc.putImageData(img, 0, 0);
  const c = base.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(tex, 0, 0, size, size);
  const s = size / (MAP.half * 2), X = x => (x + MAP.half) * s, big = size > 300;
  c.lineWidth = big ? 2 : 1.5; c.font = (big ? 'bold 15px' : 'bold 9px') + ' "Courier New", monospace'; c.textAlign = 'center';
  if (v2 && map._road) { c.strokeStyle = '#7a5a30'; c.lineWidth = big ? 3 : 2; c.beginPath(); map._road.main.forEach((q, k) => { if (k) c.lineTo(X(q[0]), X(q[1])); else c.moveTo(X(q[0]), X(q[1])); }); c.stroke(); }
  (map ? map.districts : []).forEach(d => {
    c.strokeStyle = d.color; let lx, ly;
    if (v2) { lx = X(d.cx); ly = X(d.cz) + 3; }       // a designed map names its districts (the full name on the big map), no outline
    else if (d.shape === 'circle') { c.beginPath(); c.arc(X(d.cx), X(d.cz), d.r * s, 0, 7); c.stroke(); lx = X(d.cx); ly = X(d.cz) + 3; }
    else { c.strokeRect(X(d.x0), X(d.z0), (d.x1 - d.x0) * s, (d.z1 - d.z0) * s); lx = X((d.x0 + d.x1) / 2); ly = X((d.z0 + d.z1) / 2) + 3; }
    c.lineWidth = big ? 4 : 3; c.strokeStyle = '#000b'; const label = v2 && big ? d.name : d.short; c.strokeText(label, lx, ly); c.lineWidth = big ? 2 : 1.5; c.fillStyle = d.color; c.fillText(label, lx, ly);
  });
  return base;
}

export class Minimap {
  constructor(canvas) {
    this.cv = canvas; canvas.width = SIZE; canvas.height = SIZE; this.ctx = canvas.getContext('2d'); this.map = null; this.base = null; this.big = null;
    this.tiny = document.createElement('canvas'); this.tinyV = -1; this.tinyKey = null;                     // the fog, one pixel per cell, scaled up with smoothing so its edge is soft
  }
  setMap(map) { this.map = map; this.base = paintBase(SIZE, map); this.big = null; this.tinyV = -1; }
  _fog(g) {
    const f = g.fog; if (!f) return null; if (this.tiny.width !== f.n) this.tiny.width = this.tiny.height = f.n;
    if (this.tinyV !== f.version || this.tinyKey !== f) {
      const c = this.tiny.getContext('2d'), img = c.createImageData(f.n, f.n);
      for (let k = 0; k < f.cells.length; k++) { const o = k * 4; img.data[o] = 12; img.data[o + 1] = 10; img.data[o + 2] = 18; img.data[o + 3] = f.cells[k] ? 0 : 238; }
      c.putImageData(img, 0, 0); this.tinyV = f.version; this.tinyKey = f;
    }
    return this.tiny;
  }
  _icons(c, size, g, yaw, big) {
    const s = size / (MAP.half * 2), X = x => (x + MAP.half) * s, ex = (x, z) => exploredAt(g.fog, x, z), sq = (x, z, col, r) => { c.fillStyle = col; c.fillRect(X(x) - r, X(z) - r, r * 2, r * 2); c.lineWidth = 1; c.strokeStyle = '#000'; c.strokeRect(X(x) - r, X(z) - r, r * 2, r * 2); };
    const r0 = big ? 4 : 2.5;
    c.fillStyle = '#e0452c'; const e = g.en; for (let i = 0; i < e.max; i++) if (e.alive[i] && ex(e.x[i], e.z[i])) c.fillRect(X(e.x[i]) - 1, X(e.z[i]) - 1, 2, 2);
    const W = g.world;
    if (W) {
      for (const k of W.cchests || []) if (ex(k.x, k.z)) sq(k.x, k.z, k.open ? '#7a7a86' : k.free || k.trophy ? '#ffffff' : '#ffd23f', r0);          // chests
      if (W.relic && !W.relic.taken && ex(W.relic.x, W.relic.z)) {                                                           // the screen-clear relic: a white four-point star with a dark edge, 1.6 times a chest mark, only once the ground there is explored
      const cx = X(W.relic.x), cy = X(W.relic.z), R = r0 * 1.6 * 1.5, q = R * 0.28; c.beginPath(); c.moveTo(cx, cy - R); c.lineTo(cx + q, cy - q); c.lineTo(cx + R, cy); c.lineTo(cx + q, cy + q); c.lineTo(cx, cy + R); c.lineTo(cx - q, cy + q); c.lineTo(cx - R, cy); c.lineTo(cx - q, cy - q); c.closePath();
      c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#1a1020'; c.stroke();
    }
  for (const k of W.stones || []) if (ex(k.x, k.z)) sq(k.x, k.z, k.used ? '#6a6a72' : '#ffffff', r0);                                // Witness Stones: cyan, grey once used (they stay on the map so you know)
      for (const k of W.shrines || []) if (ex(k.x, k.z)) { const x = X(k.x), z = X(k.z); c.strokeStyle = k.done ? '#6a6a72' : '#ffffff'; c.lineWidth = big ? 3 : 2; c.beginPath(); c.arc(x, z, r0 + 1, 0, 7); c.stroke(); }          // Shrines of Tribute: a ring, grey once done
      if (W.broker && ex(W.broker.x, W.broker.z)) sq(W.broker.x, W.broker.z, '#ffd23f', r0);                                          // the Broker
      if (W.altar && !W.altar.used && ex(W.altar.x, W.altar.z)) sq(W.altar.x, W.altar.z, '#c9a0ff', r0);                              // the Altar
    }
    if (g.map && g.map.gate && g.mode !== 'classic' && ((g.gate && g.gate.awake) || ex(g.map.gate.x, g.map.gate.z))) { const gx = X(g.map.gate.x), gz = X(g.map.gate.z), r = big ? 7 : 3.5; c.fillStyle = g.gate && g.gate.awake ? '#ff5a3a' : '#c0503a'; c.fillRect(gx - r, gz - r, r * 2, r * 2); c.strokeStyle = '#000'; c.lineWidth = 1; c.strokeRect(gx - r, gz - r, r * 2, r * 2); }
    if (g.map && g.map.gate && g.mode !== 'classic' && !((g.gate && g.gate.awake) || ex(g.map.gate.x, g.map.gate.z))) {       // the gate is not on the map yet: an arrow on the edge shows which way it is, from the first second
      const gx = X(g.map.gate.x), gz = X(g.map.gate.z), pxx = X(g.p.x), pzz = X(g.p.z), dx = gx - pxx, dz = gz - pzz, m = (big ? 16 : 9), k = Math.min((size / 2 - m) / (Math.abs(dx) || 1e-6), (size / 2 - m) / (Math.abs(dz) || 1e-6), 1e9);
      const ex2 = size / 2 + dx * Math.min(k, 1e9) , ez2 = size / 2 + dz * Math.min(k, 1e9), q = big ? 1.8 : 1; const dxm = gx - size / 2, dzm = gz - size / 2, kk = Math.min((size / 2 - m) / (Math.abs(dxm) || 1e-6), (size / 2 - m) / (Math.abs(dzm) || 1e-6));
      c.save(); c.translate(size / 2 + dxm * kk, size / 2 + dzm * kk); c.rotate(Math.atan2(dxm, -dzm)); c.scale(q, q); c.beginPath(); c.moveTo(0, -6); c.lineTo(5, 5); c.lineTo(0, 2); c.lineTo(-5, 5); c.closePath(); c.fillStyle = '#e0503a'; c.fill(); c.lineWidth = 1; c.strokeStyle = '#000'; c.stroke(); c.restore();
    }
    for (const ch of g.chests) if (ch.guaranteed && !ch.open) {
      const cx = X(ch.x), cz = X(ch.z), q = big ? 1.7 : 1; c.fillStyle = (Math.floor(performance.now() / 350) % 2) ? '#ffe08a' : '#ff9d2a'; c.beginPath(); c.moveTo(cx, cz - 5 * q); c.lineTo(cx + 4 * q, cz); c.lineTo(cx, cz + 5 * q); c.lineTo(cx - 4 * q, cz); c.closePath(); c.fill(); c.lineWidth = 1; c.strokeStyle = '#000'; c.stroke();
    }
    const px = X(g.p.x), pz = X(g.p.z), fx = -Math.sin(yaw), fz = -Math.cos(yaw), q = big ? 1.8 : 1;
    c.save(); c.translate(px, pz); c.rotate(Math.atan2(fx, -fz)); c.scale(q, q);
    c.beginPath(); c.moveTo(0, -7); c.lineTo(4.5, 5); c.lineTo(0, 2.5); c.lineTo(-4.5, 5); c.closePath();
    c.fillStyle = '#fff'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#000'; c.stroke(); c.restore();
  }
  _render(c, size, base, g, yaw, big) {
    c.imageSmoothingEnabled = false; c.drawImage(base, 0, 0, size, size);
    const fog = this._fog(g); if (fog) { c.imageSmoothingEnabled = true; c.drawImage(fog, 0, 0, size, size); c.imageSmoothingEnabled = false; }
    this._icons(c, size, g, yaw, big);
  }
  draw(g, yaw) { if (this.base) this._render(this.ctx, SIZE, this.base, g, yaw, false); }
  drawFull(canvas, g, yaw) {
    const size = canvas.width; if (!this.big || this.big.width !== size) this.big = paintBase(size, this.map);
    this._render(canvas.getContext('2d'), size, this.big, g, yaw, true);
  }
}

