// Top-right minimap: a height-shaded picture of the whole kingdom (north up), district names,
// enemy dots, and the duelist's position with an arrow for the camera facing.
import { MAP } from '../data/map.js';
import { heightAt, WALL } from '../sim/terrain.js';

const SIZE = 168, TEX = 200;

export class Minimap {
  constructor(canvas) {
    this.cv = canvas; canvas.width = SIZE; canvas.height = SIZE; this.ctx = canvas.getContext('2d');
    this.base = document.createElement('canvas'); this.base.width = this.base.height = SIZE; this.map = null;
  }
  setMap(map) { this.map = map; this._paint(); }
  _paint() {
    const tex = document.createElement('canvas'); tex.width = tex.height = TEX;
    const tc = tex.getContext('2d'), img = tc.createImageData(TEX, TEX), span = MAP.half * 2 / TEX;
    for (let j = 0; j < TEX; j++) for (let i = 0; i < TEX; i++) {
      const x = -MAP.half + (i + 0.5) * span, z = -MAP.half + (j + 0.5) * span, h = heightAt(x, z), o = (j * TEX + i) * 4;
      let r, g, b;
      if (h >= WALL) { r = 40; g = 28; b = 22; }
      else { const k = Math.min(1, h / 30); r = 150 + k * 100; g = 115 + k * 105; b = 70 + k * 100; if (h > 0) { r *= 0.92; g *= 0.92; b *= 0.92; } }
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    tc.putImageData(img, 0, 0);
    const c = this.base.getContext('2d'); c.imageSmoothingEnabled = false;
    c.drawImage(tex, 0, 0, SIZE, SIZE);
    const s = SIZE / (MAP.half * 2), X = x => (x + MAP.half) * s;
    c.lineWidth = 1.5; c.font = 'bold 9px "Courier New", monospace'; c.textAlign = 'center';
    (this.map ? this.map.districts : []).forEach(d => {
      c.strokeStyle = d.color;
      let lx, ly;
      if (d.shape === 'circle') { c.beginPath(); c.arc(X(d.cx), X(d.cz), d.r * s, 0, 7); c.stroke(); lx = X(d.cx); ly = X(d.cz) + 3; }
      else { c.strokeRect(X(d.x0), X(d.z0), (d.x1 - d.x0) * s, (d.z1 - d.z0) * s); lx = X((d.x0 + d.x1) / 2); ly = X((d.z0 + d.z1) / 2) + 3; }
      c.lineWidth = 3; c.strokeStyle = '#000b'; c.strokeText(d.short, lx, ly); c.lineWidth = 1.5;
      c.fillStyle = d.color; c.fillText(d.short, lx, ly);
    });
  }
  draw(g, yaw) {
    const c = this.ctx, s = SIZE / (MAP.half * 2), X = x => (x + MAP.half) * s;
    c.drawImage(this.base, 0, 0);
    c.fillStyle = '#e0452c';
    const e = g.en;
    for (let i = 0; i < e.max; i++) if (e.alive[i]) c.fillRect(X(e.x[i]) - 1, X(e.z[i]) - 1, 2, 2);
    if (g.map && g.map.gate && g.mode !== 'classic') { const gx = X(g.map.gate.x), gz = X(g.map.gate.z); c.fillStyle = g.gate && g.gate.awake ? '#ff5a3a' : '#a04a3a'; c.fillRect(gx - 3, gz - 3, 6, 6); c.strokeStyle = '#000'; c.lineWidth = 1; c.strokeRect(gx - 3, gz - 3, 6, 6); }
    for (const ch of g.chests) if (ch.guaranteed && !ch.open) {                  // the Fusion chest: a gold diamond that blinks
      const cx = X(ch.x), cz = X(ch.z); c.fillStyle = (Math.floor(performance.now() / 350) % 2) ? '#ffe08a' : '#ff9d2a'; c.beginPath(); c.moveTo(cx, cz - 5); c.lineTo(cx + 4, cz); c.lineTo(cx, cz + 5); c.lineTo(cx - 4, cz); c.closePath(); c.fill(); c.lineWidth = 1; c.strokeStyle = '#000'; c.stroke();
    }
    const px = X(g.p.x), pz = X(g.p.z), fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    c.save(); c.translate(px, pz); c.rotate(Math.atan2(fx, -fz));    // arrow points toward the camera facing
    c.beginPath(); c.moveTo(0, -7); c.lineTo(4.5, 5); c.lineTo(0, 2.5); c.lineTo(-4.5, 5); c.closePath();
    c.fillStyle = '#fff'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#000'; c.stroke(); c.restore();
  }
}
