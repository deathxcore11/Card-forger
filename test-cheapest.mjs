import assert from "node:assert/strict";
globalThis.localStorage = { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = String(v); } };
const { cheapestQuery, refreshCheapest, cheapestKnown } = await import("./mtg-cheap.js");
const { playSig } = await import("./ptcg.js");
// Magic: the cheapest printing that is legal in a tournament (no gold borders, oversized or memorabilia).
const q = cheapestQuery("Fire // Ice");
assert.ok(q.startsWith('!"Fire"') && /-border:gold/.test(q) && /-is:oversized/.test(q) && /unique:prints/.test(q));
let calls = 0;
const api = async (path) => { calls++; return { data: [{ name: path.includes("Bolt") ? "Lightning Bolt" : "Mystery", games: ["paper"], legalities: { modern: "legal" }, set: "fca", collector_number: "12", prices: { usd: path.includes("Bolt") ? "0.74" : null } }] }; };
await refreshCheapest(["Lightning Bolt", "Lightning Bolt", "Mystery"], { api, key: (n) => n.toLowerCase() });
assert.equal(calls, 2, "one lookup per card");
assert.equal(cheapestKnown("lightning bolt").usd, 0.74);
assert.equal(cheapestKnown("mystery").usd, null);
await refreshCheapest(["Lightning Bolt"], { api, key: (n) => n.toLowerCase() });
assert.equal(calls, 2, "kept for a week");
// Pokémon: alternate arts with the same game text are the same card; a different attack isn't.
const base = { name: "Milotic ex", category: "Pokemon", hp: 270, stage: "Stage1", evolveFrom: "Feebas", types: ["Water"], retreat: 2, weak: [{ type: "Lightning", value: "×2" }], text: "Ability: Sparkling Scales\nPrevent all damage…\n\n[Water · Colorless] Hypno Splash — 160" };
assert.equal(playSig(base), playSig({ ...base, rarity: "Special illustration rare", id: "sv08-217" }));
assert.notEqual(playSig(base), playSig({ ...base, text: base.text.replace("160", "150") }));
assert.notEqual(playSig(base), playSig({ ...base, hp: 260 }));
console.log("PASS: cheapest equivalent printing (Magic tournament-legal printings, Pokémon same game text).");
// Legality: any Basic Energy printing is legal in every format; other cards keep their set legality.
const { ptcgLegality, validatePtcg, PTCG_FORMATS } = await import("./ptcg.js");
const std = PTCG_FORMATS.find((f) => f.id === "standard");
assert.equal(ptcgLegality({ basicEnergy: true, legal: { standard: false, expanded: true } }, std), "legal");
assert.equal(ptcgLegality({ name: "Ultra Ball", legal: { standard: false, expanded: true } }, std), "not_legal");
// Mixing printings of one card still counts toward the four-copy limit by name.
const cards = { a: { name: "Milotic ex", category: "Pokemon", stage: "Basic", legal: { standard: true } }, b: { name: "Milotic ex", category: "Pokemon", stage: "Basic", legal: { standard: true } } };
const issues = validatePtcg({ zones: { main: [{ cardId: "a", qty: 3 }, { cardId: "b", qty: 2 }] } }, (id) => cards[id], std).map((x) => x.text).join(" ");
assert.match(issues, /5× Milotic ex/);
console.log("PASS: cheaper printings keep decks legal (Basic Energy rule, per-name copy limits).");
// Structured identity: one changed game field means a different card, never a "cheaper printing".
const { prizeValue } = await import("./ptcg.js");
const milo = { name: "Milotic ex", category: "Pokemon", stage: "Stage1", hp: 270, types: ["Water"], evolveFrom: "Feebas", retreat: 2, weak: [{ type: "Lightning", value: "×2" }], resist: [], abilities: [{ type: "Ability", name: "Sparkling Scales", effect: "Prevent all damage…" }], attacks: [{ cost: ["Water", "Colorless", "Colorless"], name: "Hypno Splash", damage: "160", effect: "Your opponent's Active Pokémon is now Asleep." }] };
const sig = playSig(milo);
assert.equal(sig, playSig({ ...milo, id: "sv08-217", rarity: "Special illustration rare", image: "x" }), "art and rarity don't matter");
assert.equal(sig, playSig({ ...milo, attacks: [{ ...milo.attacks[0], effect: "Your  opponent’s Active Pokémon is now Asleep." }] }), "spacing and quote style don't matter");
for (const [what, changed] of [
  ["damage modifier + vs ×", { ...milo, attacks: [{ ...milo.attacks[0], damage: "160+" }] }],
  ["damage modifier × ", { ...milo, attacks: [{ ...milo.attacks[0], damage: "160×" }] }],
  ["resistance", { ...milo, resist: [{ type: "Fighting", value: "-30" }] }],
  ["attack cost", { ...milo, attacks: [{ ...milo.attacks[0], cost: ["Water", "Colorless"] }] }],
  ["ability text", { ...milo, abilities: [{ ...milo.abilities[0], effect: "Prevent all effects…" }] }],
  ["weakness value", { ...milo, weak: [{ type: "Lightning", value: "+30" }] }],
  ["retreat", { ...milo, retreat: 1 }],
  ["Prize value (Mega)", { ...milo, name: "Mega Milotic ex" }],
]) assert.notEqual(playSig(changed), sig, `a different ${what} is a different card`);
// Prize values.
for (const [name, n] of [["Mega Lucario ex", 3], ["Mega Kangaskhan ex", 3], ["Charizard VMAX", 3], ["Pikachu & Zekrom-GX", 3], ["Mewtwo V-UNION", 3], ["Milotic ex", 2], ["Arceus VSTAR", 2], ["Lugia V", 2], ["M Venusaur-EX", 2], ["Radiant Greninja", 1], ["Feebas", 1]])
  assert.equal(prizeValue({ category: "Pokemon", name }), n, `${name} gives ${n} Prizes`);
assert.equal(prizeValue({ category: "Trainer", name: "Boss's Orders" }), 1);
console.log("PASS: printings are the same card only when every game field matches; Prize values 1/2/3.");
