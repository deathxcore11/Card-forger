// Packs Planeswalk (the site's planeswalk.html, unchanged) and every file it loads as code into the app's assets (gap audit G6),
// so the app can answer https://cardstashy.com/planeswalk.html and its scripts from the APK (ui/PlaneswalkPack.kt).
// node scripts/export-planeswalk.mjs <web root> <assets dir>
// Walks the page's <script src>, <link href> and every quoted "./x.js" / "./x.css" it names, then each script's static and
// dynamic imports, recursively. Art, figures and sounds (planeswalk-art/, planeswalk-cast/, assets/audio/) are not code: they
// are left out here. Writes planeswalk/manifest.json: {sha256 of the page, files: [paths]}.
import {readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync} from 'node:fs';
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
