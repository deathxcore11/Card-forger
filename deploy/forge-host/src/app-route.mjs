// Integration helper for EXISTING app worker.js. Call before its native AI
// inventory gate; leave every non-game route unchanged. It grants no new origin
// or account authority: host re-verifies the existing Supabase bearer itself.
const route = /^\/api\/play\/(?:warm$|matches(?:\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/actions)?)?$)/i;
export function proxyForgePlayRequest(request, env) {
  if (!route.test(new URL(request.url).pathname)) return null;
  if (!env.FORGE_HOST) return new Response(JSON.stringify({ error: 'forge_host_unavailable' }), {
    status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': '30' },
  });
  const headers = new Headers();
  for (const key of ['Authorization', 'Origin', 'Sec-Fetch-Site', 'Content-Type', 'Idempotency-Key']) {
    if (request.headers.has(key)) headers.set(key, request.headers.get(key));
  }
  return env.FORGE_HOST.fetch(new Request(request, { headers, redirect: 'manual' }));
}
