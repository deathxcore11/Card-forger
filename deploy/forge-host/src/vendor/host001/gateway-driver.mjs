// SPDX-License-Identifier: GPL-3.0-or-later
// Existing-process transport only. No start, create, retry, or public URL API.
import { abortable, boundedJSON } from './session-authority.mjs';
import { nativeActionRejection } from './action-rejection.mjs';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const transientStatus = status => [408, 429, 502, 503, 504].includes(status);
const failure = (code, message, retryable = false, cause) => {
  const result = Object.assign(new Error(message, { cause }), { code, retryable });
  if (['AbortError', 'TimeoutError'].includes(cause?.name)) result.name = cause.name;
  return result;
};
const readUnavailable = cause => failure('HOST_STATE_READ_UNAVAILABLE', 'native_state_temporarily_unavailable', true, cause);

export class GatewayDriver {
  constructor({ fetchExisting, isRunning, stopExisting, inspectExisting, internalToken, timeoutMs = 5000 }) {
    if (![fetchExisting, isRunning, stopExisting].every(fn => typeof fn === 'function')
        || (inspectExisting !== undefined && typeof inspectExisting !== 'function')
        || typeof internalToken !== 'string' || internalToken.length < 32
        || !/^[\x21-\x7e]+$/.test(internalToken)) throw new TypeError('Explicit existing-container operations and internal capability required');
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000) throw new TypeError('Transport deadline must be 1..5000 milliseconds');
    this.fetchExisting = fetchExisting;
    this.isRunning = isRunning;
    this.stopExisting = stopExisting;
    this.inspectExisting = inspectExisting;
    this.internalToken = internalToken;
    this.timeoutMs = timeoutMs;
  }

  deadline(signal) {
    return AbortSignal.any([AbortSignal.timeout(this.timeoutMs), ...(signal ? [signal] : [])]);
  }

  // seat 2 is the second person of a friend match: the same engine, that player's own view.
  async request(path, { expectedEpoch, action, signal, seat = 1 } = {}) {
    if (!['/state', '/action', '/ready'].includes(path)) throw new TypeError('Internal route not allowed');
    if (seat !== 1 && (seat !== 2 || path === '/ready')) throw new TypeError('Internal seat not allowed');
    if (!uuid.test(expectedEpoch || '')) throw new TypeError('Expected runtime epoch required');
    signal = this.deadline(signal);
    signal.throwIfAborted();
    let running;
    try { running = await abortable(this.isRunning(), signal); }
    catch (cause) {
      if (path !== '/state') throw cause;
      throw failure('HOST_PROCESS_STATUS_UNAVAILABLE', 'native_status_unavailable', true, cause);
    }
    if (running === false) throw failure('HOST_PROCESS_STOPPED', 'native_not_running');
    if (running !== true) throw failure('HOST_PROCESS_STATUS_UNAVAILABLE', 'native_status_unavailable', true);
    signal.throwIfAborted();
    const method = path === '/action' ? 'POST' : 'GET';
    const headers = { Authorization: 'Bearer ' + this.internalToken };
    let body;
    if (method === 'POST') {
      body = JSON.stringify(action);
      if (typeof body !== 'string' || new TextEncoder().encode(body).length > 16384) throw new TypeError('Native action size limit');
      headers['Content-Type'] = 'application/json';
      headers['X-Expected-Host-Epoch'] = expectedEpoch;
    }
    // The URL is a private routing placeholder consumed by fetchExisting. The
    // supplied function MUST use the recorded container's existing port only;
    // passing a Cloudflare helper that automatically starts is forbidden.
    const request = new Request('http://host001.internal' + (seat === 2 ? '/seat2' : '') + path, {
      method, headers, ...(body === undefined ? {} : { body }),
      redirect: 'manual', signal,
    });
    // fetchExisting MUST preserve Request.signal and must not send later after
    // cancellation. A possibly sent action is never retried by this driver.
    let response;
    try { response = await abortable(this.fetchExisting(request), signal); }
    catch (cause) {
      if (path !== '/state') throw cause;
      throw failure('HOST_TRANSPORT_UNAVAILABLE', 'native_transport_unavailable', true, cause);
    }
    const epoch = response.headers.get('X-Host-Epoch');
    if (epoch && epoch !== expectedEpoch) {
      void response.body?.cancel().catch(() => {});
      throw failure('HOST_PROCESS_EPOCH_MISMATCH', 'native_epoch_mismatch');
    }
    if (!epoch) {
      void response.body?.cancel().catch(() => {});
      // A provider-generated unavailable response may not have reached the
      // gateway. Missing identity is uncertainty, not proof of a new JVM.
      if (path === '/state' && transientStatus(response.status)) throw readUnavailable();
      throw failure('HOST_STATE_PROTOCOL_FAILURE', 'native_epoch_missing');
    }
    return response;
  }

  async readExisting({ expectedEpoch, signal, seat = 1 }) {
    signal = this.deadline(signal);
    let response;
    try { response = await this.request('/state', { expectedEpoch, signal, seat }); }
    catch (cause) {
      if (['HOST_TRANSPORT_UNAVAILABLE', 'HOST_PROCESS_STATUS_UNAVAILABLE'].includes(cause?.code)
          && cause.retryable === true) throw readUnavailable(cause);
      if (!cause?.code && (signal.aborted || ['AbortError', 'TimeoutError'].includes(cause?.name))) throw readUnavailable(cause);
      throw cause;
    }
    if (response.status !== 200) {
      void response.body?.cancel().catch(() => {});
      if (transientStatus(response.status)) throw readUnavailable();
      throw failure('HOST_STATE_PROTOCOL_FAILURE', 'native_state_unavailable');
    }
    let snapshot;
    try { snapshot = await boundedJSON(response, 4 * 1024 * 1024, signal); }
    catch (cause) {
      if (cause?.code === 'HOST_JSON_STREAM_UNAVAILABLE'
          || signal.aborted || ['AbortError', 'TimeoutError'].includes(cause?.name)) throw readUnavailable(cause);
      throw failure('HOST_STATE_PROTOCOL_FAILURE', 'invalid_native_state_payload', false, cause);
    }
    return { epoch: expectedEpoch, snapshot };
  }

  async submitExisting(action, { expectedEpoch, signal, onRejected, seat = 1 }) {
    // Never retry a possibly accepted POST. The authority reserves its command
    // receipt durably before calling this method and owns ambiguous outcomes.
    signal = this.deadline(signal);
    const response = await this.request('/action', { expectedEpoch, action, signal, seat });
    const status = response.status;
    if (status === 202 || ![400, 409].includes(status)) {
      void response.body?.cancel().catch(() => {});
      if (status !== 202) throw new Error('native_action_outcome_unknown');
      return { epoch: expectedEpoch, status };
    }
    // Publish the known outcome before awaiting optional diagnostics. The
    // authority's outer request deadline may expire while the body is read.
    onRejected?.({ epoch: expectedEpoch, status, error: 'native_action_rejected' });
    // The epoch-bound HTTP status already establishes rejection. A missing,
    // malformed or stalled diagnostic body must not change it to an ambiguous
    // dispatch or delay the queue beyond the original transport deadline.
    let reason;
    try { reason = (await boundedJSON(response, 1024, signal)).error; }
    catch { void response.body?.cancel().catch(() => {}); }
    return { epoch: expectedEpoch, status, error: nativeActionRejection(reason) };
  }

  async destroyExisting({ expectedEpoch, signal }) {
    if (!uuid.test(expectedEpoch || '')) throw new TypeError('Expected runtime epoch required');
    signal = this.deadline(signal);
    signal.throwIfAborted();
    const wait = value => abortable(value, signal);
    if (this.inspectExisting) {
      // Trusted provider/registry evidence, NOT HTTP readiness or client data.
      // The callback is bound to the immutable allocation and returns its
      // recorded epoch even after stop. stopExisting MUST enforce that same
      // identity atomically (or target a never-reused recorded instance ID).
      // An HTTP outage alone never authorizes killing an unrelated allocation.
      const before = await wait(this.inspectExisting({ expectedEpoch }));
      if (before?.epoch !== expectedEpoch || typeof before.running !== 'boolean') {
        throw new Error('native_process_identity_mismatch');
      }
      // Merely not running may mean startup is still pending. Only an explicit
      // trusted destruction receipt skips the idempotent recorded-instance stop.
      if (!before.running && before.destructionConfirmed === true) return { confirmed: true };
      signal.throwIfAborted();
      const result = await wait(this.stopExisting({ expectedEpoch }));
      if (result?.confirmed !== true) return { confirmed: false };
      const after = await wait(this.inspectExisting({ expectedEpoch }));
      return { confirmed: after?.epoch === expectedEpoch && after.running === false };
    }
    // Legacy transport-only callers have no trusted out-of-band identity.
    // Keep their HTTP epoch fence; production cleanup must inject the callback
    // above so an unavailable gateway cannot block recorded-instance teardown.
    // Unknown is not running, and even explicit false alone is not a trusted
    // destruction receipt for this allocation. Never infer proof from falsiness.
    if (await wait(this.isRunning()) !== true) return { confirmed: false };
    // Readiness may be 503 for a failed match, but its epoch must still match.
    const response = await this.request('/ready', { expectedEpoch, signal });
    void response.body?.cancel().catch(() => {});
    signal.throwIfAborted();
    const result = await wait(this.stopExisting({ expectedEpoch }));
    return { confirmed: result?.confirmed === true && await wait(this.isRunning()) === false };
  }
}
