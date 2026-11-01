// Live news pulse: Reddit + article feed parsing, safety allowlists, worker route caching and fallbacks.
import assert from 'node:assert/strict';
import { parseRedditListing, parseRedditAtom, parseFeed, mergePulse, titleCandidates, addCardArt, pageImage } from './news-pulse.js';
import { communityArtwork } from './community-art.js';
import { newsPulseRoute } from './news-pulse-route.js';
import { safeNewsArticle, safeNewsImage, safeNewsCardArt } from './community-sources.js';
import { todayPackMarkup } from './home-today.js';
const now = Date.parse('2026-11-01T20:00:00Z'), ago = h => (now - h * 36e5) / 1000;
const post = (o = {}) => ({ kind: 't3', data: { title: 'New Banlist announced', permalink: '/r/yugioh/comments/1abcd2/new_banlist_announced/', score: 900, num_comments: 300, created_utc: ago(3), link_flair_text: 'News', ...o } });
const listing = { data: { children: [
  post(), post({ stickied: true, permalink: '/r/yugioh/comments/1zzzz1/daily/' }), post({ over_18: true, permalink: '/r/yugioh/comments/1zzzz2/x/' }),
  post({ title: 'My pulls today!', permalink: '/r/yugioh/comments/1zzzz3/pulls/' }), post({ link_flair_text: 'Meme', permalink: '/r/yugioh/comments/1zzzz4/meme/' }),
  post({ score: 3, link_flair_text: '', permalink: '/r/yugioh/comments/1zzzz5/low/' }), post({ created_utc: ago(24 * 9), permalink: '/r/yugioh/comments/1zzzz6/old/' }),
  post({ permalink: '/r/notyugioh/comments/1zzzz7/x/' }),
  post({ title: 'Tournament report', permalink: '/r/yugioh/comments/1abcd3/report/', link_flair_text: 'Tournament', preview: { images: [{ source: { url: 'https://preview.redd.it/abc123def.jpg?width=1200&format=pjpg&auto=webp&s=0a1b' }, resolutions: [{ width: 640, url: 'https://preview.redd.it/abc123def.jpg?width=640&crop=smart&auto=webp&s=ff' }] }] } }),
] } };
const rows = parseRedditListing('ygo', listing, now);
assert.deepEqual(rows.map(r => r.url).sort(), ['https://www.reddit.com/r/yugioh/comments/1abcd2/new_banlist_announced/', 'https://www.reddit.com/r/yugioh/comments/1abcd3/report/']);
assert.equal(rows.find(r => /report/.test(r.url)).image, 'https://preview.redd.it/abc123def.jpg?width=640&crop=smart&auto=webp&s=ff');
assert.ok(rows.every(r => r.sourceId === 'reddit-ygo' && r.kind === 'news' && r.category === 'Community' && /upvotes/.test(r.summary)));
assert.equal(safeNewsImage('https://evil.example/a.jpg', 'ygo', 'reddit-ygo', rows[0].url), '');
assert.equal(safeNewsArticle('https://www.reddit.com/r/yugioh/comments/1abcd2/x/?utm=1', 'ygo', 'reddit-ygo'), '');
assert.equal(safeNewsArticle('https://www.reddit.com/r/magicTCG/comments/1abcd2/x/', 'ygo', 'reddit-ygo'), '');
const rss = `<rss><channel><item><title><![CDATA[Supreme Darkness &amp; more revealed]]></title><link>https://ygorganization.com/supreme-darkness-reveals/</link><pubDate>Sun, 01 Nov 2026 12:00:00 +0000</pubDate><description><![CDATA[<p>Three new cards.</p>]]></description><content:encoded><![CDATA[<p><img src="https://ygorganization.com/wp-content/uploads/2026/11/sd-reveal.jpg?resize=600"></p>]]></content:encoded></item><item><title>Bad</title><link>https://evil.example/x</link><pubDate>Sun, 01 Nov 2026 12:00:00 +0000</pubDate></item><item><title>Tag page</title><link>https://ygorganization.com/tag/x/</link><pubDate>Sun, 01 Nov 2026 12:00:00 +0000</pubDate></item></channel></rss>`;
const feed = parseFeed('ygo', rss, now);
assert.equal(feed.length, 1); assert.equal(feed[0].title, 'Supreme Darkness & more revealed'); assert.equal(feed[0].summary, 'Three new cards.');
const atom = `<feed><entry><title>Pioneer Metagame</title><link href="https://www.mtggoldfish.com/articles/pioneer-metagame-update"/><published>2026-10-31T10:00:00Z</published></entry></feed>`;
assert.equal(parseFeed('mtg', atom, now)[0].url, 'https://www.mtggoldfish.com/articles/pioneer-metagame-update');
const merged = mergePulse(feed, rows); assert.equal(merged[0].sourceId, 'ygorg-feed'); assert.equal(merged.length, 3);
// Route: both sources fetched once, then served from the cache; a dead source leaves the other.
const store = new Map(), cache = { match: async k => store.get(k.url)?.clone(), put: async (k, r) => { store.set(k.url, r); } };
let calls = 0;
const fetchImpl = async url => { calls++; if (/reddit|ygoprodeck/.test(url)) return new Response('blocked', { status: 403 }); return new Response(/feed/.test(url) ? rss : '<html></html>', { headers: { 'Content-Type': 'application/rss+xml' } }); };
const res = await newsPulseRoute(new Request('https://x/api/news?game=ygo'), new URL('https://x/api/news?game=ygo'), null, { fetchImpl, cache, now });
const body = await res.json();
assert.equal(body.items.length, 1); assert.deepEqual(body.sources.map(s => s.status), ['unavailable', 'checked']);
assert.equal(body.items[0].image, 'https://ygorganization.com/wp-content/uploads/2026/11/sd-reveal.jpg');
const before = calls; await newsPulseRoute(new Request('https://x/api/news?game=ygo'), new URL('https://x/api/news?game=ygo'), null, { fetchImpl, cache, now }); assert.equal(calls, before);
assert.equal((await newsPulseRoute(new Request('https://x/api/news?game=xx'), new URL('https://x/api/news?game=xx'), null, { fetchImpl, cache, now })).status, 400);
// Today's pack: never the clipped text box; real pack first, then the card itself sealed as a foil pack.
const html = todayPackMarkup('ygo', { name: 'Battle Pack 2: War of the Giants', code: 'bp02' }, { cardImage: 'img/ygo/73915051.jpg' });
assert.ok(!/today-pack-fallback|Open pack</.test(html));
const sources = JSON.parse(html.match(/data-sources="([^"]+)"/)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
assert.match(sources[0], /^\/img\/pack\/ygo\.jpg\?code=bp02&name=Battle%20Pack%202/); assert.equal(sources.at(-1), '/img/ygo/73915051.jpg');
// Pokémon: two subreddits, the official feed (physical-card stories only), Atom fallback, gallery images.
const pk = parseRedditListing('ptcg', { data: { children: [{ kind: 't3', data: { title: 'Mega Evolution Ascended Heroes card list', permalink: '/r/pkmntcg/comments/1pk001/list/', score: 40, num_comments: 12, created_utc: ago(5), link_flair_text: 'News', media_metadata: { a: { status: 'valid', e: 'Image', s: { u: 'https://preview.redd.it/galleryimg1.jpg?width=1080&format=pjpg&auto=webp&s=aa' } } } } }] } }, now, 'reddit-pkmntcg');
assert.equal(pk.length, 1); assert.match(pk[0].image, /^https:\/\/preview\.redd\.it\/galleryimg1\.jpg/);
const pnews = `<rss><channel><item><title>New Pokémon TCG expansion revealed</title><link>https://www.pokemon.com/us/pokemon-news/new-tcg-expansion</link><pubDate>Sat, 31 Oct 2026 12:00:00 +0000</pubDate><media:content url="https://assets.pokemon.com/assets/cms2/img/misc/expansion.jpg" medium="image"/></item><item><title>Pokémon Legends anime trailer</title><link>https://www.pokemon.com/us/pokemon-news/anime-trailer</link><pubDate>Sat, 31 Oct 2026 12:00:00 +0000</pubDate></item></channel></rss>`;
const pf = parseFeed('ptcg', pnews, now, 'pokemon-news'); assert.equal(pf.length, 1); assert.equal(pf[0].image, 'https://assets.pokemon.com/assets/cms2/img/misc/expansion.jpg');
const atomR = `<feed><entry><category term="PokemonTCG" label="r/PokemonTCG"/><title>Prismatic Evolutions reprint announced</title><link href="https://www.reddit.com/r/PokemonTCG/comments/1pk002/reprint/"/><updated>2026-11-01T10:00:00+00:00</updated><content type="html">&lt;img src=&quot;https://b.thumbs.redditmedia.com/abcdefghijklmnop.jpg&quot;&gt;</content></entry></feed>`;
const ar = parseRedditAtom('ptcg', atomR, now, 'reddit-ptcg'); assert.equal(ar.length, 1); assert.equal(ar[0].image, 'https://b.thumbs.redditmedia.com/abcdefghijklmnop.jpg');
assert.equal(pageImage({ url: 'https://www.pokebeach.com/2026/11/big-news', game: 'ptcg', sourceId: 'pokebeach' }, '<meta property="og:image" content="https://www.pokebeach.com/news/2026/11/big.jpg?v=2">'), 'https://www.pokebeach.com/news/2026/11/big.jpg');
assert.equal(pageImage({ url: 'https://www.pokebeach.com/2026/11/big-news', game: 'ptcg', sourceId: 'pokebeach' }, '<meta property="og:image" content="https://evil.example/big.jpg">'), '');
// Stand-in art: the card the headline names, exact lookups only, from the app's own card art hosts.
assert.ok(titleCandidates('mtg', 'Sheoldred, the Apocalypse banned in Standard').includes('Sheoldred, the Apocalypse'));
assert.ok(titleCandidates('ptcg', 'Is Charizard ex still good?').includes('Charizard ex'));
assert.ok(titleCandidates('ygo', 'Snake-Eye Ash is at 1 now').some(x => /Snake-Eye Ash/.test(x)));
const lookups = [];
const fakeJson = async url => { lookups.push(url); if (/tcgdex/.test(url) && /Charizard%20ex/.test(url)) return [{ name: 'Charizard ex', image: 'https://assets.tcgdex.net/en/sv/sv03/125' }]; if (/tcgdex/.test(url)) return []; if (/ygoprodeck/.test(url) && /Snake-Eye%20Ash/.test(url)) return { data: [{ id: 9674034, name: 'Snake-Eye Ash' }] }; throw Error('404'); };
const textPosts = [{ title: 'Is Charizard ex still good?', image: '' }, { title: 'Has a picture', image: 'x' }];
await addCardArt('ptcg', textPosts, fakeJson); assert.deepEqual(textPosts[0].cardArt, { name: 'Charizard ex', url: 'https://assets.tcgdex.net/en/sv/sv03/125/high.webp' }); assert.equal(textPosts[1].cardArt, undefined);
const ygoPosts = [{ title: 'Snake-Eye Ash is at 1 now', image: '' }]; await addCardArt('ygo', ygoPosts, fakeJson); assert.equal(ygoPosts[0].cardArt.url, 'img/ygo/a/9674034.jpg');
assert.equal(safeNewsCardArt({ name: 'X', url: 'https://evil.example/a.jpg' }, 'mtg'), null);
const art = communityArtwork('ptcg', { kind: 'news', sourceId: 'reddit-ptcg', url: 'https://www.reddit.com/r/PokemonTCG/comments/1pk003/charizard/', cardArt: textPosts[0].cardArt });
assert.match(art, /data-art-kind="card"/); assert.match(art, /sv03\/125\/high\.webp/); assert.match(art, /Card in the story: Charizard ex/);
console.log('PASS: news pulse (Reddit + feeds, allowlists, cached route with partial sources) and today’s pack art fallback chain.');
