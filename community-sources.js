// One source contract is shared by the fetcher, untrusted-cache reader and UI.
// Shared CDNs are tenant/path restricted; a host alone never proves provenance.
export const NEWS_SOURCES = Object.freeze({
  wizards: Object.freeze({ game: 'mtg', name: 'Wizards of the Coast', url: 'https://magic.wizards.com/en/news/announcements', official: true }),
  'pokemon-rules': Object.freeze({ game: 'ptcg', name: 'The Pokémon Company', url: 'https://www.pokemon.com/us/play-pokemon/about/', official: true }),
  'konami-limited': Object.freeze({ game: 'ygo', name: 'Konami', url: 'https://www.yugioh-card.com/en/limited/', official: true }),
  serebii: Object.freeze({ game: 'ptcg', name: 'Serebii', url: 'https://www.serebii.net/', official: false }),
  pokeguardian: Object.freeze({ game: 'ptcg', name: 'PokéGuardian', url: 'https://www.pokeguardian.com/', official: false }),
  konami: Object.freeze({ game: 'ygo', name: 'Konami', url: 'https://www.yugioh-card.com/en/news/', official: true }),
  'konami-events': Object.freeze({ game: 'ygo', name: 'Konami events', url: 'https://www.yugioh-card.com/en/events/', official: true }),
  ygorganization: Object.freeze({ game: 'ygo', name: 'YGOrganization', url: 'https://ygorganization.com/category/ocg-tcg', official: false, linkOnly: true }),
  // Live pulse (news-pulse.js): each game's main subreddit and a public article feed, refreshed every half hour.
  'reddit-mtg': Object.freeze({ game: 'mtg', name: 'r/magicTCG', url: 'https://www.reddit.com/r/magicTCG/', official: false, community: true, sub: 'magicTCG' }),
  'reddit-ptcg': Object.freeze({ game: 'ptcg', name: 'r/PokemonTCG', url: 'https://www.reddit.com/r/PokemonTCG/', official: false, community: true, sub: 'PokemonTCG' }),
  'reddit-ygo': Object.freeze({ game: 'ygo', name: 'r/yugioh', url: 'https://www.reddit.com/r/yugioh/', official: false, community: true, sub: 'yugioh' }),
  mtggoldfish: Object.freeze({ game: 'mtg', name: 'MTGGoldfish', url: 'https://www.mtggoldfish.com/articles', official: false, feed: 'https://www.mtggoldfish.com/feed' }),
  pokebeach: Object.freeze({ game: 'ptcg', name: 'PokéBeach', url: 'https://www.pokebeach.com/', official: false, feed: 'https://www.pokebeach.com/feed' }),
  'reddit-pkmntcg': Object.freeze({ game: 'ptcg', name: 'r/pkmntcg', url: 'https://www.reddit.com/r/pkmntcg/', official: false, community: true, sub: 'pkmntcg' }),
  'pokemon-news': Object.freeze({ game: 'ptcg', name: 'Pokémon', url: 'https://www.pokemon.com/us/pokemon-news', official: true, feed: 'https://www.pokemon.com/us/pokemon-news/rss', tcgOnly: true }),
  'ygorg-feed': Object.freeze({ game: 'ygo', name: 'YGOrganization', url: 'https://ygorganization.com/', official: false, feed: 'https://ygorganization.com/feed/' }),
});
// The live pulse: one subreddit and one article feed per game (news-pulse.js).
export const PULSE_SOURCES = Object.freeze({ mtg: ['reddit-mtg', 'mtggoldfish'], ptcg: ['reddit-ptcg', 'reddit-pkmntcg', 'pokebeach', 'pokemon-news'], ygo: ['reddit-ygo', 'ygorg-feed'] });
// Each article feed's own image domains (WordPress's i0–i3.wp.com mirror of them included).
const FEED_IMAGE_DOMAINS = Object.freeze({ mtggoldfish: ['mtggoldfish.com'], pokebeach: ['pokebeach.com'], 'pokemon-news': ['pokemon.com'], 'ygorg-feed': ['ygorganization.com'] });
export const GAME_NEWS_SOURCES = Object.freeze({ mtg: ['wizards'], ptcg: ['serebii', 'pokeguardian'], ygo: ['konami', 'ygorganization'] });
function secureUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || /%2f|%5c|%2e/i.test(u.pathname)) return null;
    return u;
  } catch { return null; }
}
export function newsSource(sourceId, game) {
  return typeof sourceId === 'string' && Object.hasOwn(NEWS_SOURCES, sourceId) && NEWS_SOURCES[sourceId].game === game ? NEWS_SOURCES[sourceId] : null;
}
export function safeNewsArticle(value, game, sourceId, kind = 'news') {
  const source = newsSource(sourceId, game), u = secureUrl(value);
  if (!source || !u || u.origin !== new URL(source.url).origin || u.search || u.hash) return '';
  const path = u.pathname;
  const valid = sourceId === 'wizards' ? kind === 'news' && /^\/en\/news\/announcements\/[a-z0-9-]+\/?$/.test(path)
    : sourceId === 'pokemon-rules' ? kind === 'news' && /^\/us\/play-pokemon\/about\/mega-evolution\/[a-z0-9-]+-rule-changes-announcement$/.test(path)
    : sourceId === 'konami-limited' ? kind === 'news' && /^\/en\/limited\/list_20\d{2}-\d{2}-\d{2}\/$/.test(path)
    : sourceId === 'serebii' ? kind === 'news' && /^\/news\/20\d{2}\/\d{2}-[A-Za-z]+-20\d{2}\.shtml$/.test(path) && path.split('/')[2] === path.match(/-(20\d{2})\.shtml$/)?.[1]
    : sourceId === 'pokeguardian' ? kind === 'news' && /^\/[1-9]\d{3,11}_[a-z0-9-]+\/?$/.test(path)
    : sourceId === 'konami' ? kind === 'news' && /^\/en\/news\/[a-z0-9_-]+\/?$/.test(path)
    : sourceId === 'konami-events' ? kind === 'event' && /^\/en\/events-item\/[a-z0-9-]+\/$/.test(path)
    : /^reddit-/.test(sourceId) ? kind === 'news' && new RegExp(`^/r/${newsSource(sourceId, game).sub}/comments/[a-z0-9]{4,12}/[A-Za-z0-9_]{0,140}/?$`, 'i').test(path)
    : sourceId === 'mtggoldfish' ? kind === 'news' && /^\/articles\/[a-z0-9-]{3,180}$/.test(path)
    : sourceId === 'pokemon-news' ? kind === 'news' && /^\/us\/pokemon-news\/[a-z0-9-]{3,180}\/?$/.test(path)
    : sourceId === 'pokebeach' ? kind === 'news' && /^\/20\d{2}\/\d{2}\/[a-z0-9-]{3,180}\/?$/.test(path)
    : sourceId === 'ygorg-feed' ? kind === 'news' && /^\/[a-z0-9][a-z0-9-]{3,180}\/?$/.test(path) && !/^\/(?:category|tag|author|about|contact|privacy|feed|wp-)/.test(path)
    : sourceId === 'ygorganization' ? kind === 'news' && /^\/[a-z0-9][a-z0-9-]{3,180}$/.test(path) && !/^\/(?:category|tag|author|about|contact|privacy|terms|tos|disclaimer|donate|shop|store|feed|login|register|account|wp-admin|wp-login|partner|partners|sponsor|sponsors|advertising|subscribe)\b/.test(path) : false;
  return valid ? u.href : '';
}
export function safeNewsSourceUrl(value, game, sourceId) {
  const source = newsSource(sourceId, game);
  return source && value === source.url ? source.url : '';
}
export function safeNewsImage(value, game, sourceId, articleUrl, kind = 'news') {
  if (!safeNewsArticle(articleUrl, game, sourceId, kind) || newsSource(sourceId, game)?.linkOnly) return '';
  const u = secureUrl(value);
  // Reddit's own image hosts. Preview links are signed (?width&format&auto&s), so the query is kept as given.
  if (Object.hasOwn(FEED_IMAGE_DOMAINS, sourceId)) {
    if (!u || u.search || u.hash || !/\.(?:jpe?g|png|webp|avif|gif)$/i.test(u.pathname) || /(?:^|[\/_-])(?:logo|favicon|avatar|gravatar|placeholder|emoji|smilies)(?:[\/_.-]|$)/i.test(u.pathname)) return '';
    const own = h => FEED_IMAGE_DOMAINS[sourceId].some(d => h === d || h.endsWith('.' + d));
    return own(u.hostname) || /^i[0-3]\.wp\.com$/.test(u.hostname) && own(u.pathname.split('/')[1] || '') ? u.href : '';
  }
  if (/^reddit-/.test(sourceId)) return u && !u.hash && (u.hostname === 'b.thumbs.redditmedia.com' && /^\/[A-Za-z0-9_-]{10,80}\.(?:jpe?g|png)$/.test(u.pathname) && !u.search || u.hostname === 'i.redd.it' && /^\/[A-Za-z0-9_-]{6,40}\.(?:jpe?g|png|webp|gif)$/.test(u.pathname) && !u.search || ['preview.redd.it', 'external-preview.redd.it'].includes(u.hostname) && /^\/[A-Za-z0-9_.%-]{6,200}\.(?:jpe?g|png|webp|gif)$/.test(u.pathname) && [...u.searchParams.keys()].every(k => ['width', 'height', 'format', 'auto', 's', 'crop'].includes(k))) ? u.href : '';
  if (!u || u.hash || /(?:^|[\/_-])(?:logo|favicon|avatar|placeholder|default|footer|yugioh-share|banner-logo)(?:[\/_.-]|$)/i.test(u.pathname) || !/\.(?:jpe?g|png|webp|avif)$/i.test(u.pathname)) return '';
  const transforms = { 'enable-io': /^(?:true|false)$/, enable: /^upscale$/, fit: /^bounds$/, width: /^(?:[1-9]\d{0,2}|1\d{3}|2000)$/, height: /^(?:[1-9]\d{0,2}|1\d{3}|2000)$/ };
  if ([...u.searchParams].some(([key, val]) => !Object.hasOwn(transforms, key) || !transforms[key].test(val)) || [...u.searchParams.keys()].some((key, i, keys) => keys.indexOf(key) !== i)) return '';
  if (u.search && sourceId !== 'pokeguardian') return '';
  const allowed = sourceId === 'wizards' ? u.hostname === 'images.ctfassets.net' && /^\/s5n2t79q9icq\/[A-Za-z0-9]+\/[a-f0-9]{32}\/[A-Za-z0-9_.%-]+$/i.test(u.pathname)
    : sourceId === 'serebii' ? u.hostname === 'www.serebii.net' && (/^\/(?:news\/20\d{2}|tcg|card)\/[A-Za-z0-9_./%-]+$/.test(u.pathname) || /^\/regionals24\.jpg$/.test(u.pathname))
    : sourceId === 'pokeguardian' ? u.hostname === 'primary.jwwb.nl' && /^\/public\/h\/t\/i\/temp-zjpebgcobmaxydcmrfwb\/[A-Za-z0-9_.%-]+$/.test(u.pathname)
    : ['konami', 'konami-events'].includes(sourceId) ? ['www.yugioh-card.com', 'img.yugioh-card.com'].includes(u.hostname) && /^\/en\/wp-content\/uploads\/(?:20\d{2}\/\d{2}\/)?[A-Za-z0-9_.%-]+$/.test(u.pathname) : false;
  return allowed ? u.href : '';
}
// A story's stand-in art: the card its headline names (news-pulse.js cardForTitle), from the app's own card art.
export function safeNewsCardArt(art, game) {
  const name = typeof art?.name === 'string' && art.name.length <= 120 && !/[<>\u0000-\u001f\u007f]/.test(art.name) ? art.name.trim() : '';
  const raw = typeof art?.url === 'string' ? art.url : '';
  if (!name || !raw) return null;
  if (game === 'ygo') return /^\/?img\/ygo\/a\/\d{1,12}\.jpg$/.test(raw) ? { name, url: raw.replace(/^\//, '') } : null;
  const u = secureUrl(raw); if (!u || u.hash) return null;
  const ok = game === 'mtg' ? u.hostname === 'cards.scryfall.io' && /^\/art_crop\/front\/[0-9a-f]\/[0-9a-f]\/[0-9a-f-]{36}\.jpg$/.test(u.pathname) && /^(?:\?\d{1,12})?$/.test(u.search)
    : game === 'ptcg' ? u.hostname === 'assets.tcgdex.net' && /^\/en\/[a-z0-9.]{1,20}\/[a-z0-9.]{1,20}\/[A-Za-z0-9._-]{1,20}\/high\.(?:webp|png|jpg)$/.test(u.pathname) && !u.search : false;
  return ok ? { name, url: u.href } : null;
}
