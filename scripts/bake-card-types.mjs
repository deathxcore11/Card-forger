#!/usr/bin/env node
// Bakes each card face's card types for the app's "name a card" prompt (Petrified Hamlet names a land card, Kai Winn a nonland
// card), so the names it offers fit what the card asks for.
// Usage: node scripts/bake-card-types.mjs <scryfall oracle-cards .jsonl.gz> [out]
// Out (default android-app/native/data/card-types.json, copied into the app by prepare-assets.sh): {"v":1,"source":..,"types":{"<letters>":[face names]}}
// Letters: A artifact, B battle, C creature, E enchantment, I instant, K kindred (tribal), L land, P planeswalker, S sorcery.
import fs from 'node:fs';
import zlib from 'node:zlib';
import readline from 'node:readline';

const [src, out = 'android-app/native/data/card-types.json'] = process.argv.slice(2);
if (!src) { console.error('usage: bake-card-types.mjs <oracle-cards.jsonl.gz> [out]'); process.exit(2); }
const LETTER = { Artifact: 'A', Battle: 'B', Creature: 'C', Enchantment: 'E', Instant: 'I', Kindred: 'K', Tribal: 'K', Land: 'L', Planeswalker: 'P', Sorcery: 'S' };
export function letters(typeLine) {
  const head = String(typeLine || '').split(/\s+[—-]\s+/)[0];
  return [...new Set(head.split(/\s+/).map(w => LETTER[w]).filter(Boolean))].sort().join('');
}
const byName = new Map();
const put = (name, tl) => { name = String(name || '').trim(); const l = letters(tl); if (!name || !l) return; byName.set(name, [...new Set((byName.get(name) || '') + l)].sort().join('')); };
const rl = readline.createInterface({ input: fs.createReadStream(src).pipe(zlib.createGunzip()), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  const c = JSON.parse(line);
  if (c.layout === 'token' || c.layout === 'double_faced_token' || c.layout === 'emblem' || c.layout === 'art_series') continue;
  if (Array.isArray(c.card_faces) && c.card_faces.length) { for (const f of c.card_faces) put(f.name, f.type_line || c.type_line); }
  else put(c.name, c.type_line);
}
const groups = {};
for (const [name, l] of [...byName].sort((a, b) => a[0].localeCompare(b[0]))) (groups[l] ||= []).push(name);
fs.writeFileSync(out, JSON.stringify({ v: 1, source: 'Scryfall oracle-cards ' + (src.match(/\d{14}/)?.[0] || ''), types: groups }));
console.log(out, byName.size, 'faces', Object.keys(groups).length, 'groups', (groups.L || []).length, 'plain lands');
