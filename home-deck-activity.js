// Bounded, workspace-owned evidence for Home's last-worked deck. Opening a deck,
// a cache refresh, and adding a brand-new deck are not edits to an existing deck.
const GAMES = ['mtg', 'ygo', 'ptcg'];
const LIMIT = 12;
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(value);
const decksFor = (state, game) => (game === 'mtg' ? state : state?.tcg?.[game])?.decks || [];
const text = value => typeof value === 'string' ? value : '';
const rows = (list, game) => (Array.isArray(list) ? list : []).map(row =>
  game === 'mtg' ? [text(row?.name), Number(row?.qty) || 0] : [text(row?.cardId), text(row?.name), Number(row?.qty) || 0]
).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const content = (deck, game) => game === 'mtg' ? [rows(deck?.cards, game), rows(deck?.side, game)]
  : ['main', 'extra', 'side'].map(zone => rows(deck?.zones?.[zone], game));
export function homeDeckFingerprint(deck, game) {
  if (!deck || !GAMES.includes(game)) return '';
  return JSON.stringify([
    ...['name', 'format', 'commander', 'strategy', 'about'].map(key => text(deck[key])),
    Number.isFinite(deck.budget) ? deck.budget : null, !!deck.locked, content(deck, game),
    (Array.isArray(deck.starters) ? deck.starters : []).filter(x => typeof x === 'string').slice().sort(),
    (Array.isArray(deck.versions) ? deck.versions : []).map(version => [text(version?.id), text(version?.label), text(version?.commander), content(version, game)]),
  ]);
}
function validHistory(state, game, now) {
  const history = state?.homeDeckActivity?.[game], decks = decksFor(state, game), seen = new Set();
  return (Array.isArray(history) ? history : []).slice(0, LIMIT * 2).filter(row => {
    if (!safeId(row?.id) || !decks.some(deck => deck.id === row.id) || typeof row.at !== 'string') return false;
    const at = Date.parse(row.at);
    return Number.isFinite(at) && at > 0 && at <= now && new Date(at).toISOString() === row.at;
  }).sort((a, b) => b.at.localeCompare(a.at)).filter(row => !seen.has(row.id) && seen.add(row.id))
    .slice(0, LIMIT).map(({ id, at }) => ({ id, at }));
}
export function normalizeHomeDeckActivity(state, now = Date.now()) {
  const history = Object.fromEntries(GAMES.map(game => [game, validHistory(state, game, now)]).filter(([, rows]) => rows.length));
  if (Object.keys(history).length) state.homeDeckActivity = history;
  else delete state.homeDeckActivity;
  return state;
}
export function recordHomeDeckWork(previous, next, now = Date.now()) {
  normalizeHomeDeckActivity(next, now);
  for (const game of GAMES) {
    const before = new Map(decksFor(previous, game).map(deck => [deck.id, deck]));
    const changed = decksFor(next, game).filter(deck => safeId(deck.id) && before.has(deck.id) && homeDeckFingerprint(before.get(deck.id), game) !== homeDeckFingerprint(deck, game));
    if (!changed.length) continue;
    const ids = new Set(changed.map(deck => deck.id));
    (next.homeDeckActivity ||= {})[game] = [...changed.map(deck => ({ id: deck.id, at: new Date(now).toISOString() })), ...validHistory(next, game, now).filter(row => !ids.has(row.id))].slice(0, LIMIT);
  }
  return next;
}
export function lastWorkedDeck(state, game, now = Date.now()) {
  if (!GAMES.includes(game)) return null;
  const entry = validHistory(state, game, now)[0];
  return entry ? { deck: decksFor(state, game).find(deck => deck.id === entry.id), at: entry.at } : null;
}
