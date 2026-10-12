// Pure tests for extras.js: bracket estimate, mana base, proxies, life tracker.
import assert from "node:assert/strict";
import { cardKey } from "./core.js";
import { bracketEstimate, isTutor, isMassLandDenial, entersTapped, splitBasics, manaBase, proxyList, proxySheetHTML, newGame, isOut } from "./extras.js";

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

console.log("PASS: bracket estimate, tutor/land-denial detection, tapped lands, basic split, proxy sheet and life tracker.");
