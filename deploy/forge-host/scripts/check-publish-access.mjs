import { pathToFileURL } from 'node:url';
import { ACCOUNT, WORKER } from './release-configuration.mjs';

// Read-only checks, before Docker or dependency installation. Passing these
// proves authentication/read access; publication still needs write permission.
export async function checkPublishAccess({ env = process.env, fetcher = fetch } = {}) {
  const token = env.CLOUDFLARE_API_TOKEN;
  if (typeof token !== 'string' || !token.trim()) throw Error('cloudflare_api_token_missing');
  if (env.CLOUDFLARE_ACCOUNT_ID !== ACCOUNT) throw Error('cloudflare_account_mismatch');
  const headers = { Authorization: `Bearer ${token}` };
  const signal = AbortSignal.timeout(20_000);
  const checks = [
    [`/accounts/${ACCOUNT}/workers/scripts/${WORKER}/settings`, 'cloudflare_worker_access_failed'],
    [`/accounts/${ACCOUNT}/containers/applications`, 'cloudflare_containers_access_failed'],
  ];
  for (const [resource, failure] of checks) {
    let response, body;
    try {
      response = await fetcher('https://api.cloudflare.com/client/v4' + resource,
        { method: 'GET', headers, signal, redirect: 'error' });
      body = await response.json();
    } catch { throw Error(failure); }
    if (!response.ok || body.success !== true) throw Error(failure);
  }
  return { result: 'passed', account: ACCOUNT, worker: WORKER,
    authenticationVerified: true, readAccessVerified: true,
    writeAccessVerified: false, imageBuildAttempted: false, deploymentAttempted: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await checkPublishAccess())); }
  catch (error) {
    const allowed = new Set(['cloudflare_api_token_missing', 'cloudflare_account_mismatch',
      'cloudflare_worker_access_failed', 'cloudflare_containers_access_failed']);
    console.error(JSON.stringify({ result: 'failed', stage: 'publish-access',
      reason: allowed.has(error?.message) ? error.message : 'cloudflare_access_check_failed',
      imageBuildAttempted: false, deploymentAttempted: false }));
    process.exitCode = 1;
  }
}
