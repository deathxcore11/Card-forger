// Server-only native route inventory. No network side effects.
export const NATIVE_ORIGIN = 'https://android-integration.cardstashy.invalid';
export const SERVICE_ORIGIN = 'https://cardstashy.com';
const READ = new Set([
  '/api/daily-card', '/api/community', '/api/meta/curation', '/api/tcgplayer/sets',
  '/api/prices/recent', '/api/prices/archive', '/api/prices/conditions',
  '/api/prices/yugioh-set', '/api/prices/yugioh', '/api/prices/pokemon',
  '/api/prices/mtg-tcg', '/api/prices/history', '/api/meta/mtg',
  '/api/meta/mtg/coverage', '/api/meta/ygo/decks', '/api/meta/ygo/top',
]);
const AI = new Set(['/api/ai/matchup', '/api/ai/deck-review', '/api/ai/ask', '/api/ai/identify-card']);
const imagePath = path => /^\/img\/(?:pack|back)\/(?:mtg|ptcg|ygo)\.jpg$/.test(path)
  || /^\/img\/mtg-set\/[a-z0-9]{2,8}\.jpg$/i.test(path)
  || /^\/img\/ygo\/(?:s\/|a\/)?\d{1,12}\.jpg$/.test(path)
  || /^\/img\/pks\/(?:s|r)\/[a-z0-9_-]{1,80}\.png$/.test(path)
  || /^\/img\/ptcg\/(?:s|l)\/[A-Za-z0-9.!?_-]{1,80}\.jpg$/.test(path);
const fail = message => { throw new TypeError(message); };

export function resolveServiceURL(input) {
  const raw = input instanceof Request ? input.url : String(input);
  if (/^[\s]|[\s]$|[\\\u0000-\u001f\u007f]/.test(raw) || raw.startsWith('//')) fail('Ambiguous URL');
  const url = new URL(raw, NATIVE_ORIGIN + '/');
  if (url.username || url.password) fail('URL credentials are forbidden');
  if (![NATIVE_ORIGIN, SERVICE_ORIGIN].includes(url.origin)) {
    // Unrelated provider traffic is never rewritten or given app credentials.
    return Object.freeze({ kind: 'passthrough', url: raw });
  }
  // Inspect before URL normalization can hide traversal. URL/Request inputs are
  // already canonicalized by their constructors; the resulting path is checked below.
  const rawPath = raw.replace(/^https:\/\/[^/]+/i, '').replace(/^\.\//, '').split(/[?#]/, 1)[0];
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { fail('Malformed path encoding'); }
  const isService = /^\/(?:api|img)(?:\/|$)/.test(url.pathname);
  if (!isService && /^\/(?:api|img)(?:\/|$)/.test(pathname)) fail('Encoded service namespace');
  if (!isService && !/^\/?(?:api|img)(?:\/|%|$)/.test(rawPath)) return Object.freeze({ kind: 'passthrough', url: raw });
  let decoded;
  try { decoded = decodeURIComponent(rawPath); } catch { fail('Malformed path encoding'); }
  if (decoded.split('/').some(part => part === '.' || part === '..') || /%2f|%5c|%25/i.test(rawPath)) fail('Ambiguous path');
  if (!isService) fail('Service path escaped its namespace');
  if (url.hash) fail('Service fragments are forbidden');
  // Worker dispatch compares raw pathnames. Only the Pokemon artwork handler
  // explicitly decodes an ID; keep all route segments and other IDs literal.
  const pokemon = pathname.match(/^\/img\/ptcg\/(s|l)\/([A-Za-z0-9.!?_-]{1,80})\.jpg$/);
  const canonicalPath = pokemon ? `/img/ptcg/${pokemon[1]}/${encodeURIComponent(pokemon[2])}.jpg` : pathname;
  if (url.pathname !== canonicalPath) fail('Noncanonical service path');
  const image = imagePath(pathname), ai = AI.has(pathname);
  if (!(image || ai || READ.has(pathname) || ['/api/lens', '/api/prices/watch'].includes(pathname))) fail('Unknown service route');
  for (const key of url.searchParams.keys()) if (/^(?:access_token|refresh_token|authorization|apikey|api_key|token)$/i.test(key)) fail('Credentials in query are forbidden');
  return Object.freeze({ kind: 'service', url: SERVICE_ORIGIN + url.pathname + url.search,
    path: pathname, image, ai,
    methods: Object.freeze(image || READ.has(pathname) ? ['GET'] : ai ? ['GET', 'POST'] : ['POST']),
    authorizationAllowed: ai || pathname === '/api/prices/conditions' });
}

