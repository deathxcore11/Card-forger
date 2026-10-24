import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  makeObservation,
  validateProposal,
  selectValidatedProposal,
  checkLoopLedger
} from './cpu-reference-contract.mjs';
import {
  responseFixture,
  proposal,
  ledgers,
  references,
  mulliganPolicyFixture
} from './cpu-reference-fixtures.mjs';

test('a response is authorized during the other seat turn', () => {
  const authority = responseFixture();
  const observation = makeObservation(authority);
  assert.equal(observation.decision.activeSeat, 0);
  assert.equal(observation.observerSeat, 1);
  const choice = proposal(authority, 'respond', 5, ['public-threat', 'own-response']);
  assert.equal(validateProposal(observation, choice, authority).candidateId, 'respond');
});

test('an unvalidated winning-looking candidate loses before score is considered', () => {
  const authority = responseFixture();
  const observation = makeObservation(authority);
  const result = selectValidatedProposal(observation, [
    proposal(authority, 'illegal-win', 1e100),
    proposal(authority, 'respond', 5, ['own-response']),
    proposal(authority, 'pass', 0)
  ], authority);
  assert.equal(result.selected.candidateId, 'respond');
  assert.deepEqual(result.rejected, [{candidateId: 'illegal-win', reason: 'UNVALIDATED_CHOICE'}]);
});

test('unknown opponent hand and draw order cannot influence the packet', () => {
  const original = responseFixture();
  const changed = structuredClone(original);
  changed.facts[2].values.name = 'Different unseen hand';
  changed.authoritySave = {libraryOrder: [99, 2, 5], rng: 123};
  assert.deepEqual(makeObservation(original), makeObservation(changed));
  assert(!JSON.stringify(makeObservation(original)).includes('Never visible'));
});

test('reasons cannot cite private evidence or expired reveal grants', () => {
  const authority = responseFixture();
  const observation = makeObservation(authority);
  const choice = proposal(authority, 'respond', 10, ['opponent-hand']);
  assert.throws(() => validateProposal(observation, choice, authority), /PRIVATE_OR_UNKNOWN_EVIDENCE/);

  authority.facts[2].visibility = 'granted';
  authority.grants = [{
    factId: 'opponent-hand',
    seat: 1,
    revision: 11,
    decisionId: authority.decision.id
  }];
  assert(!makeObservation(authority).facts.some(value => value.id === 'opponent-hand'));
  authority.grants[0].revision = 12;
  assert(makeObservation(authority).facts.some(value => value.id === 'opponent-hand'));
});

test('a changed live revision rejects a formerly legal choice', () => {
  const authority = responseFixture();
  const observation = makeObservation(authority);
  const choice = proposal(authority, 'respond', 10);
  authority.revision++;
  assert.throws(() => validateProposal(observation, choice, authority), /STALE_OBSERVATION/);
});

test('policy cannot forge the actor or mutate its supplied observation', () => {
  const authority = responseFixture();
  const observation = makeObservation(authority);
  const choice = proposal(authority, 'respond', 10);
  choice.observerSeat = 0;
  assert.throws(() => validateProposal(observation, choice, authority), /STALE_PROPOSAL/);

  const changed = structuredClone(observation);
  changed.facts[0].values.power = 99;
  assert.throws(() => validateProposal(changed, proposal(authority, 'respond'), authority), /OBSERVATION_CHANGED/);
});

test('finite ledgers distinguish mana deficit, sustaining loops and positive output', () => {
  assert.equal(checkLoopLedger(ledgers.lionDeficit).sustainable, false);
  assert.equal(checkLoopLedger(ledgers.squeeFoodChain).netTotal, 1);
  assert.equal(checkLoopLedger(ledgers.scepterThree).netTotal, 1);
  assert.equal(checkLoopLedger(ledgers.scepterTwo).netTotal, 0);
});

test('creature-only mana cannot fund abilities and a missing repeat path fails', () => {
  const restricted = {...ledgers.squeeFoodChain, spendOn: 'ability'};
  assert.equal(checkLoopLedger(restricted).reason, 'RESTRICTED_MANA');
  const finite = {...ledgers.scepterThree, repeatableAccess: false};
  assert.equal(checkLoopLedger(finite).reason, 'NO_REPEATABLE_ACCESS');
});

test('loop proposal requires a finite budget and preserved responses', () => {
  const authority = responseFixture();
  authority.candidates[0].loop = ledgers.squeeFoodChain;
  const observation = makeObservation(authority);
  const choice = {
    ...proposal(authority, 'respond', 5, ['own-response']),
    loopIterations: 20
  };
  assert.equal(validateProposal(observation, choice, authority).loopIterations, 20);
  for (const count of [undefined, Infinity, 0, 1001]) {
    assert.throws(
      () => validateProposal(observation, {...choice, loopIterations: count}, authority),
      /UNBOUNDED_LOOP/
    );
  }
  authority.candidates[0].loop = {...ledgers.squeeFoodChain, responseWindowsPreserved: false};
  assert.throws(
    () => validateProposal(makeObservation(authority), choice, authority),
    /RESPONSE_WINDOW_MISSING/
  );
});

test('policy packet rejects claims of win odds and arbitrary instructions', () => {
  const authority = responseFixture();
  const observation = makeObservation(authority);
  const overstated = {...proposal(authority, 'respond'), winProbability: 1};
  assert.throws(() => validateProposal(observation, overstated, authority), /UNDECLARED_FIELD/);
  assert.throws(
    () => selectValidatedProposal(observation, Array(65).fill(proposal(authority, 'respond')), authority),
    /CANDIDATE_BUDGET/
  );
});

test('reference provenance does not equate published UI with a private CPU policy', () => {
  assert(references.some(reference => reference.classification === 'published-ui'));
  assert(references.every(reference => reference.notEstablished && reference.translation && reference.url));
  const supplied = references.find(reference => reference.id === 'moxgate-supplied-captures');
  assert(supplied.notEstablished.includes('Private scoring'));
});

test('a copied casual-redraw affordance cannot bypass the format authority', () => {
  const authority = mulliganPolicyFixture();
  const observation = makeObservation(authority);
  const result = selectValidatedProposal(observation, [
    proposal(authority, 'friendly-redraw', 1000),
    proposal(authority, 'keep', 5)
  ], authority);
  assert.equal(result.selected.candidateId, 'keep');
  assert.equal(result.rejected[0].reason, 'UNVALIDATED_CHOICE');
});

test('a response proposal cannot execute outside its declared response window', () => {
  const authority = responseFixture();
  authority.decision.responseOpportunity = false;
  assert.throws(
    () => validateProposal(makeObservation(authority), proposal(authority, 'respond'), authority),
    /NO_RESPONSE_WINDOW/
  );
});

test('missing source classification cannot masquerade as observed evidence', () => {
  const authority = responseFixture();
  authority.provenance.classification = 'private-cpu-behavior';
  assert.throws(() => makeObservation(authority), /BAD_PROVENANCE/);
});

test('untrusted rejection labels cannot enter the evidence log and budgets stay finite', () => {
  const authority = responseFixture();
  const observation = makeObservation(authority);
  const result = selectValidatedProposal(observation, [
    proposal(authority, 'UNKNOWN_PRIVATE_NAME', 100)
  ], authority);
  assert.equal(result.rejected[0].candidateId, null);
  assert.throws(
    () => selectValidatedProposal(observation, [proposal(authority, 'pass')], authority, {maxCandidates: Infinity}),
    /CANDIDATE_BUDGET/
  );
});

test('fact fields enforce their declared scalar types', () => {
  const malformed = [
    {name: false},
    {power: '8'},
    {toughness: Infinity},
    {damage: -1},
    {counterCount: 1.5},
    {handCount: '7'},
    {libraryCount: false},
    {manaTotal: -1},
    {controller: '0'},
    {zone: 'Unknown private zone'},
    {manaRestriction: true},
    {responseAvailable: 1},
    {spellColors: ['C']}
  ];
  for (const values of malformed) {
    const authority = responseFixture();
    authority.facts[0].values = values;
    assert.throws(() => makeObservation(authority), /BAD_FACT/, JSON.stringify(values));
  }
  const authority = responseFixture();
  authority.facts[0].values.power = -1;
  authority.facts[0].values.spellColors = [];
  assert.equal(makeObservation(authority).facts.find(value => value.id === 'public-threat').values.power, -1);
});


test('ownership alone cannot reveal an own next draw while public counts remain usable', () => {
  const authority = responseFixture();
  authority.facts.push({
    id: 'own-hidden-library-card',
    ownerSeat: 1,
    visibility: 'own',
    values: {zone: 'Library', name: 'Unknown next draw', power: 9, toughness: 9}
  });
  authority.facts.push({
    id: 'own-library-count',
    ownerSeat: 1,
    visibility: 'public',
    values: {zone: 'Library', libraryCount: 30}
  });
  const changed = structuredClone(authority);
  changed.facts.find(value => value.id === 'own-hidden-library-card').values.name = 'Different next draw';
  changed.facts.find(value => value.id === 'own-hidden-library-card').values.power = 1;
  const observation = makeObservation(authority);
  assert.deepEqual(observation, makeObservation(changed));
  assert(!observation.facts.some(value => value.id === 'own-hidden-library-card'));
  assert.equal(observation.facts.find(value => value.id === 'own-library-count').values.libraryCount, 30);
  const privateReason = proposal(authority, 'respond', 5, ['own-hidden-library-card']);
  assert.throws(() => validateProposal(observation, privateReason, authority), /PRIVATE_OR_UNKNOWN_EVIDENCE/);

  // A properly scoped grant can expose that particular card at that decision.
  authority.facts.find(value => value.id === 'own-hidden-library-card').visibility = 'granted';
  authority.grants = [{
    factId: 'own-hidden-library-card',
    seat: 1,
    revision: authority.revision,
    decisionId: authority.decision.id
  }];
  assert(makeObservation(authority).facts.some(value => value.id === 'own-hidden-library-card'));
});

test('ledger totals reject overflow even when every individual amount is safe', () => {
  const base = {...ledgers.scepterThree, cost: {}, produced: {W: Number.MAX_SAFE_INTEGER, U: 1}};
  assert.throws(() => checkLoopLedger(base), /UNSAFE_LEDGER_TOTAL/);
  const costOverflow = {
    ...base,
    cost: {generic: Number.MAX_SAFE_INTEGER, W: 1},
    produced: {W: Number.MAX_SAFE_INTEGER}
  };
  assert.throws(() => checkLoopLedger(costOverflow), /UNSAFE_LEDGER_TOTAL/);
  const atBoundary = {...base, cost: {generic: 1}, produced: {W: Number.MAX_SAFE_INTEGER}};
  assert.equal(checkLoopLedger(atBoundary).netTotal, Number.MAX_SAFE_INTEGER - 1);
});
