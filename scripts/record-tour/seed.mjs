// Builds a realistic sample workspace for recordings: real cards, real Scryfall data and prices.
import fs from "node:fs"; import zlib from "node:zlib";
const R = new URL("../../", import.meta.url).pathname;
globalThis.localStorage = { getItem() { return null; }, setItem() {} };
const { blank } = await import(R + "store.js");
const B = JSON.parse(zlib.gunzipSync(fs.readFileSync(R + "test-fixtures/power-bench.json.gz")));
const edh = B.mtg.cases.find((c) => c.fmt === "EDH" && c.label === "winner");
const owned = ["Sol Ring", "Rhystic Study", "Smothering Tithe", "The One Ring", "Ragavan, Nimble Pilferer", "Mana Crypt", "Cyclonic Rift", "Dockside Extortionist", "Jeweled Lotus", "Fierce Guardianship", "Esper Sentinel", "Orcish Bowmasters", "Sheoldred, the Apocalypse", "Ancient Tomb", "Force of Will", "Demonic Tutor", "Lightning Bolt", "Counterspell", "Swords to Plowshares", "Arcane Signet", "Llanowar Elves", "Birds of Paradise", "Thoughtseize", "Fable of the Mirror-Breaker", "Atraxa, Grand Unifier", "Urza's Saga", "Chrome Mox", "Mox Diamond", "Grim Monolith", "Kinnan, Bonder Prodigy"];
const names = [...new Set([...owned, ...edh.cards.map((r) => r.name)])];
const cache = {};
for (let i = 0; i < names.length; i += 75) {
  const r = await fetch("https://api.scryfall.com/cards/collection", { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "CardStashy/rec" }, body: JSON.stringify({ identifiers: names.slice(i, i + 75).map((n) => ({ name: n.split(" // ")[0] })) }) });
  for (const c of (await r.json()).data || []) { cache[c.name.toLowerCase()] = c; cache[c.name.split(" // ")[0].toLowerCase()] ||= c; }
  await new Promise((r) => setTimeout(r, 150));
}
const st = blank();
st.collection = owned.filter((n) => cache[n.toLowerCase()]).map((n, i) => { const c = cache[n.toLowerCase()]; return { id: "e" + i, name: c.name, qty: i % 4 === 0 ? 2 : 1, set: c.set.toUpperCase(), setName: c.set_name, collectorNumber: c.collector_number, finish: "nonfoil", language: "en", condition: "Near Mint", location: "", reserved: 0, printingId: c.id, oracleId: c.oracle_id, printingVerified: true, nameVerified: true, raw: { acquisition: "Scanned" } }; });
st.decks = [{ id: "kinnan", name: "Kinnan Combo", format: "Commander", commander: edh.commander, cards: edh.cards, side: [], createdAt: new Date().toISOString() }];
st.activeDeck = "kinnan";
st.cache = cache;
st.settings = { ...st.settings, binders: [{ id: "b-rare", game: "mtg", title: "Rare Treasures", rule: "rare", value: "", color: "#7a4cff" }, { id: "b-blue", game: "mtg", title: "Blue Spells", rule: "color", value: "U", color: "#2a6fd6" }] };
const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
st.valueHistory = [[150, 1610], [120, 1720], [90, 1695], [60, 1880], [40, 2010], [25, 1975], [12, 2150], [5, 2260]].map(([n, t]) => ({ date: day(n), total: t, copies: 38, unpriced: 0, currency: "USD", basis: "exact-owned-v1" }));
st.printings = Object.fromEntries(st.collection.map((e) => [e.printingId, cache[e.name.toLowerCase()]]));
fs.writeFileSync(new URL("./.seed.json", import.meta.url), JSON.stringify(st));
console.log("collection", st.collection.length, "cards cached", Object.keys(cache).length, "bytes", JSON.stringify(st).length);
