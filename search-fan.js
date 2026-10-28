import { esc } from "./ui.js";

// The empty search page shows a fan of five cards from your own collection, a new five each
// day, instead of a black void. Tapping one opens it. Shared by all three games: each passes
// its owned cards as { id, name, art } (art is ready <img> markup) and the open action.
export function searchFanMarkup(pool, act, idOf = (p) => p.name) {
  if (pool.length < 3) return "";
  const day = Math.floor(Date.now() / 864e5), picks = [];
  for (let i = 0; i < Math.min(5, pool.length); i++) picks.push(pool[(day * 7 + i * 13) % pool.length]);
  const unique = [...new Map(picks.map((p) => [p.name, p])).values()], mid = (unique.length - 1) / 2;
  return `<section class="search-fan" aria-label="Cards from your collection"><div class="search-fan-cards">${unique.map((p, i) => `<button class="search-fan-card" style="--i:${(i - mid).toFixed(1)}" data-act="${act}" ${act === "card" ? `data-name="${esc(p.name)}"` : `data-id="${esc(idOf(p))}"`} aria-label="Open ${esc(p.name)}">${p.art}</button>`).join("")}</div><h2>From your collection today</h2><p class="muted">Tap one to read it, or start typing above.</p></section>`;
}
