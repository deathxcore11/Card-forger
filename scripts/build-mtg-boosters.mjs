// Bakes each Magic set's real booster contents (MTGJSON booster sheets and weights) into
// data/mtg-boosters/<set>.json for the pack simulator. Cards are keyed by Scryfall id.
// Usage: node scripts/build-mtg-boosters.mjs [cache-dir]            every set, from scratch
//        node scripts/build-mtg-boosters.mjs --new [cache-dir]      only sets that are out and not baked yet (the daily job), the
//        rest kept as they are. Its last line is "NEW <codes>" or "NONE".
import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';

const API = 'https://mtgjson.com/api/v5/';
const OUT = path.resolve('data/mtg-boosters');
const ADD_NEW = process.argv.includes('--new');
const CACHE = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || '.cache/mtgjson');
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

// One set's booster, as the simulator reads it; null when it has none a player opens. [scryfall] maps MTGJSON uuids to Scryfall ids.
function bake(set, scryfall) {
  if (!set || !TYPES.has(set.type) || set.isOnlineOnly || !set.booster) return null;
  const product = PRODUCTS.find(p => set.booster[p]);
  if (!product) return null;
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
  const code = set.code.toLowerCase();
  return { code, product, extra, unresolved, file: { set: code, product, boosters: b.boosters.map(x => ({ w: x.weight, c: x.contents })), sheets } };
}
// A set file's uuids into [scryfall]; only what the bake needs is kept, the rest of the set file is released.
async function load(code, scryfall) {
  const set = await get(`${code}.json.gz`).then(x => x?.data).catch(e => { console.warn(e.message); return null; });
  if (!set) return null;
  for (const c of [...(set.cards || []), ...(set.tokens || [])]) if (c.identifiers?.scryfallId) scryfall.set(c.uuid, c.identifiers.scryfallId);
  return { code: set.code, type: set.type, isOnlineOnly: set.isOnlineOnly, booster: set.booster, cards: (set.cards || []).map(c => ({ uuid: c.uuid })) };
}

await mkdir(CACHE, { recursive: true });
const setList = await get('SetList.json.gz'), sets = setList.data;
const scryfall = new Map();

if (ADD_NEW) {
  // A new release (Star Trek, 13 Nov 2026) reaches Play's shop and Trunk only once its booster is baked: each day this bakes the sets
  // that are out, sell a pack (SetList's sealed products) and are not baked yet. A bonus sheet's cards come from the set's own
  // children (Star Trek's Stardates), so those files are read too.
  const prior = JSON.parse(await readFile(path.join(OUT, 'index.json'), 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const sells = s => (s.sealedProduct || []).some(p => p.category === 'booster_pack' && PRODUCTS.includes(p.subtype));
  const fresh = sets.filter(s => TYPES.has(s.type) && !s.isOnlineOnly && s.releaseDate && s.releaseDate <= today && !prior.sets[s.code.toLowerCase()] && sells(s));
  const added = [];
  for (const s of fresh) {
    const set = await load(s.code, scryfall);
    for (const kid of sets.filter(k => k.parentCode === s.code)) await load(kid.code, scryfall);
    const baked = bake(set, scryfall);
    if (!baked) continue;
    if (baked.unresolved) console.warn(`${baked.code}: ${baked.unresolved} cards without a Scryfall id skipped`);
    await writeFile(path.join(OUT, `${baked.code}.json`), JSON.stringify(baked.file));
    prior.sets[baked.code] = { product: baked.product, extra: baked.extra };
    added.push(baked.code);
  }
  if (added.length) await writeFile(path.join(OUT, 'index.json'), JSON.stringify({ ...prior, version: setList.meta?.version || prior.version, built: today }, null, 0));
  console.log(added.length ? `NEW ${added.join(' ')}` : 'NONE');
} else {
  // Every set's cards, so bonus sheets drawn from other sets (Masterpieces, The List) resolve too.
  const files = await pool(sets, 8, s => load(s.code, scryfall));
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  const index = {}, missing = [];
  for (const set of files) {
    const baked = bake(set, scryfall);
    if (!baked) continue;
    if (baked.unresolved) missing.push(`${baked.code}:${baked.unresolved}`);
    await writeFile(path.join(OUT, `${baked.code}.json`), JSON.stringify(baked.file));
    index[baked.code] = { product: baked.product, extra: baked.extra };
  }
  await writeFile(path.join(OUT, 'index.json'), JSON.stringify({ source: 'MTGJSON', version: setList.meta?.version || null, built: new Date().toISOString().slice(0, 10), sets: index }, null, 0));
  console.log(`${Object.keys(index).length} sets baked.` + (missing.length ? ` Cards without a Scryfall id skipped: ${missing.join(' ')}` : ''));
}
