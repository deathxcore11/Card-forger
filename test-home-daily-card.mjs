// Node-only regression fixtures: no live provider, local server or browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { S, blank } from './store.js';
import { blankGame, GAME_IDS } from './games.js';
import { heroState, heroDate, heroFor, homeHero, loadHero, tcgHome, cache } from './tcg.js';
import { home } from './views.js';
const RealDate = Date;
let now = RealDate.parse('2026-10-17T12:00:00Z');
globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } };
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) };
const clear = () => { storage.clear(); for (const g of GAME_IDS) delete heroState[g]; };
const magic = (id = 'daily-print', name = 'Daily Magic') => ({ id, name, set: 'tst', oracle_id: 'daily-oracle', image_uris: { art_crop: 'https://example.test/' + id + '.jpg', normal: 'https://example.test/' + id + '-full.jpg' } });
const daily = g => ({ id: 'daily-' + g, name: 'Daily ' + g, art: 'https://example.test/daily-' + g + '.jpg', game: g, date: heroDate() });
const writeDaily = () => storage.set('cardforge-hero-v1', JSON.stringify({ date: heroDate(), ...Object.fromEntries(GAME_IDS.map(g => [g, daily(g)])) }));
writeDaily();
for (const g of GAME_IDS) {
  assert.equal(heroFor(g, { id: 'owned-lead', name: 'Owned lead', deck: true }).id, 'daily-' + g, 'saved-deck argument never overrides daily identity');
  const html = homeHero(g, 'Welcome back.', true);
  assert.equal((html.match(/data-act="homeDailyCard"/g) || []).length, 2);
  assert.equal((html.match(new RegExp(`data-id="daily-${g}"`, 'g')) || []).length, 2);
  assert.equal((html.match(/Card of the Day/g) || []).length, 1, `${g}: one visible daily-card label, not a duplicate artwork badge`);
  assert.match(html, /class="hh-art-link"[^>]+aria-label="Explore [^"]+ artwork"><\/button>/);
  assert.doesNotMatch(html, /From your deck|hh-deck-link|onerror=/);
}
// Exercise the actual three Home entry points with saved deck leaders present.
S.state = { ...blank(), settings: { game: 'mtg' }, tcg: { ygo: blankGame(), ptcg: blankGame() } };
S.state.decks = [{ id: 'saved-magic', name: 'Owned deck', format: 'Standard', commander: 'Owned leader', cards: [] }];
S.state.activeDeck = 'saved-magic';
S.catalog['owned leader'] = { ...magic('owned-print', 'Owned leader'), type_line: 'Creature', prices: { usd: '1' } };
assert.match(home().split('</section>')[0], /data-daily-id="daily-mtg"/);
assert.doesNotMatch(home().split('</section>')[0], /owned-print|From your deck/);
for (const g of ['ygo', 'ptcg']) {
  S.state.settings.game = g;
  cache[g]['owned-' + g] = { game: g, id: 'owned-' + g, name: 'Owned leader', art: 'https://example.test/owned.jpg', imageLarge: 'https://example.test/owned.jpg', prices: { usd: 1 }, category: g === 'ygo' ? 'Monster' : 'Pokemon', stats: [], sets: [] };
  S.state.tcg[g].decks = [{ id: 'saved-' + g, name: 'Owned deck', format: g === 'ygo' ? 'tcg' : 'standard', zones: { main: [{ cardId: 'owned-' + g, qty: 1, name: 'Owned leader' }], extra: [], side: [] } }];
  const html = tcgHome().split('</section>')[0];
  assert.match(html, new RegExp(`data-daily-id="daily-${g}"`));
  assert.doesNotMatch(html, /owned\.jpg|From your deck/);
}
// Known provider art must prove the selected printing; malformed cache URLs do
// not trigger arbitrary external requests or inline script execution.
const approved = {
  mtg: { id: '12345678-1234-1234-1234-123456789abc', name: 'Proved Magic', art: 'https://cards.scryfall.io/art_crop/front/1/2/12345678-1234-1234-1234-123456789abc.jpg' },
  ygo: { id: '123', name: 'Proved YGO', art: 'img/ygo/a/123.jpg', artDirect: 'https://images.ygoprodeck.com/images/cards_cropped/123.jpg' },
  ptcg: { id: 'me02.5-287', name: 'Proved Pokémon', art: 'https://assets.tcgdex.net/en/me/me02.5/287/high.webp' },
};
for (const g of GAME_IDS) {
  heroState[g] = { ...approved[g], game: g, date: heroDate() };
  assert.match(homeHero(g, 'Hi'), /has-art/, g + ': proved provider art remains present');
  assert.equal(heroFor(g).art, approved[g].art);
  heroState[g] = { ...approved[g], game: g, date: heroDate(), art: 'https://untrusted.invalid/track.jpg', artDirect: 'javascript:alert(1)' };
  assert.equal(heroFor(g).art, ''); assert.equal(heroFor(g).artDirect, '');
  assert.doesNotMatch(homeHero(g, 'Hi'), /untrusted|javascript:|onerror=/);
  heroState[g] = { ...approved[g], game: g, date: heroDate(), id: g === 'mtg' ? 'ffffffff-ffff-ffff-ffff-ffffffffffff' : g === 'ygo' ? '999' : 'me02.5-288' };
  assert.equal(heroFor(g).art, '', g + ': another card’s art cannot describe this card');
}
clear(); let picks = 0;
assert.equal(await loadHero('mtg', async () => { picks++; return magic(); }), true);
assert.equal(heroFor('mtg').printing.id, 'daily-print');
assert.equal(await loadHero('mtg', () => { throw Error('Must reuse selected daily card'); }), false);
const reload = await import('./tcg.js?daily-cache-reload');
assert.equal(reload.heroFor('mtg').id, 'daily-print');
assert.equal(await reload.loadHero('mtg', () => { throw Error('Reload must not reroll'); }), false);
assert.equal(picks, 1);
// Legacy v1 cache preserves the exact selected art/printing, without a new pick.
clear(); const oldId = '12345678-1234-1234-1234-123456789abc';
storage.set('cardforge-hero-v1', JSON.stringify({ date: heroDate(), mtg: { name: 'Legacy daily', art: `https://cards.scryfall.io/art_crop/front/1/2/${oldId}.jpg?1` } }));
assert.equal(heroFor('mtg').id, oldId);
assert.equal(await loadHero('mtg', () => { throw Error('Keep the existing daily selection'); }), false);
for (const art of [`http://cards.scryfall.io/art_crop/front/1/2/${oldId}.jpg`, `https://evil.test/art_crop/front/1/2/${oldId}.jpg`, `https://user:pass@cards.scryfall.io/art_crop/front/1/2/${oldId}.jpg`]) {
  clear(); storage.set('cardforge-hero-v1', JSON.stringify({ date: heroDate(), mtg: { name: 'Unproved identity', art } }));
  assert.equal(heroFor('mtg'), null);
}
clear();
heroState.mtg = { ...daily('mtg'), art: 'javascript:alert(1)', artDirect: "https://example.test/'alert(1)'" };
assert.doesNotMatch(homeHero('mtg', 'Hi'), /javascript:|onerror=/);
heroState.mtg = { ...daily('ygo'), date: heroDate() }; assert.equal(heroFor('mtg'), null, 'cross-game cache is rejected');
clear(); writeDaily(); now += 86400000;
for (const g of GAME_IDS) assert.equal(heroFor(g), null, 'yesterday is not displayed or reused');
// Two calls share a request; an older date cannot clear or overwrite the new one.
let oldFinish, newFinish, calls = 0;
const old = loadHero('mtg', () => { calls++; return new Promise(resolve => oldFinish = resolve); });
const same = loadHero('mtg', () => { throw Error('Duplicate request'); });
now += 86400000;
const current = loadHero('mtg', () => { calls++; return new Promise(resolve => newFinish = resolve); });
oldFinish(magic('old-day')); assert.equal(await old, false); assert.equal(await same, false);
const currentAgain = loadHero('mtg', () => { throw Error('Old completion cleared current request'); });
newFinish(magic('new-day')); assert.equal(await current, true); assert.equal(await currentAgain, true);
assert.equal(heroFor('mtg').id, 'new-day'); assert.equal(calls, 2);
assert.equal(JSON.parse(storage.get('cardforge-hero-v1')).date, heroDate());
// Parallel games keep provider identities separate and fetch once each.
let fetches = 0;
globalThis.fetch = async url => { fetches++; return { ok: true, json: async () => String(url).includes('ygoprodeck') ? { data: [{ id: 123, name: 'Daily YGO', type: 'Normal Monster', card_images: [] }] } : [{ id: 'sv01-1', name: 'Daily Pokémon', image: 'https://assets.tcgdex.net/en/sv/sv01/001' }] }; };
await Promise.all([loadHero('ygo'), loadHero('ptcg')]);
assert.equal(heroFor('ygo').id, '123'); assert.equal(heroFor('ptcg').id, 'sv01-1');
assert.equal(heroFor('mtg').id, 'new-day'); assert.equal(fetches, 2);
assert.match(heroFor('ptcg').art, /\/high\.webp$/);
await Promise.all([loadHero('ygo'), loadHero('ptcg')]); assert.equal(fetches, 2);
clear(); globalThis.fetch = async () => ({ ok: true, json: async () => [] });
await assert.rejects(loadHero('ptcg'), /No daily cards/); assert.equal(heroFor('ptcg'), null);
globalThis.fetch = async () => ({ ok: false }); await assert.rejects(loadHero('ygo'), /unavailable/);
// Run the production registered daily click callback, not a duplicate routing model.
const app = fs.readFileSync('app.js', 'utf8');
const actionSource = app.slice(app.indexOf('A.homeDailyCard ='), app.indexOf('// Only update the art/credits.'));
const events = [], pending = [], state = { ui: { view: 'home', sheetCtx: null } }, sheet = { open: true }, body = {};
let game = 'mtg', selected = { ...daily('mtg'), id: 'shown-print', name: 'Shown exact' }, refreshes = 0;
const A = { card: x => events.push(['mtg', x]), tCard: x => events.push(['tcg', x]) };
const harness = { A, S: state, T: { game: () => game, heroFor: () => selected }, $: id => id === '#sheet' ? sheet : body,
  openSheet: (_html, ctx) => { state.ui.sheetCtx = ctx; sheet.open = true; }, esc: String, key: x => String(x).toLowerCase(), slim: x => x, heroArt: () => refreshes++, api: path => new Promise((resolve, reject) => pending.push({ path, resolve, reject })) };
vm.runInNewContext(actionSource, harness);
const click = () => ({ dataset: { game, id: selected.id, name: selected.name, date: selected.date } });
selected.printing = magic('shown-print', 'Shown exact');
await A.homeDailyCard(click()); assert.equal(events.at(-1)[1].printing.id, 'shown-print'); assert.equal(pending.length, 0);
delete selected.printing;
let loading = A.homeDailyCard(click()); assert.equal(pending.at(-1).path, '/cards/shown-print');
pending.at(-1).resolve(magic('shown-print', 'Shown exact')); await loading;
assert.equal(events.at(-1)[1].printing.id, 'shown-print', 'does not resolve by name to another printing');
for (const interrupt of [() => { sheet.open = false; }, () => { state.ui.sheetCtx = {}; }, () => { game = 'ptcg'; }, () => { state.ui.view = 'collection'; }]) {
  game = 'mtg'; state.ui.view = 'home'; sheet.open = true;
  const before = events.length; loading = A.homeDailyCard(click()); interrupt();
  pending.at(-1).resolve(magic('shown-print', 'Shown exact')); await loading;
  assert.equal(events.length, before, 'abandoned lookup cannot open or overwrite another sheet/game/view');
}
game = 'mtg'; state.ui.view = 'home';
loading = A.homeDailyCard(click()); const count = events.length;
pending.at(-1).resolve(magic('wrong-print', 'Shown exact')); await loading;
assert.equal(events.length, count); assert.match(body.innerHTML, /different printing/);
for (const g of ['ygo', 'ptcg']) { game = g; selected = daily(g); await A.homeDailyCard(click()); assert.equal(events.at(-1)[1].dataset.id, selected.id); assert.equal(events.at(-1)[1].dataset.game, g); }
await A.homeDailyCard({ dataset: { ...click().dataset, date: '2000-01-01' } }); assert.equal(refreshes, 1);
// Production rollover timer uses UTC day boundary and resume hooks; it never rerenders all Home.
assert.match(app, /86400000 - Date\.now\(\) % 86400000/);
assert.match(app, /addEventListener\("visibilitychange"/); assert.match(app, /addEventListener\("focus"/);
const paint = app.slice(app.indexOf('function paintHomeHero('), app.indexOf('/* ---------- rules reference ---------- */'));
assert.doesNotMatch(paint, /\brender\(/); assert.match(paint, /old\.setAttribute/);
// Execute the actual scheduler and actual stale repaint guard.
const schedulerSource = app.slice(app.indexOf('let heroRolloverTimer ='), app.indexOf('function heroArt(g)'));
let scheduled, cleared, refreshedGame;
const scheduler = { document: { hidden: false }, S: { ui: { view: 'home' } }, T: { game: () => 'ptcg' }, Date,
  setTimeout: (fn, delay) => (scheduled = { fn, delay }), clearTimeout: timer => { cleared = timer; }, heroArt: g => { refreshedGame = g; } };
vm.runInNewContext(schedulerSource + '\nscheduleHeroRollover();', scheduler);
assert.equal(scheduled.delay, 86400000 - now % 86400000 + 20);
scheduled.fn(); assert.equal(refreshedGame, 'ptcg');
scheduler.document.hidden = true; vm.runInNewContext('scheduleHeroRollover();', scheduler);
assert.equal(cleared, scheduled, 'suspending cancels the active daily timer');
const repaintSource = app.slice(app.indexOf('function paintHomeHero('), app.indexOf('let heroRolloverTimer ='));
for (const scenario of [{ view: 'collection', game: 'mtg' }, { view: 'home', game: 'ygo' }]) {
  vm.runInNewContext(repaintSource + '\npaintHomeHero("mtg");', { S: { ui: { view: scenario.view } }, T: { game: () => scenario.game }, $: () => { throw Error('A late daily result touched another view/game'); } });
}
globalThis.Date = RealDate;
console.log('PASS: all-game daily identity with owned decks, exact shared art/control targets, v1 printing preservation, cache/reload/date isolation, concurrent rollover, provider failure/retry, safe artwork fallback and stale exact-print click guards.');
