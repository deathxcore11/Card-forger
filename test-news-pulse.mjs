// Live news pulse: Reddit + article feed parsing, safety allowlists, worker route caching and fallbacks.
import assert from 'node:assert/strict';
import { parseRedditListing, parseFeed, mergePulse } from './news-pulse.js';
import { newsPulseRoute } from './news-pulse-route.js';
import { safeNewsArticle, safeNewsImage } from './community-sources.js';
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
const rss = `<rss><channel><item><title><![CDATA[Supreme Darkness &amp; more revealed]]></title><link>https://ygorganization.com/supreme-darkness-reveals/</link><pubDate>Sun, 01 Nov 2026 12:00:00 +0000</pubDate><description><![CDATA[<p>Three new cards.</p>]]></description></item><item><title>Bad</title><link>https://evil.example/x</link><pubDate>Sun, 01 Nov 2026 12:00:00 +0000</pubDate></item><item><title>Tag page</title><link>https://ygorganization.com/tag/x/</link><pubDate>Sun, 01 Nov 2026 12:00:00 +0000</pubDate></item></channel></rss>`;
const feed = parseFeed('ygo', rss, now);
assert.equal(feed.length, 1); assert.equal(feed[0].title, 'Supreme Darkness & more revealed'); assert.equal(feed[0].summary, 'Three new cards.');
const atom = `<feed><entry><title>Pioneer Metagame</title><link href="https://www.mtggoldfish.com/articles/pioneer-metagame-update"/><published>2026-10-31T10:00:00Z</published></entry></feed>`;
assert.equal(parseFeed('mtg', atom, now)[0].url, 'https://www.mtggoldfish.com/articles/pioneer-metagame-update');
const merged = mergePulse(feed, rows); assert.equal(merged[0].sourceId, 'ygorg-feed'); assert.equal(merged.length, 3);
// Route: both sources fetched once, then served from the cache; a dead source leaves the other.
const store = new Map(), cache = { match: async k => store.get(k.url)?.clone(), put: async (k, r) => { store.set(k.url, r); } };
let calls = 0;
const fetchImpl = async url => { calls++; if (/reddit/.test(url)) return new Response('blocked', { status: 403 }); return new Response(rss, { headers: { 'Content-Type': 'application/rss+xml' } }); };
const res = await newsPulseRoute(new Request('https://x/api/news?game=ygo'), new URL('https://x/api/news?game=ygo'), null, { fetchImpl, cache, now });
const body = await res.json();
assert.equal(body.items.length, 1); assert.deepEqual(body.sources.map(s => s.status), ['unavailable', 'checked']);
const before = calls; await newsPulseRoute(new Request('https://x/api/news?game=ygo'), new URL('https://x/api/news?game=ygo'), null, { fetchImpl, cache, now }); assert.equal(calls, before);
assert.equal((await newsPulseRoute(new Request('https://x/api/news?game=xx'), new URL('https://x/api/news?game=xx'), null, { fetchImpl, cache, now })).status, 400);
// Today's pack: never the clipped text box; real pack first, then the card itself sealed as a foil pack.
const html = todayPackMarkup('ygo', { name: 'Battle Pack 2: War of the Giants', code: 'bp02' }, { cardImage: 'img/ygo/73915051.jpg' });
assert.ok(!/today-pack-fallback|Open pack</.test(html));
const sources = JSON.parse(html.match(/data-sources="([^"]+)"/)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
assert.match(sources[0], /^\/img\/pack\/ygo\.jpg\?code=bp02&name=Battle%20Pack%202/); assert.equal(sources.at(-1), '/img/ygo/73915051.jpg');
console.log('PASS: news pulse (Reddit + feeds, allowlists, cached route with partial sources) and today’s pack art fallback chain.');
