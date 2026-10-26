import { boundedJSON, digest, FORGE_REVISION, NATIVE_SCHEMA } from './policy.mjs';
const PROTOCOL = 'cardstashy.match-input.v1';
const POLICY = 'forge-default-smart-v1';
const headers = token => ({ Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' });
const request = (path, token, init = {}) => new Request('http://host001.internal' + path, {
  headers: headers(token), redirect: 'manual', signal: AbortSignal.timeout(5000), ...init,
});
export function nativeAdapter(_env) {
  return {
    ready: true,
    async startOptions({ internalToken, allocation }) {
      return { enableInternet: false, entrypoint: ['python3', '/opt/host-service/bootstrap.py'],
        env: { HOST_INTERNAL_TOKEN: internalToken, HOST_ABSOLUTE_DEADLINE_MS: String(allocation.expiresAt) } };
    },
    async bootstrapExisting({ input, internalToken, fetchExisting, deadline, now, wait }) {
      let ready = false;
      while (now() < deadline) {
        try {
          const response = await fetchExisting(request('/bootstrap-ready', internalToken));
          if (response.status === 200) {
            const value = await boundedJSON(response, 1024, AbortSignal.timeout(5000));
            if (value.protocol !== PROTOCOL) throw new Error('bootstrap_protocol_mismatch');
            ready = true; break;
          }
          await response.body?.cancel().catch(() => {});
        } catch { /* only retry readiness GET, never initialization POST */ }
        await wait(250);
      }
      if (!ready) throw new Error('bootstrap_deadline');
      const body = JSON.stringify({ input });
      const response = await fetchExisting(request('/initialize', internalToken, { method: 'POST', body,
        headers: { ...headers(internalToken), 'Content-Length': String(new TextEncoder().encode(body).length) } }));
      await response.body?.cancel().catch(() => {});
      if (response.status !== 204) throw new Error('bootstrap_rejected');
      // No replay after timeout or ambiguous receipt. The host closes this ID.
    },
    async readStartupFailure({ epoch, internalToken, fetchExisting }) {
      const response = await fetchExisting(request('/state', internalToken));
      if (response.status !== 200 || response.headers.get('X-Host-Epoch') !== epoch) return null;
      const state = await boundedJSON(response, 4 * 1024 * 1024, AbortSignal.timeout(5000));
      if (state.status !== 'failed') return null;
      const receipt = state.initialization;
      return { code: receipt?.failureCode === 'unsupported_native_pregame_choice' ? 'unsupported_native_pregame_choice' : 'native_exact_validation_rejected',
        errors: (Array.isArray(receipt?.errors) ? receipt.errors : ['native_initialization_failed'])
          .filter(value => typeof value === 'string').slice(0, 20).map(value => value.slice(0, 512)) };
    },
    async confirmInitialization({ allocation, input, epoch, internalToken, fetchExisting }) {
      const response = await fetchExisting(request('/state', internalToken));
      if (response.status !== 200 || response.headers.get('X-Host-Epoch') !== epoch) throw new Error('initialization_epoch_mismatch');
      const state = await boundedJSON(response, 4 * 1024 * 1024, AbortSignal.timeout(5000));
      const receipt = state.initialization;
      if (state.schema !== NATIVE_SCHEMA || state.forgeRevision !== FORGE_REVISION
        || !['running', 'finished'].includes(state.status) || receipt?.schema !== 'cardstashy.forge-exact-initialization.v1'
        || receipt.supported !== true || receipt.legal !== true || receipt.registeredRosterVerified !== true || receipt.nativeRosterVerified !== true
        || receipt.engineRevision !== FORGE_REVISION || receipt.policyVersion !== POLICY || input.difficultyPolicyVersion !== POLICY
        || !Number.isSafeInteger(receipt.viewerId) || receipt.viewerId < 0
        || receipt.aiProfile !== 'Default' || receipt.controlMode !== 'smart' || receipt.viewerId !== state.viewer
        || receipt.requestDigest !== allocation.requestDigest || receipt.requestDigest !== await digest(input)
        || receipt.humanDigest !== allocation.deckDigests.human || receipt.opponentDigest !== allocation.deckDigests.opponent
        || !/^[a-f0-9]{64}$/.test(receipt.humanRosterDigest || '') || !/^[a-f0-9]{64}$/.test(receipt.opponentRosterDigest || '')
        || !Array.isArray(receipt.errors) || receipt.errors.length !== 0) throw new Error('native_exact_validation_rejected');
      // Do not return seats/rosters to the browser. The host needs identity,
      // evidence and digests, not opponent deck details or engine private zones.
      return { ...receipt, schema: NATIVE_SCHEMA };
    },
  };
}
