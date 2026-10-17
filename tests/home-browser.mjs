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
import { chromium } from 'playwright';
import { blank } from '../store.js';
import { cardKey } from '../core.js';
import { collectionValue } from '../insights.js';
import { validateWorkspace } from '../confidence.js';
import { normalizeYgo } from '../ygo.js';
import { normalizePtcg } from '../ptcg.js';
import { GAME_IDS } from '../games.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RESULTS = resolve(ROOT, 'test-results');
const NOW = Date.parse('2026-10-17T12:00:00.000Z');
const TODAY = '2026-10-17';
const ISO = new Date(NOW).toISOString();
const WIDTHS = [320, 360, 390, 430, 700, 768, 900, 1024, 1200, 1440, 2560];
const EVIDENCE_WIDTHS = new Set([320, 390, 768, 1440, 2560]);
const IMAGE = 'https://home-fixtures.invalid';
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="630" height="880" viewBox="0 0 630 880"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#244567"/><stop offset=".5" stop-color="#ab7945"/><stop offset="1" stop-color="#382d59"/></linearGradient></defs><rect width="630" height="880" rx="30" fill="url(#a)"/><circle cx="405" cy="255" r="150" fill="#e9c479" opacity=".7"/><path d="M0 620 170 320 330 560 510 340 630 650V880H0Z" fill="#152739"/><text x="38" y="92" fill="#fff" font-family="sans-serif" font-size="28">Representative fixture art</text></svg>`;
const sources = {
  mtg: { host: 'https://magic.wizards.com', news: '/en/news/fixture-story', event: '/en/events/fixture-event', deck: 'https://www.mtgo.com/decklist/fixture-standard', label: 'Magic Online' },
  ygo: { host: 'https://www.yugioh-card.com', news: '/en/news/fixture-story', event: '/en/events/fixture-event', deck: 'https://ygoprodeck.com/deck/fixture-blue-eyes', label: 'YGOPRODeck Tournament Meta Decks' },
  ptcg: { host: 'https://www.pokemon.com', news: '/us/pokemon-news/fixture-story', event: '/us/play-pokemon/fixture-event', deck: 'https://play.limitlesstcg.com/tournament/fixture/player/1/decklist', label: 'Limitless' },
};

function magic(name, id, extra = {}) {
  return { id, oracle_id: `oracle-${id}`, name, lang: 'en', type_line: 'Creature — Elf Druid', oracle_text: '{T}: Add {G}.',
    cmc: 1, mana_cost: '{G}', colors: ['G'], color_identity: ['G'], keywords: [], power: '1', toughness: '1',
    legalities: { standard: 'legal', modern: 'legal', commander: 'legal' }, prices: { usd: '12.50', usd_foil: null },
    set: 'fdn', set_name: 'Foundations', collector_number: '1', rarity: 'common', finishes: ['nonfoil'],
    image_uris: { normal: `${IMAGE}/${id}.svg`, small: `${IMAGE}/${id}.svg`, art_crop: `${IMAGE}/${id}-art.svg` },
    checkedAt: ISO, full: true, released_at: '2024-11-15', ...extra };
}
const mtgHero = magic('Shivan Dragon', 'fixture-shivan', { type_line: 'Creature — Dragon', cmc: 6, mana_cost: '{4}{R}{R}', colors: ['R'], color_identity: ['R'], oracle_text: 'Flying', power: '5', toughness: '5' });
const mtgSeed = magic('Llanowar Elves', 'fixture-llanowar');
const rawYgo = (name, id, archetype = 'Blue-Eyes') => ({ name, id, type: 'Normal Monster', frameType: 'normal', race: 'Dragon', attribute: 'LIGHT', level: 8, atk: 3000, def: 2500, archetype,
  desc: 'A representative provider fixture for this named card.', card_images: [{ id }], card_sets: [],
  card_prices: [{ tcgplayer_price: '12.50' }], misc_info: [{ formats: ['TCG', 'OCG'], tcg_date: '2002-03-08' }] });
const ygoHeroRaw = rawYgo('Dark Magician', 46986414, 'Dark Magician');
const ygoSeedRaws = [rawYgo('Blue-Eyes White Dragon', 89631139), rawYgo('Blue-Eyes Alternative White Dragon', 38517737), rawYgo('Blue-Eyes Jet Dragon', 30576089)];
const rawPtcg = (name, id, type) => ({ name, id, localId: id.split('-').at(-1), category: 'Pokemon', stage: 'Basic', hp: 100, types: [type],
  image: `${IMAGE}/${id}`, rarity: 'Common', set: { id: id.split('-')[0], name: 'Fixture set', cardCount: { official: 200 }, releaseDate: '2024-11-08' },
  legal: { standard: true, expanded: true }, regulationMark: 'H', retreat: 1,
  attacks: [{ name: 'Fixture attack', cost: [type], damage: 30, effect: '' }],
  variants: { normal: true }, pricing: { tcgplayer: { normal: { marketPrice: 12.5 }, updated: TODAY } } });
const ptcgHeroRaw = rawPtcg('Charizard ex', 'sv03-125', 'Fire');
const ptcgSeedRaw = rawPtcg('Pikachu', 'sv08-057', 'Lightning');
const normalize = raw => raw.category ? normalizePtcg(raw) : normalizeYgo(raw);
const fresh = raw => ({ ...normalize(raw), fetchedAt: ISO, printPriceSchema: 1 });
const heroes = { mtg: mtgHero, ygo: fresh(ygoHeroRaw), ptcg: fresh(ptcgHeroRaw) };
const seeds = { mtg: mtgSeed, ygo: fresh(ygoSeedRaws[0]), ptcg: fresh(ptcgSeedRaw) };
const catalog = Object.fromEntries([mtgHero, mtgSeed, ...['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'].map((name, i) => magic(name, `fixture-basic-${i}`, { type_line: `Basic Land — ${name}`, prices: { usd: '0' }, cmc: 0, mana_cost: '', oracle_text: '', color_identity: [], colors: [] }))].map(c => [cardKey(c.name), c]));

function feed(game, empty = false) {
  const s = sources[game];
  const common = { game, fetchedAt: ISO, source: `${game.toUpperCase()} official publisher`, sourceUrl: s.host };
  return { game, fetchedAt: ISO, checkedAt: ISO, nextCheckAt: '2026-10-18T12:00:00.000Z', status: empty ? 'unavailable' : 'ready',
    items: empty ? [] : [
      { ...common, kind: 'news', title: `${game.toUpperCase()} dated fixture story`, summary: 'A dated story from an official source, distinct from a directory link.', url: s.host + s.news, publishedAt: '2026-10-16' },
      { ...common, kind: 'event', title: `${game.toUpperCase()} upcoming fixture event`, summary: 'A future event with its own start and end dates.', url: s.host + s.event, startsAt: '2026-10-20', endsAt: '2026-10-22' },
      { ...common, kind: 'news', title: 'UNSAFE FIXTURE MUST NOT RENDER', url: 'javascript:alert(1)', publishedAt: '2026-10-16' },
      { ...common, kind: 'news', title: 'UNTRUSTED FIXTURE MUST NOT RENDER', url: 'https://untrusted.invalid/news', publishedAt: '2026-10-16' },
    ] };
}
function metaFeed(game, empty = false) {
  const c = seeds[game];
  return { game, source: sources[game].label, fetchedAt: ISO, top: [], archetypes: [], events: [],
    decks: empty ? [] : [{ key: `fixture-${game}`, name: `${game.toUpperCase()} published fixture deck`, event: 'Fixture tournament', place: 'Top 8', date: '2026-10-15', url: sources[game].deck,
      ...(game === 'mtg' ? { main: [{ name: c.name, qty: 4 }], commanders: [], side: [] } : game === 'ygo' ? { main: [c.id], extra: [], side: [], cover: c.id } : { list: [{ name: c.name, qty: 4, set: 'SSP', number: '57', kind: 'Pokemon' }] }) }] };
}
function fixtures({ game = 'mtg', unpriced = false, decks = true, emptyFeed = false, fetchFeed = false } = {}) {
  const state = blank();
  state.settings.game = game;
  state.tcg = { ygo: { collection: [], decks: [], wishlist: [] }, ptcg: { collection: [], decks: [], wishlist: [] } };
  for (const g of GAME_IDS) {
    const c = heroes[g], st = g === 'mtg' ? state : state.tcg[g];
    st.collection = [
      { id: `owned-${g}-nm`, cardId: c.id, name: c.name, key: g === 'ygo' ? `name:${c.name}` : `id:${c.id}`, qty: 2, condition: unpriced ? 'Damaged' : 'Near Mint', finish: 'nonfoil', variant: g === 'ptcg' ? 'normal' : '', language: 'en' },
      { id: `owned-${g}-damaged`, cardId: c.id, name: c.name, key: g === 'ygo' ? `name:${c.name}` : `id:${c.id}`, qty: 1, condition: 'Damaged', finish: 'nonfoil', variant: g === 'ptcg' ? 'normal' : '', language: 'en' },
    ];
    st.decks = decks ? [{ id: `saved-${g}`, name: `${g.toUpperCase()} saved fixture deck`, locked: false, versions: [],
      ...(g === 'mtg' ? { format: 'Standard', commander: '', cards: [{ name: c.name, qty: 4 }], side: [] } : { format: g === 'ygo' ? 'tcg' : 'standard', zones: { main: [{ name: c.name, cardId: c.id, qty: 3 }], extra: [], side: [] } }) }] : [];
  }
  state.activeDeck = decks ? 'saved-mtg' : null;
  const cache = { ygo: { [heroes.ygo.id]: heroes.ygo, ...Object.fromEntries(ygoSeedRaws.map(raw => [String(raw.id), fresh(raw)])) }, ptcg: { [heroes.ptcg.id]: heroes.ptcg, [seeds.ptcg.id]: seeds.ptcg } };
  const community = Object.fromEntries(GAME_IDS.map(g => [g, { at: fetchFeed ? 0 : NOW, data: fetchFeed ? null : feed(g, emptyFeed) }]));
  const meta = Object.fromEntries(GAME_IDS.map(g => [g === 'mtg' ? 'mtg:Standard' : g, { at: NOW, data: metaFeed(g, emptyFeed) }]));
  const hero = { date: TODAY, ...Object.fromEntries(GAME_IDS.map(g => [g, { name: heroes[g].name, id: heroes[g].id, art: `${IMAGE}/${g}-daily.svg` }])) };
  const sent = Object.fromEntries([...Object.values(catalog).map(c => [`mtg:${c.id}`, NOW]), ...Object.keys(cache.ygo).map(id => [`ygo:${id}`, NOW])]);
  return { state, cache, storage: {
    'cardforge-v2': state, 'cardforge-catalog-v1': catalog, 'cardforge-tcg-cache-v1': cache,
    'cardforge-hero-v1': hero, 'cardforge-meta-v1': meta, 'cardforge-community-v1': community,
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
if (process.argv.includes('--validate-fixtures')) {
  console.log('PASS: Home fixtures validate against real workspace, card adapters and collection pricing; browser was not started.');
  process.exit(0);
}

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
  page.setDefaultTimeout(15000);
  const errors = [], writes = [], unexpected = [], requests = [];
  let gate = null;
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    requests.push(`${request.method()} ${url.href}`);
    if (!['GET', 'HEAD'].includes(request.method())) {
      writes.push(`${request.method()} ${url.href}`);
      return json({ ok: false, error: 'Writes are forbidden in the Home regression' });
    }
    const selection = url.hostname === 'api.scryfall.com' && url.pathname === '/cards/random'
      || url.hostname === 'db.ygoprodeck.com' && url.pathname.endsWith('/archetypes.php')
      || url.hostname === 'api.tcgdex.net' && url.pathname === '/v2/en/cards' && url.searchParams.get('category') === 'Pokemon';
    if (selection && gate) { const active = gate; gate = null; active.started(); await active.wait; }
    if (url.hostname === 'home-fixtures.invalid' || request.resourceType() === 'image' && url.origin !== BASE || url.pathname.startsWith('/img/'))
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG });
    if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '/* deterministic system fonts */' });
    if (url.origin === BASE) {
      if (url.pathname === '/catalog.json') return json({ cards: [], snapshot_date: '2000-01-01' });
      if (url.pathname === '/api/community') return json(feed(url.searchParams.get('game'), options.emptyFeed));
      if (url.pathname === '/api/meta/mtg') return json(metaFeed('mtg', options.emptyFeed));
      if (url.pathname.startsWith('/api/prices/')) return json({ points: [], series: [], cards: [], products: [], variants: [], prices: [], partial: false });
      if (!url.pathname.startsWith('/api/')) return route.continue();
    }
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
        const data = url.searchParams.get('id') === String(ygoHeroRaw.id) ? [ygoHeroRaw] : ygoSeedRaws;
        return json({ data, meta: { total_rows: data.length, rows_remaining: 0 } });
      }
      if (url.pathname.endsWith('/cardsets.php')) return json([]);
    }
    if (url.hostname === 'api.tcgdex.net') {
      if (url.pathname === '/v2/en/cards') return json([ptcgSeedRaw]);
      if (url.pathname.startsWith('/v2/en/cards/')) return json(url.pathname.endsWith(ptcgHeroRaw.id) ? ptcgHeroRaw : ptcgSeedRaw);
      if (url.pathname.startsWith('/v2/en/series') || url.pathname.startsWith('/v2/en/sets')) return json([]);
    }
    unexpected.push(`${request.method()} ${url.href}`);
    // Never forward unknown requests to the Internet, even on a failing test.
    return json({ error: 'Unmapped fixture URL' });
  });
  const f = fixtures(options);
  await page.addInitScript(({ storage, now }) => {
    const NativeDate = Date, offset = now - NativeDate.now();
    globalThis.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [NativeDate.now() + offset])); }
      static now() { return NativeDate.now() + offset; }
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
  await assertSelected(page, game);
  await page.waitForFunction(() => document.querySelector('.home-hero') && !document.querySelector('.tour'));
  const health = () => {
    assert.deepEqual(errors, [], 'no console errors or uncaught page errors');
    assert.deepEqual(writes, [], 'Home interactions never make network writes');
    assert.deepEqual(unexpected, [], 'all provider calls are explicitly local fixtures');
  };
  return { page, context, requests, health,
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
  await page.evaluate(async () => {
    await Promise.all(document.querySelector('#content').getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
  });
  const sizes = await page.evaluate(() => {
    const root = document.documentElement, body = document.body, content = document.querySelector('#content');
    const selectors = ['.topbar', '#gameTabs', '.home-value', '.home-editorial', '.home-community', '.home-discover', '.home-discover > div:first-child', '.community-feature-copy', '.hh-search'];
    return { viewport: innerWidth, root: root.scrollWidth, body: body.scrollWidth, content: content.scrollWidth, contentWidth: content.clientWidth,
      elements: selectors.map(selector => { const n = document.querySelector(selector); if (!n) return { selector, missing: true }; const r = n.getBoundingClientRect(); return { selector, left: r.left, right: r.right, scroll: n.scrollWidth, width: n.clientWidth }; }) };
  });
  assert(sizes.root <= sizes.viewport + 2 && sizes.body <= sizes.viewport + 2, `${label}: document overflow ${JSON.stringify(sizes)}`);
  assert(sizes.content <= sizes.contentWidth + 2, `${label}: content overflow ${JSON.stringify(sizes)}`);
  for (const e of sizes.elements) {
    assert(!e.missing, `${label}: ${e.selector} exists`);
    assert(e.left >= -2 && e.right <= sizes.viewport + 2, `${label}: ${e.selector} outside viewport: ${JSON.stringify(e)}`);
    // The decorative fan intentionally extends into the discovery panel's clip.
    // Its real copy and every interactive section still must fit the viewport.
    if (e.selector !== '.home-discover') assert(e.scroll <= e.width + 2, `${label}: ${e.selector} clips overflowing content: ${JSON.stringify(e)}`);
  }
}
async function visibleHeaderArt(page) {
  await page.waitForFunction(() => { const image = document.querySelector('#homeHero img.hh-art, #homeHero .hh-art img'); return image?.complete && image.naturalWidth > 0; });
  const art = await page.locator('#homeHero .hh-art').evaluate(node => {
    const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
    return { width: rect.width, height: rect.height, opacity: css.opacity, display: css.display, visibility: css.visibility };
  });
  assert(art.width >= 250 && art.height >= 120, `header artwork occupies a visible feature area: ${JSON.stringify(art)}`);
  assert(art.display !== 'none' && art.visibility !== 'hidden' && Number(art.opacity) > 0);
  assert.equal(await page.locator('#homeHero.has-art').count(), 1);
}
async function closeSheet(page) {
  const button = page.locator('#sheet [data-act="closeSheet"]').first();
  if (await button.isVisible()) await button.click();
  await page.waitForFunction(() => !document.querySelector('#sheet').open);
}
async function inventorySnapshot(page) {
  return page.evaluate(async () => { const { S } = await import('/store.js'); return JSON.stringify([S.state.collection, S.state.decks, S.state.tcg]); });
}
async function safeSourceLink(article, game) {
  const link = article.locator('a.community-open');
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
async function startReveal(page, game) {
  await page.locator('[data-act="homeRandomDeck"]').click();
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
  // One real boot, then all game changes/resizes go through production controls.
  const app = await openApp();
  const { page } = app;
  assert.deepEqual(await page.locator('#gameTabs [role="tab"]').evaluateAll(nodes => nodes.map(n => n.dataset.game)), GAME_IDS);
  for (const game of GAME_IDS) {
    await selectGame(page, game);
    assert.equal(await page.locator('.home-value-main strong').innerText(), '$25');
    assert.match(await page.locator('.home-value-note').innerText(), /Known subtotal.*1 unpriced/);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 1100 });
      await page.evaluate(() => scrollTo(0, 0));
      await assertSelected(page, game);
      await visibleHeaderArt(page);
      await noOverflow(page, `${game} at ${width}px`);
      if (EVIDENCE_WIDTHS.has(width)) await page.screenshot({ path: resolve(RESULTS, `home-${game}-${width}.png`), fullPage: true, animations: 'disabled' });
    }
    await page.setViewportSize({ width: 390, height: 1100 });
    const hero = heroes[game];
    const attribute = game === 'mtg' ? 'data-name' : 'data-id';
    const value = game === 'mtg' ? hero.name : hero.id;
    for (const selector of ['.hh-art-link', '.hh-credit']) {
      assert.equal(await page.locator(selector).getAttribute(attribute), value);
      // The full-art control's center is behind the search/credit panel. Click
      // its exposed upper-right label, as an actual visitor would.
      const control = page.locator(selector === '.hh-art-link' ? '.hh-art-link > span' : selector);
      await control.click();
      await page.waitForFunction(async ({ game, value }) => { const c = (await import('/store.js')).S.ui.sheetCtx; return game === 'mtg' ? c?.type === 'card' && c.name === value : c?.type === 'tcard' && c.id === value; }, { game, value });
      assert.match(await page.locator('#sheetBody').innerText(), new RegExp(hero.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      await closeSheet(page);
    }
    assert.match(await page.locator('.hh-credits').innerText(), /From your deck/);
    const route = `#${game === 'mtg' ? 'deck' : 'tdeck'}/saved-${game}`;
    assert.equal(await page.locator('.hh-deck-link').getAttribute('data-to'), route);
    await page.locator('.hh-deck-link').click();
    await page.waitForFunction(hash => location.hash === hash, route);
    assert.match(await page.locator('#content').innerText(), new RegExp(`${game.toUpperCase()} saved fixture deck`));
    await page.locator('.brand').click();
    await assertSelected(page, game);
    report.push(`${game}: all eleven widths, visible actual art, exact card and saved deck actions, partial value`);
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
    const article = page.locator('.community-stage .community-feature');
    assert.match(await article.getAttribute('class'), /feature-news/);
    assert.equal(await article.locator('time').getAttribute('datetime'), '2026-10-16');
    await safeSourceLink(article, game);
    const firstId = await article.getAttribute('data-slide-id');
    await page.locator('[data-community-step="1"]').click();
    assert.match(await article.getAttribute('class'), /feature-deck/);
    assert.equal(await article.locator('a.community-open').getAttribute('href'), sources[game].deck);
    assert.equal(await article.locator('time').getAttribute('datetime'), '2026-10-15');
    assert.match(await article.innerText(), game === 'ygo' ? /List submitted/ : /Event date/);
    await safeSourceLink(article, game);
    const deckId = await article.getAttribute('data-slide-id');
    await touchSwipe(page, '.community-feature-copy');
    await assertSelected(page, game);
    assert.match(await article.getAttribute('class'), /feature-event/);
    assert.deepEqual(await article.locator('time').evaluateAll(nodes => nodes.map(n => n.dateTime)), ['2026-10-20', '2026-10-22']);
    await safeSourceLink(article, game);
    const eventId = await article.getAttribute('data-slide-id');
    for (const width of [700, 768, 1024, 390]) {
      await page.setViewportSize({ width, height: 1100 });
      await assertSelected(page, game);
      assert.equal(await article.getAttribute('data-slide-id'), eventId, 'fold/tablet resize preserves carousel position');
      await noOverflow(page, `${game} resized event at ${width}px`);
    }
    await page.locator('[data-community-step="1"]').focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await article.getAttribute('data-slide-id'), deckId, 'carousel keyboard is isolated from game keyboard');
    await assertSelected(page, game);
    await page.locator('[data-community-step="1"]').click();
    await page.locator('[data-community-step="1"]').click();
    assert.match(await article.getAttribute('class'), /feature-link/);
    assert.match(await article.innerText(), /Source link · not a live headline/);
    assert.equal(await article.locator('time').count(), 0, 'source directory is never misrepresented as dated news');
    await safeSourceLink(article, game);
    assert.doesNotMatch(await page.locator('#content').innerText(), /UNSAFE FIXTURE|UNTRUSTED FIXTURE/);
    await page.locator('[data-community-step="1"]').click();
    assert.equal(await article.getAttribute('data-slide-id'), firstId, 'next control wraps predictably');
  }
  // Actual persistence is read, not reconstructed by a fake render helper.
  await selectGame(page, 'ygo');
  await page.reload();
  await page.locator('#app.ready').waitFor();
  await assertSelected(page, 'ygo');
  assert.equal(await page.locator('.home-value-main strong').innerText(), '$25');
  app.health();
  await app.close();
  report.push('All-game tab clicks, keyboard focus/wrap, game swipe, isolated carousel touch/keyboard, safe links/dates, resize and durable reload');

  const unknown = await openApp({ unpriced: true, decks: false, emptyFeed: true });
  for (const game of GAME_IDS) {
    await selectGame(unknown.page, game);
    assert.equal(await unknown.page.locator('.home-value-main strong').innerText(), '—');
    assert.match(await unknown.page.locator('.home-value-note').innerText(), /3 unpriced/);
    assert.doesNotMatch(await unknown.page.locator('.home-value-main').innerText(), /\$0/);
    await visibleHeaderArt(unknown.page);
    assert.match(await unknown.page.locator('.hh-credit').innerText(), /Card of the day/);
    assert.equal(await unknown.page.locator('.hh-deck-link').count(), 0);
    assert.equal(await unknown.page.locator('.community-feature.feature-link').count(), 1);
    assert.equal(await unknown.page.locator('.community-feature time').count(), 0);
    await noOverflow(unknown.page, `${game} unavailable source/unpriced state`);
  }
  await unknown.close();
  const fetched = await openApp({ fetchFeed: true, timezoneId: 'America/Los_Angeles' });
  await fetched.page.locator('.community-feature.feature-news').waitFor();
  assert(fetched.requests.some(url => url.includes('/api/community?game=mtg')), 'uncached feed uses the real fetch/refresh integration');
  assert.match(await fetched.page.locator('.community-feature time').innerText(), /Oct 16, 2026/, 'date-only source dates do not shift in a western timezone');
  await fetched.close();
  report.push('All-unpriced is not $0; daily art fallback; unavailable-source disclosure; real feed refresh; western-timezone date integrity');

  for (const game of GAME_IDS) {
    const random = await openApp({ game });
    const before = await inventorySnapshot(random.page);
    await startReveal(random.page, game);
    assert.equal(await inventorySnapshot(random.page), before, 'revealing a card does not create a deck or alter the collection');
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
    await random.page.waitForFunction(async ({ game, seed }) => {
      const { S } = await import('/store.js');
      return game === 'mtg' ? S.ui.sheetCtx?.type === 'build' && S.ui.build.seed === seed.name && S.ui.build.format === 'Standard'
        : S.ui.sheetCtx?.type === 'tbuild' && S.ui.tbuild.seed === seed.id && S.ui.tbuild.format === (game === 'ygo' ? 'tcg' : 'standard');
    }, { game, seed: seeds[game] });
    assert.equal(await inventorySnapshot(random.page), before, 'builder handoff is still an unsaved plan');
    await random.close();
  }
  const cancel = await openApp();
  await cancel.page.locator('[data-act="homeRandomDeck"]').click();
  await chooseFormat(cancel.page, 'mtg');
  const held = cancel.holdSelection();
  await cancel.page.locator('[data-act="randomDeckStart"]').click();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Random provider request was not observed')), 15000);
    held.seen.then(() => { clearTimeout(timer); resolve(); }, reject);
  });
  await closeSheet(cancel.page);
  await selectGame(cancel.page, 'ptcg');
  held.release();
  await cancel.page.waitForFunction(async () => (await import('/store.js')).S.catalog['llanowar elves']?.checkedAt > '2026-10-17T12:00:00.000Z');
  await cancel.page.waitForTimeout(200);
  assert.equal(await cancel.page.locator('.home-deck-reveal').count(), 0, 'late response cannot reveal across closed picker/game navigation');
  await assertSelected(cancel.page, 'ptcg');
  await cancel.close();
  report.push('All-game explicit format → real provider-selected card → same seed/format builder, with no inventory mutation; busy Magic build preserved/retryable; late selection cancelled');

  const reduced = await openApp({ reducedMotion: 'reduce', width: 390 });
  await visibleHeaderArt(reduced.page);
  await reduced.page.screenshot({ path: resolve(RESULTS, 'home-mtg-390-reduced-motion.png'), fullPage: true, animations: 'disabled' });
  await startReveal(reduced.page, 'mtg');
  const animationNames = await reduced.page.locator('.home-reveal-fan > *').evaluateAll(nodes => nodes.map(n => getComputedStyle(n).animationName));
  assert(animationNames.length === 3 && animationNames.every(name => name === 'none'), 'reduced motion removes every reveal animation');
  await reduced.page.screenshot({ path: resolve(RESULTS, 'home-mtg-reveal-reduced-motion.png'), fullPage: true, animations: 'disabled' });
  await reduced.close();
  report.push('Reduced-motion Home and actual card reveal evidence, with all reveal animations disabled');
  await writeFile(resolve(RESULTS, 'home-browser-report.json'), JSON.stringify({ passed: true, widths: WIDTHS, games: GAME_IDS, screenshots: [...EVIDENCE_WIDTHS], checks: report }, null, 2));
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
