// Yu-Gi-Oh! and Pokémon deck rules, card normalization and import parsing.
import assert from "node:assert/strict";
import { normalizeYgo, validateYgo, ygoLimit, ygoLegality, YGO_FORMATS } from "./ygo.js";
import { normalizePtcg, validatePtcg, PTCG_FORMATS } from "./ptcg.js";
import { parseLines, parseYdk, ptcglName, entryPrice, tcgAddSheet, variantArtwork, variantArtThumb } from "./tcg.js";

const F = (list, id) => list.find((f) => f.id === id);
// ---- Yu-Gi-Oh!
const ygo = (id, name, o = {}) => normalizeYgo({ id, name, type: o.type || "Normal Monster", frameType: o.frame || "normal", desc: "", atk: 1000, def: 1000, level: 4, race: "Warrior", banlist_info: o.ban, card_prices: [{ tcgplayer_price: o.usd || "0.50", cardmarket_price: "0.10" }], misc_info: [{ formats: o.pools || ["TCG", "OCG", "GOAT"] }] });
const dm = ygo(1, "Dark Magician"), pot = ygo(2, "Pot of Greed", { type: "Spell Card", ban: { ban_tcg: "Forbidden", ban_goat: "Limited" } }), fusion = ygo(3, "Dark Paladin", { type: "Fusion Monster", frame: "fusion" }), semi = ygo(4, "Semi Card", { ban: { ban_tcg: "Semi-Limited" } }), ocgOnly = ygo(5, "OCG Only", { pools: ["OCG"] });
const cards = Object.fromEntries([dm, pot, fusion, semi, ocgOnly].map((c) => [c.id, c])), of = (id) => cards[id];
const tcg = F(YGO_FORMATS, "tcg"), trad = F(YGO_FORMATS, "traditional"), goat = F(YGO_FORMATS, "goat");
assert.equal(dm.prices.usd, 0.5);
assert.ok(fusion.extra && !dm.extra);
assert.equal(ygoLimit(pot, tcg), 0);
assert.equal(ygoLimit(pot, trad), 1);
assert.equal(ygoLimit(pot, goat), 1);
assert.equal(ygoLimit(semi, tcg), 2);
assert.equal(ygoLegality(ocgOnly, tcg), "not_legal");
const deck = (main, extra = [], side = []) => ({ zones: { main, extra, side } });
const forty = [{ cardId: "1", name: "Dark Magician", qty: 3 }, ...Array.from({ length: 37 }, (_, i) => ({ cardId: "x" + i, name: "Filler " + i, qty: 1 }))];
assert(validateYgo(deck(forty),of,tcg).some(i=>i.level==='pending'),'unresolved filler cards are unverified');
for(let i=0;i<37;i++)cards["x"+i]=ygo("x"+i,"Filler "+i);
assert.deepEqual(validateYgo(deck(forty), of, tcg), []);
const t = (d, f = tcg) => validateYgo(d, of, f).map((i) => i.text).join(" | ");
assert.match(t(deck(forty.slice(0, 10))), /needs 40–60/);
assert.match(t(deck([...forty, { cardId: "2", name: "Pot of Greed", qty: 1 }])), /Pot of Greed is Forbidden/);
assert.doesNotMatch(t(deck([...forty, { cardId: "2", name: "Pot of Greed", qty: 1 }]), trad), /Pot of Greed/);
assert.match(t(deck([...forty, { cardId: "4", name: "Semi Card", qty: 3 }])), /allows 2 \(Semi-Limited\)/);
assert.match(t(deck([...forty, { cardId: "3", name: "Dark Paladin", qty: 1 }])), /move it to the Extra Deck/);
assert.match(t(deck(forty, [{ cardId: "1", name: "Dark Magician", qty: 1 }])), /can’t go in the Extra Deck/);
assert.match(t(deck([...forty.slice(1), { cardId: "1", name: "Dark Magician", qty: 2 }], [], [{ cardId: "1", name: "Dark Magician", qty: 2 }])), /4 copies, Advanced \(TCG\) allows 3/);
assert.match(t(deck([...forty, { cardId: "5", name: "OCG Only", qty: 1 }])), /isn’t available in Advanced/);
// ---- Pokémon
const pk = (id, name, o = {}) => normalizePtcg({ id, name, category: o.cat || "Pokemon", stage: o.stage ?? "Basic", energyType: o.energy, rarity: o.rarity || "Common", legal: { standard: o.std ?? true, expanded: true }, pricing: { tcgplayer: { normal: { marketPrice: 0.25, productId: 9 } } }, image: "https://assets.tcgdex.net/en/sv/sv01/001" });
const pika = pk("sv1-1", "Pikachu"), nest = pk("sv1-2", "Nest Ball", { cat: "Trainer", stage: null }), ace = pk("sv1-3", "Prime Catcher", { cat: "Trainer", stage: null, rarity: "ACE SPEC Rare" }), energy = pk("sv1-4", "Basic Lightning Energy", { cat: "Energy", stage: null, energy: "Normal" }), old = pk("sv1-5", "Old Card", { std: false }), rad = pk("sv1-6", "Radiant Charizard"), rad2 = pk("sv1-7", "Radiant Greninja"), exmon = pk("sv1-8", "Pikachu ex");
const P = Object.fromEntries([pika, nest, ace, energy, old, rad, rad2, exmon].map((c) => [c.id, c])), pof = (id) => P[id];
const std = F(PTCG_FORMATS, "standard"), glc = F(PTCG_FORMATS, "glc");
assert.equal(pika.prices.usd, 0.25);
assert.ok(energy.basicEnergy && ace.aceSpec && rad.radiant && exmon.ruleBox && !pika.ruleBox);
const pd = (rows) => ({ zones: { main: rows } });
const ok60 = [{ cardId: "sv1-1", name: "Pikachu", qty: 4 }, { cardId: "sv1-2", name: "Nest Ball", qty: 4 }, { cardId: "sv1-4", name: "Basic Lightning Energy", qty: 52 }];
const pt = (rows, f = std) => validatePtcg(pd(rows), pof, f).map((i) => i.text).join(" | ");
assert.equal(pt(ok60), "");
assert.match(pt(ok60.slice(0, 2)), /8\/60 cards/);
assert.match(pt([{ cardId: "sv1-1", name: "Pikachu", qty: 5 }, ...ok60.slice(1, 2), { cardId: "sv1-4", name: "E", qty: 51 }]), /5× Pikachu/);
assert.match(pt([...ok60.slice(0, 2), { cardId: "sv1-3", name: "Prime Catcher", qty: 2 }, { cardId: "sv1-4", name: "E", qty: 50 }]), /2 ACE SPEC/);
assert.match(pt([...ok60.slice(0, 2), { cardId: "sv1-6", name: "Radiant Charizard", qty: 1 }, { cardId: "sv1-7", name: "Radiant Greninja", qty: 1 }, { cardId: "sv1-4", name: "E", qty: 50 }]), /2 Radiant/);
assert.match(pt([...ok60.slice(0, 2), { cardId: "sv1-5", name: "Old Card", qty: 1 }, { cardId: "sv1-4", name: "E", qty: 51 }]), /Old Card .* isn’t legal in Standard/);
assert.match(pt([{ cardId: "sv1-2", name: "Nest Ball", qty: 4 }, { cardId: "sv1-4", name: "E", qty: 56 }]), /No Basic Pokémon/);
assert.match(pt([{ cardId: "sv1-1", name: "Pikachu", qty: 2 }, { cardId: "sv1-8", name: "Pikachu ex", qty: 1 }, { cardId: "sv1-4", name: "E", qty: 57 }], glc), /Pikachu ex .*Rule Box|2× Pikachu/);
// ---- import parsing
assert.deepEqual(parseLines("Pokémon: 4\n4 Pikachu ex SVI 63\n2x Nest Ball\nDark Magician"), [{ qty: 4, name: "Pikachu ex SVI 63" }, { qty: 2, name: "Nest Ball" }, { qty: 1, name: "Dark Magician" }]);
assert.equal(ptcglName("Pikachu ex SVI 63"), "Pikachu ex");
assert.equal(ptcglName("Nest Ball"), "Nest Ball");
assert.deepEqual(parseYdk("#created by x\n#main\n46986414\n46986414\n#extra\n98502113\n!side\n55144522\n"), { main: ["46986414", "46986414"], extra: ["98502113"], side: ["55144522"] });
console.log("PASS: Yu-Gi-Oh! (Forbidden/Limited/Semi, Traditional, Extra Deck, card pools) and Pokémon (60 cards, 4 by name, ACE SPEC, Radiant, legality, GLC) rules; .ydk and PTCGL parsing.");

// ---- generators
import { buildYgo, buildPtcg } from "./tcgbuild.js";
{
  const mk = (id, name, o = {}) => ({ ...ygo(id, name, o), level: o.level ?? 4 });
  const seed = mk("10", "Blue-Eyes White Dragon", { level: 8 });
  const arch = [seed, ...Array.from({ length: 8 }, (_, i) => mk("a" + i, "BE Support " + i)), mk("x1", "BE Fusion", { type: "Fusion Monster", frame: "fusion" })];
  const staples = [pot, ...Array.from({ length: 12 }, (_, i) => mk("s" + i, "Staple " + i, { type: "Spell Card" }))];
  const r = buildYgo({ f: tcg, seed, archetype: arch, staples, limit: ygoLimit, legal: ygoLegality, owned: () => 0, price: (c) => c.prices.usd, budget: 1000 });
  assert.equal(r.total, 40);
  assert.ok(!r.zones.main.some((x) => x.name === "Pot of Greed"), "forbidden staple skipped");
  assert.ok(r.zones.extra.some((x) => x.name === "BE Fusion") && !r.zones.main.some((x) => x.name === "BE Fusion"));
  assert.deepEqual(validateYgo(r.zones ? { zones: r.zones } : r, (id) => [...arch, ...staples].find((c) => c.id === id), tcg), []);
  const poor = buildYgo({ f: tcg, seed, archetype: arch, staples, limit: ygoLimit, legal: ygoLegality, owned: () => 0, price: (c) => c.prices.usd, budget: 0 });
  assert.equal(poor.cost, 0);
  const mine = buildYgo({ f: tcg, seed, seeds: [arch[1], arch[2]], archetype: arch, staples, limit: ygoLimit, legal: ygoLegality, owned: (c) => ([seed, arch[1], arch[2]].includes(c) ? 2 : 0), price: (c) => c.prices.usd, budget: 0 });
  assert.equal(mine.total, 6, "a $0 budget uses every owned copy of the chosen cards");
  assert.equal(mine.cost, 0);
  assert.ok(poor.warnings.length);
}
{
  const b = pk("p1", "Charmander", {}), s1 = { ...pk("p2", "Charmeleon", { stage: "Stage1" }), stage: "Stage1" }, s2 = { ...pk("p3", "Charizard ex", { stage: "Stage2" }), stage: "Stage2" };
  const tr = Array.from({ length: 12 }, (_, i) => ({ card: pk("t" + i, "Trainer " + i, { cat: "Trainer", stage: null }), want: 4 }));
  const fire = pk("e1", "Basic Fire Energy", { cat: "Energy", stage: null, energy: "Normal" });
  const r = buildPtcg({ line: [{ card: b, want: 4 }, { card: s1, want: 2 }, { card: s2, want: 3 }], trainers: tr, energy: [fire], owned: (c) => (c.basicEnergy ? 99 : 0), price: () => 0.5, budget: 1000 });
  assert.equal(r.total, 60);
  assert.equal(r.zones.main.find((x) => x.name === "Basic Fire Energy").qty, 9);
  assert.equal(r.zones.main.find((x) => x.name === "Charmander").qty, 4);
  const cheap = buildPtcg({ line: [{ card: b, want: 4 }], trainers: tr, energy: [fire], owned: (c) => (c.basicEnergy ? 99 : 0), price: () => 0.5, budget: 5 });
  assert.ok(cheap.cost <= 5);
  assert.equal(cheap.zones.main.find((x) => x.name === "Basic Fire Energy").qty, 14, "Energy tops up to 14 at most, not to 60");
  assert.ok(cheap.total < 60 && cheap.warnings.some((w) => /slots still open/.test(w)), "the open slots are reported");
  const mine = buildPtcg({ line: [{ card: b, want: 4 }], trainers: tr, energy: [fire], owned: (c) => (c.basicEnergy ? 99 : c === b ? 4 : 0), price: () => 0.5, budget: 0 });
  assert.equal(mine.zones.main.find((x) => x.name === "Charmander").qty, 4, "a $0 budget still uses the cards you own");
  assert.equal(mine.cost, 0);
}
console.log("PASS: Yu-Gi-Oh! and Pokémon generators — legal 40/60-card lists, Forbidden staples skipped, budgets respected.");

// Variant availability must survive missing marketplace prices.
const vintage = normalizePtcg({ id:"base1-4", name:"Charizard", category:"Pokemon", set:{id:"base1",name:"Base Set"}, variants:{firstEdition:true,holo:true}, pricing:{tcgplayer:{holofoil:{marketPrice:900}}}, variants_detailed:[
 {variantId:"regular",type:"holo",subtype:"unlimited",pricing:{tcgplayer:{holofoil:{marketPrice:900}}}},
 {variantId:"first",type:"holo",subtype:"shadowless",stamp:["1st-edition"]},
 {variantId:"shadowless",type:"holo",subtype:"shadowless"},
 {variantId:"copyright",type:"holo",subtype:"1999-2000-copyright"}
] });
assert.equal(vintage.variants.find(v=>v.key === "detail:first").usd,null);
assert.match(tcgAddSheet(vintage),/First Edition · Shadowless/);
assert.match(tcgAddSheet(vintage),/1999 2000 Copyright/);
assert.equal(entryPrice(vintage,{variant:"detail:first"}),null,"never use Unlimited price for unpriced First Edition");
assert.equal(entryPrice(vintage,{variant:"detail:shadowless"}),null);
assert.equal(entryPrice(vintage,{variant:"holofoil"}),900,"existing finish keys retained");
assert.equal(entryPrice(vintage,{variant:"old-unknown-version"}),null);
const modern = normalizePtcg({id:"swsh3-136",name:"Furret",variants:{normal:true,reverse:true},variants_detailed:[{variantId:"n",type:"normal",pricing:{tcgplayer:{normal:{marketPrice:0.27},"reverse-holofoil":{marketPrice:0.43}}}},{variantId:"r",type:"reverse",pricing:{tcgplayer:{normal:{marketPrice:0.27},"reverse-holofoil":{marketPrice:0.43}}}}]});
assert.equal(entryPrice(modern,{variant:"normal"}),0.27);
assert.equal(entryPrice(modern,{variant:"reverse-holofoil"}),0.43);
assert.equal(entryPrice(dm,{edition:"1st-edition"}),null,"YGO generic price is not edition-specific");
assert.match(tcgAddSheet(dm),/First Edition/);
console.log("PASS: collectible versions without prices, Shadowless/First Edition isolation, modern reverse holo and YGO editions.");

const reference = variantArtwork({name:"Charizard",id:"base1-4",image:"https://example.test/reference.webp"},{label:"First Edition Shadowless"});
assert.equal(reference.exact,false);
assert.match(reference.label,/Reference art/);
const exact = variantArtwork({image:"https://example.test/reference.webp"},{image:"https://example.test/first.webp",imageLarge:"https://example.test/first-large.webp"});
assert.equal(exact.exact,true);
assert.equal(exact.image,"https://example.test/first.webp");
const thumb = variantArtThumb({name:"Charizard",id:"base1-4",image:"https://example.test/reference.webp"},{key:"first",label:"First Edition"});
assert.match(thumb,/data-act="tVariantArt"/);
assert.match(thumb,/Reference art/);
assert.match(thumb,/data-art-sources=/, "every artwork source is tried before showing unavailable");
const alt = normalizeYgo({id:1,name:"Example",card_images:[{id:1},{id:2}]});
assert.deepEqual(alt.artworks.map(a=>a.id),["1","2"],"all source artwork preserved");
assert.match(alt.artworks[1].image,/2[.]jpg$/);
const supplied = normalizePtcg({id:"base1-4",name:"Charizard",variants_detailed:[{variantId:"first",type:"holo",stamp:["1st-edition"],image:"https://example.test/first"}]});
assert.equal(supplied.variants[0].image,"https://example.test/first/low.webp");
console.log("PASS: exact-vs-reference variant art, unavailable-image label, YGO alternate artwork and Pokémon supplied images.");

// Second Pokémon price source fills only what TCGdex left empty, for the same set only.
{
  const { applyFallbackPrices } = await import("./ptcg.js");
  const c = { name: "Pikachu", set: { name: "30th Celebration", number: "023" }, variants: [{ key: "normal", label: "Normal", usd: null }, { key: "reverse-holofoil", label: "Reverse holo", usd: null }], prices: { usd: null }, sets: [{ price: null }] };
  assert.equal(applyFallbackPrices(c, { tcgplayer: { updatedAt: "2026/10/12", prices: { normal: { market: 3.5 }, reverseHolofoil: { market: 6 } } } }), true);
  assert.equal(c.prices.usd, 3.5);
  assert.equal(c.variants[1].usd, 6);
  assert.match(c.prices.source, /Pokémon TCG API/);
  assert.equal(c.sets[0].price, 3.5);
  const none = { name: "X", variants: [{ key: "normal", usd: null }], prices: { usd: null } };
  assert.equal(applyFallbackPrices(none, { tcgplayer: { prices: {} } }), false);
  console.log("PASS: Pokémon fallback prices fill empty versions only.");
}
{
  const { plainText } = await import("./ptcg.js");
  assert.equal(plainText('Discard a <span class="energy-symbol Fire" title="Fire">Fire</span> Energy'), "Discard a Fire Energy");
  console.log("PASS: Pokémon card text keeps the words, drops the markup.");
}
