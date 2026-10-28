// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit extension of HOST admission: a provisional resource reservation is
// NOT a native identity/legality/support admission. Reuses the same snapshot
// validator, digests, lease/receipt layout, release and pruning implementation.
import { AdmissionLedger, validateExactDeckInput } from './vendor/host001/admission-ledger.mjs';
import { digest } from './policy.mjs';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLLBACK = Symbol('dry run');
const recentCreates = (recent, now) => recent.length >= 100 || recent.filter(t => t > now - 3600000).length >= 60 || recent.filter(t => t > now - 60000).length >= 3;
export class ProvisionalAdmissionLedger extends AdmissionLedger {
  // Would reserveProvisional admit this start once ownerId's own matches have ended?
  // The same capacity, rate and budget checks, with those matches as if ended and
  // settled. Nothing is written: the transaction is always rolled back. A refusal
  // here means the player's current match is left running.
  async checkReplacement({ ownerId, idempotencyKey, input, lifetimeMs, reserveGuard, simulateEnded }) {
    if (!uuid.test(ownerId || '') || !/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey || '')
      || !Number.isSafeInteger(lifetimeMs) || lifetimeMs < 1 || lifetimeMs > 7200000
      || typeof reserveGuard !== 'function' || typeof simulateEnded !== 'function') throw new TypeError('invalid_provisional_admission');
    const exact = validateExactDeckInput(input);
    const [human, opponent] = await Promise.all([digest(exact.humanDeck), digest(exact.opponentDeck)]);
    const allocation = { matchId: this.newId(), generation: this.newId(), ownerId, deckDigests: { human, opponent },
      createdAt: this.now(), expiresAt: this.now() + lifetimeMs, admissionState: 'provisional_native_validation_required' };
    let verdict = null;
    try {
      await this.storage.transaction(async txn => {
        const leases = await txn.get('leases') || [];
        const others = leases.filter(lease => lease.ownerId !== ownerId);
        if (others.length >= 2) verdict = { status: 503, error: 'global_match_capacity' };
        else if (recentCreates((await txn.get('create-rate:' + ownerId) || []).filter(t => t > this.now() - 86400000), this.now())) verdict = { status: 429, error: 'create_rate_limit' };
        else {
          await simulateEnded(txn, leases.filter(lease => lease.ownerId === ownerId));
          verdict = await reserveGuard(txn, allocation) || null;
        }
        throw ROLLBACK;
      });
    } catch (failure) { if (failure !== ROLLBACK) throw failure; }
    return verdict;
  }
  // A warm engine: capacity and runtime for one account's next match, reserved before
  // its decks are known. Only claimWarm binds it to a match; nothing else is admitted.
  async reserveWarm({ ownerId, lifetimeMs, warmMs, reserveGuard }) {
    if (!uuid.test(ownerId || '') || !Number.isSafeInteger(lifetimeMs) || lifetimeMs < 1 || lifetimeMs > 7200000
      || !Number.isSafeInteger(warmMs) || warmMs < 1 || warmMs >= lifetimeMs || typeof reserveGuard !== 'function') throw new TypeError('invalid_warm_admission');
    const allocation = { matchId: this.newId(), generation: this.newId(), ownerId, createdAt: this.now(),
      expiresAt: this.now() + lifetimeMs, warmUntil: this.now() + warmMs, admissionState: 'warm' };
    return this.storage.transaction(async txn => {
      const leases = await txn.get('leases') || [];
      if (leases.some(lease => lease.ownerId === ownerId)) return { status: 409, error: 'user_has_active_allocation' };
      if (leases.length >= 2) return { status: 503, error: 'global_match_capacity' };
      const denied = await reserveGuard(txn, allocation);
      if (denied) return denied;
      leases.push(allocation); await txn.put('leases', leases);
      return { status: 202, allocation };
    });
  }
  // Bind the account's warm engine to this match, keeping its IDs, container and
  // deadline. The same receipt and create rate as reserveProvisional. Null when there
  // is no warm engine to claim, so the caller starts a match the usual way.
  async claimWarm({ ownerId, idempotencyKey, input, claimGuard }) {
    if (!uuid.test(ownerId || '') || !/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey || '') || typeof claimGuard !== 'function') throw new TypeError('invalid_provisional_admission');
    const exact = validateExactDeckInput(input);
    if (new TextEncoder().encode(JSON.stringify(exact)).length > 131072) throw new TypeError('create_body_too_large');
    const [requestDigest, human, opponent, keyHash] = await Promise.all([
      digest(exact), digest(exact.humanDeck), digest(exact.opponentDeck), digest({ ownerId, idempotencyKey }),
    ]);
    const key = 'create:' + keyHash;
    return this.storage.transaction(async txn => {
      if (await txn.get(key)) return null; // a replay is answered by reserveProvisional
      const leases = await txn.get('leases') || [];
      const owned = leases.filter(lease => lease.ownerId === ownerId);
      const warm = owned.length === 1 && owned[0].admissionState === 'warm' && this.now() < owned[0].warmUntil ? owned[0] : null;
      if (!warm) return null;
      const rateKey = 'create-rate:' + ownerId;
      const recent = (await txn.get(rateKey) || []).filter(t => t > this.now() - 86400000);
      if (recentCreates(recent, this.now())) return { status: 429, error: 'create_rate_limit' };
      const allocation = { matchId: warm.matchId, generation: warm.generation, ownerId,
        deckDigests: { human, opponent }, requestDigest, createdAt: this.now(), expiresAt: warm.expiresAt,
        admissionState: 'provisional_native_validation_required', warmedAt: warm.createdAt };
      const denied = await claimGuard(txn, allocation);
      if (denied) return denied;
      recent.push(this.now());
      await txn.put('leases', leases.map(lease => lease === warm ? allocation : lease)); await txn.put(rateKey, recent);
      await txn.put(key, { requestDigest, allocation, retainUntil: this.now() + 86400000 });
      return { status: 202, allocation, replay: false, warmed: true };
    });
  }
  async reserveProvisional({ ownerId, idempotencyKey, input, lifetimeMs, reserveGuard }) {
    if (!uuid.test(ownerId || '') || !/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey || '')
      || !Number.isSafeInteger(lifetimeMs) || lifetimeMs < 1 || lifetimeMs > 7200000
      || typeof reserveGuard !== 'function') throw new TypeError('invalid_provisional_admission');
    const exact = validateExactDeckInput(input);
    if (new TextEncoder().encode(JSON.stringify(exact)).length > 131072) throw new TypeError('create_body_too_large');
    const [requestDigest, human, opponent, keyHash] = await Promise.all([
      digest(exact), digest(exact.humanDeck), digest(exact.opponentDeck), digest({ ownerId, idempotencyKey }),
    ]);
    const key = 'create:' + keyHash;
    const allocation = { matchId: this.newId(), generation: this.newId(), ownerId,
      deckDigests: { human, opponent }, requestDigest, createdAt: this.now(), expiresAt: this.now() + lifetimeMs,
      admissionState: 'provisional_native_validation_required' };
    return this.storage.transaction(async txn => {
      const duplicate = await txn.get(key);
      if (duplicate) return duplicate.requestDigest === requestDigest
        ? { status: 202, allocation: duplicate.allocation, replay: true }
        : { status: 409, error: 'idempotency_key_reused' };
      const leases = await txn.get('leases') || [];
      if (leases.some(lease => lease.ownerId === ownerId)) return { status: 409, error: 'user_has_active_allocation' };
      if (leases.length >= 2) return { status: 503, error: 'global_match_capacity' };
      const rateKey = 'create-rate:' + ownerId;
      const recent = (await txn.get(rateKey) || []).filter(t => t > this.now() - 86400000);
      if (recentCreates(recent, this.now())) return { status: 429, error: 'create_rate_limit' };
      const denied = await reserveGuard(txn, allocation);
      if (denied) return denied;
      recent.push(this.now()); leases.push(allocation);
      await txn.put('leases', leases); await txn.put(rateKey, recent);
      await txn.put(key, { requestDigest, allocation, retainUntil: this.now() + 86400000 });
      return { status: 202, allocation, replay: false };
    });
  }
}
