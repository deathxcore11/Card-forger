// Real application-shell regression. Run in the authorized CI browser job:
//   node tests/home-browser.mjs
// Validate fixture schemas without starting a browser:
//   node tests/home-browser.mjs --validate-fixtures
// All provider traffic is fulfilled locally. Artwork is representative SVG, never
// a private screenshot or a claim to reproduce a publisher's card illustration.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blank } from '../store.js';
import { cardKey } from '../core.js';
import { collectionValue } from '../insights.js';
import { validateWorkspace } from '../confidence.js';
import { normalizeYgo } from '../ygo.js';
import { normalizePtcg, ptcgPrintingMatches, ptcgSource } from '../ptcg.js';
import { GAME_IDS } from '../games.js';
import { SUPABASE } from '../config.js';
import { validateHistory } from '../shared-history.js';
import { communityDeckArtwork, safeCommunityImage } from '../community-art.js';
import { DEFAULT_MTG_META_FORMAT } from '../meta.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RESULTS = resolve(ROOT, 'test-results');
const NOW = Date.parse('2026-10-17T12:00:00.000Z');
const TODAY = '2026-10-17';
const ISO = new Date(NOW).toISOString();
const WIDTHS = [320, 360, 390, 430, 600, 700, 768, 899, 900, 1024, 1200, 1440, 2560];
const EVIDENCE_WIDTHS = new Set([320, 390, 768, 1024, 1440, 2560]);
const viewportHeight = width => width <= 430 ? 844 : width < 900 ? 1024 : width <= 1200 ? 768 : width <= 1440 ? 900 : 1440;
const ORIENTATIONS = [{ width:844, height:390, label:'phone-landscape' }, { width:768, height:1024, label:'tablet-portrait' }, { width:1024, height:768, label:'tablet-landscape' }];
const FOLD_SEQUENCE = [{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:844,height:390},{width:390,height:844}];
const IMAGE = 'https://home-fixtures.invalid';
const metaFixtureKey = game => game === 'mtg' ? `mtg:${DEFAULT_MTG_META_FORMAT}` : game;
const NEWS_IMAGES = {
  mtg: 'https://images.ctfassets.net/s5n2t79q9icq/homeRegression/0123456789abcdef0123456789abcdef/official-magic-news.jpg',
  ygo: 'https://www.yugioh-card.com/en/wp-content/uploads/home-regression-news.jpg',
  ptcg: 'https://primary.jwwb.nl/public/h/t/i/temp-zjpebgcobmaxydcmrfwb/home-regression-news.jpg',
};
const UNSAFE_IMAGE = 'https://not-a-publisher.invalid/tracking.jpg';
const MARKET_HISTORY = new URL('/functions/v1/market-history', SUPABASE.url);
const historyFixture = url => ({ game: url.searchParams.get('game'), cardId: url.searchParams.get('id'), finish: url.searchParams.get('finish'), series: [], notice: 'No historical quotes in this deterministic Home fixture.' });
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="630" height="880" viewBox="0 0 630 880"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#244567"/><stop offset=".5" stop-color="#ab7945"/><stop offset="1" stop-color="#382d59"/></linearGradient></defs><rect width="630" height="880" rx="30" fill="url(#a)"/><circle cx="405" cy="255" r="150" fill="#e9c479" opacity=".7"/><path d="M0 620 170 320 330 560 510 340 630 650V880H0Z" fill="#152739"/><text x="38" y="92" fill="#fff" font-family="sans-serif" font-size="28">Representative fixture art</text></svg>`;
const sources = {
  mtg: { sourceId: 'wizards', host: 'https://magic.wizards.com', news: '/en/news/announcements/fixture-story', event: '/en/events/fixture-event', deck: 'https://www.mtgo.com/decklist/fixture-modern', label: 'Magic Online' },
  ygo: { sourceId: 'konami', host: 'https://www.yugioh-card.com', news: '/en/news/fixture-story', event: '/en/events-item/fixture-event/', deck: 'https://ygoprodeck.com/deck/fixture-blue-eyes', label: 'YGOPRODeck Tournament Meta Decks' },
  ptcg: { sourceId: 'pokeguardian', host: 'https://www.pokeguardian.com', news: '/3412574_fixture-story', event: '/us/play-pokemon/fixture-event', deck: 'https://play.limitlesstcg.com/tournament/fixture/player/1/decklist', label: 'Limitless' },
};

function magic(name, id, extra = {}) {
  return { id, oracle_id: `oracle-${id}`, name, lang: 'en', type_line: 'Creature — Elf Druid', oracle_text: '{T}: Add {G}.',
    cmc: 1, mana_cost: '{G}', colors: ['G'], color_identity: ['G'], keywords: [], power: '1', toughness: '1',
    legalities: { standard: 'legal', modern: 'legal', commander: 'legal' }, prices: { usd: '12.50', usd_foil: null },
    set: 'fdn', set_name: 'Foundations', collector_number: '1', rarity: 'common', finishes: ['nonfoil'],
    image_uris: { normal: `https://cards.scryfall.io/normal/front/${id[0]}/${id[1]}/${id}.jpg`, small: `https://cards.scryfall.io/small/front/${id[0]}/${id[1]}/${id}.jpg`, art_crop: `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg` },
    checkedAt: ISO, full: true, released_at: '2024-11-15', ...extra };
}
const mtgHero = magic('Shivan Dragon', '11111111-1111-4111-8111-111111111111', { type_line: 'Creature — Dragon', cmc: 6, mana_cost: '{4}{R}{R}', colors: ['R'], color_identity: ['R'], oracle_text: 'Flying', power: '5', toughness: '5' });
const mtgSeed = magic('Llanowar Elves', '22222222-2222-4222-8222-222222222222');
const rawYgo = (name, id, archetype = 'Blue-Eyes') => ({ name, id, type: 'Normal Monster', frameType: 'normal', race: 'Dragon', attribute: 'LIGHT', level: 8, atk: 3000, def: 2500, archetype,
  desc: 'A representative provider fixture for this named card.', card_images: [{ id }], card_sets: [],
  card_prices: [{ tcgplayer_price: '12.50' }], misc_info: [{ formats: ['TCG', 'OCG'], tcg_date: '2002-03-08' }] });
const ygoHeroRaw = rawYgo('Dark Magician', 46986414, 'Dark Magician');
const ygoSeedRaws = [rawYgo('Blue-Eyes White Dragon', 89631139), rawYgo('Blue-Eyes Alternative White Dragon', 38517737), rawYgo('Blue-Eyes Jet Dragon', 30576089)];
const rawPtcg = (name, id, type) => ({ name, id, localId: id.split('-').at(-1), category: 'Pokemon', stage: 'Basic', hp: 100, types: [type],
  image: `https://assets.tcgdex.net/en/sv/${id.split('-')[0]}/${id.split('-').at(-1)}`, rarity: 'Common', set: { id: id.split('-')[0], name: 'Fixture set', cardCount: { official: 200 }, releaseDate: '2024-11-08' },
  legal: { standard: true, expanded: true }, regulationMark: 'H', retreat: 1,
  attacks: [{ name: 'Fixture attack', cost: [type], damage: 30, effect: '' }],
  variants: { normal: true }, pricing: { tcgplayer: { normal: { marketPrice: 12.5 }, updated: TODAY } } });
const ptcgHeroRaw = rawPtcg('Charizard ex', 'sv03-125', 'Fire');
const ptcgSeedRaw = rawPtcg('Pikachu', 'sv08-057', 'Lightning');
const ptcgCards = [ptcgSeedRaw, ptcgHeroRaw];
const ptcgSets = {
  sv08: { ...ptcgSeedRaw.set, abbreviation: { official: 'SSP' } },
  sv03: { ...ptcgHeroRaw.set, abbreviation: { official: 'OBF' } },
};
// The inspector and builder both verify the printed set code against TCGdex's
// exact set record. An empty set response cannot prove SSP means sv08.
function ptcgFixture(url) {
  if (url.pathname === '/v2/en/cards') {
    const name = url.searchParams.get('name')?.replace(/^eq:/, ''), number = url.searchParams.get('localId');
    if (name || number) return ptcgCards.filter(c => (!name || c.name === name) && (!number || Number(c.localId) === Number(number)));
    return [ptcgSeedRaw];
  }
  if (url.pathname.startsWith('/v2/en/cards/')) return ptcgCards.find(c => url.pathname === `/v2/en/cards/${c.id}`) || null;
  if (url.pathname.startsWith('/v2/en/sets/')) return ptcgSets[url.pathname.slice('/v2/en/sets/'.length)] || null;
  if (url.pathname.startsWith('/v2/en/series') || url.pathname === '/v2/en/sets') return [];
}
const normalize = raw => raw.category ? normalizePtcg(raw) : normalizeYgo(raw);
const fresh = raw => ({ ...normalize(raw), fetchedAt: ISO, printPriceSchema: 1 });
const heroes = { mtg: mtgHero, ygo: fresh(ygoHeroRaw), ptcg: fresh(ptcgHeroRaw) };
const seeds = { mtg: mtgSeed, ygo: fresh(ygoSeedRaws[0]), ptcg: fresh(ptcgSeedRaw) };
// Real longer titles in deterministic, cached daily-card fixtures. As with the
// short fixtures, artwork/provider metadata is representative, not a live quote.
const longDailyPicks = {
  mtg: magic('Emrakul, the Promised End', '33333333-3333-4333-8333-333333333333'),
  ygo: fresh(ygoSeedRaws[1]),
  ptcg: fresh({ ...rawPtcg('Reshiram & Charizard-GX', 'sm10-20', 'Fire'), image:'https://assets.tcgdex.net/en/sm/sm10/20' }),
};
const oversizeDailyPick = magic('Asmoranomardicadaistinaculdacar', '44444444-4444-4444-8444-444444444444');
const catalog = Object.fromEntries([mtgHero, mtgSeed, ...['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'].map((name, i) => magic(name, `fixture-basic-${i}`, { type_line: `Basic Land — ${name}`, prices: { usd: '0' }, cmc: 0, mana_cost: '', oracle_text: '', color_identity: [], colors: [] }))].map(c => [cardKey(c.name), c]));

function feed(game, empty = false, options = {}) {
  const s = sources[game];
  const image = options.newsArtMode === 'missing' ? '' : options.newsArtMode === 'unsafe' ? options.unsafeImage || UNSAFE_IMAGE : NEWS_IMAGES[game];
  const common = { game, sourceId: s.sourceId, fetchedAt: ISO, source: `${game.toUpperCase()} fixture publisher`, sourceUrl: s.host };
  return { game, fetchedAt: ISO, checkedAt: ISO, nextCheckAt: '2026-10-18T12:00:00.000Z', status: empty ? 'unavailable' : 'ready',
    items: empty ? [] : [
      { ...common, kind: 'news', title: `${game.toUpperCase()} dated fixture story`, summary: 'A dated story from a verified fixture source, distinct from a directory link.', url: s.host + s.news, publishedAt: '2026-10-16', image },
      { ...common, sourceId: game === 'ygo' ? 'konami-events' : '', kind: 'event', title: `${game.toUpperCase()} upcoming fixture event`, summary: 'A future event with its own start and end dates.', url: s.host + s.event, startsAt: '2026-10-20', endsAt: '2026-10-22' },
      ...[1,2,3].map(i=>({...common, kind:'news', title:`${game.toUpperCase()} additional publisher headline ${i}: exact cards, release details and regional availability`, url:s.host+s.news+`-${i}`, publishedAt:'2026-10-16'})),
      { ...common, kind: 'news', title: 'UNSAFE FIXTURE MUST NOT RENDER', url: 'javascript:alert(1)', publishedAt: '2026-10-16' },
      { ...common, kind: 'news', title: 'UNTRUSTED FIXTURE MUST NOT RENDER', url: 'https://untrusted.invalid/news', publishedAt: '2026-10-16' },
    ] };
}
function metaFeed(game, empty = false, options = {}) {
  const c = seeds[game];
  const missing = options.deckArtMode === 'missing';
  const unsafe = options.deckArtMode === 'unsafe';
  return { game, ...(game === 'ptcg' ? { artSchema: 2 } : {}), source: sources[game].label, fetchedAt: ISO, top: [], archetypes: [], events: [],
    decks: empty ? [] : [{ key: `fixture-${game}`, name: `${c.name} published fixture deck`, event: 'Fixture tournament', players: 32, place: 'Top 8', date: '2026-10-15', url: sources[game].deck,
      ...(game === 'mtg' ? { main: missing ? [] : [{ name: c.name, qty: 4 }], commanders: [], side: [], cover: unsafe ? 'javascript:invalid-cover' : c.name, art: unsafe ? UNSAFE_IMAGE : undefined } : game === 'ygo' ? { main: missing ? [] : [c.id], extra: [], side: [], cover: unsafe ? UNSAFE_IMAGE : c.id } : { list: missing ? [] : [{ name: c.name, qty: 4, set: unsafe ? '../BAD' : 'SSP', number: '57', kind: 'Pokemon' }] }) },
      ...(options.twoDecks ? [{ key: `fixture-${game}-second`, name: `${heroes[game].name} alternate fixture deck`, event: 'Second fixture tournament', players: 32, place: 'Winner', date: '2026-10-14', url: `${sources[game].deck}-second`,
        ...(game === 'mtg' ? { main: [{ name: heroes.mtg.name, qty: 4 }], commanders: [], side: [], cover: heroes.mtg.name } : game === 'ygo' ? { main: [heroes.ygo.id], extra: [], side: [], cover: heroes.ygo.id } : { list: [{ name: heroes.ptcg.name, qty: 4, set: 'OBF', number: '125', kind: 'Pokemon' }] }) }] : [])] };
}
function fixtures(options = {}) {
  const { game = 'mtg', unpriced = false, decks = true, emptyFeed = false, fetchFeed = false, heroDate = TODAY } = options;
  const state = blank();
  state.settings.game = game;
  state.tcg = { ygo: { collection: [], decks: [], wishlist: [] }, ptcg: { collection: [], decks: [], wishlist: [] } };
  for (const g of GAME_IDS) {
    const c = heroes[g], saved = seeds[g], st = g === 'mtg' ? state : state.tcg[g];
    st.collection = [
      { id: `owned-${g}-nm`, cardId: c.id, name: c.name, key: g === 'ygo' ? `name:${c.name}` : `id:${c.id}`, qty: 2, condition: unpriced ? 'Damaged' : 'Near Mint', finish: 'nonfoil', variant: g === 'ptcg' ? 'normal' : '', language: 'en' },
      { id: `owned-${g}-damaged`, cardId: c.id, name: c.name, key: g === 'ygo' ? `name:${c.name}` : `id:${c.id}`, qty: 1, condition: 'Damaged', finish: 'nonfoil', variant: g === 'ptcg' ? 'normal' : '', language: 'en' },
    ];
    st.decks = decks ? [{ id: `saved-${g}`, name: `${g.toUpperCase()} saved fixture deck`, locked: false, versions: [],
      ...(g === 'mtg' ? { format: 'Standard', commander: '', cards: [{ name: saved.name, qty: 4 }], side: [] } : { format: g === 'ygo' ? 'tcg' : 'standard', zones: { main: [{ name: saved.name, cardId: saved.id, qty: 3 }], extra: [], side: [] } }) }] : [];
  }
  state.activeDeck = decks ? 'saved-mtg' : null;
  if(decks && !options.noWorkHistory)state.homeDeckActivity=Object.fromEntries(GAME_IDS.map(g=>[g,[{id:`saved-${g}`,at:'2026-10-16T12:00:00.000Z'}]]));
  if(decks && options.twoSavedDecks)for(const g of GAME_IDS){const rows=g==='mtg'?state.decks:state.tcg[g].decks;rows.push({...structuredClone(rows[0]),id:`newest-${g}`,name:`${g.toUpperCase()} newest untouched deck`,createdAt:ISO});}
  const cache = { ygo: { [heroes.ygo.id]: heroes.ygo, ...Object.fromEntries(ygoSeedRaws.map(raw => [String(raw.id), fresh(raw)])) }, ptcg: { [heroes.ptcg.id]: heroes.ptcg, [seeds.ptcg.id]: seeds.ptcg } };
  const community = Object.fromEntries(GAME_IDS.map(g => [g, { at: fetchFeed ? 0 : NOW, data: fetchFeed ? null : feed(g, emptyFeed, options) }]));
  const meta = Object.fromEntries(GAME_IDS.map(g => {
    const pending = options.fetchMeta && g === game, data = pending && options.initialMetaLists === 0 ? null : metaFeed(g, emptyFeed, options);
    if (pending && data) for (const deck of data.decks) { deck.key += '-cached'; deck.name += ' cached old list'; }
    return [metaFixtureKey(g), { at: pending || (g === 'mtg' && options.holdEmblems) ? 0 : NOW, data }];
  }));
  // Saved Standard decks have a separate fresh score source. It must neither
  // satisfy nor launch an extra request for the selected Modern discovery rail.
  const standard = metaFeed('mtg', emptyFeed, options);
  for (const deck of standard.decks) { deck.key += '-standard'; deck.name += ' Standard only'; deck.url = deck.url.replace('fixture-modern', 'fixture-standard'); }
  meta['mtg:Standard'] = { at: NOW, data: standard };
  const daily = { ...(options.longDailyNames ? longDailyPicks : heroes), ...(options.oversizeDailyName ? {mtg:oversizeDailyPick} : {}) };
  const hero = { date: heroDate, ...Object.fromEntries(GAME_IDS.map(g => {
    const c = daily[g], noArt = options.dailyArtMode === 'missing';
    return [g, { game: g, date: heroDate, name: c.name, id: c.id, art: noArt ? '' : g === 'mtg' ? c.image_uris.art_crop : g === 'ygo' ? c.art : c.imageLarge, ...(g === 'ygo' ? { artDirect: noArt ? '' : c.artDirect } : {}) }];
  })) };
  const sent = Object.fromEntries([...Object.values(catalog).map(c => [`mtg:${c.id}`, NOW]), ...Object.keys(cache.ygo).map(id => [`ygo:${id}`, NOW])]);
  return { state, cache, storage: {
    'cardforge-v2': state, 'cardforge-catalog-v1': catalog, 'cardforge-tcg-cache-v1': cache,
    'cardforge-hero-v2': hero, 'cardforge-meta-v1': meta, 'cardforge-community-v3': community,
    'cardforge-sets-v1': { at: NOW, sets: [{ code: 'fdn', name: 'Foundations', icon: `${IMAGE}/symbol.svg`, released_at: '2024-11-15', set_type: 'core' }] },
    'cardstashy-watch-sent-v1': sent,
  } };
}
for (const unpriced of [false, true]) {
  const f = fixtures({ unpriced });
  assert.doesNotThrow(() => validateWorkspace(structuredClone(f.state)));
  const value = collectionValue(f.state.collection, catalog, {}, f.state.decks);
  assert.equal(value.total, unpriced ? 0 : 25);
  assert.equal(value.unpriced, unpriced ? 3 : 1);
  for (const game of ['ygo', 'ptcg']) assert.equal(f.cache[game][heroes[game].id].prices.usd, 12.5);
}
for (const game of GAME_IDS) {
  const query = { game, cardId: heroes[game].id, finish: game === 'mtg' ? 'nonfoil' : 'reference' };
  const url = new URL(MARKET_HISTORY);
  url.search = new URLSearchParams({ game, id: query.cardId, finish: query.finish });
  assert.deepEqual(validateHistory(historyFixture(url), query).series, []);
  const deck = metaFeed(game).decks[0], second = metaFeed(game, false, { twoDecks: true }).decks[1];
  assert(communityDeckArtwork(game, deck), `${game}: default deck fixture proves its featured-card membership`);
  assert(communityDeckArtwork(game, second), `${game}: alternate deck fixture proves a different featured card`);
  assert.notEqual(communityDeckArtwork(game, deck).cardId, communityDeckArtwork(game, second).cardId);
  assert.equal(communityDeckArtwork(game, metaFeed(game, false, { deckArtMode: 'missing' }).decks[0]), null);
  assert.equal(communityDeckArtwork(game, metaFeed(game, false, { deckArtMode: 'unsafe' }).decks[0]), null);
  assert.equal(safeCommunityImage(feed(game).items[0].image, game, sources[game].sourceId, sources[game].host + sources[game].news), NEWS_IMAGES[game]);
  assert.equal(safeCommunityImage(feed(game, false, { newsArtMode: 'unsafe' }).items[0].image, game, sources[game].sourceId, sources[game].host + sources[game].news), '');
}
for (const longDailyNames of [false, true]) for (const dailyArtMode of ['ready', 'missing']) for(const oversizeDailyName of [false,true]) {
  const f = fixtures({ longDailyNames, dailyArtMode, oversizeDailyName });
  assert.doesNotThrow(() => validateWorkspace(structuredClone(f.state)));
  for (const game of GAME_IDS) {
    const selected = f.storage['cardforge-hero-v2'][game], expected = oversizeDailyName && game==='mtg' ? oversizeDailyPick : (longDailyNames ? longDailyPicks : heroes)[game];
    assert.equal(selected.name, expected.name); assert.equal(selected.id, expected.id);
    assert.equal(selected.game, game); assert.equal(selected.date, TODAY);
    assert.equal(!!selected.art, dailyArtMode === 'ready');
  }
}
for (const game of GAME_IDS) for (const initialMetaLists of [0, 1]) {
  const pending = fixtures({game,fetchFeed:true,fetchMeta:true,initialMetaLists});
  assert.doesNotThrow(()=>validateWorkspace(structuredClone(pending.state)));
  const key=metaFixtureKey(game), selected=pending.storage['cardforge-meta-v1'][key];
  assert.equal(selected.at,0);assert.equal(selected.data?.decks.length || 0,initialMetaLists);
  if(initialMetaLists)assert.equal(selected.data.decks[0].key,`fixture-${game}-cached`);
  if(game==='mtg'){
    const standard=pending.storage['cardforge-meta-v1']['mtg:Standard'];
    assert.notEqual(key,'mtg:Standard');assert.equal(standard.at,NOW);
    assert.equal(standard.data.decks[0].key,'fixture-mtg-standard');
    assert.notEqual(standard.data.decks[0].url,sources.mtg.deck);
  }
  assert.equal(pending.storage['cardforge-community-v3'][game].data,null);
}
const emblemsFixture=fixtures({holdEmblems:true}).storage['cardforge-meta-v1'][metaFixtureKey('mtg')];
assert.equal(emblemsFixture.at,0,'emblem focus fixture still requests its intentionally stale selected-format snapshot');
assert.equal(emblemsFixture.data.decks[0].key,'fixture-mtg');
// Run the real exact-printing adapter against the same responses used below.
// Keep this before the browser guard so missing identity evidence fails offline,
// without a provider request, server, browser, or virtual-clock advancement.
const originalFetch = globalThis.fetch, originalSetTimeout = globalThis.setTimeout, ptcgRequests = [];
try {
  globalThis.fetch = async input => {
    const url = new URL(input);
    assert.equal(url.origin, 'https://api.tcgdex.net', 'fixture validation never contacts a provider');
    const body = ptcgFixture(url);
    assert.notEqual(body, undefined, `unmapped Pokémon fixture: ${url.pathname}`);
    ptcgRequests.push(url.pathname + url.search);
    return { ok: true, status: 200, json: async () => structuredClone(body) };
  };
  globalThis.setTimeout = () => { throw Error('Exact printing fixture resolution must not depend on clock advancement'); };
  const lists = metaFeed('ptcg', false, { twoDecks: true }).decks;
  const replacement = structuredClone(lists[0]); replacement.key += '-replacement'; replacement.url += '-replacement';
  for (const [index, deck] of [...lists, replacement].entries()) {
    const row = deck.list[0], expected = index === 1 ? ptcgHeroRaw : ptcgSeedRaw;
    const card = await ptcgSource.tournamentCard(row);
    assert.equal(card?.id, expected.id, `${deck.key}: exact listed printing resolves before builder handoff`);
    assert(ptcgPrintingMatches(card, row, ptcgSets[expected.set.id]));
    assert.equal(card.category, 'Pokemon'); assert.equal(card.prices.usd, 12.5);
    const format = ptcgSource.formats.find(f => f.id === 'standard');
    assert.equal(ptcgSource.legality(card, format), 'legal');
    const legal = Object.assign(c => ptcgSource.legality(c, format) === 'legal', { key: format.id });
    assert.equal((await ptcgSource.cheapestPrint(card, { legal }))?.id, expected.id, 'the builder keeps this exact seed through its legal-printing check');
    assert(ptcgRequests.includes(`/v2/en/sets/${expected.set.id}`), 'the printed set code is verified, not guessed');
    assert(ptcgRequests.includes(`/v2/en/cards/${expected.id}`), 'the exact detail is hydrated, not a generic same-name substitute');
  }
  for (const wrong of [{ set: 'OBF' }, { number: '58' }, { name: 'Charizard ex' }]) {
    assert.equal(await ptcgSource.tournamentCard({ ...lists[0].list[0], ...wrong }), null, 'mismatched name, set or number never substitutes another printing');
  }
  assert.equal(ptcgFixture(new URL('https://api.tcgdex.net/v2/en/cards/unknown-printing')), null);
  assert.equal(ptcgFixture(new URL('https://api.tcgdex.net/v2/en/sets/unknown-set')), null);
} finally {
  globalThis.fetch = originalFetch; globalThis.setTimeout = originalSetTimeout;
}
if (process.argv.includes('--validate-fixtures')) {
  console.log('PASS: Home fixtures validate against real workspace, card adapters, collection pricing and exact all-game community-art source contracts; browser was not started.');
  process.exit(0);
}

assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Home browser regression is authorized only on hosted GitHub Actions; use --validate-fixtures for local non-browser validation.');
const { chromium } = await import('playwright');
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(ROOT, `.${path === '/' ? '/index.html' : path}`);
    if (!file.startsWith(ROOT + '/') || req.method !== 'GET') throw Error('Invalid fixture-server request');
    let body = await readFile(file);
    // Disable account initialization at its supported configuration boundary.
    // App rendering, routing, persistence, event handlers and CSS remain real.
    if (path === '/config.js') body = Buffer.from(body.toString().replace(/key:\s*"[^"]*"/, 'key: ""'));
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' })[extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch { res.writeHead(404); res.end('Fixture server: not found'); }
});
await mkdir(RESULTS, { recursive: true });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
let browser;
const report = [];

async function openApp(options = {}) {
  const { game = 'mtg', width = 390, reducedMotion = 'no-preference', timezoneId = 'UTC' } = options;
  const context = await browser.newContext({ viewport: { width, height: 1100 }, hasTouch: true, deviceScaleFactor: 1, reducedMotion, timezoneId, locale: 'en-US', serviceWorkers: 'block' });
  const page = await context.newPage();
  if (options.clock) await page.clock.install({ time: new Date(NOW) });
  page.setDefaultTimeout(15000);
  const errors = [], writes = [], unexpected = [], requests = [];
  let gate = null;
  const deferredGate = () => { let release,started;const wait=new Promise(r=>release=r),seen=new Promise(r=>started=r);return {wait,seen,release,started}; };
  const homeSources = options.holdHomeSources ? { news:deferredGate(), decks:deferredGate(), counts:{news:0,decks:0} } : null;
  let releaseEmblems, seenEmblems;
  const emblemsWait = options.holdEmblems ? new Promise(resolve => { releaseEmblems = resolve; }) : null;
  const emblemsSeen = options.holdEmblems ? new Promise(resolve => { seenEmblems = resolve; }) : null;
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    requests.push(`${request.method()} ${url.href}`);
    const pendingHomeSource = homeSources && (
      url.origin === BASE && url.pathname === '/api/community' && url.searchParams.get('game') === game ? 'news' :
      game === 'mtg' && url.origin === BASE && url.pathname === '/api/meta/mtg' && url.searchParams.get('format') === DEFAULT_MTG_META_FORMAT ||
      game === 'ygo' && url.origin === BASE && url.pathname === '/api/meta/ygo/decks' && url.searchParams.get('offset') === '0' ||
      game === 'ptcg' && url.hostname === 'play.limitlesstcg.com' && url.pathname === '/api/tournaments' ? 'decks' : null);
    if (pendingHomeSource) { homeSources.counts[pendingHomeSource]++; homeSources[pendingHomeSource].started(); await homeSources[pendingHomeSource].wait; }
    const isMarketHistory = url.origin === MARKET_HISTORY.origin && url.pathname === MARKET_HISTORY.pathname;
    if (isMarketHistory && request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET', 'access-control-allow-headers': 'apikey' }, body: '' });
    if (!['GET', 'HEAD'].includes(request.method())) {
      writes.push(`${request.method()} ${url.href}`);
      return json({ ok: false, error: 'Writes are forbidden in the Home regression' });
    }
    // Card details request public history even while their Prices tab is hidden.
    // Keep that real path active, but fulfill only the configured host and exact
    // history endpoint locally, with matching printing identity and honest gaps.
    if (isMarketHistory) return json(historyFixture(url));
    const selection = url.origin === BASE && url.pathname === '/api/daily-card' || url.hostname === 'api.scryfall.com' && url.pathname === '/cards/random'
      || url.hostname === 'db.ygoprodeck.com' && url.pathname.endsWith('/archetypes.php')
      || url.hostname === 'api.tcgdex.net' && url.pathname === '/v2/en/cards' && url.searchParams.get('category') === 'Pokemon';
    if (selection && gate) { const active = gate; gate = null; active.started(); await active.wait; }
    if (url.hostname === 'home-fixtures.invalid' || request.resourceType() === 'image' && url.origin !== BASE || url.pathname.startsWith('/img/')) {
      // Decode failure, not an uncontrolled Internet request. Daily artwork is
      // distinct from the selected tournament card and publisher news images.
      const communityImage = Object.values(NEWS_IMAGES).includes(url.href)
        || url.href.includes(mtgSeed.id) || /Llanowar(?:%20|\+)Elves/i.test(url.href)
        || url.href.includes(seeds.ygo.id) || /SSP_057_R_EN/.test(url.href);
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: options.failCommunityImages && communityImage ? '<svg invalid-image-fixture' : SVG });
    }
    if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '/* deterministic system fonts */' });
    if (url.origin === BASE) {
      if (url.pathname === '/catalog.json') return json({ cards: [], snapshot_date: '2000-01-01' });
      if (url.pathname === '/api/daily-card') {
        if (options.dailyUnavailable) return json({error:'Daily fixture unavailable'});
        const g = url.searchParams.get('game'), date = await page.evaluate(() => new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
        const c = seeds[g];
        return json({game:g,date,card:{game:g,date,id:c.id,name:c.name,art:g==='mtg'?c.image_uris.art_crop:g==='ygo'?c.art:c.imageLarge,artDirect:g==='ygo'?c.artDirect:''}});
      }
      if (url.pathname === '/api/community') return json(feed(url.searchParams.get('game'), options.emptyFeed, options));
      if (url.pathname === '/api/meta/mtg') {
        if (emblemsWait && url.searchParams.get('format') === DEFAULT_MTG_META_FORMAT) { seenEmblems(); await emblemsWait; }
        return json(metaFeed('mtg', options.emptyFeed, options));
      }
      if (url.pathname === '/api/meta/ygo/decks') return json(url.searchParams.get('offset') === '0' ? [{ deckNum: 'fixture-ygo', deck_name: 'Blue-Eyes White Dragon published fixture deck', tournamentName: 'Fixture tournament', tournamentPlacement: 'Top 8', submit_date: '2026-10-15', main_deck: JSON.stringify([seeds.ygo.id]), extra_deck: '[]', side_deck: '[]', cover_card: seeds.ygo.id, pretty_url: 'fixture-blue-eyes' }] : []);
      if (url.pathname === '/api/meta/ygo/top') return json({ results: [] });
      if (url.pathname.startsWith('/api/prices/')) return json({ points: [], series: [], cards: [], products: [], variants: [], prices: [], partial: false });
      if (!url.pathname.startsWith('/api/')) return route.continue();
    }
    if(options.dailyUnavailable && (url.hostname==='api.scryfall.com' && url.pathname==='/cards/random' || url.hostname==='db.ygoprodeck.com' && url.searchParams.has('staple') || url.hostname==='api.tcgdex.net' && url.searchParams.has('rarity')))return json(url.hostname==='api.tcgdex.net'?[]:{data:[]});
    if (url.hostname === 'api.scryfall.com') {
      if (url.pathname === '/cards/random') return json(mtgSeed);
      if (url.pathname === '/cards/search') {
        const q = url.searchParams.get('q') || '';
        return json({ object: 'list', data: q.includes(mtgHero.oracle_id) ? [mtgHero] : [mtgSeed], has_more: false, total_cards: 1 });
      }
      if (url.pathname.endsWith('/rulings')) return json({ data: [] });
      if (url.pathname === '/cards/named') return json(catalog[cardKey(url.searchParams.get('exact') || url.searchParams.get('fuzzy'))] || mtgSeed);
      if (url.pathname.startsWith('/cards/')) return json(url.pathname.includes(mtgHero.id) ? mtgHero : mtgSeed);
      if (url.pathname === '/sets') return json({ data: [] });
    }
    if (url.hostname === 'db.ygoprodeck.com') {
      if (url.pathname.endsWith('/archetypes.php')) return json([{ archetype_name: 'Blue-Eyes' }]);
      if (url.pathname.endsWith('/cardinfo.php')) {
        const data = url.searchParams.get('id') === String(ygoHeroRaw.id) ? [ygoHeroRaw] : url.searchParams.has('staple') ? [ygoSeedRaws[0]] : ygoSeedRaws;
        return json({ data, meta: { total_rows: data.length, rows_remaining: 0 } });
      }
      if (url.pathname.endsWith('/cardsets.php')) return json([]);
    }
    if (url.hostname === 'api.tcgdex.net') {
      const body = ptcgFixture(url);
      if (body !== undefined) return json(body);
    }
    if (url.hostname === 'play.limitlesstcg.com') {
      if (url.pathname === '/api/tournaments') return json([{ id: 'fixture', name: 'Fixture tournament', players: 32, date: '2026-10-15T12:00:00.000Z' }]);
      if (url.pathname === '/api/tournaments/fixture/standings') return json([{ player: '1', name: 'Public fixture player', placing: 1, deck: { id: 'pikachu', name: 'Pikachu', icons: ['pikachu'] }, decklist: { pokemon: [{ count: 4, name: 'Pikachu', set: 'SSP', number: '57' }] } }]);
      if (url.pathname === '/api/tournaments/fixture/pairings') return json([]);
    }
    unexpected.push(`${request.method()} ${url.href}`);
    // Never forward unknown requests to the Internet, even on a failing test.
    return json({ error: 'Unmapped fixture URL' });
  });
  const f = fixtures(options);
  await page.addInitScript(({ storage, now }) => {
    const NativeDate = Date;
    // Keep simulated time monotonic across reloads: saved activity must not
    // become future-dated merely because this init script executes again.
    const clockKey = 'home-fixture-clock-offset';
    const savedOffset = sessionStorage.getItem(clockKey);
    const offset = savedOffset === null ? now - NativeDate.now() : Number(savedOffset);
    sessionStorage.setItem(clockKey, String(offset));
    window.__homeTimeAdvance = 0;
    globalThis.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [NativeDate.now() + offset + window.__homeTimeAdvance])); }
      static now() { return NativeDate.now() + offset + window.__homeTimeAdvance; }
    };
    Math.random = () => 0; // deterministic provider selection, not a fake selected-card renderer
    if (!localStorage.getItem('home-fixtures-installed')) {
      for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem('cardstashy-tour-v1', 'done');
      localStorage.setItem('home-fixtures-installed', '1');
    }
  }, { storage: f.storage, now: NOW });
  await page.goto(BASE + '/#home');
  await page.locator('#app.ready').waitFor();
  await preloadTestState(page);
  await assertSelected(page, game);
  await page.waitForFunction(() => document.querySelector('.home-hero') && !document.querySelector('.tour'));
  const health = () => {
    assert.deepEqual(errors, [], 'no console errors or uncaught page errors');
    assert.deepEqual(writes, [], 'Home interactions never make network writes');
    assert.deepEqual(unexpected, [], 'all provider calls are explicitly local fixtures');
  };
  return { page, context, requests, health, homeSources, emblems: options.holdEmblems ? { seen: emblemsSeen, release: releaseEmblems } : null,
    holdSelection() {
      let release, started;
      const wait = new Promise(r => { release = r; });
      const seen = new Promise(r => { started = r; });
      gate = { wait, started };
      return { release, seen };
    },
    async close() { health(); await context.close(); },
  };
}
async function preloadTestState(page) {
  // Resolve the module once so later polling reads the same initialized store
  // directly instead of repeatedly importing it in each readiness predicate.
  await page.evaluate(async () => { window.__homeTestState = (await import('/store.js')).S; });
}
async function assertSelected(page, game) {
  await page.waitForFunction(g => document.body.dataset.game === g && document.querySelector(`#game-tab-${g}`)?.getAttribute('aria-selected') === 'true', game);
  assert.equal(await page.locator('#gameTabs [aria-selected="true"]').count(), 1);
  assert.equal(await page.locator(`#game-tab-${game}`).getAttribute('tabindex'), '0');
  assert.equal(await page.locator('#content').getAttribute('aria-labelledby'), `game-tab-${game}`);
  assert.equal(await page.locator('[data-home-community]').getAttribute('data-home-community'), game);
  const active = await page.evaluate(async () => (await import('/store.js')).S.state.settings.game);
  assert.equal(active, game);
}
async function selectGame(page, game) {
  await page.locator(`#game-tab-${game}`).click();
  await assertSelected(page, game);
}
async function touchSwipe(page, selector, dx = -150, dy = 0) {
  await page.locator(selector).first().evaluate((node, { dx, dy }) => {
    const startX = Math.min(innerWidth - 40, 260), startY = 160;
    const make = (x, y) => new Touch({ identifier: 1, target: node, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y });
    const start = make(startX, startY), end = make(startX + dx, startY + dy);
    node.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [start], targetTouches: [start], changedTouches: [start] }));
    node.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [end], targetTouches: [end], changedTouches: [end] }));
    node.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [end] }));
  }, { dx, dy });
  // Real gesture suppression is time-based; let the synthetic touch's follow-on
  // click window expire before Playwright starts the next independent action.
  await page.waitForTimeout(480);
}
async function noOverflow(page, label) {
  const sizes = await page.evaluate(async () => {
    // Page entry animates children, not #content itself. Await real finite
    // subtree animations/transitions, including replacements from feed refresh,
    // then measure in the same evaluation without changing motion or clipping.
    for (;;) {
      const animations = document.querySelector('#content').getAnimations({ subtree: true })
        .filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime) && !['finished', 'idle'].includes(a.playState));
      if (!animations.length) break;
      await Promise.all(animations.map(a => a.finished.catch(() => {})));
    }
    const root = document.documentElement, body = document.body, content = document.querySelector('#content');
    const selectors = ['.topbar', '#gameTabs', '.home-value', '.home-meta', '.home-meta-copy', '.home-meta-footer', '.home-editorial', '.home-community', '.home-resume', '.community-feature-copy', '.home-overview'];
    return { viewport: innerWidth, root: root.scrollWidth, body: body.scrollWidth, content: content.scrollWidth, contentWidth: content.clientWidth,
      elements: selectors.map(selector => { const n = document.querySelector(selector); if (!n) return { selector, missing: true }; const r = n.getBoundingClientRect(); return { selector, left: r.left, right: r.right, scroll: n.scrollWidth, width: n.clientWidth }; }) };
  });
  assert(sizes.root <= sizes.viewport + 2 && sizes.body <= sizes.viewport + 2, `${label}: document overflow ${JSON.stringify(sizes)}`);
  assert(sizes.content <= sizes.contentWidth + 2, `${label}: content overflow ${JSON.stringify(sizes)}`);
  for (const e of sizes.elements) {
    assert(!e.missing, `${label}: ${e.selector} exists`);
    assert(e.left >= -2 && e.right <= sizes.viewport + 2, `${label}: ${e.selector} outside viewport: ${JSON.stringify(e)}`);
    assert(e.scroll <= e.width + 2, `${label}: ${e.selector} clips overflowing content: ${JSON.stringify(e)}`);
  }
}
async function visibleHeaderArt(page) {
  // Background refresh replaces Home markup. Inspect the current connected
  // hero, artwork and loaded image together, never a previously resolved handle.
  await page.waitForFunction(() => {
    const heroes = document.querySelectorAll('#homeHero.has-art');
    if (heroes.length !== 1) return false;
    const hero = heroes[0], art = hero.querySelector('.hh-art');
    const image = art?.matches('img') ? art : art?.querySelector('img');
    if (![hero, art, image].every(node => node?.isConnected) || !image.complete || image.naturalWidth <= 0) return false;
    const rect = art.getBoundingClientRect();
    return rect.width >= 280 && rect.height >= 280 && [hero, art, image].every(node => {
      const css = getComputedStyle(node);
      return css.display !== 'none' && css.visibility === 'visible' && Number(css.opacity) > 0;
    });
  });
}
const deckIdentity = (game, second = false) => game === 'mtg' ? (second ? heroes : seeds)[game].name
  : game === 'ygo' ? (second ? heroes : seeds)[game].id
    : second ? `${heroes.ptcg.name} · OBF 125` : `${seeds.ptcg.name} · SSP 57`;
async function assertNoNewsArtwork(page, selector, { failed = false } = {}) {
  const feature = page.locator(selector).first();
  assert.equal(await feature.locator('.community-art-theme, .community-art-emblem').count(), 0, 'news never substitutes unrelated game artwork');
  if (failed) {
    await page.waitForFunction(selector => document.querySelector(`${selector} [data-community-art]`)?.hidden === true, selector);
    assert.equal(await feature.locator('[data-community-art]').isVisible(), false, 'failed publisher image yields a clean text-only card');
  } else assert.equal(await feature.locator('[data-community-art], img[data-community-image]').count(), 0, 'missing or unsafe publisher image creates no visual/request');
  assert(await feature.locator('h3').isVisible(), 'headline remains readable without art');
}
async function assertCommunityArtwork(page, selector, game, { kind = 'card', state = 'ready', second = false, source = null } = {}) {
  const art = page.locator(selector).locator('[data-community-art]');
  await art.scrollIntoViewIfNeeded();
  await page.waitForFunction(({ selector, state }) => document.querySelector(`${selector} [data-community-art]`)?.dataset.artState === state, { selector, state });
  assert.equal(await art.count(), 1, `${game}: one source-bound art treatment in ${selector}`);
  assert.equal(await art.getAttribute('data-art-game'), game);
  assert.equal(await art.getAttribute('data-art-kind'), kind);
  const visual = await art.evaluate(async node => {
    // A feed refresh can restart page-entry motion after scrollIntoView. Measure
    // the completed layout, not its temporary .995 entry scale.
    const animations=[];
    for(let parent=node;parent;parent=parent.parentElement)animations.push(...parent.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)&&!['finished','idle'].includes(a.playState)));
    await Promise.all(animations.map(a=>a.finished.catch(()=>{})));
    const rect = node.getBoundingClientRect(), css = getComputedStyle(node), image = node.querySelector('img[data-community-image]');
    return { width: rect.width, height: rect.height, display: css.display, visibility: css.visibility, opacity: Number(css.opacity),
      loaded: !!image?.complete && image.naturalWidth > 0, imageHidden: !image || image.hidden || getComputedStyle(image).display === 'none',
      visibleFallback: [...node.querySelectorAll('.community-art-fallback')].some(n => getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility === 'visible' && Number(getComputedStyle(n).opacity) > 0),
      visibleCredit: [...node.querySelectorAll('.community-art-credit')].some(n => getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility === 'visible' && Number(getComputedStyle(n).opacity) > 0) };
  });
  assert(visual.width >= 80 && visual.height >= 65 && visual.display !== 'none' && visual.visibility === 'visible' && visual.opacity > 0.1, `${game}: visible art on phones as well as desktop: ${JSON.stringify(visual)}`);
  if (selector.startsWith('[data-home-meta=')) {
    const cover = await art.evaluate(node => { const a = node.getBoundingClientRect(), b = node.parentElement.getBoundingClientRect(); return { width: a.width, height: a.height, parentWidth: b.width, parentHeight: b.height, display: getComputedStyle(node).display, gridArea: getComputedStyle(node).gridArea }; });
    assert(cover.display === 'block' && cover.width >= cover.parentWidth - 3 && cover.height >= cover.parentHeight - 3, `${game}: decorative shortcut art fills its whole control, not the text grid rows: ${JSON.stringify(cover)}`);
  }
  if (kind === 'card') {
    assert.equal(await art.getAttribute('data-art-card'), deckIdentity(game, second));
    assert.equal(await art.getAttribute('data-art-deck'), `fixture-${game}${second ? '-second' : ''}`);
    assert.equal(await art.getAttribute('data-art-source'), `${sources[game].deck}${second ? '-second' : ''}`);
    const expected = game === 'mtg' ? `https://api.scryfall.com/cards/named?exact=${encodeURIComponent((second ? heroes : seeds).mtg.name)}&format=image&version=art_crop`
      : game === 'ygo' ? `https://images.ygoprodeck.com/images/cards_cropped/${(second ? heroes : seeds).ygo.id}.jpg`
        : `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/${second ? 'OBF/OBF_125' : 'SSP/SSP_057'}_R_EN.png`;
    assert.equal(await art.locator('img').getAttribute('src'), expected, `${game}: source URL encodes the selected list's verified card, not generic game art`);
  } else if (kind === 'publisher') {
    assert.equal(await art.getAttribute('data-art-source'), source || sources[game].host + sources[game].news);
    assert.equal(await art.locator('img').getAttribute('src'), NEWS_IMAGES[game]);
  } else {
    assert.equal(await art.locator('img').count(), 0, 'unverified/missing URLs must not create image requests');
    assert.equal(await art.getAttribute('data-art-card'), null, 'themed art never impersonates a real featured card');
  }
  if (state === 'ready') {
    assert(visual.loaded && !visual.imageHidden && (visual.visibleCredit || selector.startsWith('[data-home-meta=') || kind === 'publisher'), `${game}: actual loaded image and honest source caption: ${JSON.stringify(visual)}`);
    if (selector.startsWith('[data-home-meta=')) assert.match(await page.locator(selector).textContent(), /Featured deck:.*Card preview:/s, 'compact art retains source/card provenance in its accessible text');
  }
  else assert(visual.imageHidden && visual.visibleFallback, `${game}: failed/missing image has a visible honest theme fallback, not a broken icon: ${JSON.stringify(visual)}`);
}
async function assertReadableArtwork(page, game) {
  const geometry = await page.locator('.community-feature').first().evaluate(node => {
    const copy = node.querySelector('.community-feature-copy'), art = node.querySelector('[data-community-art]');
    const a=art.getBoundingClientRect(),c=copy.getBoundingClientRect(),row=node.getBoundingClientRect();
    return { art:{left:a.left,right:a.right,width:a.width,height:a.height},copy:{left:c.left,right:c.right},rowHeight:row.height,
      text: [...copy.querySelectorAll(':scope > h3,:scope > .eyebrow,:scope > .community-source,:scope > .community-context > summary')].map(n => { const c = getComputedStyle(n), r = n.getBoundingClientRect(); return { tag:n.tagName,width:r.width,height:r.height,clipped:n.scrollWidth>n.clientWidth+2,color:c.color,opacity:Number(c.opacity),fontSize:parseFloat(c.fontSize) }; }) };
  });
  assert(geometry.art.right+7<=geometry.copy.left,`${game}: publisher image sits beside, never behind the real headline`);
  assert(geometry.art.width<=115 && geometry.art.height<=90,`${game}: matched publisher image is a restrained thumbnail`);
  assert(geometry.rowHeight<240,`${game}: one news item is a compact editorial row, not a 390px hero`);
  for(const text of geometry.text)assert(text.width>0 && text.height>0 && !text.clipped && text.opacity===1 && text.fontSize>=10,`${game}: readable naturally wrapping editorial text: ${JSON.stringify(text)}`);
}
async function assertDailyIdentity(page, game, card = heroes[game], date = TODAY, { compact = true, allowOversizeWord = false } = {}) {
  const control=page.locator('.hh-credit');
  assert.equal(await page.locator('[data-act="homeDailyCard"]').count(),1,'one exact daily action, not duplicate artwork/credit buttons');
  for(const [attribute,value] of Object.entries({'data-act':'homeDailyCard','data-game':game,'data-id':card.id,'data-name':card.name,'data-date':date}))assert.equal(await control.getAttribute(attribute),value);
  assert.equal(await control.getAttribute('aria-label'),`Explore ${card.name}, Card of the Day`);
  assert.equal((await page.locator('#homeHero').innerText()).match(/Card of the Day/gi)?.length,1);
  assert.equal(await control.locator('b').textContent(),card.name);
  assert.equal(await control.locator(':scope > span:first-child').innerText(),'Card of the Day');
  assert.equal(await page.locator('.hh-art-link, .hh-search, .hh-deck-link').count(),0,'one daily action without duplicate art or saved-deck links');
  const size=await control.evaluate(n=>{
    const hero=n.closest('#homeHero'),art=hero.querySelector('.hh-art'),title=n.querySelector('b'),arrow=n.querySelector('.hh-daily-arrow');
    const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const c=getComputedStyle(n),box=rect(n),a=art?rect(art):null;
    const text=[n.firstElementChild,title].map(node=>{
      const css=getComputedStyle(node),range=document.createRange();range.selectNodeContents(node);
      // Range rectangles prove every painted line fits, not merely that an
      // ellipsized/clamped DOM node still contains the original full string.
      const lines=[...range.getClientRects()].filter(r=>r.width>0).map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom}));
      const words=[...node.firstChild.textContent.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)].map(match=>{
        range.setStart(node.firstChild,match.index);range.setEnd(node.firstChild,match.index+match[0].length);
        const fragments=[...range.getClientRects()].filter(r=>r.width>0);
        return {word:match[0],lines:fragments.length,width:fragments.reduce((sum,r)=>sum+r.width,0)};
      });
      return {text:node.textContent,lines,words,fontSize:parseFloat(css.fontSize),overflowWrap:css.overflowWrap,wordBreak:css.wordBreak,
        clipped:node.scrollWidth>node.clientWidth+1||node.scrollHeight>node.clientHeight+1,lineClamp:css.webkitLineClamp};
    });
    const overlaps=(x,y)=>x.left<y.right&&x.right>y.left&&x.top<y.bottom&&x.bottom>y.top;
    // Include the transparent action above the art and the Pokémon crop's
    // nested image. The crop transform is intentional; blur is not.
    const effects=[hero,...hero.querySelectorAll('*')].filter(node=>node===hero||node===art||node===art?.querySelector('img')).map(node=>{
      const css=getComputedStyle(node);return {node:node.className,filter:css.filter,backdrop:css.backdropFilter,prefixedBackdrop:css.getPropertyValue('-webkit-backdrop-filter')};
    });
    return {height:rect(hero).height,art:a,box,arrow:rect(arrow),text,effects,
      content:{left:box.left+parseFloat(c.paddingLeft),right:box.right-parseFloat(c.paddingRight),top:box.top+parseFloat(c.paddingTop),bottom:box.bottom-parseFloat(c.paddingBottom)}};
  });
  // This bound belongs to the normal fixtures, not every possible card name.
  // Longer titles may grow naturally, never clip or shrink to satisfy a cap.
  if(compact)assert(size.height>=300 && size.height<600,`${game}: artwork header stays useful without hiding the dashboard: ${JSON.stringify(size)}`);
  assert(size.box.height>=44 && size.box.width>=44,`${game}: exact daily identity keeps its touch target`);
  assert(size.content.right+8<=size.arrow.left && size.arrow.right<=size.box.right,`${game}: text reserves space for the daily arrow`);
  if(size.art){
    assert(size.art.width>=280 && size.art.height>=280,`${game}: immersive artwork remains prominent`);
    assert(size.art.left<=size.box.left && size.art.right>=size.box.right,`${game}: daily action stays within the artwork header`);
  }
  for(const [index,text] of size.text.entries()){
    assert(text.fontSize>=(index?13:10) && !text.clipped && ['none',''].includes(text.lineClamp),`${game}: daily text is readable and unclipped: ${JSON.stringify(text)}`);
    assert.equal(text.overflowWrap,index?'break-word':'normal');assert.equal(text.wordBreak,'normal');
    assert(text.lines.length>0 && text.lines.every(r=>r.left>=size.content.left-1&&r.right<=size.content.right+1&&r.top>=size.content.top-1&&r.bottom<=size.content.bottom+1),`${game}: all daily text lines fit the reserved reading area: ${JSON.stringify(size)}`);
    assert(text.words.every(word=>word.lines===1||allowOversizeWord&&word.width>size.content.right-size.content.left+1),`${game}: ordinary words stay intact; only a token wider than the whole reading column can wrap: ${JSON.stringify(text.words)}`);
  }
  for(const effect of size.effects){
    assert.equal(effect.filter,'none',`${game}: thumbnail/overlapping ${effect.node} has no blur filter`);
    assert.equal(effect.backdrop,'none',`${game}: thumbnail/overlapping ${effect.node} does not blur the art behind it`);
    assert(['none',''].includes(effect.prefixedBackdrop),`${game}: no prefixed backdrop blur on ${effect.node}`);
  }
}
async function accessibleCarouselControls(page, label) {
  // A fixed mobile nav appearing partway through a full-page capture is normal.
  // Test the actual viewport instead: the controls must scroll into clear space,
  // accept keyboard focus, and remain directly hit-testable without forced clicks.
  await page.locator('.community-controls').evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  for (const step of ['-1', '1']) {
    const control = page.locator(`[data-community-step="${step}"]`);
    await control.focus();
    const bounds = await control.evaluate(node => {
      const rect = node.getBoundingClientRect(), nav = document.querySelector('.bottom-nav');
      const navRect = nav?.getBoundingClientRect(), navVisible = nav && getComputedStyle(nav).display !== 'none';
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return { focused: document.activeElement === node, hit: hit === node || node.contains(hit), width: rect.width, height: rect.height,
        top: rect.top, bottom: rect.bottom, clearBottom: navVisible ? navRect.top : innerHeight };
    });
    assert((await control.isDisabled() || bounds.focused) && bounds.hit, `${label}: carousel ${step} receives focus and unobstructed input: ${JSON.stringify(bounds)}`);
    assert(bounds.top >= 0 && bounds.bottom <= bounds.clearBottom, `${label}: carousel ${step} scrolls clear of the fixed nav: ${JSON.stringify(bounds)}`);
    assert(bounds.width >= 44 && bounds.height >= 44, `${label}: carousel ${step} keeps a 44px touch target`);
  }
}
async function closeSheet(page) {
  const button = page.locator('#sheet [data-act="closeSheet"]').first();
  if (await button.isVisible()) await button.click();
  await page.waitForFunction(() => !document.querySelector('#sheet').open);
}
async function inventorySnapshot(page) {
  return page.evaluate(async () => { const { S } = await import('/store.js'); return JSON.stringify([S.state.collection, S.state.decks, S.state.tcg]); });
}
async function safeSourceLink(article, game, selector = 'a.community-open') {
  const link = article.locator(selector);
  assert.equal(await link.count(), 1);
  assert.equal(await link.getAttribute('target'), '_blank');
  const rel = (await link.getAttribute('rel')).split(/\s+/);
  assert(rel.includes('noopener') && rel.includes('noreferrer'), `${game}: external source opener/privacy protection`);
  const href = new URL(await link.getAttribute('href'));
  assert.equal(href.protocol, 'https:');
  assert.equal(href.username + href.password + href.port, '');
  assert(!href.hostname.endsWith('.invalid'), 'source action points to the intended official provider, never a fixture or unsafe host');
}
async function chooseFormat(page, game) {
  await page.locator('#randomFormat').click();
  await page.locator('.glass-select-menu[open]').getByRole('option', { name: game === 'ygo' ? 'Advanced (TCG)' : 'Standard', exact: true }).click();
}
async function openDeckRandom(page) {
  await page.evaluate(()=>{location.hash='#decks';});
  await page.waitForFunction(()=>document.body.dataset.view==='decks');
  await page.locator('[data-act="randomDeckOptions"]').first().click();
}
async function startReveal(page, game) {
  await openDeckRandom(page);
  await page.locator('#randomFormat').waitFor();
  assert.equal(await page.locator('#randomFormat').inputValue(), '', 'format is an explicit user choice');
  assert.equal(await page.locator('#randomTheme').inputValue(), '', 'theme stays optional');
  await page.locator('[data-act="randomDeckStart"]').click();
  await page.waitForFunction(() => /Choose a format/.test(document.querySelector('#toast').textContent));
  assert.equal(await page.locator('.home-deck-reveal').count(), 0, 'no decorative reveal before format/selection');
  await chooseFormat(page, game);
  await page.locator('[data-act="randomDeckStart"]').click();
  await page.locator('.home-deck-reveal').waitFor();
  assert.equal(await page.locator('.home-deck-reveal h3').innerText(), seeds[game].name, 'reveal names the actual provider-selected card');
  assert.match(await page.locator('.home-deck-reveal').innerText(), /not a finished deck/);
  const image = page.locator('.home-reveal-fan img');
  assert.equal(await image.getAttribute('alt'), seeds[game].name);
  await image.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => { const n = document.querySelector('.home-reveal-fan img'); return n?.complete && n.naturalWidth > 0; });
}

try {
  browser = await chromium.launch();
  // A real delayed background response must not detach a keyboard user's
  // existing Home control. Hold the shared Modern source over a stale cached
  // snapshot, let the emblem timer join it, and never refocus after release.
  for (const selector of ['[data-community-step="-1"]', '.community-open']) {
    const focused = await openApp({ holdEmblems: true, width: 1440, clock: true });
    await Promise.race([focused.emblems.seen, new Promise((_, reject) => setTimeout(() => reject(Error('Delayed emblem request was not observed')), 15000))]);
    const control = focused.page.locator(selector).first();
    await control.scrollIntoViewIfNeeded();
    await control.focus();
    const original = await control.elementHandle();
    assert(await original.evaluate(node => node.isConnected && document.activeElement === node), 'original Home control has focus before delayed data');
    await focused.page.clock.fastForward(2600);
    focused.emblems.release();
    await focused.page.evaluate(async () => {
      const { metaState, DEFAULT_MTG_META_FORMAT } = await import('/meta.js');
      const state = metaState(`mtg:${DEFAULT_MTG_META_FORMAT}`);
      await state.promise;
      await new Promise(resolve => setTimeout(resolve, 0));
      if (state.busy || !state.data) throw Error('Emblem data did not finish and remain cached');
    });
    assert(await original.evaluate(node => node.isConnected && document.activeElement === node), 'delayed emblem response preserves the original focused Home node without refocusing');
    assert.deepEqual(focused.requests.filter(r=>r.startsWith(`GET ${BASE}/api/meta/mtg?`)).map(r=>new URL(r.slice(4)).searchParams.get('format')),[DEFAULT_MTG_META_FORMAT],'Home and emblems share exactly one selected-format request');
    await original.dispose();
    await focused.close();
  }
  report.push('Delayed emblem-data completion keeps the original focused carousel button and source link connected, with fresh data cached');
  // Leave/re-enter during the first shared request. Empty and single-list
  // rails have no timer, so only correct mount subscription can paint this data.
  for (const game of GAME_IDS) for (const initialMetaLists of [0, 1]) {
    const pending = await openApp({ game, fetchFeed:true, fetchMeta:true, initialMetaLists, holdHomeSources:true, reducedMotion:'reduce' });
    const p = pending.page;
    await Promise.race([Promise.all([pending.homeSources.news.seen,pending.homeSources.decks.seen]),new Promise((_,reject)=>setTimeout(()=>reject(Error('Held Home providers were not observed')),15000))]);
    assert.equal(await p.evaluate(async game=>(await import('/home-ui.js')).homeMetaKey(game),game),metaFixtureKey(game),'held provider matches the actual selected Home format');
    const oldCommunity=await p.locator('[data-home-community]').elementHandle(),oldMeta=await p.locator('[data-home-meta]').elementHandle();
    assert.equal(await p.locator('[data-home-meta-open]').count(),initialMetaLists);
    if(initialMetaLists){
      assert.equal(await p.locator('[data-home-meta-open]').getAttribute('data-key'),`fixture-${game}-cached`);
      assert.equal(await p.locator('.home-meta-card').getAttribute('data-meta-key'),metaFixtureKey(game));
      assert.equal(await p.locator('.home-meta-original').getAttribute('href'),sources[game].deck);
    }
    await p.evaluate(()=>{location.hash='#collection';});
    await p.waitForFunction(()=>document.body.dataset.view==='collection');
    await p.evaluate(()=>{location.hash='#home';});await p.waitForFunction(()=>document.body.dataset.view==='home');await assertSelected(p,game);
    assert(await oldCommunity.evaluate(n=>!n.isConnected));assert(await oldMeta.evaluate(n=>!n.isConnected));
    const currentMeta=await p.locator('[data-home-meta]').elementHandle();
    pending.homeSources.news.release();
    await p.waitForFunction(game=>document.querySelector('.community-feature h3')?.textContent===`${game.toUpperCase()} dated fixture story`,game);
    assert.equal(await p.locator('[data-home-meta-open]').count(),initialMetaLists,'news paints independently before decks resolve');
    if(initialMetaLists)assert.equal(await p.locator('[data-home-meta-open]').getAttribute('data-key'),`fixture-${game}-cached`,'news cannot substitute another cached deck');
    pending.homeSources.decks.release();
    const expectedKey=game==='mtg'?'fixture-mtg':game==='ygo'?'ygo:fixture-ygo':'ptcg:fixture:1';
    await p.waitForFunction(key=>document.querySelector('[data-home-meta-open]')?.dataset.key===key,expectedKey);
    assert.equal(await p.locator('[data-home-meta-open]').count(),1,'one exact selected-format list arrives');
    assert.equal(await p.locator('.home-meta-card').getAttribute('data-meta-key'),metaFixtureKey(game));
    assert(await currentMeta.evaluate(n=>n.isConnected && n===document.querySelector('[data-home-meta]')),'late completion updates the new mount in place');
    const originalUrl=await p.evaluate(async({metaKey,key})=>(await import('/meta.js')).metaState(metaKey).data.decks.find(deck=>deck.key===key).url,{metaKey:metaFixtureKey(game),key:expectedKey});
    assert.equal(await p.locator('.home-meta-original').getAttribute('href'),originalUrl);
    assert.deepEqual(pending.homeSources.counts,{news:1,decks:1},'return never duplicates provider requests');
    if(game==='mtg')assert.deepEqual(pending.requests.filter(r=>r.startsWith(`GET ${BASE}/api/meta/mtg?`)).map(r=>new URL(r.slice(4)).searchParams.get('format')),[DEFAULT_MTG_META_FORMAT],'no other-format request or duplicate selected-format fetch');
    await oldCommunity.dispose();await oldMeta.dispose();await currentMeta.dispose();await pending.close();
  }
  report.push('All games: zero/one-list Home leave/re-enter shares the held provider request, independently paints new news/decks into the current mount while idle, and preserves original source identity');
  // One real boot, then all game changes/resizes go through production controls.
  const app = await openApp();
  const { page } = app;
  assert.deepEqual(await page.locator('#gameTabs [role="tab"]').evaluateAll(nodes => nodes.map(n => n.dataset.game)), GAME_IDS);
  for (const game of GAME_IDS) {
    await selectGame(page, game);
    assert.equal(await page.locator('[data-home-meta]').count(),1,`${game}: shared full-width lower Meta rail parity`);
    assert.equal(await page.locator('[data-home-discovery]').count(),1,`${game}: one unified discovery section`);
    assert.equal(await page.locator('.home-discover, .home-deal, .home-personal .quick, .home-personal .quick-btn').count(),0,`${game}: no duplicate random panel or cramped legacy split shortcuts`);
    assert.equal(await page.locator('[data-act="homeRandomDeck"], .home-discovery-actions, .home-deck-section, .home-start').count(),0,'no discovery prompts, duplicated shelf on personal Home');
    assert.equal(await page.locator('[data-home-resume]').getAttribute('data-resume-deck'),`saved-${game}`);
    assert.equal(await page.locator('[data-home-resume] button').getAttribute('data-to'),`#${game==='mtg'?'deck':'tdeck'}/saved-${game}/cards`);
    const order=await page.locator('#content > *').evaluateAll(nodes=>nodes.filter(n=>!n.classList.contains('home-sr-only')).map(n=>n.className));
    assert(order[0].includes('home-art-header'),'approved artwork leads Home');
    assert.deepEqual(order.slice(1),['home-overview home-value-overview','home-resume','home-meta','home-editorial'],'personal information follows the restored header');
    assert.equal(await page.locator('#homeQ').count(),1,'one real search entry across responsive placements');
    assert.equal(await page.locator('.home-value-main strong').innerText(), '$25.00');
    assert.match(await page.locator('.home-value-note').innerText(), /Known subtotal.*1 unpriced/);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: viewportHeight(width) });
      await page.evaluate(() => scrollTo(0, 0));
      await assertSelected(page, game);
      await visibleHeaderArt(page);
      await assertDailyIdentity(page, game);
      await assertCommunityArtwork(page, '.community-feature', game, { kind: 'publisher' });
      await assertCommunityArtwork(page, `[data-home-meta="${game}"]`, game);
      await assertReadableArtwork(page, game);
      await noOverflow(page, `${game} at ${width}px`);
      const discoveryWidth=await page.locator('[data-home-discovery]').evaluate(n=>n.getBoundingClientRect().width);
      const valueWidth=await page.locator('[data-home-value]').evaluate(n=>n.getBoundingClientRect().width);
      assert(discoveryWidth>=valueWidth-2,`${game}: discovery stays full width at ${width}px`);
      for(const selector of ['[data-home-resume] button','.hh-credit']) {
        const action=page.locator(selector);await action.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await action.focus();
        assert(await action.evaluate(n=>{const r=n.getBoundingClientRect();return r.height>=44&&r.width>=44&&n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),`${game}: companion action is readable and directly hittable at ${width}px`);
      }
      await accessibleCarouselControls(page, `${game} at ${width}px`);
      await page.evaluate(() => scrollTo(0, 0));
      if (EVIDENCE_WIDTHS.has(width)) await page.screenshot({ path: resolve(RESULTS, `home-${game}-${width}.png`), fullPage: true, animations: 'disabled' });
    }
    for(const viewport of ORIENTATIONS) {
      await page.setViewportSize({width:viewport.width,height:viewport.height});
      await noOverflow(page,`${game} ${viewport.label}`);
      for(const selector of ['[data-home-resume] button','.hh-credit','.home-value-main']) {
        const action=page.locator(selector);await action.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await action.focus();
        assert(await action.evaluate(n=>{const r=n.getBoundingClientRect();return r.height>=44&&n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),`${game}: ${viewport.label} action unobscured`);
      }
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:resolve(RESULTS,`home-discovery-${game}-${viewport.label}-${viewport.width}x${viewport.height}.png`),fullPage:true,animations:'disabled'});
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const hero = heroes[game];
    const value = hero.id;
    for (const selector of ['.hh-credit']) {
      assert.equal(await page.locator(selector).getAttribute('data-id'), value);
      await page.locator(selector).click();
      await page.waitForFunction(({ game, value }) => { const c = window.__homeTestState.ui.sheetCtx; return game === 'mtg' ? c?.type === 'card' && c.print?.id === value : c?.type === 'tcard' && c.id === value; }, { game, value });
      assert.match(await page.locator('#sheetBody').innerText(), new RegExp(hero.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      await closeSheet(page);
    }
    await assertDailyIdentity(page, game);
    assert.notEqual(hero.id, seeds[game].id, 'fixture daily card is deliberately different from the saved deck lead');
    report.push(`${game}: all ${WIDTHS.length} widths; visible header, approved news and lower Meta artwork; exact daily printing actions unaffected by saved decks; partial value`);
  }
  await selectGame(page, 'mtg');
  for (const [from, key, to] of [['mtg', 'ArrowRight', 'ygo'], ['ygo', 'ArrowRight', 'ptcg'], ['ptcg', 'ArrowRight', 'mtg'], ['mtg', 'ArrowLeft', 'ptcg'], ['ptcg', 'Home', 'mtg'], ['mtg', 'End', 'ptcg']]) {
    await page.locator(`#game-tab-${from}`).focus();
    await page.keyboard.press(key);
    await assertSelected(page, to);
    assert.equal(await page.locator(`#game-tab-${to}`).evaluate(n => n === document.activeElement), true, 'keyboard keeps focus on the selected tab');
  }
  for (const [from, to] of [['mtg', 'ygo'], ['ygo', 'ptcg'], ['ptcg', 'mtg']]) {
    await selectGame(page, from);
    await touchSwipe(page, '.home-value');
    await assertSelected(page, to);
  }
  await touchSwipe(page, '.home-value', 150);
  await assertSelected(page, 'ptcg');
  await touchSwipe(page, '.home-value', -20, 150);
  await assertSelected(page, 'ptcg');

  for (const game of GAME_IDS) {
    await selectGame(page, game);
    const article = page.locator('.community-stage .community-feature').first();
    assert.match(await article.getAttribute('class'), /feature-news/);
    assert.equal(await article.locator('time').getAttribute('datetime'), '2026-10-16');
    await safeSourceLink(article, game);
    const firstId = await article.getAttribute('data-slide-id');
    const selectedDeck=page.locator('.home-meta-card');
    const metaLabel=`Top Meta · ${game==='mtg'?DEFAULT_MTG_META_FORMAT:game==='ygo'?'TCG':'Standard'} · Published list`;
    const metaEyebrow=selectedDeck.locator('.home-meta-copy > .eyebrow');
    assert.equal(await metaEyebrow.textContent(),metaLabel,'exact source label retains selected format and published-list metadata');
    assert.equal(await metaEyebrow.innerText(),metaLabel.toUpperCase(),'eyebrow CSS renders the same exact label in uppercase');
    assert.equal(await selectedDeck.locator('a.home-meta-original').getAttribute('href'), sources[game].deck);
    assert.equal(await selectedDeck.locator('time').getAttribute('datetime'), '2026-10-15');
    assert.match(await selectedDeck.innerText(), game === 'ygo' ? /List submitted/ : /Event date/);
    await safeSourceLink(selectedDeck, game, 'a.home-meta-original');
    for (const width of EVIDENCE_WIDTHS) {
      await page.setViewportSize({ width, height: viewportHeight(width) });
      await assertCommunityArtwork(page, '.community-feature', game, { kind:'publisher' });
      await assertCommunityArtwork(page, `[data-home-meta="${game}"]`, game);
      await assertReadableArtwork(page, game);
      await noOverflow(page, `${game} selected-deck art at ${width}px`);
      await accessibleCarouselControls(page, `${game} selected-deck art at ${width}px`);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: resolve(RESULTS, `home-discovery-${game}-${width}.png`), fullPage: true, animations: 'disabled' });
    }
    await page.setViewportSize({ width: 390, height: 1100 });
    const visibleRows=page.locator('.community-stage .community-feature');
    assert.equal(await visibleRows.count(),3,'three compact rows share the first page');
    if(game==='ygo'){
      const event=page.locator('.community-feature.feature-event');
      assert.deepEqual(await event.locator('time').evaluateAll(nodes=>nodes.map(n=>n.dateTime)),['2026-10-20','2026-10-22']);
      await safeSourceLink(event,game);
    }
    await touchSwipe(page, '.community-feature-copy');await assertSelected(page, game);
    const secondPageId=await article.getAttribute('data-slide-id');assert.notEqual(secondPageId,firstId);
    for(const width of [700,768,1024,390]){
      await page.setViewportSize({width,height:viewportHeight(width)});await assertSelected(page,game);
      assert.equal(await article.getAttribute('data-slide-id'),secondPageId,'same-mounted resize preserves the exact selected news page');
      await noOverflow(page,`${game} resized news page ${width}`);await accessibleCarouselControls(page,`${game} page controls ${width}`);
    }
    await page.locator('[data-community-step="1"]').focus();await page.keyboard.press('ArrowLeft');
    assert.equal(await article.getAttribute('data-slide-id'),firstId);await assertSelected(page,game);
    assert(await page.locator('[data-community-step="1"]').evaluate(n=>n===document.activeElement),'stable page arrow keeps focus');
    await article.locator('.community-open').focus();await page.keyboard.press('ArrowRight');
    assert.equal(await article.getAttribute('data-slide-id'),secondPageId);
    assert(await article.locator('.community-open').evaluate(n=>n===document.activeElement),'keyboard from a headline moves focus to the new page, not a detached link');
    const links=page.locator('.community-feature.feature-link');
    for(let i=0;i<await links.count();i++){assert.match(await links.nth(i).innerText(),/Source link · not a live headline/);assert.equal(await links.nth(i).locator('time').count(),0);await safeSourceLink(links.nth(i),game);}
    assert.doesNotMatch(await page.locator('#content').innerText(),/UNSAFE FIXTURE|UNTRUSTED FIXTURE/);
    await page.locator('[data-community-step="1"]').click();assert.equal(await article.getAttribute('data-slide-id'),firstId,'manual pages wrap predictably');
  }
  // Actual persistence is read, not reconstructed by a fake render helper.
  await selectGame(page, 'ygo');
  await page.reload();
  await page.locator('#app.ready').waitFor();
  await preloadTestState(page);
  await assertSelected(page, 'ygo');
  assert.equal(await page.locator('.home-value-main strong').innerText(), '$25.00');
  app.health();
  await app.close();
  report.push('All-game tab clicks, keyboard focus/wrap, game swipe, isolated carousel touch/keyboard, safe links/dates, resize and durable reload');

  // Fresh cached daily identities, not text patched into a test-only renderer.
  // Check both real crop markup and the independent name-without-art fallback.
  for(const scenario of [{},{dailyArtMode:'missing'},{longDailyNames:true},{longDailyNames:true,dailyArtMode:'missing'},{oversizeDailyName:true},{oversizeDailyName:true,dailyArtMode:'missing'}]){
    const daily=await openApp({...scenario,width:390,reducedMotion:'reduce'}),p=daily.page;
    for(const game of scenario.oversizeDailyName?['mtg']:GAME_IDS){
      await selectGame(p,game);
      if(scenario.dailyArtMode==='missing')assert.equal(await p.locator('#homeHero .hh-art').count(),0);
      else await visibleHeaderArt(p);
      await p.locator('.hh-credit').focus();
      const mounted=await p.evaluateHandle(()=>({hero:document.querySelector('#homeHero'),action:document.querySelector('.hh-credit'),art:document.querySelector('#homeHero .hh-art')}));
      for(const width of [320,390,600,700,768,899,900,1024,1440,2560,390]){
        await p.setViewportSize({width,height:viewportHeight(width)});
        await noOverflow(p,`${game} ${scenario.longDailyNames?'long':'normal'} daily ${scenario.dailyArtMode||'ready'} at ${width}px`);
        const card=scenario.oversizeDailyName?oversizeDailyPick:(scenario.longDailyNames?longDailyPicks:heroes)[game];
        await assertDailyIdentity(p,game,card,TODAY,{compact:!scenario.longDailyNames&&!scenario.oversizeDailyName,allowOversizeWord:!!scenario.oversizeDailyName});
        assert(await mounted.evaluate(s=>s.hero===document.querySelector('#homeHero')&&s.action===document.querySelector('.hh-credit')&&s.art===document.querySelector('#homeHero .hh-art')&&document.activeElement===s.action),'daily identity, crop and keyboard focus survive the same-mounted responsive sequence');
        if(scenario.dailyArtMode==='missing')assert.equal(await p.locator('.hh-credit').evaluate(n=>getComputedStyle(n).paddingLeft),'18px','no-art identity does not reserve an empty thumbnail column');
      }
      await mounted.dispose();
    }
    await daily.close();
  }
  report.push('All games: normal and longer actual daily titles retain complete words, exact accessible identity, unobscured thumbnails and focused same-mounted controls across 320–2560px, including 600/700/768/899/900px and no-art fallback; an exceptional single-token Magic name wraps only if wider than its reading column');

  for(const game of GAME_IDS){
    const work=await openApp({game,twoSavedDecks:true,noWorkHistory:true}),p=work.page;
    assert.equal(await p.locator('[data-resume-deck]').count(),0,'unrecorded/created decks are not claimed as last-worked');
    assert.match(await p.locator('[data-home-resume]').innerText(),/Choose a deck/);
    const route=`#${game==='mtg'?'deck':'tdeck'}/saved-${game}/cards`;
    await p.evaluate(route=>{location.hash=route;},route);
    await p.waitForFunction(game=>document.body.dataset.view===(game==='mtg'?'deck':'tdeck')&&window.__homeTestState.ui[game==='mtg'?'deckId':'tdeckId']===`saved-${game}`,game);
    await p.locator(`[data-act="${game==='mtg'?'deckMenu':'tDeckMenu'}"]`).first().click();
    await p.locator(game==='mtg'?'#dmName':'#tDmName').fill(`${game.toUpperCase()} edited older deck`);
    await p.locator(`[data-act="${game==='mtg'?'deckSaveInfo':'tDeckSave'}"]`).click();
    await p.waitForFunction(()=>!document.querySelector('#sheet').open);
    await p.evaluate(()=>{location.hash='#home';});await p.waitForFunction(()=>document.body.dataset.view==='home');await assertSelected(p,game);
    assert.equal(await p.locator('[data-home-resume]').getAttribute('data-resume-deck'),`saved-${game}`,'real saved edit beats newer array order');
    assert.match(await p.locator('[data-home-resume]').innerText(),/edited older deck/);
    assert.equal(await p.locator('[data-home-resume] button').getAttribute('data-to'),route);
    await p.locator('[data-home-resume] button').click();
    await p.waitForFunction(({game,route})=>location.hash===route&&document.body.dataset.view===(game==='mtg'?'deck':'tdeck')&&window.__homeTestState.ui[game==='mtg'?'deckId':'tdeckId']===`saved-${game}`,{game,route});
    await p.evaluate(game=>{location.hash=`#${game==='mtg'?'deck':'tdeck'}/newest-${game}/cards`;},game);
    await p.waitForFunction(game=>location.hash.includes(`newest-${game}`)&&document.body.dataset.view===(game==='mtg'?'deck':'tdeck')&&window.__homeTestState.ui[game==='mtg'?'deckId':'tdeckId']===`newest-${game}`,game);
    await p.evaluate(()=>{location.hash='#home';});await assertSelected(p,game);
    assert.equal(await p.locator('[data-home-resume]').getAttribute('data-resume-deck'),`saved-${game}`,'opening another deck is not a successful edit');
    await p.reload();await p.locator('#app.ready').waitFor();await preloadTestState(p);await assertSelected(p,game);
    assert.equal(await p.locator('[data-home-resume]').getAttribute('data-resume-deck'),`saved-${game}`,'successful work survives durable reload');
    assert.equal(await p.locator('[data-home-resume] button').getAttribute('data-to'),route);
    await work.close();
  }
  report.push('All games: actual older-deck edit/save → truthful resume → exact deck route → unrelated open unchanged → durable reload; no newest-deck inference');

  const unknown = await openApp({ unpriced: true, decks: false, emptyFeed: true });
  for (const game of GAME_IDS) {
    await selectGame(unknown.page, game);
    assert.equal(await unknown.page.locator('.home-value-main strong').innerText(), '—');
    assert.match(await unknown.page.locator('.home-value-note').innerText(), /3 unpriced/);
    assert.doesNotMatch(await unknown.page.locator('.home-value-main').innerText(), /\$0/);
    await visibleHeaderArt(unknown.page);
    assert.match(await unknown.page.locator('.hh-credit').innerText(), /Card of the Day/i);
    assert.equal(await unknown.page.locator('.hh-deck-link').count(), 0);
    assert((await unknown.page.locator('.community-feature.feature-link').count()) >= 2);
    assert.equal(await unknown.page.locator('.community-feature time').count(), 0);
    for(const width of EVIDENCE_WIDTHS){
      await unknown.page.setViewportSize({width,height:viewportHeight(width)});
      await assertDailyIdentity(unknown.page,game);
      await noOverflow(unknown.page,`${game} no decks/unpriced/unavailable sources at ${width}px`);
      await unknown.page.evaluate(()=>scrollTo(0,0));
      await unknown.page.screenshot({path:resolve(RESULTS,`home-empty-${game}-${width}.png`),fullPage:true,animations:'disabled'});
    }
  }
  await unknown.close();
  const noDaily = await openApp({heroDate:'2026-10-16',dailyUnavailable:true,width:1024});
  for(const game of GAME_IDS){
    await selectGame(noDaily.page,game);
    await noDaily.page.waitForFunction(()=>!document.querySelector('.hh-credit'));
    assert.equal(await noDaily.page.locator('#homeQ').isVisible(),true,'search remains usable when daily art is unavailable');
    assert.equal(await noDaily.page.locator('#homeHero .hh-art').count(),0,'no invented artwork for unavailable daily identity');
    for(const width of EVIDENCE_WIDTHS){
      await noDaily.page.setViewportSize({width,height:viewportHeight(width)});
      const sizes=await noDaily.page.locator('.home-overview').evaluate(n=>({overview:n.clientWidth,value:n.querySelector('.home-value').getBoundingClientRect().width}));
      assert(sizes.value>=sizes.overview-2,'without a daily result the value uses the entire overview, not an empty second column');
      await noOverflow(noDaily.page,`${game} missing daily pick ${width}`);
      await noDaily.page.evaluate(()=>scrollTo(0,0));
      await noDaily.page.screenshot({path:resolve(RESULTS,`home-no-daily-${game}-${width}.png`),fullPage:true,animations:'disabled'});
    }
  }
  await noDaily.close();
  const fetched = await openApp({ fetchFeed: true, timezoneId: 'America/Los_Angeles' });
  await fetched.page.locator('.community-feature.feature-news').first().waitFor();
  assert(fetched.requests.some(url => url.includes('/api/community?game=mtg')), 'uncached feed uses the real fetch/refresh integration');
  assert.match(await fetched.page.locator('.community-feature time').first().innerText(), /Oct 16, 2026/, 'date-only source dates do not shift in a western timezone');
  await fetched.close();
  report.push('All-unpriced is not $0; independent daily art; unavailable-source disclosure; real feed refresh; western-timezone date integrity');

  // Exact article metadata and selected-list provenance stay distinct from the
  // cached daily card. Unknown or missing art is an openly labelled game theme.
  for (const scenario of [
    { name: 'missing', newsArtMode: 'missing', deckArtMode: 'missing' },
    { name: 'unsafe-host', newsArtMode: 'unsafe', deckArtMode: 'unsafe' },
    { name: 'unsafe-script', newsArtMode: 'unsafe', deckArtMode: 'unsafe', unsafeImage: 'javascript:globalThis.__unsafeHomeArtExecuted=true' },
    { name: 'unsafe-data', newsArtMode: 'unsafe', deckArtMode: 'unsafe', unsafeImage: 'data:image/svg+xml,<svg onload="globalThis.__unsafeHomeArtExecuted=true"/>' },
    { name: 'unsafe-credentials', newsArtMode: 'unsafe', deckArtMode: 'unsafe', unsafeImage: 'https://assets.pokemon.com@not-a-publisher.invalid/tracking.jpg' },
    { name: 'decode-failure', failCommunityImages: true },
  ]) {
    const fallback = await openApp({ ...scenario, width: 390 });
    const failed = !!scenario.failCommunityImages;
    for (const game of GAME_IDS) {
      await selectGame(fallback.page, game);
      await assertDailyIdentity(fallback.page, game);
      await assertNoNewsArtwork(fallback.page, '.community-feature', { failed });
      await assertCommunityArtwork(fallback.page, `[data-home-meta="${game}"]`, game, { kind: failed ? 'card' : 'theme', state: 'missing' });
      assert.match(await fallback.page.locator('[data-home-discovery] .community-art-fallback').innerText(), /Game theme · deck art unavailable/);
      await noOverflow(fallback.page, `${game}: ${scenario.name} art fallback`);
      await accessibleCarouselControls(fallback.page, `${game}: ${scenario.name} art fallback`);
      if (['missing', 'unsafe-host', 'decode-failure'].includes(scenario.name)) await fallback.page.screenshot({ path: resolve(RESULTS, `home-art-${game}-${scenario.name}-390.png`), fullPage: true, animations: 'disabled' });
    }
    assert.equal(await fallback.page.evaluate(() => !!window.__unsafeHomeArtExecuted), false);
    assert(!fallback.requests.some(url => url.includes('not-a-publisher.invalid')), 'unapproved URL is never requested, even in a failing render');
    await fallback.close();
  }
  report.push('All games: successful, missing, decode-failed and unsafe art states; exact provider allowlists; no unsafe URL requests; honest visible fallback and no broken image glyphs');

  const alternating = await openApp({ twoDecks: true, width: 390, reducedMotion: 'reduce' });
  for (const game of GAME_IDS) {
    await selectGame(alternating.page, game);
    const rail=`[data-home-meta="${game}"]`;
    await assertCommunityArtwork(alternating.page, rail, game);
    await alternating.page.locator('[data-meta-step="1"]').focus();
    await alternating.page.keyboard.press('ArrowRight');
    await assertSelected(alternating.page, game);
    await assertCommunityArtwork(alternating.page, rail, game, { second:true });
    assert.equal(await alternating.page.locator('.home-meta-original').getAttribute('href'), `${sources[game].deck}-second`);
    assert.equal(await alternating.page.locator('[data-meta-step="1"]').evaluate(n=>n===document.activeElement),true,'changing selected-list art preserves control focus');
    assert.equal(await alternating.page.locator('.community-feature.feature-deck').count(),0,'news does not duplicate deck discovery');
    await alternating.page.locator('[data-home-resume] button').focus();
    await alternating.page.evaluate(()=>{window.__foldHome={rail:document.querySelector('[data-home-meta]'),opener:document.querySelector('[data-home-meta-open]'),value:document.querySelector('.home-value-main'),resume:document.querySelector('[data-home-resume] button'),key:document.querySelector('.home-meta-card').dataset.metaDeck,source:document.querySelector('.home-meta-original').href};});
    for(const viewport of FOLD_SEQUENCE) {
      await alternating.page.setViewportSize(viewport);await assertSelected(alternating.page,game);
      assert(await alternating.page.evaluate(()=>{const s=window.__foldHome;return s.rail===document.querySelector('[data-home-meta]')&&s.opener===document.querySelector('[data-home-meta-open]')&&s.value===document.querySelector('.home-value-main')&&s.resume===document.querySelector('[data-home-resume] button')&&s.key===document.querySelector('.home-meta-card').dataset.metaDeck&&s.source===document.querySelector('.home-meta-original').href;}),'fold/unfold keeps the exact mounted rail, visible list/source, value and resume nodes');
      assert(await alternating.page.locator('[data-home-resume] button').evaluate(n=>n===document.activeElement),'same mounted resume focus survives resize');
      await noOverflow(alternating.page,`${game} same-mount fold ${viewport.width}x${viewport.height}`);
    }
    await touchSwipe(alternating.page, '.home-meta-copy', 150);
    await assertSelected(alternating.page, game);
    await assertCommunityArtwork(alternating.page, rail, game);
    await alternating.page.locator(`[data-home-meta="${game}"] [data-to="#decks/inspiration"]`).focus();
    await alternating.page.keyboard.press('Enter');
    await alternating.page.waitForFunction(() => location.hash === '#decks/inspiration');
    await alternating.page.locator('.brand-home').click();
    await alternating.page.waitForFunction(() => location.hash === '#home' && document.body.dataset.view === 'home');
    await assertSelected(alternating.page, game);
  }
  await alternating.close();
  report.push('Unified discovery changes to each exact verified deck/source, with no duplicate news deck slide; keyboard/focus/swipe and Meta navigation remain isolated from game changes');

  // The compact Meta rail has its own timer and exact deck actions. All provider
  // data/art stay synthetic and source-bound; these are not live rankings.
  const metaRail = await openApp({ twoDecks: true, width: 390, clock: true });
  for (const game of GAME_IDS) {
    const p = metaRail.page;
    await selectGame(p, game);
    await p.clock.fastForward(3000); // finish the existing emblem warm-up first
    const rail = p.locator(`[data-home-meta="${game}"]`), stage = rail.locator('.home-meta-card');
    await rail.scrollIntoViewIfNeeded();
    assert.equal(await rail.locator('[data-home-meta-open]').getAttribute('data-act'), game === 'mtg' ? 'mtgProven' : 'tMetaDeck');
    assert.equal(await rail.locator('.home-meta-original').getAttribute('href'), sources[game].deck);
    assert.match(await rail.innerText(), game === 'ygo' ? /List submitted/ : /Event date/);
    await p.mouse.move(1, 1); await p.evaluate(() => document.activeElement?.blur());
    const initial = await stage.getAttribute('data-meta-deck');
    await p.clock.fastForward(8200);
    assert.notEqual(await stage.getAttribute('data-meta-deck'), initial, `${game}: automatic Meta slideshow advances`);
    const arrow = rail.locator('[data-meta-step="1"]');
    await arrow.focus(); const focusedArrow = await arrow.elementHandle();
    const stopped = await stage.getAttribute('data-meta-deck');
    await p.clock.fastForward(17000);
    assert.equal(await stage.getAttribute('data-meta-deck'), stopped, 'focus pauses automatic changes');
    await p.keyboard.press('ArrowRight');
    assert.notEqual(await stage.getAttribute('data-meta-deck'), stopped);
    assert(await focusedArrow.evaluate(n => n.isConnected && n === document.activeElement), 'arrow focus survives manual rotation');
    await p.locator('[data-meta-toggle]').click();
    await p.evaluate(() => document.activeElement?.blur()); await p.mouse.move(1, 1);
    await p.clock.fastForward(8200);
    const afterResume = await stage.getAttribute('data-meta-deck');
    await rail.hover(); await p.clock.fastForward(17000);
    assert.equal(await stage.getAttribute('data-meta-deck'), afterResume, 'hover pauses without changing current game');
    await touchSwipe(p, '.home-meta-copy');
    await assertSelected(p, game);
    assert.equal(await p.locator('[data-meta-toggle]').innerText(), 'Resume', 'touch interaction requires explicit resume');
    const exactKey = await rail.locator('[data-home-meta-open]').getAttribute('data-key');
    await rail.locator('[data-home-meta-open]').click();
    await p.waitForFunction(key => window.__homeTestState.ui.sheetCtx?.type === 'proven' && window.__homeTestState.ui.sheetCtx.key === key, exactKey);
    await closeSheet(p); await assertSelected(p, game);
    const oldSource = await rail.locator('.home-meta-original').getAttribute('href');
    await rail.locator('[data-home-meta-open]').focus();
    const retainedOpener=await rail.locator('[data-home-meta-open]').elementHandle();
    const retainedKey=await retainedOpener.getAttribute('data-key');
    const retainedTitle=await retainedOpener.innerText();
    await p.evaluate(async game => {
      const { metaState } = await import('/meta.js'), ui = await import('/home-ui.js');
      const state = metaState(ui.homeMetaKey(game)), row = structuredClone(state.data.decks[0]);
      row.key = `fixture-${game}-replacement`; row.name += ' replacement'; row.url += '-replacement';
      state.data = { ...state.data, decks: [row] };
      ui.refreshHomeMeta(game, document.querySelector(`[data-home-meta="${game}"]`));
    }, game);
    assert(await retainedOpener.evaluate(n=>n.isConnected && n===document.activeElement),'cache replacement preserves the exact focused opener');
    assert.equal(await rail.locator('.home-meta-original').getAttribute('href'),oldSource);
    await p.keyboard.press('Enter');
    await p.waitForFunction(key=>window.__homeTestState.ui.sheetCtx?.type==='proven' && window.__homeTestState.ui.sheetCtx.key===key,retainedKey);
    assert.equal(await p.locator('#sheetBody .sheet-actions a').filter({hasText:game==='mtg'?'Magic Online event':game==='ygo'?'YGOPRODeck':'Limitless'}).first().getAttribute('href'),oldSource,'retained exact list opens its original verified source');
    assert((await p.locator('#sheetBody').innerText()).includes(retainedTitle.replace(/\s*↗\s*$/,'')));
    if(game!=='mtg') {
      const captured=await p.evaluate(async()=>{const {proven}=await import('/tcg.js');return {token:proven.spec.buildMeta.token,source:proven.spec.buildMeta.data.source,keys:proven.spec.buildMeta.data.decks.map(d=>d.key)};});
      assert.equal(await p.locator('#sheetBody [data-act="tMetaBuild"]').getAttribute('data-proven-build'),captured.token);
      // Moving into the inspector permits Home to adopt its new snapshot. That
      // must not revoke or silently redirect the inspector's exact build action.
      await p.clock.fastForward(1);
      await p.waitForFunction(game=>document.querySelector('[data-home-meta-open]')?.dataset.key===`fixture-${game}-replacement`,game);
      await p.locator('#sheetBody [data-act="tMetaBuild"]').click();
      await p.waitForFunction(({game,key})=>window.__homeTestState.ui.sheetCtx?.type==='tbuild' && window.__homeTestState.ui.tbuild?.game===game && window.__homeTestState.ui.tbuild?.metaKey===key,{game,key:retainedKey});
      const built=await p.evaluate(()=>{const B=window.__homeTestState.ui.tbuild;return {game:B.metaSnapshot.game,source:B.metaSnapshot.data.source,keys:B.metaSnapshot.data.decks.map(d=>d.key)};});
      assert.deepEqual(built,{game,source:captured.source,keys:captured.keys},'downstream builder retains original exact source dataset after rail replacement');
    }
    await closeSheet(p);
    // Explicit close/cancel keeps the old list valid until focus is released.
    await p.evaluate(() => document.activeElement?.blur()); await p.clock.fastForward(1);
    await p.waitForFunction(game => document.querySelector(`[data-home-meta="${game}"] .home-meta-card`)?.dataset.metaDeck === `fixture-${game}-replacement`, game);
    assert.notEqual(await rail.locator('.home-meta-original').getAttribute('href'), oldSource);
    assert(await retainedOpener.evaluate(n=>!n.isConnected));
    const newSource=await rail.locator('.home-meta-original').getAttribute('href');
    await rail.locator('[data-home-meta-open]').click();
    await p.waitForFunction(game=>window.__homeTestState.ui.sheetCtx?.key===`fixture-${game}-replacement`,game);
    assert.equal(await p.locator('#sheetBody .sheet-actions a').filter({hasText:game==='mtg'?'Magic Online event':game==='ygo'?'YGOPRODeck':'Limitless'}).first().getAttribute('href'),newSource);
    await closeSheet(p);await retainedOpener.dispose();
    assert.equal(await rail.locator('[data-meta-step="1"]').isDisabled(), true, 'one fresh list replaces the old rotation');
    for (const width of WIDTHS) { await p.setViewportSize({ width, height: 1100 }); await noOverflow(p, `${game} compact Meta controls ${width}`); }
    await focusedArrow.dispose();
  }
  await metaRail.close();
  report.push('All games: automatic compact Meta rotation, explicit resume, focus/hover/touch pause, stable control focus, exact actual deck actions, new snapshot replaces old lists, source/date identity and controls at 320–2560px');

  // Advance the actual clock in an already-running application, not a renderer
  // facsimile. Each game must independently replace yesterday's in-memory and
  // persistent daily card, without borrowing another game's delayed response.
  const rollover = await openApp({ width: 390 });
  const originalInventory = await inventorySnapshot(rollover.page);
  for (const game of GAME_IDS) { await selectGame(rollover.page, game); await assertDailyIdentity(rollover.page, game); }
  const delayedDaily = rollover.holdSelection();
  await rollover.page.evaluate(() => { window.__homeTimeAdvance = 86400000; });
  await selectGame(rollover.page, 'mtg');
  await Promise.race([delayedDaily.seen, new Promise((_, reject) => setTimeout(() => reject(Error('Rollover daily-card request was not observed')), 15000))]);
  await selectGame(rollover.page, 'ygo');
  await rollover.page.waitForFunction(id => document.querySelector('.hh-credit')?.dataset.id === id, seeds.ygo.id);
  delayedDaily.release();
  await rollover.page.waitForFunction(id => JSON.parse(localStorage.getItem('cardforge-hero-v2'))?.mtg?.id === id, seeds.mtg.id);
  await assertDailyIdentity(rollover.page, 'ygo', seeds.ygo, '2026-10-18');
  await assertSelected(rollover.page, 'ygo');
  for (const game of GAME_IDS) {
    await selectGame(rollover.page, game);
    await rollover.page.waitForFunction(({ game, id }) => {
      const hero = document.querySelector('#homeHero'), credit = hero?.querySelector('.hh-credit');
      return hero?.dataset.game === game && credit?.dataset.id === id && credit?.dataset.date === '2026-10-18';
    }, { game, id: seeds[game].id });
    await assertDailyIdentity(rollover.page, game, seeds[game], '2026-10-18');
    await visibleHeaderArt(rollover.page);
    const stored = await rollover.page.evaluate(() => JSON.parse(localStorage.getItem('cardforge-hero-v2')));
    assert.equal(stored.date, '2026-10-18');
    assert.equal(stored[game].id, seeds[game].id);
    assert.equal(stored[game].game, game);
    assert.equal(stored[game].date, '2026-10-18');
  }
  assert.equal(await inventorySnapshot(rollover.page), originalInventory, 'daily-card rollover never changes the owned collection or saved decks');
  const dailyCalls = rollover.requests.filter(line => /\/api\/daily-card\?game=/.test(line));
  assert.equal(dailyCalls.length, 3, 'one daily selection per game after New York rollover');
  for (const game of GAME_IDS) { await selectGame(rollover.page, game); await assertDailyIdentity(rollover.page, game, seeds[game], '2026-10-18'); }
  assert.equal(rollover.requests.filter(line => /\/api\/daily-card\?game=/.test(line)).length, 3, 'same-day navigation reuses each game’s own new daily card');
  await rollover.close();
  report.push('Open-session New York daily-card rollover, delayed previous-game response isolation, separate all-game storage identities, one fetch per game, same-day cache reuse and no ownership/deck mutation');

  for (const game of GAME_IDS) {
    const random = await openApp({ game });
    const before = await inventorySnapshot(random.page);
    await startReveal(random.page, game);
    await random.page.evaluate(()=>{window.__foldReveal={node:document.querySelector('.home-deck-reveal'),context:window.__homeTestState.ui.sheetCtx,decks:document.querySelector('#content'),opener:document.querySelector('[data-act="randomDeckOptions"]')};});
    for(const viewport of FOLD_SEQUENCE) {
      await random.page.setViewportSize(viewport);
      assert(await random.page.evaluate(()=>{const r=window.__foldReveal;return r.node===document.querySelector('.home-deck-reveal')&&r.context===window.__homeTestState.ui.sheetCtx&&r.decks===document.querySelector('#content')&&r.opener===document.querySelector('[data-act="randomDeckOptions"]');}),'resizing never restarts the random selection or remounts the Decks page behind it');
      assert.equal(await random.page.locator('.home-deck-reveal h3').innerText(),seeds[game].name);
      assert.equal(await random.page.locator('.home-reveal-fan img').getAttribute('alt'),seeds[game].name);
    }
    assert.equal(await inventorySnapshot(random.page), before, 'revealing and resizing a card does not create a deck or alter the collection');
    if (game === 'mtg') {
      const running = await random.page.evaluate(async () => {
        const { S } = await import('/store.js');
        Object.assign(S.ui.build, { busy: true, seed: 'Previous running card', format: 'Modern', results: { Modern: [{ marker: 'do not replace' }] } });
        return JSON.stringify(S.ui.build);
      });
      await random.page.locator('[data-act="homeBuildReveal"]').click();
      assert.equal(await random.page.evaluate(async () => JSON.stringify((await import('/store.js')).S.ui.build)), running, 'in-flight Magic build state is never relabelled or discarded');
      assert.equal(await random.page.locator('.home-deck-reveal h3').innerText(), seeds.mtg.name, 'pending real card remains visible and retryable');
      assert.match(await random.page.locator('#toast').innerText(), /still running/);
      await random.page.evaluate(async () => { (await import('/store.js')).S.ui.build.busy = false; });
    }
    await random.page.locator('[data-act="homeBuildReveal"]').click();
    await random.page.waitForFunction(({ game, seed }) => {
      const S = window.__homeTestState;
      return game === 'mtg' ? S.ui.sheetCtx?.type === 'build' && S.ui.build.seed === seed.name && S.ui.build.format === 'Standard'
        : S.ui.sheetCtx?.type === 'tbuild' && S.ui.tbuild.seed === seed.id && S.ui.tbuild.format === (game === 'ygo' ? 'tcg' : 'standard');
    }, { game, seed: seeds[game] });
    assert.equal(await inventorySnapshot(random.page), before, 'builder handoff is still an unsaved plan');
    await random.close();
  }
  const cancel = await openApp();
  await openDeckRandom(cancel.page);
  await chooseFormat(cancel.page, 'mtg');
  const held = cancel.holdSelection();
  await cancel.page.locator('[data-act="randomDeckStart"]').click();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Random provider request was not observed')), 15000);
    held.seen.then(() => { clearTimeout(timer); resolve(); }, reject);
  });
  await closeSheet(cancel.page);
  await cancel.page.locator('#game-tab-ptcg').click();
  await cancel.page.waitForFunction(()=>document.body.dataset.game==='ptcg');
  held.release();
  await cancel.page.waitForFunction(() => window.__homeTestState.catalog['llanowar elves']?.checkedAt > '2026-10-17T12:00:00.000Z');
  await cancel.page.waitForTimeout(200);
  assert.equal(await cancel.page.locator('.home-deck-reveal').count(), 0, 'late response cannot reveal across closed picker/game navigation');
  assert.equal(await cancel.page.locator('#game-tab-ptcg').getAttribute('aria-selected'),'true');
  await cancel.close();
  report.push('All-game explicit format → real provider-selected card → same seed/format builder, with no inventory mutation; busy Magic build preserved/retryable; late selection cancelled');

  const reduced = await openApp({ reducedMotion: 'reduce', width: 390, twoDecks: true, clock: true });
  await visibleHeaderArt(reduced.page);
  await assertCommunityArtwork(reduced.page, '.community-feature', 'mtg', { kind: 'publisher' });
  await assertCommunityArtwork(reduced.page, '[data-home-meta="mtg"]', 'mtg');
  const reducedKey = await reduced.page.locator('.home-meta-card').getAttribute('data-meta-deck');
  await reduced.page.clock.fastForward(20000);
  assert.equal(await reduced.page.locator('.home-meta-card').getAttribute('data-meta-deck'), reducedKey, 'reduced motion disables automatic slides');
  assert.equal(await reduced.page.locator('[data-meta-toggle]').isDisabled(), true);
  await reduced.page.locator('[data-meta-step="1"]').click();
  assert.notEqual(await reduced.page.locator('.home-meta-card').getAttribute('data-meta-deck'), reducedKey, 'reduced motion retains manual navigation');
  const artMotion = await reduced.page.locator('img[data-community-image]').evaluateAll(nodes => nodes.map(n => ({ transition: getComputedStyle(n).transitionDuration, animation: getComputedStyle(n).animationName })));
  assert(artMotion.length >= 2 && artMotion.every(n => n.transition === '0s' && n.animation === 'none'), 'reduced motion removes community and lower Meta artwork transitions');
  await reduced.page.screenshot({ path: resolve(RESULTS, 'home-mtg-390-reduced-motion.png'), fullPage: true, animations: 'disabled' });
  await startReveal(reduced.page, 'mtg');
  const animationNames = await reduced.page.locator('.home-reveal-fan > *').evaluateAll(nodes => nodes.map(n => getComputedStyle(n).animationName));
  assert(animationNames.length === 3 && animationNames.every(name => name === 'none'), 'reduced motion removes every reveal animation');
  await reduced.page.screenshot({ path: resolve(RESULTS, 'home-mtg-reveal-reduced-motion.png'), fullPage: true, animations: 'disabled' });
  await reduced.close();
  report.push('Reduced-motion Home and actual card reveal evidence, with all reveal animations disabled');
  await writeFile(resolve(RESULTS, 'home-browser-report.json'), JSON.stringify({ passed: true, widths: WIDTHS, games: GAME_IDS, screenshots: [...EVIDENCE_WIDTHS], orientations: ORIENTATIONS, statefulResize: FOLD_SEQUENCE, checks: report }, null, 2));
  console.log(`PASS: Home real-app regression\n${report.map(line => `  • ${line}`).join('\n')}`);
} catch (error) {
  await writeFile(resolve(RESULTS, 'home-browser-report.json'), JSON.stringify({ passed: false, completed: report, error: error.stack || String(error) }, null, 2));
  if (browser) for (const [index, context] of browser.contexts().entries()) for (const [p, page] of context.pages().entries()) {
    await page.screenshot({ path: resolve(RESULTS, `home-failure-${index}-${p}.png`), fullPage: true, animations: 'disabled' }).catch(() => {});
  }
  throw error;
} finally {
  if (browser) await browser.close();
  await new Promise(r => server.close(r));
}
