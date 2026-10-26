// Real workerd/SQLite DO smoke, with Supabase transport replaced by a local
// fixture. No Docker, real account verification or paid-provider operations.
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import assert from 'node:assert/strict';
const owner = '00000000-0000-4000-8000-000000000001';
let authCalls = 0;
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, scriptPath: 'dist/worker.js', compatibilityDate: '2026-10-01',
  durableObjects: { FORGE_ADMISSION: { className: 'ForgeAdmission', useSQLite: true }, FORGE_MATCHES: { className: 'ForgeMatchContainer', useSQLite: true } },
  bindings: { FORGE_TRIAL_ENABLED: 'false' },
  outboundService: async request => {
    assert.equal(new URL(request.url).pathname, '/auth/v1/user'); authCalls++;
    return Response.json({ id: owner, is_anonymous: false });
  },
  cf: false,
}));
try {
  const unauth = await mf.dispatchFetch('https://cardstashy.com/api/play/matches', { method: 'POST', headers: { Origin: 'https://cardstashy.com' } });
  assert.equal(unauth.status, 401); assert.equal(authCalls, 0);
  const denied = await mf.dispatchFetch('https://cardstashy.com/api/play/matches', { method: 'POST', headers: { Origin: 'https://cardstashy.com', Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(denied.status, 503); assert.equal((await denied.json()).error, 'trial_unavailable_or_expired'); assert.equal(authCalls, 2);
  const missing = await mf.dispatchFetch('https://cardstashy.com/api/play/matches/00000000-0000-4000-8000-000000000099', { headers: { Authorization: 'Bearer fixture' } });
  assert.equal(missing.status, 404);
  console.log('PASS real workerd: auth-required route, local verifier transport, SQLite admission trial gate, unknown match privacy; no container starts.');
} finally { await mf.dispose(); }
