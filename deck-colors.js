// A deck's colours from its cards, the same way on the server (worker.js, once a day, into the tournament feed) and in the app
// (ai-tools.js, for your own decks and for a feed that came without colours).
// rows: [{name, qty}]; cardOf(name) -> {type_line, colors, card_faces} | null. Lands are left out.
// A colour counts when at least 4 copies carry it and it is at least 8% of the coloured copies, so one off-colour card does not
// turn a mono-red deck into a two-colour deck. null when fewer than three quarters of the copies are known.
export function deckColorsOf(rows, cardOf) {
  const w = { W: 0, U: 0, B: 0, R: 0, G: 0 }; let known = 0, total = 0;
  for (const r of rows || []) {
    const c = cardOf(r.name), q = Math.max(1, Number(r.qty) || 1);
    if (c && /\bLand\b/.test(String(c.type_line || '').split('//')[0])) continue;
    total += q; if (!c) continue; known += q;
    for (const k of (c.colors?.length ? c.colors : c.card_faces?.[0]?.colors) || []) if (k in w) w[k] += q;
  }
  if (!total || known / total < .75) return null;
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  return [...'WUBRG'].filter(k => w[k] >= 4 && w[k] >= sum * .08).join('').toLowerCase();
}
