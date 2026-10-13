// Goldfish: the list is played out turn by turn; numbers move the right way when the list changes.
import assert from "node:assert/strict";
import { mtgGoldfish, ptcgGoldfish, ygoGoldfish } from "./goldfish.js";

// Magic: 20 Mountains + cheap 2-power creatures kills fast; swap in 6-drops and it slows down.
const mtn = { name: "Mountain", cmc: 0, type_line: "Basic Land — Mountain", oracle_text: "" };
const goblin = { name: "Goblin Guide", cmc: 1, type_line: "Creature — Goblin", power: "2", oracle_text: "Haste" };
const bear = { name: "Bear", cmc: 2, type_line: "Creature — Bear", power: "2", oracle_text: "" };
const bolt = { name: "Lightning Bolt", cmc: 1, type_line: "Instant", oracle_text: "Lightning Bolt deals 3 damage to any target." };
const giant = { name: "Giant", cmc: 6, type_line: "Creature — Giant", power: "6", oracle_text: "" };
const fast = mtgGoldfish([{ qty: 20, c: mtn }, { qty: 16, c: goblin }, { qty: 16, c: bear }, { qty: 8, c: bolt }], { plan: "Aggro" });
const slow = mtgGoldfish([{ qty: 24, c: mtn }, { qty: 24, c: giant }, { qty: 12, c: bear }], { plan: "Midrange" });
const killTurn = (g) => Number(g.headline.match(/turn (\d+)/)?.[1] || 99);
assert.ok(killTurn(fast) <= 5, `aggro kills by turn 5 (${fast.headline})`);
assert.ok(killTurn(slow) > killTurn(fast), "6-drops are slower");
assert.ok(fast.samples[0].log.length >= 4 && /Mountain/.test(fast.samples[0].log[0].text), "narrated turns use real card names");
assert.match(fast.winCon, /Goblin Guide|Bear|Lightning Bolt/);

// Pokémon: a Basic attacker with 2-cost attack swings on turn 2 much more often than a Stage 2 line.
const pk = (name, x) => ({ name, category: "Pokemon", ...x });
const tr = (name, effect, typeLine = "Trainer · Item") => ({ name, category: "Trainer", effect, typeLine });
const en = { name: "Basic Fire Energy", category: "Energy", basicEnergy: true };
const basicAtk = ptcgGoldfish([
  { qty: 4, c: pk("Charmander", { basicPokemon: true, stage: "Basic", attacks: [{ name: "Ember", cost: ["Fire", "Fire"], damage: "60" }] }) },
  { qty: 4, c: tr("Nest Ball", "Search your deck for a Basic Pokémon and put it onto your Bench.") },
  { qty: 4, c: tr("Professor's Research", "Discard your hand and draw 7 cards.", "Trainer · Supporter") },
  { qty: 12, c: en }, { qty: 36, c: tr("Filler", "Heal 30 damage.") },
], { attacker: "Charmander" });
assert.ok(basicAtk.metrics[0].value > 0.5, `a Basic attacker with 2 Energy usually swings turn 2 (${basicAtk.metrics[0].value})`);
assert.ok(basicAtk.samples[0].log.some((l) => /attacks/.test(l.text)));

// Yu-Gi-Oh!: hands are classified; more starters → more hands that play through a hand trap.
const tags = (...t) => new Set(t);
const y = (starters) => ygoGoldfish([{ qty: starters, c: { name: "Starter" }, tags: tags("starter") }, { qty: 6, c: { name: "Ash Blossom" }, tags: tags("handtrap") }, { qty: 40 - starters - 6, c: { name: "Filler" }, tags: tags() }], []);
assert.ok(y(15).metrics[0].value > y(6).metrics[0].value);
assert.ok(y(15).samples.length && y(15).samples[0].log.some((l) => /Open with Starter/.test(l.text)));
console.log(`PASS: goldfish plays lists out (aggro ${fast.headline.match(/turn \d+/)}, Pokémon turn-2 attack ${Math.round(basicAtk.metrics[0].value * 100)}%, YGO hands classified).`);
