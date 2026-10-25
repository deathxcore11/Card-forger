# DECK-002: exact-list coverage inventory

**Next complete-deck milestone: Tramplesaurus Rex, led by Ghalta, Primal Hunger. It remains UNSUPPORTED.** This selection builds on existing bounded Ghalta/starter and DECK-001 evidence. It is not a claim that this is the easiest precon or that its commander has complete Commander coverage.

Owner: Rules / Game Machinery Lord; integration owns admission. Starting commit: `ed3175347bc86b346205f3cba102a73bd3494c6c`. Scope: an inventory generator, generated evidence and this milestone specification. Exact deck files, runtime, card database and coverage allowlist are unchanged.

## Definitions and execution are separate gates

| Exact deck | Total cards | Unique names | Missing compiled records | Present compiled records | Present records with parse warnings |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tramplesaurus Rex | 100 | 69 | 44 | 25 | 1 |
| Calling All Angels | 100 | 69 | 44 | 25 | 0 |

The [per-card inventory](evidence/deck-002-coverage-inventory.json) contains all 138 rows, quantities, definition hashes, missing/present classification, exact and normalized mapping candidates, compiled operation shapes, bounded evidence and separate human/CPU test status. The selected deck's 25 present records each have named decision fixtures still required for the complete-deck milestone.

The entire 6,137-record shipped database was checked for alternate matches using both keys and record names, normalizing Unicode, apostrophes, spaces and case. **None of the 44 missing names in either list had a normalized mapping candidate.** That rules out this particular simple naming/mapping explanation. It does not rule out an implementation in source or a parser capable of compiling the card.

Remediation is recorded honestly for every row:

- **Missing record:** add verified executable card data first, then test it. Whether a parser mapping or engine implementation also needs changing is **NOT TESTED**. Do not label all 44 as engine bugs or promise that a data import alone resolves them.
- **Present record:** validate the existing definition and required choices. Presence, an existing allowlist entry and absence of an `Unimplemented` marker are not full-card certification.
- **Known bounded pass:** retain its exact scope. For example, using Pugnacious Hammerskull as a damage target does not test its attack/stun ability. Righteous Valkyrie's Giada-counter test does not test its own life-gain or team-bonus abilities.
- **Parse warning:** investigate alongside executed outcomes. Ram Through has two persisted parser warnings while its trample/excess-damage fixture passes. Neither observation cancels the other; nontrample, invalid-target and deathtouch controls remain needed.

No missing card is replaced with a basic land, removed or treated as a blank card. Construction legality, executable coverage and CPU competence remain distinct results. An unavailable definition must not be reported as proof that the published deck is illegal under Commander rules.

## Selected-deck acceptance gates

1. **Exact data:** preserve the recorded 100-card list and commander. Obtain current card definitions for the 44 missing names, inspect compilation/mapping diagnostics and pin the resulting database identity. Classify each remaining blocker from evidence. No executable data was added by this inventory.
2. **Individual mechanics:** execute each required rule and choice. The inventory's 25 present-card fixture lists cover targeting, dynamic costs, optional/free casts, mana choices, triggered draws, counters, stun, equipment, Aura layers, temporary haste and linked hideaway. The 44 missing-card decision lists remain incomplete until their exact definitions are reviewed.
3. **Human and CPU completion:** for every mandatory or optional prompt, demonstrate legal completion or legal decline through the real human interaction interface and production CPU policy. Record unsupported prompts and stalls separately. Same legality and hidden-information boundaries apply to both.
4. **High-risk combinations:** test Mosswort Bridge's private selection and later permission, Rishkar's Expertise's optional free cast/additional costs, Monstrous Onslaught's target allocations, Scrapshooter's gift/target sequence and counter-granted mana abilities. These are requirements from present definitions, not passing assertions.
5. **Commander behavior:** command-zone choices, tax, per-commander/per-player damage and actual format configuration. Existing two-seat Vintage mechanic fixtures are insufficient.
6. **Whole deck:** finish repeatable full matches with the exact list in both seats, then complete the actual UI journey on the combined implementation. Preserve the current recovery disclosure: reload recovery is UNSUPPORTED and cannot be implied by a result screen.
7. **Admission review:** integration enables the exact deck revision only after the required evidence passes. This is a staged beta milestone; the user's wider support contract still includes recovery and other unfinished layers.

Current milestone outcome: **UNSUPPORTED**. Full-deck human/CPU decisions and complete matches: **NOT TESTED**. Inventory consistency: **PASS**, including 138 rows, exact quantities, hashes and named follow-ups for all 25 present cards in the selected deck. That consistency pass is not a game-mechanics pass.

## UI/session handoff

Requested pregame copy when this specific missing-definition condition is known:

> Not supported by this beta: missing executable cards.

Offer the exact missing names and a separate present-but-not-yet-verified list. Only use construction-legality language for an established construction violation. Present but unverified mechanics need their own support explanation. UI-003 and integration own those production changes; this report does not implement their copy or status schema.

Keep Sol Ring and Scavenging Ooze as permanent SESSION-001 fixtures. The DECK-001 runner already captures both. Legacy pass-only output is not exhaustive; unioning interfaces does not prove completeness. Unknown coverage and unproved mana-only windows stay stopped. Classify mandatory decisions using the authoritative decision type, not an available interaction alone. The observed legacy counterexample is not evidence that the integrated session skipped it.

Match-history persistence, exact-deck-version W/L and duplicate-result protection remain separate acceptance work. Neither this inventory nor `turnFlow` v1 implements those features.

## Reproduce and integrate

```sh
node experiments/phase-engine/deck-coverage-inventory.mjs
```

The generator verifies the unchanged database hash, reads both existing exact fixtures and writes `test-results/deck-002/inventory.json`. It performs no network request or engine build. The checked-in evidence records its own source hash. [Generator](../experiments/phase-engine/deck-coverage-inventory.mjs).

Integration dependencies: missing executable data and its parser/engine triage; per-card human/CPU fixtures; SESSION-001 capability evidence; UI-003 support messaging; Commander and whole-deck execution. No production files, coverage entries or admission decisions changed. Rollback is omission of this inventory-only commit.
