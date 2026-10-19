import assert from 'node:assert/strict';
import { NEWS_SOURCES, safeNewsArticle, safeNewsImage } from './community-sources.js';
import { parseNewsIndex, parseNewsArticle, parseSerebiiIndex, parseYgoEvents, retainCommunityItems, COMMUNITY_DAY, COMMUNITY_FETCH_LIMIT } from './community-feed-route.js';
import { communityArtwork, handleCommunityArtwork } from './community-art.js';
import { featureArticle } from './home-ui.js';

const now = Date.parse('2026-10-17T12:00:00Z');
const URLs = {
  wizards: 'https://magic.wizards.com/en/news/announcements/where-to-find-star-trek-previews',
  serebii: 'https://www.serebii.net/news/2026/17-October-2026.shtml',
  pokeguardian: 'https://www.pokeguardian.com/3412574_new-6th-mega-pokemon-card-gym-promo-cards-revealed-features-mega-heatran-ex',
  konami: 'https://www.yugioh-card.com/en/news/cori-card-replacement/',
  ygorganization: 'https://ygorganization.com/itstimeforavalentineonetwopunch',
};
const IMAGES = {
  wizards: 'https://images.ctfassets.net/s5n2t79q9icq/6L9cabbTBXc1t9weWGjS7X/e1f31597876143add9fdea0a47b6a361/TRK_Play_Booster_960x540.jpg',
  serebii: 'https://www.serebii.net/regionals24.jpg',
  pokeguardian: 'https://primary.jwwb.nl/public/h/t/i/temp-zjpebgcobmaxydcmrfwb/image-high-7dfm86.png?enable-io=true&enable=upscale&fit=bounds&width=1200',
  konami: 'https://www.yugioh-card.com/en/wp-content/uploads/2026/10/specific-story.jpg',
  ygorganization: 'https://cdn.ygorganization.com/2026/10/mai_harpies_are_here.jpg',
};
const ld = row => `<script type="application/ld+json">${JSON.stringify(row)}</script>`;
const article = (sourceId, title = 'Physical card update', published = '2026-10-16T08:24:31+00:00') => `<meta property="og:title" content="${title}"><meta property="og:image" content="${IMAGES[sourceId]}">${ld({ '@type': 'Article', url: URLs[sourceId], headline: title, datePublished: published, dateModified: '2026-10-17T11:30:00Z', image: IMAGES[sourceId] })}`;
const section = (department, title, text, image = '') => `${image ? `<div class="pics"><img src="${image}"></div>` : ''}<div class="subcat"><h3>${department}</h3><p class="title">${title}</p><p>${text}</p></div>`;
const serebii = `<div class="post"><h2><a href="${URLs.serebii}">Unrelated daily headline: Pokopia and Pokémon GO</a></h2><span class="date">17-10-2026 01:00 BST / 20:00 EDT</span>
${section('In The Games Department', 'Pokémon GO', 'Not a tabletop story.', '/news/2026/unrelated-go.jpg')}
${section('In The Championship Series Department', 'Pokémon Regional Championships', 'Nice Regional Championships Day 1: TCG, GO and Pokémon Champions streams.', '/regionals24.jpg')}
${section('In The Trading Card Game Department', 'New Pokémon TCG expansion', 'Physical cards revealed.', '/tcg/expansion/story.jpg')}
${section('In The Trading Card Game Pocket Department', 'Pokémon TCG Pocket', 'Digital.', '/news/2026/pocket.jpg')}
${section('In The Trading Card Game Department', 'Pokémon TCG Live', 'Digital.', '/news/2026/live.jpg')}
${section('In The Championship Series Department', 'Pokémon GO Championship', 'Video game only.', '/news/2026/video.jpg')}
${section('In The Trading Card Game Department', 'Pokémon TCG no art', 'No paired image.')}
</div><div class="post"><h2><a href="/news/2026/01-October-2026.shtml">Old day</a></h2><span class="date">1 October 2026</span>${section('In The Trading Card Game Department', 'Old physical announcement', 'Old.', '/news/2026/old.jpg')}</div>`;
const sections = parseSerebiiIndex(serebii);
assert.equal(sections.length, 4);
assert.equal(sections[0].title, 'Pokémon Regional Championships');
assert.equal(sections[0].image, IMAGES.serebii);
assert.equal(sections[0].publishedAt, '2026-10-17');
assert.equal(sections[0].scope, 'TCG and other games');
assert.equal(sections[2].image, '', 'a TCG section without an adjacent pics sibling never borrows the preceding game art');
assert.equal(parseSerebiiIndex(serebii.replaceAll('</div><div class="subcat">', '</div><p>intervening content</p><div class="subcat">'))[0].image, '', 'even an intervening element breaks image pairing');
assert(!sections.some(row => /Pocket|Live|GO Championship|Unrelated daily/i.test(row.title)));

const pgIndex = `<article class="jw-news-post"><h2><a href="${URLs.pokeguardian}">New 6th MEGA Pokemon Card Gym Promo Cards</a></h2><span class="jw-news-date">16 Oct 2026</span></article><article class="jw-news-post"><h2><a href="/3412575_pokemon-tcg-pocket">Pokémon TCG Pocket</a></h2></article>`;
assert.equal(parseNewsIndex('ptcg', pgIndex, 'pokeguardian').length, 1);
const pg = parseNewsArticle('ptcg', `<meta property="og:title" content="New 6th MEGA Pokemon Card Gym Promo Cards"><meta property="og:image" content="${IMAGES.pokeguardian}"><meta itemprop="datePublished" content="2026-10-16T08:24:31+00:00"><meta property="og:image" content="https://primary.jwwb.nl/public/h/t/i/temp-zjpebgcobmaxydcmrfwb/footer-2.jpg">`, { sourceId: 'pokeguardian', url: URLs.pokeguardian }, now);
assert.equal(pg.image, IMAGES.pokeguardian, 'first article OG is retained, unrelated footer last OG never wins');
assert.equal(pg.publishedAt, '2026-10-16T08:24:31.000Z');
assert.match(pg.scope, /Japan/); assert.match(pg.summary, /PokéGuardian/); assert.doesNotMatch(pg.summary, /official team/);
const ygoCard = (slug, title, category) => `<article><h2><a href="https://ygorganization.com/${slug}">${title}</a></h2><a href="/category/ocg-tcg">OCG &amp; TCG</a><a href="/category/other">${category}</a><time datetime="2026-10-16T13:36:42+00:00"></time></article>`;
const ygoIndex = ygoCard('itstimeforavalentineonetwopunch', 'Take Flight with A Brand New Mai Valentine Strategy! [IMPH]', '') + ygoCard('cross-tagged-rush', 'Rush Duel product [RD]', 'Rush Duel') + ygoCard('cross-tagged-master', 'Master Duel update', 'Master Duel') + ygoCard('cross-tagged-links', 'New campaign', 'Duel Links');
assert.equal(parseNewsIndex('ygo', ygoIndex, 'ygorganization').length, 1, 'positive OCG/TCG category does not rescue cross-tagged digital or Rush stories');
const ygo = parseNewsArticle('ygo', article('ygorganization', 'New Mai Valentine OCG strategy') + '<div class="post-content prose"><div>IMPH-JP005 cards revealed.</div></div>', { sourceId: 'ygorganization', url: URLs.ygorganization, categories: 'OCG & TCG' }, now);
assert.equal(ygo.image, '', 'explicitly restricted YGOrganization art is disabled at route');
assert.equal(ygo.scope, 'OCG · Japan'); assert.match(ygo.summary, /do not establish TCG release dates or legality/);
assert.equal(parseNewsArticle('ygo', article('ygorganization', 'Rush Duel cards'), { sourceId: 'ygorganization', url: URLs.ygorganization }, now), null);
const konamiIndex = `<li class="clear"><img class="thumb" src="/en/wp-content/uploads/2022/02/TCG_logo_70h.png"><section class="copy"><h4><a href="${URLs.konami}">Chaos Origins replacement</a></h4><p class="date">September 28, 2026</p><section class="preview"><p>Replacement details</p></section></section></li>`;
const konami = parseNewsIndex('ygo', konamiIndex, 'konami')[0];
assert.equal(konami.image, 'https://www.yugioh-card.com/en/wp-content/uploads/2022/02/TCG_logo_70h.png');
assert.equal(konami.publishedAt, '2026-09-28');
assert.equal(safeNewsImage(konami.image, 'ygo', 'konami', konami.url), '', 'generic matched logo is not story art');
assert.equal(safeNewsImage('https://www.yugioh-card.com/en/wp-content/uploads/2020/04/yugioh-share.jpg', 'ygo', 'konami', konami.url), '');
assert.equal(parseNewsArticle('ygo', article('konami', 'Chaos Origins replacement', '2026-09-28'), konami, now), null, 'old Konami story is not fresh simply because checked today');
const wizard = parseNewsArticle('mtg', article('wizards'), { sourceId: 'wizards', url: URLs.wizards }, now);
assert.equal(wizard.image, IMAGES.wizards);
for (const published of ['2026-09-02T18:00:35Z', '2026-10-18', '2026-02-31', '2026-02-31T00:00:00Z', 'February 31, 2026', '']) {
  assert.equal(parseNewsArticle('mtg', article('wizards', 'Physical update', published), { sourceId: 'wizards', url: URLs.wizards }, now), null);
}
assert.equal(parseNewsArticle('mtg', article('wizards', 'Competitive Brawl banned announcement'), { sourceId: 'wizards', url: URLs.wizards }, now), null);
assert.equal(parseNewsArticle('mtg', ld({ '@type': 'Article', url: 'https://evil.test/unrelated', headline: 'Unrelated', datePublished: '2026-10-16', image: IMAGES.wizards }), { sourceId: 'wizards', url: URLs.wizards }, now), null, 'foreign Article schema cannot provide the story identity/date');
const resolved = parseNewsArticle('mtg', ld({ '@graph': [{ '@type': 'Article', url: URLs.wizards, headline: 'Resolved physical story', datePublished: '2026-10-16', image: { '@id': '#story-image' } }, { '@type': 'ImageObject', '@id': '#story-image', url: IMAGES.wizards }] }), { sourceId: 'wizards', url: URLs.wizards }, now);
assert.equal(resolved.image, IMAGES.wizards, 'bounded JSON-LD image IDs resolve locally without fetching');
for (const [id, source] of Object.entries(NEWS_SOURCES)) {
  if (!URLs[id]) continue;
  assert.equal(safeNewsArticle(URLs[id], source.game, id), URLs[id]);
  for (const bad of [URLs[id] + '?redirect=https://evil.test', URLs[id] + '#other', URLs[id].replace('https:', 'http:'), URLs[id].replace('https://', 'https://user:pw@'), URLs[id] + '\n']) assert.equal(safeNewsArticle(bad, source.game, id), '');
  for (const other of Object.keys(URLs).filter(other => other !== id)) assert.equal(safeNewsImage(IMAGES[other], source.game, id, URLs[id]), '', `${id} rejects ${other} art`);
}
for (const sourceId of [null, {}, { toString: null }, [], 1, '__proto__', 'constructor']) assert.equal(safeNewsArticle(URLs.wizards, 'mtg', sourceId), '', 'malformed source IDs fail closed without coercion errors');
assert.equal(safeNewsArticle('https://ygorganization.com/tos-pp', 'ygo', 'ygorganization'), '');
assert.equal(safeNewsArticle(URLs.serebii.replace('/2026/', '/2025/'), 'ptcg', 'serebii'), '');
const tenantAttacks = [IMAGES.wizards.replace('s5n2t79q9icq', 'someone-elses-tenant'), IMAGES.pokeguardian.replace('temp-zjpebgcobmaxydcmrfwb', 'another-tenant'), IMAGES.pokeguardian + '&url=https://evil.test', IMAGES.pokeguardian + '&__proto__=x', IMAGES.pokeguardian + '&width=200', IMAGES.pokeguardian.replace('width=1200', 'width=9000')];
for (const image of tenantAttacks) {
  assert.doesNotThrow(() => safeNewsImage(image, 'ptcg', 'pokeguardian', URLs.pokeguardian));
  assert.equal(safeNewsImage(image, 'ptcg', 'pokeguardian', URLs.pokeguardian), '');
  assert.equal(safeNewsImage(image, 'mtg', 'wizards', URLs.wizards), '');
}
for (const patch of [{ sourceId: 'serebii' }, { url: URLs.serebii }, { image: IMAGES.wizards }, { image: IMAGES.pokeguardian.replace('temp-zjpebgcobmaxydcmrfwb', 'evil') }]) {
  const bad = { ...pg, ...patch };
  assert.doesNotMatch(communityArtwork('ptcg', bad), /data-art-kind="publisher"/, 'forged publisher art never renders as source art; a verified story may use labelled game illustration');
}
for (const kind of ['news', 'event', 'link']) for (const compact of [false, true]) assert.doesNotMatch(communityArtwork('ptcg', { ...pg, kind, image: '' }, { compact }), /data-art-kind="publisher"/, 'missing source art can only become a labelled illustration');
assert.match(featureArticle('ygo', { ...ygo, image: IMAGES.ygorganization }, 0, 1), /data-art-kind="illustrative"/);
assert.match(featureArticle('ygo', ygo, 0, 1), /OCG · Japan/);
const wrapper = { dataset: { artState: 'pending', artKind: 'publisher' } }, image = { matches: () => true, closest: () => wrapper, naturalWidth: 0 };
handleCommunityArtwork({ type: 'error', target: image }); assert.equal(wrapper.hidden, true); assert.equal(image.hidden, true);
assert.equal(retainCommunityItems([wizard, { ...wizard, id: 'forged-duplicate' }, { ...pg, sourceId: 'serebii' }], now).length, 1);

// Exercise the actual client response/cache boundary, not just shared helpers.
const client = await import('./community-feed.js?verified-source-boundary');
const alternatePgUrl = URLs.pokeguardian.replace('3412574_', '3412575_');
await client.loadCommunity('ptcg', { now, fetchImpl: async () => Response.json({ game: 'ptcg', status: 'ready', items: [pg, { ...pg, sourceId: 'serebii', url: URLs.pokeguardian + '-forged' }, { ...pg, sourceId: { toString: null }, url: URLs.pokeguardian + '-object' }, { ...pg, url: alternatePgUrl, source: 'Forged publisher', sourceUrl: 'https://evil.test/', image: IMAGES.wizards }] }) });
const clientRows = client.communityState('ptcg').data.items;
assert.equal(clientRows.length, 2, 'client discards missing, cross-source or malformed source identities');
assert.equal(clientRows[1].image, '', 'client strips an image from another source/game');
assert.equal(clientRows[1].source, 'PokéGuardian'); assert.equal(clientRows[1].sourceUrl, NEWS_SOURCES.pokeguardian.url);
assert.match(featureArticle('ptcg', clientRows[1], 0, 1), /data-art-kind="illustrative"/);

// Client timestamps must reject Date.parse calendar rollover, while retaining
// real leap days and offsets whose UTC date differs from the source date.
for (const [label, publishedAt, clock, expected] of [
  ['impossible-september', '2026-09-31T12:00:00Z', '2026-10-02T12:00:00Z', ''],
  ['non-leap-february', '2026-02-29T12:00:00Z', '2026-03-02T12:00:00Z', ''],
  ['overflow-february', '2028-02-30T12:00:00+02:00', '2028-03-02T12:00:00Z', ''],
  ['valid-leap-day', '2028-02-29T12:00:00Z', '2028-03-02T12:00:00Z', '2028-02-29T12:00:00.000Z'],
  ['valid-leap-date-only', '2028-02-29', '2028-03-02T12:00:00Z', '2028-02-29'],
  ['valid-negative-offset', '2028-02-29T23:30:00-02:00', '2028-03-02T12:00:00Z', '2028-03-01T01:30:00.000Z'],
  ['valid-positive-offset', '2028-03-01T00:30:00+14:00', '2028-03-02T12:00:00Z', '2028-02-29T10:30:00.000Z'],
]) {
  const mod = await import(`./community-feed.js?calendar=${label}`);
  await mod.loadCommunity('mtg', { now: Date.parse(clock), fetchImpl: async () => Response.json({ game: 'mtg', status: 'ready', items: [{ ...wizard, publishedAt, fetchedAt: clock }] }) });
  const rows = mod.communityState('mtg').data.items;
  assert.equal(rows.length, expected ? 1 : 0, label + ': client calendar validity');
  if (expected) assert.equal(rows[0].publishedAt, expected, label + ': original precision and valid UTC conversion');
}
const malformedChecks = await import('./community-feed.js?calendar=malformed-check-times');
await malformedChecks.loadCommunity('mtg', { now: Date.parse('2026-10-02T12:00:00Z'), fetchImpl: async () => Response.json({ game: 'mtg', status: 'ready', checkedAt: '2026-09-31T12:00:00Z', fetchedAt: '2026-09-31T12:00:00Z', nextCheckAt: '2026-09-31T12:00:00Z', sources: [{ sourceId: 'wizards', url: NEWS_SOURCES.wizards.url, checkedAt: '2026-09-31T12:00:00Z', status: 'checked' }], items: [{ ...wizard, publishedAt: '2026-10-01T12:00:00Z', fetchedAt: '2026-09-31T12:00:00Z' }] }) });
const malformedData = malformedChecks.communityState('mtg').data;
assert.deepEqual(malformedData.items, []); assert.deepEqual(malformedData.sources, []);
for (const key of ['checkedAt', 'fetchedAt', 'nextCheckAt']) assert.equal(malformedData[key], '', key + ': impossible source timestamps do not survive normalization');

const html = value => new Response(value, { headers: { 'Content-Type': 'text/html' } });
const eventHtml = '<h2>Upcoming Events</h2><a href="/en/events-item/championship/"><p>YCS championship</p><p>City</p><p>10/16/2026 - 10/18/2026</p></a>';
const route = async (tag, game, handler, at = now) => {
  const mod = await import(`./community-feed-route.js?verified=${tag}`), url = new URL(`https://app.test/api/community?game=${game}`), calls = [];
  const options = { now: at, cache: null, fetchImpl: async (url, init) => { calls.push(url); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit'); assert(init.signal); return handler(url); } };
  const body = await (await mod.communityFeedRoute(new Request(url), url, null, options)).json();
  assert(calls.length <= COMMUNITY_FETCH_LIMIT); return { body, calls, mod, url, options };
};
const allPtcg = await route('ptcg', 'ptcg', url => url === NEWS_SOURCES.serebii.url ? new Response(Buffer.from(serebii, 'latin1'), { headers: { 'Content-Type': 'text/html; charset=ISO-8859-1' } }) : url === NEWS_SOURCES.pokeguardian.url ? html(pgIndex) : html(article('pokeguardian', 'New Pokémon TCG promo cards')));
assert.equal(allPtcg.body.status, 'ready'); assert.equal(allPtcg.calls.length, 3);
assert(allPtcg.body.items.some(row => row.title === 'Pokémon Regional Championships'));
assert(!JSON.stringify(allPtcg.body).includes('Pok�mon')); assert(!allPtcg.body.items.some(row => /Old physical|Pocket|Live/.test(row.title)));
assert.equal(allPtcg.body.items.filter(row => row.sourceId === 'serebii').length, 3, 'distinct sections sharing a daily archive link survive dedupe');
const allYgo = await route('ygo', 'ygo', url => html(url === NEWS_SOURCES.konami.url ? konamiIndex : url === NEWS_SOURCES['konami-events'].url ? eventHtml : url === NEWS_SOURCES.ygorganization.url ? ygoIndex : article('ygorganization', 'New Mai Valentine OCG strategy') + '<article>Japanese OCG announcement</article>'));
assert.equal(allYgo.body.status, 'ready'); assert.equal(allYgo.calls.length, 4); assert.deepEqual(allYgo.body.items.map(row => row.kind).sort(), ['event', 'news']);
assert(allYgo.body.items.every(row => !row.image)); assert(allYgo.body.sources.every(source => source.status === 'checked'));
const fullIndex = Array.from({ length: 20 }, (_, i) => ygoCard('physical-story-' + i, 'Physical card update ' + i, '')).join('');
const budget = await route('budget', 'ygo', url => html(url === NEWS_SOURCES.konami.url ? konamiIndex : url === NEWS_SOURCES['konami-events'].url ? eventHtml : url === NEWS_SOURCES.ygorganization.url ? fullIndex : article('ygorganization').replaceAll(URLs.ygorganization, url)));
assert.equal(budget.calls.length, 6, 'YGO uses exactly three fixed indexes and at most three shared article slots');
await budget.mod.communityFeedRoute(new Request(budget.url), budget.url, null, budget.options); assert.equal(budget.calls.length, 6, 'daily replay makes no more calls');
const partial = await route('partial', 'ptcg', url => url === NEWS_SOURCES.serebii.url ? html(serebii) : new Response('', { status: 403 }));
assert.equal(partial.body.status, 'partial'); assert(partial.body.items.length); assert.match(partial.body.error, /403/); assert.equal(partial.calls.length, 2, 'denied source is not retried or bypassed');
const malformed = await route('malformed', 'ygo', () => html('<iframe src="/challenge"></iframe>'));
assert.equal(malformed.body.status, 'unavailable'); assert.deepEqual(malformed.body.items, []); assert.equal(malformed.calls.length, 3);
const oversized = await route('oversized', 'ptcg', () => html('a'.repeat(1024 * 1024 + 1)));
assert.equal(oversized.body.status, 'unavailable'); assert.match(oversized.body.error, /size limit/);
for (const target of ['https://evil.test/', NEWS_SOURCES.serebii.url, URLs.pokeguardian, 'http://169.254.169.254/latest/meta-data/']) {
  const blocked = await route('redirect-' + encodeURIComponent(target), 'ptcg', () => new Response(null, { status: 302, headers: { Location: target } }));
  assert.equal(blocked.body.status, 'unavailable'); assert.equal(blocked.calls.length, 2); assert(blocked.calls.every(url => [NEWS_SOURCES.serebii.url, NEWS_SOURCES.pokeguardian.url].includes(url)));
}
console.log('PASS: verified publisher fixtures, source/tenant identity boundaries, duplicate OG and adjacent-art rejection, physical-game classification, dated/no-image truth, Latin-1, fixed six-page shared budget, cache, denial and malformed-response safety.');
