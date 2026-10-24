// Research contract only. The trusted adapter supplies authority and validation
// declarations. These fields are not authenticated engine receipts, and this
// module neither executes rules nor proves the adapter filtered private data.
export const OBSERVATION_SCHEMA = 'cardstashy.cpu-observation/1';
export const PROPOSAL_SCHEMA = 'cardstashy.cpu-proposal/1';
export const CONTRACT_VERSION = 'cpu-reference-contract-v1';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && /^[-\w.:]{1,160}$/.test(value);
const seat = value => Number.isInteger(value) && value >= 0 && value < 4;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const colorKeys = ['W', 'U', 'B', 'R', 'G', 'C'];
const spellColors = ['W', 'U', 'B', 'R', 'G'];
const zones = ['Library', 'Hand', 'Battlefield', 'Graveyard', 'Stack', 'Exile', 'Command'];

function bad(code) {
  throw Error(code);
}

function keys(value, allowed) {
  if (!isObject(value) || Object.keys(value).some(key => !allowed.includes(key))) {
    bad('UNDECLARED_FIELD');
  }
}

function identity(authority) {
  if (
    !isObject(authority) ||
    !id(authority.matchId) ||
    !id(authority.epoch) ||
    !integer(authority.revision) ||
    !seat(authority.observerSeat) ||
    !isObject(authority.decision) ||
    !id(authority.decision.id) ||
    !seat(authority.decision.actor)
  ) {
    bad('BAD_AUTHORITY');
  }
}

function permitted(value, authority) {
  if (!isObject(value)) bad('BAD_FACT');
  if (value.visibility === 'public') return true;
  if (value.visibility === 'own') {
    // Ownership does not reveal an own library or other hidden zone. This
    // narrow private scope admits only the observer's currently permitted
    // hand facts. Library identity needs an explicit public or scoped grant.
    return value.ownerSeat === authority.observerSeat && value.values?.zone === 'Hand';
  }
  if (value.visibility !== 'granted' || !Array.isArray(authority.grants)) return false;
  return authority.grants.some(grant =>
    grant.seat === authority.observerSeat &&
    grant.factId === value.id &&
    grant.revision === authority.revision &&
    grant.decisionId === authority.decision.id
  );
}

// Only these fields reach the policy. Privacy still depends on correct adapter
// labels and grant authority; this allowlist cannot detect a secret mislabeled
// as the name of a public card.
const factValidators = {
  name: value => typeof value === 'string' && value.length > 0 && value.length <= 180,
  controller: seat,
  zone: value => zones.includes(value),
  power: Number.isFinite,
  toughness: Number.isFinite,
  damage: integer,
  counterCount: integer,
  handCount: integer,
  libraryCount: integer,
  manaTotal: integer,
  manaRestriction: value => ['any', 'creature-spells-only'].includes(value),
  spellColors: value => Array.isArray(value) && value.every(color => spellColors.includes(color)),
  responseAvailable: value => typeof value === 'boolean'
};

function fact(value) {
  if (
    !isObject(value) ||
    !id(value.id) ||
    !['public', 'own', 'granted'].includes(value.visibility) ||
    !seat(value.ownerSeat) ||
    !isObject(value.values)
  ) {
    bad('BAD_FACT');
  }
  const values = {};
  for (const [key, validate] of Object.entries(factValidators)) {
    const scalar = value.values[key];
    if (scalar === undefined) continue;
    if (!validate(scalar)) bad('BAD_FACT');
    values[key] = Array.isArray(scalar) ? [...scalar] : scalar;
  }
  return {id: value.id, visibility: value.visibility, ownerSeat: value.ownerSeat, values};
}

// This checks a trusted adapter declaration's shape, not an authenticated proof
// that the engine accepted or previewed the move.
function validated(candidate, authority) {
  return isObject(candidate) &&
    id(candidate.id) &&
    candidate.actor === authority.observerSeat &&
    candidate.legality?.status === 'validated' &&
    candidate.legality.revision === authority.revision &&
    ['engine-preview', 'engine-submission-witness'].includes(candidate.legality.method);
}

export function makeObservation(authority) {
  identity(authority);
  const decision = authority.decision;
  const provenance = authority.provenance;
  if (
    !isObject(provenance) ||
    !['engine-observation', 'designed-requirement'].includes(provenance.classification) ||
    !id(provenance.version) ||
    !Array.isArray(provenance.referenceIds) ||
    provenance.referenceIds.some(reference => !id(reference))
  ) {
    bad('BAD_PROVENANCE');
  }
  if (!Array.isArray(authority.facts) || !Array.isArray(authority.candidates)) {
    bad('BAD_AUTHORITY');
  }
  if (
    !['priority', 'mandatory-choice', 'terminal'].includes(decision.kind) ||
    typeof decision.responseOpportunity !== 'boolean'
  ) {
    bad('BAD_DECISION');
  }

  const facts = authority.facts
    .filter(value => permitted(value, authority))
    .map(fact)
    .sort((left, right) => left.id.localeCompare(right.id));
  if (new Set(facts.map(value => value.id)).size !== facts.length) bad('DUPLICATE_FACT');

  const candidates = authority.candidates
    .filter(candidate => validated(candidate, authority))
    .map(candidate => ({
      id: candidate.id,
      kind: candidate.kind,
      requiresLoop: candidate.loop !== undefined
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  if (
    new Set(candidates.map(candidate => candidate.id)).size !== candidates.length ||
    candidates.some(candidate => typeof candidate.kind !== 'string' || candidate.kind.length > 80)
  ) {
    bad('BAD_CANDIDATE');
  }

  // A response can be owed on another player's turn. Turn owner is context,
  // not permission. A terminal/foreign decision offers this observer no action.
  const canAct = decision.actor === authority.observerSeat && decision.kind !== 'terminal';
  return {
    schema: OBSERVATION_SCHEMA,
    version: CONTRACT_VERSION,
    matchId: authority.matchId,
    epoch: authority.epoch,
    revision: authority.revision,
    observerSeat: authority.observerSeat,
    provenance: {
      classification: provenance.classification,
      version: provenance.version,
      referenceIds: [...provenance.referenceIds]
    },
    decision: {
      id: decision.id,
      actor: decision.actor,
      kind: decision.kind,
      responseOpportunity: decision.responseOpportunity,
      activeSeat: seat(decision.activeSeat) ? decision.activeSeat : null
    },
    facts,
    candidates: canAct ? candidates : []
  };
}

function amountMap(value) {
  if (
    !isObject(value) ||
    Object.keys(value).some(color => !colorKeys.includes(color) && color !== 'generic') ||
    Object.values(value).some(amount => !integer(amount))
  ) {
    bad('BAD_LEDGER');
  }
  const amounts = Object.fromEntries([...colorKeys, 'generic'].map(color => [color, value[color] || 0]));
  let total = 0;
  for (const amount of Object.values(amounts)) {
    total += amount;
    if (!Number.isSafeInteger(total)) bad('UNSAFE_LEDGER_TOTAL');
  }
  return amounts;
}

export function checkLoopLedger(loop) {
  keys(loop, [
    'cost', 'produced', 'manaRestriction', 'spendOn',
    'repeatableAccess', 'responseWindowsPreserved'
  ]);
  if (
    !['any', 'creature-spells-only'].includes(loop.manaRestriction) ||
    !['creature-spell', 'other-spell', 'ability'].includes(loop.spendOn) ||
    typeof loop.repeatableAccess !== 'boolean' ||
    typeof loop.responseWindowsPreserved !== 'boolean'
  ) {
    bad('BAD_LEDGER');
  }
  const cost = amountMap(loop.cost);
  const produced = amountMap(loop.produced);
  if (produced.generic) bad('BAD_LEDGER'); // Output mana has a real color/type.
  if (!loop.repeatableAccess) return {sustainable: false, reason: 'NO_REPEATABLE_ACCESS'};
  if (!loop.responseWindowsPreserved) return {sustainable: false, reason: 'RESPONSE_WINDOW_MISSING'};
  if (loop.manaRestriction === 'creature-spells-only' && loop.spendOn !== 'creature-spell') {
    return {sustainable: false, reason: 'RESTRICTED_MANA'};
  }

  const remaining = {};
  for (const color of colorKeys) {
    remaining[color] = produced[color] - cost[color];
    if (remaining[color] < 0) return {sustainable: false, reason: 'COLORED_MANA_DEFICIT'};
  }
  let generic = cost.generic;
  for (const color of colorKeys) {
    const paid = Math.min(generic, remaining[color]);
    remaining[color] -= paid;
    generic -= paid;
  }
  if (generic) return {sustainable: false, reason: 'MANA_DEFICIT'};
  return {
    sustainable: true,
    netMana: remaining,
    netTotal: Object.values(remaining).reduce((total, amount) => total + amount, 0)
  };
}

export function validateProposal(observation, proposal, live, {maxLoopIterations = 1000} = {}) {
  identity(live);
  if (observation?.schema !== OBSERVATION_SCHEMA || observation.version !== CONTRACT_VERSION) {
    bad('BAD_OBSERVATION');
  }
  if (
    observation.matchId !== live.matchId ||
    observation.epoch !== live.epoch ||
    observation.revision !== live.revision ||
    observation.observerSeat !== live.observerSeat ||
    observation.decision?.id !== live.decision.id
  ) {
    bad('STALE_OBSERVATION');
  }
  if (!same(observation, makeObservation(live))) bad('OBSERVATION_CHANGED');
  keys(proposal, [
    'schema', 'matchId', 'epoch', 'revision', 'observerSeat', 'decisionId',
    'candidateId', 'score', 'reasonEvidenceIds', 'loopIterations'
  ]);
  if (
    proposal.schema !== PROPOSAL_SCHEMA ||
    proposal.matchId !== live.matchId ||
    proposal.epoch !== live.epoch ||
    proposal.revision !== live.revision ||
    proposal.observerSeat !== live.observerSeat ||
    proposal.decisionId !== live.decision.id
  ) {
    bad('STALE_PROPOSAL');
  }
  if (live.decision.actor !== live.observerSeat || live.decision.kind === 'terminal') {
    bad('WRONG_ACTOR');
  }

  const candidate = live.candidates?.find(value => value.id === proposal.candidateId);
  // A valid adapter declaration is required before considering a score.
  // Candidate enumeration alone is not sufficient even as a declaration.
  if (
    !candidate ||
    !validated(candidate, live) ||
    !observation.candidates.some(value => value.id === candidate.id)
  ) {
    bad('UNVALIDATED_CHOICE');
  }
  if (
    candidate.kind === 'response' &&
    (live.decision.kind !== 'priority' || !live.decision.responseOpportunity)
  ) {
    bad('NO_RESPONSE_WINDOW');
  }
  if (!Number.isFinite(proposal.score)) bad('BAD_SCORE');

  const known = new Set(observation.facts.map(value => value.id));
  if (
    !Array.isArray(proposal.reasonEvidenceIds) ||
    proposal.reasonEvidenceIds.some(value => !known.has(value))
  ) {
    bad('PRIVATE_OR_UNKNOWN_EVIDENCE');
  }

  let loop = null;
  if (candidate.loop !== undefined) {
    if (
      !integer(maxLoopIterations) ||
      maxLoopIterations < 1 ||
      !Number.isSafeInteger(proposal.loopIterations) ||
      proposal.loopIterations < 1 ||
      proposal.loopIterations > maxLoopIterations
    ) {
      bad('UNBOUNDED_LOOP');
    }
    loop = checkLoopLedger(candidate.loop);
    if (!loop.sustainable) bad(loop.reason);
  } else if (proposal.loopIterations !== undefined) {
    bad('NOT_A_LOOP');
  }
  return {
    candidateId: candidate.id,
    score: proposal.score,
    reasonEvidenceIds: [...proposal.reasonEvidenceIds],
    ...(loop ? {loopIterations: proposal.loopIterations, loopLedger: loop} : {})
  };
}

// This ranks already authored proposals only. It is not a contextual policy,
// training procedure, calibrated probability, shortcut executor or win oracle.
export function selectValidatedProposal(observation, proposals, live, options = {}) {
  const budget = options.maxCandidates ?? 64;
  if (
    !Number.isSafeInteger(budget) ||
    budget < 1 ||
    budget > 4096 ||
    !Array.isArray(proposals) ||
    proposals.length < 1 ||
    proposals.length > budget
  ) {
    bad('CANDIDATE_BUDGET');
  }
  const accepted = [];
  const rejected = [];
  for (const proposal of proposals) {
    try {
      accepted.push(validateProposal(observation, proposal, live, options));
    } catch (error) {
      const declaredId = typeof proposal?.candidateId === 'string' &&
        live.candidates?.some(candidate => candidate.id === proposal.candidateId);
      rejected.push({candidateId: declaredId ? proposal.candidateId : null, reason: error.message});
    }
  }
  accepted.sort((left, right) => right.score - left.score || left.candidateId.localeCompare(right.candidateId));
  return {selected: accepted[0] || null, rejected};
}
