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
});
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
