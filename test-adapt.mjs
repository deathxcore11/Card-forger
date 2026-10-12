import assert from "node:assert/strict";
import { adaptList, ownedDraft, engineOf, similarLists, swapPool, costToFinish } from "./adapt.js";

const R = (key, qty, kind, price, owned = 0) => ({ key, name: key, qty, kind, price, owned });
const list = [R("Engine A", 4, "creature", 20), R("Engine B", 4, "creature", 15), R("Pricey Removal", 4, "spell", 30), R("Fetch Land", 4, "land", 25), R("Mountain", 16, "land", 0.1), R("Cheap Burn", 4, "spell", 0.5, 4)];
const other1 = [R("Engine A", 4, "creature", 20), R("Engine B", 3, "creature", 15), R("Budget Removal", 4, "spell", 1), R("Mountain", 20, "land", 0.1)];
const other2 = [R("Engine A", 4, "creature", 20), R("Engine B", 4, "creature", 15), R("Budget Removal", 2, "spell", 1), R("Pricey Removal", 2, "spell", 30), R("Mountain", 18, "land", 0.1)];
const unrelated = [R("Other Deck", 4, "creature", 5), R("Island", 20, "land", 0.1)];

const sim = similarLists(list, [list, other1, other2, unrelated]);
assert.deepEqual(sim, [other1, other2], "similar lists share most cards; unrelated ones don't count");
const engine = engineOf(list, sim, (k) => k === "Mountain");
assert.ok(engine.has("Engine A") && engine.has("Engine B"), "cards most similar lists play are the engine");
assert.ok(!engine.has("Mountain"), "generic cards aren't engine");
const pool = swapPool(list, sim);
assert.equal(pool.find((p) => p.key === "Budget Removal").lists, 2);

const full = costToFinish(list);
const a = adaptList({ rows: list, pool, engine, budget: 200, similarCount: sim.length });
assert.ok(a.rows.some((r) => r.key === "Engine A" && r.qty === 4), "engine is never cut");
const swap = a.swaps.find((s) => s.out === "Pricey Removal");
assert.equal(swap.in, "Budget Removal", "swapped for a cheaper card of the same type from similar lists");
assert.match(swap.why, /2 of 2 similar lists/);
assert.ok(a.cost < full);
const land = a.swaps.find((s) => s.out === "Fetch Land");
assert.ok(!land || land.in === null, "a land is never replaced by a non-land");
assert.equal(a.rows.reduce((x, r) => x + r.qty, 0) + a.open, 36, "every slot is either filled or reported open");

const d = ownedDraft(list);
assert.deepEqual(d.rows.map((r) => r.key), ["Cheap Burn"]);
assert.equal(d.open, 32);
assert.equal(d.missing[0].key, "Mountain", "the cheapest way to finish comes first");
// Archetype cards are engine, and a swap never brings in another archetype.
{
  const G = (key, qty, kind, price, group) => ({ key, name: key, qty, kind, price, owned: 0, core: true, group });
  const yummy = [G("Marshmao", 3, "Monster", 30, "Yummy"), R("Hand Trap", 2, "Monster", 20)];
  const pool = [{ ...G("Magicians' Souls", 3, "Monster", 1, "Dark Magician"), lists: 9 }, { ...R("Cheap Trap", 3, "Monster", 2), lists: 4 }];
  const e = engineOf(yummy, [], () => false);
  assert.ok(e.has("Marshmao"));
  const x = adaptList({ rows: yummy, pool, engine: e, budget: 0, similarCount: 9 });
  assert.ok(!x.swaps.some((s) => s.out === "Marshmao"), "engine kept");
  assert.equal(x.swaps.find((s) => s.out === "Hand Trap").in, "Cheap Trap", "Magicians' Souls is another archetype, so it isn't used");
}
// Cheap cards aren't cut just to save pennies; an unreachable budget names the engine's cost.
{
  const rows = [{ key: "Engine", name: "Engine", qty: 3, kind: "Monster", price: 90, owned: 0, core: true }, { key: "Hand Trap", name: "Hand Trap", qty: 2, kind: "Monster", price: 0.5, owned: 0 }];
  const x = adaptList({ rows, pool: [], engine: engineOf(rows, []), budget: 25 });
  assert.equal(x.open, 0, "no slot opened to save $1.50");
  assert.equal(x.fits, false);
  assert.equal(x.engineCost, 270);
  assert.equal(x.engineTop[0].name, "Engine");
}
console.log("PASS: closest proven deck — similar lists, engine kept, same-type swaps with reasons, open slots reported, owned draft.");
