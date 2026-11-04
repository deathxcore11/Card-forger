// The title a player wears (Glory, Randall 4 Nov 2026): one of the titles their achievements gave, shown next to
// their name in a friend match and on the Achievements screen. Kept on this device; the server never needs it.
const KEY = 'cs-play-title';
export function savedTitle() { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } }
export function saveTitle(text) { try { text ? localStorage.setItem(KEY, text) : localStorage.removeItem(KEY); } catch { /* storage off: the title just is not remembered */ } }
// The saved title if the player has really earned it, else ''.
export const wornTitle = titles => { const t = savedTitle(); return titles.some(x => x.earned && x.text === t) ? t : ''; };
