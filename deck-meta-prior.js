// A quality prior for 60-card formats from current tournament lists (meta.js,
// api/meta/mtg: Magic Online's published decklists). Scryfall has no measure of
// how good a card is outside Commander, so without this the builder's pool was
// "the cheapest cards first". A card's weight is how many of the loaded lists
// play it. It is evidence that strong players register the card today, not a
// promise about any deck built here.
import { cardKey } from './core.js';

// Formats with their own list feed. Commander keeps its EDHREC rank; Brawl has no feed.
export const META_PRIOR_FORMATS = Object.freeze(['Standard', 'Pioneer', 'Modern', 'Legacy', 'Vintage', 'Pauper']);

// decks: [{main: [{qty, name, land}], side: [...]}]. Returns {size, weight(name) 0..1, copies(name), top(n), lands(n)}.
export function metaPrior(decks) {
 const lists = (Array.isArray(decks) ? decks : []).filter(d => Array.isArray(d?.main) && d.main.length), seen = new Map(), sides = new Map();
 for (const d of lists) {
  const mine = new Map();
  for (const r of d.main) { const name = String(r?.name || '').trim(), qty = Math.max(0, Number(r?.qty) || 0); if (!name || !qty) continue; const k = cardKey(name), old = mine.get(k); mine.set(k, { name, qty: (old?.qty || 0) + qty, land: !!r.land }); }
  // Sideboards, counted the same way: how many lists sideboard a card, and how many copies.
  const mySide = new Map();
  for (const r of Array.isArray(d.side) ? d.side : []) { const name = String(r?.name || '').trim(), qty = Math.max(0, Number(r?.qty) || 0); if (!name || !qty) continue; const k = cardKey(name), old = mySide.get(k); mySide.set(k, { name, qty: (old?.qty || 0) + qty }); }
  for (const [k, r] of mySide) { const e = sides.get(k) || { name: r.name, lists: 0, copies: 0 }; e.lists++; e.copies += r.qty; sides.set(k, e); }
  for (const [k, r] of mine) { const e = seen.get(k) || { name: r.name, lists: 0, copies: 0, land: r.land }; e.lists++; e.copies += r.qty; seen.set(k, e); }
 }
 const n = lists.length, entry = name => seen.get(cardKey(String(name || '').split(' // ')[0])) || seen.get(cardKey(name));
 // One list in a hundred is a little evidence; one list in seven or more is a format staple.
 const weight = name => { const e = entry(name); return e && n ? Math.min(1, Math.sqrt(e.lists / n / 0.15)) : 0; };
 const ranked = land => [...seen.values()].filter(e => e.land === land).sort((a, b) => b.lists - a.lists || b.copies - a.copies || a.name.localeCompare(b.name));
 const sideEntry = name => sides.get(cardKey(String(name || '').split(' // ')[0])) || sides.get(cardKey(name));
 return { sideTop: (count = 60) => [...sides.values()].sort((a, b) => b.lists - a.lists || b.copies - a.copies || a.name.localeCompare(b.name)).slice(0, count).map(e => e.name), sideCopies: name => { const e = sideEntry(name); return e ? e.copies / e.lists : 0; }, sideLists: name => sideEntry(name)?.lists || 0, size: n, weight, copies: name => { const e = entry(name); return e ? e.copies / e.lists : 0; }, top: (count = 150) => ranked(false).slice(0, count).map(e => e.name), lands: (count = 60) => ranked(true).slice(0, count).map(e => e.name) };
}
