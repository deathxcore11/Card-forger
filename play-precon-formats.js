// Published 60-card products (Theme Decks, Starter Kits, Challenger Decks, …) for
// constructed Play (Standard, Pioneer, Modern, Legacy, Vintage, Pauper). A list is offered only in formats where MTGJSON reports
// every card legal and the published quantities satisfy that format's deck rules;
// the published list itself is never trimmed, padded or substituted.
export const CONSTRUCTED_PRECON_TYPES = Object.freeze(['Theme Deck', 'Starter Kit', 'Challenger Deck', 'Pioneer Challenger Deck', 'Planeswalker Deck', 'Game Night Deck', 'Arena Starter Kit', 'Event Deck', 'Duel Deck', 'Clash Pack', 'Intro Pack']);
const FORMATS = { Standard: 'standard', Pioneer: 'pioneer', Modern: 'modern', Legacy: 'legacy', Vintage: 'vintage', Pauper: 'pauper' };
// Standard rotates; older products are skipped instead of downloaded just to fail.
const STANDARD_WINDOW_DAYS = 3 * 366;
const unlimited = card => (card.supertypes || []).includes('Basic') || /any number of cards named/i.test(card.text || '');

export function constructedPreconCandidates(index, format, { checked = new Set(), now = Date.now(), limit = 10 } = {}) {
  if (!FORMATS[format]) return [];
  const earliest = format === 'Standard' ? new Date(now - STANDARD_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
    : format === 'Pioneer' ? '2012-10-05' : format === 'Modern' ? '2003-07-28' : '1993-08-05';
  return (index || [])
    .filter(d => CONSTRUCTED_PRECON_TYPES.includes(d?.type) && typeof d.fileName === 'string' && /^[A-Za-z0-9_.-]+$/.test(d.fileName)
      && !checked.has(d.fileName) && String(d.releaseDate || '') >= earliest)
    .sort((a, b) => String(b.releaseDate || '').localeCompare(String(a.releaseDate || '')) || a.fileName.localeCompare(b.fileName))
    .slice(0, limit);
}

// payload: one MTGJSON deck file. Returns null when the list is not playable in
// any of these formats as published.
export function constructedPrecon(payload, entry) {
  const d = payload?.data || payload;
  if (!d || !Array.isArray(d.mainBoard) || (d.commander || []).length) return null;
  const rows = zone => (d[zone] || []).filter(c => typeof c?.name === 'string' && Number.isSafeInteger(c.count) && c.count > 0);
  const main = rows('mainBoard'), side = rows('sideBoard');
  if (main.length !== d.mainBoard.length || side.length !== (d.sideBoard || []).length) return null;
  const mainCount = main.reduce((n, c) => n + c.count, 0), sideCount = side.reduce((n, c) => n + c.count, 0);
  if (mainCount < 60 || sideCount > 15) return null;
  const copies = new Map();
  for (const c of [...main, ...side]) copies.set(c.name, (copies.get(c.name) || 0) + c.count);
  const formats = Object.entries(FORMATS).filter(([, key]) => [...main, ...side].every(c => c.legalities?.[key] === 'Legal')
    && [...main, ...side].every(c => unlimited(c) || copies.get(c.name) <= 4)).map(([name]) => name);
  if (!formats.length) return null;
  const merge = list => { const out = new Map(); for (const c of list) out.set(c.name, (out.get(c.name) || 0) + c.count); return [...out].map(([name, qty]) => ({ name, qty })); };
  return { file: entry.fileName, name: d.name || entry.name, released: entry.releaseDate || '', product: entry.type, format: formats[0], formats, commander: '', cards: merge(main), side: merge(side) };
}

// The weekly precon store (Randall 5 Nov 2026): a few constructed precons of every format rotate in each
// Play week, and they are the only ones that can be bought whole with coins (everything in the shop is
// coins only). Every other precon is built by crafting its missing cards with seals. Deterministic from
// the week, so the server and every client agree. MTGJSON's list gives only type and release date, so a
// product lands in the format its era belongs to (Standard = the last three years, then Pioneer, Modern,
// and Legacy for the classics); the deck page still checks real legality when it opens.
export const STORE_FORMATS = Object.freeze(['Standard', 'Pioneer', 'Modern', 'Legacy']);
export const WEEKLY_PRECONS_PER_FORMAT = 4;
const weekHash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export function preconStoreFormat(entry, now = Date.now()) {
  const d = String(entry?.releaseDate || '');
  const std = new Date(now - STANDARD_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  return d >= std ? 'Standard' : d >= '2012-10-05' ? 'Pioneer' : d >= '2003-07-28' ? 'Modern' : 'Legacy';
}
// {Standard: [fileName, ...], Pioneer: [...], ...}: n precons of each format for the week.
export function weeklyPreconsByFormat(index, week = '', n = WEEKLY_PRECONS_PER_FORMAT, now = Date.now()) {
  const seen = new Set(), pools = Object.fromEntries(STORE_FORMATS.map(f => [f, []]));
  for (const d of index || []) {
    if (!CONSTRUCTED_PRECON_TYPES.includes(d?.type) || typeof d.fileName !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(d.fileName)) continue;
    const f = d.fileName.replace(/\.json$/, ''); if (seen.has(f)) continue; seen.add(f);
    pools[preconStoreFormat(d, now)].push(f);
  }
  const out = {};
  for (const fmt of STORE_FORMATS) {
    const pool = pools[fmt].sort(), picks = []; let h = weekHash('pc:' + fmt + ':' + week);
    for (let tries = 0; picks.length < Math.min(n, pool.length) && tries < n * 40; tries++) {
      const f = pool[h % pool.length]; h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0;
      if (!picks.includes(f)) picks.push(f);
    }
    out[fmt] = picks;
  }
  return out;
}
export const weeklyPrecons = (index, week = '', n = WEEKLY_PRECONS_PER_FORMAT, now = Date.now()) => Object.values(weeklyPreconsByFormat(index, week, n, now)).flat();
