// Source descriptions are provenance, not a claim about another app's CPU.
export const references = [
  {
    id: 'arena-sylvan-20260406',
    classification: 'published-ui',
    source: 'Wizards dev diary',
    url: 'https://magic.wizards.com/en/news/mtg-arena/dev-diary-sylvan-library',
    observation: 'Published UI handling distinguishes ordinary own-trigger yields, Full Control and sequential choices when replacement effects matter.',
    translation: 'Preserve underlying events and response rights when presentation batches choices.',
    notEstablished: 'Private CPU policy or a license to collapse distinct rules events.'
  },
  {
    id: 'arena-brothers-war',
    classification: 'published-ui',
    source: 'Wizards State of the Game',
    url: 'https://magic.wizards.com/en/news/mtg-arena/mtg-arena-state-game-the-brothers-war',
    observation: 'Published UI behavior includes inspecting automatic payment for spells affected by colors spent.',
    translation: 'Treat payment as an engine-owned preview before commitment.',
    notEstablished: 'An observed optimal strategy for spending mana.'
  },
  {
    id: 'arena-neon-dynasty-20220209',
    classification: 'published-ui',
    source: 'Wizards State of the Game',
    url: 'https://magic.wizards.com/en/news/mtg-arena/mtg-arena-state-game-kamigawa-neon-dynasty-2022-02-09',
    observation: 'Published ninjutsu guidance discusses combat stops and manual control after damage.',
    translation: 'Check the exact combat window and allow an actual response.',
    notEstablished: 'Correctness of the pinned Phase ninjutsu implementation.'
  },
  {
    id: 'moxgate-guest-20261024',
    classification: 'observed-ui',
    source: 'Root guest walkthrough, October 24, 2026',
    url: 'https://www.moxgate.com/solo',
    observation: 'Guest Pauper flow showed Keep Hand, a mulligan with a put-back instruction and a separate Friendly Redraw; the game exposed hidden opponent card backs, a phase stop control and a stack/log.',
    translation: 'Keep optional casual redraw rules separate from actual format mulligans; retain private faces and deliberate response stops.',
    notEstablished: 'Competitive mulligan correctness, full format support or the CPU strategy that selected a move.'
  },
  {
    id: 'moxgate-supplied-captures',
    classification: 'user-supplied-ui',
    source: 'CardStashy 13-image handoff index',
    url: '../../docs/cardstashy-play-reference-index.json',
    observation: 'Supplied reference captures show deck selection, opening hands, card inspection and payment controls.',
    translation: 'Use these to review affordances and spatial clarity.',
    notEstablished: 'Private scoring, hidden-information model or opponent search algorithm.'
  }
];

export function responseFixture() {
  return {
    provenance: {
      classification: 'designed-requirement',
      version: 'response-fixture-v1',
      referenceIds: ['arena-neon-dynasty-20220209', 'cardstashy-approved-response-contract']
    },
    matchId: 'fixture-match',
    epoch: 'fixture-epoch',
    revision: 12,
    observerSeat: 1,
    decision: {
      id: 'priority-12',
      actor: 1,
      kind: 'priority',
      responseOpportunity: true,
      activeSeat: 0
    },
    facts: [
      {
        id: 'public-threat',
        ownerSeat: 0,
        visibility: 'public',
        values: {name: 'Visible threat', controller: 0, power: 8, toughness: 8}
      },
      {
        id: 'own-response',
        ownerSeat: 1,
        visibility: 'own',
        values: {name: 'Held interaction', zone: 'Hand', responseAvailable: true}
      },
      {
        id: 'opponent-hand',
        ownerSeat: 0,
        visibility: 'own',
        values: {name: 'Never visible to this observer'}
      }
    ],
    candidates: [
      {
        id: 'respond',
        actor: 1,
        kind: 'response',
        legality: {status: 'validated', revision: 12, method: 'engine-preview'}
      },
      {
        id: 'pass',
        actor: 1,
        kind: 'pass-priority',
        legality: {status: 'validated', revision: 12, method: 'engine-preview'}
      },
      {
        id: 'illegal-win',
        actor: 1,
        kind: 'cast',
        legality: {status: 'candidate-only', revision: 12, method: 'enumeration'}
      }
    ]
  };
}

export function proposal(authority, candidateId, score = 0, reasonEvidenceIds = []) {
  return {
    schema: 'cardstashy.cpu-proposal/1',
    matchId: authority.matchId,
    epoch: authority.epoch,
    revision: authority.revision,
    observerSeat: authority.observerSeat,
    decisionId: authority.decision.id,
    candidateId,
    score,
    reasonEvidenceIds
  };
}

export const ledgers = {
  lionDeficit: {
    cost: {generic: 1, W: 1},
    produced: {W: 1},
    manaRestriction: 'any',
    spendOn: 'creature-spell',
    repeatableAccess: true,
    responseWindowsPreserved: true
  },
  squeeFoodChain: {
    cost: {generic: 1, R: 2},
    produced: {R: 4},
    manaRestriction: 'creature-spells-only',
    spendOn: 'creature-spell',
    repeatableAccess: true,
    responseWindowsPreserved: true
  },
  scepterThree: {
    cost: {generic: 2},
    produced: {C: 3},
    manaRestriction: 'any',
    spendOn: 'ability',
    repeatableAccess: true,
    responseWindowsPreserved: true
  },
  scepterTwo: {
    cost: {generic: 2},
    produced: {C: 2},
    manaRestriction: 'any',
    spendOn: 'ability',
    repeatableAccess: true,
    responseWindowsPreserved: true
  }
};

export function mulliganPolicyFixture() {
  const authority = responseFixture();
  authority.provenance = {
    classification: 'designed-requirement',
    version: 'mulligan-fixture-v1',
    referenceIds: ['moxgate-guest-20261024', 'cardstashy-format-legality-contract']
  };
  authority.decision = {
    id: 'mulligan-12',
    actor: 1,
    kind: 'mandatory-choice',
    responseOpportunity: false,
    activeSeat: 0
  };
  authority.candidates = [
    {
      id: 'keep',
      actor: 1,
      kind: 'mulligan-keep',
      legality: {status: 'validated', revision: 12, method: 'engine-preview'}
    },
    {
      id: 'mulligan',
      actor: 1,
      kind: 'mulligan-redraw-and-bottom',
      legality: {status: 'validated', revision: 12, method: 'engine-preview'}
    },
    {
      id: 'friendly-redraw',
      actor: 1,
      kind: 'casual-free-redraw',
      legality: {status: 'candidate-only', revision: 12, method: 'ui-reference'}
    }
  ];
  return authority;
}
