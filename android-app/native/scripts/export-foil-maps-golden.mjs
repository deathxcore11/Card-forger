// Golden for MtgCardMapsTest: the site's own mtgCardMaps (mtg-foil-analysis.js) on six real scans, run in Chromium exactly as
// the site reads a card (mtg-foil.js readMapPixels: a 336 x 468 canvas, imageSmoothingQuality 'high', drawImage to size).
// The input RGBA is stored too, so the Kotlin test runs on the very pixels the site measured and never decodes a JPEG.
//
// Run from the repository root (or anywhere playwright resolves): node android-app/native/scripts/export-foil-maps-golden.mjs
// Writes android-app/native/app/src/test/resources/foil/mtg-cardmaps-golden.bin.gz, big-endian (Java DataInputStream):
//   int count; per scan: int nameLen, name UTF-8, int pat, int frameLen, frame UTF-8, double[4] frame art, double[4] frame text,
//   int W, int H, byte[W*H*4] input RGBA, byte[W*H*4] mask RGBA, double[4] box art, double[4] box text,
//   byte hasStar, (if 1) double x, double y.
import {createRequire} from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const require = createRequire(import.meta.url);
let playwright;
for (const p of [root, '/opt/node-tools/node_modules', '/home/user/card-forger']) {
  try { playwright = require(require.resolve('playwright', {paths: [p]})); break; } catch {}
}
if (!playwright) throw new Error('playwright not found');

const SCANS = [
  ['silverscroll.jpg', 23, 'borderless'],
  ['gleaming.jpg', 28, 'smaug'],
  ['facet.jpg', 21, 'borderless'],
  ['retro_witness.jpg', 2, '1997'],
  ['retro_counterspell.jpg', 2, '1997'],
  ['fracture.jpg', 11, '2015'],
];

const types = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.html': 'text/html'};
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'content-type': types[path.extname(p)] || 'application/octet-stream'});
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
fs.writeFileSync(path.join(root, 'test-fixtures/mtg-foil-maps/.golden.html'), '<!doctype html><meta charset="utf-8"><body></body>');

const browser = await playwright.chromium.launch();
const parts = [];
const int = v => { const b = Buffer.alloc(4); b.writeInt32BE(v); return b; };
const dbl = v => { const b = Buffer.alloc(8); b.writeDoubleBE(v); return b; };
const str = s => { const b = Buffer.from(s, 'utf8'); return Buffer.concat([int(b.length), b]); };
try {
  const page = await browser.newPage();
  await page.goto(base + '/test-fixtures/mtg-foil-maps/.golden.html');
  parts.push(int(SCANS.length));
  for (const [file, pat, frame] of SCANS) {
    const r = await page.evaluate(async ({file, pat, frame}) => {
      const {mtgCardMaps, MTG_FRAMES, MTG_MAP_W, MTG_MAP_H} = await import('/mtg-foil-analysis.js');
      const img = new Image(); img.src = '/test-fixtures/mtg-foil-maps/' + file; await img.decode();
      const c = document.createElement('canvas'); c.width = MTG_MAP_W; c.height = MTG_MAP_H;
      const x = c.getContext('2d', {willReadFrequently: true});
      x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, MTG_MAP_W, MTG_MAP_H);
      const data = x.getImageData(0, 0, MTG_MAP_W, MTG_MAP_H).data;
      const input = Array.from(data);
      const m = mtgCardMaps(data, MTG_MAP_W, MTG_MAP_H, {pat, frame: MTG_FRAMES[frame], emblem: null});
      return {W: MTG_MAP_W, H: MTG_MAP_H, input, mask: Array.from(m.mask), box: m.box, star: m.star, fa: MTG_FRAMES[frame].art, ft: MTG_FRAMES[frame].text};
    }, {file, pat, frame});
    parts.push(str(file.replace(/\.jpg$/, '')), int(pat), str(frame), ...r.fa.map(dbl), ...r.ft.map(dbl), int(r.W), int(r.H),
      Buffer.from(Uint8Array.from(r.input)), Buffer.from(Uint8Array.from(r.mask)), ...r.box.art.map(dbl), ...r.box.text.map(dbl));
    if (r.star) parts.push(Buffer.from([1]), dbl(r.star.x), dbl(r.star.y)); else parts.push(Buffer.from([0]));
    console.log(file, 'pat', pat, frame, 'art', r.box.art.map(v => +v.toFixed(4)).join(','), 'text', r.box.text.map(v => +v.toFixed(4)).join(','),
      'star', r.star ? `${r.star.x.toFixed(4)},${r.star.y.toFixed(4)}` : 'none');
  }
} finally {
  await browser.close(); server.close();
  fs.rmSync(path.join(root, 'test-fixtures/mtg-foil-maps/.golden.html'), {force: true});
}
const out = path.join(root, 'android-app/native/app/src/test/resources/foil/mtg-cardmaps-golden.bin.gz');
fs.writeFileSync(out, zlib.gzipSync(Buffer.concat(parts), {level: 9}));
console.log('wrote', out, fs.statSync(out).size, 'bytes');
