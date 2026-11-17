// A 15-card sideboard for a built 60-card deck, from what current tournament lists put in theirs (deck-meta-prior.js:
// the same Magic Online lists that weigh main-deck picks). All 131 Standard lists read on 16 Nov 2026 register 15
// sideboard cards, and a sweeper such as Fire Magic sits in the sideboard of 25 of them against the main deck of 11.
// Evidence that players sideboard a card in this format today; not a plan for any one matchup. No feed, no sideboard.
import { cardKey, isLand } from './core.js';
import { castableIn } from './builder.js';
import { idleFixer } from './deck-needs.js';

// rows: the main deck [{name, qty}]. Returns [{name, qty, why}] with at most `size` cards, or [] when nothing is known.
export function buildSideboard({ rows = [], catalog = {}, colors = [], prior = null, size = 15, copyLimit = () => 4, isLegal = () => true, cost = () => 0, budget = Infinity } = {}) {
 if (!prior?.size || typeof prior.sideTop !== 'function' || size <= 0) return [];
 const main = new Map(rows.map(r => [cardKey(r.name), r.qty])), out = [];
 let left = size, spent = 0;
 for (const name of prior.sideTop(80)) {
  if (left <= 0) break;
  const c = catalog[cardKey(name)] || catalog[cardKey(String(name).split(' // ')[0])];
  // A card that counts colours of mana (Engineered Explosives) does nothing in a one-colour deck, whatever other decks sideboard.
  if (!c || isLand(c) || !isLegal(c) || !castableIn(c, colors) || idleFixer(c, colors)) continue;
  // Real lists carry one to three copies of a sideboard card; the copy limit counts the main deck too.
  const want = Math.max(1, Math.min(4, Math.round(prior.sideCopies(name)))), n = Math.min(want, left, Math.max(0, copyLimit(c) - (main.get(cardKey(c.name)) || 0)));
  if (n <= 0) continue;
  const price = cost(c, n);
  if (!(spent + price <= budget + 1e-6)) continue;
  spent += price; left -= n; out.push({ name: c.name, qty: n, why: 'Sideboard card in current lists' });
 }
 // Slots still open: the cards already chosen take another copy, most-sideboarded first, never past three of one sideboard card.
 for (let grew = true; left > 0 && grew;) { grew = false;
  for (const r of out) { if (left <= 0) break; const c = catalog[cardKey(r.name)];
   if (r.qty >= 3 || r.qty + (main.get(cardKey(c.name)) || 0) >= copyLimit(c)) continue;
   const extra = cost(c, r.qty + 1) - cost(c, r.qty);
   if (!(spent + extra <= budget + 1e-6)) continue;
   spent += extra; r.qty++; left--; grew = true; } }
 return out;
}
