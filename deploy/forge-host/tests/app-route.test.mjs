import test from 'node:test';
import assert from 'node:assert/strict';
import { proxyForgePlayRequest } from '../src/app-route.mjs';
test('existing app helper leaves unrelated routes unchanged and fails closed without binding', () => {
  assert.equal(proxyForgePlayRequest(new Request('https://cardstashy.com/api/ai/ask'), {}), null);
  assert.equal(proxyForgePlayRequest(new Request('https://cardstashy.com/api/play/matches'), {}).status, 503);
});
test('service binding preserves account/origin and exact body without leaking cookies or invented identity', async () => {
  let seen;
  const source = new Request('https://cardstashy.com/api/play/matches', { method: 'POST', headers: { Authorization: 'Bearer user', Origin: 'https://cardstashy.com', Cookie: 'private=1', 'X-User-ID': 'attacker', 'Content-Type': 'application/json', 'Idempotency-Key': 'fixture_idempotent_key' }, body: '{"unchanged":true}' });
  await proxyForgePlayRequest(source, { FORGE_HOST: { fetch: async request => { seen = request; return new Response(null, { status: 202 }); } } });
  assert.equal(seen.url, source.url); assert.equal(seen.headers.get('Authorization'), 'Bearer user'); assert.equal(seen.headers.get('Cookie'), null); assert.equal(seen.headers.get('X-User-ID'), null); assert.equal(await seen.text(), '{"unchanged":true}');
});
