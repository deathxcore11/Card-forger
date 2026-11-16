#!/usr/bin/env node
// Bakes data/land-styles.json: every paper printing of the five basic lands (land-styles.js reads it).
// Row: [id, type (0 Plains .. 4 Forest), set, collector number, kind (r regular, f full art, s special:
// Secret Lair or promo), released, artist, 1 if it came in boosters]. Run: node scripts/bake-land-styles.mjs [out]
import {writeFile} from 'node:fs/promises';
import {LAND_TYPES} from '../land-styles.js';

const out = process.argv[2] || new URL('../data/land-styles.json', import.meta.url).pathname;
const headers = {Accept: 'application/json', 'User-Agent': 'CardStashy/1.0 (land styles bake)'};
const cards = [];
let url = 'https://api.scryfall.com/cards/search?q=' + encodeURIComponent('t:basic t:land game:paper -is:digital lang:en') + '&order=released&unique=prints';
while (url) {
  const r = await fetch(url, {headers});
  if (!r.ok) throw Error(`Scryfall ${r.status} at ${url}`);
  const page = await r.json();
  cards.push(...page.data);
  url = page.has_more ? page.next_page : '';
  await new Promise(res => setTimeout(res, 120));
}
const sets = {}, oracles = {}, styles = [];
for (const c of cards) {
  const t = LAND_TYPES.indexOf(c.name);
  if (t < 0 || !c.image_uris || c.oversized) continue;
  const kind = c.set === 'sld' || c.promo || c.set_type === 'promo' ? 's' : c.full_art ? 'f' : 'r';
  sets[c.set] = c.set_name;
  oracles[c.name] = c.oracle_id;
  styles.push([c.id, t, c.set, String(c.collector_number), kind, c.released_at || '', c.artist || '', c.booster ? 1 : 0]);
}
// The starter style: Foundations (2024), the set made to teach the game.
const starter = Object.fromEntries(LAND_TYPES.map((n, t) => [n, styles.find(s => s[1] === t && s[2] === 'fdn' && s[4] === 'r')?.[0] || '']));
await writeFile(out, JSON.stringify({baked: new Date().toISOString().slice(0, 10), source: 'Scryfall t:basic', oracles, starter, sets, styles}) + '\n');
console.log(`${styles.length} styles (${['r', 'f', 's'].map(k => k + ' ' + styles.filter(s => s[4] === k).length).join(', ')}) -> ${out}`);
