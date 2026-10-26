// SPDX-License-Identifier: GPL-3.0-or-later
// Host boundary only: no Magic rules. Bind to one match Durable Object storage.
// A real container driver and the existing verified-account helper must be
// supplied by integration. No default driver, credentials, or network startup.
export const FORGE_REVISION = 'e5a0f8156da70ffc7866f923bed371c0111707cd';
export const NATIVE_SCHEMA = 'cardstashy.forge-proof.v1';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const commandIdPattern = /^[A-Za-z0-9_-]{16,128}$/;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const error = (code, status) => json({ error: code }, status);
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// One operation at a time for each live storage identity. In particular, close
// drains an already-reserved dispatch before writing its tombstone; a queued
// action then sees that tombstone before it can reserve or contact native code.
// This also covers multiple authority facades over the same storage object in
// one isolate. The provider wrapper MUST serialize alarms and reconstruction
// across distinct storage wrappers/isolates; this is not a distributed lock.
const operationQueues = new WeakMap();
function serialized(storage, operation) {
  const previous = operationQueues.get(storage) || Promise.resolve();
  const result = previous.then(operation);
  const settled = result.then(() => {}, () => {});
  operationQueues.set(storage, settled);
  void settled.then(() => {
    if (operationQueues.get(storage) === settled) operationQueues.delete(storage);
  });
  return result;
}

// Bound awaits even when a read-only dependency forgets to observe the signal.
// Mutating transports must still honor cancellation before sending a request;
// aborting a wait cannot undo a native action already accepted by the engine.
export function abortable(value, signal) {
  if (!signal) return Promise.resolve(value);
  return new Promise((resolve, reject) => {
    const aborted = () => { cleanup(); reject(signal.reason || new Error('request_aborted')); };
    const cleanup = () => signal.removeEventListener('abort', aborted);
    // Observe the original promise even if cancellation has already happened.
    Promise.resolve(value).then(result => { cleanup(); resolve(result); }, failure => { cleanup(); reject(failure); });
    if (signal.aborted) { aborted(); return; }
    signal.addEventListener('abort', aborted, { once: true });
  });
}

export async function digest(value) {
  const canonical = item => {
    if (Array.isArray(item)) return item.map(canonical);
    if (plainObject(item)) return Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])]));
    return item;
  };
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
}

export async function boundedJSON(request, maximum, signal = request.signal) {
  // Safe even when a router calls this before MatchAuthority.handle and the
  // incoming Request has no useful deadline. A shorter caller signal wins.
  signal = AbortSignal.any([AbortSignal.timeout(5000), ...(signal ? [signal] : [])]);
  signal.throwIfAborted();
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) throw new Error('json_required');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('json_required');
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      let part;
      try { part = await abortable(reader.read(), signal); }
      catch (cause) {
        const failure = new Error('json_stream_unavailable', { cause });
        failure.code = 'HOST_JSON_STREAM_UNAVAILABLE';
        if (['AbortError', 'TimeoutError'].includes(cause?.name)) failure.name = cause.name;
        throw failure;
      }
      const { done, value } = part;
      if (done) break;
      size += value.byteLength;
      if (size > maximum) throw new Error('body_too_large');
      chunks.push(value);
    }
  } catch (failure) {
    // A broken source's cancel promise must not hold the lifecycle queue open.
    void reader.cancel().catch(() => {});
    throw failure;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of chunks) { bytes.set(part, offset); offset += part.byteLength; }
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!plainObject(value)) throw new Error('json_object_required');
  return value;
}

export async function verifyHostUser(request, { verifyBearer, origin }) {
  const url = new URL(request.url);
  if (url.origin !== origin || url.search || url.hash) return null;
  const incomingOrigin = request.headers.get('Origin');
  if (incomingOrigin && incomingOrigin !== origin) return null;
  if (request.method !== 'GET' && incomingOrigin !== origin) return null;
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') return null;
  const authorization = request.headers.get('Authorization');
  if (!/^Bearer [A-Za-z0-9._-]{1,8192}$/.test(authorization || '') || typeof verifyBearer !== 'function') return null;
  try {
    // The injected function MUST verify against the configured account provider.
    // JWT decoding and client-supplied user/seat fields are never authorization.
    const user = await abortable(verifyBearer(authorization, { signal: request.signal }), request.signal);
    return user?.is_anonymous === false && uuid.test(user.id || '') ? { id: user.id } : null;
  } catch { return null; }
}

/**
 * Driver contract (not implemented here):
 * readExisting({expectedEpoch}) -> {epoch, snapshot}; NEVER start/restart.
 * submitExisting(action, {expectedEpoch}) -> {epoch, status}; no retries.
 * The driver MUST send X-Expected-Host-Epoch to the Python gateway; checking the
 * epoch only after submission could mutate a replacement JVM's opening hand.
 * destroyExisting({expectedEpoch}) -> {confirmed:true}; stop recorded process.
 * All methods are bound to this one allocation, never client paths or IDs.
 * Storage must provide get/put/delete/list and transactional callback semantics.
 */
export class MatchAuthority {
  constructor({ storage, driver, verifyBearer, origin = 'https://cardstashy.com', now = Date.now, requestTimeoutMs = 10000 }) {
    if (!storage || !driver || typeof verifyBearer !== 'function') throw new TypeError('Explicit storage, driver and verified-account helper required');
    if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 10000) throw new TypeError('Request deadline must be 1..10000 milliseconds');
    this.storage = storage;
    this.driver = driver;
    this.verifyBearer = verifyBearer;
    this.origin = origin;
    this.now = now;
    this.requestTimeoutMs = requestTimeoutMs;
  }

  // SERVER-ONLY bootstrap after durable global admission. Never expose this
  // method as a public route or accept ownerId from an unverified browser body.
  async initialize({ ownerId, matchId, generation, epoch, viewerId, deckDigests, expiresAt }) {
    if (![ownerId, matchId, generation, epoch].every(value => uuid.test(value || ''))
        || !Number.isSafeInteger(viewerId) || viewerId < 0
        || !plainObject(deckDigests) || !['human', 'opponent'].every(key => /^[a-f0-9]{64}$/.test(deckDigests[key] || ''))
        || !Number.isSafeInteger(expiresAt) || expiresAt <= this.now() || expiresAt > this.now() + 7200000) {
      throw new TypeError('Invalid server allocation');
    }
    await this.storage.transaction(async txn => {
      if (await txn.get('match')) throw new Error('allocation_already_initialized');
      await txn.put('match', { ownerId, matchId, generation, epoch, viewerId,
        deckDigests: structuredClone(deckDigests), expiresAt, status: 'running',
        pendingCommand: null, commandCount: 0 });
    });
  }

  async interrupt(reason = 'native_interrupted') {
    await this.storage.transaction(async txn => {
      const match = await txn.get('match');
      if (!match || ['finished', 'closed', 'interrupted'].includes(match.status)) return;
      match.status = 'interrupted';
      match.reason = reason;
      await txn.put('match', match);
    });
  }

  handle(request) {
    return serialized(this.storage, () => {
      // Start the execution budget when this operation acquires the queue, so
      // a close waiting for a timed-out action still has time to destroy it.
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(this.requestTimeoutMs)]);
      signal.throwIfAborted();
      return this.handleSerialized(new Request(request, { signal }));
    });
  }

  async handleSerialized(request) {
    const user = await verifyHostUser(request, this);
    if (!user) return error('authentication_required', 401);
    const match = await this.storage.get('match');
    if (!match || match.ownerId !== user.id) return error('match_not_found', 404);
    const pathname = new URL(request.url).pathname;
    const base = `/api/play/matches/${match.matchId}`;
    if (pathname !== base && pathname !== base + '/actions') return error('match_not_found', 404);
    if (pathname === base && request.method === 'DELETE') return this.close(match, request.signal);
    if (this.now() >= match.expiresAt && match.status === 'running') {
      await this.interrupt('expired');
      return error('match_expired', 410);
    }
    if (match.status === 'finished' && pathname === base && request.method === 'GET') {
      return json({ matchId: match.matchId, generation: match.generation, status: 'finished', result: match.result });
    }
    if (match.status !== 'running') return error('match_' + match.status, 410);
    if (pathname === base && request.method === 'GET') return this.state(match, request.signal);
    if (pathname === base + '/actions' && request.method === 'POST') return this.action(request, match);
    return error('method_not_allowed', 405);
  }

  async state(match, signal) {
    let record;
    try {
      signal?.throwIfAborted();
      record = await abortable(this.driver.readExisting({ expectedEpoch: match.epoch, signal }), signal);
    }
    catch (failure) {
      const confirmedFailure = ['HOST_PROCESS_STOPPED', 'HOST_PROCESS_EPOCH_MISMATCH', 'HOST_STATE_PROTOCOL_FAILURE'].includes(failure?.code);
      if (!confirmedFailure && ((failure?.code === 'HOST_STATE_READ_UNAVAILABLE' && failure.retryable === true)
          || signal?.aborted || ['AbortError', 'TimeoutError'].includes(failure?.name))) {
        const current = await this.storage.get('match');
        if (current.status !== 'running') return error('match_' + current.status, 410);
        if (this.now() >= current.expiresAt) {
          await this.interrupt('expired');
          return error('match_expired', 410);
        }
        // Observation failure does not prove process loss and never clears a
        // pending mutation. The owner may retry this GET; we do not retry it.
        const response = error('native_state_temporarily_unavailable', 503);
        response.headers.set('Retry-After', '1');
        return response;
      }
      await this.interrupt(); return error('native_interrupted', 410);
    }
    const snapshot = record?.snapshot;
    if (record?.epoch !== match.epoch || snapshot?.schema !== NATIVE_SCHEMA
        || snapshot?.forgeRevision !== FORGE_REVISION || snapshot?.viewer !== match.viewerId
        || !['running', 'finished', 'failed'].includes(snapshot?.status)) {
      await this.interrupt('native_generation_or_projection_mismatch');
      return error('native_generation_or_projection_mismatch', 410);
    }
    // The native projection, rather than JavaScript filtering, owns visibility.
    // This guard checks identity/schema; actual hidden-information tests remain
    // a separate engine requirement. Never claim a full privacy proof here.
    if (snapshot.status === 'failed') { await this.interrupt(); return error('native_interrupted', 410); }
    if (snapshot.status === 'finished') {
      // Retain only a rules-provided terminal summary, not a full private board.
      if (typeof snapshot.draw !== 'boolean' || (!snapshot.draw && !Number.isSafeInteger(snapshot.winnerPlayerId))) {
        await this.interrupt('invalid_terminal_receipt');
        return error('invalid_terminal_receipt', 410);
      }
      const result = { draw: snapshot.draw, winnerPlayerId: snapshot.draw ? null : snapshot.winnerPlayerId };
      const committed = await this.storage.transaction(async txn => {
        const current = await txn.get('match');
        if (current.status !== 'running') return { status: current.status, result: current.result };
        current.status = 'finished'; current.result = result;
        await txn.put('match', current);
        return { status: current.status, result: current.result };
      });
      if (committed.status !== 'finished') return error('match_' + committed.status, 410);
      return json({ matchId: match.matchId, generation: match.generation, status: 'finished', result: committed.result });
    }
    const current = await this.storage.get('match');
    if (current.status !== 'running') return error('match_' + current.status, 410);
    return json({ matchId: match.matchId, generation: match.generation, status: 'running', snapshot });
  }

  async action(request, match) {
    let body;
    try { body = await boundedJSON(request, 20480); }
    catch (failure) { return error(failure.message === 'body_too_large' ? 'body_too_large' : 'invalid_json', failure.message === 'body_too_large' ? 413 : 400); }
    if (Object.keys(body).some(key => !['commandId', 'generation', 'action'].includes(key))
        || !commandIdPattern.test(body.commandId || '') || body.generation !== match.generation
        || !plainObject(body.action) || !Number.isSafeInteger(body.action.revision) || body.action.revision < 0
        || !['ok', 'cancel', 'card', 'player', 'stack', 'reply', 'concede', 'controlMode'].includes(body.action.op)
        || (body.action.op === 'controlMode' && (!['smart', 'full'].includes(body.action.value)
          || Object.keys(body.action).some(key => !['revision', 'op', 'value'].includes(key))))
        || new TextEncoder().encode(JSON.stringify(body.action)).length > 16384) return error('invalid_command_envelope', 400);
    // Clone the parsed JSON once; canonical hashing never changes the action
    // actually sent to native code. Native scalar/legality validation stays native.
    const hash = await digest(body);
    const key = 'command:' + body.commandId;
    const reservation = await this.storage.transaction(async txn => {
      const current = await txn.get('match');
      if (current.status !== 'running' || this.now() >= current.expiresAt) return { status: 410, error: 'match_unavailable' };
      const existing = await txn.get(key);
      if (existing) {
        if (existing.hash !== hash) return { status: 409, error: 'command_id_reused' };
        return { status: existing.status || 202, receipt: existing.receipt || { commandId: body.commandId, state: 'pending_outcome_unknown' } };
      }
      if (current.pendingCommand) return { status: 409, error: 'another_command_pending' };
      if (current.commandCount >= 20000) return { status: 429, error: 'command_receipt_limit' };
      current.pendingCommand = body.commandId;
      current.commandCount++;
      await txn.put('match', current);
      await txn.put(key, { hash, createdAt: this.now() });
      return { dispatch: true };
    });
    if (!reservation.dispatch) return reservation.error ? error(reservation.error, reservation.status) : json(reservation.receipt, reservation.status);
    let native;
    try {
      request.signal.throwIfAborted();
      native = await abortable(this.driver.submitExisting(structuredClone(body.action), { expectedEpoch: match.epoch, signal: request.signal }), request.signal);
    }
    catch {
      // Dispatch may already have succeeded. Persisted pending blocks all later
      // actions and retries until explicit server-side reconciliation. No replay.
      return json({ commandId: body.commandId, state: 'pending_outcome_unknown' }, 202);
    }
    if (native?.epoch !== match.epoch || ![202, 400, 409].includes(native?.status)) {
      await this.interrupt('native_generation_or_receipt_mismatch');
      return error('native_generation_or_receipt_mismatch', 410);
    }
    const receipt = { commandId: body.commandId, state: native.status === 202 ? 'accepted' : 'rejected' };
    await this.storage.transaction(async txn => {
      const stored = await txn.get(key);
      const current = await txn.get('match');
      await txn.put(key, { ...stored, status: native.status, receipt });
      if (current.pendingCommand === body.commandId) {
        current.pendingCommand = null;
        await txn.put('match', current);
      }
    });
    return json(receipt, native.status);
  }

  async close(match, signal) {
    // Tombstone first: concurrent state/action calls cannot resurrect or submit.
    await this.storage.transaction(async txn => {
      const match = await txn.get('match');
      match.status = match.status === 'finished' ? 'finished' : 'closed';
      await txn.put('match', match);
    });
    try {
      signal?.throwIfAborted();
      const receipt = await abortable(this.driver.destroyExisting({ expectedEpoch: match.epoch, signal }), signal);
      if (receipt?.confirmed !== true) return error('cleanup_unconfirmed', 503);
    } catch { return error('cleanup_unconfirmed', 503); }
    // Global admission MUST be released only after this confirmed flag exists.
    await this.storage.put('destructionConfirmed', true);
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  }
}
