# Translating references into CPU contracts

October 24, 2026. This is a versioned research contract and authored fixture
suite. It does not implement a trained CPU, prove playing strength, or describe
a competitor's private algorithm. The existing ungraded Forest/Bears policy
remains a separate smoke test.

## What each source can establish

| Source | Recorded evidence | Translation into CardStashy | Not established |
| --- | --- | --- | --- |
| Wizards Arena Sylvan Library diary | Published handling distinguishes default own-trigger yielding, Full Control and sequential choices when replacements matter | Preserve actual events and response rights when batching presentation; two four-life payments and two card put-backs remain separate events | A CPU's tactical evaluation or permission to merge distinct rule events |
| Wizards Arena Brothers' War State of the Game | Published automatic-payment preview for effects that care about colors spent | Use exact engine payment previews before commitment | Optimal mana allocation or a private auto-tapper strategy |
| Wizards Arena Neon Dynasty State of the Game | Published ninjutsu guidance discusses combat stops and manual control after damage | Check the actual combat window; preserve appropriate priority and responses | Correctness of our pinned candidate engine's ninjutsu implementation |
| October 24 guest Moxgate walkthrough | Root observed Keep Hand, a normal mulligan instruction and a separate Friendly Redraw in Pauper setup; hidden opponent card backs, phase stops and stack/log controls in a game | Keep optional casual policies separate from the selected format; preserve hidden faces and explicit stops | Complete rules correctness, format coverage or the CPU's reasons for a move |
| Thirteen supplied reference captures | Deck selection, opening hands, inspection and payment affordances | Review space, discoverability and input ownership | Hidden-information models, search depth, scoring weights or source code |

The source registry in `cpu-reference-fixtures.mjs` records an observation,
classification, URL, intended translation and explicit limit for each reference.
The Arena entries come from published documentation; the Moxgate walkthrough is
a narrow observation supplied by the root agent. The fixtures derived from
these are labeled **designed requirements**, not recordings of decisions made
by those systems. The supplied REA archive has been identified as the
`morluto/rea` inspection tool. Its inspection scope and limits are recorded in
[reference observations](play-reference-observations.md); it is not treated as
a named Magic CPU engine or evidence of a private decision policy.

Source URLs:

- [Arena Sylvan Library diary](https://magic.wizards.com/en/news/mtg-arena/dev-diary-sylvan-library).
- [Arena Brothers' War State of the Game](https://magic.wizards.com/en/news/mtg-arena/mtg-arena-state-game-the-brothers-war).
- [Arena Neon Dynasty State of the Game](https://magic.wizards.com/en/news/mtg-arena/mtg-arena-state-game-kamigawa-neon-dynasty-2022-02-09).
- [Moxgate guest solo](https://www.moxgate.com/solo).
- [Supplied image index](cardstashy-play-reference-index.json).

## Executable contract

`cpu-reference-contract.mjs` defines observation schema
`cardstashy.cpu-observation/1`, proposal schema `cardstashy.cpu-proposal/1`, and
contract version `cpu-reference-contract-v1`.

The **trusted engine adapter**, outside the policy worker, supplies the current
match, epoch, revision, observer, decision, authorized information grants and
candidate-validation declarations. The legality status, method and revision
fields are **trusted adapter declarations, not authenticated engine receipts**.
This module checks their shape and consistency; it cannot establish that the
adapter actually called an engine validator. It does not derive rules from
Oracle text. In this suite the authority snapshots are explicitly synthetic.
Connecting the contract to actual engine calls and testing their completeness
and privacy remain work.

The policy packet contains only allowlisted scalar facts and authorized
identities. The narrow `own` private scope admits only the observer's currently
permitted hand facts with `zone: Hand`; ownership alone never exposes an own
library card or next draw. Library identities require an explicit public basis
or a scoped information grant. Public hand/library counts remain usable without
revealing card identities. A temporary
reveal requires the exact observer, revision, decision and fact grant. Unknown
opponent hands, unseen library identities/order, raw engine saves and arbitrary
nested fields are absent. Changing only hidden worlds must leave the produced
packet unchanged. Legitimate information memory still needs its own versioned
policy; it is not invented here. Privacy depends on the adapter labeling
information correctly and issuing only engine-authorized grants. This validator
cannot detect an opponent secret mislabeled as a public card name, and these
synthetic tests do not prove that a real CPU is blind to private information.

Each proposal names an opaque candidate and permitted evidence IDs. Before a
score can matter, the authority must still match the epoch/revision/decision,
authorize the actor and carry the current adapter validation declaration for
the candidate. The actual engine still must revalidate before application.
A raw generated-candidate list is insufficient: the Head Games investigation
already showed that candidate enumeration can omit legal player choices.
Response decisions can occur during another player's turn. A response proposal
requires its declared response window; turn ownership does not grant or remove
that permission.

`selectValidatedProposal` is a deterministic ranker for already authored
proposals. It rejects stale, private-evidence or unvalidated proposals before
ranking their finite numeric scores, then uses a stable candidate-ID tie break.
It is not a contextual score generator, a win-probability model or a training
procedure. Production score weights, difficulty and playing strength are still
unimplemented and uncalibrated.

## Bounded combo examples

A loop proposal requires a chosen positive finite repetition count within the
configured budget, repeatable access and preserved response windows. A small
resource ledger separately checks colored costs, generic costs and restricted
mana use. It reports whether a simplified repeat pays for itself; it neither
executes a shortcut nor proves the whole combo or a winning outlet.

Authored examples make the intended distinctions reviewable:

| Simplified fixture | Expected contract result |
| --- | --- |
| Lion costs one generic plus one white; one token supplies one white | Reject the recurring mana deficit |
| Food Chain/Squee pays one generic plus two red and produces four red | One net mana, restricted to creature spells |
| Attempt to pay an activated ability with that creature-only mana | Reject restricted spending |
| Scepter/Reversal with three produced mana and two activation cost | One net mana, without claiming a red damage outlet |
| The same loop with two produced mana | Sustaining loop with zero net mana, without claiming a win |
| A loop that suppresses response windows or has no finite count | Reject |
| A visible-response fixture during the other player's turn | Permit only the current engine-validated response or pass |
| A huge score on an invalid spell or copied Friendly Redraw | Reject before ranking |

The ledger rejects unsafe accumulated mana totals even when each individual
input is a safe integer. This keeps its per-cycle output exact within the safe
integer range; it does not compute an arbitrarily large total for every proposed
repetition.

The ledger does not model hybrid/X costs, alternate costs, nonmana costs,
continuous effects, control changes or removal. Those require exact engine
state and more complete certificates before real loop execution. A positive
ledger is not an automatic victory, infinite general-purpose mana, or
permission to replay arbitrary cards from hand.

## Validation and limits

Run:

```sh
node --test experiments/phase-engine/test-cpu-reference-contract.mjs
```

The tests exercise an illegal high-score move, stale decisions, changed
observations, unauthorized evidence and reveal expiry, hidden-world packet
equality, a response on the opponent's turn, finite resource restrictions,
missing response windows, candidate budgets and the casual-redraw boundary.
They are schema and guard tests with designed positions, including malformed
scalar fields, own-library identity exclusion and aggregate arithmetic overflow.
They are not real policy decisions, authenticated engine
validation or gameplay measurements. No application imports, production
CPU, upstream rules implementation, service worker or default difficulty is
changed by this addition.
