import assert from "node:assert/strict";
import fs from "node:fs";
import { mtgTags, rankPairs, mtgPairQueries } from "./pairing.js";
import { setMtgSynergy, worksWith, watchOuts } from "./mtg-synergy.js";
import { guideHtml, playGuide } from "./guide.js";

const agate = { name: "Agate Assault", type_line: "Sorcery", cmc: 3, color_identity: ["R"], keywords: [], oracle_text: "Choose one —\n• Agate Assault deals 4 damage to target creature. If that creature would die this turn, exile it instead.\n• Exile target artifact." };
const trash = { name: "Take Out the Trash", type_line: "Instant", cmc: 2, color_identity: ["R"], keywords: [], oracle_text: "Take Out the Trash deals 3 damage to target creature or planeswalker." };
const imodane = { name: "Imodane, the Pyrohammer", type_line: "Legendary Creature — Human Knight", cmc: 4, color_identity: ["R"], keywords: [], oracle_text: "Whenever an instant or sorcery spell you control that targets only a single creature deals damage to that creature, Imodane deals that much damage to each opponent." };
const judith = { name: "Judith, Carnage Connoisseur", type_line: "Legendary Creature — Human Shaman", cmc: 5, color_identity: ["B", "R"], keywords: [], oracle_text: "Whenever you cast an instant or sorcery spell, choose one —\n• That spell gains deathtouch and lifelink." };
const muerra = { name: "Muerra, Trash Tactician", type_line: "Legendary Creature — Raccoon Warrior", cmc: 3, color_identity: ["G", "R"], keywords: [], oracle_text: "Whenever you expend 4, you gain 3 life." };
const alania = { name: "Alania, Divergent Storm", type_line: "Legendary Creature — Otter Wizard", cmc: 5, color_identity: ["R", "U"], keywords: [], oracle_text: "Whenever you cast a spell, if it's the first instant spell, the first sorcery spell, or the first Otter spell other than Alania you've cast this turn, you may have target opponent draw a card. If you do, copy that spell." };
const scrap = { name: "Scrapshooter", type_line: "Creature — Raccoon Archer", cmc: 3, color_identity: ["G"], keywords: ["Reach"], oracle_text: "Gift a card\nReach\nWhen this creature enters, if the gift was promised, destroy target artifact or enchantment an opponent controls." };
const zada = { name: "Zada, Hedron Grinder", type_line: "Legendary Creature — Goblin Ally", cmc: 4, color_identity: ["R"], keywords: [], oracle_text: "Whenever you cast an instant or sorcery spell that targets only Zada, copy that spell for each other creature you control that the spell could target." };

const a = mtgTags(agate);
assert(a.provides.has("creature_burn") && a.provides.has("cast_spell") && a.provides.has("expend"));
assert(!mtgTags(trash).provides.has("creature_burn"), "'creature or planeswalker' is not a single-creature spell by this rule");
assert(mtgTags(imodane).needs.has("creature_burn"));
assert(mtgTags(judith).needs.has("cast_spell") && mtgTags(alania).needs.has("cast_spell"));
assert(mtgTags(muerra).needs.has("expend"));
assert(!mtgTags(scrap).needs.has("expend"), "Scrapshooter is not an Expend card");
assert(mtgTags(muerra).provides.has("expend"));

const ranked = rankPairs("mtg", agate, [imodane, judith, muerra, alania, scrap].map((card) => ({ card })));
const names = ranked.map((p) => p.card.name);
for (const n of [imodane.name, judith.name, muerra.name, alania.name]) assert(names.includes(n), n + " pairs with Agate Assault");
assert(!names.includes(scrap.name), "Scrapshooter does not pair through Expend");
assert(mtgPairQueries(agate).some((q) => q.tag === "creature_burn"));

const data = JSON.parse(fs.readFileSync(new URL("./mtg-synergy.json", import.meta.url), "utf8"));
setMtgSynergy(data);
const ww = worksWith(agate, { owned: (n) => (n === "Muerra, Trash Tactician" ? 1 : 0) });
assert(ww.length && ww[0].name === "Muerra, Trash Tactician", "owned partners first");
assert(ww.some((x) => x.name === "Imodane, the Pyrohammer"));
assert(!ww.some((x) => /Zada|Scrapshooter|Bello/.test(x.name)));
assert.deepEqual(worksWith(trash).filter((x) => x.name === "Imodane, the Pyrohammer"), []);

assert.match(watchOuts(agate)[0], /exiled instead/);
assert.match(watchOuts(alania)[0], /opponent draws/);
assert.equal(watchOuts(trash).length, 0);

const html = guideHtml("mtg", agate, playGuide("mtg", agate), { worksWith: ww, watch: watchOuts(agate) });
assert.match(html, /Works with/); assert.match(html, /Watch out/);
console.log("mtg-synergy ok");
