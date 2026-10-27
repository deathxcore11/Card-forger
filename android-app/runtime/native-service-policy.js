// Shared native/server route inventory. Bundle this exact file in Android so
// the transport and server agree on available services. No network side effects.
export const NATIVE_ORIGIN = 'https://android-integration.cardstashy.invalid';
export const SERVICE_ORIGIN = 'https://cardstashy.com';
const READ = new Set([
  '/api/releases/current',
  '/api/meta/ptcg/tournaments', '/api/meta/ptcg/standings', '/api/meta/ptcg/pairings',
  '/api/daily-card', '/api/community', '/api/meta/curation', '/api/tcgplayer/sets',
  '/api/prices/recent', '/api/prices/archive', '/api/prices/conditions',
  '/api/prices/yugioh-set', '/api/prices/yugioh', '/api/prices/pokemon',
  '/api/prices/mtg-tcg', '/api/prices/history', '/api/meta/mtg',
  '/api/meta/mtg/coverage', '/api/meta/ygo/decks', '/api/meta/ygo/top',
]);
const AI = new Set(['/api/ai/matchup', '/api/ai/deck-review', '/api/ai/ask', '/api/ai/identify-card']);
// Public topic lookups use JSON POST without account authority. Keep these
// separate from model-invoking AI and the GET-only service inventory.
const PUBLIC_REFERENCE_POST = new Set(['/api/reference/mtg-wiki', '/api/reference/wiki']);
// Hosted Play: the Forge host's match routes, exactly as the web client calls them
// (lowercase match IDs). The host verifies the signed-in account itself.
const PLAY = /^\/api\/play\/matches(?:\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/actions)?)?$/;
const PLAY_CREATE = '/api/play/matches';
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
  const image = imagePath(pathname), ai = AI.has(pathname), publicReference = PUBLIC_REFERENCE_POST.has(pathname), play = PLAY.exec(pathname);
  if (!(image || ai || publicReference || play || READ.has(pathname) || ['/api/lens', '/api/prices/watch'].includes(pathname))) fail('Unknown service route');
  if (publicReference && url.search) fail('Public reference topics belong in the JSON body');
  if (play && url.search) fail('Play routes take no query');
  for (const key of url.searchParams.keys()) if (/^(?:access_token|refresh_token|authorization|apikey|api_key|token)$/i.test(key)) fail('Credentials in query are forbidden');
  const authorizationAllowed = ai || !!play || pathname === '/api/prices/conditions';
  return Object.freeze({ kind: 'service', url: SERVICE_ORIGIN + url.pathname + url.search,
    path: pathname, image, ai, publicReference, play: !!play,
    methods: Object.freeze(image || READ.has(pathname) ? ['GET'] : ai ? ['GET', 'POST'] : play && pathname !== PLAY_CREATE && !play[1] ? ['GET', 'DELETE'] : ['POST']),
    authorizationAllowed,
    // Request headers the app may send; the server's preflight grants the same list.
    headers: Object.freeze(['accept', 'content-type', ...(authorizationAllowed ? ['authorization'] : []), ...(pathname === PLAY_CREATE ? ['idempotency-key'] : [])]) });
}

// Returns a transport-ready Request for inventoried service calls only. It does
// not send it. Passthrough keeps both original arguments untouched. Callers must
// not inject credentials after planning or follow redirects outside this policy.
export function planServiceRequest(input, init = {}) {
  const route = resolveServiceURL(input);
  if (route.kind === 'passthrough') return Object.freeze({ kind: 'passthrough', input, init });
  const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (!route.methods.includes(method)) fail('Method is not allowed for this route');
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
  for (const name of headers.keys()) if (!['accept', 'content-type', 'authorization'].includes(name) && !route.headers.includes(name)) fail('Service header is not allowed: ' + name);
  const authorization = headers.get('authorization');
  if (authorization && (!route.authorizationAllowed || !/^Bearer [A-Za-z0-9._-]{1,8192}$/.test(authorization))) fail('Authorization is not allowed for this destination');
  // User requirement: model-invoking AI calls require a signed-in session.
  // The backend must independently validate the token; this is not authorization.
  if (route.ai && method === 'POST' && !authorization) fail('Sign in before using AI');
  if (method === 'POST' && route.ai && !/^application\/json(?:;|$)/i.test(headers.get('content-type') || '')) fail('AI requests require JSON');
  if (route.play && !authorization) fail('Sign in before playing');
  if (route.play && method === 'POST' && !/^application\/json(?:;|$)/i.test(headers.get('content-type') || '')) fail('Play requests require JSON');
  if (route.headers.includes('idempotency-key') && !/^[A-Za-z0-9_-]{16,128}$/.test(headers.get('idempotency-key') || '')) fail('A new match needs its idempotency key');
  if (route.publicReference && !/^application\/json(?:\s*;|$)/i.test(headers.get('content-type') || '')) fail('Public reference requests require JSON');
  if (route.path === '/api/lens' && !/^image\/(?:jpeg|png|webp)$/.test(headers.get('content-type') || '')) fail('Lens requests require an image');
  let base = input instanceof Request ? input.clone() : undefined;
  // Build from a clone so the caller's Request/body remains usable; platform
  // Request implements body, signal and init override semantics without re-encoding.
  const source = base ? new Request(base, init) : new Request(route.url, init);
  const request = new Request(route.url, {
    method, headers, body: ['GET', 'HEAD'].includes(method) ? undefined : source.body,
    ...(source.body ? { duplex: 'half' } : {}), signal: source.signal,
    credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
    cache: source.cache, integrity: source.integrity,
    // Only Play's page-exit DELETE (ending the server match) may outlive the page.
    keepalive: route.play && method === 'DELETE' && source.keepalive === true,
  });
  return Object.freeze({ kind: 'service', route, request });
}

