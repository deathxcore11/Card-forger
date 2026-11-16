// Packs Planeswalk (the site's planeswalk.html, unchanged) and every file it loads as code into the app's assets (gap audit G6),
// so the app can answer https://cardstashy.com/planeswalk.html and its scripts from the APK (ui/PlaneswalkPack.kt).
// node scripts/export-planeswalk.mjs <web root> <assets dir>
// Walks the page's <script src>, <link href> and every quoted "./x.js" / "./x.css" it names, then each script's static and
// dynamic imports, recursively. Art, figures and sounds (planeswalk-art/, planeswalk-cast/, assets/audio/) are not code: they
// are left out here. Writes planeswalk/manifest.json: {sha256 of the page, files: [paths]}.
import {readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, readdirSync, statSync} from 'node:fs';
import {join, dirname, resolve, posix} from 'node:path';
import {createHash} from 'node:crypto';
const [web, assets] = process.argv.slice(2);
const root = resolve(web), out = join(resolve(assets), 'planeswalk');
export const refsOf = (path, text) => {
  const found = new Set();
  const add = r => { if (!r || /^(https?:|data:|blob:|\/\/)/.test(r) || r.includes('${')) return; const p = posix.normalize(posix.join(posix.dirname(path), r)); if (/\.(js|mjs|css)$/.test(p)) found.add(p); };
  if (path.endsWith('.html')) for (const m of text.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)=["']([^"']+)["']/g)) add(m[1]);
  for (const m of text.matchAll(/(?:import|export)\s[^;'"]*?from\s*["']([^"']+)["']/g)) add(m[1]);
  for (const m of text.matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/g)) add(m[1]);
  for (const m of text.matchAll(/import\s*["']([^"']+)["']/g)) add(m[1]);
  // Any other quoted ./file.js or ./file.css the page names (a script or style it adds itself).
  for (const m of text.matchAll(/["'`](\.\/[\w./-]+\.(?:js|mjs|css))["'`]/g)) add(m[1]);
  return [...found];
};
const files = new Set(['planeswalk.html']), queue = ['planeswalk.html'];
while (queue.length) { const f = queue.shift(); for (const r of refsOf(f, readFileSync(join(root, f), 'utf8'))) if (!files.has(r)) { files.add(r); queue.push(r); } }
rmSync(out, {recursive: true, force: true});
for (const f of files) { mkdirSync(dirname(join(out, f)), {recursive: true}); copyFileSync(join(root, f), join(out, f)); }
const sha = createHash('sha256').update(readFileSync(join(root, 'planeswalk.html'))).digest('hex');
writeFileSync(join(out, 'manifest.json'), JSON.stringify({page: sha, files: [...files].sort()}, null, 1));
console.log('planeswalk packed:', files.size, 'files');

// Its art, figures and sounds are not packed (about 60 MB): media.json lists them ([path, bytes, sha256]) so the app saves them from
// the site on the first open online and plays offline after that (Randall's pick 13 Nov: "Download once on first open").
// The effects are the Opus copies Chrome plays; music already keeps itself in the page's Cache Storage once a track has played.
const walk = d => readdirSync(join(root, d), {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(posix.join(d, e.name)) : [posix.join(d, e.name)]);
const media = [...walk('planeswalk-art'), ...walk('planeswalk-cast'), ...walk('assets/audio/sfx').filter(f => f.endsWith('.ogg')),
  ...['stamp-first-movie.png', 'cosmos.svg', 'metal-grain.svg', 'relief-flow.svg', 'starlight.svg', 'water-pattern.svg'].map(f => 'assets/finishes/' + f)]
  .filter(f => !/(^|\/)\./.test(f)).sort()
  .map(f => { const b = readFileSync(join(root, f)); return [f, b.length, createHash('sha256').update(b).digest('hex')]; });
writeFileSync(join(out, 'media.json'), JSON.stringify({files: media}));
console.log('planeswalk media listed:', media.length, 'files,', (media.reduce((n, m) => n + m[1], 0) / 1048576).toFixed(1), 'MB');
