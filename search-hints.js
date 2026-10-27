// The Home search placeholder starts as the plain prompt, then every few seconds fades to a
// real card name or a question worth asking. One timer for the whole page, no network: names
// come from the player's own cards plus a short list of well-known ones per game.
export const SEARCH_PROMPT = 'Find a card or ask a question…';
const FAMOUS = {
  mtg: ['Lightning Bolt', 'Sol Ring', 'Black Lotus', 'Counterspell', 'Llanowar Elves', 'Swords to Plowshares', 'The One Ring', 'Sheoldred, the Apocalypse', 'Atraxa, Grand Unifier', 'Rhystic Study', 'Dockside Extortionist', 'Ragavan, Nimble Pilferer', 'Cyclonic Rift', 'Thoughtseize', 'Craterhoof Behemoth'],
  ptcg: ['Charizard ex', 'Pikachu', 'Mewtwo', 'Gardevoir ex', 'Umbreon VMAX', 'Lugia V', 'Rayquaza VMAX', 'Iono', "Professor's Research", 'Miraidon ex', 'Gholdengo ex', 'Mew ex', 'Dragapult ex', 'Rare Candy', 'Eevee'],
  ygo: ['Blue-Eyes White Dragon', 'Dark Magician', 'Ash Blossom & Joyous Spring', 'Exodia the Forbidden One', 'Pot of Greed', 'Red-Eyes Black Dragon', 'Snake-Eye Ash', 'Accesscode Talker', 'Infinite Impermanence', 'Maxx "C"', 'Raigeki', 'Monster Reborn', 'Kashtira Fenrir', 'Baronne de Fleur', 'Called by the Grave'],
};
const QUESTIONS = {
  mtg: ['Best green Commander decks', 'What are the top Standard Meta decks?', 'Build a budget Elves deck', 'How does trample work?', 'Cards that pair with Sol Ring', 'Is my deck Modern legal?', 'Mono-red aggro under $50', 'What does ward do?'],
  ptcg: ['Top Standard Meta decks', 'How does retreat work?', 'Build a Charizard ex deck', 'Best Trainers for a fire deck', 'What is a Rule Box Pokémon?', 'Budget Pikachu deck ideas', 'How many Prize cards do I take?', 'Is this card Standard legal?'],
  ygo: ['Top Meta decks right now', 'How does a Synchro Summon work?', 'Build a Dark Magician deck', 'Best hand traps to run', 'What is the Forbidden list?', 'Budget Blue-Eyes deck ideas', 'How does chain resolution work?', 'Cards that support Spellcasters'],
};
const FIRST = 4000, EVERY = 4200, FADE = 260;
const shuffle = (list) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Alternate names and questions, mixing in up to a dozen of the player's own card names.
export function hintPool(game, owned = []) {
  const names = shuffle([...new Set([...shuffle(owned.filter((n) => typeof n === 'string' && n.length > 1 && n.length <= 40)).slice(0, 12), ...(FAMOUS[game] || FAMOUS.mtg)])]);
  const questions = shuffle(QUESTIONS[game] || QUESTIONS.mtg), out = [];
  for (let i = 0; i < Math.max(names.length, questions.length); i++) {
    if (names[i]) out.push(names[i]);
    if (questions[i]) out.push(questions[i]);
  }
  return out;
}

export function startSearchHints({ ownedNames = () => [], root = document } = {}) {
  const pools = new Map(), reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  let started = 0, timer = 0;
  const field = () => root.querySelector('input[data-home-search]');
  const idle = (f) => f && !f.value && root.activeElement !== f && f.getClientRects().length && !root.hidden;
  function next(f) {
    const game = f.dataset.homeSearch;
    let pool = pools.get(game);
    if (!pool?.length) { pool = hintPool(game, ownedNames(game)); pools.set(game, pool); }
    return pool.shift();
  }
  function swap(f, text) {
    if (reduced?.matches) { f.placeholder = text; return; }
    f.classList.add('hint-out');
    setTimeout(() => { if (idle(f)) f.placeholder = text; f.classList.remove('hint-out'); }, FADE);
  }
  function tick() {
    const f = field();
    if (!f) { started = 0; return; }
    if (!started) started = performance.now();
    if (!idle(f) || performance.now() - started < FIRST) return;
    swap(f, next(f) || SEARCH_PROMPT);
  }
  // Focusing the field always brings back the plain prompt, so the hint never reads as typed text.
  root.addEventListener('focusin', (e) => { if (e.target.matches?.('input[data-home-search]')) e.target.placeholder = SEARCH_PROMPT; });
  clearInterval(timer);
  timer = setInterval(tick, EVERY);
  timer?.unref?.(); // a Node test process may exit; no-op in browsers
  return { stop: () => clearInterval(timer) };
}
