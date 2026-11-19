// Builds the Lost Memories playable test page into one HTML file.
//   node tools/crucible/build-web.mjs <out-dir> [--esbuild path/to/esbuild] [--sheets art/s/]
// The page expects an art/ folder beside it (door, hall, relic and card-back pictures) and,
// when --sheets is given, card picture sheets of 100 (10 by 10, pool order) named 0.webp, 1.webp ...
// Neither the art nor the sheets live in this repository.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const out = args[0] && !args[0].startsWith('--') ? args[0] : 'crucible/web/dist';
const esbuild = flag('--esbuild', 'esbuild');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const js = execFileSync(esbuild, [path.join(root, 'crucible/web/app.mjs'), '--bundle', '--format=iife', '--minify', '--target=es2020', '--platform=browser', '--log-override:empty-import-meta=silent'], { maxBuffer: 1 << 26 }).toString();
const data = { pool: JSON.parse(read('crucible/data/crucible-pool.json')), tags: JSON.parse(read('crucible/data/crucible-spell-tags.json')), config: JSON.parse(read('crucible/data/crucible-config.json')), sheets: flag('--sheets', ''), art: fs.existsSync(path.join(out, 'art')) ? fs.readdirSync(path.join(out, 'art')).filter(f => f.endsWith('.webp')).map(f => f.slice(0, -5)) : [] };
const safe = s => s.replace(/<\/(script)/gi, '<\\/$1');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Lost Memories Playable</title>
<style>${read('crucible/web/play.css')}</style></head>
<body><div id="app"></div>
<script>window.CRUCIBLE_DATA=${safe(JSON.stringify(data))};</script>
<script>${safe(js)}</script>
</body></html>
`;
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('wrote', path.join(out, 'index.html'), Math.round(html.length / 1024) + ' KB');
