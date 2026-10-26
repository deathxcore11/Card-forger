import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPublishAccess } from '../scripts/check-publish-access.mjs';
import { ACCOUNT, WORKER } from '../scripts/release-configuration.mjs';

const env = { CLOUDFLARE_API_TOKEN: 'test-only-never-a-real-token', CLOUDFLARE_ACCOUNT_ID: ACCOUNT };
const response = (success = true, status = 200) => new Response(JSON.stringify({ success }), { status });

test('missing credentials or a different account fail before any network request', async () => {
  let calls = 0; const fetcher = async () => { calls++; return response(); };
  await assert.rejects(checkPublishAccess({ env: {}, fetcher }), /cloudflare_api_token_missing/);
  await assert.rejects(checkPublishAccess({ env: { ...env, CLOUDFLARE_API_TOKEN: '  ' }, fetcher }), /cloudflare_api_token_missing/);
  await assert.rejects(checkPublishAccess({ env: { ...env, CLOUDFLARE_ACCOUNT_ID: '0'.repeat(32) }, fetcher }), /cloudflare_account_mismatch/);
  assert.equal(calls, 0);
});

test('checks only the intended account and private Worker without claiming deployment permission', async () => {
  const calls = [];
  const result = await checkPublishAccess({ env, fetcher: async (url, options) => {
    calls.push(url);
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, `Bearer ${env.CLOUDFLARE_API_TOKEN}`);
    assert(options.signal instanceof AbortSignal);
    return response();
  } });
  assert.deepEqual(calls, [
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/${WORKER}/settings`,
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/containers/applications`,
  ]);
  assert.equal(result.authenticationVerified, true);
  assert.equal(result.writeAccessVerified, false);
  assert.equal(result.imageBuildAttempted, false);
  assert.equal(result.deploymentAttempted, false);
  assert(!JSON.stringify(result).includes(env.CLOUDFLARE_API_TOKEN));
});

test('a denied Worker check stops before containers and does not expose response content', async () => {
  let calls = 0;
  await assert.rejects(checkPublishAccess({ env, fetcher: async () => {
    calls++; return new Response(JSON.stringify({ success: false, secret: env.CLOUDFLARE_API_TOKEN }), { status: 403 });
  } }), { message: 'cloudflare_worker_access_failed' });
  assert.equal(calls, 1);
});

test('container permission failures and malformed responses fail without echoing credentials', async () => {
  let calls = 0;
  await assert.rejects(checkPublishAccess({ env, fetcher: async () => ++calls === 1 ? response() : response(false, 403) }),
    { message: 'cloudflare_containers_access_failed' });
  await assert.rejects(checkPublishAccess({ env, fetcher: async () => { throw Error(env.CLOUDFLARE_API_TOKEN); } }),
    { message: 'cloudflare_worker_access_failed' });
  await assert.rejects(checkPublishAccess({ env, fetcher: async () => new Response('not json') }),
    { message: 'cloudflare_worker_access_failed' });
});
