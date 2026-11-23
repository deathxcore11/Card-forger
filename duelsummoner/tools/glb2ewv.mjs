// Bakes a textured GLB (from Meshy) into the game's flat-colour model format (EWV1: one colour per face, no texture, tiny file).
//   node tools/glb2ewv.mjs <in.glb> <out.ewv.b64> [gamma] [facecol.json]    gamma 1 = as painted; 0.6 lifts a too-dark texture; a face colour list (palette hex + one byte per triangle) replaces the sampled texture colours
//   (the EWV1 format keeps 5 bits a channel, so a palette colour is rounded to the nearest of 32 levels)
// Colour per face = the texture averaged at the face centre and the three points halfway to each corner. The model is kept as it is (Y up).
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export function decodePng(buf) {
  let o = 8, w = 0, h = 0, depth = 0, ct = 0, il = 0, idat = [], plte = null, trns = null;
  while (o < buf.length) { const n = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + n); o += 12 + n;
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ct = d[9]; il = d[12]; } else if (type === 'IDAT') idat.push(d); else if (type === 'PLTE') plte = d; else if (type === 'tRNS') trns = d; else if (type === 'IEND') break; }
  if (depth !== 8 || il !== 0 || ![2, 3, 6].includes(ct)) throw new Error('png: only 8-bit, non-interlaced RGB, RGBA or palette is supported (got depth ' + depth + ', type ' + ct + ', interlace ' + il + ')');
  const raw = inflateSync(Buffer.concat(idat)), bpp = ct === 6 ? 4 : ct === 2 ? 3 : 1, stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[dst + x - bpp] : 0, b = y ? px[dst - stride + x] : 0, c = x >= bpp && y ? px[dst - stride + x - bpp] : 0; let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[dst + x] = v & 255;
    }
  }
  const rgb = (x, y) => { const i = y * stride + x * bpp; if (ct === 3) { const k = px[i] * 3; return [plte[k], plte[k + 1], plte[k + 2]]; } return [px[i], px[i + 1], px[i + 2]]; };
  return { w, h, rgb };
}

export function readGlb(buf) {
  const jl = buf.readUInt32LE(12), json = JSON.parse(buf.subarray(20, 20 + jl).toString('utf8').trim()); const bo = 20 + jl; const bl = buf.readUInt32LE(bo), bin = buf.subarray(bo + 8, bo + 8 + bl);
  const acc = i => { const a = json.accessors[i], v = json.bufferViews[a.bufferView], off = (v.byteOffset || 0) + (a.byteOffset || 0), n = a.count, k = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type]; const out = a.componentType === 5126 ? new Float32Array(n * k) : new Uint32Array(n * k);
    for (let i2 = 0; i2 < n * k; i2++) out[i2] = a.componentType === 5126 ? bin.readFloatLE(off + i2 * 4) : a.componentType === 5125 ? bin.readUInt32LE(off + i2 * 4) : bin.readUInt16LE(off + i2 * 2); return out; };
  const p = json.meshes[0].primitives[0], pos = acc(p.attributes.POSITION), idx = acc(p.indices), uv = p.attributes.TEXCOORD_0 !== undefined ? acc(p.attributes.TEXCOORD_0) : null;
  let png = null; if (json.images && json.images[0] && json.images[0].bufferView !== undefined) { const v = json.bufferViews[json.images[0].bufferView]; png = decodePng(bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength)); }
  return { pos, idx, uv, png };
}

export function bake(glb, gamma = 1, facecol = null) {
  const { pos, idx, uv, png } = glb, tc = idx.length / 3; const col = new Uint16Array(tc);
  const fcIdx = facecol ? Buffer.from(facecol.index, 'base64') : null, fcPal = facecol ? facecol.palette.map(h => parseInt(String(h).replace('#', ''), 16)) : null; if (fcIdx && fcIdx.length !== tc) throw new Error('face colour list has ' + fcIdx.length + ' faces, the model has ' + tc);
  const samp = (u, v) => { const x = Math.min(png.w - 1, Math.max(0, Math.floor((u % 1 + 1) % 1 * png.w))), y = Math.min(png.h - 1, Math.max(0, Math.floor((1 - ((v % 1 + 1) % 1)) * png.h))); return png.rgb(x, y); };
  for (let f = 0; f < tc; f++) {
    let r = 128, g = 128, b = 128;
    if (fcIdx) { const v = fcPal[Math.min(fcIdx[f], fcPal.length - 1)]; r = (v >> 16) & 255; g = (v >> 8) & 255; b = v & 255; }
    else if (png && uv) {
      const t = [idx[f * 3], idx[f * 3 + 1], idx[f * 3 + 2]], cu = (uv[t[0] * 2] + uv[t[1] * 2] + uv[t[2] * 2]) / 3, cv = (uv[t[0] * 2 + 1] + uv[t[1] * 2 + 1] + uv[t[2] * 2 + 1]) / 3;
      const pts = [[cu, cv], ...t.map(k => [(cu + uv[k * 2]) / 2, (cv + uv[k * 2 + 1]) / 2])]; let sr = 0, sg = 0, sb = 0;
      for (const [u, v] of pts) { const c = samp(u, v); sr += c[0]; sg += c[1]; sb += c[2]; } r = sr / 4; g = sg / 4; b = sb / 4;
    }
    const L = v => Math.round(Math.pow(v / 255, gamma) * 31);       // gamma below 1 lifts dark textures (a stop-gap; the real fix is a lighter picture)
    col[f] = L(r) | (L(g) << 5) | (L(b) << 10);
  }
  // weld vertices that share a position (the texture seams split them) and drop the unused ones
  const key = i => pos[i * 3].toFixed(5) + ',' + pos[i * 3 + 1].toFixed(5) + ',' + pos[i * 3 + 2].toFixed(5), map = new Map(), vp = [], remap = new Uint32Array(pos.length / 3);
  for (let i = 0; i < pos.length / 3; i++) { const k = key(i); if (!map.has(k)) { map.set(k, vp.length / 3); vp.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); } remap[i] = map.get(k); }
  const ix = new Uint16Array(idx.length); for (let i = 0; i < idx.length; i++) ix[i] = remap[idx[i]];
  return { vp, ix, col, vc: vp.length / 3, tc };
}

export function writeEwv({ vp, ix, col, vc, tc }) {
  const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9]; for (let i = 0; i < vc; i++) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], vp[i * 3 + a]); max[a] = Math.max(max[a], vp[i * 3 + a]); }
  const buf = Buffer.alloc(32 + vc * 6 + tc * 6 + tc * 2); buf.write('EWV1', 0, 'ascii'); buf.writeUInt16LE(vc, 4); buf.writeUInt16LE(tc, 6); min.forEach((v, i) => buf.writeFloatLE(v, 8 + i * 4)); max.forEach((v, i) => buf.writeFloatLE(v, 20 + i * 4));
  let o = 32; for (let i = 0; i < vc * 3; i++, o += 2) { const a = i % 3, d = max[a] - min[a]; buf.writeUInt16LE(d ? Math.round((vp[i] - min[a]) / d * 65535) : 0, o); }
  for (let i = 0; i < tc * 3; i++, o += 2) buf.writeUInt16LE(ix[i], o); for (let i = 0; i < tc; i++, o += 2) buf.writeUInt16LE(col[i], o);
  return buf.toString('base64');
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [inp, out, gm, fc] = process.argv.slice(2); if (!inp || !out) { console.log('usage: node tools/glb2ewv.mjs in.glb out.ewv.b64 [gamma] [facecol.json]'); process.exit(2); }
  const g = readGlb(readFileSync(inp)), b = bake(g, gm ? Number(gm) : 1, fc ? JSON.parse(readFileSync(fc, 'utf8')) : null); writeFileSync(out, writeEwv(b));
  console.log('baked ' + b.tc + ' faces, ' + b.vc + ' vertices' + (g.png ? ' (texture ' + g.png.w + 'x' + g.png.h + ')' : ' (no texture: grey)'));
}
