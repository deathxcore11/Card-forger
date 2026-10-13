// Deck audit helpers shared by Deck Power (deckpower.js): shuffled-game simulation of the exact
// list, exact draw odds, and turning the rating's ingredients into ranked weaknesses and
// strengths with the cards behind each one. Pure functions, seeded, so the same list always
// gets the same numbers.

// Small fast seeded RNG (mulberry32).
export function rng(seed = 7) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// pool: one entry per physical card ({ tags: Set }). fn(shuffled) returns an object of
// booleans, or null to skip that shuffle (e.g. a mulligan). Only the first `depth` cards are
// shuffled, which is all any opening-hand question looks at. Returns { key: share true }.
export function simulate(pool, fn, { runs = 3000, depth = 16, seed = 7 } = {}) {
  const a = pool.slice(),
    r = rng(seed),
    hits = {};
  let used = 0;
  if (!a.length) return {};
  const d = Math.min(depth, a.length);
  for (let i = 0; i < runs; i++) {
    for (let j = 0; j < d; j++) {
      const k = j + Math.floor(r() * (a.length - j));
      [a[j], a[k]] = [a[k], a[j]];
    }
    const o = fn(a);
    if (!o) continue;
    used++;
    for (const key in o) hits[key] = (hits[key] || 0) + (o[key] ? 1 : 0);
  }
  for (const key in hits) hits[key] /= Math.max(1, used);
  return hits;
}

// Pool from rows ({ qty, tags }).
export function poolOf(rows) {
  const out = [];
  for (const r of rows) for (let i = 0; i < r.qty; i++) out.push(r);
  return out;
}
export const has = (cards, tag) => cards.some((c) => c.tags.has(tag));
export const countTag = (cards, tag) => cards.reduce((a, c) => a + (c.tags.has(tag) ? 1 : 0), 0);

// Exact: chance that at least one of k copies is among n cards drawn from N.
export function atLeastOne(N, k, n) {
  if (k <= 0 || N <= 0) return 0;
  let none = 1;
  for (let i = 0; i < n; i++) none *= Math.max(0, N - k - i) / Math.max(1, N - i);
  return 1 - none;
}
// Exact: chance that all k copies sit in a set of m cards (e.g. Pokémon Prizes) out of N.
export function allIn(N, k, m) {
  if (k <= 0 || k > m) return 0;
  let p = 1;
  for (let i = 0; i < k; i++) p *= (m - i) / (N - i);
  return p;
}

// "Ultra Ball ×4, Nest Ball ×2"
export const evidence = (rows, max = 12) => {
  const agg = new Map();
  for (const r of rows) {
    const name = r.c?.name ?? r.name,
      x = agg.get(name) || { name, qty: 0, id: r.id ?? r.c?.id };
    x.qty += r.qty;
    agg.set(name, x);
  }
  return [...agg.values()].sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name)).slice(0, max);
};

// Points each ingredient earns (out of 100) and what it loses.
export function scoreParts(parts) {
  const W = parts.reduce((a, p) => a + p.weight, 0) || 1;
  return parts.map((p) => ({ ...p, max: (p.weight / W) * 100, earned: ((p.weight * p.ratio) / W) * 100, lost: ((p.weight * (1 - p.ratio)) / W) * 100 }));
}

// Weaknesses: anything losing at least 1.5 points or under 75% of its target, biggest first.
// Strengths: ingredients at (or nearly at) their target that carry real weight.
export function review(parts) {
  const scored = scoreParts(parts);
  const weak = scored.filter((p) => p.lost >= 1.5 || p.ratio < 0.75).sort((a, b) => b.lost - a.lost);
  const strong = scored.filter((p) => p.ratio >= 0.95 && p.max >= 5).sort((a, b) => b.max - a.max);
  return { scored, weak, strong };
}
