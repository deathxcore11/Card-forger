// Bakes each Magic set's real booster contents (MTGJSON booster sheets and weights) into
// data/mtg-boosters/<set>.json for the pack simulator. Cards are keyed by Scryfall id.
// Usage: node scripts/build-mtg-boosters.mjs [cache-dir]
import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';

const API = 'https://mtgjson.com/api/v5/';
const OUT = path.resolve('data/mtg-boosters');
const CACHE = path.resolve(process.argv[2] || '.cache/mtgjson');
// The set types the simulator opens packs for (packEligible in set-experience.js).
const TYPES = new Set(['core', 'expansion', 'masters', 'draft_innovation', 'funny']);
// The booster a player would open: Play Boosters from 2024, Draft before, else the set's default.
const PRODUCTS = ['play', 'draft', 'default'];

async function get(name) {
  const file = path.join(CACHE, name);
  try { return JSON.parse(gunzipSync(await readFile(file))); } catch {}
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API + name);
    if (res.ok) { const buf = Buffer.from(await res.arrayBuffer()); await writeFile(file, buf); return JSON.parse(gunzipSync(buf)); }
    if (res.status === 404) return null;
    if (attempt === 3) throw Error(`${name}: HTTP ${res.status}`);
    await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
  }
}
async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

await mkdir(CACHE, { recursive: true });
const setList = await get('SetList.json.gz'), sets = setList.data;
// Every set's cards, so bonus sheets drawn from other sets (Masterpieces, The List) resolve too.
const scryfall = new Map();
const files = await pool(sets, 8, async s => {
  const set = await get(`${s.code}.json.gz`).then(x => x?.data).catch(e => { console.warn(e.message); return null; });
  if (!set) return null;
  for (const c of [...(set.cards || []), ...(set.tokens || [])]) if (c.identifiers?.scryfallId) scryfall.set(c.uuid, c.identifiers.scryfallId);
  // Only what the bake needs is kept; the rest of the set file is released.
  return { code: set.code, type: set.type, isOnlineOnly: set.isOnlineOnly, booster: set.booster, cards: (set.cards || []).map(c => ({ uuid: c.uuid })) };
});

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const index = {}, missing = [];
for (const set of files) {
  if (!set || !TYPES.has(set.type) || set.isOnlineOnly || !set.booster) continue;
  const product = PRODUCTS.find(p => set.booster[p]) ;
  if (!product) continue;
  const b = set.booster[product], own = new Set(set.cards.map(c => c.uuid));
  const sheets = {};
  let unresolved = 0, extra = 0;
  for (const [name, s] of Object.entries(b.sheets)) {
    const cards = [];
    for (const [uuid, w] of Object.entries(s.cards)) {
      const id = scryfall.get(uuid);
      if (!id) { unresolved++; continue; }
      if (!own.has(uuid)) extra++;
      cards.push([id, w]);
    }
    sheets[name] = { foil: !!s.foil, ...(s.balanceColors ? { balance: true } : {}), ...(s.allowDuplicates ? { duplicates: true } : {}), ...(s.fixed ? { fixed: true } : {}), cards };
  }
  if (unresolved) missing.push(`${set.code}:${unresolved}`);
  const code = set.code.toLowerCase();
  await writeFile(path.join(OUT, `${code}.json`), JSON.stringify({ set: code, product, boosters: b.boosters.map(x => ({ w: x.weight, c: x.contents })), sheets }));
  index[code] = { product, extra };
}
await writeFile(path.join(OUT, 'index.json'), JSON.stringify({ source: 'MTGJSON', version: setList.meta?.version || null, built: new Date().toISOString().slice(0, 10), sets: index }, null, 0));
console.log(`${Object.keys(index).length} sets baked.` + (missing.length ? ` Cards without a Scryfall id skipped: ${missing.join(' ')}` : ''));
