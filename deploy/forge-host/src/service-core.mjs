// SPDX-License-Identifier: GPL-3.0-or-later
// Provider-independent implementation; production calls actual ctx.container.
import { MatchAuthority, GatewayDriver, verifyHostUser, boundedJSON,
  FORGE_REVISION, NATIVE_SCHEMA, digest, abortable } from './policy.mjs';
import { ProvisionalAdmissionLedger } from './provisional-ledger.mjs';
import { validateExactDeckInput } from './vendor/host001/admission-ledger.mjs';
import { admissionPolicy, allowsAccount, reserveAdmissionBudget, claimAdmissionBudget, settleAdmissionBudget, settleLeasesForCheck } from './admission-policy.mjs';
export const ORIGIN = 'https://cardstashy.com';
export const GLOBAL_NAME = 'forge-global-admission-v1';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID_RE = new RegExp('^' + UUID + '$', 'i');
const MATCH_PATH = new RegExp('^/api/play/matches/(' + UUID + ')(/actions)?$', 'i');
const safeText = text => String(text).replace(/[^A-Za-z0-9 _.:-]/g, '').replace(/ +/g, ' ').slice(0, 160) || 'unknown';
const startupFailure = failure => safeText(failure?.message || failure?.name || 'unknown');
// Ending a previous match must finish well inside the website's 15 s start request.
const STARTUP_MS = 120_000, IDLE_MS = 600_000, RETAIN_MS = 86_400_000, REPLACE_MS = 8_000;
// A warm engine (container, JVM and card database started while the player picks
// decks) waits this long for its match, then is destroyed and its capacity freed.
const WARM_MS = 180_000;
// A provider refusal ("no container instance") before the container answers is retried
// within the startup deadline; the message is Cloudflare's, matched loosely.
const ALLOCATION_ATTEMPTS = 3, NO_INSTANCE_RE = /no container instance/i;
const WARM_PATH = '/api/play/warm';
// Live states: a destruction proof is never given while a container may hold one.
const ACTIVE = ['running', 'initializing', 'warming'];
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,128}$/;
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
});
const error = (code, status) => json({ error: code }, status,
  [429, 503].includes(status) ? { 'Retry-After': '30' } : {});
const publicAllocation = a => ({ matchId: a.matchId, generation: a.generation,
  deckDigests: a.deckDigests, expiresAt: a.expiresAt, forgeRevision: FORGE_REVISION, schema: NATIVE_SCHEMA });

// Only the step names and seconds of a start in progress; nothing from the input.
const STEPS = ['options', 'claim', 'start', 'inactivity', 'bootstrap', 'ready', 'confirm', 'authority'];
function startupProgress(progress, sinceMs) {
  if (!progress || !STEPS.includes(progress.step)) return null;
  const ms = {};
  for (const name of STEPS) if (Number.isSafeInteger(progress.ms?.[name]) && progress.ms[name] >= 0) ms[name] = progress.ms[name];
  return { warm: progress.warm === true, step: progress.step, ms, sinceMs: Math.max(0, sinceMs) };
}

// A Durable Object has one alarm. Attempts and housekeeping may advance a
// wakeup, but must not postpone an earlier cleanup. Transaction retries are
// safe: this callback only reads and writes the alarm on the transaction.
async function scheduleNoLater(storage, at) {
  await storage.transaction(async txn => {
    const current = await txn.getAlarm();
    if (current === null || at < current) await txn.setAlarm(at);
  });
}

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
  if (path !== '/api/play/matches' && path !== WARM_PATH && !route) return error('not_found', 404);
  if (path === '/api/play/matches' || path === WARM_PATH ? request.method !== 'POST'
    : !((!route[2] && ['GET', 'DELETE'].includes(request.method)) || (route[2] && request.method === 'POST'))) {
    return error('method_not_allowed', 405);
  }
  if (!await verifyHostUser(request, { verifyBearer, origin: ORIGIN })) return error('authentication_required', 401);
  if (path === '/api/play/matches' || path === WARM_PATH) return env.FORGE_ADMISSION.getByName(GLOBAL_NAME).fetch(request);
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
  constructor({ ctx, env, verifyBearer, native, now = Date.now, replaceMs = REPLACE_MS }) {
    Object.assign(this, { ctx, env, verifyBearer, native, now, replaceMs });
    this.storage = ctx.storage;
    this.ledger = new ProvisionalAdmissionLedger({ storage: this.storage, now });
  }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (![WARM_PATH, '/api/play/matches'].includes(path) || request.method !== 'POST') return error('not_found', 404);
    const user = await verifyHostUser(request, { verifyBearer: this.verifyBearer, origin: ORIGIN });
    if (!user) return error('authentication_required', 401);
    const access = admissionPolicy(this.env, this.now());
    const trialMode = (this.env.FORGE_PLAY_ACCESS ?? 'trial') === 'trial';
    if (!access) return error(trialMode ? 'trial_unavailable_or_expired' : 'play_unavailable', 503);
    if (!allowsAccount(access, user.id)) return error(trialMode ? 'trial_not_authorized' : 'play_not_authorized', 403);
    if (path === WARM_PATH) return this.warm(user, access);
    if (await limited(this.storage, 'attempt:' + user.id, [[60_000, 3], [3_600_000, 60]], this.now())) return error('create_attempt_rate_limit', 429);
    // Always alarm after attempts so rejected-user rate records are also pruned.
    await scheduleNoLater(this.storage, this.now() + 60_000);
    let input;
    try { input = await readJSONWithin(request, 131072); }
    catch (e) { return error(['body_too_large', 'body_timeout'].includes(e.message) ? e.message : 'invalid_json', e.message === 'body_too_large' ? 413 : e.message === 'body_timeout' ? 408 : 400); }
    // Snapshot transport validation + bounded provisional resource admission.
    // Only the same allocated JVM can subsequently certify actual Forge decks.
    if (!this.native.ready) return error('exact_native_adapter_unavailable', 503);
    try { this.native.validateAdmissionInput?.(input); }
    catch { return error('unsupported_explicit_cpu_policy', 422); }
    // Only a start that can actually be reserved may end the account's previous match.
    const idempotencyKey = request.headers.get('Idempotency-Key');
    try { validateExactDeckInput(input); } catch { return error('invalid_match_input', 400); }
    if (!IDEMPOTENCY_KEY.test(idempotencyKey || '')) return error('invalid_match_input', 400);
    const lifetimeMs = access.mode === 'trial' ? Math.min(access.matchMs, access.expiresAt - this.now()) : access.matchMs;
    const reserveGuard = (txn, allocation) => reserveAdmissionBudget(txn, allocation, access, this.now());
    // The account's warm engine, when it is still waiting, becomes this match.
    const claimed = await this.claimWarm({ ownerId: user.id, idempotencyKey, input, access });
    if (claimed?.allocation) return this.dispatch(claimed, input);
    if (claimed) return error(claimed.error, claimed.status);
    const refused = await this.replacePreviousMatch({ ownerId: user.id, idempotencyKey, input, lifetimeMs, reserveGuard });
    if (refused) return refused.retryAfter ? json({ error: refused.error }, refused.status, { 'Retry-After': String(refused.retryAfter) }) : error(refused.error, refused.status);
    let result;
    try { result = await this.ledger.reserveProvisional({ ownerId: user.id, idempotencyKey, input, lifetimeMs, reserveGuard }); }
    catch { return error('invalid_match_input', 400); }
    if (!result.allocation) return error(result.error, result.status);
    return this.dispatch(result, input);
  }
  async dispatch(result, input) {
    const allocation = result.allocation;
    if (!result.replay) {
      // The lease already exists transactionally. Failure here leaves capacity
      // occupied; global alarm reconciles it. Never repeat begin after uncertainty.
      await this.storage.put('startup:' + allocation.matchId, { generation: allocation.generation, phase: 'dispatching', at: this.now() });
      const startup = this.env.FORGE_MATCHES.getByName(allocation.matchId).begin(allocation, input)
        // A start that failed has already destroyed its container. Release on the same
        // trusted proof now, so starting again does not wait for the next reconcile.
        .then(outcome => outcome?.status === 'interrupted' ? this.release(allocation.matchId, allocation.generation) : undefined)
        .catch(() => { /* uncertain: alarm queries recorded ID, never blind restart */ });
      // Return202 after durable admission, not after a120second JVM cold start.
      // waitUntil holds the ORIGINAL RPC only; it is never a retry mechanism.
      // DurableObjectState (not Worker ExecutionContext): compatibility_date
      // >=2026-10-01 protects pending DO RPC/waitUntil I/O for up to15minutes.
      // Deploy/runtime resets remain possible; durable alarms reconcile only.
      if (typeof this.ctx.waitUntil === 'function') this.ctx.waitUntil(startup);
      else await startup; // explicit local fixture contexts may omit waitUntil
    }
    return json({ ...publicAllocation(allocation), status: 'initializing', admissionState: 'provisional_native_validation_required', replay: result.replay }, 202);
  }
  // Start the engine for this account's next match before its decks are chosen. Best
  // effort: a refusal changes nothing, and the match then starts the usual way.
  // Never ends or replaces a match the account already has.
  async warm(user, access) {
    if (access.mode === 'trial' || !this.native.ready || typeof this.native.prewarmOptions !== 'function') return error('warm_unavailable', 409);
    // Under 'attempt:' so the alarm prunes it with the create attempts.
    if (await limited(this.storage, 'attempt:warm:' + user.id, [[60_000, 3], [3_600_000, 30]], this.now())) return error('warm_attempt_rate_limit', 429);
    await scheduleNoLater(this.storage, this.now() + 60_000);
    if ((await this.storage.get('leases') || []).some(lease => lease.ownerId === user.id)) return json({ status: 'busy' }, 200);
    const reserveGuard = (txn, allocation) => reserveAdmissionBudget(txn, allocation, access, this.now());
    let result;
    try { result = await this.ledger.reserveWarm({ ownerId: user.id, lifetimeMs: access.matchMs, warmMs: WARM_MS, reserveGuard }); }
    catch { return error('warm_unavailable', 409); }
    if (!result.allocation) return error(result.error, result.status);
    const lease = result.allocation;
    const warming = this.env.FORGE_MATCHES.getByName(lease.matchId).prewarm(lease)
      .then(outcome => outcome?.status === 'interrupted' ? this.release(lease.matchId, lease.generation) : undefined)
      .catch(() => { /* uncertain: the alarm reconciles the recorded ID */ });
    if (typeof this.ctx.waitUntil === 'function') this.ctx.waitUntil(warming); else await warming;
    return json({ status: 'warming', warmUntil: lease.warmUntil }, 202);
  }
  // Claim only an engine its match object still reports as waiting and alive.
  // Anything else falls through to the usual start, which ends the warm lease.
  async claimWarm({ ownerId, idempotencyKey, input, access }) {
    const warm = (await this.storage.get('leases') || []).find(lease => lease.ownerId === ownerId && lease.admissionState === 'warm');
    if (!warm || this.now() >= warm.warmUntil || access.mode === 'trial') return null;
    try {
      const status = await abortable(this.env.FORGE_MATCHES.getByName(warm.matchId).warmStatus(warm), AbortSignal.timeout(3000));
      if (status?.usable !== true) return null;
    } catch { return null; }
    try { return await this.ledger.claimWarm({ ownerId, idempotencyKey, input, claimGuard: (txn, allocation) => claimAdmissionBudget(txn, allocation, access) }); }
    catch { return null; }
  }
  // A new start ends the same account's previous match. First a dry run of the
  // reservation, as if that match had already ended: a start that would be refused
  // anyway (capacity, rate, allowance) leaves the current match running. Then each
  // previous lease is released only on that match's own destruction proof, like any
  // close, within REPLACE_MS. An end that was asked for but not proven in time may
  // still finish, so the start is refused as previous_match_ending (try again in a few
  // seconds), never as an active match the player could return to; nothing is retried
  // on the player's behalf. A replayed or reused Idempotency-Key never ends anything.
  async replacePreviousMatch({ ownerId, idempotencyKey, input, lifetimeMs, reserveGuard }) {
    const previous = (await this.storage.get('leases') || []).filter(lease => lease.ownerId === ownerId);
    if (!previous.length) return null;
    if (await this.storage.get('create:' + await digest({ ownerId, idempotencyKey }))) return null;
    let refused;
    try { refused = await this.ledger.checkReplacement({ ownerId, idempotencyKey, input, lifetimeMs, reserveGuard,
      // Settled as late as the real release can happen, so the check is never more
      // lenient than the reservation that follows it.
      simulateEnded: (txn, leases) => settleLeasesForCheck(txn, leases, this.now() + this.replaceMs) }); }
    catch { return { status: 400, error: 'invalid_match_input' }; }
    if (refused) return refused;
    const deadline = AbortSignal.timeout(this.replaceMs);
    for (const lease of previous) {
      try {
        const ended = await abortable(this.env.FORGE_MATCHES.getByName(lease.matchId).endForNewStart(lease), deadline);
        if (ended?.confirmed === true) await abortable(this.release(lease.matchId, lease.generation), deadline);
      } catch { /* unconfirmed: the lease stays and the alarm keeps reconciling it */ }
    }
    const held = (await this.storage.get('leases') || []).some(l => previous.some(p => p.matchId === l.matchId && p.generation === l.generation));
    return held ? { status: 503, error: 'previous_match_ending', retryAfter: 5 } : null;
  }
  // Private read-only namespace RPC for create202 -> first GET before begin has
  // persisted the per-match record. A UUID alone never establishes ownership.
  async pendingStatus(matchId, ownerId) {
    if (!UUID_RE.test(matchId || '') || !UUID_RE.test(ownerId || '')) return null;
    const lease = (await this.storage.get('leases') || [])
      .find(value => value.matchId === matchId && value.ownerId === ownerId);
    return lease ? { ...publicAllocation(lease), startupDeadline: lease.createdAt + STARTUP_MS } : null;
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
    // Bound this caller's wait; a timeout is not remote cancellation or proof
    // of destruction. A late result cannot resume this lease-release path.
    const proof = await abortable(this.env.FORGE_MATCHES.getByName(matchId).destructionProof(generation), AbortSignal.timeout(5000));
    if (proof?.confirmed !== true || proof.generation !== generation) return false;
    const released = await this.ledger.releaseAfterDestruction({ matchId, generation, confirmed: true });
    if (released) {
      await this.storage.delete('startup:' + matchId);
      try { await settleAdmissionBudget(this.storage, lease, this.now()); } catch { /* the full reservation stays charged */ }
    }
    return released;
  }
  async alarm() {
    const leases = await this.storage.get('leases') || [];
    // Persist a retry before remote work. One stalled match must not prevent
    // another allocation from being reconciled or erase the next cleanup.
    if (leases.length) await scheduleNoLater(this.storage, this.now() + 30_000);
    for (const allocation of leases) {
      // Reconcile only; never call begin/start, even if the original RPC was lost.
      try {
        await abortable(this.env.FORGE_MATCHES.getByName(allocation.matchId).reconcile(allocation), AbortSignal.timeout(5000));
        await this.release(allocation.matchId, allocation.generation);
      } catch { /* occupied until confirmed; retain retry alarm */ }
    }
    await this.ledger.pruneReceipts();
    for (const [key, times] of await this.storage.list({ prefix: 'attempt:' })) {
      if (times.every(t => t <= this.now() - 3_600_000)) await this.storage.transaction(async txn => {
        // A create request can commit fresh attempts after the list snapshot.
        // Recheck and delete atomically; never erase its rolling quota.
        const current = await txn.get(key);
        if (current && current.every(t => t <= this.now() - 3_600_000)) await txn.delete(key);
      });
    }
    const live = (await this.storage.get('leases') || []).length;
    const rates = (await this.storage.list({ prefix: 'attempt:' })).size;
    const receipts = (await this.storage.list({ prefix: 'create:' })).size;
    if (live || rates || receipts) await scheduleNoLater(this.storage, this.now() + (live ? 30_000 : 3_600_000));
  }
}

export class MatchService {
  constructor({ ctx, env, verifyBearer, native, now = Date.now, wait = ms => new Promise(r => setTimeout(r, ms)), newToken = () => crypto.randomUUID() + crypto.randomUUID() }) {
    Object.assign(this, { ctx, env, verifyBearer, native, now, wait, newToken });
    this.storage = ctx.storage;
    // Serialize external interactions as well as storage. A close cannot race a
    // readiness/start or a previously authenticated action in this isolate.
    this.tail = Promise.resolve();
    // Generation a new start of the same account asked to end, seen by a start
    // still opening in the serial queue.
    this.replacing = null;
    // The start still opening here, so a replacement can also abort its in-flight requests.
    this.opening = null;
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
        return { confirmed: this.container().running === false };
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
    // The only existing record a start may use: this lease's own warm engine, still
    // waiting. Its container already runs bootstrap and the JVM; nothing restarts.
    const warm = existing?.status === 'warming' && existing.generation === allocation.generation
      && existing.matchId === allocation.matchId && existing.ownerId === allocation.ownerId && this.now() < existing.startupDeadline;
    if (existing && !warm) return { status: existing.status }; // includes tombstones, never restart
    // Namespaces are private, but also require the server admission lease. The
    // global caller supplied it; no public request ever reaches this method.
    const token = warm ? existing.internalToken : this.newToken();
    const record = { ...allocation, status: 'initializing', internalToken: token,
      startupDeadline: allocation.createdAt + STARTUP_MS, lastAuthorizedAt: this.now(), retainUntil: allocation.expiresAt + RETAIN_MS };
    await this.storage.put('allocation', record);
    await this.storage.setAlarm(record.startupDeadline);
    // The startup step that failed, how far in, and how the container itself ended.
    // Platform errors carry no step of their own; this names it on the owner's screen.
    const began = this.now();
    let step = 'options', exited = null, lastPoll = 'none';
    // Seconds into startup at which each step began. Logged once per start (no input,
    // token or ids) so `wrangler tail` shows where a slow start spends its time.
    const timings = {};
    const enter = name => { step = name; timings[name] = this.now() - began;
      // The owner's loading screen shows these while the match starts (startupProgress).
      record.progress = { warm, step: name, ms: { ...timings } };
      this.storage.put('allocation', record).catch(() => {}); };
    const containerExited = () => exited && Object.assign(new Error('container_exited'), { containerExited: true });
    const replaced = () => this.replacing === allocation.generation && Object.assign(new Error('replaced_by_new_start'), { replaced: true });
    const stopIfReplaced = () => { const failure = replaced(); if (failure) throw failure; };
    const stop = new AbortController(); this.opening = { generation: allocation.generation, stop };
    // Any reply from the container means it may hold input, so allocation retries stop.
    let contacted = false, current = 0;
    const openFetch = async request => { const response = await this.container().getTcpPort(8080).fetch(new Request(request, { signal: AbortSignal.any([request.signal, stop.signal]) }));
      contacted = true; return response; };
    try {
      for (let attempt = 1; ; attempt++) { current = attempt; try {
          // The native bridge owns exact snapshot transport. Persisted initializing
          // means any crash before/after start is ambiguous and MUST NOT restart.
          if (warm) {
            enter('claim');
            stopIfReplaced();
            if (!this.container().running) throw new Error('warm_container_gone');
          } else {
            const options = await this.native.startOptions({ input, allocation, internalToken: token });
            if (options?.enableInternet !== false || options?.env?.HOST_INTERNAL_TOKEN !== token || options?.env?.HOST_ABSOLUTE_DEADLINE_MS !== String(allocation.expiresAt)) throw new Error('unsafe_native_start_options');
            enter('start');
            stopIfReplaced();
            if (this.container().running) throw new Error('unexpected_existing_container');
            this.container().start(options);
          }
          // Observe the container's own end (an exit code or a platform stop) without
          // waiting on it, so a crash ends startup now instead of at the deadline.
          let ended = null;
          try { ended = typeof this.container().monitor === 'function' ? this.container().monitor() : null; } catch { /* not observable */ }
          ended?.then?.(() => { if (attempt === current) exited = 'exit 0'; }, failure => { if (attempt === current) exited = startupFailure(failure).slice(0, 72); });
          enter('inactivity');
          await this.container().setInactivityTimeout(IDLE_MS);
          if (this.native.bootstrapExisting) {
            enter('bootstrap');
            await this.native.bootstrapExisting({ input, allocation, internalToken: token,
              deadline: record.startupDeadline, now: this.now, wait: async ms => { stopIfReplaced(); await this.wait(ms); stopIfReplaced(); },
              fetchExisting: request => { stopIfReplaced(); const gone = containerExited(); if (gone) throw gone; if (!this.container().running) throw new Error('native_not_running'); return openFetch(request); } });
          }
          enter('ready');
          let ready = false, validationFailure = null;
          while (this.now() < record.startupDeadline) {
            stopIfReplaced();
            const gone = containerExited(); if (gone) throw gone;
            if (!this.container().running) { lastPoll = 'not running'; await this.wait(250); continue; }
            try {
              const response = await openFetch(new Request('http://host001.internal/ready', {
                headers: { Authorization: 'Bearer ' + token }, redirect: 'manual', signal: AbortSignal.timeout(5000),
              }));
              const epoch = response.headers.get('X-Host-Epoch');
              const ok = response.status === 200; await response.body?.cancel().catch(() => {});
              lastPoll = 'ready ' + response.status;
              if (UUID_RE.test(epoch || '')) {
                record.epoch = epoch;
                if (ok) { ready = true; break; }
                if (this.native.readStartupFailure) {
                  validationFailure = await this.native.readStartupFailure({ epoch, internalToken: token, fetchExisting: openFetch });
                  if (validationFailure) break;
                }
              }
            } catch (failure) { lastPoll = startupFailure(failure).slice(0, 72); /* readiness polling is not a restart or command replay */ }
            await this.wait(250);
          }
          if (validationFailure) {
            record.validation = validationFailure; await this.storage.put('allocation', record);
            throw Object.assign(new Error('native_exact_validation_rejected'), { nativeRejected: true });
          }
          if (!ready) throw new Error('startup_deadline last ' + lastPoll);
          stopIfReplaced();
          enter('confirm');
          // Must compare native accepted raw snapshot digests/policy against this
          // allocation, not merely observe /ready or a plausible opening hand.
          const initialized = await this.native.confirmInitialization({ allocation, input, epoch: record.epoch,
            internalToken: token, fetchExisting: openFetch });
          if (!Number.isSafeInteger(initialized?.viewerId) || initialized.viewerId < 0 || initialized.schema !== NATIVE_SCHEMA || initialized.engineRevision !== FORGE_REVISION || initialized.policyVersion !== input.difficultyPolicyVersion || initialized.humanDigest !== allocation.deckDigests.human || initialized.opponentDigest !== allocation.deckDigests.opponent) throw new Error('native_initialization_receipt_mismatch');
          stopIfReplaced();
          enter('authority');
          record.status = 'running'; await this.storage.put('allocation', record);
          const authority = await this.authority(record);
          await authority.initialize({ ...allocation, epoch: record.epoch, viewerId: initialized.viewerId });
          await this.storage.setAlarm(Math.min(record.expiresAt, this.now() + IDLE_MS));
          timings.running = this.now() - began;
          console.log('forge_startup ' + JSON.stringify({ ...timings, warm }));
          return { status: 'running' };
      } catch (failure) {
        // The provider refused an instance before the container answered anything, so
        // no input reached an engine: start again within the same startup deadline,
        // after a destroy receipt. Anything ambiguous still fails closed below.
        if (warm || contacted || attempt >= ALLOCATION_ATTEMPTS || replaced() || failure?.replaced
          || !NO_INSTANCE_RE.test(startupFailure(failure) + ' ' + (exited || ''))
          || this.now() + attempt * 1000 >= record.startupDeadline) throw failure;
        try { await abortable(this.container().destroy(), AbortSignal.timeout(10000)); } catch { throw failure; }
        if (this.container().running !== false) throw failure;
        console.log('forge_startup_retry ' + JSON.stringify({ attempt, failedAt: step, after: this.now() - began }));
        exited = null; timings['retry' + attempt] = this.now() - began;
        await this.wait(attempt * 1000); stopIfReplaced();
      } }
    } catch (failure) {
      // Keep a short, character-limited cause so the owner's error screen can tell a
      // provider start failure from a readiness timeout. No stack, input or token.
      try {
        const seconds = ((this.now() - began) / 1000).toFixed(1);
        console.log('forge_startup_failed ' + JSON.stringify({ ...timings, warm, failedAt: step, after: this.now() - began }));
        record.failure = safeText('at ' + step + ' ' + seconds + 's: ' + startupFailure(failure) + (exited ? ' container ' + exited : ''));
        await this.storage.put('allocation', record);
      } catch { /* cleanup still runs */ }
      await this.cleanup(record, failure.nativeRejected ? 'native_exact_validation_rejected' : failure.replaced || replaced() ? 'replaced' : 'startup_interrupted');
      return { status: 'interrupted' };
    } finally { if (this.opening?.stop === stop) this.opening = null; }
  }
  // Private namespace RPC from admission: start this lease's container before the
  // match input exists. The container's bootstrap starts the JVM and card database at
  // once and takes the input later (begin). Unclaimed, it is destroyed at warmUntil.
  prewarm(lease) { return this.serial(async () => {
    if (!this.native.ready || typeof this.native.prewarmOptions !== 'function') return { status: 'unsupported' };
    if (!UUID_RE.test(lease?.matchId || '') || !UUID_RE.test(lease.generation || '') || !UUID_RE.test(lease.ownerId || '')
      || lease.admissionState !== 'warm' || !Number.isSafeInteger(lease.warmUntil) || lease.warmUntil <= this.now()) throw new Error('invalid_or_expired_allocation');
    if (!await this.env.FORGE_ADMISSION.getByName(GLOBAL_NAME).verifyLease(lease)) throw new Error('unreserved_allocation');
    const existing = await this.storage.get('allocation');
    if (existing) return { status: existing.status };
    const token = this.newToken();
    const record = { ...lease, status: 'warming', internalToken: token, startupDeadline: lease.warmUntil,
      lastAuthorizedAt: this.now(), retainUntil: lease.expiresAt + RETAIN_MS };
    await this.storage.put('allocation', record);
    await this.storage.setAlarm(record.startupDeadline);
    try {
      const options = await this.native.prewarmOptions({ allocation: lease, internalToken: token });
      if (options?.enableInternet !== false || options?.env?.HOST_INTERNAL_TOKEN !== token || options?.env?.HOST_ABSOLUTE_DEADLINE_MS !== String(lease.expiresAt)
        || options?.env?.HOST_PREWARM !== '1') throw new Error('unsafe_native_start_options');
      if (this.container().running) throw new Error('unexpected_existing_container');
      this.container().start(options);
      await this.container().setInactivityTimeout(IDLE_MS);
      console.log('forge_prewarm started');
      return { status: 'warming' };
    } catch (failure) {
      try { record.failure = safeText('at prewarm: ' + startupFailure(failure)); await this.storage.put('allocation', record); } catch { /* cleanup still runs */ }
      await this.cleanup(record, 'startup_interrupted');
      return { status: 'interrupted' };
    }
  }); }
  warmStatus(lease) { return this.serial(async () => {
    const record = await this.storage.get('allocation');
    let running = false;
    try { running = this.container().running === true; } catch { /* no container binding */ }
    return { usable: record?.status === 'warming' && record.generation === lease?.generation && record.ownerId === lease?.ownerId
      && this.now() < record.startupDeadline && running };
  }); }
  async fetch(request) {
    if (request.method === 'GET') {
      const route = MATCH_PATH.exec(new URL(request.url).pathname);
      const record = await this.storage.get('allocation');
      // A claimed warm engine reads as warming until begin runs: answer from its lease.
      if (route && !route[2] && (!record || ['initializing', 'warming'].includes(record.status))) {
        const user = await verifyHostUser(request, { verifyBearer: this.verifyBearer, origin: ORIGIN });
        if (!user) return error('authentication_required', 401);
        let pending;
        if (record?.status === 'initializing') {
          if (record.ownerId !== user.id || record.matchId !== route[1]) return error('match_not_found', 404);
          pending = { ...publicAllocation(record), startupDeadline: record.startupDeadline };
        } else {
          try {
            pending = await abortable(this.env.FORGE_ADMISSION.getByName(GLOBAL_NAME)
              .pendingStatus(route[1], user.id), AbortSignal.timeout(5000));
          } catch { return json({ error: 'match_status_temporarily_unavailable' }, 503, { 'Retry-After': '1' }); }
          if (!pending || !pending.deckDigests) return error('match_not_found', 404);
        }
        // Read-only initialization projection must not queue behind120s begin.
        // It neither invokes provider APIs nor changes/resumes an allocation.
        if (this.now() >= pending.startupDeadline || this.now() >= pending.expiresAt) return error('match_startup_interrupted', 410);
        const { startupDeadline, ...allocation } = pending;
        const progress = record?.status === 'initializing' ? startupProgress(record.progress, this.now() - record.createdAt) : null;
        return json({ ...allocation, status: 'initializing', ...(progress ? { progress } : {}) }, 202);
      }
    }
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
    const response = await this.serial(() => this.handle(request));
    // This must stay OUTSIDE serial(): admission.release calls destructionProof
    // back on this match, which itself needs the same serial queue. Await the
    // bounded proof-based release before replying so an explicit Rematch can
    // reserve immediately. A failed/uncertain RPC leaves alarm reconciliation.
    if (response.ok) await this.releaseConfirmedTerminal();
    return response;
  }
  async releaseConfirmedTerminal() {
    const record = await this.storage.get('allocation');
    if (!record || !['finished', 'closed'].includes(record.status)
      || await this.storage.get('destructionConfirmed') !== true) return;
    try {
      // No caller-supplied proof flag. The admission service asks this recorded
      // generation for trusted confirmation; never release just running=false.
      await abortable(this.env.FORGE_ADMISSION.getByName(GLOBAL_NAME)
        .release(record.matchId, record.generation), AbortSignal.timeout(5000));
    } catch { /* cleanup remains confirmed; global alarm retries lease release */ }
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
    if (request.method === 'GET' && terminal?.status === 'finished' && this.now() < record.retainUntil) {
      if (terminal.ownerId !== record.ownerId || terminal.matchId !== record.matchId || terminal.generation !== record.generation
          || !Number.isSafeInteger(terminal.viewerId) || terminal.viewerId < 0) return error('native_terminal_binding_mismatch', 410);
      // Also recover a crash after authority persisted the result but before
      // wrapper cleanup. Keep the canonical result even if cleanup needs retry.
      await this.cleanup(record, 'finished');
      return json({ matchId: record.matchId, generation: record.generation, status: 'finished', viewerId: terminal.viewerId, result: terminal.result });
    }
    if (this.now() >= record.expiresAt || this.now() >= record.lastAuthorizedAt + IDLE_MS) {
      await this.cleanup(record, 'expired'); return error('match_expired', 410);
    }
    if (record.status === 'initializing') return json({ ...publicAllocation(record), status: 'initializing' }, 202);
    if (record.status !== 'running') {
      return json({ error: 'match_' + record.status, reason: record.reason || null, ...(record.failure ? { failure: record.failure } : {}), ...(record.validation ? { validation: record.validation } : {}) }, 410);
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
      // A resolved destroy plus an unknown/falsy status is not a stopped
      // process receipt. Keep capacity occupied until explicitly false.
      if (this.container().running !== false) return false;
      await this.storage.put('destructionConfirmed', true);
      delete current.internalToken; await this.storage.put('allocation', current);
      return true;
    } catch { return false; }
  }
  // Private namespace-only RPC from admission for the same account's next start.
  // The flag is set before queueing so a start still opening stops at its next
  // check instead of holding the queue until its startup deadline.
  endForNewStart(allocation) {
    if (!UUID_RE.test(allocation?.matchId || '') || !UUID_RE.test(allocation?.generation || '') || !UUID_RE.test(allocation?.ownerId || '')) return Promise.resolve({ confirmed: false });
    this.replacing = allocation.generation;
    if (this.opening?.generation === allocation.generation) this.opening.stop.abort();
    return this.serial(async () => {
      let record = await this.storage.get('allocation');
      if (!record) {
        // Begin never ran here: a tombstone first, so a delayed begin cannot start it.
        record = { ...allocation, status: 'interrupted', reason: 'replaced', lastAuthorizedAt: allocation.createdAt, retainUntil: this.now() + RETAIN_MS };
        await this.storage.put('allocation', record);
      }
      if (record.generation !== allocation.generation || record.ownerId !== allocation.ownerId) return { confirmed: false };
      if (await this.storage.get('destructionConfirmed') !== true) {
        await this.cleanup(record, ACTIVE.includes(record.status) ? 'replaced' : record.reason || 'interrupted');
      }
      return { confirmed: await this.storage.get('destructionConfirmed') === true };
    }).finally(() => { if (this.replacing === allocation.generation) this.replacing = null; });
  }
  destructionProof(generation) { return this.serial(async () => {
    const record = await this.storage.get('allocation');
    return { generation: record?.generation, confirmed: record?.generation === generation && !ACTIVE.includes(record.status) && await this.storage.get('destructionConfirmed') === true };
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
    const pendingExpired = ['initializing', 'warming'].includes(record.status) && this.now() >= record.startupDeadline;
    if (expired || pendingExpired || !ACTIVE.includes(record.status)) await this.cleanup(record, record.reason || 'interrupted');
    else if (record.status === 'running' && !this.container().running) await this.cleanup(record, 'native_disappeared');
  }); }
  alarm() { return this.serial(async () => {
    const record = await this.storage.get('allocation');
    if (!record) return;
    if (ACTIVE.includes(record.status)) {
      if (record.status !== 'running' || this.now() >= record.expiresAt || this.now() >= record.lastAuthorizedAt + IDLE_MS || !this.container().running) await this.cleanup(record, 'expired');
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
