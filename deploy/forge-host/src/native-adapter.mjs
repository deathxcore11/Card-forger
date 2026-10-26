import { boundedJSON, digest, FORGE_REVISION, NATIVE_SCHEMA } from './policy.mjs';
const PROTOCOL = 'cardstashy.match-input.v1';
const POLICY = 'forge-default-smart-v1';
const headers = token => ({ Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' });
const request = (path, token, init = {}) => new Request('http://host001.internal' + path, {
  headers: headers(token), redirect: 'manual', signal: AbortSignal.timeout(5000), ...init,
});
// At most `maximum` bytes of a reply as text; a longer or slower one is refused.
async function boundedText(response, maximum, signal) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const parts = []; let length = 0;
  const stop = new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('body_timeout')), { once: true }));
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), stop]); if (done) break;
      length += value.byteLength; if (length > maximum) throw new Error('body_too_large'); parts.push(value);
    }
  } catch (failure) { void reader.cancel().catch(() => {}); throw failure; }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return new TextDecoder().decode(bytes);
}
// Whether the single-use launcher still waits for input. Any other answer, or none,
// means it has gone (it took the input, or the container ended).
async function launcherWaiting(fetchExisting, token) {
  try {
    const response = await fetchExisting(request('/bootstrap-ready', token));
    if (response.status !== 200) { await response.body?.cancel().catch(() => {}); return false; }
    return (await boundedJSON(response, 1024, AbortSignal.timeout(5000)))?.protocol === PROTOCOL;
  } catch (failure) { if (failure?.containerExited || failure?.replaced) throw failure; return false; }
}
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
        } catch (failure) { if (failure?.containerExited) throw failure; /* only retry readiness GET, never initialization POST */ }
        await wait(250);
      }
      if (!ready) throw new Error('bootstrap_deadline');
      // The runtime derives the length of a string body itself; a second, hand-set
      // Content-Length is not sent alongside it.
      let response;
      try {
        response = await fetchExisting(request('/initialize', internalToken, { method: 'POST', body: JSON.stringify({ input }) }));
      } catch (failure) {
        if (failure?.containerExited || failure?.replaced) throw failure;
        // The reply was lost, not refused. The launcher takes input once and stops
        // answering the moment it does, so one look tells which without sending the
        // input again: still answering means it never took it. Gone, the ready and
        // confirm steps prove by digest that the engine holds exactly this input.
        if (await launcherWaiting(fetchExisting, internalToken)) throw new Error('bootstrap_input_not_taken ' + String(failure?.message || failure).slice(0, 60));
        return;
      }
      if (response.status !== 204) {
        // Name the launcher's own refusal (status and fixed code, never input) so the
        // owner's error screen tells a transport, size or write failure apart.
        // A reply that is not the launcher's own names its first words instead, so a
        // platform refusal reads as one rather than as the launcher's.
        let code = '', words = '';
        try {
          const text = await boundedText(response, 1024, AbortSignal.timeout(2000));
          try { code = String(JSON.parse(text)?.error || ''); }
          catch { words = text.replace(/[^A-Za-z0-9 ]+/g, ' ').replace(/ +/g, ' ').trim().slice(0, 60); }
        } catch { void response.body?.cancel().catch(() => {}); }
        throw new Error('bootstrap_rejected_' + response.status + (/^[a-z0-9_]{1,64}$/.test(code) ? '_' + code : words ? ' ' + words : ''));
      }
      await response.body?.cancel().catch(() => {});
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
