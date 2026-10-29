// SPDX-License-Identifier: GPL-3.0-or-later
// SERVER-ONLY coordinator for one global admission Durable Object.
// Caller must pass verified ownerId, not an ID taken from a browser body.
import { digest } from './session-authority.mjs';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const keyPattern = /^[A-Za-z0-9_-]{16,128}$/;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = code => { throw new TypeError(code); };
const only = (value, allowed) => object(value) && Object.keys(value).every(key => allowed.includes(key));

export function validateExactDeckInput(input) {
  if (!only(input, ['format', 'humanDeck', 'opponentDeck', 'difficultyPolicyVersion', 'startingPlayer', 'playStyle', 'extraOpponents'])
      || !['Commander', 'Standard', 'Modern', 'Pioneer', 'Legacy', 'Vintage', 'Pauper', 'Brawl'].includes(input.format)
      || typeof input.difficultyPolicyVersion !== 'string'
      || !/^[A-Za-z0-9._-]{1,80}$/.test(input.difficultyPolicyVersion)) fail('invalid_match_input');
  if (input.startingPlayer !== undefined || input.playStyle !== undefined) {
    if (!['random', 'first', 'second'].includes(input.startingPlayer) || !['quick', 'practice'].includes(input.playStyle)
        || input.playStyle === 'quick' && input.startingPlayer !== 'random') fail('invalid_starting_player_selection');
  }
  // A Commander pod: up to two more CPU seats, each with its own deck and level.
  const decks = [input.humanDeck, input.opponentDeck];
  if (input.extraOpponents !== undefined) {
    if (input.format !== 'Commander' || !Array.isArray(input.extraOpponents) || input.extraOpponents.length < 1 || input.extraOpponents.length > 2) fail('invalid_extra_opponents');
    for (const seat of input.extraOpponents) {
      if (!only(seat, ['deck', 'difficultyPolicyVersion']) || typeof seat.difficultyPolicyVersion !== 'string'
          || !/^[A-Za-z0-9._-]{1,80}$/.test(seat.difficultyPolicyVersion)) fail('invalid_extra_opponents');
      decks.push(seat.deck);
    }
  }
  for (const deck of decks) {
    // Accept the EXISTING CardStashy saved/imported snapshot. cards includes
    // declared commanders; commanders/commander designate those same copies.
    // Do not invent another deck model or split/remove/add those copies here.
    if (!object(deck) || deck.format !== input.format || !Array.isArray(deck.cards) || !deck.cards.length) fail('invalid_existing_deck_snapshot');
    let count = 0, entries = 0;
    for (const section of ['cards', 'side', 'commanders']) {
      if (section !== 'cards' && deck[section] === undefined) continue;
      if (!Array.isArray(deck[section])) fail('invalid_existing_deck_rows');
      for (const card of deck[section]) {
        entries++;
        if (!object(card) || typeof card.name !== 'string' || !card.name.trim() || card.name.length > 512
            || /[\u0000-\u001f\u007f]/.test(card.name)
            || !Number.isSafeInteger(card.qty) || card.qty < 1 || card.qty > 1000) fail('invalid_deck_entry');
        // Commander declarations are references to copies already in cards.
        if (section !== 'commanders') count += card.qty;
      }
    }
    if (deck.commander !== undefined && deck.commander !== null
        && (typeof deck.commander !== 'string' || deck.commander.length > 512)) fail('invalid_commander_designation');
    if (entries > 2500 || count > 2500) fail('deck_transport_limit');
  }
  // Clone; never trim names, sort sections/entries, replace cards or change
  // quantities or strip original printing/finish/import metadata. Native must
  // reconcile commander references and verify identity/legality/support.
  return structuredClone(input);
}

export class AdmissionLedger {
  constructor({ storage, now = Date.now, newId = () => crypto.randomUUID() }) {
    this.storage = storage;
    this.now = now;
    this.newId = newId;
  }

  // admitExact must validate BOTH decks with the real pinned adapter, without
  // starting a JVM or changing either accepted manifest. No permissive default.
  async reserve({ ownerId, idempotencyKey, input, admitExact }) {
    if (!uuid.test(ownerId || '') || !keyPattern.test(idempotencyKey || '')) fail('invalid_verified_admission');
    if (typeof admitExact !== 'function') return { status: 503, error: 'exact_deck_adapter_unavailable' };
    const exact = validateExactDeckInput(input);
    if (new TextEncoder().encode(JSON.stringify(exact)).length > 131072) fail('create_body_too_large');
    const [requestDigest, human, opponent, keyHash] = await Promise.all([
      digest(exact), digest(exact.humanDeck), digest(exact.opponentDeck), digest({ ownerId, idempotencyKey }),
    ]);
    const receiptKey = 'create:' + keyHash;
    const existing = await this.storage.get(receiptKey);
    if (existing) return existing.requestDigest === requestDigest
      ? { status: 202, allocation: existing.allocation, replay: true }
      : { status: 409, error: 'idempotency_key_reused' };
    let admission;
    try { admission = await admitExact(structuredClone(exact)); }
    catch { return { status: 503, error: 'exact_deck_admission_unavailable' }; }
    if (admission?.supported !== true || admission?.legal !== true) return { status: 422, error: 'decks_or_policy_not_admitted' };
    if (admission.humanDigest !== human || admission.opponentDigest !== opponent) return { status: 422, error: 'exact_deck_identity_mismatch' };
    // Precompute IDs outside transactions: callback retries cannot spawn or
    // generate different resources. No external side effects inside callback.
    const allocation = { matchId: this.newId(), generation: this.newId(), ownerId,
      deckDigests: { human, opponent }, requestDigest,
      createdAt: this.now(), expiresAt: this.now() + 7200000 };
    if (![allocation.matchId, allocation.generation].every(value => uuid.test(value))) fail('invalid_server_id');
    return this.storage.transaction(async txn => {
      const duplicate = await txn.get(receiptKey);
      if (duplicate) return duplicate.requestDigest === requestDigest
        ? { status: 202, allocation: duplicate.allocation, replay: true }
        : { status: 409, error: 'idempotency_key_reused' };
      const leases = await txn.get('leases') || [];
      // Expired leases are NOT automatically removed. A stalled or lost
      // container must be confirmed destroyed before its capacity is reused.
      if (leases.some(lease => lease.ownerId === ownerId)) return { status: 409, error: 'user_has_active_allocation' };
      if (leases.length >= 2) return { status: 503, error: 'global_match_capacity' };
      const rateKey = 'create-rate:' + ownerId;
      const recent = (await txn.get(rateKey) || []).filter(time => time > this.now() - 86400000);
      if (recent.length >= 100 || recent.filter(time => time > this.now() - 3600000).length >= 60
          || recent.filter(time => time > this.now() - 60000).length >= 3) return { status: 429, error: 'create_rate_limit' };
      recent.push(this.now());
      leases.push(allocation);
      await txn.put('leases', leases);
      await txn.put(rateKey, recent);
      await txn.put(receiptKey, { requestDigest, allocation, retainUntil: this.now() + 86400000 });
      return { status: 202, allocation, replay: false };
    });
  }

  // The caller must obtain this receipt from the trusted per-match authority,
  // never from a client. Generation binding prevents an old cleanup receipt
  // from releasing a newer allocation. This method must remain private RPC.
  async releaseAfterDestruction({ matchId, generation, confirmed }) {
    if (confirmed !== true) return false;
    return this.storage.transaction(async txn => {
      const leases = await txn.get('leases') || [];
      const remaining = leases.filter(lease => lease.matchId !== matchId || lease.generation !== generation);
      if (remaining.length === leases.length) return false;
      await txn.put('leases', remaining);
      return true;
    });
  }

  // Invoke from a future DO alarm, not from a browser. Never prune live leases.
  async pruneReceipts() {
    const receipts = await this.storage.list({ prefix: 'create:' });
    for (const [key, value] of receipts) {
      if (value.retainUntil <= this.now()) await this.storage.transaction(async txn => {
        const current = await txn.get(key);
        if (current && current.retainUntil <= this.now()) await txn.delete(key);
      });
    }
    const rates = await this.storage.list({ prefix: 'create-rate:' });
    for (const [key, values] of rates) {
      if (values.every(time => time <= this.now() - 86400000)) await this.storage.transaction(async txn => {
        // A reservation can update this key after list() produced its snapshot.
        // Recheck and delete atomically so an alarm cannot erase fresh quotas.
        const current = await txn.get(key);
        if (current && current.every(time => time <= this.now() - 86400000)) await txn.delete(key);
      });
    }
  }
}
