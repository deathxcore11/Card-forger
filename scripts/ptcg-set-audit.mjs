// Pokémon set-by-set audit: for every set the app lists, does the set page load every card, does
// each card have art (TCGdex scan, or the TCGplayer product image fallback), a price (TCGdex, or
// the TCGplayer product fallback), and the game data Deck Power reads (HP, attacks, stage, Prize
// count, legality)? Usage: NODE_USE_ENV_PROXY=1 node scripts/ptcg-set-audit.mjs <out-dir> [set ids…]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { normalizePtcg, playSig, ptcgSource } from "../ptcg.js";
import { pickGroup, pickProduct } from "../pokemon-art.js";
import { ptcgProduct } from "../ptcg-product.js";

const OUT = process.argv[2] || "ptcg-audit", ONLY = process.argv.slice(3);
const CACHE = path.join(OUT, "cache");
fs.mkdirSync(CACHE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  const file = path.join(CACHE, crypto.createHash("sha1").update(url).digest("hex") + ".json");
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  for (let a = 0; ; a++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "CardStashy/3.58 (set audit)", Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
      const body = r.status === 404 ? null : r.ok ? await r.json() : (() => { throw Error("HTTP " + r.status); })();
      fs.writeFileSync(file, JSON.stringify(body));
      return body;
    } catch (e) {
      if (a >= 4) return null;
      await sleep(1000 * 2 ** a);
    }
  }
}
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}

const API = "https://api.tcgdex.net/v2/en";
// The app's own set list (same filters: no TCG Pocket, no empty placeholders).
const sets = (await ptcgSource.sets()).filter((s) => !ONLY.length || ONLY.includes(s.id));
const groups = (await get("https://tcgcsv.com/tcgplayer/3/groups"))?.results || [];
const setKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const groupPrices = new Map();
const pricesOf = async (g) => {
  if (!groupPrices.has(g)) groupPrices.set(g, new Map(((await get(`https://tcgcsv.com/tcgplayer/3/${g}/prices`))?.results || []).map((q) => [Number(q.productId) + "|" + q.subTypeName, q])));
  return groupPrices.get(g);
};
const report = { at: new Date().toISOString(), sets: [] };
let done = 0;
for (const s of sets) {
  const cards = await ptcgSource.setCards(s).catch(() => []);
  const row = { id: s.id, name: s.name, series: s.series, date: s.date, expected: s.count, shown: cards.length, noArt: [], artFallback: 0, noPrice: [], priceFallback: 0, eurOnly: 0, dataGaps: [], crashes: [], standard: 0 };
  // The app's fallbacks, by exact TCGplayer product: price through the set's group (exact name,
  // else matched by set-name words, as pokemon-prices.js does); art by product id or that group.
  const artGroup = pickGroup(groups, s.name), exactGroup = groups.find((g) => setKey(g.name) === setKey(s.name)) || artGroup;
  const artProducts = artGroup ? (await get(`https://tcgcsv.com/tcgplayer/3/${artGroup.groupId}/products`))?.results || [] : [];
  await pool(cards, 8, async (b) => {
    const raw = await get(`${API}/cards/${encodeURIComponent(b.id)}`);
    if (!raw) { row.dataGaps.push(b.set.number + " " + b.name + ": no card data"); return; }
    let c;
    try { c = normalizePtcg(raw); playSig(c); } catch (e) { row.crashes.push(b.id + ": " + e.message); return; }
    if (c.legal.standard) row.standard++;
    // Art
    if (!raw.image) {
      const pid = (raw.variants_detailed || []).map((v) => Number(v.thirdParty?.tcgplayer)).find(Boolean) || pickProduct(artProducts, raw)?.productId;
      if (pid) row.artFallback++; else row.noArt.push(raw.localId + " " + raw.name);
    }
    // Price
    if (c.prices.usd == null) {
      let got = false;
      const products = new Set((raw.variants_detailed || []).map((v) => Number(v.thirdParty?.tcgplayer)).filter(Boolean));
      if (exactGroup && products.size) { const pr = await pricesOf(exactGroup.groupId); got = [...pr.values()].some((q) => products.has(Number(q.productId)) && q.marketPrice > 0); }
      if (got) row.priceFallback++;
      else if (c.prices.eur != null) row.eurOnly++;
      else row.noPrice.push({ n: raw.localId + " " + raw.name, product: ptcgProduct(raw)?.productId || [...products][0] || null, rarity: raw.rarity || "" });
    }
    // Game data Deck Power and Matchups read.
    const gap = [];
    if (c.category === "Pokemon") {
      if (!c.hp) gap.push("HP");
      if (!c.types.length) gap.push("type");
      if (!c.stage) gap.push("stage");
      if (!c.attacks.length && !c.abilities.length) gap.push("attacks");
      if (/Stage ?[12]/.test(c.stage) && !c.evolveFrom) gap.push("evolves from");
      if (/\bex\b/.test(c.name) && !/^Mega /.test(c.name) && c.prize !== 2) gap.push("prize " + c.prize);
    } else if (c.category === "Trainer") {
      if (!c.effect && !c.text) gap.push("effect");
      if (!/Item|Supporter|Stadium|Tool|Technical Machine/.test(c.typeLine + " " + (raw.trainerType || ""))) gap.push("trainer type");
    } else if (c.category === "Energy") {
      if (!c.energyType) gap.push("energy type");
      if (c.energyType === "Special" && !c.effect && !c.text) gap.push("effect");
    }
    if (gap.length) row.dataGaps.push(raw.localId + " " + raw.name + ": " + gap.join(", "));
  });
  report.sets.push(row);
  done++;
  console.error(`${s.id} ${s.name}: ${row.shown}/${row.expected}${row.noArt.length ? ` · ${row.noArt.length} no art` : ""}${row.artFallback ? ` · ${row.artFallback} art via TCGplayer` : ""}${row.noPrice.length ? ` · ${row.noPrice.length} unpriced` : ""}${row.dataGaps.length ? ` · ${row.dataGaps.length} data gaps` : ""}${row.crashes.length ? ` · ${row.crashes.length} CRASH` : ""} [${done}/${sets.length}]`);
}
fs.writeFileSync(path.join(OUT, "ptcg-audit.json"), JSON.stringify(report));
const sum = (k) => report.sets.reduce((a, s) => a + (Array.isArray(s[k]) ? s[k].length : s[k]), 0);
console.log(`${report.sets.length} sets · ${sum("shown")} cards (${sum("expected")} expected) · ${report.sets.filter((s) => s.shown !== s.expected).length} sets with count gaps`);
console.log(`art: ${sum("noArt")} missing, ${sum("artFallback")} via TCGplayer · price: ${sum("noPrice")} unpriced, ${sum("priceFallback")} via TCGplayer product, ${sum("eurOnly")} Cardmarket only · data gaps ${sum("dataGaps")} · crashes ${sum("crashes")}`);
