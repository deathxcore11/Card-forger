// Higher budgets buy a stronger list (within $10 of the budget); Power never drops; protected cards stay.
import assert from "node:assert/strict";
import { spendUp, cardQuality, budgetNotes, purchaseCost } from "./deck-optimizer.js";

const card = (name, price, rate) => ({ name, price, rate });
const filler = Array.from({ length: 10 }, (_, i) => card("Filler " + i, 0.1, 0));
const strong = [card("Staple A", 3, 60), card("Staple B", 6, 45), card("Staple C", 12, 30), card("Bomb D", 40, 25)];
const all = new Map([...filler, ...strong, card("Seed", 1, 10)].map((c) => [c.name, c]));
const deck = { cards: [{ name: "Seed", qty: 4 }, ...filler.map((c) => ({ name: c.name, qty: 4 }))] };
const rows = (d) => d.cards.map((r) => ({ key: r.name, zone: "main", qty: r.qty, card: all.get(r.name) }));
const swap = (d, w, c, n) => {
  const cards = structuredClone(d.cards), out = cards.find((r) => r.name === w.key);
  out.qty -= n;
  const hit = cards.find((r) => r.name === c.name);
  if (hit) hit.qty += n; else cards.push({ name: c.name, qty: n });
  return { ...d, cards: cards.filter((r) => r.qty > 0) };
};
const cost = (d) => purchaseCost(d.cards, { key: (r) => r.name, price: (r) => all.get(r.name).price });
const quality = (c) => cardQuality(c.rate, c.price);
// Power: a toy evaluator that rewards played cards (so upgrades never lower it).
const evaluate = (d) => ({ score: Math.min(100, 40 + d.cards.reduce((a, r) => a + all.get(r.name).rate * r.qty, 0) / 20) });
const opts = { pool: [...strong, ...filler], quality, rows, swap, cost, evaluate, protect: (r) => r.key === "Seed", maxCopies: () => 4 };

const base = cost(deck).cost;
const t25 = await spendUp(deck, 25, opts), t100 = await spendUp(deck, 100, opts), tInf = await spendUp(deck, Infinity, opts);
assert.ok(t25.swaps.length > 0, "$25 buys upgrades");
assert.ok(t25.cost <= 35 && t25.cost >= 15, `$25 tier lands near $25 (got ${t25.cost.toFixed(2)})`);
assert.ok(t100.cost > t25.cost && t100.cost <= 110, `$100 tier spends more (got ${t100.cost.toFixed(2)})`);
assert.ok(t100.power.score > t25.power.score, "more budget → stronger list");
assert.ok(t100.deck.cards.find((r) => r.name === "Seed").qty === 4, "the build-around card is never swapped out");
assert.ok(tInf.cost >= t100.cost, "no-limit version spends at least as much");

const notes = budgetNotes([{ ...deck, cost: base, power: 40 }, { ...t25.deck, cost: t25.cost, power: t25.power.score, upgrades: t25.swaps }, { ...tInf.deck, cost: tInf.cost, power: tInf.power.score }], [0, 25, Infinity]);
assert.match(notes[1].explanation, /upgrade/);
if (tInf.cost > 35) assert.match(notes[1].explanation, /strongest version found costs/);
console.log(`PASS: budgets spend toward their limit ($25 → $${t25.cost.toFixed(2)}, $100 → $${t100.cost.toFixed(2)}, no limit → $${tInf.cost.toFixed(2)}), Power rises, seed kept.`);
