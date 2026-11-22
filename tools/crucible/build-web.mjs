// Builds the Lost Memories playable test page into one HTML file.
//   node tools/crucible/build-web.mjs <out-dir> [--esbuild path/to/esbuild] [--sheets art/s/] [--look old]
// --look old builds the page with the old look as the default (the checks written for it use that build).
// The page expects an art/ folder beside it (door, hall, relic and card-back pictures) and,
// when --sheets is given, card picture sheets of 100 (10 by 10, pool order) named 0.webp, 1.webp ...
// Neither the art nor the sheets live in this repository.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const out = args[0] && !args[0].startsWith('--') ? args[0] : 'crucible/web/dist';
const esbuild = flag('--esbuild', 'esbuild');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const js = execFileSync(esbuild, [path.join(root, 'crucible/web/app.mjs'), '--bundle', '--format=iife', '--minify', '--target=es2020', '--platform=browser', '--log-override:empty-import-meta=silent'], { maxBuffer: 1 << 26 }).toString();
const data = { pool: JSON.parse(read('crucible/data/crucible-pool.json')), tags: JSON.parse(read('crucible/data/crucible-spell-tags.json')), config: JSON.parse(read('crucible/data/crucible-config.json')), sheets: flag('--sheets', ''), art: fs.existsSync(path.join(out, 'art')) ? fs.readdirSync(path.join(out, 'art')).filter(f => f.endsWith('.webp')).map(f => f.slice(0, -5)) : [],
  // the console look's pictures, cut to console size by tools/crucible/console-art.py into art/c/
  cart: fs.existsSync(path.join(out, 'art', 'c', 'index.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'art', 'c', 'index.json'), 'utf8')) : null, look: flag('--look', 'ps') };
// The console pictures also go into one pack file beside them, so a published page holds a few files, not hundreds.
// The page cuts each picture out of the pack by the offsets listed here; the file name carries the pack's hash, so a
// device never keeps an old pack. The pack is named .wasm only because the page host serves raw bytes under that
// name and refuses .bin; the page reads it with fetch as plain bytes and never runs it.
if (data.cart) {
  const dir = path.join(out, 'art', 'c'), names = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort(), at = {}, parts = [];
  let o = 0;
  for (const f of names) { const b = fs.readFileSync(path.join(dir, f)); at[f.slice(0, -4)] = [o, b.length]; parts.push(b); o += b.length; }
  const buf = Buffer.concat(parts), file = 'pack-' + createHash('sha1').update(buf).digest('hex').slice(0, 10) + '.wasm';
  for (const f of fs.readdirSync(dir)) if (/^pack-[0-9a-f]+\.(bin|wasm)$/.test(f) && f !== file) fs.unlinkSync(path.join(dir, f));
  fs.writeFileSync(path.join(dir, file), buf);
  data.cart.pack = { file, size: buf.length, at };
  console.log('packed', names.length, 'console pictures into', file, Math.round(buf.length / 1024) + ' KB');
}
// The crest, small, inside the page: the loading screen turns it as a coin before the picture pack has arrived.
if (data.cart && fs.existsSync(path.join(out, 'art', 'c', 'key-crest-48.png'))) data.cart.crest = 'data:image/png;base64,' + fs.readFileSync(path.join(out, 'art', 'c', 'key-crest-48.png')).toString('base64');
const safe = s => s.replace(/<\/(script)/gi, '<\\/$1');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Lost Memories Playable</title>
<style>${read('crucible/web/play.css')}
${read('crucible/web/ps.css')}</style></head>
<body><div id="app"></div>
<script>window.CRUCIBLE_DATA=${safe(JSON.stringify(data))};</script>
<script>${safe(js)}</script>
</body></html>
`;
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('wrote', path.join(out, 'index.html'), Math.round(html.length / 1024) + ' KB');
