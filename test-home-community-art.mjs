import assert from 'node:assert/strict';
import fs from 'node:fs';
import { communityDeckArtwork, communityArtwork, safeCommunityImage, handleCommunityArtwork } from './community-art.js';
import { communitySlides, communityState } from './community-feed.js';
import { featureArticle, homeMetaShortcut, attachHomeCommunity, refreshHomeCommunity } from './home-ui.js';
import { metaState } from './meta.js';

const now = Date.parse('2026-10-17T12:00:00Z');
const decks = {
  mtg: { key: 'mtgo:exact:1', name: 'Selected Magic list', cover: 'Lightning Bolt', main: [{ name: 'Lightning Bolt', qty: 4 }], url: 'https://www.mtgo.com/decklist/exact-list' },
  ptcg: { key: 'ptcg:exact:1', name: 'Pikachu ex', icons: ['pikachu'], list: [{ kind: 'Pokemon', name: 'Pikachu ex', qty: 3, set: 'SSP', number: '57' }], url: 'https://play.limitlesstcg.com/tournament/exact/player/player/decklist' },
  ygo: { key: 'ygo:exact', name: 'Selected Yu-Gi-Oh! list', cover: '89631139', main: ['89631139'], extra: [], side: [], url: 'https://ygoprodeck.com/deck/exact-list' },
};
const expected = {
  mtg: 'https://api.scryfall.com/cards/named?exact=Lightning%20Bolt&amp;format=image&amp;version=art_crop',
  ptcg: 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/SSP/SSP_057_R_EN.png',
  ygo: 'https://images.ygoprodeck.com/images/cards_cropped/89631139.jpg',
};
const source = { mtg: 'Magic Online', ptcg: 'Limitless', ygo: 'YGOPRODeck' };
const slideFor = (g, d = decks[g]) => ({ kind: 'deck', deckKey: d.key, url: d.url, title: d.name, artwork: communityDeckArtwork(g, d) });
for (const g of Object.keys(decks)) {
  const M = { at: now, data: { decks: [decks[g]], source: source[g], archetypes: [{ cover: 'unrelated-cover.jpg' }] } };
  const slide = communitySlides(g, { metaState: M, now }).find(x => x.kind === 'deck');
  assert(slide.artwork, `${g} carries exact-list art into the Home slide`);
  assert.equal(slide.artwork.sourceUrl, decks[g].url);
  assert.equal(slide.artwork.deckKey, decks[g].key);
  const html = featureArticle(g, slide, 1, 3);
  assert(html.includes(expected[g]));
  assert.match(html, /data-art-kind="card"/);
  assert.match(html, /data-art-state="pending"/);
  assert(html.includes(`data-art-deck="${decks[g].key}"`));
  assert(html.includes(`data-art-source="${decks[g].url}"`));
  assert.match(html, /referrerpolicy="no-referrer"/);
  assert.match(html, /Game theme · deck art unavailable/);
  assert.doesNotMatch(html, /data-art-sources|onerror=|unrelated-cover/);
  Object.assign(metaState(g === 'mtg' ? 'mtg:Standard' : g), M);
  const shortcut = homeMetaShortcut(g);
  assert.match(shortcut, /class="home-meta"/);
  assert.match(shortcut, /data-act="go" data-to="#decks\/inspiration"/);
  assert(shortcut.includes(expected[g]));
  assert.match(shortcut, /<h2>Deck discovery<\/h2>/);
}
assert.match(featureArticle('ptcg', slideFor('ptcg'), 0, 1), /community-art-scan/);
assert.equal(communityDeckArtwork('ptcg', { ...decks.ptcg, name: 'Mewtwo', icons: [], cover: { imageLarge: expected.ptcg } }), null, 'never borrows a generic archetype cover or a different species');
assert.equal(communityDeckArtwork('ptcg', { ...decks.ptcg, list: [] }), null);
assert.equal(communityDeckArtwork('ptcg', { ...decks.ptcg, list: [{ ...decks.ptcg.list[0], set: '../../X' }] }), null);
assert.equal(communityDeckArtwork('ygo', { ...decks.ygo, cover: '1234' }), null, 'cover must occur in this exact list');
assert.equal(communityDeckArtwork('ygo', { ...decks.ygo, cover: '89631139/evil' }), null);
assert(communityDeckArtwork('ygo', { ...decks.ygo, main: [], extra: ['89631139'] }), 'extra-deck featured cards are list members');
assert.equal(communityDeckArtwork('mtg', { ...decks.mtg, cover: 'Ancestral Recall', art: 'https://cards.scryfall.io/art_crop/front/a/b/unrelated.jpg' }), null);
assert.equal(communityDeckArtwork('mtg', { ...decks.mtg, main: [{ name: 'Lightning Bolt', qty: 0 }] }), null);
assert.equal(communityDeckArtwork('mtg', { ...decks.mtg, main: [], commanders: [{ name: 'Lightning Bolt', qty: 1 }] })?.cardId, 'Lightning Bolt');
assert.equal(communityDeckArtwork('mtg', { ...decks.mtg, url: 'https://attacker.test/deck' }), null);
assert(communityDeckArtwork('mtg', { ...decks.mtg, url: 'https://moxfield.com/unapproved', eventUrl: decks.mtg.url }), 'validated event provenance can replace an unsupported list host');
for (const g of Object.keys(decks)) {
  const slide = slideFor(g);
  for (const patch of [{ deckKey: 'another-list' }, { url: 'https://attacker.test/deck' }, { artwork: { ...slide.artwork, game: 'wrong' } }]) assert.doesNotMatch(communityArtwork(g, { ...slide, ...patch }), /<img/, 'render boundary revalidates list, game and source');
}
const publisher = {
  mtg: ['https://images.ctfassets.net/s5n2t79q9icq/fixture/0123456789abcdef0123456789abcdef/official-story.webp', 'https://magic.wizards.com/en/news/announcements/official-story'],
  ptcg: ['https://primary.jwwb.nl/public/h/t/i/temp-zjpebgcobmaxydcmrfwb/story.jpg', 'https://www.pokeguardian.com/3412574_official-tcg-story'],
  ygo: ['https://www.yugioh-card.com/en/wp-content/uploads/2026/10/story.jpg', 'https://www.yugioh-card.com/en/news/official-story/'],
};
for (const [g, [image, url]] of Object.entries(publisher)) {
  const sourceId = { mtg: 'wizards', ptcg: 'pokeguardian', ygo: 'konami' }[g];
  const story = { game: g, sourceId, kind: 'news', title: 'Official story', url, image, publishedAt: '2026-10-16', fetchedAt: '2026-10-17T10:00:00Z' };
  communityState(g).data = { items: [story], status: 'ready' };
  const slide = communitySlides(g, { metaState: { data: null }, now })[0];
  assert.equal(slide.image, image);
  const html = featureArticle(g, slide, 0, 3);
  assert(html.includes(`src="${image}"`));
  assert.match(html, /data-art-kind="publisher"/);
  assert.match(html, /Published <time datetime="2026-10-16"/);
  assert.match(html, /Source image/);
  assert.doesNotMatch(html, /community-art-theme|community-art-emblem|Game theme/);
  assert.equal(safeCommunityImage(image, g, sourceId, url), image);
  for (const bad of ['http:' + image.slice(6), 'https://attacker.test/a.jpg', 'https://assets.pokemon.com.attacker.test/a.jpg', 'https://x:y@assets.pokemon.com/a.jpg', 'https://assets.pokemon.com:8080/a.jpg', 'javascript:alert(1)', 'data:image/svg+xml,<svg onload=alert(1)>', '//assets.pokemon.com/a.jpg', image + '\n']) {
    assert.equal(safeCommunityImage(bad, g, sourceId, url), '');
    assert.doesNotMatch(featureArticle(g, { ...story, image: bad }, 0, 1), /<img/);
  }
  assert.doesNotMatch(featureArticle(g, { ...story, kind: 'link' }, 0, 1), /<img/, 'a source-link fallback never invents article imagery');
  assert.doesNotMatch(featureArticle(g, { ...story, kind: 'link' }, 0, 1), /community-art|Game theme/);
}
assert.equal(safeCommunityImage(publisher.ptcg[0], 'mtg'), '', 'publisher images cannot silently cross games');
assert.doesNotMatch(featureArticle('ygo', { kind: 'news', title: '<img src=x>', url: publisher.ygo[1], image: 'https://attacker.test/" onload="alert(1)' }, 0, 1), /<img|onload=/);
const fakeWrapper = { dataset: { artState: 'pending', artKind: 'publisher' } };
const fakeImage = { matches: s => s === 'img[data-community-image]', closest: () => fakeWrapper, naturalWidth: 1200, hidden: false };
handleCommunityArtwork({ type: 'load', target: fakeImage }); assert.equal(fakeWrapper.dataset.artState, 'ready');
handleCommunityArtwork({ type: 'error', target: fakeImage }); assert.equal(fakeWrapper.dataset.artState, 'missing'); assert.equal(fakeImage.hidden, true); assert.equal(fakeWrapper.hidden, true, 'failed news becomes a clean text-only card');
handleCommunityArtwork({ type: 'load', target: fakeImage }); assert.equal(fakeWrapper.dataset.artState, 'missing', 'a late load cannot revive a failed image');
assert.equal(fakeImage.src, undefined, 'failure never mutates the image URL or retries');
const handlers = new Map(), root = { addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) };
const cleanup = attachHomeCommunity(root); assert.equal(handlers.get('error'), handleCommunityArtwork); assert.equal(handlers.get('load'), handleCommunityArtwork); cleanup(); assert.equal(handlers.size, 0);
let carousel = '', shortcut = '';
const feedNode = { contains: () => false, set outerHTML(v) { carousel = v; } };
const leaf = { textContent: '' };
const tileNode = { dataset: { homeMeta: 'ptcg' }, contains: () => false, querySelector: q => q === '.home-meta-stage' ? { contains: () => false, set innerHTML(v) { shortcut = v; } } : leaf, querySelectorAll: () => [] };
const refreshRoot = { querySelector: q => q.includes('data-home-meta') ? tileNode : feedNode };
await refreshHomeCommunity('ptcg', refreshRoot, { now, loadNews: async () => {}, loadDecks: async () => {}, documentRef: { body: { dataset: { view: 'home', game: 'ptcg' } }, activeElement: null } });
assert.match(carousel, /Community spotlight/); assert.match(shortcut, /data-meta-key="ptcg"/, 'async deck arrival also refreshes the existing shortcut without a whole-page render');
const css = fs.readFileSync('style.css', 'utf8');
assert.doesNotMatch(css, /\.community-art\s*\{[^}]*display\s*:\s*none/);
assert.match(css, /\.community-art-image\[hidden\]\s*\{ display:none; \}/);
assert.match(css, /prefers-reduced-motion:reduce\)\s*\{\s*\.community-art-image\s*\{ transition:none;/);
assert.match(css, /\.community-art\[data-art-state="ready"\] \.community-art-fallback \{ display:none; \}/);
console.log('PASS: source-bound Home deck/news art for all games; exact selected list identity, safe HTTPS hosts, no URL injection, visible honest fallbacks, bounded failure, shortcut refresh, listener cleanup and reduced-motion styling.');
