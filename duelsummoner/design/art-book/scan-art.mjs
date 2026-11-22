// Looks in the art folder and writes asset-have.js next to asset-tool.html,
// so the tool ticks every file that is already made.
// Use: node scan-art.mjs "<art folder>" "<folder holding asset-tool.html>"
import { readdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const art = process.argv[2], out = process.argv[3] || '.';
if (!art) { console.error('Give the art folder.'); process.exit(1); }
const names = new Set();
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    let s; try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) walk(p); else names.add(f.toLowerCase());
  }
})(art);
writeFileSync(join(out, 'asset-have.js'), 'window.DS_HAVE=' + JSON.stringify([...names].sort()) + ';\n');
console.log(names.size + ' files found. asset-have.js written.');
