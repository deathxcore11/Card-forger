// Bakes what opening a pack needs to know about every card a set's booster sheets can give (Scryfall's oracle id,
// name, rarity, printing, colours and image) into data/mtg-booster-cards/<set>.json, so the server opens a Play pack
// without asking Scryfall (Randall 5 Nov: a Future Sight pack would not open because that call failed on the live site).
// Run after scripts/build-mtg-boosters.mjs. Usage: node scripts/bake-mtg-booster-cards.mjs [cache-file]
// Rows: id -> [oracle_id, name, rarity, set, collector_number, colours ("WU", null when Scryfall gives none), image],
// image being the Scryfall image's version stamp, [normal, art_crop] when the URL is not the usual one, or 0 for none.
import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const SHEETS = path.resolve('data/mtg-boosters'), OUT = path.resolve('data/mtg-booster-cards');
const CACHE = path.resolve(process.argv[2] || '.cache/scryfall-booster-cards.json');
const HEAD = { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'CardStashy/1.0 (booster bake)' };
const wait = ms => new Promise(r => setTimeout(r, ms));

const sets = [];
for (const file of (await readdir(SHEETS)).filter(f => f.endsWith('.json') && f !== 'index.json')) {
  const d = JSON.parse(await readFile(path.join(SHEETS, file), 'utf8'));
  if (d?.sheets) sets.push({ code: d.set, ids: [...new Set(Object.values(d.sheets).flatMap(s => s.cards.map(([id]) => id)))] });
}
const facts = new Map(Object.entries(await readFile(CACHE, 'utf8').then(JSON.parse).catch(() => ({}))));
const want = [...new Set(sets.flatMap(s => s.ids))].filter(id => !facts.has(id));
console.log(`${sets.length} sets, ${facts.size} cards cached, ${want.length} to fetch`);

const image = c => {
  const i = c.image_uris || c.card_faces?.[0]?.image_uris;
  if (!i?.normal) return 0;
  const usual = size => new RegExp(`^https://cards\\.scryfall\\.io/${size}/front/${c.id[0]}/${c.id[1]}/${c.id}\\.jpg\\?(\\d+)$`);
  const n = i.normal.match(usual('normal')), a = String(i.art_crop || '').match(usual('art_crop'));
  return n && a && n[1] === a[1] ? Number(n[1]) : [i.normal, i.art_crop || ''];
};
const row = c => [c.oracle_id || c.card_faces?.[0]?.oracle_id || '', c.name || '', c.rarity || '', c.set || '', c.collector_number || '',
  Array.isArray(c.colors) ? c.colors.join('') : null, image(c)];

await mkdir(path.dirname(CACHE), { recursive: true });
// Scryfall's collection endpoint, 75 ids a call, unhurried; a 429 waits and asks again.
for (let i = 0; i < want.length; i += 75) {
  const ids = want.slice(i, i + 75);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch('https://api.scryfall.com/cards/collection', { method: 'POST', headers: HEAD, body: JSON.stringify({ identifiers: ids.map(id => ({ id })) }) }).catch(e => ({ ok: false, status: String(e.message) }));
    if (res.ok) { for (const c of (await res.json()).data || []) facts.set(c.id, row(c)); break; }
    if (attempt === 5) throw Error(`Scryfall: ${res.status}`);
    await wait(2000 * 2 ** attempt);
  }
  if ((i / 75) % 20 === 19) { await writeFile(CACHE, JSON.stringify(Object.fromEntries(facts))); console.log(`${Math.min(i + 75, want.length)} / ${want.length}`); }
  await wait(500);
}
await writeFile(CACHE, JSON.stringify(Object.fromEntries(facts)));

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
let missing = 0;
for (const { code, ids } of sets) {
  const cards = {};
  for (const id of ids) if (facts.has(id)) cards[id] = facts.get(id); else missing++;
  await writeFile(path.join(OUT, `${code}.json`), JSON.stringify({ set: code, cards }));
}
console.log(`${sets.length} sets baked; ${missing} sheet cards Scryfall did not know (the server asks Scryfall for those)`);
