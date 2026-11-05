// Writes the pack template's set art as one JSON asset, from the web's own modules (pack-art-data.js PACK_ART through
// pack-wrappers.js packTemplateArt, so the focus points match the site): {code: {card, art (full URL), x, y}}.
// Usage: node scripts/export-pack-art.mjs <repo root> <out file>
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const [root, out] = process.argv.slice(2);
const mod = f => import(pathToFileURL(join(root, f)).href);
const {PACK_ART} = await mod('pack-art-data.js');
const {packTemplateArt} = await mod('pack-wrappers.js');
const data = {};
for (const code of Object.keys(PACK_ART)) { const t = packTemplateArt('mtg', {code}); if (t) data[code] = {card: t.card, art: t.art, x: t.x, y: t.y}; }
writeFileSync(out, JSON.stringify(data));
console.log(`pack art: ${Object.keys(data).length} sets`);
