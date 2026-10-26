// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit extension of HOST admission: a provisional resource reservation is
// NOT a native identity/legality/support admission. Reuses the same snapshot
// validator, digests, lease/receipt layout, release and pruning implementation.
import { AdmissionLedger, validateExactDeckInput } from './vendor/host001/admission-ledger.mjs';
import { digest } from './policy.mjs';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class ProvisionalAdmissionLedger extends AdmissionLedger {
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
      if (recent.length >= 100 || recent.filter(t => t > this.now() - 3600000).length >= 60 || recent.filter(t => t > this.now() - 60000).length >= 3) return { status: 429, error: 'create_rate_limit' };
      const denied = await reserveGuard(txn, allocation);
      if (denied) return denied;
      recent.push(this.now()); leases.push(allocation);
      await txn.put('leases', leases); await txn.put(rateKey, recent);
      await txn.put(key, { requestDigest, allocation, retainUntil: this.now() + 86400000 });
      return { status: 202, allocation, replay: false };
    });
  }
}
