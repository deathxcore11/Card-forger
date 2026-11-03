#!/usr/bin/env node
// Bakes data/secret-lair/drops.json: every Secret Lair (Scryfall set "sld") printing Play can grant,
// grouped into drops. The weekly Merchant bundle and the rare Secret Lair art drops read this file
// (play-secret-lair.js). Scryfall has no drop names, so a drop is a run of collector numbers released
// the same day by the same artist (or a lettered series such as "IFIYW-1..n"), and the app labels it
// honestly by month and artist. Run: node scripts/bake-secret-lair.mjs [out]
import {writeFile, mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {groupSecretLairDrops} from '../play-secret-lair.js';

const out = process.argv[2] || new URL('../data/secret-lair/drops.json', import.meta.url).pathname;
const headers = {Accept: 'application/json', 'User-Agent': 'CardStashy/1.0 (secret lair bake)'};
const cards = [];
let url = 'https://api.scryfall.com/cards/search?q=' + encodeURIComponent('e:sld -is:digital game:paper') + '&order=set&unique=prints';
while (url) {
  const r = await fetch(url, {headers});
  if (!r.ok) throw Error(`Scryfall ${r.status} at ${url}`);
  const page = await r.json();
  cards.push(...page.data);
  url = page.has_more ? page.next_page : '';
  await new Promise(res => setTimeout(res, 120));
}
const drops = groupSecretLairDrops(cards);
await mkdir(dirname(out), {recursive: true});
await writeFile(out, JSON.stringify({baked: new Date().toISOString().slice(0, 10), source: 'Scryfall e:sld', drops}) + '\n');
console.log(`${cards.length} printings, ${drops.length} drops, ${drops.reduce((t, d) => t + d.cards.length, 0)} cards kept -> ${out}`);
