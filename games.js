import { GAME_MARK, GAME_COLOR } from "./icons.js";
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

// Game marks and signature colors live in icons.js (one icon family for the whole app).
export const GAME_ICON = GAME_MARK;
export { GAME_COLOR };

export const blankGame = () => ({ collection: [], decks: [], wishlist: [] });
