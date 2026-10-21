// Node-only regression fixtures: no live provider, local server or browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { S, blank } from './store.js';
import { blankGame, GAME_IDS } from './games.js';
import { heroState, heroDate, heroResetAt, heroFor, homeHero, homeToday, loadHero, tcgHome, cache } from './tcg.js';
import { home } from './views.js';
const RealDate = Date;
let now = RealDate.parse('2026-10-17T12:00:00Z');
globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } };
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) };
const clear = () => { storage.clear(); for (const g of GAME_IDS) delete heroState[g]; };
const magic = (id = 'daily-print', name = 'Daily Magic') => ({ id, name, set: 'tst', oracle_id: 'daily-oracle', image_uris: { art_crop: 'https://example.test/' + id + '.jpg', normal: 'https://example.test/' + id + '-full.jpg' } });
const daily = g => ({ id: 'daily-' + g, name: 'Daily ' + g, art: 'https://example.test/daily-' + g + '.jpg', game: g, date: heroDate() });
const writeDaily = () => storage.set('cardforge-hero-v2', JSON.stringify({ date: heroDate(), ...Object.fromEntries(GAME_IDS.map(g => [g, daily(g)])) }));
writeDaily();
for (const g of GAME_IDS) {
  assert.equal(heroFor(g, { id: 'owned-lead', name: 'Owned lead', deck: true }).id, 'daily-' + g, 'saved-deck argument never overrides daily identity');
  const hero = homeHero(g, 'Welcome back.', true), html = hero + homeToday(g);
  assert.doesNotMatch(hero, /homeDailyCard|Card of the Day/, `${g}: the header no longer repeats the daily card`);
  assert.equal((html.match(/data-act="homeDailyCard"/g) || []).length, 1);
  assert.equal((html.match(new RegExp(`data-id="daily-${g}"`, 'g')) || []).length, 1);
  assert.equal((html.match(/>Card of the Day</g) || []).length, 1, `${g}: one visible daily-card label, not a duplicate artwork badge`);
  assert.match(html, /class="hh-credit"[^>]+aria-label="Explore [^"]+, Card of the Day"/);
  assert.doesNotMatch(html, /hh-art-link|hh-search/);
  assert.equal((html.match(/id="homeQ"/g)||[]).length,1,"one shared search input");
  assert.match(html, /home-art-header/);
  assert.doesNotMatch(html, /From your deck|hh-deck-link|onerror=/);
}
// Exercise the actual three Home entry points with saved deck leaders present.
S.state = { ...blank(), settings: { game: 'mtg' }, tcg: { ygo: blankGame(), ptcg: blankGame() } };
S.state.decks = [{ id: 'saved-magic', name: 'Owned deck', format: 'Standard', commander: 'Owned leader', cards: [] }];
S.state.activeDeck = 'saved-magic';
S.catalog['owned leader'] = { ...magic('owned-print', 'Owned leader'), type_line: 'Creature', prices: { usd: '1' } };
assert.match(home().match(/<section class="home-hero[\s\S]*?<\/section>/)[0], /data-daily-id="daily-mtg"/);
assert.doesNotMatch(home().match(/<section class="home-hero[\s\S]*?<\/section>/)[0], /owned-print|From your deck/);
for (const g of ['ygo', 'ptcg']) {
  S.state.settings.game = g;
  cache[g]['owned-' + g] = { game: g, id: 'owned-' + g, name: 'Owned leader', art: 'https://example.test/owned.jpg', imageLarge: 'https://example.test/owned.jpg', prices: { usd: 1 }, category: g === 'ygo' ? 'Monster' : 'Pokemon', stats: [], sets: [] };
  S.state.tcg[g].decks = [{ id: 'saved-' + g, name: 'Owned deck', format: g === 'ygo' ? 'tcg' : 'standard', zones: { main: [{ cardId: 'owned-' + g, qty: 1, name: 'Owned leader' }], extra: [], side: [] } }];
  const html = tcgHome().match(/<section class="home-hero[\s\S]*?<\/section>/)[0];
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
const longNames = { mtg:['Emrakul, the Promised End','Asmoranomardicadaistinaculdacar'], ygo:['Blue-Eyes Alternative White Dragon'], ptcg:['Reshiram & Charizard-GX'] };
for (const g of GAME_IDS) for (const title of longNames[g]) for (const art of [approved[g].art, '']) {
  heroState[g] = { ...approved[g], game:g, date:heroDate(), name:title, art };
  const html=homeHero(g)+homeToday(g),name=title.replaceAll('&','&amp;');
  assert(html.includes(`<b>${name}</b>`),`${g}: full longer title is never shortened`);
  assert(html.includes(`aria-label="Explore ${name}, Card of the Day"`));
  assert(html.includes(`data-name="${name}"`));
  assert.equal(html.includes('has-art'),!!art,`${g}: missing art preserves the same named daily action`);
}
const css=fs.readFileSync('style.css','utf8'),personalCss=css.slice(css.indexOf('/* Personal-first Home.'));
const dailyCss=personalCss.match(/\.home-overview \.home-daily \.hh-credit \{([^}]+)\}/)[1];
for(const declaration of ['backdrop-filter:none;','-webkit-backdrop-filter:none;','overflow-wrap:normal;','word-break:normal;','white-space:normal;'])assert(dailyCss.includes(declaration),`daily action resets inherited ${declaration}`);
assert.match(personalCss,/@media \(min-width:900px\) \{\s*\.home-overview \{[^}]*minmax\(280px,32%\)/,'daily side column starts only when both the value and intact names have reading width');
assert.match(personalCss,/\.home-overview \.home-daily \.hh-credit b \{[^}]*max-width:100%;[^}]*overflow-wrap:break-word;/,'only the title gets an emergency wrap for an oversized token, without clipping or shrinking');
assert.match(personalCss,/\.home-overview \.home-daily\.no-art \.hh-credit \{ padding-left:18px;/);
assert.match(css,/\.hh-credit \{[^}]*backdrop-filter: blur\(6px\)/,'the daily reset does not globally remove unrelated glass treatments');
const serverReply = (g, card, date = heroDate()) => ({ ok: true, json: async () => ({game:g, date, card}) });
clear(); let picks = 0;
globalThis.fetch = async url => { assert.equal(url, '/api/daily-card?game=mtg'); picks++; return serverReply('mtg', {...daily('mtg'), printing: magic('daily-mtg', 'Daily mtg')}); };
assert.equal(await loadHero('mtg'), true);
assert.equal(heroFor('mtg').printing.id, 'daily-mtg');
assert.equal(await loadHero('mtg'), false);
const reload = await import('./tcg.js?daily-cache-reload');
assert.equal(reload.heroFor('mtg').id, 'daily-mtg');
assert.equal(await reload.loadHero('mtg'), false);
assert.equal(picks, 1);
// Per-device v1 picks must not survive the move to server-owned daily picks.
clear(); storage.set('cardforge-hero-v1', JSON.stringify({date:heroDate(), mtg:daily('mtg')}));
assert.equal(heroFor('mtg'), null);
clear();
heroState.mtg = { ...daily('mtg'), art: 'javascript:alert(1)', artDirect: "https://example.test/'alert(1)'" };
assert.doesNotMatch(homeHero('mtg', 'Hi'), /javascript:|onerror=/);
heroState.mtg = { ...daily('ygo'), date: heroDate() }; assert.equal(heroFor('mtg'), null, 'cross-game cache is rejected');
clear(); writeDaily(); now += 86400000;
for (const g of GAME_IDS) assert.equal(heroFor(g), null, 'yesterday is not displayed or reused');
// Two calls share a request; an older date cannot clear or overwrite the new one.
let oldFinish, newFinish, calls = 0;
globalThis.fetch = () => { calls++; return new Promise(resolve => calls === 1 ? oldFinish = resolve : newFinish = resolve); };
const oldDate = heroDate(), old = loadHero('mtg'), same = loadHero('mtg');
now += 86400000;
const current = loadHero('mtg');
oldFinish(serverReply('mtg', {...daily('mtg'), id:'old-day'}, oldDate)); assert.equal(await old, false); assert.equal(await same, false);
const currentAgain = loadHero('mtg');
newFinish(serverReply('mtg', {...daily('mtg'), id:'new-day'})); assert.equal(await current, true); assert.equal(await currentAgain, true);
assert.equal(heroFor('mtg').id, 'new-day'); assert.equal(calls, 2);
assert.equal(JSON.parse(storage.get('cardforge-hero-v2')).date, heroDate());
// Parallel games keep server identities separate and fetch once each.
let fetches = 0;
globalThis.fetch = async url => { fetches++; const g = new URL(url, 'https://test').searchParams.get('game'); return serverReply(g, approved[g]); };
await Promise.all([loadHero('ygo'), loadHero('ptcg')]);
assert.equal(heroFor('ygo').id, '123'); assert.equal(heroFor('ptcg').id, 'me02.5-287');
assert.equal(heroFor('mtg').id, 'new-day'); assert.equal(fetches, 2);
assert.match(heroFor('ptcg').art, /\/high\.webp$/);
await Promise.all([loadHero('ygo'), loadHero('ptcg')]); assert.equal(fetches, 2);
clear(); globalThis.fetch = async () => ({ ok: true, json: async () => [] });
await assert.rejects(loadHero('ptcg'), /No daily cards/); assert.equal(heroFor('ptcg'), null);
globalThis.fetch = async () => ({ ok: false }); await assert.rejects(loadHero('ygo'), /unavailable/);
globalThis.fetch = async () => serverReply('ptcg', approved.ptcg, '2000-01-01');
await assert.rejects(loadHero('ptcg'), /No daily cards/, 'stale server responses are rejected');
// Run the production registered daily click callback, not a duplicate routing model.
const app = fs.readFileSync('app.js', 'utf8');
const actionSource = app.slice(app.indexOf('A.homeDailyCard ='), app.indexOf('// Only update the daily art/action.'));
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
// Production rollover timer uses the shared New York boundary and resume hooks; it never rerenders all Home.
assert.match(app, /T\.heroResetAt\(\)/);
assert.match(app, /addEventListener\("visibilitychange"/); assert.match(app, /addEventListener\("focus"/);
const paint = app.slice(app.indexOf('function paintHomeHero('), app.indexOf('/* ---------- rules reference ---------- */'));
assert.doesNotMatch(paint, /\brender\(/); assert.match(paint, /old\.setAttribute/);
// Execute the actual scheduler and actual stale repaint guard.
const schedulerSource = app.slice(app.indexOf('let heroRolloverTimer ='), app.indexOf('function heroArt(g)'));
let scheduled, cleared, refreshedGame;
const scheduler = { document: { hidden: false }, S: { ui: { view: 'home' } }, T: { game: () => 'ptcg', heroResetAt }, Date,
  setTimeout: (fn, delay) => (scheduled = { fn, delay }), clearTimeout: timer => { cleared = timer; }, heroArt: g => { refreshedGame = g; } };
vm.runInNewContext(schedulerSource + '\nscheduleHeroRollover();', scheduler);
assert.equal(scheduled.delay, heroResetAt() - now + 20);
scheduled.fn(); assert.equal(refreshedGame, 'ptcg');
scheduler.document.hidden = true; vm.runInNewContext('scheduleHeroRollover();', scheduler);
assert.equal(cleared, scheduled, 'suspending cancels the active daily timer');
const repaintSource = app.slice(app.indexOf('function paintHomeHero('), app.indexOf('let heroRolloverTimer ='));
for (const scenario of [{ view: 'collection', game: 'mtg' }, { view: 'home', game: 'ygo' }]) {
  vm.runInNewContext(repaintSource + '\npaintHomeHero("mtg");', { S: { ui: { view: scenario.view } }, T: { game: () => scenario.game }, $: () => { throw Error('A late daily result touched another view/game'); } });
}
globalThis.Date = RealDate;
console.log('PASS: all-game daily identity with owned decks, exact shared art/control targets, v1 cache retirement, cache/reload/date isolation, concurrent rollover, provider failure/retry, safe artwork fallback and stale exact-print click guards.');
