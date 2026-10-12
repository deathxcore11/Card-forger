// Pure tests for extras.js: bracket estimate, mana base, proxies, life tracker.
import assert from "node:assert/strict";
import { cardKey } from "./core.js";
import { explainSwap, deckReview, bracketEstimate, isTutor, isMassLandDenial, entersTapped, splitBasics, manaBase, proxyList, proxySheetHTML, newGame, isOut } from "./extras.js";

const card = (name, type, oracle = "", extra = {}) => ({ name, type_line: type, oracle_text: oracle, color_identity: [], legalities: { commander: "legal" }, ...extra });
const cat = (...cs) => Object.fromEntries(cs.map((c) => [cardKey(c.name), c]));
const deck = (names) => ({ id: "d", format: "Commander", commander: names[0], cards: names.map((name) => ({ name, qty: 1 })) });

// Tutors: nonland searches count, land fetch does not.
assert.ok(isTutor(card("Demonic Tutor", "Sorcery", "Search your library for a card, put that card into your hand, then shuffle.")));
assert.ok(isTutor(card("Worldly Tutor", "Instant", "Search your library for a creature card, reveal it, then shuffle and put the card on top.")));
assert.ok(!isTutor(card("Cultivate", "Sorcery", "Search your library for up to two basic land cards, reveal those cards.")));
assert.ok(!isTutor(card("Evolving Wilds", "Land", "Sacrifice Evolving Wilds: Search your library for a basic land card.")));
assert.ok(isMassLandDenial(card("Armageddon", "Sorcery", "Destroy all lands.")));
assert.ok(!isMassLandDenial(card("Cyclonic Rift", "Instant", "Return target nonland permanent you don't control to its owner's hand.")));

// Bracket floors.
const cmd = card("Leader", "Legendary Creature", "");
const gc = (n) => card("GC " + n, "Sorcery", "", { game_changer: true });
assert.equal(bracketEstimate(deck(["Leader"]), cat(cmd)).bracket, 2);
assert.equal(bracketEstimate(deck(["Leader", "GC 1"]), cat(cmd, gc(1))).bracket, 3);
const four = [1, 2, 3, 4].map(gc);
const b4 = bracketEstimate(deck(["Leader", ...four.map((c) => c.name)]), cat(cmd, ...four));
assert.equal(b4.bracket, 4);
assert.match(b4.lower.join(), /cut 1 Game Changer/);
assert.equal(bracketEstimate(deck(["Leader", "Armageddon"]), cat(cmd, card("Armageddon", "Sorcery", "Destroy all lands."))).bracket, 4);
// The explicit flag beats the fallback list.
assert.equal(bracketEstimate(deck(["Leader", "Sol Ring"]), cat(cmd, card("Sol Ring", "Artifact", "{T}: Add {C}{C}.", { game_changer: false }))).bracket, 2);
assert.equal(bracketEstimate(deck(["Leader", "Rhystic Study"]), cat(cmd, card("Rhystic Study", "Enchantment", ""))).bracket, 3);

// Tapped lands.
assert.ok(entersTapped(card("Azorius Guildgate", "Land — Gate", "This land enters tapped.\n{T}: Add {W} or {U}.")));
assert.ok(!entersTapped(card("Hallowed Fountain", "Land — Plains Island", "As this land enters, you may pay 2 life. If you don't, it enters tapped.")));
assert.ok(!entersTapped(card("Seachrome Coast", "Land", "This land enters tapped unless you control two or fewer other lands.")));

// Basics split by pips, every color gets one.
assert.deepEqual(splitBasics({ W: 0, U: 30, B: 0, R: 0, G: 10 }, 20), { U: 15, G: 5 });
const tiny = splitBasics({ W: 1, U: 40, B: 0, R: 0, G: 0 }, 10);
assert.equal(tiny.W, 1);
assert.equal(tiny.U + tiny.W, 10);
const lands = [card("Island", "Basic Land — Island"), card("Forest", "Basic Land — Forest")];
const mb = manaBase({ cards: [{ name: "Island", qty: 4 }, { name: "Forest", qty: 16 }] }, cat(...lands), { W: 0, U: 30, B: 0, R: 0, G: 10 });
assert.equal(mb.basicCount, 20);
assert.equal(mb.suggested.U, 15);
assert.ok(mb.off);

// Proxies skip basics, expand copies, escape text.
const px = proxyList([{ name: "Forest", qty: 3 }, { name: "Bad <b>", qty: 2 }], cat(lands[1], card("Bad <b>", "Creature", "x")));
assert.equal(px.length, 2);
const html = proxySheetHTML("T", px);
assert.doesNotMatch(html, /<b>Bad <b>/);
assert.match(html, /Bad &lt;b&gt;/);

// Life tracker.
const g = newGame(4, 40);
assert.equal(g.players.length, 4);
assert.ok(!isOut(g.players[0]));
assert.ok(isOut({ life: 5, poison: 0, cmd: 21 }));
assert.ok(isOut({ life: 5, poison: 10, cmd: 0 }));

// Deck review: rules problems are "bad", guidelines are "warn", empty slots are not missing cards.
{
  const leader = card("Leader", "Legendary Creature", "", { color_identity: ["G"] });
  const red = card("Bolt", "Instant", "Bolt deals 3 damage.", { color_identity: ["R"] });
  const banned = card("Bad Card", "Artifact", "", { legalities: { commander: "banned" } });
  const d = { id: "r", format: "Commander", commander: "Leader", cards: [{ name: "Leader", qty: 1 }, { name: "Bolt", qty: 1 }, { name: "Bad Card", qty: 1 }, { name: "Mystery", qty: 1 }] };
  const r = deckReview(d, cat(leader, red, banned));
  const titles = r.map((x) => x.title).join(" | ");
  assert.match(titles, /4\/100 cards/);
  assert.match(r.find((x) => /4\/100/.test(x.title)).detail, /96 empty slots/);
  assert.match(titles, /outside your commander’s colors/);
  assert.match(titles, /isn’t legal/);
  assert.match(titles, /no card data/);
  assert.equal(r[0].level, "bad");
  // Guideline checks wait until the list is nearly complete.
  assert.ok(!r.some((x) => x.heuristic));
  const full = { ...d, cards: [{ name: "Leader", qty: 1 }, { name: "Forest", qty: 99 }] };
  const r2 = deckReview(full, cat(leader, card("Forest", "Basic Land — Forest", "", { produced_mana: ["G"] })));
  assert.ok(r2.some((x) => x.heuristic && /99 lands/.test(x.title)));
  assert.ok(r2.every((x) => x.level === "warn"));
}

// Swap explanations come from the two cards, not a template.
{
  const giada = card("Giada", "Legendary Creature — Angel", "Each other Angel you control enters with additional +1/+1 counters.");
  const draw = card("Phyrexian Arena", "Enchantment", "At the beginning of your upkeep, you draw a card and you lose 1 life.", { cmc: 3 });
  const angel = card("Serra Angel", "Creature — Angel", "Flying, vigilance", { cmc: 5 });
  const e = explainSwap(draw, angel, giada, { Draw: 7 }, { Draw: 10 });
  assert.deepEqual(e.loses, ["Draw"]);
  assert.match(e.lines.map((l) => l.text).join(" "), /Loses card draw \(card draw 7 → 6\)/);
  assert.match(e.lines.map((l) => l.text).join(" "), /Is an Angel, which your commander cares about/);
  assert.match(e.choose, /theme or curve/);
  const ramp = card("Arcane Signet", "Artifact", "{T}: Add one mana of any color in your commander's color identity.", { cmc: 2 });
  const e2 = explainSwap(angel, ramp, giada, { Ramp: 6 }, { Ramp: 10 });
  assert.deepEqual(e2.gains, ["Ramp"]);
  assert.match(e2.lines.map((l) => l.text).join(" "), /mana value 5 → 2/);
}

console.log("PASS: swap explanations name real gains, losses and curve changes.");
console.log("PASS: deck review levels, empty slots vs. missing cards, guideline gating.");
console.log("PASS: bracket estimate, tutor/land-denial detection, tapped lands, basic split, proxy sheet and life tracker.");

// Upgrade engine: a creature-type match alone never replaces a card that does a real job.
{
  const { upgradeSuggestions } = await import("./strategy.js");
  const leader = card("Giada, Font of Hope", "Legendary Creature — Angel", "Flying, vigilance. Each other Angel you control enters with an additional +1/+1 counter.", { color_identity: ["W"], cmc: 2 });
  const arena = card("Divine Visitation", "Enchantment", "At the beginning of your upkeep, draw a card.", { color_identity: ["W"], cmc: 4, prices: { usd: "1" } });
  const angel = card("Plain Angel", "Creature — Angel", "Flying", { color_identity: ["W"], cmc: 4, prices: { usd: "0.5" } });
  const filler = Array.from({ length: 30 }, (_, i) => card("Filler " + i, "Creature — Human", "", { color_identity: ["W"], cmc: 3 }));
  const plains = card("Plains", "Basic Land — Plains", "", { color_identity: [] });
  const catalog = cat(leader, arena, angel, plains, ...filler);
  const deck = { id: "g", format: "Commander", commander: leader.name, strategy: "Auto", cards: [{ name: leader.name, qty: 1 }, { name: arena.name, qty: 1 }, ...filler.map((f) => ({ name: f.name, qty: 1 })), { name: "Plains", qty: 36 }] };
  const plan = upgradeSuggestions(deck, [], [], catalog, { budget: 25 });
  assert.ok(!plan.swaps.some((s) => s.cut === arena.name && s.add === angel.name), "theme-only swap must not cut a draw card");
}
console.log("PASS: theme-only upgrades never cut a card that provides ramp, draw, interaction or protection.");
