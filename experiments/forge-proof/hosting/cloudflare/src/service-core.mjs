// SPDX-License-Identifier: GPL-3.0-or-later
// Provider-independent implementation; production calls actual ctx.container.
import { MatchAuthority, GatewayDriver, verifyHostUser, boundedJSON,
  FORGE_REVISION, NATIVE_SCHEMA, digest, abortable } from './policy.mjs';
import { ProvisionalAdmissionLedger } from './provisional-ledger.mjs';
import { trialPolicy, reserveTrialBudget } from './trial.mjs';
export const ORIGIN = 'https://cardstashy.com';
export const GLOBAL_NAME = 'forge-global-admission-v1';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID_RE = new RegExp('^' + UUID + '$', 'i');
const MATCH_PATH = new RegExp('^/api/play/matches/(' + UUID + ')(/actions)?$', 'i');
const STARTUP_MS = 120_000, IDLE_MS = 600_000, RETAIN_MS = 86_400_000;
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
});
const error = (code, status) => json({ error: code }, status,
  [429, 503].includes(status) ? { 'Retry-After': '30' } : {});
const publicAllocation = a => ({ matchId: a.matchId, generation: a.generation,
  deckDigests: a.deckDigests, expiresAt: a.expiresAt, forgeRevision: FORGE_REVISION, schema: NATIVE_SCHEMA });

// Byte and wall-time bound. A stalled authenticated upload cannot occupy a
// match's serial queue, or block close/expiry cleanup indefinitely.
export async function readJSONWithin(request, maximum, timeoutMs = 5000) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) throw new Error('invalid_json');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid_json');
  let timer;
  const read = async () => {
    const parts = []; let length = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength; if (length > maximum) throw new Error('body_too_large'); parts.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_json');
    return value;
  };
  try {
    return await Promise.race([read(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('body_timeout')), timeoutMs); })]);
  } catch (failure) {
    // Do not await a hostile stream's cancellation callback.
    void reader.cancel().catch(() => {}); throw failure;
  } finally { clearTimeout(timer); try { reader.releaseLock(); } catch {} }
}

// This is the ONLY default Worker entry point. No generic RPC/path forwarding.
// Its service binding is private; also keep origin + owner checks in each DO.
export async function routeHostRequest(request, env, verifyBearer) {
  const path = new URL(request.url).pathname;
  const route = MATCH_PATH.exec(path);
  if (path !== '/api/play/matches' && !route) return error('not_found', 404);
  if (path === '/api/play/matches' ? request.method !== 'POST'
    : !((!route[2] && ['GET', 'DELETE'].includes(request.method)) || (route[2] && request.method === 'POST'))) {
    return error('method_not_allowed', 405);
  }
  if (!await verifyHostUser(request, { verifyBearer, origin: ORIGIN })) return error('authentication_required', 401);
  if (path === '/api/play/matches') return env.FORGE_ADMISSION.getByName(GLOBAL_NAME).fetch(request);
  return env.FORGE_MATCHES.getByName(route[1].toLowerCase()).fetch(request);
}

// Rolling attempt limits, stored transactionally rather than per-isolate memory.
async function limited(storage, key, windows, now) {
  return storage.transaction(async txn => {
    const maximumWindow = Math.max(...windows.map(([ms]) => ms));
    const times = (await txn.get(key) || []).filter(time => time > now - maximumWindow);
    if (windows.some(([ms, count]) => times.filter(time => time > now - ms).length >= count)) return true;
    times.push(now); await txn.put(key, times); return false;
  });
}

export class AdmissionService {
  constructor({ ctx, env, verifyBearer, native, now = Date.now }) {
    Object.assign(this, { ctx, env, verifyBearer, native, now });
    this.storage = ctx.storage;
    this.ledger = new ProvisionalAdmissionLedger({ storage: this.storage, now });
  }
  async fetch(request) {
    if (new URL(request.url).pathname !== '/api/play/matches' || request.method !== 'POST') return error('not_found', 404);
    const user = await verifyHostUser(request, { verifyBearer: this.verifyBearer, origin: ORIGIN });
    if (!user) return error('authentication_required', 401);
    const trial = trialPolicy(this.env, this.now());
    if (!trial) return error('trial_unavailable_or_expired', 503);
    if (!trial.owners.includes(user.id)) return error('trial_not_authorized', 403);
    if (await limited(this.storage, 'attempt:' + user.id, [[60_000, 3], [3_600_000, 60]], this.now())) return error('create_attempt_rate_limit', 429);
    // Always alarm after attempts so rejected-user rate records are also pruned.
    await this.storage.setAlarm(this.now() + 60_000);
    let input;
    try { input = await readJSONWithin(request, 131072); }
    catch (e) { return error(['body_too_large', 'body_timeout'].includes(e.message) ? e.message : 'invalid_json', e.message === 'body_too_large' ? 413 : e.message === 'body_timeout' ? 408 : 400); }
    // Snapshot transport validation + bounded provisional resource admission.
    // Only the same allocated JVM can subsequently certify actual Forge decks.
    if (!this.native.ready) return error('exact_native_adapter_unavailable', 503);
    let result;
    try { result = await this.ledger.reserveProvisional({ ownerId: user.id,
      idempotencyKey: request.headers.get('Idempotency-Key'), input,
      lifetimeMs: Math.min(trial.matchMs, trial.expiresAt - this.now()),
      reserveGuard: (txn, allocation) => reserveTrialBudget(txn, allocation, trial, this.now()) }); }
    catch { return error('invalid_match_input', 400); }
    if (!result.allocation) return error(result.error, result.status);
    const allocation = result.allocation;
    if (!result.replay) {
      // The lease already exists transactionally. Failure here leaves capacity
      // occupied; global alarm reconciles it. Never repeat begin after uncertainty.
      await this.storage.put('startup:' + allocation.matchId, { generation: allocation.generation, phase: 'dispatching', at: this.now() });
      const startup = this.env.FORGE_MATCHES.getByName(allocation.matchId).begin(allocation, input)
        .catch(() => { /* uncertain: alarm queries recorded ID, never blind restart */ });
      // Return202 after durable admission, not after a120second JVM cold start.
      // waitUntil holds the ORIGINAL RPC only; it is never a retry mechanism.
      if (typeof this.ctx.waitUntil === 'function') this.ctx.waitUntil(startup);
      else await startup; // explicit local fixture contexts may omit waitUntil
    }
    return json({ ...publicAllocation(allocation), status: 'initializing', admissionState: 'provisional_native_validation_required', replay: result.replay }, 202);
  }
  async verifyLease(allocation) {
    const lease = (await this.storage.get('leases') || []).find(a => a.matchId === allocation?.matchId && a.generation === allocation?.generation);
    return !!lease && await digest(lease) === await digest(allocation);
  }
  // Private namespace-only RPC. Do NOT expose a /release route or accept a
  // caller-supplied confirmed flag. Ask the recorded match DO for proof instead.
  async release(matchId, generation) {
    if (!UUID_RE.test(matchId || '') || !UUID_RE.test(generation || '')) return false;
    const lease = (await this.storage.get('leases') || []).find(a => a.matchId === matchId && a.generation === generation);
    if (!lease) return false;
    const proof = await this.env.FORGE_MATCHES.getByName(matchId).destructionProof(generation);
    if (proof?.confirmed !== true || proof.generation !== generation) return false;
    const released = await this.ledger.releaseAfterDestruction({ matchId, generation, confirmed: true });
    if (released) await this.storage.delete('startup:' + matchId);
    return released;
  }
  async alarm() {
    const leases = await this.storage.get('leases') || [];
    for (const allocation of leases) {
      // Reconcile only; never call begin/start, even if the original RPC was lost.
      try {
        await this.env.FORGE_MATCHES.getByName(allocation.matchId).reconcile(allocation);
        await this.release(allocation.matchId, allocation.generation);
      } catch { /* occupied until confirmed; retain retry alarm */ }
    }
    await this.ledger.pruneReceipts();
    for (const [key, times] of await this.storage.list({ prefix: 'attempt:' })) {
      if (times.every(t => t <= this.now() - 3_600_000)) await this.storage.delete(key);
    }
    const live = (await this.storage.get('leases') || []).length;
    const rates = (await this.storage.list({ prefix: 'attempt:' })).size;
    const receipts = (await this.storage.list({ prefix: 'create:' })).size;
    if (live || rates || receipts) await this.storage.setAlarm(this.now() + (live ? 30_000 : 3_600_000));
  }
}

export class MatchService {
  constructor({ ctx, env, verifyBearer, native, now = Date.now, wait = ms => new Promise(r => setTimeout(r, ms)), newToken = () => crypto.randomUUID() + crypto.randomUUID() }) {
    Object.assign(this, { ctx, env, verifyBearer, native, now, wait, newToken });
    this.storage = ctx.storage;
    // Serialize external interactions as well as storage. A close cannot race a
    // readiness/start or a previously authenticated action in this isolate.
    this.tail = Promise.resolve();
  }
  serial(fn) { const result = this.tail.then(fn); this.tail = result.catch(() => {}); return result; }
  container() { if (!this.ctx.container) throw new Error('container_binding_missing'); return this.ctx.container; }
  async authority(record) {
    const driver = new GatewayDriver({ internalToken: record.internalToken,
      isRunning: async () => this.container().running,
      fetchExisting: async request => {
        const current = await this.storage.get('allocation');
        // Tombstone + generation first, then *existing* port. No Container.fetch.
        if (!current || current.generation !== record.generation || current.status !== 'running' || current.epoch !== record.epoch || !this.container().running) throw new Error('native_not_running');
        request.signal.throwIfAborted();
        return this.container().getTcpPort(8080).fetch(request);
      },
      stopExisting: async ({ expectedEpoch }) => {
        const current = await this.storage.get('allocation');
        if (!current || current.generation !== record.generation || current.epoch !== expectedEpoch) return { confirmed: false };
        await abortable(this.container().destroy(), AbortSignal.timeout(10000));
        return { confirmed: !this.container().running };
      },
    });
    const readExisting = driver.readExisting.bind(driver);
    driver.readExisting = async options => {
      const result = await readExisting(options);
      // The driver classifies transport/protocol failures before this metadata
      // removal. Never expose native initialization rosters through owner state.
      if (result?.snapshot) delete result.snapshot.initialization;
      return result;
    };
    return new MatchAuthority({ storage: this.storage, driver, verifyBearer: this.verifyBearer, origin: ORIGIN, now: this.now });
  }
  begin(allocation, input) { return this.serial(() => this.beginOnce(allocation, input)); }
  async beginOnce(allocation, input) {
    if (!this.native.ready) throw new Error('exact_native_initialization_unavailable');
    if (!UUID_RE.test(allocation?.matchId || '') || !UUID_RE.test(allocation.generation || '') || !UUID_RE.test(allocation.ownerId || '') || allocation.createdAt + STARTUP_MS <= this.now()) throw new Error('invalid_or_expired_allocation');
    if (!await this.env.FORGE_ADMISSION.getByName(GLOBAL_NAME).verifyLease(allocation) || await digest(input) !== allocation.requestDigest) throw new Error('unreserved_allocation_or_changed_input');
    const existing = await this.storage.get('allocation');
    if (existing) return { status: existing.status }; // includes tombstones, never restart
    // Namespaces are private, but also require the server admission lease. The
    // global caller supplied it; no public request ever reaches this method.
    const token = this.newToken();
    const record = { ...allocation, status: 'initializing', internalToken: token,
      startupDeadline: allocation.createdAt + STARTUP_MS, lastAuthorizedAt: this.now(), retainUntil: allocation.expiresAt + RETAIN_MS };
    await this.storage.put('allocation', record);
    await this.storage.setAlarm(record.startupDeadline);
    try {
      // The native bridge owns exact snapshot transport. Persisted initializing
      // means any crash before/after start is ambiguous and MUST NOT restart.
      const options = await this.native.startOptions({ input, allocation, internalToken: token });
      if (options?.enableInternet !== false || options?.env?.HOST_INTERNAL_TOKEN !== token || options?.env?.HOST_ABSOLUTE_DEADLINE_MS !== String(allocation.expiresAt)) throw new Error('unsafe_native_start_options');
      if (this.container().running) throw new Error('unexpected_existing_container');
      this.container().start(options);
      await this.container().setInactivityTimeout(IDLE_MS);
      if (this.native.bootstrapExisting) {
        await this.native.bootstrapExisting({ input, allocation, internalToken: token,
          deadline: record.startupDeadline, now: this.now, wait: this.wait,
          fetchExisting: request => { if (!this.container().running) throw new Error('native_not_running'); return this.container().getTcpPort(8080).fetch(request); } });
      }
      let ready = false, validationFailure = null;
      while (this.now() < record.startupDeadline) {
        if (!this.container().running) { await this.wait(250); continue; }
        try {
          const response = await this.container().getTcpPort(8080).fetch(new Request('http://host001.internal/ready', {
            headers: { Authorization: 'Bearer ' + token }, redirect: 'manual', signal: AbortSignal.timeout(5000),
          }));
          const epoch = response.headers.get('X-Host-Epoch');
          const ok = response.status === 200; await response.body?.cancel().catch(() => {});
          if (UUID_RE.test(epoch || '')) {
            record.epoch = epoch;
            if (ok) { ready = true; break; }
            if (this.native.readStartupFailure) {
              validationFailure = await this.native.readStartupFailure({ epoch, internalToken: token, fetchExisting: r => this.container().getTcpPort(8080).fetch(r) });
              if (validationFailure) break;
            }
          }
        } catch { /* readiness polling is not a restart or command replay */ }
        await this.wait(250);
      }
      if (validationFailure) {
        record.validation = validationFailure; await this.storage.put('allocation', record);
        throw Object.assign(new Error('native_exact_validation_rejected'), { nativeRejected: true });
      }
      if (!ready) throw new Error('startup_deadline');
      // Must compare native accepted raw snapshot digests/policy against this
      // allocation, not merely observe /ready or a plausible opening hand.
      const initialized = await this.native.confirmInitialization({ allocation, input, epoch: record.epoch,
        internalToken: token, fetchExisting: r => this.container().getTcpPort(8080).fetch(r) });
      if (!Number.isSafeInteger(initialized?.viewerId) || initialized.viewerId < 0 || initialized.schema !== NATIVE_SCHEMA || initialized.engineRevision !== FORGE_REVISION || initialized.policyVersion !== input.difficultyPolicyVersion || initialized.humanDigest !== allocation.deckDigests.human || initialized.opponentDigest !== allocation.deckDigests.opponent) throw new Error('native_initialization_receipt_mismatch');
      record.status = 'running'; await this.storage.put('allocation', record);
      const authority = await this.authority(record);
      await authority.initialize({ ...allocation, epoch: record.epoch, viewerId: initialized.viewerId });
      await this.storage.setAlarm(Math.min(record.expiresAt, this.now() + IDLE_MS));
      return { status: 'running' };
    } catch (failure) {
      await this.cleanup(record, failure.nativeRejected ? 'native_exact_validation_rejected' : 'startup_interrupted');
      return { status: 'interrupted' };
    }
  }
  async fetch(request) {
    if (request.method === 'POST') {
      const user = await verifyHostUser(request, { verifyBearer: this.verifyBearer, origin: ORIGIN });
      if (!user) return error('authentication_required', 401);
      const record = await this.storage.get('allocation');
      if (!record || record.ownerId !== user.id || new URL(request.url).pathname !== '/api/play/matches/' + record.matchId + '/actions') return error('match_not_found', 404);
      let body;
      try { body = await readJSONWithin(request, 20480); }
      catch (failure) { return error(failure.message === 'body_timeout' ? 'body_timeout' : 'invalid_json', failure.message === 'body_timeout' ? 408 : failure.message === 'body_too_large' ? 413 : 400); }
      request = new Request(request.url, { method: request.method, headers: request.headers, body: JSON.stringify(body), redirect: 'manual' });
    }
    return this.serial(() => this.handle(request));
  }
  async handle(request) {
    const user = await verifyHostUser(request, { verifyBearer: this.verifyBearer, origin: ORIGIN });
    if (!user) return error('authentication_required', 401);
    const record = await this.storage.get('allocation');
    const base = record && '/api/play/matches/' + record.matchId;
    const path = new URL(request.url).pathname;
    if (!record || record.ownerId !== user.id || (path !== base && path !== base + '/actions')) return error('match_not_found', 404);
    if (request.method === 'DELETE' && path === base) {
      return await this.cleanup(record, 'closed') ? new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } }) : error('cleanup_unconfirmed', 503);
    }
    if (!(request.method === 'GET' && path === base) && !(request.method === 'POST' && path === base + '/actions')) return error('method_not_allowed', 405);
    const terminal = await this.storage.get('match');
    if (request.method === 'GET' && terminal?.status === 'finished' && this.now() < record.retainUntil) return json({ matchId: record.matchId, generation: record.generation, status: 'finished', result: terminal.result });
    if (this.now() >= record.expiresAt || this.now() >= record.lastAuthorizedAt + IDLE_MS) {
      await this.cleanup(record, 'expired'); return error('match_expired', 410);
    }
    if (record.status === 'initializing') return json({ ...publicAllocation(record), status: 'initializing' }, 202);
    if (record.status !== 'running') {
      return json({ error: 'match_' + record.status, reason: record.reason || null, ...(record.validation ? { validation: record.validation } : {}) }, 410);
    }
    const windows = request.method === 'GET' ? [[1000, 4]] : [[1000, 10], [2000, 20]];
    if (await limited(this.storage, request.method === 'GET' ? 'poll-rate' : 'action-rate', windows, this.now())) return error('match_rate_limit', 429);
    const authority = await this.authority(record);
    const response = await authority.handle(request); // verifies actual bearer again
    const match = await this.storage.get('match');
    if (match?.status === 'finished') {
      await this.cleanup(record, 'finished'); // retain only rules-provided result
    } else if (match?.status !== 'running') {
      await this.cleanup(record, 'native_interrupted');
    } else if (response.ok) {
      record.lastAuthorizedAt = this.now(); await this.storage.put('allocation', record);
      await this.storage.setAlarm(Math.min(record.expiresAt, record.lastAuthorizedAt + IDLE_MS));
    }
    return response;
  }
  // Caller is serialized. Persist tombstone before ANY provider operation, and
  // use direct destroy of this unique DO instance even if readiness is broken.
  async cleanup(record, reason) {
    const current = await this.storage.get('allocation');
    if (!current || current.generation !== record.generation) return false;
    if (await this.storage.get('destructionConfirmed') === true) return true;
    current.status = ['finished', 'closed'].includes(reason) ? reason : 'interrupted';
    current.reason = reason; current.retainUntil = this.now() + RETAIN_MS;
    await this.storage.put('allocation', current);
    const match = await this.storage.get('match');
    if (match && match.status !== 'finished') { match.status = current.status; match.reason = reason; await this.storage.put('match', match); }
    await this.storage.setAlarm(this.now() + 30_000);
    try {
      // A stopped runtime may still be starting; destroy() cancellation is the
      // authoritative stop receipt. Never infer cleanup solely from running=false.
      await abortable(this.container().destroy(), AbortSignal.timeout(10000));
      if (this.container().running) return false;
      await this.storage.put('destructionConfirmed', true);
      delete current.internalToken; await this.storage.put('allocation', current);
      return true;
    } catch { return false; }
  }
  destructionProof(generation) { return this.serial(async () => {
    const record = await this.storage.get('allocation');
    return { generation: record?.generation, confirmed: record?.generation === generation && record.status !== 'running' && record.status !== 'initializing' && await this.storage.get('destructionConfirmed') === true };
  }); }
  reconcile(allocation) { return this.serial(async () => {
    let record = await this.storage.get('allocation');
    if (!record) {
      if (this.now() < allocation.createdAt + STARTUP_MS) return;
      // Crash before the begin RPC: tombstone the assigned ID. Delayed begin now
      // sees this record and cannot start after the reservation was released.
      record = { ...allocation, status: 'interrupted', lastAuthorizedAt: allocation.createdAt, retainUntil: this.now() + RETAIN_MS };
      await this.storage.put('allocation', record);
    }
    if (record.generation !== allocation.generation) return;
    const expired = this.now() >= record.expiresAt || this.now() >= record.lastAuthorizedAt + IDLE_MS;
    const pendingExpired = record.status === 'initializing' && this.now() >= record.startupDeadline;
    if (expired || pendingExpired || !['running', 'initializing'].includes(record.status)) await this.cleanup(record, record.reason || 'interrupted');
    else if (record.status === 'running' && !this.container().running) await this.cleanup(record, 'native_disappeared');
  }); }
  alarm() { return this.serial(async () => {
    const record = await this.storage.get('allocation');
    if (!record) return;
    if (['running', 'initializing'].includes(record.status)) {
      if (record.status === 'initializing' || this.now() >= record.expiresAt || this.now() >= record.lastAuthorizedAt + IDLE_MS || !this.container().running) await this.cleanup(record, 'expired');
      else await this.storage.setAlarm(Math.min(record.expiresAt, record.lastAuthorizedAt + IDLE_MS));
    } else if (!await this.storage.get('destructionConfirmed')) await this.cleanup(record, record.reason || 'interrupted');
    const current = await this.storage.get('allocation');
    if (await this.storage.get('destructionConfirmed')) {
      // Prune private command receipts after 24h; keep an irreversible minimal
      // tombstone so a delayed begin can never recreate this ID.
      if (this.now() >= current.retainUntil) {
        for (const [key] of await this.storage.list({ prefix: 'command:' })) await this.storage.delete(key);
        for (const key of ['match', 'poll-rate', 'action-rate']) await this.storage.delete(key);
        await this.storage.put('allocation', { matchId: current.matchId, generation: current.generation,
          status: 'closed', expiresAt: current.expiresAt, lastAuthorizedAt: current.lastAuthorizedAt,
          retainUntil: current.retainUntil });
      } else await this.storage.setAlarm(current.retainUntil);
    }
  }); }
}
