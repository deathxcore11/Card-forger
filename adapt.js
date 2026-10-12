// "Closest proven deck": start from a real tournament list instead of loose staples.
//   · Original — the list exactly as it placed.
//   · Budget adaptation — keeps the engine; swaps pricey support cards for cheaper ones that
//     similar tournament lists play, same card type only, and says why for each swap. It is
//     an adaptation, not a tested list.
//   · Owned-card draft — only the copies you own, the open slots, and the cheapest way to finish.
// Works for any game: rows/pool use a `key` (card id or name), `kind` (card type) and `price`.

const need = (r) => Math.max(0, r.qty - (r.owned || 0));
const unknown = (r) => r.price === null || r.price === undefined;
// Known prices only; unpriced copies are counted separately and never treated as free.
export const costToFinish = (rows) => rows.reduce((a, r) => a + need(r) * (r.price ?? 0), 0);
export const unpricedCopies = (rows) => rows.reduce((a, r) => a + (unknown(r) ? need(r) : 0), 0);
// Cards per type, to show what an adaptation changes (lands, creatures, Trainers…).
export const kindCounts = (rows) => rows.reduce((m, r) => ((m[r.kind] = (m[r.kind] || 0) + r.qty), m), {});
const sum = (rows) => rows.reduce((a, r) => a + r.qty, 0);

// Lists that share most of their cards with this one (same deck, other pilots).
export function similarLists(list, others, min = 0.4) {
  const a = new Set(list.map((r) => r.key));
  return others.filter((o) => {
    if (o === list) return false;
    const b = new Set(o.map((r) => r.key));
    let n = 0;
    for (const k of a) if (b.has(k)) n++;
    return n / Math.max(1, Math.min(a.size, b.size)) >= min;
  });
}

/**
 * Engine = what makes the deck work: cards most similar lists also play, that aren't format-wide
 * generic staples. `generic(key)` says whether a card is played across unrelated decks.
 */
export function engineOf(rows, similar, generic = () => false) {
  const freq = new Map();
  for (const l of similar) for (const k of new Set(l.map((r) => r.key))) freq.set(k, (freq.get(k) || 0) + 1);
  return new Set(
    rows
      // Core cards (archetype members, the Pokémon line, the commander) are always kept.
      .filter((r) => r.core || (!generic(r.key) && (similar.length >= 2 ? (freq.get(r.key) || 0) / similar.length >= 0.6 : r.qty >= 3)))
      .map((r) => r.key),
  );
}

// Cards similar lists play that this one doesn't: substitutes, most-played first.
export function swapPool(rows, similar) {
  const mine = new Set(rows.map((r) => r.key)),
    pool = new Map();
  for (const l of similar)
    for (const r of l)
      if (!mine.has(r.key)) {
        const p = pool.get(r.key) || { ...r, lists: 0 };
        p.lists++;
        pool.set(r.key, p);
      }
  return [...pool.values()];
}

/**
 * rows: [{ key, name, qty, kind, price, owned, core? }]  pool: [{ key, name, kind, price, lists, owned? }]
 * Swaps the most expensive non-engine copies you still need until the cost to finish fits the budget.
 */
export function adaptList({ rows, pool = [], engine = new Set(), budget, similarCount = 0, minOpen = 3, keepKinds = ["land", "Energy"] }) {
  const groups = new Set(rows.map((r) => r.group).filter(Boolean)),
    out = rows.map((r) => ({ ...r })),
    swaps = [],
    used = new Set();
  // Only changes worth making: at least `minOpen` dollars of copies you still need.
  const candidates = out.filter((r) => !engine.has(r.key) && need(r) * (r.price ?? 0) >= minOpen).sort((a, b) => need(b) * b.price - need(a) * a.price);
  for (const r of candidates) {
    if (costToFinish(out) <= budget) break;
    const n = need(r);
    const sub = pool
        // Same card type, no archetype the deck doesn't already play, and at most half the cost
        // (copies you already own are free).
        .filter((p) => p.kind === r.kind && (!p.group || groups.has(p.group)) && !used.has(p.key) && p.price !== null && p.price !== undefined && Math.max(0, n - (p.owned || 0)) * p.price <= n * r.price * 0.5)
        .sort((a, b) => (b.owned || 0) - (a.owned || 0) || b.lists - a.lists || a.price - b.price)[0];
    // The mana base is never cut into open slots: a land only gives way to a cheaper land.
    if (!sub && keepKinds.includes(r.kind)) continue;
    r.qty -= n;
    if (sub) {
      used.add(sub.key);
      out.push({ key: sub.key, name: sub.name, qty: n, kind: sub.kind, price: sub.price, owned: sub.owned || 0, swappedIn: true });
      swaps.push({ out: r.name, in: sub.name, qty: n, saved: n * r.price - Math.max(0, n - (sub.owned || 0)) * sub.price, why: `played in ${sub.lists} of ${similarCount} similar list${similarCount === 1 ? "" : "s"}` });
    } else swaps.push({ out: r.name, in: null, qty: n, saved: n * r.price, why: "no cheaper card of the same type in similar lists — slot left open" });
  }
  const rowsOut = out.filter((r) => r.qty > 0),
    engineRows = rowsOut.filter((r) => engine.has(r.key) && need(r) > 0).sort((a, b) => need(b) * (b.price ?? 0) - need(a) * (a.price ?? 0));
  const open = Math.max(0, sum(rows) - sum(rowsOut)),
    unpriced = unpricedCopies(rowsOut);
  return {
    rows: rowsOut,
    swaps,
    cost: costToFinish(rowsOut),
    unpriced,
    open,
    // "Fits" only when every copy to buy has a price and no slot is left open.
    fits: !unpriced && !open && costToFinish(rowsOut) <= budget + 1e-6,
    underBudget: costToFinish(rowsOut) <= budget + 1e-6,
    kinds: { before: kindCounts(rows), after: kindCounts(rowsOut) },
    engineCost: costToFinish(engineRows),
    engineTop: engineRows.slice(0, 3),
  };
}

// Only the copies you own; what's missing, cheapest first, as the path to a full deck.
export function ownedDraft(rows) {
  const have = rows.filter((r) => r.owned > 0).map((r) => ({ ...r, qty: Math.min(r.qty, r.owned) })),
    missing = rows.filter((r) => need(r) > 0).map((r) => ({ ...r, qty: need(r) })).sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  return { rows: have, open: sum(rows) - sum(have), missing, cost: costToFinish(rows), unpriced: unpricedCopies(rows) };
}
