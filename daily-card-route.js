import { dailyDate, nextDailyReset, DAILY_TIME_ZONE } from './daily-clock.js';

const GAMES = ['mtg', 'ygo', 'ptcg'];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const different = (card, previous) => card && card.id !== previous?.id && card.name !== previous?.name;
// The set a card's pack opens from: Scryfall's set code, a TCGdex id's set prefix, or (Yu-Gi-Oh!) its first
// release that is not a tin, deck, promo or tournament product (close to the booster Home opens; it only has to
// tell days' sets apart).
const ptcgSet = id => String(id || '').match(/^(.+)-[^-]+$/)?.[1] || '';
const NOT_A_PACK = /\btin\b|promo|structure deck|starter|deck|tournament|championship|prize|mega-pack|collector|box/i;
const ygoSet = sets => (sets || []).find(s => !NOT_A_PACK.test(s.set_name || ''))?.set_name || sets?.[0]?.set_name || '';
const setOf = card => card?.set || (card?.game === 'ptcg' ? ptcgSet(card.id) : '');
// The last few days' sets: today's pack opens a set none of them did, while the pool has one.
const RECENT_SETS = 3;
// A day's position in the pool, scattered so that neighbouring days do not pick neighbouring (same-set) cards.
const dayHash = date => { let h = 2166136261; for (const ch of String(date)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const valid = card => card && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(card.id) && typeof card.name === 'string' && card.name.trim() && typeof card.art === 'string' && card.art;

export async function dailyCardRoute(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/daily-card') return null;
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const game = url.searchParams.get('game');
  if (!GAMES.includes(game)) return json({ error: 'Choose a supported game' }, 400);
  if (!env.DAILY_CARDS) return json({ error: 'Daily cards are unavailable' }, 503);
  // A single server-owned selection; callers cannot supply a date or reroll it.
  return env.DAILY_CARDS.get(env.DAILY_CARDS.idFromName('shared-daily-cards-v1')).fetch(`https://daily-card.internal/?game=${game}`);
}

export class DailyCards {
  constructor(state) { this.storage = state.storage; this.pending = new Map(); }
  async fetch(request) {
    const game = new URL(request.url).searchParams.get('game');
    if (request.method !== 'GET' || !GAMES.includes(game)) return json({ error: 'Invalid daily card request' }, 400);
    try {
      const card = await this.current(game);
      await this.schedule();
      return json({ game, date: card.date, timeZone: DAILY_TIME_ZONE, nextResetAt: new Date(nextDailyReset()).toISOString(), card });
    } catch {
      await this.schedule(Date.now() + 5 * 60_000);
      return json({ error: 'Today’s card is temporarily unavailable', date: dailyDate(), timeZone: DAILY_TIME_ZONE }, 503);
    }
  }
  async schedule(retryAt = Infinity) {
    const target = Math.min(nextDailyReset(), retryAt), alarm = await this.storage.getAlarm();
    if (!alarm || alarm <= Date.now() || alarm > target) await this.storage.setAlarm(target);
  }
  async alarm() {
    // Warm all three games at midnight, even when nobody has the app open.
    const results = await Promise.allSettled(GAMES.map(game => this.current(game)));
    await this.schedule(results.some(r => r.status === 'rejected') ? Date.now() + 5 * 60_000 : Infinity);
  }
  async current(game) {
    const date = dailyDate(), key = `${game}:${date}`;
    if (this.pending.has(key)) return this.pending.get(key);
    const work = this.select(game, date).finally(() => this.pending.delete(key));
    this.pending.set(key, work);
    return work;
  }
  async select(game, date) {
    const previous = await this.storage.get(`card:${game}`);
    if (previous?.date === date) return previous;
    const failed = await this.storage.get(`retry:${game}`);
    if (failed > Date.now()) throw Error('Daily source cooling down');
    try {
      const recent = (await this.storage.get(`sets:${game}`)) || (setOf(previous) ? [setOf(previous)] : []);
      const selected = await this.pick(game, previous, recent, date);
      // A provider request spanning midnight cannot persist yesterday's card.
      if (dailyDate() !== date) return this.current(game);
      const card = { ...selected, game, date };
      await this.storage.put(`card:${game}`, card);
      if (card.set) await this.storage.put(`sets:${game}`, [card.set, ...recent.filter(x => x !== card.set)].slice(0, RECENT_SETS));
      await this.storage.delete(`retry:${game}`);
      return card;
    } catch (error) {
      await this.storage.put(`retry:${game}`, Date.now() + 5 * 60_000);
      throw error;
    }
  }
  async source(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'CardStashy daily card (cached once per day)' }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw Error('Daily source unavailable');
    return response.json();
  }
  async pick(game, previous, recent = [], date = dailyDate()) {
    if (game === 'mtg') {
      let fallback = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const c = await this.source('https://api.scryfall.com/cards/random?' + new URLSearchParams({ q: 'game:paper is:hires (rarity:mythic or rarity:rare) -is:digital' }));
        const card = { id: c.id, name: c.name, art: c.image_uris?.art_crop || c.card_faces?.[0]?.image_uris?.art_crop || '', ...(c.set ? { set: c.set } : {}) };
        if (!valid(card) || !different(card, previous)) continue;
        if (!recent.includes(card.set)) return card;
        fallback ||= card;
      }
      if (fallback) return fallback;
      throw Error('No different daily card available');
    }
    let pool = await this.storage.get(`pool:${game}`);
    if (!pool || pool.v !== 2 || Date.now() - pool.at > 7 * 86400_000) {
      const body = await this.source(game === 'ygo' ? 'https://db.ygoprodeck.com/api/v7/cardinfo.php?staple=yes&misc=yes' : 'https://api.tcgdex.net/v2/en/cards?rarity=eq:Special%20illustration%20rare');
      const rows = game === 'ygo' ? body.data : body;
      if (!Array.isArray(rows)) throw Error('No daily cards available');
      const cards = rows.map(c => game === 'ygo'
        ? { id: String(c.id), name: c.name, art: `img/ygo/a/${c.id}.jpg`, artDirect: `https://images.ygoprodeck.com/images/cards_cropped/${c.id}.jpg`, set: ygoSet(c.card_sets) }
        : { id: c.id, name: c.name, art: c.image ? `${c.image}/high.webp` : '', set: ptcgSet(c.id) }).filter(valid);
      if (cards.length < 2) throw Error('Daily pool needs at least two cards');
      pool = { v: 2, at: Date.now(), cards };
      // Keep comfortably below the per-value storage limit if a source grows.
      if (new TextEncoder().encode(JSON.stringify(pool)).length < 120_000) await this.storage.put(`pool:${game}`, pool);
    }
    const fresh = pool.cards.filter(c => different(c, previous));
    if (!fresh.length) throw Error('No different daily card available');
    // A set none of the last few days opened; failing that, at least not yesterday's; failing that, any.
    const candidates = [fresh.filter(c => !recent.includes(c.set)), fresh.filter(c => c.set !== recent[0]), fresh].find(list => list.length);
    return candidates[dayHash(date) % candidates.length];
  }
}
