// SPDX-License-Identifier: GPL-3.0-or-later
// Existing app snapshot transport only. Does not prove native deck execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateExactDeckInput, AdmissionLedger } from '../admission-ledger.mjs';
import { digest } from '../session-authority.mjs';

const deck = JSON.parse(await readFile(new URL('./fixtures/existing-calling-all-angels.json', import.meta.url), 'utf8'));
const input = (human = deck, opponent = deck) => ({ format: human.format, humanDeck: human, opponentDeck: opponent,
  difficultyPolicyVersion: 'Default.full.frozen-proof' });
const copies = rows => rows.reduce((sum, row) => sum + row.qty, 0);

test('existing 100-card app snapshot survives host validation without another deck model', () => {
  const accepted = validateExactDeckInput(input());
  assert.deepEqual(accepted.humanDeck, deck);
  assert.deepEqual(accepted.opponentDeck, deck);
  assert.equal(copies(accepted.humanDeck.cards), 100);
  assert.equal(accepted.humanDeck.commander, 'Giada, Font of Hope');
  assert.equal(accepted.humanDeck.cards.filter(row => row.name === deck.commander).length, 1);
  assert.equal('main' in accepted.humanDeck, false);
  assert.equal('main_deck' in accepted.humanDeck, false);
});

test('host does not count or append a commander declaration as a second physical card', () => {
  const source = structuredClone(deck);
  source.commanders = [{ name: source.commander, qty: 1 }];
  const accepted = validateExactDeckInput(input(source));
  assert.equal(copies(accepted.humanDeck.cards), 100);
  assert.equal(accepted.humanDeck.cards.find(row => row.name === source.commander).qty, 1);
  assert.deepEqual(accepted.humanDeck.commanders, source.commanders);
});

test('same-name printing rows and import provenance remain separate and unchanged', () => {
  const source = { id: 'existing-import', name: 'Imported snapshot', format: 'Standard',
    cards: [{ name: 'Plains', qty: 30, set: 'ONE', collectorNumber: '262', finish: 'foil' },
      { name: 'Plains', qty: 30, set: 'DMU', collectorNumber: '264', finish: 'nonfoil' }],
    side: [{ name: 'Negate', qty: 4 }],
    import: { rows: [{ section: 'main', raw: { text: '30 Plains (ONE) 262 *F*' } }], source: 'existing parser' },
  };
  const accepted = validateExactDeckInput(input(source, source));
  assert.deepEqual(accepted.humanDeck, source);
  assert.equal(accepted.humanDeck.cards.length, 2);
  assert.equal(copies(accepted.humanDeck.cards), 60);
  assert.equal(copies(accepted.humanDeck.side), 4);
});

test('partner designations and original embedded commander copies are preserved for native review', () => {
  const source = { id: 'existing-partner-fixture', name: 'Partner snapshot', format: 'Commander',
    cards: [{ name: 'Partner A fixture', qty: 1 }, { name: 'Partner B fixture', qty: 1 }, { name: 'Island', qty: 98 }],
    commanders: [{ name: 'Partner A fixture', qty: 1 }, { name: 'Partner B fixture', qty: 1 }],
    commander: 'Partner A fixture', side: [] };
  assert.deepEqual(validateExactDeckInput(input(source)).humanDeck, source);
  // This is transport preservation, not a claim these fictional fixture partners are legal.
});

test('a different commander designation changes the source digest', async () => {
  const changed = structuredClone(deck); changed.commander = 'Different designation fixture';
  assert.notEqual(await digest(deck), await digest(changed));
});

test('older invented generic deck shape is rejected instead of silently converted', () => {
  const invented = { format: 'Commander', main: [{ name: 'Plains', quantity: 99 }], commanders: [{ name: deck.commander, quantity: 1 }], sideboard: [], companion: [] };
  assert.throws(() => validateExactDeckInput(input(invented)), /existing_deck_snapshot/);
});

test('malformed saved quantities or a mismatched format are rejected without repair', () => {
  const invalid = structuredClone(deck); invalid.cards[0].qty = 0;
  assert.throws(() => validateExactDeckInput(input(invalid)), /invalid_deck_entry/);
  const mismatch = structuredClone(deck); mismatch.format = 'Standard';
  assert.throws(() => validateExactDeckInput(input(deck, mismatch)), /existing_deck_snapshot/);
});

test('Modern uses the same existing snapshot shape and retains its sideboard', () => {
  const modern = { id: 'existing-modern-fixture', name: 'Modern source fixture', format: 'Modern',
    cards: [{ name: 'Island', qty: 60 }], side: [{ name: 'Negate', qty: 4 }],
    source: { selectedInExistingDecks: true } };
  const accepted = validateExactDeckInput(input(modern, modern));
  assert.deepEqual(accepted.humanDeck, modern);
  assert.equal(copies(accepted.humanDeck.cards), 60);
  assert.equal(copies(accepted.humanDeck.side), 4);
});

test('accepting Modern input syntax does not bypass native support admission', async () => {
  const modern = { id: 'existing-modern-fixture', name: 'Modern source fixture', format: 'Modern',
    cards: [{ name: 'Island', qty: 60 }], side: [] };
  const storage = { async get() { return undefined; }, async transaction() { throw Error('unsupported Modern must not reserve'); } };
  const ledger = new AdmissionLedger({ storage });
  const result = await ledger.reserve({ ownerId: '00000000-0000-4000-8000-000000000001', idempotencyKey: 'modern_source_fixture_01',
    input: input(modern, modern), admitExact: async () => ({ supported: false, legal: true }) });
  assert.equal(result.status, 422);
});

test('exact-deck native dependency sees the frozen selected snapshot even if saved source changes', async () => {
  const source = structuredClone(deck), before = structuredClone(source);
  const storage = { async get() { return undefined; }, async transaction() { throw Error('unsupported native result must not reserve'); } };
  const ledger = new AdmissionLedger({ storage });
  let received;
  const pending = ledger.reserve({ ownerId: '00000000-0000-4000-8000-000000000001', idempotencyKey: 'existing_snapshot_retry_01', input: input(source),
    admitExact: async exact => { received = exact; return { supported: false, legal: false }; } });
  source.cards[0].qty = 9;
  const result = await pending;
  assert.equal(result.status, 422);
  assert.deepEqual(received.humanDeck, before);
});
