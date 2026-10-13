// The card games CardStashy supports. Magic uses the original, fully featured
// screens; Yu-Gi-Oh! and Pokémon share one set of screens driven by an adapter
// (ygo.js, ptcg.js) that knows each game's data source, rules and formats.
export const GAMES = {
  mtg: { id: "mtg", name: "Magic: The Gathering", short: "Magic", source: "Scryfall", tagline: "Commander, Standard, Modern and every other format" },
  ygo: { id: "ygo", name: "Yu-Gi-Oh! TCG", short: "Yu-Gi-Oh!", source: "YGOPRODeck", tagline: "Advanced, Traditional, OCG, GOAT, Speed Duel and more" },
  ptcg: { id: "ptcg", name: "Pokémon TCG", short: "Pokémon", source: "TCGdex", tagline: "Standard, Expanded, Unlimited and Gym Leader Challenge" },
};
export const GAME_IDS = Object.keys(GAMES);
export const gameOf = (id) => GAMES[id] || GAMES.mtg;

// Small inline marks so each game is recognizable at a glance (no trademarked logos).
export const GAME_ICON = {
  mtg: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.6 6.4L21 9l-5 4.6L17.4 21 12 17.6 6.6 21 8 13.6 3 9l6.4-.6z" fill="currentColor"/></svg>`,
  ygo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3L22 20H2z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="14" r="2.6" fill="currentColor"/><path d="M7.5 14c1.4-2.2 7.6-2.2 9 0-1.4 2.2-7.6 2.2-9 0z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
  ptcg: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2.5 12h7m5 0h7" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
};

export const blankGame = () => ({ collection: [], decks: [], wishlist: [] });
