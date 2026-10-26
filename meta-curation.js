// Editorial selection is a separate overlay. Source decks, results, percentages,
// card counts, player records and tournament evidence are never overwritten by AI.
const DAY = 864e5;
const text = (v, max = 160) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
export function sourceDate(value) {
  if (typeof value === 'number' || typeof value === 'string' && /^\d{10}(?:\d{3})?$/.test(value)) {
    const n = Number(value) * (Number(value) < 1e12 ? 1000 : 1); return Number.isFinite(n) && n > 0 && n < 8640000000000000 ? new Date(n).toISOString() : '';
  }
  if (typeof value !== 'string') return '';
  const day = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!day || !Number.isFinite(Date.parse(day)) || new Date(Date.parse(day)).toISOString().slice(0,10) !== day) return '';
  if (value.length === 10) return day;
  const full = /^\d{4}-\d{2}-\d{2} \d\d:\d\d(?::\d\d)?$/.test(value) ? value.replace(' ', 'T') + 'Z' : value;
  return Number.isFinite(Date.parse(full)) ? new Date(Date.parse(full)).toISOString() : '';
}
function sourceUrl(value, game) {
  try {
    const u = new URL(value); if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash || /[\u0000-\u0020\\]|%2f|%5c|%2e/i.test(value)) return '';
    const ok = game === 'ygo' ? u.hostname === 'ygoprodeck.com' && /^\/deck\/[a-zA-Z0-9-]+\/?$/.test(u.pathname) : game === 'ptcg' ? u.hostname === 'play.limitlesstcg.com' && /^\/tournament\/[a-zA-Z0-9_-]+\/player\/[^/]+\/decklist$/.test(u.pathname) : ['www.mtgo.com','mtgo.com'].includes(u.hostname) ? /^\/decklist\/[a-z0-9-]+$/.test(u.pathname) : u.hostname === 'topdeck.gg' ? /^\/event\/[a-zA-Z0-9_-]+$/.test(u.pathname) : u.hostname === 'www.mtgtop8.com' && u.pathname === '/event';
    // An MTGTop8 event or deck link is only its numeric event, optional deck and the cEDH format.
    if (ok && u.hostname === 'www.mtgtop8.com') return /^\?e=\d{1,9}(?:&d=\d{1,9})?&f=cEDH$/.test(u.search) ? u.href : '';
    return ok && !u.search ? u.href : '';
  } catch { return ''; }
}
const rows = (deck, game) => game === 'ptcg' ? deck.list : deck.main;
function hasList(deck, game) { return Array.isArray(rows(deck, game)) && rows(deck, game).length > 0 && rows(deck, game).length <= 300; }
export function metaCurationCandidates(data, spec, now = Date.now()) {
  if (!data || data.game !== spec.game || data.format && data.format !== spec.format || !Array.isArray(data.decks)) return [];
  const seen = new Set(), candidates = [];
  for (const deck of data.decks.slice(0, 300)) {
    const id = text(deck?.key, 180), url = sourceUrl(deck?.url || deck?.eventUrl, spec.game), date = sourceDate(deck?.date), age = now - Date.parse(date), name = text(deck?.name), event = text(deck?.event);
    if (!id || seen.has(id) || !url || !name || !date || !Number.isFinite(age) || age < 0 || age > (spec.game === 'ygo' ? 90 : 30) * DAY || !hasList(deck, spec.game)) continue;
    if (deck.format && deck.format !== spec.format) continue;
    if (spec.game === 'ygo' && /\b(?:OCG|Rush Duel|Master Duel|Duel Links|Speed Duel)\b/i.test(`${deck.format || ''} ${deck.region || ''} ${event} ${name}`)) continue;
    seen.add(id);
    const signature = rows(deck, spec.game).slice(0, 80).filter(row => typeof row?.name === 'string' && Number(row.qty) > 0).sort((a,b) => Number(b.qty) - Number(a.qty)).slice(0, 6).map(row => `${Number(row.qty)} ${text(row.name,60)}`);
    candidates.push({ id, deck, evidence: { name, event, date, dateMeaning: spec.game === 'ygo' ? 'list submission, not event date' : 'event date', place: text(deck.place,40), players: Math.max(0, Number(deck.players) || 0), source: text(data.source,100), scope: spec.game === 'mtg' && spec.format === 'EDH' ? 'competitive Commander (cEDH), not casual Commander' : spec.game === 'ygo' ? 'publisher-curated tournament lists; TCG regional legality unverified' : spec.format, cards: signature } });
  }
  return candidates.sort((a,b) => Date.parse(b.evidence.date) - Date.parse(a.evidence.date) || (Number(a.deck.rank) || 999) - (Number(b.deck.rank) || 999) || b.evidence.players - a.evidence.players).slice(0, 12);
}
const explanation = (row, game, format) => game === 'ygo' ? `${row.evidence.place || 'Published'} list${row.evidence.event ? ` from ${row.evidence.event}` : ''}. The shown date is its submission date, not a verified event date.` : game === 'mtg' && format === 'EDH' ? 'A published competitive Commander list. This is cEDH evidence, not a casual Commander recommendation.' : `${row.evidence.place || 'Published'} ${format} list${row.evidence.event ? ` from ${row.evidence.event}` : ''}. Rankings and records come from the source.`;
export function applyMetaCuration(data, spec, result = null, now = Date.now(), suppliedCandidates = null) {
  const candidates = suppliedCandidates || metaCurationCandidates(data, spec, now), selected = [], seen = new Set();
  if (result) for (const choice of (Array.isArray(result.selections) ? result.selections : []).slice(0,8)) {
    if (!/^\d+$/.test(choice?.id || '')) continue;
    const row = candidates[Number(choice.id)]; if (!row || seen.has(row.id)) continue; seen.add(row.id); selected.push(row);
  }
  if (result && !selected.length) throw Error('No valid Meta selections');
  const ordered = result ? selected : candidates;
  // Keep a source-linked representative per distinct source name in the Home rail.
  const names = new Set(), diverse = ordered.filter(row => { const key = row.evidence.name.toLowerCase(); if (names.has(key)) return false; names.add(key); return true; }).slice(0,8);
  return { game: spec.game, format: spec.format, status: diverse.length ? 'ready' : 'unavailable', source: text(data?.source,160), fetchedAt: sourceDate(data?.fetchedAt) || new Date(now).toISOString(), checkedAt: new Date(now).toISOString(), selections: diverse.map(row => ({ id: row.id, sourceUrl: sourceUrl(row.deck.url || row.deck.eventUrl, spec.game), sourceDate: row.evidence.date, dateMeaning: row.evidence.dateMeaning, explanation: explanation(row,spec.game,spec.format), editorial: result ? 'ai-assisted' : 'source-ranked' })) };
}
export function applyMetaOverlay(data, overlay, now = Date.now()) {
  if (!data || !overlay || data.game !== overlay.game || data.format && data.format !== overlay.format || !Array.isArray(data.decks) || !Array.isArray(overlay.selections)) return data;
  const curatedAt = sourceDate(overlay.curatedAt);
  if (!curatedAt || Date.parse(curatedAt) > now + 60000 || now - Date.parse(curatedAt) > 14 * DAY) return data;
  const candidates = metaCurationCandidates(data, { game: data.game, format: overlay.format }, now), selected = [];
  for (const item of overlay.selections.slice(0,8)) {
    const row = candidates.find(row => row.id === item?.id && sourceUrl(row.deck.url || row.deck.eventUrl,data.game) === item.sourceUrl && row.evidence.date === sourceDate(item.sourceDate));
    if (!row || selected.some(x => x.id === row.id)) continue;
    selected.push({ id: row.id, explanation: explanation(row,data.game,overlay.format) });
  }
  const curation = { selections: selected, curatedAt, aiStatus: text(overlay.aiStatus,40), stale: !!overlay.stale };
  // The same ordered list feeds Home and the existing Meta-decks pages. Only
  // presentation order changes; every source deck object and statistic survives.
  return { ...data, decks: curatedMetaDecks({ ...data, curation }), curation };
}
export function curatedMetaDecks(data) {
  const decks = Array.isArray(data?.decks) ? data.decks : [], ids = (data?.curation?.selections || []).map(row => row.id);
  if (!ids.length) return decks;
  return [...ids.map(id => decks.find(deck => deck.key === id)).filter(Boolean), ...decks.filter(deck => !ids.includes(deck.key))];
}
