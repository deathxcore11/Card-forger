// Top-down PNG of a generated map: height shading, cliff edges, spawn (green), gate (red), boss rings (yellow), encounters (coloured dots).
//   node tools/gen-render.mjs <seed> [stage] [out.png]       one map
//   node tools/gen-render.mjs sheet <seed0> <count> [stage] [out.png]   a contact sheet of consecutive seeds
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { generateStage } from '../src/gen/generate.js';
import { rasterizeInto } from '../src/sim/raster.js';

const N = 400, HALF = 200;
function crc32(buf) { let c, crc = -1; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 255; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ -1) >>> 0; }
function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const chunk = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4); data.copy(b, 8); b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const COL = { cchest: [255, 150, 30], stone: [255, 255, 255], broker: [60, 140, 255], shrine: [190, 80, 255], altar: [255, 90, 160], vase: [150, 90, 40] };

export function renderMap(map, scale = 2) {
  const grid = new Float32Array(N * N); rasterizeInto(grid, N, HALF, map.prims, 195);
  const W = N * scale, img = Buffer.alloc(W * W * 3);
  const set = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= W) return; const o = (y * W + x) * 3; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const h = grid[j * N + i]; let c;
    if (h >= 50) c = [30, 24, 20];
    else { const k = Math.min(1, h / 12); c = [Math.round(205 - 90 * k), Math.round(175 - 80 * k), Math.round(120 - 60 * k)]; if (h > 0.05) { c = [c[0] * 0.92, c[1] * 0.92, c[2] * 0.92]; } }
    const hr = i + 1 < N ? Math.abs(grid[j * N + i + 1] - h) : 0, hd = j + 1 < N ? Math.abs(grid[(j + 1) * N + i] - h) : 0;
    if (h < 50 && (hr > 0.75 || hd > 0.75)) c = [60, 40, 30];                                  // cliff edge
    for (let a = 0; a < scale; a++) for (let b = 0; b < scale; b++) set(i * scale + a, j * scale + b, c);
  }
  const X = v => Math.round((v + HALF) * scale), disc = (x, z, r, c, ring) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const d = dx * dx + dy * dy; if (ring ? d <= r * r && d >= (r - 2) * (r - 2) : d <= r * r) set(X(x) + dx, X(z) + dy, c); } };
  for (const r of map.bossRings) disc(r.x, r.z, Math.round(r.r * scale), [255, 220, 40], true);
  for (const e of map.encounters || []) disc(e.x, e.z, e.type === 'vase' ? 1 : 3, COL[e.type] || [0, 0, 0]);
  disc(map.spawn.x, map.spawn.z, 7, [30, 200, 60]); disc(map.gate.x, map.gate.z, 8, [230, 40, 40]);
  return png(W, W, img);
}

if (process.argv[1] && process.argv[1].endsWith('gen-render.mjs')) {
  const a = process.argv.slice(2);
  if (a[0] === 'sheet') {
    const s0 = +a[1], n = +a[2], stage = +(a[3] || 0), out = a[4] || 'sheet.png', cols = Math.ceil(Math.sqrt(n)), sc = 1, cell = N * sc, W = cols * cell, H = Math.ceil(n / cols) * cell, img = Buffer.alloc(W * H * 3, 20);
    for (let k = 0; k < n; k++) {
      const m = generateStage(s0 + k, stage), grid = new Float32Array(N * N); rasterizeInto(grid, N, HALF, m.prims, 195);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const h = grid[j * N + i]; let c = h >= 50 ? [30, 24, 20] : [Math.round(205 - 90 * Math.min(1, h / 12)), Math.round(175 - 80 * Math.min(1, h / 12)), Math.round(120 - 60 * Math.min(1, h / 12))]; const ox = (k % cols) * cell + i, oy = Math.floor(k / cols) * cell + j, o = (oy * W + ox) * 3; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; }
      const put = (x, z, r, c) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) { const ox = (k % cols) * cell + Math.round(x + HALF) + dx, oy = Math.floor(k / cols) * cell + Math.round(z + HALF) + dy, o = (oy * W + ox) * 3; if (ox >= 0 && oy >= 0 && o + 2 < img.length) { img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; } } };
      put(m.spawn.x, m.spawn.z, 5, [30, 200, 60]); put(m.gate.x, m.gate.z, 6, [230, 40, 40]); for (const e of m.encounters || []) if (e.type !== 'vase') put(e.x, e.z, 2, COL[e.type]);
    }
    writeFileSync(out, png(W, H, img)); console.log('wrote', out, n, 'maps');
  } else { const seed = +(a[0] || 1), stage = +(a[1] || 0), out = a[2] || 'map.png', m = generateStage(seed, stage); writeFileSync(out, renderMap(m)); console.log('wrote', out, m.sealCode, 'hash', m.hash, 'kits', m.report.kits && m.report.kits.join(',')); }
}
