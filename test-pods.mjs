// Commander pods: four-player games against the decks winning Commander tournaments. Placing
// decks win about their 25% share against each other; a precon-level deck is far behind them; no
// seat is punished for sitting first. Plus a guard against the Matchups crash ("simulateMatchup
// is not defined"): every matchup.js function app.js and views.js call is imported.
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";
import { mtgConstructedPower } from "./deckpower.js";
import { profileOf, simulatePod, calibratePods, podProfile } from "./matchup.js";
import { podSpeed } from "./extras.js";
import * as MU from "./matchup.js";

const B = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL("./test-fixtures/power-bench.json.gz", import.meta.url))));
const E = B.mtg.meta.EDH, cat = B.mtg.cards, k = (s) => s.toLowerCase();
const cardsOf = (d) => [...d.main, ...(d.commanders || []).map((r) => (typeof r === "string" ? { name: r, qty: 1 } : r))];
const prof = (cards) => podProfile(profileOf("mtg", mtgConstructedPower({ cards }, cat, k, 100), cards.map((r) => ({ qty: r.qty, c: cat[k(r.name)] })).filter((r) => r.c)), podSpeed({ cards }, cat));
const field = E.archetypes.filter((a) => a.share > 0).slice(0, 8).map((a) => { const l = E.decks.find((x) => x.key === a.best); return l && { key: l.key, name: a.name, share: a.share, profile: prof(cardsOf(l)) }; }).filter((f) => f?.profile);
assert.ok(field.length >= 6, "a Commander tournament field");
assert.ok(field.every((f) => f.profile.speed.turn <= 5), "tournament lists are paced as fast decks (fast mana, tutors, Game Changers)");
calibratePods(field);
for (const f of field.slice(0, 4)) {
  const p = simulatePod(f.profile, field, { shift: f.shift });
  assert.ok(p.win > 0.18 && p.win < 0.33, `${f.name} wins about its share of pods (got ${(p.win * 100).toFixed(1)}%)`);
  assert.ok(Math.max(...p.seats) - Math.min(...p.seats) < 0.12, `seats roughly even (${p.seats.map((x) => Math.round(x * 100)).join("/")})`);
}
// A precon-level pile: creatures and Sol Ring, bracket 2.
const pile = Object.values(cat).filter((c) => /Creature/.test(c.type_line || "") && !/Legendary/.test(c.type_line)).slice(0, 59).map((c) => ({ name: c.name, qty: 1 })).concat([{ name: "Sol Ring", qty: 1 }, { name: "Forest", qty: 40 }]);
const pp = prof(pile);
assert.equal(pp.speed.bracket, 2);
assert.ok(simulatePod(pp, field).win < 0.1, "a precon-level deck is far behind a cEDH table");
console.log("PASS: Commander pods — tournament decks win about 25% of pods, a precon-level deck far less, seats even.");

// Every matchup.js export app.js and views.js call must be imported there.
for (const file of ["app.js", "views.js", "tcg.js"]) {
  const src = fs.readFileSync(new URL("./" + file, import.meta.url), "utf8"), imp = src.match(/import \{([^}]*)\} from "\.\/matchup\.js"/)?.[1] || "";
  const have = new Set(imp.split(",").map((x) => x.trim()).filter(Boolean));
  for (const name of Object.keys(MU)) if (new RegExp(`(?<![\\w.])${name}\\(`).test(src.replace(/import \{[^}]*\} from "\.\/matchup\.js";/, "")) && !src.includes(`function ${name}`)) assert.ok(have.has(name), `${file} calls ${name} without importing it`);
}
console.log("PASS: Matchups code imports every simulation function it calls.");
