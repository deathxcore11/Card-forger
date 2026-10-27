// Exact native admission contract; production deployment requires reviewed approval.
import { resolveServiceURL, NATIVE_ORIGIN, SERVICE_ORIGIN } from './native-service-policy.js';
const admissions = new WeakSet();
export const isNativeAdmitted = request => admissions.has(request);
export const releaseNativeAdmission = request => admissions.delete(request);
const validUser = user => user?.is_anonymous === false && typeof user.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
const bearer = value => typeof value === 'string' && /^Bearer [A-Za-z0-9._-]{1,8192}$/.test(value);
const deny = status => ({ allowed: false, response: new Response(JSON.stringify({ message: status === 401 ? 'Sign in to use AI.' : 'Request not allowed.' }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }) });
const corsHeaders = () => ({ 'Access-Control-Allow-Origin': NATIVE_ORIGIN, Vary: 'Origin', 'Cache-Control': 'no-store' });

// This gate does NOT invoke providers or replace route-level body validation,
// owner verification, rate limiting, or quota reservation. Call those unchanged
// after allowed=true. Token verification is required for web AND native AI POST.
export async function checkNativeBackendRequest(request, { verifyBearer } = {}) {
  const url = new URL(request.url);
  const requestedOrigin = request.headers.get('Origin');
  if (requestedOrigin === NATIVE_ORIGIN && url.origin !== SERVICE_ORIGIN) return deny(403);
  let route;
  try { route = resolveServiceURL(SERVICE_ORIGIN + url.pathname + url.search); } catch { return deny(404); }
  if (route.kind !== 'service') return deny(404);
  const origin = request.headers.get('Origin');
  const native = origin === NATIVE_ORIGIN;
  if (origin && !native && origin !== url.origin) return deny(403);
  const reject = status => { const result = deny(status); if (native) { result.response.headers.set('Access-Control-Allow-Origin', NATIVE_ORIGIN); result.response.headers.set('Vary', 'Origin'); } return result; };
  if (request.method === 'OPTIONS') {
    // Existing web same-origin calls need no CORS preflight. Never grant other origins.
    if (!native) return reject(403);
    const method = request.headers.get('Access-Control-Request-Method');
    if (!route.methods.includes(method)) return reject(405);
    const permitted = route.headers;
    const requested = (request.headers.get('Access-Control-Request-Headers') || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    if (requested.some(name => !permitted.includes(name))) return reject(403);
    const headers = { ...corsHeaders(), 'Access-Control-Allow-Methods': method,
      Vary: 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers' };
    if (requested.length) headers['Access-Control-Allow-Headers'] = [...new Set(requested)].join(', ');
    return { allowed: false, preflight: true, response: new Response(null, { status: 204, headers }) };
  }
  if (!route.methods.includes(request.method)) return reject(405);
  if (!native && request.method === 'POST') {
    // Match current AI exact-origin and Fetch Metadata checks. Lens currently
    // permits absent Origin; watch is left to its unchanged route-level checks.
    if (route.ai && (origin !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site')) return reject(403);
    if (route.path === '/api/lens' && origin && origin !== url.origin) return reject(403);
  }
  // Native clients must not gain cookie authority or spoof proxy authentication.
  if (native && ['cookie','apikey','x-api-key','proxy-authorization'].some(name => request.headers.has(name))) return reject(403);
  const authorization = request.headers.get('Authorization');
  if (native && authorization && (!route.authorizationAllowed || !bearer(authorization))) return reject(403);
  if (native && request.headers.has('Idempotency-Key') && !route.headers.includes('idempotency-key')) return reject(403);
  // Hosted Play needs a signed-in bearer; the Forge host verifies it against the account itself.
  if (native && route.play && !bearer(authorization)) return reject(401);
  let user = null;
  if (route.ai && request.method === 'POST') {
    if (!bearer(authorization) || typeof verifyBearer !== 'function') return reject(401);
    try { user = await verifyBearer(authorization); } catch { return reject(401); }
    if (!validUser(user)) return reject(401);
  }
  if (native) admissions.add(request);
  return { allowed: true, native, route, user, request };
}

// Wrap only a successfully admitted native request's existing route response.
// Preserve rate-limit/content headers; never apply CORS to an unapproved origin.
export function withNativeResponseHeaders(response, admission) {
  if (!admission?.allowed || !admission.native) return response;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', NATIVE_ORIGIN);
  headers.delete('Access-Control-Allow-Credentials');
  headers.delete('Access-Control-Allow-Headers');
  headers.delete('Access-Control-Allow-Methods');
  if (headers.has('Retry-After')) headers.set('Access-Control-Expose-Headers', 'Retry-After');
  const vary = new Set((headers.get('Vary') || '').split(',').map(x => x.trim()).filter(Boolean));
  if (![...vary].some(x => x.toLowerCase() === 'origin')) vary.add('Origin');
  headers.set('Vary', [...vary].join(', '));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// Uses the project's EXISTING public URL/key; requires explicit injectable fetch.
// Never creates credentials, decodes JWT locally as proof, or calls a provider.
export function createSupabaseBearerVerifier({ url, key, fetcher, timeoutMs = 8000 }) {
  const base = new URL(url);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash || !key || typeof fetcher !== 'function') throw TypeError('Existing HTTPS Supabase configuration and transport required');
  return async authorization => {
    if (!bearer(authorization)) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(base.origin + '/auth/v1/user', {
        headers: { apikey: key, Authorization: authorization, Accept: 'application/json' },
        // Cloudflare Workers reject redirect:'error'; 'manual' leaves any redirect as a non-OK response.
        redirect: 'manual', credentials: 'omit', signal: controller.signal,
      });
      if (!response.ok) return null;
      const user = await response.json();
      return validUser(user) ? { id: user.id, is_anonymous: false } : null;
    } catch { return null; } finally { clearTimeout(timer); }
  };
}
