import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pokemonDeckCover, artworkSources, handleArtworkError } from './artwork.js';
import { S, blank } from './store.js';
import { blankGame } from './games.js';
import { cache, collectionGroups, metaState, tcgDecks } from './tcg.js';

// Supplied-list fixtures, NOT a capture of the current provider's tournament feed.
const pokemon = (name, set, number, qty = 2) => ({ name, set, number, qty, kind: 'Pokemon' });
const dhelmise = pokemon('Dhelmise V', 'SSH', '009');
const support = pokemon('Dedenne GX', 'UNB', '057', 4);
const descriptor = pokemonDeckCover({ name: 'Dhelmise', icons: ['dhelmise'], list: [support, dhelmise] });
assert.match(descriptor.imageLarge, /\/SSH\/SSH_009_R_EN\.png$/);
assert.deepEqual(descriptor.printing, { name: 'Dhelmise V', set: 'SSH', number: '009' });
assert.equal(descriptor.id, undefined, 'a source set code is not a guessed canonical card ID');
assert.equal(pokemonDeckCover(), null);
assert.equal(pokemonDeckCover({ name: 'Dhelmise', list: [support] }), null, 'support cards cannot masquerade as the namesake');
assert.equal(pokemonDeckCover({ name: 'Mewtwo', icons: ['mewtwo'], list: [pokemon('Mew', 'MEW', '151')] }), null, 'a substring is not the same species');
assert.equal(pokemonDeckCover({ name: 'Mew', list: [pokemon('Mew ex', 'MEW', '151')] }).name, 'Mew ex');
for (const icon of ['ogerpon', 'ogerpon-teal']) assert.equal(pokemonDeckCover({ name: 'Basic Box', icons: [icon, 'clefairy'], list: [pokemon('Clefairy', 'TWM', '78', 3), pokemon('Teal Mask Ogerpon ex', 'TWM', '25', 4), support] }).name, 'Teal Mask Ogerpon ex', 'supplied species and form icons identify generic archetypes');
for (const row of [null, { ...dhelmise, set: '' }, { ...dhelmise, number: '' }, { ...dhelmise, number: '0' }, { ...dhelmise, number: '../9' }, { ...dhelmise, qty: 0 }, { ...dhelmise, qty: Infinity }, { ...dhelmise, name: null }]) {
  assert.equal(pokemonDeckCover({ name: 'Dhelmise', list: [row] }), null);
}
assert.equal(pokemonDeckCover({ name: 'Dhelmise', list: {} }), null);

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
const winnerRows = [pokemon('Dragapult ex', 'TWM', '130', 3)];
const listOf = rows => ({ pokemon: rows.map(({ qty, ...r }) => ({ ...r, count: qty })), trainer: [], energy: [] });
const standings = [
  { placing: 1, player: 'winner', deck: { id: 'dragapult', name: 'Dragapult', icons: ['dragapult'] }, decklist: listOf(winnerRows) },
  { placing: 10, player: 'lower', deck: { id: 'dhelmise', name: 'Dhelmise', icons: ['dhelmise'] }, decklist: listOf([pokemon('Dhelmise V', 'SHF', '009')]) },
  { placing: 9, player: 'ninth', deck: { id: 'dhelmise', name: 'Dhelmise', icons: ['dhelmise'] }, decklist: listOf([support, dhelmise]) },
  { placing: 12, player: 'none', deck: { id: 'gholdengo', name: 'Gholdengo', icons: ['gholdengo'] } },
  { placing: 16, player: 'bad', deck: { id: 'bad', name: 'Malformed', icons: [] }, decklist: { pokemon: [null, { count: 2 }], trainer: {}, energy: [] } },
  null,
];
const fixtureFetch = async url => {
  if (String(url).includes('/standings')) return Response.json(standings);
  if (String(url).includes('/tournaments?')) return Response.json([{ id: 'fixture-event', name: 'Synthetic fixture event', date: new Date().toISOString(), players: 24 }]);
  throw Error('Unexpected fixture request: ' + url);
};
globalThis.fetch = fixtureFetch;
const { ptcgMeta } = await import('./meta.js');
const data = await ptcgMeta();
const arch = id => data.archetypes.find(a => a.id === id);
assert.equal(data.artSchema, 2);
assert.equal(data.decks.length, 1);
assert.equal(data.decks[0].key, 'ptcg:fixture-event:1');
assert.deepEqual(data.decks[0].list, winnerRows);
assert.deepEqual(data.top, [{ name: 'Dragapult ex', kind: 'Pokemon', pct: 100, avg: 3 }], 'lower-place art never changes Top-8 card statistics');
assert.equal(arch('dhelmise').top8, 0);
assert.equal(arch('dhelmise').best, '');
assert.equal(arch('dhelmise').count, 2);
assert.equal(arch('dhelmise').share, 2 / 5);
assert.equal(arch('dhelmise').cover.source.rank, 9, 'ranked selection is deterministic, not feed-row order');
assert.equal(arch('dhelmise').cover.source.eventId, 'fixture-event');
assert.deepEqual(arch('dhelmise').cover.printing, descriptor.printing);
assert.equal(arch('gholdengo').cover, null);
assert.equal(arch('bad').cover, null);
assert.equal(arch('dragapult').cover.imageLarge, pokemonDeckCover(data.decks[0]).imageLarge, 'existing best-deck artwork remains preferred');

// A fresh pre-artwork-schema cache gets one extra attempt across render, game
// switches AND module reload. Failure keeps its actual timestamp and data.
const old = { game: 'ptcg', archetypes: [], decks: [], top: [], source: 'Cached fixture' };
const at = Date.now();
storage.set('cardforge-meta-v1', JSON.stringify({ ptcg: { at, data: old }, ygo: { at, data: { game: 'ygo' } } }));
let requests = 0;
globalThis.fetch = async () => { requests++; throw Error('offline fixture'); };
const legacy = await import('./meta.js?deck-art-legacy');
assert.equal(legacy.metaNeedsRefresh('ptcg'), true);
assert.equal(legacy.metaNeedsRefresh('ygo'), false, 'other games do not need artwork-schema migration');
assert.deepEqual(await legacy.loadMeta('ptcg'), old);
assert.equal(legacy.metaState('ptcg').at, at);
assert.equal(legacy.metaNeedsRefresh('ptcg'), false);
await legacy.loadMeta('ptcg');
assert.equal(requests, 1, 'render or game switch does not retry a failed schema refresh');
const reloaded = await import('./meta.js?deck-art-reloaded');
assert.equal(reloaded.metaNeedsRefresh('ptcg'), false);
assert.deepEqual(await reloaded.loadMeta('ptcg'), old);
assert.equal(requests, 1, 'the failed attempt survives a page reload');
await reloaded.loadMeta('ptcg', true);
assert.equal(requests, 2, 'manual Refresh still permits retry');
assert.deepEqual(reloaded.metaState('ptcg').data, old);
assert.equal(reloaded.metaState('ptcg').at, at);
const current = await import('./meta.js?deck-art-current');
storage.set('cardforge-meta-v1', JSON.stringify({ ptcg: { at, data } }));
assert.equal(current.metaNeedsRefresh('ptcg'), false, 'no needless requests for current-schema caches');
assert.deepEqual(await current.loadMeta('ptcg'), data);
assert.equal(requests, 2);
storage.set('cardforge-meta-v1', JSON.stringify({ ptcg: { at, data: old } }));
let migrationRequests = 0;
globalThis.fetch = async url => { migrationRequests++; return fixtureFetch(url); };
const migrate = await import('./meta.js?deck-art-success');
const [freshA, freshB] = await Promise.all([migrate.loadMeta('ptcg'), migrate.loadMeta('ptcg')]);
assert.deepEqual(freshA, data);
assert.equal(freshA, freshB, 'simultaneous view loads share one request');
assert.equal(migrationRequests, 2, 'one tournaments request and one standings request');
assert.equal(migrate.metaNeedsRefresh('ptcg'), false);
const saved = JSON.parse(storage.get('cardforge-meta-v1')).ptcg;
assert.equal(saved.data.artSchema, 2);
assert.equal(saved.artRefreshAttempted, undefined, 'a successful new snapshot clears the old failure marker');
assert(saved.at >= at);
globalThis.fetch = async () => { throw Error('Unexpected render network request'); };

// Render from actual public app view functions; same collection identities and
// build IDs remain intact. No browser, provider or card-hydration requests.
S.state = { ...blank(), settings: { game: 'ptcg' }, tcg: { ptcg: blankGame(), ygo: blankGame() } };
S.ui.decksTab = 'inspiration';
Object.assign(metaState('ptcg'), { data, at, busy: false, error: '' });
const cachedExact = { game: 'ptcg', id: 'swsh1-9', name: 'Dhelmise V', image: 'https://fixture.test/exact-small.png', imageLarge: 'https://fixture.test/exact-large.png', set: { id: 'swsh1', abbreviation: { official: 'SSH' }, number: '009' } };
cache.ptcg[cachedExact.id] = structuredClone(cachedExact);
cache.ptcg['swsh45-9'] = { ...cachedExact, id: 'swsh45-9', imageLarge: 'https://fixture.test/wrong-printing.png', set: { id: 'swsh45', abbreviation: { official: 'SHF' }, number: '009' } };
const beforeCache = structuredClone(cache.ptcg);
const metaHTML = tcgDecks();
const tiles = [...metaHTML.matchAll(/<button class="arch [\s\S]*?<\/button>/g)].map(m => m[0]);
const dhelmiseTile = tiles.find(h => h.includes('>Dhelmise<'));
assert.match(dhelmiseTile, /data-key="ptcg:fixture-event:9"/);
assert.doesNotMatch(dhelmiseTile, / disabled/);
assert.equal(arch('dhelmise').representative.rank,9);
assert.match(dhelmiseTile, /0 in Top 8/);
assert.match(dhelmiseTile, /View list · Top 9/);
assert.match(dhelmiseTile, /SSH_009_R_EN/);
assert.match(dhelmiseTile, /exact-large\.png/);
assert.doesNotMatch(dhelmiseTile, /wrong-printing\.png/);
assert.match(tiles.find(h => h.includes('>Gholdengo<')), /arch-art-fallback/);
assert.deepEqual(cache.ptcg, beforeCache, 'cover enrichment never mutates cached printing identity');

const own = (id, name, extra = {}) => ({ game: 'ptcg', id, name, category: 'Pokemon', stage: 'Basic', prices: { usd: 1 }, imageLarge: `https://fixture.test/${id}.png`, ...extra });
const cards = [own('base1-35', 'Clefairy'), own('sv06-130', 'Dragapult ex'), own('sm3.5-78', 'Mewtwo GX'), own('owned-missing', 'Missing art', { imageLarge: '' }), own('sv06-078', 'Clefairy', { prices: { usd: 4 } })];
S.state.tcg.ptcg.collection = cards.map((c, i) => ({ id: 'owned' + i, cardId: c.id, name: c.name, qty: i + 1 }));
for (const c of cards) cache.ptcg[c.id] = c;
const groups = collectionGroups('ptcg'), identity = groups.map(x => [x.cover.id, x.ids.join(','), x.copies]);
S.ui.decksTab = 'ideas';
const ideasHTML = tcgDecks();
assert.match(ideasHTML, /class="collection-ideas-grid"/);
assert.equal((ideasHTML.match(/class="idea-row-art pk-crop/g) || []).length, groups.length);
assert.doesNotMatch(ideasHTML.split('Tournament decks')[0], /class="card-img"|class="lot-art"|data-tier=/);
for (const [id, ids, copies] of identity) {
  assert(ideasHTML.includes(`data-act="tCard" data-id="${id}" aria-label="View `));
  assert(ideasHTML.includes(`data-act="tBuildMulti" data-ids="${ids}"`));
  assert(ideasHTML.includes(`${copies} cop${copies === 1 ? 'y' : 'ies'}`));
}
assert.deepEqual(collectionGroups('ptcg').map(x => [x.cover.id, x.ids.join(','), x.copies]), identity);
const withoutExactImage = artworkSources({ game: 'ptcg', id: 'owned-missing' });
let appended = '';
const failedImage = { dataset: { artSources: JSON.stringify(withoutExactImage), artIndex: '0' }, className: '', insertAdjacentHTML: (_, html) => appended += html };
handleArtworkError({ target: failedImage });
assert.equal(failedImage.hidden, true);
assert.match(appended, /Artwork unavailable/);

S.state.settings.game = 'ygo';
Object.assign(metaState('ygo'), { data: { game: 'ygo', decks: [], archetypes: [], top: [] } });
const yugis = [{ game: 'ygo', id: '46986414', name: 'Dark Magician', archetype: 'Dark Magician', prices: { usd: 1 } }, { game: 'ygo', id: '38033121', name: 'Dark Magician Girl', archetype: 'Dark Magician', prices: { usd: 2 } }];
for (const c of yugis) cache.ygo[c.id] = c;
S.state.tcg.ygo.collection = yugis.map(c => ({ cardId: c.id, name: c.name, qty: 1 }));
const ygoHTML = tcgDecks();
assert.match(ygoHTML, /data-act="tCard" data-id="38033121"/);
assert.match(ygoHTML, /data-ids="46986414,38033121"/);
assert.match(ygoHTML, /img\/ygo\/a\/38033121\.jpg/);
assert.match(ygoHTML, /cards_cropped\/38033121\.jpg/);
assert.doesNotMatch(ygoHTML, /cards_small\//);
S.state.tcg.ygo.collection = [];
assert.match(tcgDecks(), /Ideas come from your cards/);

// Guard the scope: collection/main-card renderers retain their full card helper;
// Magic Ideas keeps its established art_crop treatment and original actions.
const tcgSource = await readFile(new URL('./tcg.js', import.meta.url), 'utf8');
assert.match(tcgSource, /imgTag\(c, "card-img", true\)/);
const magicSource = await readFile(new URL('./views.js', import.meta.url), 'utf8');
assert.match(magicSource, /img\(art\(i.commander\), i.commander.name\)/);
assert.match(magicSource, /data-act="openIdea"/);
console.log('PASS: exact archetype art, Top-8 invariants, deterministic supplied-list selection, honest missing art, bounded persisted cache migration, unchanged owned/build IDs and scoped all-game artwork.');

// Directional page motion must fit inside the actual gutter, not make a
// 320px deck page scroll sideways before the entry animation completes.
const css=await readFile(new URL('./style.css',import.meta.url),'utf8');
assert.match(css,/@keyframes page-fwd \{ from \{[^}]*translateX\(min\(22px, var\(--gutter\)\)\)/);
assert.match(css,/@keyframes page-back \{ from \{[^}]*translateX\(calc\(-1 \* min\(22px, var\(--gutter\)\)\)\)/);
for(const width of [320,390,768,1440])for(const gutter of [16,24]){const shift=Math.min(22,gutter),content=width-2*gutter;assert(gutter+content+shift<=width);assert(gutter-shift>=0);}
console.log('PASS: forward/back page movement stays within the gutter instead of overflowing narrow deck controls.');
